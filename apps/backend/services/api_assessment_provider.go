package services

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const assessmentAPIResponseLimit = 256 << 10

type AssessmentAPIUsage struct{ InputTokens, OutputTokens *int }
type assessmentUsageContextKey struct{}

// Usage belongs to one attempt; never retain it on a shared adapter.
func withAssessmentAPIUsage(ctx context.Context, usage *AssessmentAPIUsage) context.Context {
	return context.WithValue(ctx, assessmentUsageContextKey{}, usage)
}

func WithAssessmentAPIUsage(ctx context.Context, usage *AssessmentAPIUsage) context.Context {
	return withAssessmentAPIUsage(ctx, usage)
}

type APIAssessmentProvider struct {
	Provider, Model      string
	apiKey               string
	endpoint             string
	client               *http.Client
	timeout, idleTimeout time.Duration
	outputTokens         int
}

func NewAPIAssessmentProvider(provider, model, key string, timeout, idle time.Duration, outputTokens int) *APIAssessmentProvider {
	endpoint := map[string]string{"deepseek": "https://api.deepseek.com/chat/completions", "openai": "https://api.openai.com/v1/responses", "gemini": "https://generativelanguage.googleapis.com/v1beta/models/" + url.PathEscape(model) + ":streamGenerateContent?alt=sse"}[provider]
	return &APIAssessmentProvider{Provider: provider, Model: model, apiKey: key, endpoint: endpoint, timeout: timeout, idleTimeout: idle, outputTokens: outputTokens, client: &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}}
}

func (p *APIAssessmentProvider) Generate(ctx context.Context, system, user string, schema json.RawMessage) ([]byte, error) {
	return p.GenerateWithProgress(ctx, system, user, schema, nil)
}

func (p *APIAssessmentProvider) requestBody(system, user string, schema json.RawMessage) (any, error) {
	var shape any
	if !json.Valid(schema) || json.Unmarshal(schema, &shape) != nil {
		return nil, AssessmentProviderError{Code: "provider_configuration"}
	}
	switch p.Provider {
	case "deepseek":
		return map[string]any{"model": p.Model, "messages": []any{map[string]string{"role": "system", "content": system + "\nReturn JSON."}, map[string]string{"role": "user", "content": user}}, "stream": true, "stream_options": map[string]bool{"include_usage": true}, "response_format": map[string]string{"type": "json_object"}, "max_tokens": p.outputTokens, "temperature": 0, "thinking": map[string]string{"type": "disabled"}}, nil
	case "openai":
		return map[string]any{"model": p.Model, "instructions": system, "input": user, "stream": true, "store": false, "max_output_tokens": p.outputTokens, "text": map[string]any{"format": map[string]any{"type": "json_schema", "name": "learner_assessment", "strict": true, "schema": shape}}}, nil
	case "gemini":
		return map[string]any{"systemInstruction": map[string]any{"parts": []any{map[string]string{"text": system}}}, "contents": []any{map[string]any{"role": "user", "parts": []any{map[string]string{"text": user}}}}, "generationConfig": map[string]any{"responseMimeType": "application/json", "responseJsonSchema": shape, "maxOutputTokens": p.outputTokens, "temperature": 0}}, nil
	default:
		return nil, AssessmentProviderError{Code: "provider_configuration"}
	}
}

