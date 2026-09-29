package controllers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-sql-driver/mysql"
	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/services"
	"github.com/spw32767/university-competency-system-backend/utils"
)

type FreeElectiveController struct {
	Service *services.FreeElectiveService
}

func (c *FreeElectiveController) ListCourses(w http.ResponseWriter, r *http.Request) {
	claims, ok := freeElectiveClaims(w, r)
	if !ok {
		return
	}
	facultyID, ok := freeElectiveOptionalUintQuery(w, r, "faculty_id")
	if !ok {
		return
	}
	courses, err := c.Service.ListCourses(r.Context(), claims, models.FreeElectiveCourseFilters{FacultyID: facultyID})
	if err != nil {
		writeFreeElectiveError(w, err)
		return
	}
	utils.OK(w, courses)
}

func (c *FreeElectiveController) GetCourse(w http.ResponseWriter, r *http.Request) {
	claims, ok := freeElectiveClaims(w, r)
	if !ok {
		return
	}
	id, ok := freeElectiveID(w, r, "course_id")
	if !ok {
		return
	}
	course, err := c.Service.GetCourse(r.Context(), claims, id)
	if err != nil {
		writeFreeElectiveError(w, err)
		return
	}
	utils.OK(w, course)
}

func (c *FreeElectiveController) CreateCourse(w http.ResponseWriter, r *http.Request) {
	claims, ok := freeElectiveClaims(w, r)
	if !ok {
		return
	}
	var payload models.UpsertFreeElectiveCoursePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json")
		return
	}
	course, err := c.Service.CreateCourse(r.Context(), claims, payload)
	if err != nil {
		writeFreeElectiveError(w, err)
		return
	}
	utils.JSON(w, http.StatusCreated, utils.Envelope{"success": true, "data": course})
}

func (c *FreeElectiveController) UpdateCourse(w http.ResponseWriter, r *http.Request) {
	claims, ok := freeElectiveClaims(w, r)
	if !ok {
		return
	}
	id, ok := freeElectiveID(w, r, "course_id")
	if !ok {
		return
	}
	var payload models.UpsertFreeElectiveCoursePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json")
		return
	}
	course, err := c.Service.UpdateCourse(r.Context(), claims, id, payload)
	if err != nil {
		writeFreeElectiveError(w, err)
		return
	}
	utils.OK(w, course)
}

func (c *FreeElectiveController) ListStudentGroups(w http.ResponseWriter, r *http.Request) {
	claims, ok := freeElectiveClaims(w, r)
	if !ok {
		return
	}
	filters, ok := freeElectiveStudentGroupFilters(w, r)
	if !ok {
		return
	}
	groups, err := c.Service.GetStudentGroups(r.Context(), claims, filters)
	if err != nil {
		writeFreeElectiveError(w, err)
		return
	}
	utils.OK(w, groups)
}

func (c *FreeElectiveController) ListCohortStudents(w http.ResponseWriter, r *http.Request) {
	claims, ok := freeElectiveClaims(w, r)
	if !ok {
		return
	}
	cohortID, ok := freeElectiveID(w, r, "cohort_id")
	if !ok {
		return
	}
	students, err := c.Service.GetCohortStudents(r.Context(), claims, cohortID)
	if err != nil {
		writeFreeElectiveError(w, err)
		return
	}
	utils.OK(w, students)
}

func (c *FreeElectiveController) GetStudentDetail(w http.ResponseWriter, r *http.Request) {
	claims, ok := freeElectiveClaims(w, r)
	if !ok {
		return
	}
	enrollmentID, ok := freeElectiveID(w, r, "enrollment_id")
	if !ok {
		return
	}
	detail, err := c.Service.GetStudentDetail(r.Context(), claims, enrollmentID)
	if err != nil {
		writeFreeElectiveError(w, err)
		return
	}
	utils.OK(w, detail)
}

func freeElectiveClaims(w http.ResponseWriter, r *http.Request) (*utils.Claims, bool) {
	claims, ok := utils.ClaimsFromContext(r.Context())
	if !ok {
		utils.Error(w, http.StatusUnauthorized, "AUTH_MISSING", "missing auth context")
		return nil, false
	}
	return claims, true
}

func freeElectiveID(w http.ResponseWriter, r *http.Request, name string) (uint64, bool) {
	id, err := strconv.ParseUint(chi.URLParam(r, name), 10, 64)
	if err != nil || id == 0 {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid "+name)
		return 0, false
	}
	return id, true
}

func freeElectiveOptionalUintQuery(w http.ResponseWriter, r *http.Request, name string) (*uint64, bool) {
	raw := r.URL.Query().Get(name)
	if raw == "" {
		return nil, true
	}
	id, err := strconv.ParseUint(raw, 10, 64)
	if err != nil || id == 0 {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid "+name)
		return nil, false
	}
	return &id, true
}

