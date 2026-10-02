package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
)

func TestLearnerAssessmentWorkerPersistsValidatedOutputAndSourceTrace(t *testing.T) {
	payload, job := workerTestJob(t, DefaultAssessmentContextBudget())
	provider := &fakeAssessmentProvider{output: mustJSON(t, workerTestOutput(payload.ProviderInput))}
	sourceBuilder := &fakeAssessmentSourceRebuilder{snapshot: &payload.Source}
	jobs := &fakeAssessmentWorkerJobs{job: job}
	worker := workerTestInstance(jobs, provider, sourceBuilder)

	processed, err := worker.ProcessOne(context.Background())
	if err != nil || !processed {
		t.Fatalf("worker processed=%v err=%v", processed, err)
	}
	if provider.calls != 1 || jobs.completed == nil || jobs.failedCode != "" {
		t.Fatalf("provider calls=%d completed=%+v failed=%q", provider.calls, jobs.completed, jobs.failedCode)
	}
	if jobs.completed.SourceHash != job.InputHash || !json.Valid(jobs.completed.SourceSnapshot) || !json.Valid(jobs.completed.Content) {
		t.Fatalf("persisted report is missing source data or validated content: %+v", jobs.completed)
	}
	var stored models.AssessmentReportSourceSnapshot
	if err := json.Unmarshal(jobs.completed.SourceSnapshot, &stored); err != nil {
		t.Fatal(err)
	}
	if len(stored.Provenance) == 0 {
		t.Fatal("persisted report source snapshot must retain evidence provenance")
	}
}

func TestLearnerAssessmentWorkerRejectsInvalidOutputAndDoesNotPersist(t *testing.T) {
	payload, job := workerTestJob(t, DefaultAssessmentContextBudget())
	output := workerTestOutput(payload.ProviderInput)
	output.Observations[0].ObservationID = "foreign:evidence:1"
	provider := &fakeAssessmentProvider{output: mustJSON(t, output)}
	jobs := &fakeAssessmentWorkerJobs{job: job}
	worker := workerTestInstance(jobs, provider, &fakeAssessmentSourceRebuilder{snapshot: &payload.Source})

	processed, err := worker.ProcessOne(context.Background())
	if err != nil || !processed || provider.calls != 1 {
		t.Fatalf("worker processed=%v calls=%d err=%v", processed, provider.calls, err)
	}
	if jobs.failedCode != "invalid_output" || jobs.completed != nil {
		t.Fatalf("invalid model result state failed=%q report=%+v", jobs.failedCode, jobs.completed)
	}
}

func TestLearnerAssessmentWorkerDoesNotProcessLegacyPipelineJobs(t *testing.T) {
	payload, job := workerTestJob(t, DefaultAssessmentContextBudget())
	payload.Source.Metadata.PipelineVersion = "learner-assessment-v1"
	job.InputSnapshot = mustJSON(t, payload)
	provider := &fakeAssessmentProvider{output: mustJSON(t, workerTestOutput(payload.ProviderInput))}
	jobs := &fakeAssessmentWorkerJobs{job: job}
	worker := workerTestInstance(jobs, provider, &fakeAssessmentSourceRebuilder{snapshot: &payload.Source})

	processed, err := worker.ProcessOne(context.Background())
	if err != nil || !processed {
		t.Fatalf("worker processed=%v err=%v", processed, err)
	}
	if jobs.failedCode != "pipeline_version_unsupported" || provider.calls != 0 || jobs.completed != nil {
		t.Fatalf("legacy job failed=%q provider calls=%d report=%+v", jobs.failedCode, provider.calls, jobs.completed)
	}
}