func (p *APIAssessmentProvider) GenerateWithProgress(ctx context.Context, system, user string, schema json.RawMessage, progress func() error) ([]byte, error) {
	body, err := p.requestBody(system, user, schema)
	if err != nil {
		return nil, err
	}
	encoded, err := json.Marshal(body)
	if err != nil {
		return nil, AssessmentProviderError{Code: "provider_configuration"}
	}
	requestContext, cancel := context.WithTimeout(ctx, p.timeout)
	defer cancel()
	req, err := http.NewRequestWithContext(requestContext, http.MethodPost, p.endpoint, bytes.NewReader(encoded))
	if err != nil {
		return nil, AssessmentProviderError{Code: "provider_configuration"}
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")
	if p.Provider == "gemini" {
		req.Header.Set("x-goog-api-key", p.apiKey)
	} else {
		req.Header.Set("Authorization", "Bearer "+p.apiKey)
	}
	idle := time.AfterFunc(p.idleTimeout, cancel)
	defer idle.Stop()
	resp, err := p.client.Do(req)
	if err != nil {
		return nil, apiTransportError(requestContext, ctx)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, apiHTTPError(resp)
	}
	if !strings.Contains(resp.Header.Get("Content-Type"), "text/event-stream") {
		return nil, AssessmentProviderError{Code: "provider_protocol"}
	}
	scanner := bufio.NewScanner(io.LimitReader(resp.Body, assessmentAPIResponseLimit+1))
	scanner.Buffer(make([]byte, 4096), assessmentAPIResponseLimit+1)
	var output strings.Builder
	var data []string
	var total int
	var done bool
	usage := AssessmentAPIUsage{}
	defer func() {
		if dst, ok := ctx.Value(assessmentUsageContextKey{}).(*AssessmentAPIUsage); ok {
			*dst = usage
		}
	}()
	dispatch := func() error {
		if len(data) == 0 {
			return nil
		}
		event := strings.Join(data, "\n")
		data = nil
		if event == "[DONE]" {
			return nil
		}
		delta, finished, eventErr := p.parseEvent([]byte(event), &usage)
		if eventErr != nil {
			return eventErr
		}
		output.WriteString(delta)
		done = done || finished
		if output.Len() > assessmentAPIResponseLimit {
			return AssessmentProviderError{Code: "output_too_large"}
		}
		if progress != nil {
			return progress()
		}
		return nil
	}
	for scanner.Scan() {
		line := scanner.Text()
		total += len(line) + 1
		if total > assessmentAPIResponseLimit {
			return []byte(output.String()), AssessmentProviderError{Code: "output_too_large"}
		}
		idle.Reset(p.idleTimeout)
		if line == "" {
			if err := dispatch(); err != nil {
				return []byte(output.String()), err
			}
			continue
		}
		if strings.HasPrefix(line, "data:") {
			data = append(data, strings.TrimPrefix(strings.TrimPrefix(line, "data:"), " "))
		}
	}
	if err := scanner.Err(); err != nil {
		return []byte(output.String()), apiTransportError(requestContext, ctx)
	}
	if err := dispatch(); err != nil {
		return []byte(output.String()), err
	}
	if dst, ok := ctx.Value(assessmentUsageContextKey{}).(*AssessmentAPIUsage); ok {
		*dst = usage
	}
	assessmentLogger(ctx).InfoContext(ctx, "assessment API usage", "provider", p.Provider, "input_tokens", assessmentUsageValue(usage.InputTokens), "output_tokens", assessmentUsageValue(usage.OutputTokens))
	if !done {
		return []byte(output.String()), AssessmentProviderError{Code: "truncated_output"}
	}
	if strings.TrimSpace(output.String()) == "" {
		return nil, AssessmentProviderError{Code: "empty_output"}
	}
	return []byte(output.String()), nil
}

func assessmentUsageValue(value *int) any {
	if value == nil {
		return nil
	}
	return *value
}

func apiTransportError(request, parent context.Context) error {
	if parent.Err() != nil {
		return AssessmentProviderError{Code: "provider_timeout", Retryable: true}
	}
	if request.Err() != nil {
		return AssessmentProviderError{Code: "provider_timeout", Retryable: true}
	}
	return AssessmentProviderError{Code: "provider_unavailable", Retryable: true}
}

func apiHTTPError(resp *http.Response) error {
	e := AssessmentProviderError{Code: "provider_request_rejected"}
	switch resp.StatusCode {
	case 401, 403:
		e.Code = "provider_authentication"
	case 429:
		e.Code = "provider_rate_limited"
		e.Retryable = true
	case 408, 504:
		e.Code = "provider_timeout"
		e.Retryable = true
	default:
		if resp.StatusCode >= 500 {
			e.Code = "provider_unavailable"
			e.Retryable = true
		}
	}
	if seconds, err := strconv.Atoi(resp.Header.Get("Retry-After")); err == nil && seconds > 0 {
		e.RetryAfter = time.Duration(seconds) * time.Second
	} else if when, err := http.ParseTime(resp.Header.Get("Retry-After")); err == nil {
		e.RetryAfter = max(0, time.Until(when))
	}
	return e
}

// Parse only final-answer deltas. Reasoning content and provider error text are ignored.
func (p *APIAssessmentProvider) parseEvent(raw []byte, usage *AssessmentAPIUsage) (string, bool, error) {
	switch p.Provider {
	case "deepseek":
		var e struct {
			Error   json.RawMessage `json:"error"`
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
					Refusal string `json:"refusal"`
				} `json:"delta"`
				FinishReason string `json:"finish_reason"`
			} `json:"choices"`
			Usage *struct {
				Input  int `json:"prompt_tokens"`
				Output int `json:"completion_tokens"`
			} `json:"usage"`
		}
		if json.Unmarshal(raw, &e) != nil {
			return "", false, AssessmentProviderError{Code: "provider_protocol"}
		}
		if len(e.Error) > 0 {
			return "", false, AssessmentProviderError{Code: "provider_unavailable", Retryable: true}
		}
		if e.Usage != nil {
			usage.InputTokens = &e.Usage.Input
			usage.OutputTokens = &e.Usage.Output
		}
		if len(e.Choices) == 0 {
			return "", false, nil
		}
		c := e.Choices[0]
		if c.Delta.Refusal != "" || c.FinishReason == "content_filter" {
			return "", false, AssessmentProviderError{Code: "provider_refusal"}
		}
		if c.FinishReason == "length" {
			return c.Delta.Content, false, AssessmentProviderError{Code: "truncated_output"}
		}
		return c.Delta.Content, c.FinishReason == "stop", nil
	case "openai":
		var e struct {
			Type     string `json:"type"`
			Delta    string `json:"delta"`
			Response struct {
				Status string `json:"status"`
				Usage  *struct {
					Input  int `json:"input_tokens"`
					Output int `json:"output_tokens"`
				} `json:"usage"`
			} `json:"response"`
		}
		if json.Unmarshal(raw, &e) != nil {
			return "", false, AssessmentProviderError{Code: "provider_protocol"}
		}
		if e.Response.Usage != nil {
			usage.InputTokens = &e.Response.Usage.Input
			usage.OutputTokens = &e.Response.Usage.Output
		}
		switch e.Type {
		case "response.output_text.delta":
			return e.Delta, false, nil
		case "response.completed":
			return "", e.Response.Status == "completed", nil
		case "response.refusal.delta", "response.refusal.done":
			return "", false, AssessmentProviderError{Code: "provider_refusal"}
		case "response.incomplete":
			return "", false, AssessmentProviderError{Code: "truncated_output"}
		case "error", "response.failed":
			return "", false, AssessmentProviderError{Code: "provider_unavailable", Retryable: true}
		}
		return "", false, nil
	case "gemini":
		var e struct {
			Error          json.RawMessage `json:"error"`
			PromptFeedback struct {
				BlockReason string `json:"blockReason"`
			} `json:"promptFeedback"`
			Candidates []struct {
				Content struct {
					Parts []struct {
						Text    string `json:"text"`
						Thought bool   `json:"thought"`
					} `json:"parts"`
				} `json:"content"`
				FinishReason string `json:"finishReason"`
			} `json:"candidates"`
			Usage *struct {
				Input  int `json:"promptTokenCount"`
				Output int `json:"candidatesTokenCount"`
			} `json:"usageMetadata"`
		}
		if json.Unmarshal(raw, &e) != nil {
			return "", false, AssessmentProviderError{Code: "provider_protocol"}
		}
		if len(e.Error) > 0 {
			return "", false, AssessmentProviderError{Code: "provider_unavailable", Retryable: true}
		}
		if e.Usage != nil {
			usage.InputTokens = &e.Usage.Input
			usage.OutputTokens = &e.Usage.Output
		}
		if e.PromptFeedback.BlockReason != "" {
			return "", false, AssessmentProviderError{Code: "provider_refusal"}
		}
		if len(e.Candidates) == 0 {
			return "", false, nil
		}
		c := e.Candidates[0]
		var s strings.Builder
		for _, part := range c.Content.Parts {
			if !part.Thought {
				s.WriteString(part.Text)
			}
		}
		if c.FinishReason == "MAX_TOKENS" {
			return s.String(), false, AssessmentProviderError{Code: "truncated_output"}
		}
		if c.FinishReason != "" && c.FinishReason != "STOP" {
			return "", false, AssessmentProviderError{Code: "provider_refusal"}
		}
		return s.String(), c.FinishReason == "STOP", nil
	}
	return "", false, AssessmentProviderError{Code: "provider_configuration"}
}
