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

type ActivitySessionController struct {
	Service *services.ActivitySessionService
}

func (c *ActivitySessionController) GetByActivity(w http.ResponseWriter, r *http.Request) {
	activityID, ok := parseUintURLParam(w, r, "activity_id", "invalid activity id")
	if !ok {
		return
	}
	claims, ok := activitySessionClaims(w, r)
	if !ok {
		return
	}

	sessions, err := c.Service.GetSessionsByActivity(r.Context(), activityID, claims.Roles, claims.FacultyID)
	if err != nil {
		writeActivitySessionError(w, err)
		return
	}
	utils.OK(w, sessions)
}

func (c *ActivitySessionController) Create(w http.ResponseWriter, r *http.Request) {
	activityID, ok := parseUintURLParam(w, r, "activity_id", "invalid activity id")
	if !ok {
		return
	}
	claims, ok := activitySessionClaims(w, r)
	if !ok {
		return
	}

	var payload models.UpsertActivitySessionPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json")
		return
	}

	session, err := c.Service.CreateSession(r.Context(), activityID, payload, claims.Roles, claims.FacultyID)
	if err != nil {
		writeActivitySessionError(w, err)
		return
	}
	utils.JSON(w, http.StatusCreated, utils.Envelope{
		"success": true,
		"message": "activity session created successfully",
		"data":    session,
	})
}

func (c *ActivitySessionController) GetByID(w http.ResponseWriter, r *http.Request) {
	sessionID, ok := parseUintURLParam(w, r, "session_id", "invalid session id")
	if !ok {
		return
	}
	claims, ok := activitySessionClaims(w, r)
	if !ok {
		return
	}

	session, err := c.Service.GetSessionByID(r.Context(), sessionID, claims.Roles, claims.FacultyID)
	if err != nil {
		writeActivitySessionError(w, err)
		return
	}
	utils.OK(w, session)
}

func (c *ActivitySessionController) Update(w http.ResponseWriter, r *http.Request) {
	sessionID, ok := parseUintURLParam(w, r, "session_id", "invalid session id")
	if !ok {
		return
	}
	claims, ok := activitySessionClaims(w, r)
	if !ok {
		return
	}

	var payload models.UpsertActivitySessionPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json")
		return
	}

	session, err := c.Service.UpdateSession(r.Context(), sessionID, payload, claims.Roles, claims.FacultyID)
	if err != nil {
		writeActivitySessionError(w, err)
		return
	}
	utils.OK(w, session)
}

func (c *ActivitySessionController) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	sessionID, ok := parseUintURLParam(w, r, "session_id", "invalid session id")
	if !ok {
		return
	}
	claims, ok := activitySessionClaims(w, r)
	if !ok {
		return
	}

	var payload models.UpdateActivitySessionStatusPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json")
		return
	}

	session, err := c.Service.UpdateSessionStatus(r.Context(), sessionID, payload, claims.Roles, claims.FacultyID)
	if err != nil {
		writeActivitySessionError(w, err)
		return
	}
	utils.OK(w, session)
}

func (c *ActivitySessionController) Finalize(w http.ResponseWriter, r *http.Request) {
	sessionID, ok := parseUintURLParam(w, r, "session_id", "invalid session id")
	if !ok {
		return
	}
	claims, ok := activitySessionClaims(w, r)
	if !ok {
		return
	}

	session, err := c.Service.FinalizeSession(r.Context(), sessionID, claims.Roles, claims.FacultyID, claims.UserID)
	if err != nil {
		writeActivitySessionError(w, err)
		return
	}
	utils.OK(w, session)
}

func (c *ActivitySessionController) Delete(w http.ResponseWriter, r *http.Request) {
	sessionID, ok := parseUintURLParam(w, r, "session_id", "invalid session id")
	if !ok {
		return
	}
	claims, ok := activitySessionClaims(w, r)
	if !ok {
		return
	}

	if err := c.Service.DeleteSession(r.Context(), sessionID, claims.Roles, claims.FacultyID); err != nil {
		writeActivitySessionError(w, err)
		return
	}
	utils.OK(w, utils.Envelope{
		"session_id": sessionID,
		"deleted":    true,
	})
}

