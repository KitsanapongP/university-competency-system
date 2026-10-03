package repositories

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/google/uuid"
	"github.com/spw32767/university-competency-system-backend/models"
)

var (
	ErrAssessmentJobNotFound    = errors.New("assessment job not found")
	ErrAssessmentJobCooldown    = errors.New("assessment generation is temporarily unavailable")
	ErrAssessmentLeaseLost      = errors.New("assessment job lease is no longer owned")
	ErrNoClaimableAssessmentJob = errors.New("no claimable assessment job")
)

const assessmentWorkerLostAfter = 45 * time.Second
const assessmentProviderActivityInterval = 2 * time.Second

type AssessmentJobCooldownError struct {
	RetryAfterSeconds int
}

func (e AssessmentJobCooldownError) Error() string {
	return fmt.Sprintf("%v: retry after %d seconds", ErrAssessmentJobCooldown, e.RetryAfterSeconds)
}

func (e AssessmentJobCooldownError) Unwrap() error {
	return ErrAssessmentJobCooldown
}

type AssessmentJobRepository struct {
	DB *sql.DB
}

func NewAssessmentJobRepository(db *sql.DB) *AssessmentJobRepository {
	return &AssessmentJobRepository{DB: db}
}

func (r *AssessmentJobRepository) Enqueue(
	ctx context.Context,
	job models.AssessmentJob,
) (models.AssessmentJob, bool, error) {
	if job.EnrollmentCurriculumID == 0 || (job.Semester != 1 && job.Semester != 2) ||
		len(job.InputHash) != 64 || !json.Valid(job.InputSnapshot) {
		return models.AssessmentJob{}, false, errors.New("invalid assessment job request")
	}
	if job.MaxAttempts == 0 {
		job.MaxAttempts = 3
	}
	tx, err := r.DB.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return models.AssessmentJob{}, false, err
	}
	defer tx.Rollback()

	var scopeID uint64
	err = tx.QueryRowContext(ctx, `
		SELECT enrollment_curriculum_id
		FROM kku_enrollment_curricula
		WHERE enrollment_curriculum_id = ? AND deleted_at IS NULL
		FOR UPDATE`, job.EnrollmentCurriculumID).Scan(&scopeID)
	if errors.Is(err, sql.ErrNoRows) {
		return models.AssessmentJob{}, false, ErrAssessmentLearnerNotFound
	}
	if err != nil {
		return models.AssessmentJob{}, false, err
	}
	if err := reconcileStaleAssessmentJobs(ctx, tx, job.EnrollmentCurriculumID, job.Semester); err != nil {
		return models.AssessmentJob{}, false, err
	}
	var retryAfter sql.NullInt64
	err = tx.QueryRowContext(ctx, `
		SELECT TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), failure_wait_until)
		FROM ai_report_jobs
		WHERE enrollment_curriculum_id = ? AND semester = ?
			AND failure_wait_until > UTC_TIMESTAMP()
		ORDER BY failure_wait_until DESC, job_id DESC
		LIMIT 1`, job.EnrollmentCurriculumID, job.Semester).Scan(&retryAfter)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return models.AssessmentJob{}, false, err
	}
	if retryAfter.Valid && retryAfter.Int64 > 0 {
		return models.AssessmentJob{}, false, AssessmentJobCooldownError{RetryAfterSeconds: int(retryAfter.Int64)}
	}

	active, err := getActiveAssessmentJob(ctx, tx, job.EnrollmentCurriculumID, job.Semester)
	if err == nil {
		if err := tx.Commit(); err != nil {
			return models.AssessmentJob{}, false, err
		}
		return active, false, nil
	}
	if !errors.Is(err, ErrAssessmentJobNotFound) {
		return models.AssessmentJob{}, false, err
	}
	result, err := tx.ExecContext(ctx, `
		INSERT INTO ai_report_jobs (
			enrollment_curriculum_id, semester, target_year_be, input_hash,
			input_snapshot, status, progress_phase, phase_started_at, max_attempts, next_attempt_at
		) VALUES (?, ?, ?, ?, ?, 'queued', 'queued', UTC_TIMESTAMP(), ?, UTC_TIMESTAMP())`,
		job.EnrollmentCurriculumID, job.Semester, job.TargetYearBE, job.InputHash,
		string(job.InputSnapshot), job.MaxAttempts,
	)
	if err != nil {
		var mysqlError *mysql.MySQLError
		if !errors.As(err, &mysqlError) || mysqlError.Number != 1062 {
			return models.AssessmentJob{}, false, err
		}
		active, fetchErr := getActiveAssessmentJob(ctx, tx, job.EnrollmentCurriculumID, job.Semester)
		if fetchErr != nil {
			return models.AssessmentJob{}, false, err
		}
		if commitErr := tx.Commit(); commitErr != nil {
			return models.AssessmentJob{}, false, commitErr
		}
		return active, false, nil
	}
	lastInsertID, err := result.LastInsertId()
	if err != nil {
		return models.AssessmentJob{}, false, err
	}
	job.JobID = uint64(lastInsertID)
	if err := tx.Commit(); err != nil {
		return models.AssessmentJob{}, false, err
	}
	created, err := getAssessmentJob(ctx, r.DB, job.JobID)
	return created, true, err
}

