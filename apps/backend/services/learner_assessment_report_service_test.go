package services

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
)

func TestLearnerAssessmentReportGetReturnsOnlyCurrentReport(t *testing.T) {
	now := time.Date(2026, 10, 1, 12, 0, 0, 0, time.UTC)
	snapshot := reportServiceSnapshot(t)
	report := models.AssessmentReportRecord{SourceHash: snapshot.Metadata.SourceHash, GeneratedAt: now.Add(-time.Minute)}
	service, _, _, _ := reportServiceFixture(snapshot, report, now)
	state, err := service.Get(context.Background(), 77, 2)
	if err != nil {
		t.Fatal(err)
	}
	if state.GenerationState != AssessmentReportCurrent || state.Report == nil {
		t.Fatalf("current report state = %+v", state)
	}

	stale := report
	stale.SourceHash = "stale-source-hash"
	service, _, _, _ = reportServiceFixture(snapshot, stale, now)
	state, err = service.Get(context.Background(), 77, 2)
	if err != nil {
		t.Fatal(err)
	}
	if state.GenerationState != AssessmentReportMissing || !state.IsStale || state.Report != nil {
		t.Fatalf("stale report must be hidden: %+v", state)
	}
}

func TestLearnerAssessmentReportGetUsesActiveAndFailedJobStates(t *testing.T) {
	now := time.Date(2026, 10, 1, 12, 0, 0, 0, time.UTC)
	snapshot := reportServiceSnapshot(t)
	service, _, jobs, _ := reportServiceFixture(snapshot, models.AssessmentReportRecord{}, now)
	jobs.active = models.AssessmentJob{JobID: 9, Status: "queued", InputHash: snapshot.Metadata.SourceHash}
	jobs.activeErr = nil
	state, err := service.Get(context.Background(), 77, 2)
	if err != nil || state.GenerationState != AssessmentReportQueued || state.Job == nil {
		t.Fatalf("queued report state = %+v, err=%v", state, err)
	}

	jobs.active = models.AssessmentJob{}
	jobs.activeErr = repositories.ErrAssessmentJobNotFound
	waitUntil := now.Add(42 * time.Second)
	jobs.latest = models.AssessmentJob{JobID: 10, Status: "failed", InputHash: snapshot.Metadata.SourceHash, FailureWaitUntil: &waitUntil}
	jobs.latestErr = nil
	state, err = service.Get(context.Background(), 77, 2)
	if err != nil || state.GenerationState != AssessmentReportFailed || state.RetryAfterSeconds != 42 {
		t.Fatalf("failed report state = %+v, err=%v", state, err)
	}
}

func TestLearnerAssessmentReportGetPreservesCurrentReportWithFailedRegeneration(t *testing.T) {
	now := time.Date(2026, 10, 1, 12, 0, 0, 0, time.UTC)
	snapshot := reportServiceSnapshot(t)
	report := models.AssessmentReportRecord{SourceHash: snapshot.Metadata.SourceHash, GeneratedAt: now.Add(-time.Hour)}
	service, _, jobs, _ := reportServiceFixture(snapshot, report, now)
	failureWait := now.Add(30 * time.Second)
	jobs.latest = models.AssessmentJob{
		JobID:            11,
		Status:           "failed",
		InputHash:        snapshot.Metadata.SourceHash,
		ErrorCode:        "invalid_output",
		RequestedAt:      now.Add(-time.Minute),
		FailureWaitUntil: &failureWait,
	}
	jobs.latestErr = nil

	state, err := service.Get(context.Background(), 77, 2)
	if err != nil || state.GenerationState != AssessmentReportCurrent || state.Report == nil || state.Job == nil || state.RetryAfterSeconds != 30 {
		t.Fatalf("current report should remain available with failed regeneration status: %+v, err=%v", state, err)
	}
}

func TestLearnerAssessmentReportGetMapsContextExceededFailure(t *testing.T) {
	now := time.Date(2026, 10, 1, 12, 0, 0, 0, time.UTC)
	snapshot := reportServiceSnapshot(t)
	service, _, jobs, _ := reportServiceFixture(snapshot, models.AssessmentReportRecord{}, now)
	jobs.latest = models.AssessmentJob{Status: "failed", InputHash: snapshot.Metadata.SourceHash, ErrorCode: "context_exceeded"}
	jobs.latestErr = nil

	state, err := service.Get(context.Background(), 77, 2)
	if err != nil || state.GenerationState != AssessmentReportContextExceeded {
		t.Fatalf("context exceeded state = %+v, err=%v", state, err)
	}
}

