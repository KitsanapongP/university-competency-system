package controllers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-sql-driver/mysql"
	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/services"
	"github.com/spw32767/university-competency-system-backend/utils"
)

type CurriculumController struct {
	Service *services.CurriculumService
}

func (c *CurriculumController) GetFaculties(w http.ResponseWriter, r *http.Request) {
	claims, ok := utils.ClaimsFromContext(r.Context())
	if !ok {
		utils.Error(w, http.StatusUnauthorized, "AUTH_MISSING", "missing auth")
		return
	}

	faculties, err := c.Service.GetFaculties(r.Context(), claims.Roles, claims.FacultyID)
	if err != nil {
		writeCurriculumError(w, err)
		return
	}

	utils.OK(w, faculties)
}

func (c *CurriculumController) GetDepartments(w http.ResponseWriter, r *http.Request) {
	claims, ok := utils.ClaimsFromContext(r.Context())
	if !ok {
		utils.Error(w, http.StatusUnauthorized, "AUTH_MISSING", "missing auth")
		return
	}

	filters, ok := departmentFiltersFromQuery(w, r)
	if !ok {
		return
	}
	departments, err := c.Service.GetDepartments(r.Context(), claims.Roles, claims.FacultyID, filters)
	if err != nil {
		writeCurriculumError(w, err)
		return
	}

	utils.OK(w, departments)
}

func (c *CurriculumController) GetMajors(w http.ResponseWriter, r *http.Request) {
	claims, ok := utils.ClaimsFromContext(r.Context())
	if !ok {
		utils.Error(w, http.StatusUnauthorized, "AUTH_MISSING", "missing auth")
		return
	}

	filters, ok := majorFiltersFromQuery(w, r)
	if !ok {
		return
	}
	majors, err := c.Service.GetMajors(r.Context(), claims.Roles, claims.FacultyID, filters)
	if err != nil {
		writeCurriculumError(w, err)
		return
	}

	utils.OK(w, majors)
}

func (c *CurriculumController) CreateMajor(w http.ResponseWriter, r *http.Request) {
	claims, ok := utils.ClaimsFromContext(r.Context())
	if !ok {
		utils.Error(w, http.StatusUnauthorized, "AUTH_MISSING", "missing auth")
		return
	}

	var payload models.UpsertMajorPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json")
		return
	}

	major, err := c.Service.CreateMajor(r.Context(), payload, claims.Roles, claims.FacultyID)
	if err != nil {
		writeCurriculumError(w, err)
		return
	}

	utils.JSON(w, http.StatusCreated, utils.Envelope{
		"success": true,
		"message": "major created successfully",
		"data":    major,
	})
}

func (c *CurriculumController) UpdateMajor(w http.ResponseWriter, r *http.Request) {
	majorID, ok := parseUintURLParam(w, r, "major_id", "invalid major id")
	if !ok {
		return
	}
	claims, ok := utils.ClaimsFromContext(r.Context())
	if !ok {
		utils.Error(w, http.StatusUnauthorized, "AUTH_MISSING", "missing auth")
		return
	}

	var payload models.UpsertMajorPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json")
		return
	}

	major, err := c.Service.UpdateMajor(r.Context(), majorID, payload, claims.Roles, claims.FacultyID)
	if err != nil {
		writeCurriculumError(w, err)
		return
	}

	utils.OK(w, major)
}

func (c *CurriculumController) UpdateMajorStatus(w http.ResponseWriter, r *http.Request) {
	majorID, ok := parseUintURLParam(w, r, "major_id", "invalid major id")
	if !ok {
		return
	}
	claims, ok := utils.ClaimsFromContext(r.Context())
	if !ok {
		utils.Error(w, http.StatusUnauthorized, "AUTH_MISSING", "missing auth")
		return
	}

	var payload models.UpdateMajorStatusPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json")
		return
	}

	major, err := c.Service.UpdateMajorStatus(r.Context(), majorID, payload, claims.Roles, claims.FacultyID)
	if err != nil {
		writeCurriculumError(w, err)
		return
	}

	utils.OK(w, major)
}

func (c *CurriculumController) GetAll(w http.ResponseWriter, r *http.Request) {
	claims, ok := utils.ClaimsFromContext(r.Context())
	if !ok {
		utils.Error(w, http.StatusUnauthorized, "AUTH_MISSING", "missing auth")
		return
	}

	curricula, err := c.Service.GetCurriculums(r.Context(), claims.Roles, claims.FacultyID)
	if err != nil {
		writeCurriculumError(w, err)
		return
	}

	utils.OK(w, curricula)
}

func (c *CurriculumController) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid curriculum id")
		return
	}

	claims, ok := utils.ClaimsFromContext(r.Context())
	if !ok {
		utils.Error(w, http.StatusUnauthorized, "AUTH_MISSING", "missing auth")
		return
	}

	curriculum, err := c.Service.GetCurriculumByID(r.Context(), id, claims.Roles, claims.FacultyID)
	if err != nil {
		writeCurriculumError(w, err)
		return
	}

	utils.OK(w, curriculum)
}

