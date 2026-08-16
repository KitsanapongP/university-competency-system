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

type ActivitySessionWorkspaceController struct {
	Service *services.ActivitySessionWorkspaceService
}

func (c *ActivitySessionWorkspaceController) GetSession(w http.ResponseWriter, r *http.Request) {
	sessionID, claims, ok := workspaceRequestContext(w, r)
	if !ok {
		return
	}
	item, err := c.Service.GetSession(r.Context(), sessionID, claims.Roles, claims.FacultyID, claims.UserID)
	if err != nil {
		writeActivitySessionError(w, err)
		return
	}
	utils.OK(w, item)
}

func (c *ActivitySessionWorkspaceController) GetParticipants(w http.ResponseWriter, r *http.Request) {
	sessionID, claims, ok := workspaceRequestContext(w, r)
	if !ok {
		return
	}
	items, err := c.Service.GetParticipants(r.Context(), sessionID, claims.Roles, claims.FacultyID, claims.UserID)
	if err != nil {
		writeActivitySessionError(w, err)
		return
	}
	utils.OK(w, items)
}

func (c *ActivitySessionWorkspaceController) SearchWalkInCandidates(w http.ResponseWriter, r *http.Request) {
	sessionID, claims, ok := workspaceRequestContext(w, r)
	if !ok {
		return
	}
	items, err := c.Service.SearchWalkInCandidates(r.Context(), sessionID, strings.TrimSpace(r.URL.Query().Get("q")), claims.Roles, claims.FacultyID, claims.UserID)
	if err != nil {
		writeActivitySessionError(w, err)
		return
	}
	utils.OK(w, items)
}

func (c *ActivitySessionWorkspaceController) AddWalkIn(w http.ResponseWriter, r *http.Request) {
	sessionID, claims, ok := workspaceRequestContext(w, r)
	if !ok {
		return
	}
	var payload models.AddSessionWalkInPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json")
		return
	}
	if err := c.Service.AddWalkIn(r.Context(), sessionID, payload, claims.Roles, claims.FacultyID, claims.UserID); err != nil {
		writeActivitySessionError(w, err)
		return
	}
	utils.OK(w, utils.Envelope{"session_id": sessionID, "walk_in_added": true})
}

func (c *ActivitySessionWorkspaceController) UpsertAttendance(w http.ResponseWriter, r *http.Request) {
	sessionID, claims, ok := workspaceRequestContext(w, r)
	if !ok {
		return
	}
	personID, err := strconv.ParseUint(chi.URLParam(r, "person_id"), 10, 64)
	if err != nil || personID == 0 {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid person id")
		return
	}
	var payload models.UpsertSessionAttendancePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json")
		return
	}
	if err := c.Service.UpsertAttendance(r.Context(), sessionID, personID, payload, claims.Roles, claims.FacultyID, claims.UserID); err != nil {
		writeActivitySessionError(w, err)
		return
	}
	utils.OK(w, utils.Envelope{"session_id": sessionID, "person_id": personID, "saved": true})
}

func (c *ActivitySessionWorkspaceController) MarkUnrecordedAbsent(w http.ResponseWriter, r *http.Request) {
	sessionID, claims, ok := workspaceRequestContext(w, r)
	if !ok {
		return
	}
	count, err := c.Service.MarkUnrecordedAbsent(r.Context(), sessionID, claims.Roles, claims.FacultyID, claims.UserID)
	if err != nil {
		writeActivitySessionError(w, err)
		return
	}
	utils.OK(w, utils.Envelope{"session_id": sessionID, "marked_absent": count})
}

func (c *ActivitySessionWorkspaceController) GetScores(w http.ResponseWriter, r *http.Request) {
	sessionID, claims, ok := workspaceRequestContext(w, r)
	if !ok {
		return
	}
	items, err := c.Service.GetScores(r.Context(), sessionID, claims.Roles, claims.FacultyID, claims.UserID)
	if err != nil {
		writeActivitySessionError(w, err)
		return
	}
	utils.OK(w, items)
}

func (c *ActivitySessionWorkspaceController) SaveScores(w http.ResponseWriter, r *http.Request) {
	sessionID, claims, ok := workspaceRequestContext(w, r)
	if !ok {
		return
	}
	var payload models.ReplaceSessionScoresPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json")
		return
	}
	if err := c.Service.SaveScores(r.Context(), sessionID, payload, claims.Roles, claims.FacultyID, claims.UserID); err != nil {
		writeActivitySessionError(w, err)
		return
	}
	utils.OK(w, utils.Envelope{"session_id": sessionID, "saved": true})
}

func (c *ActivitySessionWorkspaceController) FinalizeScores(w http.ResponseWriter, r *http.Request) {
	sessionID, claims, ok := workspaceRequestContext(w, r)
	if !ok {
		return
	}
	if err := c.Service.FinalizeScores(r.Context(), sessionID, claims.Roles, claims.FacultyID, claims.UserID); err != nil {
		writeActivitySessionError(w, err)
		return
	}
	utils.OK(w, utils.Envelope{"session_id": sessionID, "scores_finalized": true})
}

func (c *ActivitySessionWorkspaceController) OpenCorrection(w http.ResponseWriter, r *http.Request) {
	sessionID, claims, ok := workspaceRequestContext(w, r)
	if !ok {
		return
	}
	var payload models.OpenSessionScoreCorrectionPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json")
		return
	}
	if err := c.Service.OpenCorrection(r.Context(), sessionID, payload, claims.Roles, claims.FacultyID, claims.UserID); err != nil {
		writeActivitySessionError(w, err)
		return
	}
	utils.OK(w, utils.Envelope{"session_id": sessionID, "correction_opened": true})
}

func (c *ActivitySessionWorkspaceController) GetMySessions(w http.ResponseWriter, r *http.Request) {
	claims, ok := activitySessionClaims(w, r)
	if !ok {
		return
	}
	items, err := c.Service.GetMySessions(r.Context(), claims.UserID)
	if err != nil {
		writeActivitySessionError(w, err)
		return
	}
	utils.OK(w, items)
}

func workspaceRequestContext(w http.ResponseWriter, r *http.Request) (uint64, *utils.Claims, bool) {
	sessionID, ok := parseUintURLParam(w, r, "session_id", "invalid session id")
	if !ok {
		return 0, nil, false
	}
	claims, ok := activitySessionClaims(w, r)
	if !ok {
		return 0, nil, false
	}
	return sessionID, claims, true
}
