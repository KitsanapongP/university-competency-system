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

type CompetencyController struct {
	Service *services.CompetencyService
}

func (h *CompetencyController) GetAll(w http.ResponseWriter, r *http.Request) {
	competencies, err := h.Service.GetCompetencyOptions(r.Context())
	if err != nil {
		writeCompetencyError(w, err)
		return
	}

	utils.OK(w, competencies)
}

func (h *CompetencyController) Create(w http.ResponseWriter, r *http.Request) {
	var payload models.UpsertCompetencyPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}

	competency, err := h.Service.CreateCompetency(r.Context(), payload)
	if err != nil {
		writeCompetencyError(w, err)
		return
	}

	utils.JSON(w, http.StatusCreated, utils.Envelope{
		"success": true,
		"data":    competency,
	})
}

func (h *CompetencyController) Update(w http.ResponseWriter, r *http.Request) {
	competencyID, ok := competencyIDFromRequest(w, r)
	if !ok {
		return
	}

	var payload models.UpsertCompetencyPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}

	competency, err := h.Service.UpdateCompetency(r.Context(), competencyID, payload)
	if err != nil {
		writeCompetencyError(w, err)
		return
	}

	utils.OK(w, competency)
}

func (h *CompetencyController) Delete(w http.ResponseWriter, r *http.Request) {
	competencyID, ok := competencyIDFromRequest(w, r)
	if !ok {
		return
	}

	if err := h.Service.DeleteCompetency(r.Context(), competencyID); err != nil {
		writeCompetencyError(w, err)
		return
	}

	utils.OK(w, utils.Envelope{
		"competency_id": competencyID,
		"deleted":       true,
	})
}

func (h *CompetencyController) Dashboard(w http.ResponseWriter, r *http.Request) {
	claims, ok := utils.ClaimsFromContext(r.Context())
	if !ok {
		utils.Error(w, http.StatusUnauthorized, "AUTH_MISSING", "missing auth")
		return
	}

	// อ่าน query parameter 'category' เพื่อกรองข้อมูลตามหมวดหมู่ที่ต้องการ
	// ค่าเริมต้น: "activity" (แสดงคะแนน Competency ของกิจกรรมทั้งหมด)
	category := r.URL.Query().Get("category")
	if category == "" {
		category = "activity"
	}

	// ตรวจสอบว่าค่าของ category เป็นค่าที่ถูกต้อง
	if category != "activity" && category != "course" {
		utils.Error(w, http.StatusBadRequest, "INVALID_CATEGORY", "invalid category")
		return
	}

	// เรียก Serveice และส่ง Category parameter
	data, err := h.Service.BuildDashboard(r.Context(), claims.UserID, category)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "SERVER_ERROR", "could not load competency data")
		return
	}

	utils.OK(w, data)
}

func competencyIDFromRequest(w http.ResponseWriter, r *http.Request) (uint64, bool) {
	rawID := chi.URLParam(r, "competency_id")
	id, err := strconv.ParseUint(rawID, 10, 64)
	if err != nil || id == 0 {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid competency id")
		return 0, false
	}
	return id, true
}

func writeCompetencyError(w http.ResponseWriter, err error) {
	var validationErr services.CompetencyValidationError
	if errors.As(err, &validationErr) {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", validationErr.Message)
		return
	}

	var conflictErr services.CompetencyConflictError
	if errors.As(err, &conflictErr) {
		code := conflictErr.Code
		if code == "" {
			code = "CONFLICT"
		}
		utils.Error(w, http.StatusConflict, code, conflictErr.Message)
		return
	}

	if errors.Is(err, services.ErrCompetencyNotFound) {
		utils.Error(w, http.StatusNotFound, "NOT_FOUND", "competency not found")
		return
	}

	var mysqlErr *mysql.MySQLError
	if errors.As(err, &mysqlErr) && mysqlErr.Number == 1062 {
		message := "competency already exists"
		if strings.Contains(mysqlErr.Message, "uq_competencies_code") {
			message = "competency code already exists"
		}
		utils.Error(w, http.StatusConflict, "DUPLICATE", message)
		return
	}

	utils.Error(w, http.StatusInternalServerError, "SERVER_ERROR", "competency operation failed")
}
