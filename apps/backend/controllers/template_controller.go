package controllers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/services"
	"github.com/spw32767/university-competency-system-backend/utils"
)

type TemplateController struct {
	Service *services.TemplateService
}

func resolveFacultyID(r *http.Request, claims *utils.Claims) uint64 {
	if claims.FacultyID != nil && *claims.FacultyID > 0 {
		return uint64(*claims.FacultyID)
	}
	raw := strings.TrimSpace(r.URL.Query().Get("faculty_id"))
	if val, err := strconv.ParseUint(raw, 10, 64); err == nil && val > 0 {
		return val
	}
	return 11 // Default Faculty ID (Science/ComSci)
}

func (c *TemplateController) GetAll(w http.ResponseWriter, r *http.Request) {
	claims, ok := utils.ClaimsFromContext(r.Context())
	if !ok {
		utils.Error(w, http.StatusUnauthorized, "AUTH_MISSING", "missing auth")
		return
	}

	facultyID := resolveFacultyID(r, claims)
	templates, err := c.Service.GetTemplatesByFaculty(r.Context(), facultyID)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "SERVER_ERROR", err.Error())
		return
	}

	utils.OK(w, templates)
}

func (c *TemplateController) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid template id")
		return
	}

	template, err := c.Service.GetTemplateByID(r.Context(), id)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "SERVER_ERROR", err.Error())
		return
	}
	if template == nil {
		utils.Error(w, http.StatusNotFound, "NOT_FOUND", "template not found")
		return
	}

	utils.OK(w, template)
}

func (c *TemplateController) Create(w http.ResponseWriter, r *http.Request) {
	claims, ok := utils.ClaimsFromContext(r.Context())
	if !ok {
		utils.Error(w, http.StatusUnauthorized, "AUTH_MISSING", "missing auth")
		return
	}

	var req models.CreateTemplateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json body")
		return
	}

	facultyID := resolveFacultyID(r, claims)
	created, err := c.Service.CreateTemplate(r.Context(), facultyID, uint64(claims.UserID), req)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}

	utils.JSON(w, http.StatusCreated, utils.Envelope{
		"success": true,
		"message": "สร้าง Template สำเร็จ",
		"data":    created,
	})
}

func (c *TemplateController) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid template id")
		return
	}

	var req models.UpdateTemplateStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json body")
		return
	}

	err = c.Service.UpdateTemplateStatus(r.Context(), id, req)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}

	utils.OK(w, map[string]interface{}{"success": true, "message": "อัปเดตสถานะสำเร็จ"})
}

func (c *TemplateController) GetItems(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid template id")
		return
	}

	items, err := c.Service.GetTemplateItems(r.Context(), id)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "SERVER_ERROR", err.Error())
		return
	}

	utils.OK(w, items)
}

func (c *TemplateController) SaveItems(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid template id")
		return
	}

	var req models.UpdateTemplateItemsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json body")
		return
	}

	err = c.Service.SaveTemplateItems(r.Context(), id, req)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}

	utils.OK(w, map[string]interface{}{"success": true, "message": "บันทึกน้ำหนักสำเร็จ"})
}

func (c *TemplateController) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid template id")
		return
	}

	err = c.Service.DeleteTemplate(r.Context(), id)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}

	utils.OK(w, map[string]interface{}{"success": true, "message": "ลบ Template สำเร็จ"})
}
