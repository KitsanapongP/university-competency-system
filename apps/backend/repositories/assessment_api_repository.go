package repositories

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"github.com/spw32767/university-competency-system-backend/models"
	"time"
)

var ErrAssessmentAPIBusy = errors.New("assessment API request already active")
var ErrAssessmentAPIQuota = errors.New("assessment API daily quota exhausted")
var ErrAssessmentAPIAttemptReserved = errors.New("assessment API attempt already reserved")

type AssessmentAPIRepository struct{ DB *sql.DB }

func (r *AssessmentAPIRepository) Reserve(ctx context.Context, job models.AssessmentJob, provider, model string, limit int, hold time.Duration) (uint64, error) {
	if limit <= 0 || hold <= 0 {
		return 0, ErrAssessmentAPIQuota
	}
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	var active sql.NullInt64
	var busy bool
	if err = tx.QueryRowContext(ctx, `SELECT active_call_id, COALESCE(active_until > UTC_TIMESTAMP(), FALSE) FROM ai_api_gate WHERE gate_id = 1 FOR UPDATE`).Scan(&active, &busy); err != nil {
		return 0, err
	}
	if busy {
		return 0, ErrAssessmentAPIBusy
	}
	var owned int
	if err = tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM ai_report_jobs WHERE job_id = ? AND status = 'running' AND lease_token = ? AND lease_expires_at > UTC_TIMESTAMP()`, job.JobID, job.LeaseToken).Scan(&owned); err != nil {
		return 0, err
	}
	if owned != 1 {
		return 0, ErrAssessmentLeaseLost
	}
	var existing int
	if err = tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM ai_api_calls WHERE job_id = ? AND attempt_count = ?`, job.JobID, job.AttemptCount).Scan(&existing); err != nil {
		return 0, err
	}
	if existing > 0 {
		return 0, ErrAssessmentAPIAttemptReserved
	}
	if _, err = tx.ExecContext(ctx, `INSERT IGNORE INTO ai_api_daily_usage (usage_date, call_count) VALUES (UTC_DATE(), 0)`); err != nil {
		return 0, err
	}
	var count int
	if err = tx.QueryRowContext(ctx, `SELECT call_count FROM ai_api_daily_usage WHERE usage_date = UTC_DATE() FOR UPDATE`).Scan(&count); err != nil {
		return 0, err
	}
	if count >= limit {
		return 0, ErrAssessmentAPIQuota
	}
	result, err := tx.ExecContext(ctx, `INSERT INTO ai_api_calls (job_id, attempt_count, provider_name, model_name, reserved_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP())`, job.JobID, job.AttemptCount, provider, model)
	if err != nil {
		return 0, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE ai_api_daily_usage SET call_count = call_count + 1 WHERE usage_date = UTC_DATE()`); err != nil {
		return 0, err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE ai_api_gate SET active_call_id = ?, active_until = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND) WHERE gate_id = 1`, id, assessmentDurationSeconds(hold)); err != nil {
		return 0, err
	}
	if err = tx.Commit(); err != nil {
		return 0, err
	}
	return uint64(id), nil
}