func (c *CurriculumController) Create(w http.ResponseWriter, r *http.Request) {
	claims, ok := utils.ClaimsFromContext(r.Context())
	if !ok {
		utils.Error(w, http.StatusUnauthorized, "AUTH_MISSING", "missing auth")
		return
	}

	var payload models.CreateCurriculumPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json")
		return
	}

	createdCurriculum, err := c.Service.CreateCurriculum(r.Context(), payload, claims.UserID, claims.Roles, claims.FacultyID)
	if err != nil {
		writeCurriculumError(w, err)
		return
	}

	utils.JSON(w, http.StatusCreated, utils.Envelope{
		"success": true,
		"message": "curriculum created successfully",
		"data":    createdCurriculum,
	})
}

func majorFiltersFromQuery(w http.ResponseWriter, r *http.Request) (models.MajorFilters, bool) {
	var filters models.MajorFilters
	if includeInactive := strings.TrimSpace(r.URL.Query().Get("include_inactive")); includeInactive != "" {
		value, err := strconv.ParseBool(includeInactive)
		if err != nil {
			utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "include_inactive must be boolean")
			return filters, false
		}
		filters.IncludeInactive = value
	}

	facultyID, ok := optionalUintQuery(w, r, "faculty_id")
	if !ok {
		return filters, false
	}
	departmentID, ok := optionalUintQuery(w, r, "department_id")
	if !ok {
		return filters, false
	}
	filters.FacultyID = facultyID
	filters.DepartmentID = departmentID
	return filters, true
}

func departmentFiltersFromQuery(w http.ResponseWriter, r *http.Request) (models.DepartmentFilters, bool) {
	var filters models.DepartmentFilters
	facultyID, ok := optionalUintQuery(w, r, "faculty_id")
	if !ok {
		return filters, false
	}
	filters.FacultyID = facultyID
	return filters, true
}

func optionalUintQuery(w http.ResponseWriter, r *http.Request, name string) (*uint64, bool) {
	raw := strings.TrimSpace(r.URL.Query().Get(name))
	if raw == "" {
		return nil, true
	}
	value, err := strconv.ParseUint(raw, 10, 64)
	if err != nil || value == 0 {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", name+" is invalid")
		return nil, false
	}
	return &value, true
}

func writeCurriculumError(w http.ResponseWriter, err error) {
	var validationDetailsErr services.CurriculumValidationDetailsError
	if errors.As(err, &validationDetailsErr) {
		utils.JSON(w, http.StatusBadRequest, utils.Envelope{
			"success": false,
			"error": utils.Envelope{
				"code":    "BAD_REQUEST",
				"message": validationDetailsErr.Message,
			},
			"data": validationDetailsErr.Data,
		})
		return
	}

	var validationErr services.CurriculumValidationError
	if errors.As(err, &validationErr) {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", validationErr.Message)
		return
	}

	var confirmationErr services.CurriculumConfirmationRequiredError
	if errors.As(err, &confirmationErr) {
		utils.JSON(w, http.StatusConflict, utils.Envelope{
			"success": false,
			"error": utils.Envelope{
				"code":    "CONFIRMATION_REQUIRED",
				"message": confirmationErr.Message,
			},
			"data": confirmationErr.Data,
		})
		return
	}

	var conflictErr services.CurriculumConflictError
	if errors.As(err, &conflictErr) {
		code := conflictErr.Code
		if code == "" {
			code = "CONFLICT"
		}
		utils.Error(w, http.StatusConflict, code, conflictErr.Message)
		return
	}

	if errors.Is(err, services.ErrCurriculumForbidden) {
		utils.Error(w, http.StatusForbidden, "FORBIDDEN", "insufficient curriculum scope")
		return
	}

	if errors.Is(err, services.ErrCurriculumNotFound) {
		utils.Error(w, http.StatusNotFound, "NOT_FOUND", "curriculum not found")
		return
	}

	if errors.Is(err, services.ErrMajorNotFound) {
		utils.Error(w, http.StatusNotFound, "NOT_FOUND", "major not found")
		return
	}

	var mysqlErr *mysql.MySQLError
	if errors.As(err, &mysqlErr) && mysqlErr.Number == 1062 {
		message := "curriculum already exists"
		if strings.Contains(mysqlErr.Message, "uq_crs_courses_curriculum_code_live") {
			message = "course code already exists in this curriculum"
		} else if strings.Contains(mysqlErr.Message, "uq_majors_department_code") {
			message = "major code already exists in this department"
		} else if strings.Contains(mysqlErr.Message, "uq_curricula_major_code_live") ||
			strings.Contains(mysqlErr.Message, "uq_curricula_major_code") {
			message = "curriculum code already exists in this major"
		} else if strings.Contains(mysqlErr.Message, "uq_curricula_major_year_name_th_live") {
			message = "curriculum name already exists in this major and effective year"
		} else if strings.Contains(mysqlErr.Message, "uq_curricula_major_year") {
			message = "curriculum effective year already exists in this major"
		}
		utils.Error(w, http.StatusConflict, "DUPLICATE", message)
		return
	}

	utils.Error(w, http.StatusInternalServerError, "SERVER_ERROR", "curriculum operation failed")
}
