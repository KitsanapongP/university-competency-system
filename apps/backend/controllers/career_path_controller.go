package controllers

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
	"github.com/spw32767/university-competency-system-backend/services"
	"github.com/spw32767/university-competency-system-backend/utils"
)

type CareerPathController struct {
	Service       *services.CareerPathService
	ImportService *services.CareerPathImportService
}

type careerPathIDsPayload struct {
	CareerPathIDs []uint64 `json:"career_path_ids"`
}

func (h *CareerPathController) List(w http.ResponseWriter, r *http.Request) {
	claims, ok := careerPathClaims(w, r)
	if !ok {
		return
	}
	filters, err := parseCareerPathFilters(r)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid career path filters")
		return
	}
	result, err := h.Service.List(r.Context(), claims.Roles, claims.FacultyID, filters)
	if err != nil {
		writeCareerPathError(w, err)
		return
	}
	utils.OK(w, result)
}

func (h *CareerPathController) CreateDraft(w http.ResponseWriter, r *http.Request) {
	claims, ok := careerPathClaims(w, r)
	if !ok {
		return
	}
	var payload models.CareerPathDraftPayload
	if !decodeCareerPathJSON(w, r, &payload) {
		return
	}
	path, err := h.Service.CreateDraft(r.Context(), payload, uint64(max(claims.UserID, 0)), claims.Roles, claims.FacultyID)
	if err != nil {
		writeCareerPathError(w, err)
		return
	}
	utils.JSON(w, http.StatusCreated, utils.Envelope{"success": true, "data": path})
}

func (h *CareerPathController) Get(w http.ResponseWriter, r *http.Request) {
	careerPathID, ok := careerPathIDParam(w, r)
	if !ok {
		return
	}
	claims, ok := careerPathClaims(w, r)
	if !ok {
		return
	}
	path, err := h.Service.Get(r.Context(), careerPathID, claims.Roles, claims.FacultyID)
	if err != nil {
		writeCareerPathError(w, err)
		return
	}
	utils.OK(w, path)
}

func (h *CareerPathController) UpdateDraft(w http.ResponseWriter, r *http.Request) {
	careerPathID, ok := careerPathIDParam(w, r)
	if !ok {
		return
	}
	claims, ok := careerPathClaims(w, r)
	if !ok {
		return
	}
	var payload models.CareerPathDraftUpdate
	if !decodeCareerPathJSON(w, r, &payload) {
		return
	}
	path, err := h.Service.UpdateDraft(r.Context(), careerPathID, payload, uint64(max(claims.UserID, 0)), claims.Roles, claims.FacultyID)
	if err != nil {
		writeCareerPathError(w, err)
		return
	}
	utils.OK(w, path)
}

func (h *CareerPathController) Publish(w http.ResponseWriter, r *http.Request) {
	claims, ok := careerPathClaims(w, r)
	if !ok {
		return
	}
	var payload careerPathIDsPayload
	if !decodeCareerPathJSON(w, r, &payload) {
		return
	}
	if err := h.Service.Publish(r.Context(), payload.CareerPathIDs, uint64(max(claims.UserID, 0)), claims.Roles, claims.FacultyID); err != nil {
		writeCareerPathError(w, err)
		return
	}
	utils.OK(w, map[string]bool{"published": true})
}

func (h *CareerPathController) Deactivate(w http.ResponseWriter, r *http.Request) {
	claims, ok := careerPathClaims(w, r)
	if !ok {
		return
	}
	var payload careerPathIDsPayload
	if !decodeCareerPathJSON(w, r, &payload) {
		return
	}
	if err := h.Service.Deactivate(r.Context(), payload.CareerPathIDs, claims.Roles, claims.FacultyID); err != nil {
		writeCareerPathError(w, err)
		return
	}
	utils.OK(w, map[string]bool{"deactivated": true})
}

func (h *CareerPathController) Delete(w http.ResponseWriter, r *http.Request) {
	careerPathID, ok := careerPathIDParam(w, r)
	if !ok {
		return
	}
	claims, ok := careerPathClaims(w, r)
	if !ok {
		return
	}
	if err := h.Service.Delete(r.Context(), careerPathID, claims.Roles, claims.FacultyID); err != nil {
		writeCareerPathError(w, err)
		return
	}
	utils.OK(w, map[string]bool{"deleted": true})
}

