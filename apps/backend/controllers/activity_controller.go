package controllers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-sql-driver/mysql"
	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/services"
	"github.com/spw32767/university-competency-system-backend/utils"
)

type ActivityController struct {
	Service *services.ActivityService
}

func (c *ActivityController) GetAll(w http.ResponseWriter, r *http.Request) {
	claims, ok := activityClaims(w, r)
	if !ok {
		return
	}
	filters, ok := activityFiltersFromQuery(w, r)
	if !ok {
		return
	}

	activities, err := c.Service.GetActivities(r.Context(), filters, claims.Roles, claims.FacultyID)
	if err != nil {
		writeActivityError(w, err)
		return
	}
	utils.OK(w, activities)
}

func (c *ActivityController) GetByID(w http.ResponseWriter, r *http.Request) {
	activityID, ok := parseUintURLParam(w, r, "activity_id", "invalid activity id")
	if !ok {
		return
	}
	claims, ok := activityClaims(w, r)
	if !ok {
		return
	}

	activity, err := c.Service.GetActivityByID(r.Context(), activityID, claims.Roles, claims.FacultyID)
	if err != nil {
		writeActivityError(w, err)
		return
	}
	utils.OK(w, activity)
}

func (c *ActivityController) GetOptions(w http.ResponseWriter, r *http.Request) {
	claims, ok := activityClaims(w, r)
	if !ok {
		return
	}
	filters, ok := activityFiltersFromQuery(w, r)
	if !ok {
		return
	}

	options, err := c.Service.GetActivityOptions(r.Context(), filters, claims.Roles, claims.FacultyID)
	if err != nil {
		writeActivityError(w, err)
		return
	}
	utils.OK(w, options)
}

func (c *ActivityController) Create(w http.ResponseWriter, r *http.Request) {
	claims, ok := activityClaims(w, r)
	if !ok {
		return
	}

	var payload models.UpsertActivityPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json")
		return
	}

	activity, err := c.Service.CreateActivity(r.Context(), payload, claims.UserID, claims.Roles, claims.FacultyID)
	if err != nil {
		writeActivityError(w, err)
		return
	}

	utils.JSON(w, http.StatusCreated, utils.Envelope{
		"success": true,
		"message": "activity created successfully",
		"data":    activity,
	})
}

func (c *ActivityController) Update(w http.ResponseWriter, r *http.Request) {
	activityID, ok := parseUintURLParam(w, r, "activity_id", "invalid activity id")
	if !ok {
		return
	}
	claims, ok := activityClaims(w, r)
	if !ok {
		return
	}

	var payload models.UpsertActivityPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json")
		return
	}

	activity, err := c.Service.UpdateActivity(r.Context(), activityID, payload, claims.Roles, claims.FacultyID)
	if err != nil {
		writeActivityError(w, err)
		return
	}
	utils.OK(w, activity)
}

func (c *ActivityController) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	activityID, ok := parseUintURLParam(w, r, "activity_id", "invalid activity id")
	if !ok {
		return
	}
	claims, ok := activityClaims(w, r)
	if !ok {
		return
	}

	var payload models.UpdateActivityStatusPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json")
		return
	}

	activity, err := c.Service.UpdateActivityStatus(r.Context(), activityID, payload, claims.Roles, claims.FacultyID)
	if err != nil {
		writeActivityError(w, err)
		return
	}
	utils.OK(w, activity)
}

func (c *ActivityController) Delete(w http.ResponseWriter, r *http.Request) {
	activityID, ok := parseUintURLParam(w, r, "activity_id", "invalid activity id")
	if !ok {
		return
	}
	claims, ok := activityClaims(w, r)
	if !ok {
		return
	}

	if err := c.Service.DeleteActivity(r.Context(), activityID, claims.Roles, claims.FacultyID); err != nil {
		writeActivityError(w, err)
		return
	}
	utils.OK(w, utils.Envelope{
		"activity_id": activityID,
		"deleted":     true,
	})
}

func activityFiltersFromQuery(w http.ResponseWriter, r *http.Request) (models.ActivityFilters, bool) {
	var filters models.ActivityFilters
	facultyID, ok := optionalUintQuery(w, r, "faculty_id")
	if !ok {
		return filters, false
	}
	filters.FacultyID = facultyID
	filters.Status = strings.ToLower(strings.TrimSpace(r.URL.Query().Get("status")))
	filters.Category = strings.TrimSpace(r.URL.Query().Get("category"))
	filters.Type = strings.TrimSpace(r.URL.Query().Get("type"))
	filters.Search = strings.TrimSpace(r.URL.Query().Get("search"))

	if filters.Status != "" && !isValidActivityStatus(filters.Status) {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "status is invalid")
		return filters, false
	}
	return filters, true
}

func isValidActivityStatus(status string) bool {
	switch status {
	case "draft", "published", "closed", "cancelled":
		return true
	default:
		return false
	}
}

func activityClaims(w http.ResponseWriter, r *http.Request) (*utils.Claims, bool) {
	claims, ok := utils.ClaimsFromContext(r.Context())
	if !ok {
		utils.Error(w, http.StatusUnauthorized, "AUTH_MISSING", "missing auth")
		return nil, false
	}
	return claims, true
}

func writeActivityError(w http.ResponseWriter, err error) {
	var validationErr services.ActivityValidationError
	if errors.As(err, &validationErr) {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", validationErr.Message)
		return
	}

	var conflictErr services.ActivityConflictError
	if errors.As(err, &conflictErr) {
		code := conflictErr.Code
		if code == "" {
			code = "CONFLICT"
		}
		utils.Error(w, http.StatusConflict, code, conflictErr.Message)
		return
	}

	if errors.Is(err, services.ErrActivityForbidden) {
		utils.Error(w, http.StatusForbidden, "FORBIDDEN", "insufficient activity scope")
		return
	}

	if errors.Is(err, services.ErrActivityNotFound) {
		utils.Error(w, http.StatusNotFound, "NOT_FOUND", "activity not found")
		return
	}

	var mysqlErr *mysql.MySQLError
	if errors.As(err, &mysqlErr) && mysqlErr.Number == 1062 {
		message := "activity already exists"
		if strings.Contains(mysqlErr.Message, "uq_act_activities_open_faculty_code_name") {
			message = "activity code and Thai name already exist in this faculty"
		}
		utils.Error(w, http.StatusConflict, "DUPLICATE", message)
		return
	}

	if errors.Is(err, strconv.ErrSyntax) {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request")
		return
	}

	utils.Error(w, http.StatusInternalServerError, "SERVER_ERROR", "activity operation failed")
}
