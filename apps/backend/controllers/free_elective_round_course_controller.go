package controllers

import (
	"encoding/json"
	"net/http"

	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/utils"
)

func (c *FreeElectiveController) GetRoundCourse(w http.ResponseWriter, r *http.Request) {
	claims, ok := freeElectiveClaims(w, r)
	if !ok {
		return
	}
	roundID, roundCourseID, ok := freeElectiveRoundCourseIDs(w, r)
	if !ok {
		return
	}
	detail, err := c.Service.GetRoundCourse(r.Context(), claims, roundID, roundCourseID)
	if err != nil {
		writeFreeElectiveError(w, err)
		return
	}
	utils.OK(w, detail)
}

func (c *FreeElectiveController) AddRoundCourse(w http.ResponseWriter, r *http.Request) {
	claims, ok := freeElectiveClaims(w, r)
	if !ok {
		return
	}
	roundID, ok := freeElectiveID(w, r, "round_id")
	if !ok {
		return
	}
	var payload models.AddFreeElectiveRoundCoursePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json")
		return
	}
	course, err := c.Service.AddRoundCourse(r.Context(), claims, roundID, payload)
	if err != nil {
		writeFreeElectiveError(w, err)
		return
	}
	utils.JSON(w, http.StatusCreated, utils.Envelope{"success": true, "data": course})
}

func (c *FreeElectiveController) ReplaceRoundCourseCompetencies(w http.ResponseWriter, r *http.Request) {
	claims, ok := freeElectiveClaims(w, r)
	if !ok {
		return
	}
	roundID, roundCourseID, ok := freeElectiveRoundCourseIDs(w, r)
	if !ok {
		return
	}
	var payload models.ReplaceFreeElectiveRoundCourseCompetenciesPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json")
		return
	}
	detail, err := c.Service.ReplaceRoundCourseCompetencies(r.Context(), claims, roundID, roundCourseID, payload)
	if err != nil {
		writeFreeElectiveError(w, err)
		return
	}
	utils.OK(w, detail)
}

func (c *FreeElectiveController) DeleteRoundCourse(w http.ResponseWriter, r *http.Request) {
	claims, ok := freeElectiveClaims(w, r)
	if !ok {
		return
	}
	roundID, roundCourseID, ok := freeElectiveRoundCourseIDs(w, r)
	if !ok {
		return
	}
	if err := c.Service.DeleteRoundCourse(r.Context(), claims, roundID, roundCourseID); err != nil {
		writeFreeElectiveError(w, err)
		return
	}
	utils.OK(w, utils.Envelope{"deleted": true})
}

func (c *FreeElectiveController) ListRoundCourseLearners(w http.ResponseWriter, r *http.Request) {
	claims, ok := freeElectiveClaims(w, r)
	if !ok {
		return
	}
	roundID, roundCourseID, ok := freeElectiveRoundCourseIDs(w, r)
	if !ok {
		return
	}
	filters, ok := freeElectiveRoundLearnerFilters(w, r)
	if !ok {
		return
	}
	learners, err := c.Service.ListRoundCourseLearners(
		r.Context(),
		claims,
		roundID,
		roundCourseID,
		filters,
	)
	if err != nil {
		writeFreeElectiveError(w, err)
		return
	}
	utils.OK(w, learners)
}

func (c *FreeElectiveController) GetRoundCourseLearnerSummary(w http.ResponseWriter, r *http.Request) {
	claims, ok := freeElectiveClaims(w, r)
	if !ok {
		return
	}
	roundID, roundCourseID, ok := freeElectiveRoundCourseIDs(w, r)
	if !ok {
		return
	}
	filters, ok := freeElectiveRoundLearnerFilters(w, r)
	if !ok {
		return
	}
	summary, err := c.Service.GetRoundCourseLearnerSummary(
		r.Context(),
		claims,
		roundID,
		roundCourseID,
		filters,
	)
	if err != nil {
		writeFreeElectiveError(w, err)
		return
	}
	utils.OK(w, summary)
}

func (c *FreeElectiveController) GetRoundCourseEnrollments(w http.ResponseWriter, r *http.Request) {
	claims, ok := freeElectiveClaims(w, r)
	if !ok {
		return
	}
	roundID, roundCourseID, ok := freeElectiveRoundCourseIDs(w, r)
	if !ok {
		return
	}
	enrollments, err := c.Service.GetRoundCourseEnrollments(r.Context(), claims, roundID, roundCourseID)
	if err != nil {
		writeFreeElectiveError(w, err)
		return
	}
	utils.OK(w, enrollments)
}

