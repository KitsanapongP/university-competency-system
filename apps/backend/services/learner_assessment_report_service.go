package services

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"time"

	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
)

const (
	AssessmentReportCurrent          = "current"
	AssessmentReportMissing          = "missing"
	AssessmentReportQueued           = "queued"
	AssessmentReportGenerating       = "generating"
	AssessmentReportFailed           = "failed"
	AssessmentReportInsufficientData = "insufficient_data"
	AssessmentReportContextExceeded  = "context_exceeded"
)

const (
	assessmentForceCooldown  = 5 * time.Minute
	assessmentFailureWait    = 60 * time.Second
	assessmentMaxJobAttempts = 3
)

var (
	ErrAssessmentReportCooldown = errors.New("assessment report regeneration is in cooldown")
	ErrAssessmentReportNotReady = errors.New("assessment report source is unavailable")
)

type AssessmentReportCooldownError struct {
	RetryAfterSeconds int
}

func (e AssessmentReportCooldownError) Error() string {
	return ErrAssessmentReportCooldown.Error()
}

func (e AssessmentReportCooldownError) Unwrap() error {
	return ErrAssessmentReportCooldown
}

type AssessmentSnapshotBuilder interface {
	Build(context.Context, uint64, uint) (*models.LearnerAssessmentSnapshot, error)
}

type AssessmentReportStore interface {
	GetLatest(context.Context, uint64, uint) (models.AssessmentReportRecord, error)
}

type AssessmentJobStore interface {
	Enqueue(context.Context, models.AssessmentJob) (models.AssessmentJob, bool, error)
	GetActive(context.Context, uint64, uint) (models.AssessmentJob, error)
	GetLatestForOwner(context.Context, uint64, uint) (models.AssessmentJob, error)
	SupersedeActive(context.Context, uint64, uint, string) error
}

type AssessmentDraftStore interface {
	GetLatestDraft(context.Context, uint64, uint) (*models.AssessmentRejectedDraft, error)
}

type LearnerAssessmentReportService struct {
	Builder           AssessmentSnapshotBuilder
	Reports           AssessmentReportStore
	Jobs              AssessmentJobStore
	GenerationEnabled bool
	Drafts            AssessmentDraftStore
	Now               func() time.Time
}

func NewLearnerAssessmentReportService(
	builder AssessmentSnapshotBuilder,
	reports AssessmentReportStore,
	jobs AssessmentJobStore,
) *LearnerAssessmentReportService {
	return &LearnerAssessmentReportService{
		Builder: builder, Reports: reports, Jobs: jobs, GenerationEnabled: true, Now: time.Now,
	}
}

