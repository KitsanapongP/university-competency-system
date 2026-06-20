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

func (c *CurriculumController) GetMajors(w http.ResponseWriter, r *http.Request) {
	claims, ok := utils.ClaimsFromContext(r.Context())
	if !ok {
		utils.Error(w, http.StatusUnauthorized, "AUTH_MISSING", "missing auth")
		return
	}

	majors, err := c.Service.GetMajors(r.Context(), claims.Roles, claims.FacultyID)
	if err != nil {
		writeCurriculumError(w, err)
		return
	}

	utils.OK(w, majors)
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

	var mysqlErr *mysql.MySQLError
	if errors.As(err, &mysqlErr) && mysqlErr.Number == 1062 {
		message := "curriculum already exists"
		if strings.Contains(mysqlErr.Message, "uq_crs_courses_curriculum_code_live") {
			message = "course code already exists in this curriculum"
		}
		utils.Error(w, http.StatusConflict, "DUPLICATE", message)
		return
	}

	utils.Error(w, http.StatusInternalServerError, "SERVER_ERROR", "curriculum operation failed")
}