func TestLearnerAssessmentReportGenerateHandlesInsufficientContextAndDedup(t *testing.T) {
	now := time.Date(2026, 10, 1, 12, 0, 0, 0, time.UTC)
	snapshot := reportServiceSnapshot(t)
	service, _, jobs, builder := reportServiceFixture(snapshot, models.AssessmentReportRecord{}, now)
	state, err := service.Generate(context.Background(), 77, 2, false)
	if err != nil || state.GenerationState != AssessmentReportQueued || jobs.enqueueCount != 1 {
		t.Fatalf("first generation = %+v, enqueue=%d, err=%v", state, jobs.enqueueCount, err)
	}
	state, err = service.Generate(context.Background(), 77, 2, false)
	if err != nil || jobs.enqueueCount != 1 {
		t.Fatalf("deduplicated generation = %+v, enqueue=%d, err=%v", state, jobs.enqueueCount, err)
	}

	insufficient := snapshot
	insufficient.Completeness = "none"
	builder.snapshot = &insufficient
	builder.snapshot.Metadata.SourceHash, _ = calculateAssessmentSourceHash(builder.snapshot)
	state, err = service.Generate(context.Background(), 77, 2, false)
	if err != nil || state.GenerationState != AssessmentReportInsufficientData || jobs.enqueueCount != 1 {
		t.Fatalf("insufficient data = %+v, enqueue=%d, err=%v", state, jobs.enqueueCount, err)
	}

	overBudget := snapshot
	overBudget.Metadata = assessmentSourceMetadata(AssessmentContextBudget{ContextTokens: 1024, OutputReserveTokens: 256, SafetyMarginTokens: 64})
	for index := range overBudget.EligibleCareers {
		overBudget.EligibleCareers[index].DescriptionTH = assessmentStringPointerWithFallback(assessmentStringPointer(repeatAssessmentText("รายละเอียด", 600)), "")
	}
	overBudget.Metadata.SourceHash, _ = calculateAssessmentSourceHash(&overBudget)
	builder.snapshot = &overBudget
	state, err = service.Generate(context.Background(), 77, 2, false)
	if err != nil || state.GenerationState != AssessmentReportContextExceeded || jobs.enqueueCount != 1 {
		t.Fatalf("context exceeded = %+v, enqueue=%d, err=%v", state, jobs.enqueueCount, err)
	}
}

func TestLearnerAssessmentReportGenerateDoesNotQueueWithoutPinnedModel(t *testing.T) {
	snapshot := reportServiceSnapshot(t)
	service, _, jobs, _ := reportServiceFixture(snapshot, models.AssessmentReportRecord{}, time.Now().UTC())
	service.GenerationEnabled = false

	_, err := service.Generate(context.Background(), 77, 2, false)
	if !errors.Is(err, ErrAssessmentReportNotReady) {
		t.Fatalf("generation without pinned model error = %v, want not ready", err)
	}
	if jobs.enqueueCount != 0 {
		t.Fatalf("queued %d jobs without pinned model digest", jobs.enqueueCount)
	}
}

func TestLearnerAssessmentReportGenerateEnforcesForceAndFailureCooldown(t *testing.T) {
	now := time.Date(2026, 10, 1, 12, 0, 0, 0, time.UTC)
	snapshot := reportServiceSnapshot(t)
	report := models.AssessmentReportRecord{SourceHash: snapshot.Metadata.SourceHash, GeneratedAt: now.Add(-time.Minute)}
	service, reports, jobs, _ := reportServiceFixture(snapshot, report, now)
	state, err := service.Generate(context.Background(), 77, 2, true)
	var forceCooldown AssessmentReportCooldownError
	if !errors.As(err, &forceCooldown) || forceCooldown.RetryAfterSeconds != 240 || state.Report == nil {
		t.Fatalf("force cooldown state=%+v err=%v", state, err)
	}

	service.Now = func() time.Time { return now.Add(6 * time.Minute) }
	state, err = service.Generate(context.Background(), 77, 2, true)
	if err != nil || state.GenerationState != AssessmentReportQueued || jobs.enqueueCount != 1 {
		t.Fatalf("force after cooldown = %+v, enqueue=%d, err=%v", state, jobs.enqueueCount, err)
	}

	jobs.active = models.AssessmentJob{}
	jobs.activeErr = repositories.ErrAssessmentJobNotFound
	reports.err = repositories.ErrAssessmentReportNotFound
	jobs.enqueueErr = repositories.AssessmentJobCooldownError{RetryAfterSeconds: 37}
	state, err = service.Generate(context.Background(), 77, 2, false)
	var failureCooldown repositories.AssessmentJobCooldownError
	if !errors.As(err, &failureCooldown) || state.RetryAfterSeconds != 37 {
		t.Fatalf("failure cooldown state=%+v err=%v", state, err)
	}
}

