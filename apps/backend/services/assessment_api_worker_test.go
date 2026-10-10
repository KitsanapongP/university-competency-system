package services

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
	"testing"
	"time"
)

type fakeAPICalls struct {
	err                error
	reserved, finished int
}

func (f *fakeAPICalls) Reserve(context.Context, models.AssessmentJob, string, string, int, time.Duration) (uint64, error) {
	f.reserved++
	return 1, f.err
}
func (f *fakeAPICalls) Finish(context.Context, uint64, *int, *int) error { f.finished++; return nil }

type fakeAPIJobs struct {
	fakeAssessmentWorkerJobs
	draft    *models.AssessmentRejectedDraft
	deferred bool
}

func (f *fakeAPIJobs) DeferAPICall(context.Context, models.AssessmentJob, time.Duration) error {
	f.deferred = true
	return nil
}
func (f *fakeAPIJobs) MarkFailedWithDraft(_ context.Context, _ models.AssessmentJob, code string, _ time.Duration, d models.AssessmentRejectedDraft) error {
	f.draft = &d
	f.failedCode = code
	return nil
}
func (f *fakeAPIJobs) CompleteAPIReport(_ context.Context, _ models.AssessmentJob, r models.AssessmentReportRecord, _ *repositories.AssessmentReportRepository) error {
	f.completed = &r
	f.draft = nil
	return nil
}

func apiWorkerFixture(t *testing.T) (*LearnerAssessmentWorker, *fakeAPIJobs, *fakeAPICalls, *fakeAssessmentProvider) {
	t.Helper()
	source := sampleAssessmentSnapshot()
	b := AssessmentContextBudget{ContextTokens: 50000, OutputReserveTokens: 3072, SafetyMarginTokens: 128}
	g := AssessmentGenerationConfig{Provider: "deepseek", Model: "test"}
	source.Metadata = assessmentSourceMetadata(b, g)
	source.Metadata.SourceHash = mustAssessmentSourceHash(t, source)
	prepared, err := PrepareAssessmentContext(&source, b)
	if err != nil {
		t.Fatal(err)
	}
	payload := models.AssessmentReportSourceSnapshot{Source: source, ProviderInput: prepared.Input, Provenance: prepared.Provenance, EstimatedTokens: prepared.EstimatedTokens, Diagnostics: prepared.Diagnostics}
	jobs := &fakeAPIJobs{fakeAssessmentWorkerJobs: fakeAssessmentWorkerJobs{job: models.AssessmentJob{JobID: 1, EnrollmentCurriculumID: source.Scope.EnrollmentCurriculumID, Semester: source.Semester, TargetYearBE: source.TargetYearBE, InputHash: source.Metadata.SourceHash, InputSnapshot: mustJSON(t, payload), Status: "running", LeaseToken: "lease", AttemptCount: 1, MaxAttempts: 3}}}
	p := &fakeAssessmentProvider{output: []byte(`{"strengths":[],"development":[],"observations":[]}`)}
	calls := &fakeAPICalls{}
	w := NewLearnerAssessmentWorker(jobs, &repositories.AssessmentReportRepository{}, p, &fakeAssessmentSourceRebuilder{snapshot: &source})
	w.ContextBudget = b
	w.GenerationConfig = g
	w.APICalls = calls
	w.APIDailyLimit = 20
	return w, jobs, calls, p
}

func TestAPIWorkerQuotaPreventsCallsAndBusyDoesNotConsumeAttempt(t *testing.T) {
	for _, failure := range []error{repositories.ErrAssessmentAPIBusy, repositories.ErrAssessmentAPIQuota} {
		w, jobs, calls, p := apiWorkerFixture(t)
		calls.err = failure
		if _, err := w.ProcessOne(context.Background()); err != nil {
			t.Fatal(err)
		}
		if p.calls != 0 || calls.finished != 0 {
			t.Fatal("provider invoked without reservation")
		}
		if errors.Is(failure, repositories.ErrAssessmentAPIBusy) && !jobs.deferred {
			t.Fatal("busy must defer")
		}
		if errors.Is(failure, repositories.ErrAssessmentAPIQuota) && jobs.failedCode != "api_quota_exhausted" {
			t.Fatal("quota failure lost")
		}
	}
}

func TestAPIWorkerRejectedDraftDoesNotReplacePassedReport(t *testing.T) {
	w, jobs, calls, p := apiWorkerFixture(t)
	p.output = []byte(`{"strengths":[],"development":[],"observations":[],"extra":"invalid"}`)
	if _, err := w.ProcessOne(context.Background()); err != nil {
		t.Fatal(err)
	}
	if jobs.draft == nil || jobs.draft.Violation.Reason != "unknown_field" || jobs.completed != nil || calls.finished != 1 {
		t.Fatal("invalid output treated as report")
	}
	w, jobs, calls, p = apiWorkerFixture(t)
	jobs.draft = &models.AssessmentRejectedDraft{Preview: "old draft"}
	p.err = AssessmentProviderError{Code: "provider_authentication"}
	p.output = nil
	if _, err := w.ProcessOne(context.Background()); err != nil {
		t.Fatal(err)
	}
	if jobs.draft == nil || jobs.draft.Preview != "old draft" || jobs.failedCode != "provider_authentication" {
		t.Fatal("no-output failure destroyed old draft")
	}
	w, jobs, calls, _ = apiWorkerFixture(t)
	jobs.draft = &models.AssessmentRejectedDraft{Preview: "old draft"}
	if _, err := w.ProcessOne(context.Background()); err != nil {
		t.Fatal(err)
	}
	if jobs.draft != nil || jobs.completed == nil || !json.Valid(jobs.completed.Content) || calls.finished != 1 {
		t.Fatal("passed report not saved or draft not cleared")
	}
}

func TestAPIWorkerHonorsRetryAfter(t *testing.T) {
	w, jobs, _, p := apiWorkerFixture(t)
	p.output = nil
	p.err = AssessmentProviderError{Code: "provider_rate_limited", Retryable: true, RetryAfter: 17 * time.Second}
	if _, err := w.ProcessOne(context.Background()); err != nil {
		t.Fatal(err)
	}
	if jobs.retryDelay != 17*time.Second || jobs.draft != nil {
		t.Fatal("retry-after not respected")
	}
}
