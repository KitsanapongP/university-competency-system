package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
)

type AssessmentProvider interface {
	Generate(context.Context, string, string, json.RawMessage) ([]byte, error)
}

type StreamingAssessmentProvider interface {
	GenerateWithProgress(
		context.Context,
		string,
		string,
		json.RawMessage,
		func() error,
	) ([]byte, error)
}

type AssessmentProviderError struct {
	Code      string
	Retryable bool
	Cause     error
}

func (e AssessmentProviderError) Error() string {
	if e.Cause == nil {
		return fmt.Sprintf("assessment provider error: %s", e.Code)
	}
	return fmt.Sprintf("assessment provider error: %s: %v", e.Code, e.Cause)
}

func (e AssessmentProviderError) Unwrap() error {
	return e.Cause
}

var ErrAssessmentProviderUnavailable = errors.New("assessment provider unavailable")