func (r *AssessmentAPIRepository) Finish(ctx context.Context, id uint64, input, output *int) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, `UPDATE ai_api_gate SET active_call_id = NULL, active_until = NULL WHERE gate_id = 1 AND active_call_id = ?`, id); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE ai_api_calls SET finished_at = UTC_TIMESTAMP(), input_tokens = ?, output_tokens = ? WHERE call_id = ? AND finished_at IS NULL`, input, output, id); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *AssessmentAPIRepository) GetLatestDraft(ctx context.Context, owner uint64, semester uint) (*models.AssessmentRejectedDraft, error) {
	var d models.AssessmentRejectedDraft
	var violation []byte
	err := r.DB.QueryRowContext(ctx, `SELECT enrollment_curriculum_id, semester, job_id, source_hash, preview, truncated, violation, created_at FROM ai_report_drafts WHERE enrollment_curriculum_id = ? AND semester = ?`, owner, semester).Scan(&d.EnrollmentCurriculumID, &d.Semester, &d.JobID, &d.SourceHash, &d.Preview, &d.Truncated, &violation, &d.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if err = json.Unmarshal(violation, &d.Violation); err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *AssessmentJobRepository) DeferAPICall(ctx context.Context, job models.AssessmentJob, delay time.Duration) error {
	result, err := r.DB.ExecContext(ctx, `UPDATE ai_report_jobs SET status = 'queued', progress_phase = 'queued', phase_started_at = UTC_TIMESTAMP(), next_attempt_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND), attempt_count = GREATEST(attempt_count - 1, 0), lease_token = NULL, lease_expires_at = NULL, heartbeat_at = NULL WHERE job_id = ? AND status = 'running' AND lease_token = ? AND lease_expires_at > UTC_TIMESTAMP()`, assessmentDurationSeconds(delay), job.JobID, job.LeaseToken)
	return assessmentRequireOwnedRows(result, err)
}

func (r *AssessmentJobRepository) MarkFailedWithDraft(ctx context.Context, job models.AssessmentJob, code string, wait time.Duration, d models.AssessmentRejectedDraft) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx, `UPDATE ai_report_jobs SET status = 'failed', progress_phase = 'failed', phase_started_at = UTC_TIMESTAMP(), error_code = ?, finished_at = UTC_TIMESTAMP(), failure_wait_until = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND), lease_token = NULL, lease_expires_at = NULL, heartbeat_at = NULL WHERE job_id = ? AND status = 'running' AND lease_token = ? AND lease_expires_at > UTC_TIMESTAMP() AND enrollment_curriculum_id = ? AND semester = ? AND input_hash = ?`, code, assessmentDurationSeconds(wait), job.JobID, job.LeaseToken, d.EnrollmentCurriculumID, d.Semester, d.SourceHash)
	if err = assessmentRequireOwnedRows(result, err); err != nil {
		return err
	}
	v, err := json.Marshal(d.Violation)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO ai_report_drafts (enrollment_curriculum_id, semester, job_id, source_hash, preview, truncated, violation, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE source_hash = IF(job_id <= VALUES(job_id), VALUES(source_hash), source_hash), preview = IF(job_id <= VALUES(job_id), VALUES(preview), preview), truncated = IF(job_id <= VALUES(job_id), VALUES(truncated), truncated), violation = IF(job_id <= VALUES(job_id), VALUES(violation), violation), created_at = IF(job_id <= VALUES(job_id), VALUES(created_at), created_at), job_id = GREATEST(job_id, VALUES(job_id))`, d.EnrollmentCurriculumID, d.Semester, job.JobID, d.SourceHash, d.Preview, d.Truncated, v)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (r *AssessmentJobRepository) CompleteAPIReport(ctx context.Context, job models.AssessmentJob, report models.AssessmentReportRecord, reports *AssessmentReportRepository) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx, `UPDATE ai_report_jobs SET status = 'succeeded', progress_phase = 'completed', phase_started_at = UTC_TIMESTAMP(), finished_at = UTC_TIMESTAMP(), lease_token = NULL, lease_expires_at = NULL, heartbeat_at = NULL, error_code = NULL, failure_wait_until = NULL WHERE job_id = ? AND status = 'running' AND lease_token = ? AND lease_expires_at > UTC_TIMESTAMP() AND enrollment_curriculum_id = ? AND semester = ? AND target_year_be = ? AND input_hash = ?`, job.JobID, job.LeaseToken, report.EnrollmentCurriculumID, report.Semester, report.TargetYearBE, report.SourceHash)
	if err = assessmentRequireOwnedRows(result, err); err != nil {
		return err
	}
	if err = reports.upsertLatestWith(ctx, tx, report); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `DELETE FROM ai_report_drafts WHERE enrollment_curriculum_id = ? AND semester = ? AND job_id <= ?`, job.EnrollmentCurriculumID, job.Semester, job.JobID); err != nil {
		return err
	}
	return tx.Commit()
}