func freeElectiveStudentGroupFilters(w http.ResponseWriter, r *http.Request) (models.FreeElectiveStudentGroupFilters, bool) {
	var filters models.FreeElectiveStudentGroupFilters
	var ok bool
	if filters.FacultyID, ok = freeElectiveOptionalUintQuery(w, r, "faculty_id"); !ok {
		return filters, false
	}
	if filters.MajorID, ok = freeElectiveOptionalUintQuery(w, r, "major_id"); !ok {
		return filters, false
	}
	if filters.CurriculumID, ok = freeElectiveOptionalUintQuery(w, r, "curriculum_id"); !ok {
		return filters, false
	}
	if filters.EntryYearBE, ok = freeElectiveOptionalUintQuery(w, r, "entry_year_be"); !ok {
		return filters, false
	}
	return filters, true
}

func freeElectiveRoundLearnerFilters(w http.ResponseWriter, r *http.Request) (models.FreeElectiveRoundLearnerFilters, bool) {
	groupFilters, ok := freeElectiveStudentGroupFilters(w, r)
	if !ok {
		return models.FreeElectiveRoundLearnerFilters{}, false
	}
	return models.FreeElectiveRoundLearnerFilters{
		Search:       r.URL.Query().Get("search"),
		FacultyID:    groupFilters.FacultyID,
		MajorID:      groupFilters.MajorID,
		CurriculumID: groupFilters.CurriculumID,
		EntryYearBE:  groupFilters.EntryYearBE,
	}, true
}

func writeFreeElectiveError(w http.ResponseWriter, err error) {
	if errors.Is(err, services.ErrFreeElectiveForbidden) {
		utils.Error(w, http.StatusForbidden, "FACULTY_SCOPE_FORBIDDEN", err.Error())
		return
	}
	if errors.Is(err, services.ErrFreeElectiveCourseNotFound) {
		utils.Error(w, http.StatusNotFound, "FREE_ELECTIVE_COURSE_NOT_FOUND", err.Error())
		return
	}
	if errors.Is(err, services.ErrFreeElectiveRoundNotFound) {
		utils.Error(w, http.StatusNotFound, "FREE_ELECTIVE_ROUND_NOT_FOUND", err.Error())
		return
	}
	if errors.Is(err, services.ErrFreeElectiveRoundCourseNotFound) {
		utils.Error(w, http.StatusNotFound, "FREE_ELECTIVE_ROUND_COURSE_NOT_FOUND", err.Error())
		return
	}
	if errors.Is(err, services.ErrFreeElectiveRoundEnrollmentNotFound) {
		utils.Error(w, http.StatusNotFound, "FREE_ELECTIVE_ROUND_ENROLLMENT_NOT_FOUND", err.Error())
		return
	}
	if errors.Is(err, services.ErrFreeElectiveStudentGroupNotFound) {
		utils.Error(w, http.StatusNotFound, "FREE_ELECTIVE_STUDENT_GROUP_NOT_FOUND", err.Error())
		return
	}
	if errors.Is(err, services.ErrFreeElectiveStudentNotFound) {
		utils.Error(w, http.StatusNotFound, "FREE_ELECTIVE_STUDENT_NOT_FOUND", err.Error())
		return
	}
	if errors.Is(err, services.ErrFreeElectiveRoundLocked) {
		utils.Error(w, http.StatusConflict, "ROUND_NOT_EDITABLE", err.Error())
		return
	}
	var validationErr services.FreeElectiveValidationError
	if errors.As(err, &validationErr) {
		utils.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", validationErr.Message)
		return
	}
	var conflictErr services.FreeElectiveConflictError
	if errors.As(err, &conflictErr) {
		utils.JSON(w, http.StatusConflict, utils.Envelope{
			"success": false,
			"error":   utils.Envelope{"code": conflictErr.Code, "message": conflictErr.Message},
			"data":    conflictErr.Data,
		})
		return
	}
	var mysqlErr *mysql.MySQLError
	if errors.As(err, &mysqlErr) && mysqlErr.Number == 1062 {
		utils.Error(w, http.StatusConflict, "DUPLICATE", "a free-elective course with this code already exists in the faculty")
		return
	}
	if errors.Is(err, sql.ErrNoRows) {
		utils.Error(w, http.StatusNotFound, "NOT_FOUND", "free-elective resource not found")
		return
	}
	utils.Error(w, http.StatusInternalServerError, "FREE_ELECTIVE_ERROR", "free-elective operation failed")
}