func TestLearnerAssessmentWorkerNeverCallsProviderForContextExceeded(t *testing.T) {
	budget := AssessmentContextBudget{ContextTokens: 1024, OutputReserveTokens: 256, SafetyMarginTokens: 64}
	payload, job := workerTestJob(t, DefaultAssessmentContextBudget())
	payload.Source.Metadata = assessmentSourceMetadata(budget)
	for index := 0; index < 20; index++ {
		payload.Source.AcademicEvidence = append(payload.Source.AcademicEvidence, models.AssessmentAcademicEvidence{
			EvidenceRef:  fmt.Sprintf("course:large:%d", index),
			CourseCode:   strings.Repeat("C", index+1),
			CourseNameTH: strings.Repeat("รายวิชาที่มีรายละเอียดจำนวนมาก", 80),
			Grade:        "B",
		})
	}
	payload.Source.Metadata.SourceHash, _ = calculateAssessmentSourceHash(&payload.Source)
	prepared, prepErr := PrepareAssessmentContext(&payload.Source, budget)
	if !errors.Is(prepErr, ErrAssessmentContextExceeded) {
		t.Fatalf("test fixture should exceed context, got %v", prepErr)
	}
	payload.ProviderInput = prepared.Input
	payload.Provenance = prepared.Provenance
	payload.EstimatedTokens = prepared.EstimatedTokens
	payload.Diagnostics = prepared.Diagnostics
	job.InputHash = payload.Source.Metadata.SourceHash
	job.InputSnapshot = mustJSON(t, payload)
	provider := &fakeAssessmentProvider{}
	jobs := &fakeAssessmentWorkerJobs{job: job}
	worker := workerTestInstance(jobs, provider, &fakeAssessmentSourceRebuilder{snapshot: &payload.Source})
	worker.ContextBudget = budget

	processed, err := worker.ProcessOne(context.Background())
	if err != nil || !processed || provider.calls != 0 || jobs.failedCode != "context_exceeded" || jobs.completed != nil {
		t.Fatalf("overflow processing=%v calls=%d failure=%q report=%+v err=%v", processed, provider.calls, jobs.failedCode, jobs.completed, err)
	}
}

func TestLearnerAssessmentWorkerRejectsSupersededSources(t *testing.T) {
	payload, job := workerTestJob(t, DefaultAssessmentContextBudget())
	provider := &fakeAssessmentProvider{output: mustJSON(t, workerTestOutput(payload.ProviderInput))}
	changed := payload.Source
	changed.Metadata.SourceHash = strings.Repeat("f", 64)
	jobs := &fakeAssessmentWorkerJobs{job: job}
	worker := workerTestInstance(jobs, provider, &fakeAssessmentSourceRebuilder{snapshot: &changed})

	processed, err := worker.ProcessOne(context.Background())
	if err != nil || !processed || provider.calls != 1 || jobs.failedCode != "source_superseded" || jobs.completed != nil {
		t.Fatalf("superseded processing=%v calls=%d failure=%q report=%+v err=%v", processed, provider.calls, jobs.failedCode, jobs.completed, err)
	}
}

func TestLearnerAssessmentWorkerRetriesOnlyRetryableProviderFailures(t *testing.T) {
	payload, job := workerTestJob(t, DefaultAssessmentContextBudget())
	provider := &fakeAssessmentProvider{err: AssessmentProviderError{Code: "ollama_unavailable", Retryable: true}}
	jobs := &fakeAssessmentWorkerJobs{job: job}
	worker := workerTestInstance(jobs, provider, &fakeAssessmentSourceRebuilder{snapshot: &payload.Source})
	if _, err := worker.ProcessOne(context.Background()); err != nil {
		t.Fatal(err)
	}
	if jobs.retryDelay != time.Second || jobs.failedCode != "" || jobs.completed != nil {
		t.Fatalf("retryable failure outcome delay=%s failed=%q report=%+v", jobs.retryDelay, jobs.failedCode, jobs.completed)
	}
}

