package services

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

const assessmentOllamaMaxResponseBytes = 1 << 20

// DefaultAssessmentModel returns the model version included in assessment source hashes.
func DefaultAssessmentModel() string {
	return assessmentModel
}

type OllamaAssessmentProvider struct {
	BaseURL       string
	Model         string
	Timeout       time.Duration
	KeepAlive     string
	Think         bool
	OutputTokens  int
	ContextTokens int
	HTTPClient    *http.Client
}

func NewOllamaAssessmentProvider(baseURL, model string, timeout time.Duration, keepAlive string, think bool, outputTokens int, contextTokens ...int) *OllamaAssessmentProvider {
	if strings.TrimSpace(baseURL) == "" {
		baseURL = "http://127.0.0.1:11434"
	}
	if strings.TrimSpace(model) == "" {
		model = "qwen3:4b"
	}
	if timeout <= 0 {
		timeout = 120 * time.Second
	}
	if strings.TrimSpace(keepAlive) == "" {
		keepAlive = "5m"
	}
	contextLimit := 4096
	if len(contextTokens) > 0 && contextTokens[0] > 0 {
		contextLimit = contextTokens[0]
	}
	return &OllamaAssessmentProvider{
		BaseURL:       strings.TrimRight(strings.TrimSpace(baseURL), "/"),
		Model:         strings.TrimSpace(model),
		Timeout:       timeout,
		KeepAlive:     keepAlive,
		Think:         think,
		OutputTokens:  outputTokens,
		ContextTokens: contextLimit,
		HTTPClient:    &http.Client{},
	}
}

func ResolveOllamaModelDigest(ctx context.Context, baseURL, modelName string) (string, error) {
	if strings.TrimSpace(baseURL) == "" || strings.TrimSpace(modelName) == "" {
		return "", AssessmentProviderError{Code: "invalid_provider_request", Retryable: false}
	}
	requestContext, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	request, err := http.NewRequestWithContext(requestContext, http.MethodGet, strings.TrimRight(baseURL, "/")+"/api/tags", nil)
	if err != nil {
		return "", AssessmentProviderError{Code: "invalid_provider_url", Retryable: false}
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return "", AssessmentProviderError{Code: "provider_unavailable", Retryable: true}
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return "", AssessmentProviderError{Code: "provider_model_list_failed", Retryable: response.StatusCode >= http.StatusInternalServerError}
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, assessmentOllamaMaxResponseBytes+1))
	if err != nil || len(body) > assessmentOllamaMaxResponseBytes {
		return "", AssessmentProviderError{Code: "provider_model_list_failed", Retryable: true}
	}
	var result ollamaTagsResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return "", AssessmentProviderError{Code: "provider_invalid_response", Retryable: false}
	}
	for _, model := range result.Models {
		if model.Name == modelName && strings.TrimSpace(model.Digest) != "" {
			return model.Digest, nil
		}
	}
	return "", AssessmentProviderError{Code: "model_not_found", Retryable: false}
}