func (s *LearnerAssessmentReportService) Get(ctx context.Context, userID uint64, semester uint) (state models.AssessmentReportState, resultErr error) {
	snapshot, err := s.buildSnapshot(ctx, userID, semester)
	if err != nil {
		return models.AssessmentReportState{}, err
	}
	state = assessmentReportStateFromSnapshot(snapshot)
	defer func() {
		if resultErr != nil || s.Drafts == nil {
			return
		}
		draft, draftErr := s.Drafts.GetLatestDraft(ctx, snapshot.Scope.EnrollmentCurriculumID, semester)
		if draftErr != nil {
			resultErr = draftErr
			return
		}
		if draft == nil {
			return
		}
		draft.IsStale = draft.SourceHash != snapshot.Metadata.SourceHash
		draft.PreviousAttempt = state.Job != nil && draft.JobID != state.Job.JobID
		if draft.IsStale {
			draft.Preview = ""
		}
		state.RejectedDraft = draft
	}()
	if snapshot.Completeness == "none" {
		state.GenerationState = AssessmentReportInsufficientData
		return state, nil
	}
	report, reportErr := s.Reports.GetLatest(ctx, snapshot.Scope.EnrollmentCurriculumID, semester)
	if reportErr != nil && !errors.Is(reportErr, repositories.ErrAssessmentReportNotFound) {
		return models.AssessmentReportState{}, reportErr
	}
	reportCurrent := reportErr == nil && report.SourceHash == snapshot.Metadata.SourceHash
	if reportErr == nil && !reportCurrent {
		state.IsStale = true
	}
	job, jobErr := s.Jobs.GetActive(ctx, snapshot.Scope.EnrollmentCurriculumID, semester)
	if jobErr != nil && !errors.Is(jobErr, repositories.ErrAssessmentJobNotFound) {
		return models.AssessmentReportState{}, jobErr
	}
	if reportCurrent {
		state.GenerationState = AssessmentReportCurrent
		state.Report = &report
		if jobErr == nil && job.InputHash == snapshot.Metadata.SourceHash {
			state.Job = &job
		} else if jobErr != nil {
			latestJob, latestErr := s.Jobs.GetLatestForOwner(ctx, snapshot.Scope.EnrollmentCurriculumID, semester)
			if latestErr != nil && !errors.Is(latestErr, repositories.ErrAssessmentJobNotFound) {
				return models.AssessmentReportState{}, latestErr
			}
			if latestErr == nil && latestJob.Status == "failed" &&
				latestJob.InputHash == snapshot.Metadata.SourceHash && latestJob.RequestedAt.After(report.GeneratedAt) {
				state.Job = &latestJob
				state.RetryAfterSeconds = assessmentRetryAfter(latestJob.FailureWaitUntil, s.now())
			}
		}
		return state, nil
	}
	if jobErr == nil && job.InputHash == snapshot.Metadata.SourceHash {
		state.Job = &job
		state.GenerationState = assessmentGenerationState(job.Status)
		return state, nil
	}
	if jobErr == nil {
		state.IsStale = true
	}
	latestJob, latestErr := s.Jobs.GetLatestForOwner(ctx, snapshot.Scope.EnrollmentCurriculumID, semester)
	if latestErr != nil && !errors.Is(latestErr, repositories.ErrAssessmentJobNotFound) {
		return models.AssessmentReportState{}, latestErr
	}
	if latestErr == nil && latestJob.InputHash == snapshot.Metadata.SourceHash && latestJob.Status == "failed" {
		state.GenerationState = AssessmentReportFailed
		if latestJob.ErrorCode == "context_exceeded" {
			state.GenerationState = AssessmentReportContextExceeded
			_, contextErr := s.prepareContext(snapshot)
			setAssessmentContextDiagnostics(&state, contextErr)
		}
		state.Job = &latestJob
		state.RetryAfterSeconds = assessmentRetryAfter(latestJob.FailureWaitUntil, s.now())
		return state, nil
	}
	if _, err := s.prepareContext(snapshot); err != nil {
		if errors.Is(err, ErrAssessmentContextExceeded) {
			state.GenerationState = AssessmentReportContextExceeded
			setAssessmentContextDiagnostics(&state, err)
			return state, nil
		}
		return models.AssessmentReportState{}, err
	}
	state.GenerationState = AssessmentReportMissing
	return state, nil
}