func (c *ActivitySessionController) ReplaceAssignments(w http.ResponseWriter, r *http.Request) {
	sessionID, ok := parseUintURLParam(w, r, "session_id", "invalid session id")
	if !ok {
		return
	}
	claims, ok := activitySessionClaims(w, r)
	if !ok {
		return
	}

	var payload models.ReplaceSessionAssignmentsPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json")
		return
	}

	assignments, err := c.Service.ReplaceAssignments(r.Context(), sessionID, payload, claims.Roles, claims.FacultyID, claims.UserID)
	if err != nil {
		writeActivitySessionError(w, err)
		return
	}
	utils.OK(w, assignments)
}

func (c *ActivitySessionController) ReplaceCompetencies(w http.ResponseWriter, r *http.Request) {
	sessionID, ok := parseUintURLParam(w, r, "session_id", "invalid session id")
	if !ok {
		return
	}
	claims, ok := activitySessionClaims(w, r)
	if !ok {
		return
	}

	var payload models.ReplaceSessionCompetenciesPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json")
		return
	}

	competencies, err := c.Service.ReplaceCompetencies(r.Context(), sessionID, payload, claims.Roles, claims.FacultyID)
	if err != nil {
		writeActivitySessionError(w, err)
		return
	}
	utils.OK(w, competencies)
}

func (c *ActivitySessionController) GetAssigneeOptions(w http.ResponseWriter, r *http.Request) {
	activityID, ok := parseUintURLParam(w, r, "activity_id", "invalid activity id")
	if !ok {
		return
	}
	claims, ok := activitySessionClaims(w, r)
	if !ok {
		return
	}

	options, err := c.Service.GetAssigneeOptions(r.Context(), activityID, claims.Roles, claims.FacultyID)
	if err != nil {
		writeActivitySessionError(w, err)
		return
	}
	utils.OK(w, options)
}

func activitySessionClaims(w http.ResponseWriter, r *http.Request) (*utils.Claims, bool) {
	claims, ok := utils.ClaimsFromContext(r.Context())
	if !ok {
		utils.Error(w, http.StatusUnauthorized, "AUTH_MISSING", "missing auth")
		return nil, false
	}
	return claims, true
}

func writeActivitySessionError(w http.ResponseWriter, err error) {
	var validationErr services.ActivitySessionValidationError
	if errors.As(err, &validationErr) {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", validationErr.Message)
		return
	}

	var conflictErr services.ActivitySessionConflictError
	if errors.As(err, &conflictErr) {
		code := conflictErr.Code
		if code == "" {
			code = "CONFLICT"
		}
		utils.Error(w, http.StatusConflict, code, conflictErr.Message)
		return
	}

	if errors.Is(err, services.ErrActivitySessionForbidden) || errors.Is(err, services.ErrActivityForbidden) {
		utils.Error(w, http.StatusForbidden, "FORBIDDEN", "insufficient activity session scope")
		return
	}

	if errors.Is(err, services.ErrActivitySessionNotFound) {
		utils.Error(w, http.StatusNotFound, "NOT_FOUND", "activity session not found")
		return
	}

	if errors.Is(err, services.ErrActivityNotFound) {
		utils.Error(w, http.StatusNotFound, "NOT_FOUND", "activity not found")
		return
	}

	var mysqlErr *mysql.MySQLError
	if errors.As(err, &mysqlErr) && mysqlErr.Number == 1062 {
		message := "activity session already exists"
		if strings.Contains(mysqlErr.Message, "uq_activity_session_no") {
			message = "session number already exists in this activity"
		}
		if strings.Contains(mysqlErr.Message, "uq_session_user_assignment_role") {
			message = "assignee role already exists in this session"
		}
		if strings.Contains(mysqlErr.Message, "uq_session_competency") {
			message = "competency already exists in this session"
		}
		if strings.Contains(mysqlErr.Message, "uq_score_session_correction_open") {
			message = "an open score correction already exists for this session"
		}
		utils.Error(w, http.StatusConflict, "DUPLICATE", message)
		return
	}

	if errors.Is(err, strconv.ErrSyntax) {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request")
		return
	}

	utils.Error(w, http.StatusInternalServerError, "SERVER_ERROR", "activity session operation failed")
}
