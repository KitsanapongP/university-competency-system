package controllers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/services"
)

type CurriculumController struct {
	Service *services.CurriculumService
}

// GetAll handles GET /curricula
func (c *CurriculumController) GetAll(w http.ResponseWriter, r *http.Request) {
	curricula, err := c.Service.GetActiveCurriculums(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    curricula,
	})
}

// GetByID handles GET /curricula/{id}
func (c *CurriculumController) GetByID(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	curriculum, err := c.Service.GetCurriculumByID(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    curriculum,
	})
}

// Create handles POST /curricula
func (c *CurriculumController) Create(w http.ResponseWriter, r *http.Request) {
	var payload models.CreateCurriculumPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	createdCurriculum, err := c.Service.CreateCurriculum(r.Context(), payload)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Curriculum created successfully",
		"data":    createdCurriculum,
	})
}
