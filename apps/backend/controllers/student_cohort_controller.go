package controllers

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-sql-driver/mysql"
	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/services"
	"github.com/spw32767/university-competency-system-backend/utils"
)

type StudentCohortController struct {
	Service        *services.StudentCohortService
	ScoringService *services.CourseCompetencyScoringService
}

func (c *StudentCohortController) GetAll(w http.ResponseWriter, r *http.Request) {
	claims, ok := studentCohortClaims(w, r)
	if !ok {
		return
	}
	filters, ok := studentCohortFiltersFromQuery(w, r)
	if !ok {
		return
	}
	items, err := c.Service.GetCohorts(r.Context(), filters, claims.Roles, claims.FacultyID)
	if err != nil {
		writeStudentCohortError(w, err)
		return
	}
	utils.OK(w, items)
}

func (c *StudentCohortController) GetByID(w http.ResponseWriter, r *http.Request) {
	cohortID, ok := parseStudentCohortID(w, r, "cohort_id")
	if !ok {
		return
	}
	claims, ok := studentCohortClaims(w, r)
	if !ok {
		return
	}
	item, err := c.Service.GetCohort(r.Context(), cohortID, claims.Roles, claims.FacultyID)
	if err != nil {
		writeStudentCohortError(w, err)
		return
	}
	utils.OK(w, item)
}

func (c *StudentCohortController) Create(w http.ResponseWriter, r *http.Request) {
	claims, ok := studentCohortClaims(w, r)
	if !ok {
		return
	}
	var payload models.UpsertStudentCohortPayload
	if !decodeStudentCohortPayload(w, r, &payload) {
		return
	}
	item, err := c.Service.CreateCohort(r.Context(), payload, claims.UserID, claims.Roles, claims.FacultyID)
	if err != nil {
		writeStudentCohortError(w, err)
		return
	}
	utils.JSON(w, http.StatusCreated, utils.Envelope{"success": true, "message": "student cohort created successfully", "data": item})
}

func (c *StudentCohortController) Update(w http.ResponseWriter, r *http.Request) {
	cohortID, ok := parseStudentCohortID(w, r, "cohort_id")
	if !ok {
		return
	}
	claims, ok := studentCohortClaims(w, r)
	if !ok {
		return
	}
	var payload models.UpdateStudentCohortPayload
	if !decodeStudentCohortPayload(w, r, &payload) {
		return
	}
	item, err := c.Service.UpdateCohort(r.Context(), cohortID, payload, claims.Roles, claims.FacultyID)
	if err != nil {
		writeStudentCohortError(w, err)
		return
	}
	utils.OK(w, item)
}

func (c *StudentCohortController) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	cohortID, ok := parseStudentCohortID(w, r, "cohort_id")
	if !ok {
		return
	}
	claims, ok := studentCohortClaims(w, r)
	if !ok {
		return
	}
	var payload models.UpdateStudentCohortStatusPayload
	if !decodeStudentCohortPayload(w, r, &payload) {
		return
	}
	item, err := c.Service.UpdateCohortStatus(r.Context(), cohortID, payload, claims.UserID, claims.Roles, claims.FacultyID)
	if err != nil {
		writeStudentCohortError(w, err)
		return
	}
	utils.OK(w, item)
}

func (c *StudentCohortController) Delete(w http.ResponseWriter, r *http.Request) {
	cohortID, ok := parseStudentCohortID(w, r, "cohort_id")
	if !ok {
		return
	}
	claims, ok := studentCohortClaims(w, r)
	if !ok {
		return
	}
	if err := c.Service.DeleteCohort(r.Context(), cohortID, claims.Roles, claims.FacultyID); err != nil {
		writeStudentCohortError(w, err)
		return
	}
	utils.OK(w, utils.Envelope{"cohort_id": cohortID, "deleted": true})
}

func (c *StudentCohortController) GetStudents(w http.ResponseWriter, r *http.Request) {
	cohortID, ok := parseStudentCohortID(w, r, "cohort_id")
	if !ok {
		return
	}
	claims, ok := studentCohortClaims(w, r)
	if !ok {
		return
	}
	filters := models.StudentRosterFilters{Search: strings.TrimSpace(r.URL.Query().Get("search")), Status: strings.TrimSpace(r.URL.Query().Get("status"))}
	items, err := c.Service.GetRoster(r.Context(), cohortID, filters, claims.Roles, claims.FacultyID)
	if err != nil {
		writeStudentCohortError(w, err)
		return
	}
	utils.OK(w, items)
}