func (r *AssessmentJobRepository) UpdateProgress(
	ctx context.Context,
	jobID uint64,
	leaseToken string,
	phase string,
	providerActivity bool,
) error {
	switch phase {
	case "preparing", "generating", "validating", "saving":
	default:
		return fmt.Errorf("invalid assessment progress phase %q", phase)
	}
	activity := 0
	if providerActivity {
		activity = 1
	}
	result, err := r.DB.ExecContext(ctx, `
		UPDATE ai_report_jobs
		SET phase_started_at = CASE
				WHEN progress_phase <> ? OR phase_started_at IS NULL THEN UTC_TIMESTAMP()
				ELSE phase_started_at END,
			progress_phase = ?,
			last_provider_activity_at = CASE
				WHEN ? = 1 AND (last_provider_activity_at IS NULL OR
					last_provider_activity_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 2 SECOND))
				THEN UTC_TIMESTAMP() ELSE last_provider_activity_at END
		WHERE job_id = ? AND status = 'running' AND lease_token = ?
			AND lease_expires_at > UTC_TIMESTAMP()`,
		phase, phase, activity, jobID, leaseToken)
	return assessmentRequireOwnedRows(result, err)
}

func (r *AssessmentJobRepository) ReconcileStaleForUser(ctx context.Context, userID, jobID uint64) error {
	_, err := r.DB.ExecContext(ctx, `
		UPDATE ai_report_jobs job
		JOIN kku_enrollment_curricula roster
			ON roster.enrollment_curriculum_id = job.enrollment_curriculum_id
			AND roster.deleted_at IS NULL
		JOIN kku_enrollments enrollment
			ON enrollment.enrollment_id = roster.enrollment_id
			AND enrollment.deleted_at IS NULL
		JOIN auth_users account ON account.person_id = enrollment.person_id
		SET job.status = 'failed', job.progress_phase = 'failed',
			job.phase_started_at = UTC_TIMESTAMP(), job.error_code = 'worker_unavailable',
			job.finished_at = UTC_TIMESTAMP(), job.failure_wait_until = NULL,
			job.lease_token = NULL, job.lease_expires_at = NULL, job.heartbeat_at = NULL
		WHERE account.user_id = ? AND job.job_id = ? AND job.status = 'running'
			AND (job.heartbeat_at IS NULL OR job.heartbeat_at <=
				DATE_SUB(UTC_TIMESTAMP(), INTERVAL 45 SECOND))`, userID, jobID)
	return err
}

