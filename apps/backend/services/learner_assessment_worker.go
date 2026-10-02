package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"sync"
	"time"

	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
)

type AssessmentWorkerJobStore interface {
	ClaimNext(context.Context, time.Duration) (models.AssessmentJob, error)
	Heartbeat(context.Context, uint64, string, time.Duration) error
	QueueRetry(context.Context, uint64, string, time.Duration) error
	MarkFailed(context.Context, uint64, string, string, time.Duration) error
	CompleteSuccessfully(context.Context, uint64, string, models.AssessmentReportRecord, *repositories.AssessmentReportRepository) error
}

type AssessmentSnapshotRebuilder interface {
	BuildForEnrollmentCurriculum(context.Context, uint64, uint) (*models.LearnerAssessmentSnapshot, error)
}

type LearnerAssessmentWorker struct {
	Jobs             AssessmentWorkerJobStore
	Reports          *repositories.AssessmentReportRepository
	Provider         AssessmentProvider
	SourceBuilder    AssessmentSnapshotRebuilder
	LeaseDuration    time.Duration
	ContextBudget    AssessmentContextBudget
	GenerationConfig AssessmentGenerationConfig
	Now              func() time.Time
}

func NewLearnerAssessmentWorker(
	jobs AssessmentWorkerJobStore,
	reports *repositories.AssessmentReportRepository,
	provider AssessmentProvider,
	sourceBuilder AssessmentSnapshotRebuilder,
) *LearnerAssessmentWorker {
	return &LearnerAssessmentWorker{
		Jobs:          jobs,
		Reports:       reports,
		Provider:      provider,
		SourceBuilder: sourceBuilder,
		LeaseDuration: 2 * time.Minute,
		ContextBudget: DefaultAssessmentContextBudget(),
		Now:           time.Now,
	}
}

func (w *LearnerAssessmentWorker) ProcessOne(ctx context.Context) (bool, error) {
	if w.Jobs == nil || w.Reports == nil || w.Provider == nil || w.SourceBuilder == nil {
		return false, ErrAssessmentReportNotReady
	}
	leaseDuration := w.LeaseDuration
	if leaseDuration <= 0 {
		leaseDuration = 2 * time.Minute
	}
	job, err := w.Jobs.ClaimNext(ctx, leaseDuration)
	if errors.Is(err, repositories.ErrNoClaimableAssessmentJob) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if err := w.processClaimed(ctx, job, leaseDuration); err != nil {
		return true, err
	}
	return true, nil
}

