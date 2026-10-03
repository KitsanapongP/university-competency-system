package services

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestOllamaAssessmentUsageLogsDoNotExposeResponseText(t *testing.T) {
	var logs bytes.Buffer
	previous := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&logs, nil)))
	t.Cleanup(func() { slog.SetDefault(previous) })
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"model":"qwen3:4b","response":"SYNTHETIC_PRIVATE_RESPONSE","done":true,"done_reason":"stop","prompt_eval_count":123,"eval_count":45}`))
	}))
	defer server.Close()
	provider := NewOllamaAssessmentProvider(server.URL, "qwen3:4b", time.Second, "5m", false, 512)
	if _, err := provider.Generate(context.Background(), "SYNTHETIC_PRIVATE_SYSTEM", "SYNTHETIC_PRIVATE_PROMPT", json.RawMessage(`{"type":"object"}`)); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(logs.String(), "SYNTHETIC_PRIVATE") {
		t.Fatal("generation telemetry exposed private text")
	}
	var entry map[string]any
	if err := json.Unmarshal(logs.Bytes(), &entry); err != nil {
		t.Fatal(err)
	}
	if entry["done_reason"] != "stop" || entry["prompt_eval_count"] != float64(123) || entry["eval_count"] != float64(45) {
		t.Fatalf("usage entry = %#v", entry)
	}
}

func TestOllamaAssessmentProviderStreamsStructuredResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/api/generate" {
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		var request ollamaGenerateRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Fatal(err)
		}
		if request.Model != "qwen3:4b" || !request.Stream || request.Think || request.Options.Temperature != 0 || request.Options.NumPredict != 768 || request.Options.NumCtx != 3072 {
			t.Fatalf("unexpected generation options: %+v", request)
		}
		if string(request.Format) != `{"type":"object"}` || request.System != "system" || request.Prompt != "user" {
			t.Fatalf("request prompt/schema mismatch: %+v", request)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"model":"qwen3:4b","response":"{\"ok\":true}","done":true}`))
	}))
	defer server.Close()

	provider := NewOllamaAssessmentProvider(server.URL, "qwen3:4b", time.Second, "5m", false, 768, 3072)
	output, err := provider.Generate(context.Background(), "system", "user", json.RawMessage(`{"type":"object"}`))
	if err != nil {
		t.Fatal(err)
	}
	if string(output) != `{"ok":true}` {
		t.Fatalf("unexpected provider output: %s", output)
	}
}

func TestOllamaAssessmentProviderAccumulatesNDJSONAndReportsActivity(t *testing.T) {
	var requestAccept string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestAccept = r.Header.Get("Accept")
		w.Header().Set("Content-Type", "application/x-ndjson")
		_, _ = w.Write([]byte("{\"model\":\"qwen3:4b\",\"response\":\"{\\\"answer\\\":\",\"done\":false}\n"))
		_, _ = w.Write([]byte("{\"model\":\"qwen3:4b\",\"response\":\"true}\",\"done\":false}\n"))
		_, _ = w.Write([]byte("{\"model\":\"qwen3:4b\",\"response\":\"\",\"done\":true,\"done_reason\":\"stop\",\"prompt_eval_count\":15,\"eval_count\":4}\n"))
	}))
	defer server.Close()

	provider := NewOllamaAssessmentProvider(server.URL, "qwen3:4b", time.Second, "5m", false, 512)
	activities := 0
	output, err := provider.GenerateWithProgress(
		context.Background(), "system", "user", json.RawMessage(`{"type":"object"}`),
		func() error { activities++; return nil },
	)
	if err != nil {
		t.Fatal(err)
	}
	if requestAccept != "application/x-ndjson" || string(output) != `{"answer":true}` || activities != 2 {
		t.Fatalf("accept=%q output=%q activities=%d", requestAccept, output, activities)
	}
}

