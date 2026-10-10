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
	UpdateProgress(context.Context, uint64, string, string, bool) error
	QueueRetry(context.Context, uint64, string, time.Duration) error
	MarkFailed(context.Context, uint64, string, string, time.Duration) error
	CompleteSuccessfully(context.Context, uint64, string, models.AssessmentReportRecord, *repositories.AssessmentReportRepository) error
}

type AssessmentSnapshotRebuilder interface {
	BuildForEnrollmentCurriculum(context.Context, uint64, uint) (*models.LearnerAssessmentSnapshot, error)
}

type AssessmentAPICallStore interface {
	Reserve(context.Context, models.AssessmentJob, string, string, int, time.Duration) (uint64, error)
	Finish(context.Context, uint64, *int, *int) error
}

type assessmentAPIJobStore interface {
	DeferAPICall(context.Context, models.AssessmentJob, time.Duration) error
	MarkFailedWithDraft(context.Context, models.AssessmentJob, string, time.Duration, models.AssessmentRejectedDraft) error
	CompleteAPIReport(context.Context, models.AssessmentJob, models.AssessmentReportRecord, *repositories.AssessmentReportRepository) error
}

type LearnerAssessmentWorker struct {
	Jobs             AssessmentWorkerJobStore
	Reports          *repositories.AssessmentReportRepository
	Provider         AssessmentProvider
	SourceBuilder    AssessmentSnapshotRebuilder
	LeaseDuration    time.Duration
	AttemptTimeout   time.Duration
	ContextBudget    AssessmentContextBudget
	GenerationConfig AssessmentGenerationConfig
	APICalls         AssessmentAPICallStore
	APIDailyLimit    int
	Now              func() time.Time
}

