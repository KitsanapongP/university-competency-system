package repositories

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/spw32767/university-competency-system-backend/models"
)

func TestAssessmentJobRepositoryMySQLConcurrencyAndFencing(t *testing.T) {
	dsn := os.Getenv("LEARNER_ASSESSMENT_TEST_DSN")
	if dsn == "" {
		t.Skip("set LEARNER_ASSESSMENT_TEST_DSN to an isolated migrated MySQL *_test database")
	}
	parsed, err := mysql.ParseDSN(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasSuffix(parsed.DBName, "_test") {
		t.Fatalf("refusing to modify database %q: test database name must end with _test", parsed.DBName)
	}
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(12)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		t.Fatal(err)
	}

	var scopeID uint64
	err = db.QueryRowContext(ctx, `
		SELECT enrollment.enrollment_curriculum_id
		FROM kku_enrollment_curricula enrollment
		WHERE enrollment.deleted_at IS NULL
			AND NOT EXISTS (
				SELECT 1 FROM ai_report_jobs job
				WHERE job.enrollment_curriculum_id = enrollment.enrollment_curriculum_id AND job.semester = 1
			)
			AND NOT EXISTS (
				SELECT 1 FROM ai_learner_reports report
				WHERE report.enrollment_curriculum_id = enrollment.enrollment_curriculum_id AND report.semester = 1
			)
			AND NOT EXISTS (
				SELECT 1 FROM ai_report_jobs job
				WHERE job.enrollment_curriculum_id = enrollment.enrollment_curriculum_id AND job.semester = 2
			)
			AND NOT EXISTS (
				SELECT 1 FROM ai_learner_reports report
				WHERE report.enrollment_curriculum_id = enrollment.enrollment_curriculum_id AND report.semester = 2
			)
		ORDER BY enrollment.enrollment_curriculum_id
		LIMIT 1`).Scan(&scopeID)
	if errors.Is(err, sql.ErrNoRows) {
		t.Skip("isolated test database has no unused enrollment curriculum")
	}
	if err != nil {
		t.Fatal(err)
	}
	jobs := NewAssessmentJobRepository(db)
	reports := NewAssessmentReportRepository(db)
	cleanup := make([]uint64, 0, 2)
	t.Cleanup(func() {
		for _, jobID := range cleanup {
			_, _ = db.Exec(`DELETE FROM ai_report_jobs WHERE job_id = ?`, jobID)
		}
		_, _ = db.Exec(`DELETE FROM ai_learner_reports WHERE enrollment_curriculum_id = ? AND semester = 1`, scopeID)
	})

	request := models.AssessmentJob{
		EnrollmentCurriculumID: scopeID,
		Semester:               1,
		TargetYearBE:           2568,
		InputHash:              strings.Repeat("a", 64),
		InputSnapshot:          json.RawMessage(`{"snapshot":true}`),
		MaxAttempts:            3,
	}
	const requesters = 2
	start := make(chan struct{})
	results := make(chan enqueueResult, requesters)
	var wait sync.WaitGroup
	for range requesters {
		wait.Add(1)
		go func() {
			defer wait.Done()
			<-start
			job, created, enqueueErr := jobs.Enqueue(ctx, request)
			results <- enqueueResult{job: job, created: created, err: enqueueErr}
		}()
	}
	close(start)
	wait.Wait()
	close(results)
	var firstJob models.AssessmentJob
	createdCount := 0
	for result := range results {
		if result.err != nil {
			t.Fatal(result.err)
		}
		if firstJob.JobID == 0 {
			firstJob = result.job
		} else if firstJob.JobID != result.job.JobID {
			t.Fatalf("concurrent requests created different active jobs: %d and %d", firstJob.JobID, result.job.JobID)
		}
		if result.created {
			createdCount++
		}
	}
	cleanup = append(cleanup, firstJob.JobID)
	if createdCount != 1 {
		t.Fatalf("concurrent enqueues created %d jobs, want exactly one", createdCount)
	}
	var ownerUserID uint64
	if err := db.QueryRowContext(ctx, `
		SELECT account.user_id
		FROM kku_enrollment_curricula roster
		JOIN kku_enrollments enrollment ON enrollment.enrollment_id = roster.enrollment_id
		JOIN auth_users account ON account.person_id = enrollment.person_id
		WHERE roster.enrollment_curriculum_id = ?
		LIMIT 1`, scopeID).Scan(&ownerUserID); err != nil {
		t.Fatal(err)
	}
	ownedJob, err := jobs.GetForUser(ctx, ownerUserID, firstJob.JobID)
	if err != nil || ownedJob.JobID != firstJob.JobID {
		t.Fatalf("owner could not read their job: %+v, err=%v", ownedJob, err)
	}
	if _, err := jobs.GetForUser(ctx, 0, firstJob.JobID); !errors.Is(err, ErrAssessmentJobNotFound) {
		t.Fatalf("foreign job lookup error = %v, want not found", err)
	}

	claimStart := make(chan struct{})
	claims := make(chan claimResult, requesters)
	wait = sync.WaitGroup{}
	for range requesters {
		wait.Add(1)
		go func() {
			defer wait.Done()
			<-claimStart
			job, claimErr := jobs.ClaimNext(ctx, 30*time.Second)
			claims <- claimResult{job: job, err: claimErr}
		}()
	}
	close(claimStart)
	wait.Wait()
	close(claims)
	var claimed models.AssessmentJob
	claimSuccesses, claimConflicts := 0, 0
	for result := range claims {
		switch {
		case result.err == nil:
			claimed = result.job
			claimSuccesses++
		case errors.Is(result.err, ErrNoClaimableAssessmentJob):
			claimConflicts++
		default:
			t.Fatal(result.err)
		}
	}
	if claimSuccesses != 1 || claimConflicts != 1 {
		t.Fatalf("claim outcomes successes=%d conflicts=%d, want one each", claimSuccesses, claimConflicts)
	}
	if err := jobs.Heartbeat(ctx, claimed.JobID, claimed.LeaseToken, 30*time.Second); err != nil {
		t.Fatal(err)
	}

	invalidReport := testAssessmentReport(scopeID, request.InputHash)
	invalidReport.Content = json.RawMessage(`not-json`)
	if err := jobs.CompleteSuccessfully(ctx, claimed.JobID, claimed.LeaseToken, invalidReport, reports); err == nil {
		t.Fatal("invalid report content should roll back the job success transition")
	}
	stillOwned, err := jobs.GetForOwner(ctx, scopeID, 1, claimed.JobID)
	if err != nil || stillOwned.Status != "running" || stillOwned.LeaseToken != claimed.LeaseToken {
		t.Fatalf("failed report transaction changed job state: %+v, err=%v", stillOwned, err)
	}

	if _, err := db.ExecContext(ctx, `UPDATE ai_report_jobs SET lease_expires_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 SECOND) WHERE job_id = ? AND lease_token = ?`, claimed.JobID, claimed.LeaseToken); err != nil {
		t.Fatal(err)
	}
	reclaimed, err := jobs.ClaimNext(ctx, 30*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	if reclaimed.JobID != claimed.JobID || reclaimed.LeaseToken == claimed.LeaseToken {
		t.Fatalf("expired job was not fenced with a new lease: first=%+v reclaimed=%+v", claimed, reclaimed)
	}
	if err := jobs.Heartbeat(ctx, claimed.JobID, claimed.LeaseToken, 30*time.Second); !errors.Is(err, ErrAssessmentLeaseLost) {
		t.Fatalf("expired worker heartbeat error = %v, want lease lost", err)
	}
	if err := jobs.CompleteSuccessfully(ctx, claimed.JobID, claimed.LeaseToken, testAssessmentReport(scopeID, request.InputHash), reports); !errors.Is(err, ErrAssessmentLeaseLost) {
		t.Fatalf("expired worker completion error = %v, want lease lost", err)
	}
	validReport := testAssessmentReport(scopeID, request.InputHash)
	if err := jobs.CompleteSuccessfully(ctx, reclaimed.JobID, reclaimed.LeaseToken, validReport, reports); err != nil {
		t.Fatal(err)
	}
	stored, err := reports.GetLatest(ctx, scopeID, 1)
	if err != nil || stored.SourceHash != request.InputHash {
		t.Fatalf("latest report was not atomically saved: %+v, err=%v", stored, err)
	}

	secondRequest := request
	secondRequest.InputHash = strings.Repeat("b", 64)
	failedJob, _, err := jobs.Enqueue(ctx, secondRequest)
	if err != nil {
		t.Fatal(err)
	}
	cleanup = append(cleanup, failedJob.JobID)
	failedClaim, err := jobs.ClaimNext(ctx, 30*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	if err := jobs.MarkFailed(ctx, failedClaim.JobID, failedClaim.LeaseToken, "provider_unavailable", 60*time.Second); err != nil {
		t.Fatal(err)
	}
	thirdRequest := request
	thirdRequest.InputHash = strings.Repeat("c", 64)
	if _, _, err := jobs.Enqueue(ctx, thirdRequest); !errors.Is(err, ErrAssessmentJobCooldown) {
		t.Fatalf("enqueue during failure wait error = %v, want cooldown", err)
	}

	staleRequest := request
	staleRequest.Semester = 2
	staleRequest.InputHash = strings.Repeat("e", 64)
	staleJob, _, err := jobs.Enqueue(ctx, staleRequest)
	if err != nil {
		t.Fatal(err)
	}
	cleanup = append(cleanup, staleJob.JobID)
	staleClaim, err := jobs.ClaimNext(ctx, 2*time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	if err := jobs.UpdateProgress(ctx, staleClaim.JobID, staleClaim.LeaseToken, "generating", true); err != nil {
		t.Fatal(err)
	}
	progress, err := jobs.GetForUser(ctx, ownerUserID, staleClaim.JobID)
	if err != nil || progress.ProgressPhase != "generating" || progress.LastProviderActivityAt == nil {
		t.Fatalf("job progress was not persisted: %+v, err=%v", progress, err)
	}
	if _, err := db.ExecContext(ctx, `
		UPDATE ai_report_jobs SET heartbeat_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 46 SECOND)
		WHERE job_id = ? AND lease_token = ?`, staleClaim.JobID, staleClaim.LeaseToken); err != nil {
		t.Fatal(err)
	}
	reconciled, err := jobs.GetForUser(ctx, ownerUserID, staleClaim.JobID)
	if err != nil || reconciled.Status != "failed" || reconciled.ErrorCode != "worker_unavailable" {
		t.Fatalf("stale worker heartbeat was not reconciled: %+v, err=%v", reconciled, err)
	}
	if err := jobs.UpdateProgress(ctx, staleClaim.JobID, staleClaim.LeaseToken, "validating", false); !errors.Is(err, ErrAssessmentLeaseLost) {
		t.Fatalf("stale worker progress update error = %v, want lease lost", err)
	}
}

type enqueueResult struct {
	job     models.AssessmentJob
	created bool
	err     error
}

type claimResult struct {
	job models.AssessmentJob
	err error
}

func testAssessmentReport(scopeID uint64, sourceHash string) models.AssessmentReportRecord {
	return models.AssessmentReportRecord{
		EnrollmentCurriculumID:    scopeID,
		Semester:                  1,
		TargetYearBE:              2568,
		SourceHash:                sourceHash,
		SourceSnapshot:            json.RawMessage(`{"snapshot":true}`),
		Content:                   json.RawMessage(`{"strengths":[]}`),
		Completeness:              "full",
		ProviderName:              "ollama",
		ModelName:                 "qwen3:4b",
		ModelDigest:               "sha256:synthetic-test-digest",
		ProviderConfigFingerprint: strings.Repeat("d", 64),
		PipelineVersion:           "learner-assessment-v1",
		PromptVersion:             "learner-assessment-prompt-v1",
		SchemaVersion:             "learner-assessment-output-v1",
		GeneratedAt:               time.Now().UTC(),
	}
}