func reconcileStaleAssessmentJobs(
	ctx context.Context,
	queryer interface {
		ExecContext(context.Context, string, ...any) (sql.Result, error)
	},
	scopeID uint64,
	semester uint,
) error {
	_, err := queryer.ExecContext(ctx, `
		UPDATE ai_report_jobs
		SET status = 'failed', progress_phase = 'failed', phase_started_at = UTC_TIMESTAMP(),
			error_code = 'worker_unavailable', finished_at = UTC_TIMESTAMP(),
			failure_wait_until = NULL, lease_token = NULL, lease_expires_at = NULL, heartbeat_at = NULL
		WHERE enrollment_curriculum_id = ? AND semester = ? AND status = 'running'
			AND (heartbeat_at IS NULL OR heartbeat_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 45 SECOND))`,
		scopeID, semester)
	return err
}

func (r *AssessmentJobRepository) ClaimNext(ctx context.Context, leaseDuration time.Duration) (models.AssessmentJob, error) {
	if leaseDuration <= 0 {
		return models.AssessmentJob{}, errors.New("assessment lease duration must be positive")
	}
	_, err := r.DB.ExecContext(ctx, `
		UPDATE ai_report_jobs
		SET status = 'failed', error_code = 'lease_attempts_exhausted',
			finished_at = UTC_TIMESTAMP(),
			failure_wait_until = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 60 SECOND), lease_token = NULL,
			lease_expires_at = NULL, heartbeat_at = NULL
		WHERE status = 'running' AND lease_expires_at <= UTC_TIMESTAMP()
			AND attempt_count >= max_attempts`)
	if err != nil {
		return models.AssessmentJob{}, err
	}
	var jobID uint64
	err = r.DB.QueryRowContext(ctx, `
		SELECT job_id
		FROM ai_report_jobs
		WHERE attempt_count < max_attempts
			AND ((status = 'queued' AND (next_attempt_at IS NULL OR next_attempt_at <= UTC_TIMESTAMP()))
				OR (status = 'running' AND lease_expires_at <= UTC_TIMESTAMP()))
		ORDER BY requested_at, job_id
		LIMIT 1`).Scan(&jobID)
	if errors.Is(err, sql.ErrNoRows) {
		return models.AssessmentJob{}, ErrNoClaimableAssessmentJob
	}
	if err != nil {
		return models.AssessmentJob{}, err
	}
	leaseToken := uuid.NewString()
	result, err := r.DB.ExecContext(ctx, `
		UPDATE ai_report_jobs
		SET status = 'running', attempt_count = attempt_count + 1,
			progress_phase = 'preparing', phase_started_at = UTC_TIMESTAMP(), last_provider_activity_at = NULL,
			lease_token = ?, lease_expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND),
			heartbeat_at = UTC_TIMESTAMP(), started_at = COALESCE(started_at, UTC_TIMESTAMP()),
			next_attempt_at = NULL
		WHERE job_id = ? AND attempt_count < max_attempts
			AND ((status = 'queued' AND (next_attempt_at IS NULL OR next_attempt_at <= UTC_TIMESTAMP()))
				OR (status = 'running' AND lease_expires_at <= UTC_TIMESTAMP()))`,
		leaseToken, assessmentDurationSeconds(leaseDuration), jobID)
	if err != nil {
		return models.AssessmentJob{}, err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return models.AssessmentJob{}, err
	}
	if rowsAffected != 1 {
		return models.AssessmentJob{}, ErrNoClaimableAssessmentJob
	}
	job, err := getAssessmentJob(ctx, r.DB, jobID)
	if err != nil {
		return models.AssessmentJob{}, err
	}
	return job, nil
}

