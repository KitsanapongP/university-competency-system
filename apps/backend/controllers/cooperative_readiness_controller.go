package controllers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/services"
	"github.com/spw32767/university-competency-system-backend/utils"
)

type CooperativeReadinessController struct {
	Service *services.CooperativeReadinessService
}

func (h *CooperativeReadinessController) GetRequirements(w http.ResponseWriter, r *http.Request) {
	curriculumID, ok := cooperativeCurriculumID(w, r)
	if !ok {
		return
	}
	claims, ok := utils.ClaimsFromContext(r.Context())
	if !ok {
		utils.Error(w, http.StatusUnauthorized, "AUTH_MISSING", "missing auth")
		return
	}

	response, err := h.Service.GetRequirements(r.Context(), curriculumID, claims.Roles, claims.FacultyID)
	if err != nil {
		writeCooperativeReadinessError(w, err)
		return
	}
	utils.OK(w, response)
}

func (h *CooperativeReadinessController) SaveDraft(w http.ResponseWriter, r *http.Request) {
	curriculumID, ok := cooperativeCurriculumID(w, r)
	if !ok {
		return
	}
	claims, ok := utils.ClaimsFromContext(r.Context())
	if !ok {
		utils.Error(w, http.StatusUnauthorized, "AUTH_MISSING", "missing auth")
		return
	}

	var payload models.ReplaceCooperativeRequirementsPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json")
		return
	}
	response, err := h.Service.SaveDraft(r.Context(), curriculumID, uint64(max(claims.UserID, 0)), payload, claims.Roles, claims.FacultyID)
	if err != nil {
		writeCooperativeReadinessError(w, err)
		return
	}
	utils.OK(w, response)
}

func (h *CooperativeReadinessController) PublishDraft(w http.ResponseWriter, r *http.Request) {
	curriculumID, ok := cooperativeCurriculumID(w, r)
	if !ok {
		return
	}
	claims, ok := utils.ClaimsFromContext(r.Context())
	if !ok {
		utils.Error(w, http.StatusUnauthorized, "AUTH_MISSING", "missing auth")
		return
	}

	response, err := h.Service.PublishDraft(r.Context(), curriculumID, uint64(max(claims.UserID, 0)), claims.Roles, claims.FacultyID)
	if err != nil {
		writeCooperativeReadinessError(w, err)
		return
	}
	utils.OK(w, response)
}

func (h *CooperativeReadinessController) GetLearnerReadiness(w http.ResponseWriter, r *http.Request) {
	claims, ok := utils.ClaimsFromContext(r.Context())
	if !ok {
		utils.Error(w, http.StatusUnauthorized, "AUTH_MISSING", "missing auth")
		return
	}
	semester, err := strconv.ParseUint(r.URL.Query().Get("semester"), 10, 8)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "semester must be 1 or 2")
		return
	}
	result, err := h.Service.GetReadiness(r.Context(), uint64(max(claims.UserID, 0)), uint(semester))
	if err != nil {
		writeCooperativeReadinessError(w, err)
		return
	}
	utils.OK(w, result)
}

func cooperativeCurriculumID(w http.ResponseWriter, r *http.Request) (uint64, bool) {
	curriculumID, err := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	if err != nil || curriculumID == 0 {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid curriculum id")
		return 0, false
	}
	return curriculumID, true
}

func writeCooperativeReadinessError(w http.ResponseWriter, err error) {
	var validationErr services.CooperativeReadinessValidationError
	switch {
	case errors.As(err, &validationErr):
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", validationErr.Message)
	case errors.Is(err, services.ErrCooperativeRequirementsEmpty):
		utils.Error(w, http.StatusBadRequest, "REQUIREMENTS_EMPTY", err.Error())
	case errors.Is(err, services.ErrCooperativeRequirementsNotFound), errors.Is(err, services.ErrCurriculumNotFound), errors.Is(err, services.ErrLearnerProfileNotFound):
		utils.Error(w, http.StatusNotFound, "NOT_FOUND", "curriculum or cooperative requirements not found")
	case errors.Is(err, services.ErrCurriculumForbidden):
		utils.Error(w, http.StatusForbidden, "FORBIDDEN", "insufficient curriculum scope")
	case errors.Is(err, services.ErrCooperativeRequirementsChanged):
		utils.Error(w, http.StatusConflict, "RELOAD_REQUIRED", "requirements changed; reload and try again")
	default:
		utils.Error(w, http.StatusInternalServerError, "SERVER_ERROR", "cooperative requirements operation failed")
	}
}