func (c *StudentCohortController) AddStudent(w http.ResponseWriter, r *http.Request) {
	cohortID, ok := parseStudentCohortID(w, r, "cohort_id")
	if !ok {
		return
	}
	claims, ok := studentCohortClaims(w, r)
	if !ok {
		return
	}
	var payload models.UpsertCohortStudentPayload
	if !decodeStudentCohortPayload(w, r, &payload) {
		return
	}
	item, err := c.Service.AddStudent(r.Context(), cohortID, payload, claims.Roles, claims.FacultyID)
	if err != nil {
		writeStudentCohortError(w, err)
		return
	}
	utils.JSON(w, http.StatusCreated, utils.Envelope{"success": true, "message": "student added successfully", "data": item})
}

func (c *StudentCohortController) UpdateStudent(w http.ResponseWriter, r *http.Request) {
	cohortID, ok := parseStudentCohortID(w, r, "cohort_id")
	if !ok {
		return
	}
	enrollmentID, ok := parseStudentCohortID(w, r, "enrollment_id")
	if !ok {
		return
	}
	claims, ok := studentCohortClaims(w, r)
	if !ok {
		return
	}
	var payload models.UpsertCohortStudentPayload
	if !decodeStudentCohortPayload(w, r, &payload) {
		return
	}
	item, err := c.Service.UpdateStudent(r.Context(), cohortID, enrollmentID, payload, claims.Roles, claims.FacultyID)
	if err != nil {
		writeStudentCohortError(w, err)
		return
	}
	utils.OK(w, item)
}

func (c *StudentCohortController) RemoveStudent(w http.ResponseWriter, r *http.Request) {
	cohortID, ok := parseStudentCohortID(w, r, "cohort_id")
	if !ok {
		return
	}
	enrollmentID, ok := parseStudentCohortID(w, r, "enrollment_id")
	if !ok {
		return
	}
	claims, ok := studentCohortClaims(w, r)
	if !ok {
		return
	}
	if err := c.Service.RemoveStudent(r.Context(), cohortID, enrollmentID, claims.Roles, claims.FacultyID); err != nil {
		writeStudentCohortError(w, err)
		return
	}
	utils.OK(w, utils.Envelope{"enrollment_id": enrollmentID, "removed": true})
}

func (c *StudentCohortController) PreviewImport(w http.ResponseWriter, r *http.Request) {
	cohortID, ok := parseStudentCohortID(w, r, "cohort_id")
	if !ok {
		return
	}
	claims, ok := studentCohortClaims(w, r)
	if !ok {
		return
	}
	var payload models.ImportCohortStudentsPayload
	if !decodeStudentCohortPayload(w, r, &payload) {
		return
	}
	preview, err := c.Service.PreviewImport(r.Context(), cohortID, payload, claims.Roles, claims.FacultyID)
	if err != nil {
		writeStudentCohortError(w, err)
		return
	}
	utils.OK(w, preview)
}

func (c *StudentCohortController) CommitImport(w http.ResponseWriter, r *http.Request) {
	cohortID, ok := parseStudentCohortID(w, r, "cohort_id")
	if !ok {
		return
	}
	claims, ok := studentCohortClaims(w, r)
	if !ok {
		return
	}
	var payload models.ImportCohortStudentsPayload
	if !decodeStudentCohortPayload(w, r, &payload) {
		return
	}
	preview, err := c.Service.CommitImport(r.Context(), cohortID, payload, claims.Roles, claims.FacultyID)
	if err != nil {
		writeStudentCohortError(w, err)
		return
	}
	utils.OK(w, preview)
}

func (c *StudentCohortController) GetCompetencyRequirements(w http.ResponseWriter, r *http.Request) {
	cohortID, ok := parseStudentCohortID(w, r, "cohort_id")
	if !ok {
		return
	}
	claims, ok := studentCohortClaims(w, r)
	if !ok {
		return
	}
	items, err := c.ScoringService.GetRequirements(r.Context(), cohortID, claims.Roles, claims.FacultyID)
	if err != nil {
		writeStudentCohortError(w, err)
		return
	}
	utils.OK(w, items)
}

func (c *StudentCohortController) ReplaceCompetencyRequirements(w http.ResponseWriter, r *http.Request) {
	cohortID, ok := parseStudentCohortID(w, r, "cohort_id")
	if !ok {
		return
	}
	claims, ok := studentCohortClaims(w, r)
	if !ok {
		return
	}
	var payload models.ReplaceCohortCompetencyRequirementsRequest
	if !decodeStudentCohortPayload(w, r, &payload) {
		return
	}
	items, err := c.ScoringService.ReplaceRequirements(r.Context(), cohortID, payload, claims.Roles, claims.FacultyID)
	if err != nil {
		writeStudentCohortError(w, err)
		return
	}
	utils.OK(w, items)
}

func (c *StudentCohortController) RecalculateCourseCompetencyScores(w http.ResponseWriter, r *http.Request) {
	cohortID, ok := parseStudentCohortID(w, r, "cohort_id")
	if !ok {
		return
	}
	claims, ok := studentCohortClaims(w, r)
	if !ok {
		return
	}
	result, err := c.ScoringService.Recalculate(r.Context(), cohortID, claims.Roles, claims.FacultyID)
	if err != nil {
		writeStudentCohortError(w, err)
		return
	}
	utils.OK(w, result)
}