func (p *OllamaAssessmentProvider) Generate(
	ctx context.Context,
	systemPrompt string,
	userPrompt string,
	schema json.RawMessage,
) ([]byte, error) {
	if p == nil || strings.TrimSpace(p.BaseURL) == "" || strings.TrimSpace(p.Model) == "" ||
		strings.TrimSpace(systemPrompt) == "" || strings.TrimSpace(userPrompt) == "" || !json.Valid(schema) {
		return nil, AssessmentProviderError{Code: "invalid_provider_request", Retryable: false}
	}
	client := p.HTTPClient
	if client == nil {
		client = http.DefaultClient
	}
	timeout := p.Timeout
	if timeout <= 0 {
		timeout = 120 * time.Second
	}
	requestContext, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	body, err := json.Marshal(ollamaGenerateRequest{
		Model:     p.Model,
		System:    systemPrompt,
		Prompt:    userPrompt,
		Format:    schema,
		Stream:    false,
		Think:     p.Think,
		KeepAlive: p.KeepAlive,
		Options: ollamaGenerateOptions{
			Temperature: 0,
			NumPredict:  p.OutputTokens,
			NumCtx:      p.ContextTokens,
		},
	})
	if err != nil {
		return nil, AssessmentProviderError{Code: "invalid_provider_request", Retryable: false, Cause: err}
	}
	request, err := http.NewRequestWithContext(requestContext, http.MethodPost, p.BaseURL+"/api/generate", bytes.NewReader(body))
	if err != nil {
		return nil, AssessmentProviderError{Code: "invalid_provider_url", Retryable: false, Cause: err}
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json")

	response, err := client.Do(request)
	if err != nil {
		if errors.Is(requestContext.Err(), context.DeadlineExceeded) {
			return nil, AssessmentProviderError{Code: "provider_timeout", Retryable: true, Cause: err}
		}
		if errors.Is(requestContext.Err(), context.Canceled) {
			return nil, AssessmentProviderError{Code: "provider_canceled", Retryable: true, Cause: err}
		}
		return nil, AssessmentProviderError{Code: "provider_unavailable", Retryable: true, Cause: err}
	}
	defer response.Body.Close()

	responseBody, err := io.ReadAll(io.LimitReader(response.Body, assessmentOllamaMaxResponseBytes+1))
	if err != nil {
		return nil, AssessmentProviderError{Code: "provider_response_read_failed", Retryable: true, Cause: err}
	}
	if len(responseBody) > assessmentOllamaMaxResponseBytes {
		return nil, AssessmentProviderError{Code: "provider_response_too_large", Retryable: false}
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return nil, ollamaHTTPError(response.StatusCode, responseBody)
	}

	var result ollamaGenerateResponse
	if err := json.Unmarshal(responseBody, &result); err != nil {
		return nil, AssessmentProviderError{Code: "provider_invalid_response", Retryable: true, Cause: err}
	}
	if strings.TrimSpace(result.Error) != "" {
		return nil, AssessmentProviderError{Code: "provider_rejected_request", Retryable: false}
	}
	if result.Model != "" && result.Model != p.Model {
		return nil, AssessmentProviderError{Code: "provider_model_mismatch", Retryable: false}
	}
	// Only bounded completion metadata is logged, never the prompt or response text.
	reason := "unknown"
	if result.DoneReason == "stop" || result.DoneReason == "length" {
		reason = result.DoneReason
	}
	slog.InfoContext(ctx, "assessment generation usage", "done_reason", reason, "prompt_eval_count", max(0, result.PromptEvalCount), "eval_count", max(0, result.EvalCount))
	if result.DoneReason == "length" {
		return nil, AssessmentProviderError{Code: "provider_output_truncated", Retryable: false}
	}
	if result.DoneReason != "" && result.DoneReason != "stop" {
		return nil, AssessmentProviderError{Code: "provider_incomplete_response", Retryable: false}
	}
	if !result.Done || strings.TrimSpace(result.Response) == "" {
		return nil, AssessmentProviderError{Code: "provider_incomplete_response", Retryable: true}
	}
	if len(result.Response) > assessmentMaxOutputBytes {
		return nil, AssessmentProviderError{Code: "provider_output_too_large", Retryable: false}
	}
	return []byte(result.Response), nil
}

type ollamaGenerateRequest struct {
	Model     string                `json:"model"`
	System    string                `json:"system"`
	Prompt    string                `json:"prompt"`
	Format    json.RawMessage       `json:"format"`
	Stream    bool                  `json:"stream"`
	Think     bool                  `json:"think"`
	KeepAlive string                `json:"keep_alive,omitempty"`
	Options   ollamaGenerateOptions `json:"options"`
}

type ollamaGenerateOptions struct {
	Temperature float64 `json:"temperature"`
	NumPredict  int     `json:"num_predict,omitempty"`
	NumCtx      int     `json:"num_ctx,omitempty"`
}

type ollamaGenerateResponse struct {
	Model           string `json:"model"`
	Response        string `json:"response"`
	Done            bool   `json:"done"`
	Error           string `json:"error,omitempty"`
	DoneReason      string `json:"done_reason"`
	PromptEvalCount int    `json:"prompt_eval_count"`
	EvalCount       int    `json:"eval_count"`
}

type ollamaErrorResponse struct {
	Error string `json:"error"`
}

type ollamaTagsResponse struct {
	Models []struct {
		Name   string `json:"name"`
		Digest string `json:"digest"`
	} `json:"models"`
}

func ollamaHTTPError(status int, body []byte) error {
	code := "provider_http_error"
	retryable := status >= http.StatusInternalServerError || status == http.StatusTooManyRequests
	if status >= http.StatusBadRequest && status < http.StatusInternalServerError {
		code = "provider_request_rejected"
		retryable = false
	}
	var response ollamaErrorResponse
	if len(body) > 0 && json.Unmarshal(body, &response) != nil {
		return AssessmentProviderError{Code: code, Retryable: retryable}
	}
	errorText := strings.ToLower(response.Error)
	if status == http.StatusNotFound && strings.Contains(errorText, "model") && strings.Contains(errorText, "not found") {
		code = "model_not_found"
		retryable = false
	}
	var cause error
	if strings.TrimSpace(response.Error) != "" {
		cause = fmt.Errorf("ollama returned an error response")
	}
	return AssessmentProviderError{Code: code, Retryable: retryable, Cause: cause}
}
