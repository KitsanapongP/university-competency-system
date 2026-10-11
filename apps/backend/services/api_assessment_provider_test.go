package services

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestAPIAssessmentStreamingAdapters(t *testing.T) {
	cases := []struct{ provider, events string }{
		{"deepseek", "data: {\"choices\":[{\"delta\":{\"content\":\"{\"}}]}\n\ndata: {\"choices\":[{\"delta\":{\"content\":\"}\"},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":12,\"completion_tokens\":2}}\n\ndata: [DONE]\n\n"},
		{"openai", "event: response.output_text.delta\ndata: {\"type\":\"response.output_text.delta\",\"delta\":\"{}\"}\n\ndata: {\"type\":\"response.completed\",\"response\":{\"status\":\"completed\",\"usage\":{\"input_tokens\":12,\"output_tokens\":2}}}\n\n"},
		{"gemini", "data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"secret reasoning\",\"thought\":true},{\"text\":\"{}\"}]},\"finishReason\":\"STOP\"}],\"usageMetadata\":{\"promptTokenCount\":12,\"candidatesTokenCount\":2}}\n\n"},
	}
	for _, tt := range cases {
		t.Run(tt.provider, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if tt.provider == "gemini" {
					if r.Header.Get("x-goog-api-key") != "test-key" {
						t.Error("missing Gemini header")
					}
				} else if r.Header.Get("Authorization") != "Bearer test-key" {
					t.Error("missing bearer")
				}
				var body map[string]any
				if json.NewDecoder(r.Body).Decode(&body) != nil {
					t.Error("invalid payload")
				}
				switch tt.provider {
				case "openai":
					if body["text"] == nil || body["store"] != false {
						t.Error("missing structured output/privacy")
					}
				case "gemini":
					if body["generationConfig"] == nil {
						t.Error("missing schema")
					}
				case "deepseek":
					if body["response_format"] == nil {
						t.Error("missing JSON mode")
					}
				}
				w.Header().Set("Content-Type", "text/event-stream")
				for _, b := range []byte(tt.events) {
					fmt.Fprintf(w, "%c", b)
				}
			}))
			defer server.Close()
			p := NewAPIAssessmentProvider(tt.provider, "test-model", "test-key", time.Second, time.Second, 500)
			p.endpoint = server.URL
			usage := AssessmentAPIUsage{}
			progress := 0
			out, err := p.GenerateWithProgress(withAssessmentAPIUsage(context.Background(), &usage), "system", "user", json.RawMessage(`{"type":"object"}`), func() error { progress++; return nil })
			if err != nil || string(out) != "{}" || progress == 0 {
				t.Fatalf("output=%s progress=%d err=%v", out, progress, err)
			}
			if usage.InputTokens == nil || *usage.InputTokens != 12 || usage.OutputTokens == nil || *usage.OutputTokens != 2 {
				t.Fatal("usage lost")
			}
		})
	}
}

func TestAPIHTTPClassificationDoesNotLeakBody(t *testing.T) {
	for _, status := range []int{401, 403, 400, 429, 500} {
		t.Run(fmt.Sprint(status), func(t *testing.T) {
			calls := 0
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls++
				w.Header().Set("Retry-After", "17")
				w.WriteHeader(status)
				fmt.Fprint(w, "student@example.test test-key")
			}))
			defer server.Close()
			p := NewAPIAssessmentProvider("deepseek", "test", "test-key", time.Second, time.Second, 10)
			p.endpoint = server.URL
			_, err := p.Generate(context.Background(), "s", "u", json.RawMessage(`{}`))
			var e AssessmentProviderError
			if !errors.As(err, &e) || strings.Contains(err.Error(), "test-key") || strings.Contains(err.Error(), "student") {
				t.Fatal("unsafe error")
			}
			if e.RetryAfter != 17*time.Second || calls != 1 {
				t.Fatal("retry duplicated or header lost")
			}
			if e.Retryable != (status == 429 || status >= 500) {
				t.Fatal("wrong retry classification")
			}
		})
	}
}

func TestAPIIncompleteRefusalEmptyAndIdle(t *testing.T) {
	for _, tt := range []struct {
		event, code string
		stall       bool
	}{
		{`{"type":"response.incomplete"}`, "truncated_output", false},
		{`{"type":"response.refusal.delta","delta":"private"}`, "provider_refusal", false},
		{`{"type":"response.completed","response":{"status":"completed"}}`, "empty_output", false},
		{`{"type":"response.created"}`, "provider_timeout", true},
	} {
		t.Run(tt.code, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "text/event-stream")
				fmt.Fprintf(w, "data: %s\n\n", tt.event)
				w.(http.Flusher).Flush()
				if tt.stall {
					<-r.Context().Done()
				}
			}))
			defer server.Close()
			p := NewAPIAssessmentProvider("openai", "test", "secret", time.Second, 30*time.Millisecond, 500)
			p.endpoint = server.URL
			_, err := p.Generate(context.Background(), "s", "u", json.RawMessage(`{}`))
			var e AssessmentProviderError
			if !errors.As(err, &e) || e.Code != tt.code {
				t.Fatalf("%v", err)
			}
		})
	}
}

func TestAPIUsageLogContainsOnlySafeMetadata(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, "data: {\"choices\":[{\"delta\":{\"content\":\"private-output\"},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":12,\"completion_tokens\":2}}\n\n")
	}))
	defer server.Close()
	p := NewAPIAssessmentProvider("deepseek", "test", "private-api-key", time.Second, time.Second, 100)
	p.endpoint = server.URL
	var log bytes.Buffer
	ctx := context.WithValue(context.Background(), assessmentLogContextKey{}, slog.New(slog.NewJSONHandler(&log, nil)))
	if _, err := p.Generate(ctx, "private-system", "private-user", json.RawMessage(`{}`)); err != nil {
		t.Fatal(err)
	}
	for _, secret := range []string{"private-output", "private-api-key", "private-system", "private-user"} {
		if strings.Contains(log.String(), secret) {
			t.Fatal("log leaked content")
		}
	}
	if !strings.Contains(log.String(), `"input_tokens":12`) || !strings.Contains(log.String(), `"output_tokens":2`) {
		t.Fatal("usage log is not numeric")
	}
}

func TestAPIStreamResponseIsBounded(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		for i := 0; i < 40; i++ {
			event, _ := json.Marshal(map[string]any{"type": "response.output_text.delta", "delta": strings.Repeat("x", 10000)})
			if _, err := fmt.Fprintf(w, "data: %s\n\n", event); err != nil {
				return
			}
		}
	}))
	defer server.Close()
	p := NewAPIAssessmentProvider("openai", "test", "key", time.Second, time.Second, 100)
	p.endpoint = server.URL
	out, err := p.Generate(context.Background(), "system", "user", json.RawMessage(`{}`))
	var failure AssessmentProviderError
	if !errors.As(err, &failure) || failure.Code != "output_too_large" || len(out) > assessmentAPIOutputLimit {
		t.Fatalf("unbounded output/error: %d %v", len(out), err)
	}
}
