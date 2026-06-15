package controllers

import (
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

type CurriculumController struct {
	Service *services.CurriculumService
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
	var validationErr services.CurriculumValidationError
	if errors.As(err, &validationErr) {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", validationErr.Message)
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
		utils.Error(w, http.StatusConflict, "DUPLICATE", "curriculum already exists")
		return
	}

	utils.Error(w, http.StatusInternalServerError, "SERVER_ERROR", "curriculum operation failed")
}
