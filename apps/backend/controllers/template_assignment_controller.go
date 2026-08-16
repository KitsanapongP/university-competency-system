package controllers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/services"
	"github.com/spw32767/university-competency-system-backend/utils"
)

type TemplateAssignmentController struct {
	Service *services.TemplateAssignmentService
}

func writeTemplateAssignmentError(w http.ResponseWriter, err error) {
	var domainErr *services.TemplateAssignmentError
	if !errors.As(err, &domainErr) {
		utils.Error(w, http.StatusInternalServerError, "SERVER_ERROR", "template assignment operation failed")
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
	payload := utils.Envelope{"code": domainErr.Code, "message": domainErr.Message}
	if domainErr.Data != nil {
		payload["data"] = domainErr.Data
	}
	utils.JSON(w, status, utils.Envelope{"success": false, "error": payload})
}

func templateAssignmentActor(w http.ResponseWriter, r *http.Request) (uint64, uint64, bool, bool) {
	claims, ok := utils.ClaimsFromContext(r.Context())
	if !ok {
		utils.Error(w, http.StatusUnauthorized, "AUTH_MISSING", "missing auth")
		return 0, 0, false, false
	}
	admin := isTemplateAdmin(claims)
	if admin {
		return uint64(claims.UserID), 0, true, true
	}
	if claims.FacultyID == nil || *claims.FacultyID <= 0 {
		utils.Error(w, http.StatusForbidden, "FORBIDDEN", "faculty scope is required")
		return 0, 0, false, false
	}
	return uint64(claims.UserID), uint64(*claims.FacultyID), false, true
}

func (c *TemplateAssignmentController) GetAll(w http.ResponseWriter, r *http.Request) {
	_, facultyID, isAdmin, ok := templateAssignmentActor(w, r)
	if !ok {
		return
	}
	if isAdmin {
		facultyID, isAdmin = requestedAssignmentFaculty(r, facultyID, isAdmin)
	}
	items, err := c.Service.GetAssignments(r.Context(), facultyID, isAdmin)
	if err != nil {
		writeTemplateAssignmentError(w, err)
		return
	}
	utils.OK(w, items)
}

func (c *TemplateAssignmentController) GetAvailableTemplates(w http.ResponseWriter, r *http.Request) {
	_, facultyID, isAdmin, ok := templateAssignmentActor(w, r)
	if !ok {
		return
	}
	if isAdmin {
		facultyID, isAdmin = requestedAssignmentFaculty(r, facultyID, isAdmin)
	}
	items, err := c.Service.GetAvailableTemplates(r.Context(), facultyID, isAdmin)
	if err != nil {
		writeTemplateAssignmentError(w, err)
		return
	}
	utils.OK(w, items)
}

func (c *TemplateAssignmentController) GetAvailableCohorts(w http.ResponseWriter, r *http.Request) {
	_, facultyID, isAdmin, ok := templateAssignmentActor(w, r)
	if !ok {
		return
	}
	templateID, err := strconv.ParseUint(r.URL.Query().Get("template_id"), 10, 64)
	if err != nil || templateID == 0 {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "template_id is required")
		return
	}
	items, err := c.Service.GetAvailableCohorts(r.Context(), templateID, facultyID, isAdmin)
	if err != nil {
		writeTemplateAssignmentError(w, err)
		return
	}
	utils.OK(w, items)
}

func (c *TemplateAssignmentController) Create(w http.ResponseWriter, r *http.Request) {
	userID, facultyID, isAdmin, ok := templateAssignmentActor(w, r)
	if !ok {
		return
	}
	var req models.CreateTemplateAssignmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json body")
		return
	}
	item, err := c.Service.CreateAssignment(r.Context(), userID, facultyID, isAdmin, req)
	if err != nil {
		writeTemplateAssignmentError(w, err)
		return
	}
	utils.JSON(w, http.StatusCreated, utils.Envelope{"success": true, "message": "template assigned successfully", "data": item})
}

func (c *TemplateAssignmentController) Replace(w http.ResponseWriter, r *http.Request) {
	userID, facultyID, isAdmin, ok := templateAssignmentActor(w, r)
	if !ok {
		return
	}
	assignmentID, err := strconv.ParseUint(chi.URLParam(r, "assignment_id"), 10, 64)
	if err != nil || assignmentID == 0 {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid assignment id")
		return
	}
	var req models.ReplaceTemplateAssignmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json body")
		return
	}
	item, err := c.Service.ReplaceAssignment(r.Context(), assignmentID, userID, facultyID, isAdmin, req)
	if err != nil {
		writeTemplateAssignmentError(w, err)
		return
	}
	utils.OK(w, item)
}

func (c *TemplateAssignmentController) Delete(w http.ResponseWriter, r *http.Request) {
	userID, facultyID, isAdmin, ok := templateAssignmentActor(w, r)
	if !ok {
		return
	}
	assignmentID, err := strconv.ParseUint(chi.URLParam(r, "assignment_id"), 10, 64)
	if err != nil || assignmentID == 0 {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid assignment id")
		return
	}
	var req models.RemoveTemplateAssignmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json body")
		return
	}
	item, err := c.Service.RemoveAssignment(r.Context(), assignmentID, userID, facultyID, isAdmin, req)
	if err != nil {
		writeTemplateAssignmentError(w, err)
		return
	}
	utils.OK(w, item)
}

func (c *TemplateAssignmentController) GetHistory(w http.ResponseWriter, r *http.Request) {
	_, facultyID, isAdmin, ok := templateAssignmentActor(w, r)
	if !ok {
		return
	}
	cohortID, err := strconv.ParseUint(chi.URLParam(r, "cohort_id"), 10, 64)
	if err != nil || cohortID == 0 {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid cohort id")
		return
	}
	items, err := c.Service.GetHistory(r.Context(), cohortID, facultyID, isAdmin)
	if err != nil {
		writeTemplateAssignmentError(w, err)
		return
	}
	utils.OK(w, items)
}

func requestedAssignmentFaculty(r *http.Request, facultyID uint64, isAdmin bool) (uint64, bool) {
	requested, err := strconv.ParseUint(r.URL.Query().Get("faculty_id"), 10, 64)
	if err == nil && requested > 0 {
		return requested, false
	}
	return facultyID, isAdmin
}