func TestOllamaAssessmentProviderReportsStalledStream(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("{\"model\":\"qwen3:4b\",\"response\":\"{\",\"done\":false}\n"))
		w.(http.Flusher).Flush()
		<-r.Context().Done()
	}))
	defer server.Close()

	provider := NewOllamaAssessmentProvider(server.URL, "qwen3:4b", time.Second, "5m", false, 512)
	provider.StreamIdleTimeout = 20 * time.Millisecond
	_, err := provider.Generate(context.Background(), "system", "user", json.RawMessage(`{"type":"object"}`))
	providerErr, ok := err.(AssessmentProviderError)
	if !ok || providerErr.Code != "provider_stream_stalled" || !providerErr.Retryable {
		t.Fatalf("expected retryable stream stall, got %#v", err)
	}
}

func TestOllamaAssessmentProviderCanEnableThinkForEvaluation(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request ollamaGenerateRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Fatal(err)
		}
		if !request.Think || request.Options.NumCtx != 4096 {
			t.Fatalf("think option or default num_ctx was not forwarded: %+v", request.Options)
		}
		_, _ = w.Write([]byte(`{"model":"qwen3:4b","response":"{}","done":true}`))
	}))
	defer server.Close()

	provider := NewOllamaAssessmentProvider(server.URL, "qwen3:4b", time.Second, "5m", true, 512)
	if _, err := provider.Generate(context.Background(), "system", "user", json.RawMessage(`{"type":"object"}`)); err != nil {
		t.Fatal(err)
	}
}

func TestOllamaAssessmentProviderMapsMissingModelWithoutLeakingBody(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, `{"error":"model 'qwen3:4b' not found in private registry"}`, http.StatusNotFound)
	}))
	defer server.Close()

	provider := NewOllamaAssessmentProvider(server.URL, "qwen3:4b", time.Second, "5m", false, 512)
	_, err := provider.Generate(context.Background(), "system", "user", json.RawMessage(`{"type":"object"}`))
	providerErr, ok := err.(AssessmentProviderError)
	if !ok || providerErr.Code != "model_not_found" || providerErr.Retryable {
		t.Fatalf("expected permanent model-not-found error, got %#v", err)
	}
	if strings.Contains(providerErr.Error(), "private registry") {
		t.Fatal("provider response details must not be exposed in the error")
	}
}

func TestOllamaAssessmentProviderRejectsIncompleteAndMismatchedResponses(t *testing.T) {
	tests := []struct {
		name string
		body string
		code string
	}{
		{name: "incomplete", body: `{"model":"qwen3:4b","response":"{}","done":false}`, code: "provider_incomplete_response"},
		{name: "wrong model", body: `{"model":"another-model","response":"{}","done":true}`, code: "provider_model_mismatch"},
		{name: "truncated", body: `{"model":"qwen3:4b","response":"{","done":true,"done_reason":"length","prompt_eval_count":700,"eval_count":1024}`, code: "provider_output_truncated"},
		{name: "unknown completion reason", body: `{"model":"qwen3:4b","response":"{}","done":true,"done_reason":"other"}`, code: "provider_incomplete_response"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				_, _ = w.Write([]byte(test.body))
			}))
			defer server.Close()
			provider := NewOllamaAssessmentProvider(server.URL, "qwen3:4b", time.Second, "5m", false, 512)
			_, err := provider.Generate(context.Background(), "system", "user", json.RawMessage(`{"type":"object"}`))
			providerErr, ok := err.(AssessmentProviderError)
			if !ok || providerErr.Code != test.code {
				t.Fatalf("expected %s, got %#v", test.code, err)
			}
		})
	}
}

func TestOllamaAssessmentProviderHonorsRequestTimeout(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		time.Sleep(100 * time.Millisecond)
		_, _ = w.Write([]byte(`{"model":"qwen3:4b","response":"{}","done":true}`))
	}))
	defer server.Close()
	provider := NewOllamaAssessmentProvider(server.URL, "qwen3:4b", 10*time.Millisecond, "5m", false, 512)
	_, err := provider.Generate(context.Background(), "system", "user", json.RawMessage(`{"type":"object"}`))
	providerErr, ok := err.(AssessmentProviderError)
	if !ok || providerErr.Code != "provider_timeout" || !providerErr.Retryable {
		t.Fatalf("expected retryable timeout, got %#v", err)
	}
}
