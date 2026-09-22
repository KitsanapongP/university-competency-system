package controllers

import (
	"encoding/json"
	"net/http"

	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/utils"
)

func (c *FreeElectiveController) ListRounds(w http.ResponseWriter, r *http.Request) {
	claims, ok := freeElectiveClaims(w, r)
	if !ok {
		return
	}
	filters, ok := freeElectiveRoundFilters(w, r)
	if !ok {
		return
	}
	items, err := c.Service.ListRounds(r.Context(), claims, filters)
	if err != nil {
		writeFreeElectiveError(w, err)
		return
	}
	utils.OK(w, items)
}

func (c *FreeElectiveController) GetRound(w http.ResponseWriter, r *http.Request) {
	claims, ok := freeElectiveClaims(w, r)
	if !ok {
		return
	}
	roundID, ok := freeElectiveID(w, r, "round_id")
	if !ok {
		return
	}
	detail, err := c.Service.GetRound(r.Context(), claims, roundID)
	if err != nil {
		writeFreeElectiveError(w, err)
		return
	}
	utils.OK(w, detail)
}

func (c *FreeElectiveController) RecalculateRoundScores(w http.ResponseWriter, r *http.Request) {
	claims, ok := freeElectiveClaims(w, r)
	if !ok {
		return
	}
	roundID, ok := freeElectiveID(w, r, "round_id")
	if !ok {
		return
	}
	detail, err := c.Service.RecalculateRoundScores(r.Context(), claims, roundID)
	if err != nil {
		writeFreeElectiveError(w, err)
		return
	}
	utils.OK(w, detail)
}

func (c *FreeElectiveController) PreviewRound(w http.ResponseWriter, r *http.Request) {
	claims, ok := freeElectiveClaims(w, r)
	if !ok {
		return
	}
	var payload models.PreviewFreeElectiveRoundPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json")
		return
	}
	preview, err := c.Service.PreviewRound(r.Context(), claims, payload)
	if err != nil {
		writeFreeElectiveError(w, err)
		return
	}
	utils.OK(w, preview)
}

func (c *FreeElectiveController) CreateRound(w http.ResponseWriter, r *http.Request) {
	claims, ok := freeElectiveClaims(w, r)
	if !ok {
		return
	}
	var payload models.CreateFreeElectiveRoundPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json")
		return
	}
	detail, err := c.Service.CreateRound(r.Context(), claims, payload)
	if err != nil {
		writeFreeElectiveError(w, err)
		return
	}
	utils.JSON(w, http.StatusCreated, utils.Envelope{"success": true, "data": detail})
}

func (c *FreeElectiveController) DuplicateRound(w http.ResponseWriter, r *http.Request) {
	claims, ok := freeElectiveClaims(w, r)
	if !ok {
		return
	}
	roundID, ok := freeElectiveID(w, r, "round_id")
	if !ok {
		return
	}
	var payload models.DuplicateFreeElectiveRoundPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json")
		return
	}
	detail, err := c.Service.DuplicateRound(r.Context(), claims, roundID, payload)
	if err != nil {
		writeFreeElectiveError(w, err)
		return
	}
	utils.JSON(w, http.StatusCreated, utils.Envelope{"success": true, "data": detail})
}

func (c *FreeElectiveController) UpdateRoundStatus(w http.ResponseWriter, r *http.Request) {
	claims, ok := freeElectiveClaims(w, r)
	if !ok {
		return
	}
	roundID, ok := freeElectiveID(w, r, "round_id")
	if !ok {
		return
	}
	var payload models.UpdateFreeElectiveRoundStatusPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json")
		return
	}
	detail, err := c.Service.UpdateRoundStatus(r.Context(), claims, roundID, payload.Status)
	if err != nil {
		writeFreeElectiveError(w, err)
		return
	}
	utils.OK(w, detail)
}

func freeElectiveRoundFilters(w http.ResponseWriter, r *http.Request) (models.FreeElectiveRoundFilters, bool) {
	var filters models.FreeElectiveRoundFilters
	var ok bool
	if filters.FacultyID, ok = freeElectiveOptionalUintQuery(w, r, "faculty_id"); !ok {
		return filters, false
	}
	if filters.AcademicYearBE, ok = freeElectiveOptionalUintQuery(w, r, "academic_year_be"); !ok {
		return filters, false
	}
	if filters.Semester, ok = freeElectiveOptionalUintQuery(w, r, "semester"); !ok {
		return filters, false
	}
	filters.Status = r.URL.Query().Get("status")
	return filters, true
}
