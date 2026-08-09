package controllers

import (
	"encoding/json"
	"errors"
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

func isTemplateAdmin(claims *utils.Claims) bool {
	for _, role := range claims.Roles {
		if role == "admin" {
			return true
		}
	}
	return false
}

func templateCompetencyActor(w http.ResponseWriter, r *http.Request) (uint64, bool, bool) {
	claims, ok := utils.ClaimsFromContext(r.Context())
	if !ok {
		utils.Error(w, http.StatusUnauthorized, "AUTH_MISSING", "missing auth")
		return 0, false, false
	}

	isAdmin := isTemplateAdmin(claims)
	if isAdmin {
		return 0, true, true
	}
	if claims.FacultyID == nil || *claims.FacultyID <= 0 {
		utils.Error(w, http.StatusForbidden, "FORBIDDEN", "faculty scope is required")
		return 0, false, false
	}
	return uint64(*claims.FacultyID), false, true
}

func writeTemplateCompetencyError(w http.ResponseWriter, err error) {
	var domainErr *services.TemplateCompetencyError
	if !errors.As(err, &domainErr) {
		utils.Error(w, http.StatusInternalServerError, "SERVER_ERROR", err.Error())
		return
	}

	status := http.StatusConflict
	switch domainErr.Code {
	case "BAD_REQUEST":
		status = http.StatusBadRequest
	case "FORBIDDEN":
		status = http.StatusForbidden
	case "NOT_FOUND":
		status = http.StatusNotFound
	}

	errorData := utils.Envelope{
		"code":    domainErr.Code,
		"message": domainErr.Message,
	}
	if domainErr.Data != nil {
		errorData["data"] = domainErr.Data
	}
	utils.JSON(w, status, utils.Envelope{"success": false, "error": errorData})
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

func (c *TemplateController) UpdateName(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid template id")
		return
	}

	var req models.UpdateTemplateNameRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json body")
		return
	}

	err = c.Service.UpdateTemplateName(r.Context(), id, req)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}

	utils.OK(w, map[string]interface{}{"success": true, "message": "อัปเดตชื่อ Template สำเร็จ"})
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

func (c *TemplateController) GetStructure(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid template id")
		return
	}

	structure, err := c.Service.GetTemplateStructure(r.Context(), id)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "SERVER_ERROR", err.Error())
		return
	}

	utils.OK(w, structure)
}

func (c *TemplateController) GetCompetencies(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid template id")
		return
	}
	facultyID, isAdmin, ok := templateCompetencyActor(w, r)
	if !ok {
		return
	}

	response, err := c.Service.GetTemplateCompetencies(r.Context(), id, facultyID, isAdmin)
	if err != nil {
		writeTemplateCompetencyError(w, err)
		return
	}
	utils.OK(w, response)
}

func (c *TemplateController) UpdateCompetencies(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid template id")
		return
	}
	facultyID, isAdmin, ok := templateCompetencyActor(w, r)
	if !ok {
		return
	}

	var req models.UpdateTemplateCompetenciesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json body")
		return
	}

	response, err := c.Service.UpdateTemplateCompetencies(r.Context(), id, facultyID, isAdmin, req)
	if err != nil {
		writeTemplateCompetencyError(w, err)
		return
	}
	utils.OK(w, response)
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