func (r *AssessmentJobRepository) Heartbeat(ctx context.Context, jobID uint64, leaseToken string, leaseDuration time.Duration) error {
	if leaseDuration <= 0 {
		return errors.New("assessment lease duration must be positive")
	}
	result, err := r.DB.ExecContext(ctx, `
		UPDATE ai_report_jobs
		SET heartbeat_at = UTC_TIMESTAMP(), lease_expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND)
		WHERE job_id = ? AND status = 'running' AND lease_token = ?
		AND lease_expires_at > UTC_TIMESTAMP()`, assessmentDurationSeconds(leaseDuration), jobID, leaseToken)
	return assessmentRequireOwnedRows(result, err)
}

func (r *AssessmentJobRepository) QueueRetry(ctx context.Context, jobID uint64, leaseToken string, delay time.Duration) error {
	if delay < 0 {
		return errors.New("assessment retry delay cannot be negative")
	}
	result, err := r.DB.ExecContext(ctx, `
		UPDATE ai_report_jobs
		SET status = 'queued', next_attempt_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND),
			progress_phase = 'queued', phase_started_at = UTC_TIMESTAMP(), last_provider_activity_at = NULL,
			lease_token = NULL, lease_expires_at = NULL, heartbeat_at = NULL, error_code = NULL
		WHERE job_id = ? AND status = 'running' AND lease_token = ?
			AND lease_expires_at > UTC_TIMESTAMP() AND attempt_count < max_attempts`,
		assessmentDurationSeconds(delay), jobID, leaseToken)
	return assessmentRequireOwnedRows(result, err)
}

func (r *AssessmentJobRepository) MarkFailed(
	ctx context.Context,
	jobID uint64,
	leaseToken string,
	errorCode string,
	failureWait time.Duration,
) error {
	if failureWait < 0 {
		return errors.New("assessment failure wait cannot be negative")
	}
	if strings.TrimSpace(errorCode) == "" || len(errorCode) > 80 {
		return errors.New("assessment failure error code is required and must be at most 80 characters")
	}
	result, err := r.DB.ExecContext(ctx, `
		UPDATE ai_report_jobs
		SET status = 'failed', progress_phase = 'failed', phase_started_at = UTC_TIMESTAMP(),
			error_code = ?, finished_at = UTC_TIMESTAMP(),
			failure_wait_until = CASE WHEN ? > 0 THEN DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND) ELSE NULL END,
			lease_token = NULL, lease_expires_at = NULL, heartbeat_at = NULL
		WHERE job_id = ? AND status = 'running' AND lease_token = ?
			AND lease_expires_at > UTC_TIMESTAMP()`,
		errorCode, assessmentDurationSeconds(failureWait), assessmentDurationSeconds(failureWait), jobID, leaseToken)
	return assessmentRequireOwnedRows(result, err)
}

func (r *AssessmentJobRepository) CompleteSuccessfully(
	ctx context.Context,
	jobID uint64,
	leaseToken string,
	report models.AssessmentReportRecord,
	reports *AssessmentReportRepository,
) error {
	if reports == nil {
		return errors.New("assessment report repository is required")
	}
	if report.SourceHash == "" || report.GeneratedAt.IsZero() {
		return errors.New("assessment report source hash and generated time are required")
	}
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx, `
		UPDATE ai_report_jobs
		SET status = 'succeeded', progress_phase = 'completed', phase_started_at = UTC_TIMESTAMP(),
			finished_at = UTC_TIMESTAMP(),
			lease_token = NULL, lease_expires_at = NULL, heartbeat_at = NULL,
			error_code = NULL, failure_wait_until = NULL
		WHERE job_id = ? AND status = 'running' AND lease_token = ?
			AND lease_expires_at > UTC_TIMESTAMP()
			AND enrollment_curriculum_id = ? AND semester = ? AND target_year_be = ?
			AND input_hash = ?`,
		jobID, leaseToken, report.EnrollmentCurriculumID, report.Semester, report.TargetYearBE, report.SourceHash)
	if err != nil {
		return err
	}
	if err := assessmentRequireOwnedRows(result, nil); err != nil {
		return err
	}
	if err := reports.upsertLatestWith(ctx, tx, report); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *AssessmentJobRepository) GetForOwner(ctx context.Context, scopeID uint64, semester uint, jobID uint64) (models.AssessmentJob, error) {
	return getAssessmentJobByOwner(ctx, r.DB, scopeID, semester, jobID)
}