func (h *CareerPathController) PreviewImport(w http.ResponseWriter, r *http.Request) {
	claims, ok := careerPathClaims(w, r)
	if !ok {
		return
	}
	var payload models.CareerPathImportPayload
	if !decodeCareerPathJSON(w, r, &payload) {
		return
	}
	preview, err := h.ImportService.Preview(r.Context(), payload, claims.Roles, claims.FacultyID)
	if err != nil {
		writeCareerPathError(w, err)
		return
	}
	utils.OK(w, preview)
}

func (h *CareerPathController) CommitImport(w http.ResponseWriter, r *http.Request) {
	claims, ok := careerPathClaims(w, r)
	if !ok {
		return
	}
	var payload models.CareerPathImportPayload
	if !decodeCareerPathJSON(w, r, &payload) {
		return
	}
	if err := h.ImportService.Commit(r.Context(), payload, uint64(max(claims.UserID, 0)), claims.Roles, claims.FacultyID); err != nil {
		writeCareerPathError(w, err)
		return
	}
	utils.OK(w, map[string]bool{"imported": true})
}

func parseCareerPathFilters(r *http.Request) (models.CareerPathFilters, error) {
	query := r.URL.Query()
	filters := models.CareerPathFilters{
		Status:    query.Get("status"),
		Search:    query.Get("search"),
		SortBy:    query.Get("sort_by"),
		SortOrder: query.Get("sort_order"),
		Language:  query.Get("language"),
		Page:      1,
		PageSize:  25,
	}
	if value := query.Get("faculty_id"); value != "" {
		id, err := strconv.ParseUint(value, 10, 64)
		if err != nil || id == 0 {
			return filters, errors.New("invalid faculty_id")
		}
		filters.FacultyID = &id
	}
	if value := query.Get("curriculum_id"); value != "" {
		id, err := strconv.ParseUint(value, 10, 64)
		if err != nil || id == 0 {
			return filters, errors.New("invalid curriculum_id")
		}
		filters.CurriculumID = &id
	}
	if value := query.Get("without_curriculum"); value != "" {
		withoutCurriculum, err := strconv.ParseBool(value)
		if err != nil {
			return filters, errors.New("invalid without_curriculum")
		}
		filters.WithoutCurriculum = withoutCurriculum
	}
	if filters.CurriculumID != nil && filters.WithoutCurriculum {
		return filters, errors.New("curriculum filters are mutually exclusive")
	}
	var err error
	if value := query.Get("page"); value != "" {
		filters.Page, err = strconv.Atoi(value)
		if err != nil {
			return filters, err
		}
	}
	if value := query.Get("page_size"); value != "" {
		filters.PageSize, err = strconv.Atoi(value)
		if err != nil {
			return filters, err
		}
	}
	return filters, nil
}

func careerPathIDParam(w http.ResponseWriter, r *http.Request) (uint64, bool) {
	id, err := strconv.ParseUint(chi.URLParam(r, "career_path_id"), 10, 64)
	if err != nil || id == 0 {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid career path id")
		return 0, false
	}
	return id, true
}

func careerPathClaims(w http.ResponseWriter, r *http.Request) (*utils.Claims, bool) {
	claims, ok := utils.ClaimsFromContext(r.Context())
	if !ok {
		utils.Error(w, http.StatusUnauthorized, "AUTH_MISSING", "missing auth")
		return nil, false
	}
	return claims, true
}

func decodeCareerPathJSON(w http.ResponseWriter, r *http.Request, target any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return false
	}
	if err := decoder.Decode(new(any)); !errors.Is(err, io.EOF) {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "request body must contain one JSON value")
		return false
	}
	return true
}

func writeCareerPathError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, services.ErrCareerPathForbidden):
		utils.Error(w, http.StatusForbidden, "FORBIDDEN", "career path access forbidden")
	case errors.Is(err, services.ErrCareerPathInvalid), errors.Is(err, repositories.ErrCareerPathInvalidScope):
		utils.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "career path data is invalid")
	case errors.Is(err, services.ErrCareerPathImportInvalid):
		utils.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "selected import rows are invalid")
	case errors.Is(err, repositories.ErrCareerPathNotFound):
		utils.Error(w, http.StatusNotFound, "NOT_FOUND", "career path not found")
	case errors.Is(err, repositories.ErrCareerPathConflict):
		utils.Error(w, http.StatusConflict, "CONFLICT", "career path changed or conflicts with another record")
	default:
		utils.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "career path operation failed")
	}
}
