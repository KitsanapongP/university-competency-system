package controllers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/services"
	"github.com/spw32767/university-competency-system-backend/utils"
)

type ExecutiveAnalyticsController struct {
	Service *services.ExecutiveAnalyticsService
}

func (c *ExecutiveAnalyticsController) Scope(w http.ResponseWriter, r *http.Request) {
	claims, ok := executiveClaims(w, r)
	if !ok {
		return
	}
	filters, ok := executiveFilters(w, r)
	if !ok {
		return
	}
	data, err := c.Service.Scope(r.Context(), claims, filters)
	if err != nil {
		writeExecutiveError(w, err)
		return
	}
	utils.OK(w, data)
}

func (c *ExecutiveAnalyticsController) Overview(w http.ResponseWriter, r *http.Request) {
	claims, ok := executiveClaims(w, r)
	if !ok {
		return
	}
	filters, ok := executiveFilters(w, r)
	if !ok {
		return
	}
	data, err := c.Service.Overview(r.Context(), claims, filters)
	if err != nil {
		writeExecutiveError(w, err)
		return
	}
	utils.OK(w, data)
}

func (c *ExecutiveAnalyticsController) Competency(w http.ResponseWriter, r *http.Request) {
	claims, ok := executiveClaims(w, r)
	if !ok {
		return
	}
	filters, ok := executiveFilters(w, r)
	if !ok {
		return
	}
	id, err := strconv.ParseUint(chi.URLParam(r, "competency_id"), 10, 64)
	if err != nil || id == 0 {
		utils.Error(w, http.StatusBadRequest, "INVALID_COMPETENCY", "invalid competency id")
		return
	}
	data, err := c.Service.CompetencyDetail(r.Context(), claims, filters, id)
	if err != nil {
		writeExecutiveError(w, err)
		return
	}
	utils.OK(w, data)
}

func (c *ExecutiveAnalyticsController) Comparison(w http.ResponseWriter, r *http.Request) {
	claims, ok := executiveClaims(w, r)
	if !ok {
		return
	}
	filters, ok := executiveFilters(w, r)
	if !ok {
		return
	}
	data, err := c.Service.Comparison(r.Context(), claims, filters)
	if err != nil {
		writeExecutiveError(w, err)
		return
	}
	utils.OK(w, data)
}

func (c *ExecutiveAnalyticsController) Students(w http.ResponseWriter, r *http.Request) {
	claims, ok := executiveClaims(w, r)
	if !ok {
		return
	}
	filters, ok := executiveFilters(w, r)
	if !ok {
		return
	}
	data, err := c.Service.Students(r.Context(), claims, filters)
	if err != nil {
		writeExecutiveError(w, err)
		return
	}
	utils.OK(w, data)
}

func (c *ExecutiveAnalyticsController) Student(w http.ResponseWriter, r *http.Request) {
	claims, ok := executiveClaims(w, r)
	if !ok {
		return
	}
	filters, ok := executiveFilters(w, r)
	if !ok {
		return
	}
	id, err := strconv.ParseUint(chi.URLParam(r, "enrollment_id"), 10, 64)
	if err != nil || id == 0 {
		utils.Error(w, http.StatusBadRequest, "INVALID_ENROLLMENT", "invalid enrollment id")
		return
	}
	data, err := c.Service.StudentDetail(r.Context(), claims, filters, id)
	if err != nil {
		writeExecutiveError(w, err)
		return
	}
	utils.OK(w, data)
}

func executiveClaims(w http.ResponseWriter, r *http.Request) (*utils.Claims, bool) {
	claims, ok := utils.ClaimsFromContext(r.Context())
	if !ok {
		utils.Error(w, http.StatusUnauthorized, "AUTH_MISSING", "missing auth context")
		return nil, false
	}
	return claims, true
}

func executiveFilters(w http.ResponseWriter, r *http.Request) (models.ExecutiveAnalyticsFilters, bool) {
	var filters models.ExecutiveAnalyticsFilters
	parse := func(name string) (*uint64, bool) {
		value := r.URL.Query().Get(name)
		if value == "" {
			return nil, true
		}
		parsed, err := strconv.ParseUint(value, 10, 64)
		if err != nil || parsed == 0 {
			utils.Error(w, http.StatusBadRequest, "INVALID_FILTER", "invalid "+name)
			return nil, false
		}
		return &parsed, true
	}
	var ok bool
	if filters.FacultyID, ok = parse("faculty_id"); !ok {
		return filters, false
	}
	if filters.MajorID, ok = parse("major_id"); !ok {
		return filters, false
	}
	if filters.CurriculumID, ok = parse("curriculum_id"); !ok {
		return filters, false
	}
	if filters.CohortID, ok = parse("cohort_id"); !ok {
		return filters, false
	}
	if filters.EntryYearBE, ok = parse("entry_year_be"); !ok {
		return filters, false
	}
	if filters.CompetencyID, ok = parse("competency_id"); !ok {
		return filters, false
	}
	return filters, true
}

func writeExecutiveError(w http.ResponseWriter, err error) {
	if errors.Is(err, services.ErrExecutiveForbidden) {
		utils.Error(w, http.StatusForbidden, "FACULTY_SCOPE_FORBIDDEN", err.Error())
		return
	}
	if err.Error() == "student not found in executive scope" {
		utils.Error(w, http.StatusNotFound, "STUDENT_NOT_FOUND", err.Error())
		return
	}
	utils.Error(w, http.StatusInternalServerError, "EXECUTIVE_ANALYTICS_ERROR", "executive analytics operation failed")
}
