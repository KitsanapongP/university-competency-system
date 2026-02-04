package utils

import (
	"encoding/json"
	"net/http"
)

type Envelope map[string]any

func JSON(w http.ResponseWriter, status int, data Envelope) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func OK(w http.ResponseWriter, data any) {
	JSON(w, http.StatusOK, Envelope{"success": true, "data": data})
}

func Error(w http.ResponseWriter, status int, code string, message string) {
	JSON(w, status, Envelope{
		"success": false,
		"error": Envelope{
			"code":    code,
			"message": message,
		},
	})
}