func TestLearnerAssessmentReportGenerateSupersedesOldInputJob(t *testing.T) {
	now := time.Date(2026, 10, 1, 12, 0, 0, 0, time.UTC)
	snapshot := reportServiceSnapshot(t)
	service, _, jobs, builder := reportServiceFixture(snapshot, models.AssessmentReportRecord{}, now)
	jobs.active = models.AssessmentJob{JobID: 22, Status: "running", InputHash: "older-input"}
	state, err := service.Generate(context.Background(), 77, 2, false)
	if err != nil || state.GenerationState != AssessmentReportQueued || jobs.supersedeCount != 1 {
		t.Fatalf("superseded request = %+v, count=%d, err=%v", state, jobs.supersedeCount, err)
	}
	if jobs.supersededHash != builder.snapshot.Metadata.SourceHash {
		t.Fatalf("superseded hash = %q, want current %q", jobs.supersededHash, builder.snapshot.Metadata.SourceHash)
	}
}

func reportServiceFixture(
	snapshot models.LearnerAssessmentSnapshot,
	report models.AssessmentReportRecord,
	now time.Time,
) (*LearnerAssessmentReportService, *fakeAssessmentReportStore, *fakeAssessmentJobStore, *fakeAssessmentSnapshotBuilder) {
	builder := &fakeAssessmentSnapshotBuilder{snapshot: &snapshot}
	reports := &fakeAssessmentReportStore{report: report, err: repositories.ErrAssessmentReportNotFound}
	if report.SourceHash != "" {
		reports.err = nil
	}
	jobs := &fakeAssessmentJobStore{activeErr: repositories.ErrAssessmentJobNotFound, latestErr: repositories.ErrAssessmentJobNotFound}
	service := NewLearnerAssessmentReportService(builder, reports, jobs)
	service.Now = func() time.Time { return now }
	return service, reports, jobs, builder
}

func reportServiceSnapshot(t *testing.T) models.LearnerAssessmentSnapshot {
	t.Helper()
	snapshot := sampleAssessmentSnapshot()
	snapshot.Completeness = "full"
	snapshot.Metadata = assessmentSourceMetadata(DefaultAssessmentContextBudget())
	hash, err := calculateAssessmentSourceHash(&snapshot)
	if err != nil {
		t.Fatal(err)
	}
	snapshot.Metadata.SourceHash = hash
	return snapshot
}

type fakeAssessmentSnapshotBuilder struct {
	snapshot *models.LearnerAssessmentSnapshot
	err      error
}

func (f *fakeAssessmentSnapshotBuilder) Build(context.Context, uint64, uint) (*models.LearnerAssessmentSnapshot, error) {
	return f.snapshot, f.err
}

type fakeAssessmentReportStore struct {
	report models.AssessmentReportRecord
	err    error
}

func (f *fakeAssessmentReportStore) GetLatest(context.Context, uint64, uint) (models.AssessmentReportRecord, error) {
	return f.report, f.err
}

type fakeAssessmentJobStore struct {
	active         models.AssessmentJob
	activeErr      error
	latest         models.AssessmentJob
	latestErr      error
	enqueueErr     error
	enqueueCount   int
	supersedeCount int
	supersededHash string
}

func (f *fakeAssessmentJobStore) Enqueue(_ context.Context, job models.AssessmentJob) (models.AssessmentJob, bool, error) {
	f.enqueueCount++
	if f.enqueueErr != nil {
		return models.AssessmentJob{}, false, f.enqueueErr
	}
	if f.activeErr == nil && f.active.InputHash == job.InputHash {
		return f.active, false, nil
	}
	job.JobID = 100 + uint64(f.enqueueCount)
	job.Status = "queued"
	f.active = job
	f.activeErr = nil
	return job, true, nil
}

func (f *fakeAssessmentJobStore) GetActive(context.Context, uint64, uint) (models.AssessmentJob, error) {
	return f.active, f.activeErr
}

func (f *fakeAssessmentJobStore) GetLatestForOwner(context.Context, uint64, uint) (models.AssessmentJob, error) {
	return f.latest, f.latestErr
}

func (f *fakeAssessmentJobStore) SupersedeActive(_ context.Context, _ uint64, _ uint, hash string) error {
	f.supersedeCount++
	f.supersededHash = hash
	if f.activeErr == nil && f.active.InputHash != hash {
		f.active = models.AssessmentJob{}
		f.activeErr = repositories.ErrAssessmentJobNotFound
	}
	return nil
}