func (r *AssessmentJobRepository) GetForUser(ctx context.Context, userID, jobID uint64) (models.AssessmentJob, error) {
	if err := r.ReconcileStaleForUser(ctx, userID, jobID); err != nil {
		return models.AssessmentJob{}, err
	}
	return scanAssessmentJob(r.DB.QueryRowContext(ctx, assessmentJobSelect+`
		JOIN kku_enrollment_curricula roster
			ON roster.enrollment_curriculum_id = ai_report_jobs.enrollment_curriculum_id
			AND roster.deleted_at IS NULL
		JOIN kku_enrollments enrollment
			ON enrollment.enrollment_id = roster.enrollment_id
			AND enrollment.deleted_at IS NULL
		JOIN auth_users account ON account.person_id = enrollment.person_id
		WHERE account.user_id = ? AND ai_report_jobs.job_id = ?
		LIMIT 1`, userID, jobID))
}

func (r *AssessmentJobRepository) GetActive(ctx context.Context, scopeID uint64, semester uint) (models.AssessmentJob, error) {
	if err := reconcileStaleAssessmentJobs(ctx, r.DB, scopeID, semester); err != nil {
		return models.AssessmentJob{}, err
	}
	return getActiveAssessmentJob(ctx, r.DB, scopeID, semester)
}

func (r *AssessmentJobRepository) GetLatestForOwner(ctx context.Context, scopeID uint64, semester uint) (models.AssessmentJob, error) {
	if err := reconcileStaleAssessmentJobs(ctx, r.DB, scopeID, semester); err != nil {
		return models.AssessmentJob{}, err
	}
	return scanAssessmentJob(r.DB.QueryRowContext(ctx, assessmentJobSelect+`
		WHERE enrollment_curriculum_id = ? AND semester = ?
		ORDER BY job_id DESC LIMIT 1`, scopeID, semester))
}

func (r *AssessmentJobRepository) SupersedeActive(ctx context.Context, scopeID uint64, semester uint, currentHash string) error {
	_, err := r.DB.ExecContext(ctx, `
		UPDATE ai_report_jobs
		SET status = 'failed', error_code = 'source_superseded', finished_at = UTC_TIMESTAMP(),
			failure_wait_until = NULL, lease_token = NULL, lease_expires_at = NULL, heartbeat_at = NULL
		WHERE enrollment_curriculum_id = ? AND semester = ?
			AND status IN ('queued', 'running') AND input_hash <> ?`, scopeID, semester, currentHash)
	return err
}

func getActiveAssessmentJob(ctx context.Context, queryer AssessmentQueryer, scopeID uint64, semester uint) (models.AssessmentJob, error) {
	return scanAssessmentJob(queryer.QueryRowContext(ctx, `
		SELECT job_id, enrollment_curriculum_id, semester, target_year_be, input_hash,
			input_snapshot, status, progress_phase, phase_started_at, last_provider_activity_at,
			attempt_count, max_attempts, lease_token,
			lease_expires_at, heartbeat_at, next_attempt_at, failure_wait_until,
			requested_at, started_at, finished_at, error_code
		FROM ai_report_jobs
		WHERE enrollment_curriculum_id = ? AND semester = ? AND status IN ('queued', 'running')
		ORDER BY job_id DESC LIMIT 1`, scopeID, semester))
}

func getAssessmentJob(ctx context.Context, queryer AssessmentQueryer, jobID uint64) (models.AssessmentJob, error) {
	return scanAssessmentJob(queryer.QueryRowContext(ctx, assessmentJobSelect+` WHERE job_id = ?`, jobID))
}