func (c *StudentCohortController) GetCourseCompetencyScoreSummary(w http.ResponseWriter, r *http.Request) {
	cohortID, ok := parseStudentCohortID(w, r, "cohort_id")
	if !ok {
		return
	}
	claims, ok := studentCohortClaims(w, r)
	if !ok {
		return
	}
	items, err := c.ScoringService.GetSummary(r.Context(), cohortID, claims.Roles, claims.FacultyID)
	if err != nil {
		writeStudentCohortError(w, err)
		return
	}
	utils.OK(w, items)
}

func studentCohortFiltersFromQuery(w http.ResponseWriter, r *http.Request) (models.StudentCohortFilters, bool) {
	filters := models.StudentCohortFilters{Status: strings.ToLower(strings.TrimSpace(r.URL.Query().Get("status"))), Search: strings.TrimSpace(r.URL.Query().Get("search"))}
	var ok bool
	if filters.FacultyID, ok = optionalStudentCohortUintQuery(w, r, "faculty_id"); !ok {
		return filters, false
	}
	if filters.MajorID, ok = optionalStudentCohortUintQuery(w, r, "major_id"); !ok {
		return filters, false
	}
	if filters.CurriculumID, ok = optionalStudentCohortUintQuery(w, r, "curriculum_id"); !ok {
		return filters, false
	}
	if filters.EntryYearBE, ok = optionalStudentCohortUintQuery(w, r, "entry_year_be"); !ok {
		return filters, false
	}
	if filters.Status != "" && filters.Status != "draft" && filters.Status != "active" && filters.Status != "archived" {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "cohort status is invalid")
		return filters, false
	}
	return filters, true
}

func optionalStudentCohortUintQuery(w http.ResponseWriter, r *http.Request, key string) (*uint64, bool) {
	value := strings.TrimSpace(r.URL.Query().Get(key))
	if value == "" {
		return nil, true
	}
	parsed, err := strconv.ParseUint(value, 10, 64)
	if err != nil || parsed == 0 {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", key+" is invalid")
		return nil, false
	}
	return &parsed, true
}

func parseStudentCohortID(w http.ResponseWriter, r *http.Request, key string) (uint64, bool) {
	parsed, err := strconv.ParseUint(chi.URLParam(r, key), 10, 64)
	if err != nil || parsed == 0 {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid "+key)
		return 0, false
	}
	return parsed, true
}

func decodeStudentCohortPayload(w http.ResponseWriter, r *http.Request, target any) bool {
	if err := json.NewDecoder(r.Body).Decode(target); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json")
		return false
	}
	return true
}

func studentCohortClaims(w http.ResponseWriter, r *http.Request) (*utils.Claims, bool) {
	claims, ok := utils.ClaimsFromContext(r.Context())
	if !ok {
		utils.Error(w, http.StatusUnauthorized, "AUTH_MISSING", "missing auth")
		return nil, false
	}
	return claims, true
}

func writeStudentCohortError(w http.ResponseWriter, err error) {
	var validation services.StudentCohortValidationError
	if errors.As(err, &validation) {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", validation.Message)
		return
	}
	var conflict services.StudentCohortConflictError
	if errors.As(err, &conflict) {
		utils.Error(w, http.StatusConflict, conflict.Code, conflict.Message)
		return
	}
	if errors.Is(err, services.ErrStudentCohortForbidden) {
		utils.Error(w, http.StatusForbidden, "FORBIDDEN", "insufficient student cohort scope")
		return
	}
	if errors.Is(err, services.ErrStudentCohortNotFound) {
		utils.Error(w, http.StatusNotFound, "NOT_FOUND", "student cohort not found")
		return
	}
	if errors.Is(err, services.ErrCohortStudentNotFound) {
		utils.Error(w, http.StatusNotFound, "NOT_FOUND", "cohort student not found")
		return
	}
	var mysqlErr *mysql.MySQLError
	if errors.As(err, &mysqlErr) && mysqlErr.Number == 1062 {
		message := "student cohort already exists"
		if strings.Contains(mysqlErr.Message, "uq_student_cohorts_curriculum_entry_year") {
			message = "a cohort already exists for this curriculum and entry year"
		}
		if strings.Contains(mysqlErr.Message, "uq_kku_student_code") {
			message = "student code already exists"
		}
		utils.Error(w, http.StatusConflict, "DUPLICATE", message)
		return
	}
	log.Printf("student cohort operation failed: %v", err)
	utils.Error(w, http.StatusInternalServerError, "SERVER_ERROR", "student cohort operation failed")
}
