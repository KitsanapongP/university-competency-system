package controllers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/utils"
)

func (c *CurriculumController) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUintURLParam(w, r, "id", "invalid curriculum id")
	if !ok {
		return
	}
	claims, ok := curriculumClaims(w, r)
	if !ok {
		return
	}

	var payload models.UpdateCurriculumStatusPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json")
		return
	}

	curriculum, err := c.Service.UpdateCurriculumStatus(r.Context(), id, payload, claims.Roles, claims.FacultyID)
	if err != nil {
		writeCurriculumError(w, err)
		return
	}

	utils.OK(w, curriculum)
}

func (c *CurriculumController) CreateCategory(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUintURLParam(w, r, "id", "invalid curriculum id")
	if !ok {
		return
	}
	claims, ok := curriculumClaims(w, r)
	if !ok {
		return
	}

	var payload models.CreateCurriculumCategoryPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json")
		return
	}

	curriculum, err := c.Service.CreateCategory(r.Context(), id, payload, claims.Roles, claims.FacultyID)
	if err != nil {
		writeCurriculumError(w, err)
		return
	}

	utils.JSON(w, http.StatusCreated, utils.Envelope{
		"success": true,
		"message": "category created successfully",
		"data":    curriculum,
	})
}

func (c *CurriculumController) UpdateCategory(w http.ResponseWriter, r *http.Request) {
	id, categoryID, ok := curriculumAndCategoryIDs(w, r)
	if !ok {
		return
	}
	claims, ok := curriculumClaims(w, r)
	if !ok {
		return
	}

	var payload models.UpdateCurriculumCategoryPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json")
		return
	}

	curriculum, err := c.Service.UpdateCategory(r.Context(), id, categoryID, payload, claims.Roles, claims.FacultyID)
	if err != nil {
		writeCurriculumError(w, err)
		return
	}

	utils.OK(w, curriculum)
}

func (c *CurriculumController) GetDeleteCategoryPreview(w http.ResponseWriter, r *http.Request) {
	id, categoryID, ok := curriculumAndCategoryIDs(w, r)
	if !ok {
		return
	}
	claims, ok := curriculumClaims(w, r)
	if !ok {
		return
	}

	preview, err := c.Service.GetDeleteCategoryPreview(r.Context(), id, categoryID, claims.Roles, claims.FacultyID)
	if err != nil {
		writeCurriculumError(w, err)
		return
	}

	utils.OK(w, preview)
}

func (c *CurriculumController) DeleteCategory(w http.ResponseWriter, r *http.Request) {
	id, categoryID, ok := curriculumAndCategoryIDs(w, r)
	if !ok {
		return
	}
	claims, ok := curriculumClaims(w, r)
	if !ok {
		return
	}

	curriculum, err := c.Service.DeleteCategory(r.Context(), id, categoryID, confirmImpactFromQuery(r), claims.Roles, claims.FacultyID)
	if err != nil {
		writeCurriculumError(w, err)
		return
	}

	utils.OK(w, curriculum)
}

func (c *CurriculumController) CreateCourse(w http.ResponseWriter, r *http.Request) {
	id, categoryID, ok := curriculumAndCategoryIDs(w, r)
	if !ok {
		return
	}
	claims, ok := curriculumClaims(w, r)
	if !ok {
		return
	}

	var payload models.CreateCurriculumCoursePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json")
		return
	}

	curriculum, err := c.Service.CreateCourse(r.Context(), id, categoryID, payload, claims.UserID, claims.Roles, claims.FacultyID)
	if err != nil {
		writeCurriculumError(w, err)
		return
	}

	utils.JSON(w, http.StatusCreated, utils.Envelope{
		"success": true,
		"message": "course created successfully",
		"data":    curriculum,
	})
}

func (c *CurriculumController) UpdateCourse(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUintURLParam(w, r, "id", "invalid curriculum id")
	if !ok {
		return
	}
	courseID, ok := parseUintURLParam(w, r, "course_id", "invalid course id")
	if !ok {
		return
	}
	claims, ok := curriculumClaims(w, r)
	if !ok {
		return
	}

	var payload models.UpdateCurriculumCourseDetailPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json")
		return
	}

	curriculum, err := c.Service.UpdateCourse(r.Context(), id, courseID, payload, claims.Roles, claims.FacultyID)
	if err != nil {
		writeCurriculumError(w, err)
		return
	}

	utils.OK(w, curriculum)
}

func (c *CurriculumController) UpdateCurriculumCoursePlacement(w http.ResponseWriter, r *http.Request) {
	id, curriculumCourseID, ok := curriculumAndCurriculumCourseIDs(w, r)
	if !ok {
		return
	}
	claims, ok := curriculumClaims(w, r)
	if !ok {
		return
	}

	var payload models.UpdateCurriculumCoursePlacementPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json")
		return
	}

	curriculum, err := c.Service.UpdateCurriculumCoursePlacement(r.Context(), id, curriculumCourseID, payload, claims.Roles, claims.FacultyID)
	if err != nil {
		writeCurriculumError(w, err)
		return
	}

	utils.OK(w, curriculum)
}

func (c *CurriculumController) DeleteCurriculumCoursePlacement(w http.ResponseWriter, r *http.Request) {
	id, curriculumCourseID, ok := curriculumAndCurriculumCourseIDs(w, r)
	if !ok {
		return
	}
	claims, ok := curriculumClaims(w, r)
	if !ok {
		return
	}

	curriculum, err := c.Service.DeleteCurriculumCoursePlacement(r.Context(), id, curriculumCourseID, confirmImpactFromQuery(r), claims.Roles, claims.FacultyID)
	if err != nil {
		writeCurriculumError(w, err)
		return
	}

	utils.OK(w, curriculum)
}

func curriculumAndCategoryIDs(w http.ResponseWriter, r *http.Request) (uint64, uint64, bool) {
	id, ok := parseUintURLParam(w, r, "id", "invalid curriculum id")
	if !ok {
		return 0, 0, false
	}
	categoryID, ok := parseUintURLParam(w, r, "category_id", "invalid category id")
	if !ok {
		return 0, 0, false
	}
	return id, categoryID, true
}

func curriculumAndCurriculumCourseIDs(w http.ResponseWriter, r *http.Request) (uint64, uint64, bool) {
	id, ok := parseUintURLParam(w, r, "id", "invalid curriculum id")
	if !ok {
		return 0, 0, false
	}
	curriculumCourseID, ok := parseUintURLParam(w, r, "curriculum_course_id", "invalid curriculum course id")
	if !ok {
		return 0, 0, false
	}
	return id, curriculumCourseID, true
}

func parseUintURLParam(w http.ResponseWriter, r *http.Request, name string, message string) (uint64, bool) {
	value, err := strconv.ParseUint(chi.URLParam(r, name), 10, 64)
	if err != nil || value == 0 {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", message)
		return 0, false
	}
	return value, true
}

func curriculumClaims(w http.ResponseWriter, r *http.Request) (*utils.Claims, bool) {
	claims, ok := utils.ClaimsFromContext(r.Context())
	if !ok {
		utils.Error(w, http.StatusUnauthorized, "AUTH_MISSING", "missing auth")
		return nil, false
	}
	return claims, true
}

func confirmImpactFromQuery(r *http.Request) bool {
	value, err := strconv.ParseBool(r.URL.Query().Get("confirm_impact"))
	return err == nil && value
}
