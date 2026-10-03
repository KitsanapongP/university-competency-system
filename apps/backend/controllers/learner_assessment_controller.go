package controllers

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
	"github.com/spw32767/university-competency-system-backend/services"
	"github.com/spw32767/university-competency-system-backend/utils"
)

type learnerAssessmentReportService interface {
	Get(context.Context, uint64, uint) (models.AssessmentReportState, error)
	Generate(context.Context, uint64, uint, bool) (models.AssessmentReportState, error)
}

type learnerAssessmentJobReader interface {
	GetForUser(context.Context, uint64, uint64) (models.AssessmentJob, error)
}

type LearnerAssessmentController struct {
	Service learnerAssessmentReportService
	Jobs    learnerAssessmentJobReader
}

type generateLearnerAssessmentRequest struct {
	Semester uint `json:"semester"`
	Force    bool `json:"force"`
}

func (h *LearnerAssessmentController) GetReport(w http.ResponseWriter, r *http.Request) {
	claims, ok := learnerAssessmentClaims(w, r)
	if !ok {
		return
	}
	semester, ok := learnerAssessmentSemester(w, r.URL.Query().Get("semester"))
	if !ok {
		return
	}
	state, err := h.Service.Get(r.Context(), uint64(claims.UserID), semester)
	if err != nil {
		writeLearnerAssessmentError(w, err)
		return
	}
	stampAssessmentServerTime(&state)
	utils.OK(w, state)
}

func (h *LearnerAssessmentController) GenerateReport(w http.ResponseWriter, r *http.Request) {
	claims, ok := learnerAssessmentClaims(w, r)
	if !ok {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 4096)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	var payload generateLearnerAssessmentRequest
	if err := decoder.Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "request must contain semester 1 or 2 and optional force")
		return
	}
	var extra any
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "request must contain a single JSON object")
		return
	}
	if payload.Semester != 1 && payload.Semester != 2 {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "semester must be 1 or 2")
		return
	}
	state, err := h.Service.Generate(r.Context(), uint64(claims.UserID), payload.Semester, payload.Force)
	if err != nil {
		writeLearnerAssessmentError(w, err)
		return
	}
	stampAssessmentServerTime(&state)
	if state.GenerationState == services.AssessmentReportQueued || state.GenerationState == services.AssessmentReportGenerating {
		utils.JSON(w, http.StatusAccepted, utils.Envelope{"success": true, "data": state})
		return
	}
	utils.OK(w, state)
}

func (h *LearnerAssessmentController) GetJob(w http.ResponseWriter, r *http.Request) {
	claims, ok := learnerAssessmentClaims(w, r)
	if !ok {
		return
	}
	jobID, err := strconv.ParseUint(chi.URLParam(r, "job_id"), 10, 64)
	if err != nil || jobID == 0 {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid job id")
		return
	}
	job, err := h.Jobs.GetForUser(r.Context(), uint64(claims.UserID), jobID)
	if err != nil {
		writeLearnerAssessmentError(w, err)
		return
	}
	now := time.Now().UTC()
	job.ServerTime = &now
	utils.OK(w, job)
}

func stampAssessmentServerTime(state *models.AssessmentReportState) {
	if state == nil || state.Job == nil {
		return
	}
	now := time.Now().UTC()
	state.Job.ServerTime = &now
}

func learnerAssessmentClaims(w http.ResponseWriter, r *http.Request) (*utils.Claims, bool) {
	claims, ok := utils.ClaimsFromContext(r.Context())
	if !ok || claims.UserID <= 0 {
		utils.Error(w, http.StatusUnauthorized, "AUTH_MISSING", "authentication is required")
		return nil, false
	}
	return claims, true
}

func learnerAssessmentSemester(w http.ResponseWriter, value string) (uint, bool) {
	semester, err := strconv.ParseUint(value, 10, 8)
	if err != nil || (semester != 1 && semester != 2) {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "semester must be 1 or 2")
		return 0, false
	}
	return uint(semester), true
}

func writeLearnerAssessmentError(w http.ResponseWriter, err error) {
	var cooldown services.AssessmentReportCooldownError
	var jobCooldown repositories.AssessmentJobCooldownError
	switch {
	case errors.As(err, &cooldown):
		writeLearnerAssessmentCooldown(w, cooldown.RetryAfterSeconds)
	case errors.As(err, &jobCooldown):
		writeLearnerAssessmentCooldown(w, jobCooldown.RetryAfterSeconds)
	case errors.Is(err, repositories.ErrAssessmentJobNotFound),
		errors.Is(err, repositories.ErrAssessmentLearnerNotFound):
		utils.Error(w, http.StatusNotFound, "NOT_FOUND", "assessment report or job not found")
	case errors.Is(err, repositories.ErrAssessmentScopeIncomplete):
		utils.Error(w, http.StatusConflict, "LEARNER_SCOPE_INCOMPLETE", "learner academic profile is incomplete")
	case errors.Is(err, services.ErrAssessmentReportNotReady):
		utils.Error(w, http.StatusServiceUnavailable, "ASSESSMENT_UNAVAILABLE", "assessment report is temporarily unavailable")
	default:
		var validation services.AssessmentSourceValidationError
		if errors.As(err, &validation) {
			utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", validation.Message)
			return
		}
		utils.Error(w, http.StatusInternalServerError, "SERVER_ERROR", "assessment report operation failed")
	}
}

func writeLearnerAssessmentCooldown(w http.ResponseWriter, retryAfter int) {
	if retryAfter < 1 {
		retryAfter = 1
	}
	w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusTooManyRequests)
	_ = json.NewEncoder(w).Encode(utils.Envelope{
		"success": false,
		"error": utils.Envelope{
			"code":                "ASSESSMENT_COOLDOWN",
			"message":             "assessment report regeneration is temporarily unavailable",
			"retry_after_seconds": retryAfter,
		},
	})
}