const assessmentJobSelect = `
	SELECT ai_report_jobs.job_id, ai_report_jobs.enrollment_curriculum_id,
		ai_report_jobs.semester, ai_report_jobs.target_year_be, ai_report_jobs.input_hash,
		ai_report_jobs.input_snapshot, ai_report_jobs.status, ai_report_jobs.progress_phase,
		ai_report_jobs.phase_started_at, ai_report_jobs.last_provider_activity_at,
		ai_report_jobs.attempt_count,
		ai_report_jobs.max_attempts, ai_report_jobs.lease_token,
		ai_report_jobs.lease_expires_at, ai_report_jobs.heartbeat_at,
		ai_report_jobs.next_attempt_at, ai_report_jobs.failure_wait_until,
		ai_report_jobs.requested_at, ai_report_jobs.started_at,
		ai_report_jobs.finished_at, ai_report_jobs.error_code
	FROM ai_report_jobs`

func getAssessmentJobByOwner(ctx context.Context, queryer AssessmentQueryer, scopeID uint64, semester uint, jobID uint64) (models.AssessmentJob, error) {
	return scanAssessmentJob(queryer.QueryRowContext(ctx, assessmentJobSelect+`
		WHERE enrollment_curriculum_id = ? AND semester = ? AND job_id = ?`, scopeID, semester, jobID))
}

type assessmentJobScanner interface {
	Scan(...any) error
}

func scanAssessmentJob(scanner assessmentJobScanner) (models.AssessmentJob, error) {
	var job models.AssessmentJob
	var snapshot []byte
	var leaseToken, errorCode sql.NullString
	var phaseStartedAt, lastProviderActivityAt sql.NullTime
	var leaseExpiresAt, heartbeatAt, nextAttemptAt, failureWaitUntil, startedAt, finishedAt sql.NullTime
	err := scanner.Scan(
		&job.JobID, &job.EnrollmentCurriculumID, &job.Semester, &job.TargetYearBE,
		&job.InputHash, &snapshot, &job.Status, &job.ProgressPhase, &phaseStartedAt,
		&lastProviderActivityAt, &job.AttemptCount, &job.MaxAttempts,
		&leaseToken, &leaseExpiresAt, &heartbeatAt, &nextAttemptAt, &failureWaitUntil,
		&job.RequestedAt, &startedAt, &finishedAt, &errorCode,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return models.AssessmentJob{}, ErrAssessmentJobNotFound
	}
	if err != nil {
		return models.AssessmentJob{}, err
	}
	job.InputSnapshot = append(job.InputSnapshot[:0], snapshot...)
	job.LeaseToken = leaseToken.String
	job.ErrorCode = errorCode.String
	job.PhaseStartedAt = nullableAssessmentTime(phaseStartedAt)
	job.LastProviderActivityAt = nullableAssessmentTime(lastProviderActivityAt)
	job.LeaseExpiresAt = nullableAssessmentTime(leaseExpiresAt)
	job.HeartbeatAt = nullableAssessmentTime(heartbeatAt)
	job.NextAttemptAt = nullableAssessmentTime(nextAttemptAt)
	job.FailureWaitUntil = nullableAssessmentTime(failureWaitUntil)
	job.StartedAt = nullableAssessmentTime(startedAt)
	job.FinishedAt = nullableAssessmentTime(finishedAt)
	return job, nil
}

func nullableAssessmentTime(value sql.NullTime) *time.Time {
	if !value.Valid {
		return nil
	}
	copy := value.Time
	return &copy
}

func assessmentRequireOwnedRows(result sql.Result, err error) error {
	if err != nil {
		return err
	}
	if result == nil {
		return ErrAssessmentLeaseLost
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows != 1 {
		return ErrAssessmentLeaseLost
	}
	return nil
}

func assessmentDurationSeconds(value time.Duration) int {
	if value <= 0 {
		return 0
	}
	return int((value + time.Second - 1) / time.Second)
}
