package controllers

import (
	"net/http"
	"strings"

	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/services"
	"github.com/spw32767/university-competency-system-backend/utils"
)

type CourseGradeController struct {
	Service *services.CourseGradeService
}

func (c *CourseGradeController) GetOverview(w http.ResponseWriter, r *http.Request) {
	cohortID, ok := parseStudentCohortID(w, r, "cohort_id")
	if !ok {
		return
	}
	claims, ok := studentCohortClaims(w, r)
	if !ok {
		return
	}
	filters, ok := courseGradeFiltersFromQuery(w, r)
	if !ok {
		return
	}
	item, err := c.Service.GetOverview(r.Context(), cohortID, filters, claims.Roles, claims.FacultyID)
	if err != nil {
		writeStudentCohortError(w, err)
		return
	}
	utils.OK(w, item)
}

func (c *CourseGradeController) GetStudent(w http.ResponseWriter, r *http.Request) {
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
	filters, ok := courseGradeFiltersFromQuery(w, r)
	if !ok {
		return
	}
	item, err := c.Service.GetStudentGrades(r.Context(), cohortID, enrollmentID, filters, claims.Roles, claims.FacultyID)
	if err != nil {
		writeStudentCohortError(w, err)
		return
	}
	utils.OK(w, item)
}

func (c *CourseGradeController) GetCourse(w http.ResponseWriter, r *http.Request) {
	cohortID, ok := parseStudentCohortID(w, r, "cohort_id")
	if !ok {
		return
	}
	courseID, ok := parseStudentCohortID(w, r, "course_id")
	if !ok {
		return
	}
	claims, ok := studentCohortClaims(w, r)
	if !ok {
		return
	}
	filters, ok := courseGradeFiltersFromQuery(w, r)
	if !ok {
		return
	}
	item, err := c.Service.GetCourseGrades(r.Context(), cohortID, courseID, filters, claims.Roles, claims.FacultyID)
	if err != nil {
		writeStudentCohortError(w, err)
		return
	}
	utils.OK(w, item)
}

func (c *CourseGradeController) Put(w http.ResponseWriter, r *http.Request) {
	cohortID, ok := parseStudentCohortID(w, r, "cohort_id")
	if !ok {
		return
	}
	claims, ok := studentCohortClaims(w, r)
	if !ok {
		return
	}
	var payload models.PutCourseGradesRequest
	if !decodeStudentCohortPayload(w, r, &payload) {
		return
	}
	item, err := c.Service.PutGrades(r.Context(), cohortID, payload, claims.Roles, claims.FacultyID)
	if err != nil {
		writeStudentCohortError(w, err)
		return
	}
	utils.OK(w, item)
}

func (c *CourseGradeController) PreviewImport(w http.ResponseWriter, r *http.Request) {
	cohortID, ok := parseStudentCohortID(w, r, "cohort_id")
	if !ok {
		return
	}
	claims, ok := studentCohortClaims(w, r)
	if !ok {
		return
	}
	var payload models.PutCourseGradesRequest
	if !decodeStudentCohortPayload(w, r, &payload) {
		return
	}
	item, err := c.Service.PreviewImport(r.Context(), cohortID, payload, claims.Roles, claims.FacultyID)
	if err != nil {
		writeStudentCohortError(w, err)
		return
	}
	utils.OK(w, item)
}

func (c *CourseGradeController) CommitImport(w http.ResponseWriter, r *http.Request) {
	cohortID, ok := parseStudentCohortID(w, r, "cohort_id")
	if !ok {
		return
	}
	claims, ok := studentCohortClaims(w, r)
	if !ok {
		return
	}
	var payload models.PutCourseGradesRequest
	if !decodeStudentCohortPayload(w, r, &payload) {
		return
	}
	item, err := c.Service.CommitImport(r.Context(), cohortID, payload, claims.Roles, claims.FacultyID)
	if err != nil {
		writeStudentCohortError(w, err)
		return
	}
	utils.OK(w, item)
}

func courseGradeFiltersFromQuery(w http.ResponseWriter, r *http.Request) (models.CourseGradeFilters, bool) {
	filters := models.CourseGradeFilters{Search: strings.TrimSpace(r.URL.Query().Get("search")), Status: strings.ToLower(strings.TrimSpace(r.URL.Query().Get("status")))}
	var ok bool
	if filters.AcademicYearBE, ok = optionalStudentCohortUintQuery(w, r, "academic_year_be"); !ok {
		return filters, false
	}
	if filters.Semester, ok = optionalStudentCohortUintQuery(w, r, "semester"); !ok {
		return filters, false
	}
	if filters.CourseID, ok = optionalStudentCohortUintQuery(w, r, "course_id"); !ok {
		return filters, false
	}
	if filters.Semester != nil && (*filters.Semester < 1 || *filters.Semester > 3) {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "semester must be 1, 2, or 3")
		return filters, false
	}
	if filters.Status != "" && filters.Status != "recorded" && filters.Status != "missing" {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "grade status is invalid")
		return filters, false
	}
	return filters, true
}
