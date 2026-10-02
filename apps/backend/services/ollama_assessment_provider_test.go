package services

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestOllamaAssessmentProviderSendsStructuredNonStreamingRequest(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/api/generate" {
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		var request ollamaGenerateRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Fatal(err)
		}
		if request.Model != "qwen3:4b" || request.Stream || request.Think || request.Options.Temperature != 0 || request.Options.NumPredict != 768 || request.Options.NumCtx != 3072 {
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