func (c *FreeElectiveController) AddRoundCourseEnrollments(w http.ResponseWriter, r *http.Request) {
	claims, ok := freeElectiveClaims(w, r)
	if !ok {
		return
	}
	roundID, roundCourseID, ok := freeElectiveRoundCourseIDs(w, r)
	if !ok {
		return
	}
	var payload models.AddFreeElectiveRoundEnrollmentsPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json")
		return
	}
	enrollments, err := c.Service.AddRoundCourseEnrollments(r.Context(), claims, roundID, roundCourseID, payload)
	if err != nil {
		writeFreeElectiveError(w, err)
		return
	}
	utils.OK(w, enrollments)
}

func (c *FreeElectiveController) AddAllRoundCourseLearners(w http.ResponseWriter, r *http.Request) {
	claims, ok := freeElectiveClaims(w, r)
	if !ok {
		return
	}
	roundID, roundCourseID, ok := freeElectiveRoundCourseIDs(w, r)
	if !ok {
		return
	}
	filters, ok := freeElectiveRoundLearnerFilters(w, r)
	if !ok {
		return
	}
	enrollments, err := c.Service.AddAllRoundCourseLearners(
		r.Context(),
		claims,
		roundID,
		roundCourseID,
		filters,
	)
	if err != nil {
		writeFreeElectiveError(w, err)
		return
	}
	utils.OK(w, enrollments)
}

func (c *FreeElectiveController) DeleteRoundCourseEnrollment(w http.ResponseWriter, r *http.Request) {
	claims, ok := freeElectiveClaims(w, r)
	if !ok {
		return
	}
	roundID, roundCourseID, ok := freeElectiveRoundCourseIDs(w, r)
	if !ok {
		return
	}
	roundCourseEnrollmentID, ok := freeElectiveID(w, r, "round_course_enrollment_id")
	if !ok {
		return
	}
	if err := c.Service.DeleteRoundCourseEnrollment(
		r.Context(),
		claims,
		roundID,
		roundCourseID,
		roundCourseEnrollmentID,
	); err != nil {
		writeFreeElectiveError(w, err)
		return
	}
	utils.OK(w, utils.Envelope{"deleted": true})
}

func (c *FreeElectiveController) DeleteRoundCourseEnrollments(w http.ResponseWriter, r *http.Request) {
	claims, ok := freeElectiveClaims(w, r)
	if !ok {
		return
	}
	roundID, roundCourseID, ok := freeElectiveRoundCourseIDs(w, r)
	if !ok {
		return
	}
	var payload models.DeleteFreeElectiveRoundEnrollmentsPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json")
		return
	}
	deletedCount, err := c.Service.DeleteRoundCourseEnrollments(
		r.Context(),
		claims,
		roundID,
		roundCourseID,
		payload.RoundCourseEnrollmentIDs,
	)
	if err != nil {
		writeFreeElectiveError(w, err)
		return
	}
	utils.OK(w, utils.Envelope{
		"deleted":       true,
		"deleted_count": deletedCount,
	})
}

func (c *FreeElectiveController) UpsertRoundCourseGrade(w http.ResponseWriter, r *http.Request) {
	claims, ok := freeElectiveClaims(w, r)
	if !ok {
		return
	}
	roundID, roundCourseID, ok := freeElectiveRoundCourseIDs(w, r)
	if !ok {
		return
	}
	roundCourseEnrollmentID, ok := freeElectiveID(w, r, "round_course_enrollment_id")
	if !ok {
		return
	}
	var payload models.UpsertFreeElectiveRoundGradePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json")
		return
	}
	enrollments, err := c.Service.UpsertRoundCourseGrade(
		r.Context(),
		claims,
		roundID,
		roundCourseID,
		roundCourseEnrollmentID,
		payload,
	)
	if err != nil {
		writeFreeElectiveError(w, err)
		return
	}
	utils.OK(w, enrollments)
}

func freeElectiveRoundCourseIDs(w http.ResponseWriter, r *http.Request) (uint64, uint64, bool) {
	roundID, ok := freeElectiveID(w, r, "round_id")
	if !ok {
		return 0, 0, false
	}
	roundCourseID, ok := freeElectiveID(w, r, "round_course_id")
	if !ok {
		return 0, 0, false
	}
	return roundID, roundCourseID, true
}
