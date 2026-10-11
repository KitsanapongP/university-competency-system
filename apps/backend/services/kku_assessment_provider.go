package services

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

func kkuAPIHTTPError(response *http.Response) error {
	fallback := apiHTTPError(response)
	if response.StatusCode != http.StatusUnauthorized && response.StatusCode != http.StatusForbidden {
		return fallback
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, 8193))
	if err != nil || len(body) > 8192 {
		return fallback
	}
	return kkuAPIMessageError(body, response.StatusCode)
}

// Only documented messages are mapped; arbitrary gateway text is never retained.
func kkuAPIMessageError(raw []byte, status int) AssessmentProviderError {
	failure := AssessmentProviderError{Code: "provider_request_rejected", HTTPStatus: status}
	if status == http.StatusUnauthorized || status == http.StatusForbidden {
		failure.Code = "provider_authentication"
	}
	var envelope struct {
		Message string          `json:"message"`
		Error   json.RawMessage `json:"error"`
	}
	var message string
	if json.Unmarshal(raw, &message) != nil {
		if json.Unmarshal(raw, &envelope) == nil {
			message = envelope.Message
			if len(envelope.Error) > 0 && string(envelope.Error) != "null" {
				return kkuAPIMessageError(envelope.Error, status)
			}
		} else {
			message = string(raw)
		}
	}
	switch strings.ToLower(strings.TrimSpace(message)) {
	case "invalid api key":
		failure.Code = "provider_authentication"
	case "invalid model":
		failure.Code = "provider_model_unavailable"
	case "this model reached daily limit.", "this model reached daily limit":
		failure.Code = "provider_token_quota_exhausted"
	}
	return failure
}
