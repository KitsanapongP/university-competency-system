package controllers

import (
	"net/http"

	"github.com/spw32767/university-competency-system-backend/utils"
)

func Health(w http.ResponseWriter, r *http.Request) {
	utils.OK(w, map[string]any{"status": "ok"})
}