func (w *LearnerAssessmentWorker) processClaimed(ctx context.Context, job models.AssessmentJob, leaseDuration time.Duration) error {
	var payload models.AssessmentReportSourceSnapshot
	if err := json.Unmarshal(job.InputSnapshot, &payload); err != nil {
		return w.failClaim(ctx, job, "invalid_job_snapshot", assessmentFailureWait)
	}
	snapshot := payload.Source
	if snapshot.Metadata.SourceHash == "" || snapshot.Metadata.SourceHash != job.InputHash ||
		snapshot.Semester != job.Semester || snapshot.TargetYearBE != job.TargetYearBE ||
		(job.EnrollmentCurriculumID != 0 && snapshot.Scope.EnrollmentCurriculumID != 0 && snapshot.Scope.EnrollmentCurriculumID != job.EnrollmentCurriculumID) {
		return w.failClaim(ctx, job, "invalid_job_snapshot", assessmentFailureWait)
	}
	if snapshot.Completeness == "none" {
		return w.failClaim(ctx, job, "insufficient_data", 0)
	}
	if snapshot.Completeness != "full" && snapshot.Completeness != "partial" {
		return w.failClaim(ctx, job, "invalid_job_snapshot", assessmentFailureWait)
	}
	if !assessmentMetadataMatchesRuntime(snapshot.Metadata, normalizeAssessmentContextBudget(w.ContextBudget), w.GenerationConfig) {
		return w.failClaim(ctx, job, "pipeline_version_unsupported", assessmentFailureWait)
	}
	prepared, err := PrepareAssessmentContext(&snapshot, AssessmentContextBudget{
		ContextTokens:       snapshot.Metadata.ContextTokenLimit,
		OutputReserveTokens: snapshot.Metadata.OutputTokenReserve,
		SafetyMarginTokens:  snapshot.Metadata.TokenSafetyMargin,
	})
	if err != nil {
		if errors.Is(err, ErrAssessmentContextExceeded) {
			return w.failClaim(ctx, job, "context_exceeded", 0)
		}
		return w.failClaim(ctx, job, "invalid_job_snapshot", assessmentFailureWait)
	}
	if !reflect.DeepEqual(prepared.Input, payload.ProviderInput) ||
		!reflect.DeepEqual(prepared.Provenance, payload.Provenance) ||
		prepared.EstimatedTokens != payload.EstimatedTokens ||
		!reflect.DeepEqual(prepared.Diagnostics, payload.Diagnostics) {
		return w.failClaim(ctx, job, "invalid_job_snapshot", assessmentFailureWait)
	}
	systemPrompt, userPrompt, err := BuildAssessmentPrompt(payload.ProviderInput)
	if err != nil {
		return w.failClaim(ctx, job, "invalid_job_snapshot", assessmentFailureWait)
	}
	estimatedTokens := EstimateAssessmentPromptTokens(systemPrompt, userPrompt)
	budgetLimit := snapshot.Metadata.ContextTokenLimit - snapshot.Metadata.OutputTokenReserve - snapshot.Metadata.TokenSafetyMargin
	if estimatedTokens != payload.EstimatedTokens {
		return w.failClaim(ctx, job, "invalid_job_snapshot", assessmentFailureWait)
	}
	if estimatedTokens > budgetLimit {
		return w.failClaim(ctx, job, "context_exceeded", 0)
	}
	providerContext, stopHeartbeat, heartbeatErrors := w.withLeaseHeartbeat(ctx, job, leaseDuration)
	providerOutput, providerErr := w.Provider.Generate(providerContext, systemPrompt, userPrompt, AssessmentOutputJSONSchema(payload.ProviderInput))
	stopHeartbeat()
	heartbeatErr := <-heartbeatErrors
	if heartbeatErr != nil {
		return heartbeatErr
	}
	if providerErr != nil {
		return w.handleProviderError(ctx, job, providerErr)
	}
	validated, err := ValidateAssessmentProviderOutput(providerOutput, payload.ProviderInput)
	if err != nil {
		if errors.Is(err, ErrAssessmentOutputMalformed) {
			return w.failClaim(ctx, job, "malformed_output", assessmentFailureWait)
		}
		return w.failClaim(ctx, job, "invalid_output", assessmentFailureWait)
	}
	freshSnapshot, err := w.SourceBuilder.BuildForEnrollmentCurriculum(ctx, job.EnrollmentCurriculumID, job.Semester)
	if err != nil {
		return w.retryClaim(ctx, job, "source_refresh_failed", err)
	}
	if freshSnapshot.Metadata.SourceHash != job.InputHash {
		return w.failClaim(ctx, job, "source_superseded", 0)
	}
	content, err := json.Marshal(validated)
	if err != nil {
		return w.failClaim(ctx, job, "output_serialization_failed", assessmentFailureWait)
	}
	sourceSnapshot, err := json.Marshal(payload)
	if err != nil {
		return w.failClaim(ctx, job, "source_serialization_failed", assessmentFailureWait)
	}
	report := models.AssessmentReportRecord{
		EnrollmentCurriculumID:    job.EnrollmentCurriculumID,
		Semester:                  job.Semester,
		TargetYearBE:              job.TargetYearBE,
		SourceHash:                job.InputHash,
		SourceSnapshot:            sourceSnapshot,
		Content:                   content,
		Completeness:              snapshot.Completeness,
		ProviderName:              snapshot.Metadata.Provider,
		ModelName:                 snapshot.Metadata.Model,
		ModelDigest:               snapshot.Metadata.ModelDigest,
		ProviderConfigFingerprint: snapshot.Metadata.ProviderConfigFingerprint,
		PipelineVersion:           snapshot.Metadata.PipelineVersion,
		PromptVersion:             snapshot.Metadata.PromptVersion,
		SchemaVersion:             snapshot.Metadata.SchemaVersion,
		GeneratedAt:               w.now(),
	}
	return w.Jobs.CompleteSuccessfully(ctx, job.JobID, job.LeaseToken, report, w.Reports)
}