func (s *LearnerAssessmentReportService) Generate(
	ctx context.Context,
	userID uint64,
	semester uint,
	force bool,
) (models.AssessmentReportState, error) {
	snapshot, err := s.buildSnapshot(ctx, userID, semester)
	if err != nil {
		return models.AssessmentReportState{}, err
	}
	state := assessmentReportStateFromSnapshot(snapshot)
	if snapshot.Completeness == "none" {
		state.GenerationState = AssessmentReportInsufficientData
		return state, nil
	}
	if !s.GenerationEnabled {
		return state, ErrAssessmentReportNotReady
	}

	report, reportErr := s.Reports.GetLatest(ctx, snapshot.Scope.EnrollmentCurriculumID, semester)
	if reportErr != nil && !errors.Is(reportErr, repositories.ErrAssessmentReportNotFound) {
		return models.AssessmentReportState{}, reportErr
	}
	reportCurrent := reportErr == nil && report.SourceHash == snapshot.Metadata.SourceHash
	if reportCurrent {
		state.GenerationState = AssessmentReportCurrent
		state.Report = &report
	}
	if reportCurrent && !force {
		return state, nil
	}
	active, activeErr := s.Jobs.GetActive(ctx, snapshot.Scope.EnrollmentCurriculumID, semester)
	if activeErr != nil && !errors.Is(activeErr, repositories.ErrAssessmentJobNotFound) {
		return models.AssessmentReportState{}, activeErr
	}
	if activeErr == nil && active.InputHash == snapshot.Metadata.SourceHash {
		state.GenerationState = assessmentGenerationState(active.Status)
		state.Job = &active
		if reportCurrent {
			state.Report = &report
		}
		return state, nil
	}
	if reportCurrent && force && s.now().Sub(report.GeneratedAt) < assessmentForceCooldown {
		state.RetryAfterSeconds = assessmentRetryAfterValue(report.GeneratedAt.Add(assessmentForceCooldown), s.now())
		return state, AssessmentReportCooldownError{RetryAfterSeconds: state.RetryAfterSeconds}
	}
	prepared, err := s.prepareContext(snapshot)
	if err != nil {
		if errors.Is(err, ErrAssessmentContextExceeded) {
			state.GenerationState = AssessmentReportContextExceeded
			setAssessmentContextDiagnostics(&state, err)
			return state, nil
		}
		return models.AssessmentReportState{}, err
	}
	if err := s.Jobs.SupersedeActive(ctx, snapshot.Scope.EnrollmentCurriculumID, semester, snapshot.Metadata.SourceHash); err != nil {
		return models.AssessmentReportState{}, err
	}
	jobSnapshot, err := json.Marshal(models.AssessmentReportSourceSnapshot{
		Source:          *snapshot,
		ProviderInput:   prepared.Input,
		Provenance:      prepared.Provenance,
		EstimatedTokens: prepared.EstimatedTokens,
		Diagnostics:     prepared.Diagnostics,
	})
	if err != nil {
		return models.AssessmentReportState{}, err
	}
	job, _, err := s.Jobs.Enqueue(ctx, models.AssessmentJob{
		EnrollmentCurriculumID: snapshot.Scope.EnrollmentCurriculumID,
		Semester:               semester,
		TargetYearBE:           snapshot.TargetYearBE,
		InputHash:              snapshot.Metadata.SourceHash,
		InputSnapshot:          jobSnapshot,
		Status:                 "queued",
		MaxAttempts:            assessmentMaxJobAttempts,
	})
	if err != nil {
		var cooldown repositories.AssessmentJobCooldownError
		if errors.As(err, &cooldown) {
			state.RetryAfterSeconds = cooldown.RetryAfterSeconds
			return state, err
		}
		return models.AssessmentReportState{}, err
	}
	state.GenerationState = assessmentGenerationState(job.Status)
	state.Job = &job
	if reportCurrent {
		state.Report = &report
	}
	return state, nil
}

func (s *LearnerAssessmentReportService) buildSnapshot(ctx context.Context, userID uint64, semester uint) (*models.LearnerAssessmentSnapshot, error) {
	if s.Builder == nil || s.Reports == nil || s.Jobs == nil {
		return nil, ErrAssessmentReportNotReady
	}
	return s.Builder.Build(ctx, userID, semester)
}

func (s *LearnerAssessmentReportService) prepareContext(snapshot *models.LearnerAssessmentSnapshot) (PreparedAssessmentContext, error) {
	return PrepareAssessmentContext(snapshot, AssessmentContextBudget{
		ContextTokens:       snapshot.Metadata.ContextTokenLimit,
		OutputReserveTokens: snapshot.Metadata.OutputTokenReserve,
		SafetyMarginTokens:  snapshot.Metadata.TokenSafetyMargin,
	})
}

func assessmentReportStateFromSnapshot(snapshot *models.LearnerAssessmentSnapshot) models.AssessmentReportState {
	return models.AssessmentReportState{
		GenerationState: AssessmentReportMissing,
		Completeness:    snapshot.Completeness,
		Semester:        snapshot.Semester,
		TargetYearBE:    snapshot.TargetYearBE,
		Readiness:       snapshot.Readiness,
		Availability:    append([]models.AssessmentSourceAvailability(nil), snapshot.Availability...),
	}
}

func setAssessmentContextDiagnostics(state *models.AssessmentReportState, err error) {
	var exceeded AssessmentContextExceededError
	if errors.As(err, &exceeded) {
		state.ContextDiagnostics = &exceeded.Diagnostics
	}
}

func assessmentGenerationState(status string) string {
	if status == "running" {
		return AssessmentReportGenerating
	}
	return AssessmentReportQueued
}

func assessmentRetryAfter(until *time.Time, now time.Time) int {
	if until == nil || !until.After(now) {
		return 0
	}
	return assessmentRetryAfterValue(*until, now)
}

func assessmentRetryAfterValue(until, now time.Time) int {
	if !until.After(now) {
		return 0
	}
	return int(math.Ceil(until.Sub(now).Seconds()))
}

func (s *LearnerAssessmentReportService) now() time.Time {
	if s.Now == nil {
		return time.Now().UTC()
	}
	return s.Now().UTC()
}