func NewLearnerAssessmentWorker(
	jobs AssessmentWorkerJobStore,
	reports *repositories.AssessmentReportRepository,
	provider AssessmentProvider,
	sourceBuilder AssessmentSnapshotRebuilder,
) *LearnerAssessmentWorker {
	return &LearnerAssessmentWorker{
		Jobs:           jobs,
		Reports:        reports,
		Provider:       provider,
		SourceBuilder:  sourceBuilder,
		LeaseDuration:  2 * time.Minute,
		AttemptTimeout: 3 * time.Minute,
		ContextBudget:  DefaultAssessmentContextBudget(),
		Now:            time.Now,
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
	attemptTimeout := w.AttemptTimeout
	if attemptTimeout <= 0 {
		attemptTimeout = 3 * time.Minute
	}
	attemptContext, cancelAttempt := context.WithTimeout(ctx, attemptTimeout)
	defer cancelAttempt()
	jobContext, stopHeartbeat, heartbeatErrors := w.withLeaseHeartbeat(attemptContext, job, leaseDuration)
	processErr := w.processClaimed(jobContext, job)
	stopHeartbeat()
	heartbeatErr := <-heartbeatErrors
	if errors.Is(attemptContext.Err(), context.DeadlineExceeded) && ctx.Err() == nil {
		retryContext, cancelRetry := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancelRetry()
		return true, w.retryClaim(retryContext, job, "attempt_timeout", context.DeadlineExceeded)
	}
	if heartbeatErr != nil {
		return true, heartbeatErr
	}
	return true, processErr
}

func (w *LearnerAssessmentWorker) processClaimed(ctx context.Context, job models.AssessmentJob) error {
	ctx = withAssessmentJobLogContext(ctx, job)
	if err := w.Jobs.UpdateProgress(ctx, job.JobID, job.LeaseToken, "preparing", false); err != nil {
		return err
	}
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
	systemPrompt, userPrompt, err := BuildAssessmentPromptForProvider(payload.ProviderInput, snapshot.Metadata.Provider)
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
	if err := w.Jobs.UpdateProgress(ctx, job.JobID, job.LeaseToken, "generating", false); err != nil {
		return err
	}
	var providerOutput []byte
	var providerErr error
	schema := AssessmentOutputJSONSchema(payload.ProviderInput)
	isAPI := snapshot.Metadata.Provider != "ollama"
	if isAPI {
		schema = AssessmentAPIOutputJSONSchema(payload.ProviderInput)
	}
	if isAPI {
		if w.APICalls == nil {
			return w.failClaim(ctx, job, "provider_configuration", assessmentFailureWait)
		}
		providerOutput, providerErr = w.generateAPIOutput(ctx, job, systemPrompt, userPrompt, schema)
		if errors.Is(providerErr, repositories.ErrAssessmentAPIBusy) {
			if store, ok := w.Jobs.(assessmentAPIJobStore); ok {
				return store.DeferAPICall(ctx, job, 5*time.Second)
			}
			return w.failClaim(ctx, job, "provider_busy", assessmentFailureWait)
		}
		if errors.Is(providerErr, repositories.ErrAssessmentAPIQuota) {
			return w.failClaim(ctx, job, "api_quota_exhausted", time.Until(w.now().Truncate(24*time.Hour).Add(24*time.Hour)))
		}
	} else {
		if streamingProvider, ok := w.Provider.(StreamingAssessmentProvider); ok {
			providerOutput, providerErr = streamingProvider.GenerateWithProgress(
				ctx,
				systemPrompt,
				userPrompt,
				schema,
				func() error {
					return w.Jobs.UpdateProgress(ctx, job.JobID, job.LeaseToken, "generating", true)
				},
			)
		} else {
			providerOutput, providerErr = w.Provider.Generate(ctx, systemPrompt, userPrompt, schema)
		}
	}
	if providerErr != nil {
		var failure AssessmentProviderError
		if isAPI && len(providerOutput) > 0 && errors.As(providerErr, &failure) && !failure.Retryable {
			return w.failAPIOutput(ctx, job, "invalid_output", providerOutput, assessmentValidationFailure(assessmentReasonInvalidJSONStructure, "output", ""))
		}
		return w.handleProviderError(ctx, job, providerErr)
	}
	if err := w.Jobs.UpdateProgress(ctx, job.JobID, job.LeaseToken, "validating", false); err != nil {
		return err
	}
	validationOutput := providerOutput
	if isAPI {
		validationOutput, err = NormalizeAssessmentAPIOutput(providerOutput)
	}
	var validated models.AssessmentProseReport
	if err == nil {
		validated, err = ValidateAssessmentProviderOutput(validationOutput, payload.ProviderInput)
	}
	if err != nil {
		logAssessmentOutputRejection(ctx, err, len(providerOutput))
		if isAPI {
			return w.failAPIOutput(ctx, job, "invalid_output", providerOutput, err)
		}
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
	if err := w.Jobs.UpdateProgress(ctx, job.JobID, job.LeaseToken, "saving", false); err != nil {
		return err
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
	if isAPI {
		if store, ok := w.Jobs.(assessmentAPIJobStore); ok {
			return store.CompleteAPIReport(ctx, job, report, w.Reports)
		}
		return w.failClaim(ctx, job, "provider_configuration", assessmentFailureWait)
	}
	return w.Jobs.CompleteSuccessfully(ctx, job.JobID, job.LeaseToken, report, w.Reports)
}

func (w *LearnerAssessmentWorker) generateAPIOutput(ctx context.Context, job models.AssessmentJob, system, user string, schema json.RawMessage) ([]byte, error) {
	id, err := w.APICalls.Reserve(ctx, job, w.GenerationConfig.Provider, w.GenerationConfig.Model, w.APIDailyLimit, w.AttemptTimeout+60*time.Second)
	if err != nil {
		return nil, err
	}
	usage := AssessmentAPIUsage{}
	callContext := withAssessmentAPIUsage(ctx, &usage)
	var output []byte
	if p, ok := w.Provider.(StreamingAssessmentProvider); ok {
		output, err = p.GenerateWithProgress(callContext, system, user, schema, func() error { return w.Jobs.UpdateProgress(ctx, job.JobID, job.LeaseToken, "generating", true) })
	} else {
		output, err = w.Provider.Generate(callContext, system, user, schema)
	}
	finishContext, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if finishErr := w.APICalls.Finish(finishContext, id, usage.InputTokens, usage.OutputTokens); finishErr != nil {
		return nil, AssessmentProviderError{Code: "provider_accounting_failed"}
	}
	return output, err
}

func (w *LearnerAssessmentWorker) failAPIOutput(ctx context.Context, job models.AssessmentJob, code string, raw []byte, validationErr error) error {
	if store, ok := w.Jobs.(assessmentAPIJobStore); ok {
		return store.MarkFailedWithDraft(ctx, job, code, assessmentFailureWait, BuildAssessmentRejectedDraft(raw, validationErr, job))
	}
	return w.failClaim(ctx, job, "provider_configuration", assessmentFailureWait)
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
		if providerErr.RetryAfter > 0 && job.AttemptCount < job.MaxAttempts {
			return w.Jobs.QueueRetry(ctx, job.JobID, job.LeaseToken, providerErr.RetryAfter)
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
	interval := min(leaseDuration/3, 10*time.Second)
	if interval <= 0 {
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