func workerTestJob(t *testing.T, budget AssessmentContextBudget) (models.AssessmentReportSourceSnapshot, models.AssessmentJob) {
	t.Helper()
	source := sampleAssessmentSnapshot()
	source.Completeness = "full"
	source.Metadata = assessmentSourceMetadata(budget)
	hash, err := calculateAssessmentSourceHash(&source)
	if err != nil {
		t.Fatal(err)
	}
	source.Metadata.SourceHash = hash
	prepared, err := PrepareAssessmentContext(&source, budget)
	if err != nil {
		t.Fatal(err)
	}
	payload := models.AssessmentReportSourceSnapshot{
		Source:          source,
		ProviderInput:   prepared.Input,
		Provenance:      prepared.Provenance,
		EstimatedTokens: prepared.EstimatedTokens,
		Diagnostics:     prepared.Diagnostics,
	}
	job := models.AssessmentJob{
		JobID:                  501,
		EnrollmentCurriculumID: source.Scope.EnrollmentCurriculumID,
		Semester:               source.Semester,
		TargetYearBE:           source.TargetYearBE,
		InputHash:              hash,
		InputSnapshot:          mustJSON(t, payload),
		Status:                 "running",
		AttemptCount:           1,
		MaxAttempts:            3,
		LeaseToken:             "lease-token-current",
	}
	return payload, job
}

func workerTestOutput(input models.AssessmentProviderInput) models.AssessmentNarrativeOutput {
	return models.AssessmentNarrativeOutput{
		Strengths:   []models.AssessmentNarrativeFinding{},
		Limitations: []models.AssessmentNarrativeFinding{},
		Observations: []models.AssessmentNarrativeFinding{{
			ObservationID: "academic:" + input.AcademicEvidence[0].EvidenceRef,
			Explanation:   models.AssessmentBilingualText{TH: "มีหลักฐานรายวิชา", EN: "Supported by course evidence"},
		}},
	}
}

func workerTestInstance(
	jobs *fakeAssessmentWorkerJobs,
	provider *fakeAssessmentProvider,
	sourceBuilder *fakeAssessmentSourceRebuilder,
) *LearnerAssessmentWorker {
	return &LearnerAssessmentWorker{
		Jobs:          jobs,
		Reports:       &repositories.AssessmentReportRepository{},
		Provider:      provider,
		SourceBuilder: sourceBuilder,
		LeaseDuration: time.Minute,
		Now:           func() time.Time { return time.Date(2026, 10, 1, 12, 0, 0, 0, time.UTC) },
	}
}

func mustJSON(t *testing.T, value any) json.RawMessage {
	t.Helper()
	encoded, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	return encoded
}

type fakeAssessmentProvider struct {
	output []byte
	err    error
	calls  int
}

func (f *fakeAssessmentProvider) Generate(ctx context.Context, _, _ string, _ json.RawMessage) ([]byte, error) {
	f.calls++
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	return f.output, f.err
}

type fakeAssessmentSourceRebuilder struct {
	snapshot *models.LearnerAssessmentSnapshot
	err      error
}

func (f *fakeAssessmentSourceRebuilder) BuildForEnrollmentCurriculum(context.Context, uint64, uint) (*models.LearnerAssessmentSnapshot, error) {
	return f.snapshot, f.err
}

type fakeAssessmentWorkerJobs struct {
	job          models.AssessmentJob
	claimErr     error
	heartbeatErr error
	failedCode   string
	failureWait  time.Duration
	retryDelay   time.Duration
	completed    *models.AssessmentReportRecord
}

func (f *fakeAssessmentWorkerJobs) ClaimNext(context.Context, time.Duration) (models.AssessmentJob, error) {
	if f.claimErr != nil {
		return models.AssessmentJob{}, f.claimErr
	}
	return f.job, nil
}

func (f *fakeAssessmentWorkerJobs) Heartbeat(context.Context, uint64, string, time.Duration) error {
	return f.heartbeatErr
}

func (f *fakeAssessmentWorkerJobs) QueueRetry(_ context.Context, _ uint64, _ string, delay time.Duration) error {
	f.retryDelay = delay
	return nil
}

func (f *fakeAssessmentWorkerJobs) MarkFailed(_ context.Context, _ uint64, _ string, errorCode string, wait time.Duration) error {
	f.failedCode = errorCode
	f.failureWait = wait
	return nil
}

func (f *fakeAssessmentWorkerJobs) CompleteSuccessfully(_ context.Context, _ uint64, _ string, report models.AssessmentReportRecord, _ *repositories.AssessmentReportRepository) error {
	f.completed = &report
	return nil
}
