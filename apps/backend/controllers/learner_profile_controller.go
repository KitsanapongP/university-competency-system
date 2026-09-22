package controllers

import (
	"errors"
	"net/http"

	"github.com/spw32767/university-competency-system-backend/services"
	"github.com/spw32767/university-competency-system-backend/utils"
)

type LearnerProfileController struct {
	Service *services.LearnerProfileService
}

func (h *LearnerProfileController) GetAcademicProfile(w http.ResponseWriter, r *http.Request) {
	claims, ok := utils.ClaimsFromContext(r.Context())
	if !ok {
		utils.Error(w, http.StatusUnauthorized, "AUTH_MISSING", "missing auth")
		return
	}

	profile, err := h.Service.GetAcademicProfile(r.Context(), claims.UserID)
	if err != nil {
		if errors.Is(err, services.ErrLearnerProfileNotFound) {
			utils.Error(w, http.StatusNotFound, "LEARNER_PROFILE_NOT_FOUND", "learner profile not found")
			return
		}
		utils.Error(w, http.StatusInternalServerError, "SERVER_ERROR", "could not load learner academic profile")
		return
	}

	utils.OK(w, profile)
}