func (w *LearnerAssessmentWorker) handleProviderError(ctx context.Context, job models.AssessmentJob, err error) error {
	var providerErr AssessmentProviderError
	if errors.As(err, &providerErr) {
		if !providerErr.Retryable {
			wait := assessmentFailureWait
			if providerErr.Code == "context_exceeded" {
				wait = 0
			}
			return w.failClaim(ctx, job, providerErr.Code, wait)
		}
		return w.retryClaim(ctx, job, providerErr.Code, err)
	}
	return w.retryClaim(ctx, job, "provider_unavailable", err)
}

func (w *LearnerAssessmentWorker) retryClaim(ctx context.Context, job models.AssessmentJob, errorCode string, _ error) error {
	if job.AttemptCount < job.MaxAttempts {
		attempt := max(job.AttemptCount, 1)
		delay := time.Second << min(attempt-1, 5)
		return w.Jobs.QueueRetry(ctx, job.JobID, job.LeaseToken, delay)
	}
	return w.failClaim(ctx, job, errorCode, assessmentFailureWait)
}

func (w *LearnerAssessmentWorker) failClaim(ctx context.Context, job models.AssessmentJob, errorCode string, failureWait time.Duration) error {
	return w.Jobs.MarkFailed(ctx, job.JobID, job.LeaseToken, errorCode, failureWait)
}

func (w *LearnerAssessmentWorker) withLeaseHeartbeat(
	ctx context.Context,
	job models.AssessmentJob,
	leaseDuration time.Duration,
) (context.Context, func(), <-chan error) {
	providerContext, cancelProvider := context.WithCancel(ctx)
	heartbeatContext, cancelHeartbeat := context.WithCancel(ctx)
	heartbeatErrors := make(chan error, 1)
	interval := leaseDuration / 3
	if interval < time.Second {
		interval = time.Second
	}
	stop := make(chan struct{})
	done := make(chan struct{})
	var stopped bool
	var stopMu sync.Mutex
	stopHeartbeat := func() {
		stopMu.Lock()
		if !stopped {
			stopped = true
			close(stop)
		}
		stopMu.Unlock()
		cancelHeartbeat()
		<-done
		cancelProvider()
	}
	go func() {
		defer close(done)
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				heartbeatErrors <- ctx.Err()
				return
			case <-stop:
				heartbeatErrors <- nil
				return
			case <-ticker.C:
				if err := w.Jobs.Heartbeat(heartbeatContext, job.JobID, job.LeaseToken, leaseDuration); err != nil {
					select {
					case <-stop:
						heartbeatErrors <- nil
						return
					default:
					}
					cancelProvider()
					heartbeatErrors <- err
					return
				}
			}
		}
	}()
	return providerContext, stopHeartbeat, heartbeatErrors
}

func assessmentMetadataMatchesRuntime(metadata models.AssessmentSourceMetadata, budget AssessmentContextBudget, generationConfig AssessmentGenerationConfig) bool {
	expected := assessmentSourceMetadata(budget, generationConfig)
	return metadata.PipelineVersion == expected.PipelineVersion &&
		metadata.Provider == expected.Provider &&
		metadata.Model == expected.Model &&
		metadata.ModelDigest == expected.ModelDigest &&
		metadata.ProviderConfigFingerprint == expected.ProviderConfigFingerprint &&
		metadata.ThinkEnabled == expected.ThinkEnabled &&
		metadata.PromptVersion == expected.PromptVersion &&
		metadata.SchemaVersion == expected.SchemaVersion &&
		metadata.CompactionVersion == expected.CompactionVersion &&
		metadata.ContextTokenLimit == expected.ContextTokenLimit &&
		metadata.OutputTokenReserve == expected.OutputTokenReserve &&
		metadata.TokenSafetyMargin == expected.TokenSafetyMargin
}

func (w *LearnerAssessmentWorker) now() time.Time {
	if w.Now == nil {
		return time.Now().UTC()
	}
	return w.Now().UTC()
}

func (w *LearnerAssessmentWorker) String() string {
	return fmt.Sprintf("learner assessment worker (%s)", assessmentModel)
}
