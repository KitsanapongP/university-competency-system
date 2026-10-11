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

	"github.com/spw32767/university-competency-system-backend/config"
	"github.com/spw32767/university-competency-system-backend/models"
)

func TestKKUChatCompletionsUsesDocumentedPayloadAndStreams(t *testing.T) {
	for _, model := range []string{"12", "gemini-3.5-flash"} {
		t.Run(model, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Header.Get("Authorization") != "Bearer test-key" || r.Method != http.MethodPost {
					t.Error("incorrect authentication or method")
				}
				var body map[string]any
				if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
					t.Fatal(err)
				}
				if model == "12" && body["model"] != float64(12) {
					t.Error("model ID must be a number")
				}
				if model != "12" && body["model"] != model {
					t.Error("model name changed")
				}
				if body["stream"] != true || body["max_tokens"] != float64(4096) || body["temperature"] != float64(0) || body["messages"] == nil {
					t.Error("missing documented parameters")
				}
				for _, unsupported := range []string{"response_format", "stream_options", "thinking", "store"} {
					if _, ok := body[unsupported]; ok {
						t.Errorf("undocumented parameter %s", unsupported)
					}
				}
				w.Header().Set("Content-Type", "text/event-stream")
				fmt.Fprint(w, "data: {\"choices\":[{\"delta\":{\"reasoning\":\"private reasoning\",\"content\":\"{}\"},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":12,\"completion_tokens\":2},\"model_quota\":{\"daily_remaining_tokens\":9986}}\n\ndata: [DONE]\n\n")
			}))
			defer server.Close()
			provider := NewAPIAssessmentProvider("kku", model, "test-key", time.Second, time.Second, 4096)
			if provider.endpoint != "https://gen.ai.kku.ac.th/api/v1/chat/completions" {
				t.Fatal("incorrect university endpoint")
			}
			provider.endpoint = server.URL
			usage := AssessmentAPIUsage{}
			progress := 0
			output, err := provider.GenerateWithProgress(WithAssessmentAPIUsage(context.Background(), &usage), "system schema", "user", json.RawMessage(`{"type":"object"}`), func() error { progress++; return nil })
			if err != nil || string(output) != "{}" || progress == 0 || usage.InputTokens == nil || *usage.InputTokens != 12 {
				t.Fatalf("stream failed: %v", err)
			}
		})
	}
}

func TestKKUUnauthorizedErrorsDistinguishKeyModelAndQuotaWithoutLeaks(t *testing.T) {
	for _, test := range []struct{ body, code string }{
		{`{"error":"Invalid API key"}`, "provider_authentication"},
		{`{"error":{"message":"Invalid model"}}`, "provider_model_unavailable"},
		{`{"message":"This model reached daily limit."}`, "provider_token_quota_exhausted"},
		{`Invalid model`, "provider_model_unavailable"},
		{`"Invalid API key"`, "provider_authentication"},
		{`{"error":"private-key student@example.test"}`, "provider_authentication"},
		{strings.Repeat("x", 9000), "provider_authentication"},
	} {
		t.Run(test.code+test.body[:min(len(test.body), 20)], func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(401); fmt.Fprint(w, test.body) }))
			defer server.Close()
			provider := NewAPIAssessmentProvider("kku", "1", "private-key", time.Second, time.Second, 4096)
			provider.endpoint = server.URL
			_, err := provider.Generate(context.Background(), "system", "user", json.RawMessage(`{}`))
			var failure AssessmentProviderError
			if !errors.As(err, &failure) || failure.Code != test.code || failure.Retryable || failure.HTTPStatus != 401 {
				t.Fatalf("unexpected classification: %v", err)
			}
			if strings.Contains(err.Error(), "private-key") || strings.Contains(err.Error(), "student@example") {
				t.Fatal("private error body leaked")
			}
		})
	}
}

func TestKKUStreamErrorsUseDocumentedClassification(t *testing.T) {
	provider := NewAPIAssessmentProvider("kku", "1", "key", time.Second, time.Second, 4096)
	_, _, err := provider.parseEvent([]byte(`{"error":{"message":"Invalid model"}}`), &AssessmentAPIUsage{})
	var failure AssessmentProviderError
	if !errors.As(err, &failure) || failure.Code != "provider_model_unavailable" {
		t.Fatalf("unexpected stream error: %v", err)
	}
}

func TestWorkerLogsHandledProviderFailureWithoutPrivateContent(t *testing.T) {
	var output bytes.Buffer
	ctx := context.WithValue(context.Background(), assessmentLogContextKey{}, slog.New(slog.NewJSONHandler(&output, nil)))
	jobs := &fakeAssessmentWorkerJobs{}
	worker := &LearnerAssessmentWorker{Jobs: jobs, GenerationConfig: AssessmentGenerationConfig{Provider: "kku"}}
	err := worker.handleProviderError(ctx, models.AssessmentJob{JobID: 18}, AssessmentProviderError{Code: "provider_model_unavailable", HTTPStatus: 401, Cause: errors.New("private-key private-student")})
	if err != nil || jobs.failedCode != "provider_model_unavailable" {
		t.Fatalf("failure was not persisted: %v", err)
	}
	if !strings.Contains(output.String(), `"http_status":401`) || !strings.Contains(output.String(), `"provider":"kku"`) {
		t.Fatal("handled failure was not logged")
	}
	if strings.Contains(output.String(), "private-key") || strings.Contains(output.String(), "private-student") {
		t.Fatal("failure log exposed private details")
	}
}

func TestKKURuntimeMetadataUsesUniversityProvider(t *testing.T) {
	cfg := config.Config{AssessmentProvider: "kku", AssessmentAPIEnabled: true, AssessmentAPIKey: "private-key", AssessmentAPIModel: "12", AssessmentAPITimeout: time.Minute, AssessmentAPIIdleTimeout: time.Minute, AssessmentAPIDailyLimit: 20, AssessmentContextTokens: 32768, AssessmentOutputReserveTokens: 4096, AssessmentTokenSafetyMargin: 512}
	budget, generation, err := AssessmentRuntime(cfg)
	if err != nil {
		t.Fatal(err)
	}
	metadata := assessmentSourceMetadata(budget, generation)
	if metadata.Provider != "kku" || metadata.Model != "12" || metadata.ModelDigest != "" {
		t.Fatal("incorrect university provider metadata")
	}
	other := generation
	other.Provider = "deepseek"
	if assessmentSourceMetadata(budget, other).ProviderConfigFingerprint == metadata.ProviderConfigFingerprint {
		t.Fatal("university and direct provider fingerprints collide")
	}
}
