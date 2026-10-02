package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/spw32767/university-competency-system-backend/services"
)

func TestSyntheticEvaluationFixturesFitDefaultInputBudget(t *testing.T) {
	paths, err := filepath.Glob(filepath.Join("..", "..", "testdata", "learner_assessment", "*.json"))
	if err != nil {
		t.Fatal(err)
	}
	if len(paths) < 2 {
		t.Fatalf("expected synthetic evaluation fixtures, got %d", len(paths))
	}
	for _, path := range paths {
		var fixture evalFixture
		data, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		if err := json.Unmarshal(data, &fixture); err != nil {
			t.Fatalf("decode %s: %v", path, err)
		}
		if fixture.Name == "" || len(fixture.ReviewChecklist) == 0 || fixture.Input.Completeness == "none" {
			t.Fatalf("fixture %s is missing evaluation metadata or analyzable evidence", path)
		}
		systemPrompt, userPrompt, err := services.BuildAssessmentPrompt(fixture.Input)
		if err != nil {
			t.Fatalf("build prompt for %s: %v", path, err)
		}
		estimated := services.EstimateAssessmentPromptTokens(systemPrompt, userPrompt)
		budget := services.DefaultAssessmentContextBudget()
		if estimated+budget.OutputReserveTokens+budget.SafetyMarginTokens > budget.ContextTokens {
			t.Fatalf("fixture %s exceeds default context budget: %d tokens", path, estimated)
		}
	}
}

func TestResolveOllamaModelDigestFromTags(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"models":[{"name":"qwen3:4b","digest":"sha256:synthetic-digest"}]}`))
	}))
	defer server.Close()

	digest, err := services.ResolveOllamaModelDigest(t.Context(), server.URL, "qwen3:4b")
	if err != nil {
		t.Fatal(err)
	}
	if digest != "sha256:synthetic-digest" {
		t.Fatalf("unexpected digest: %s", digest)
	}
}

func TestResolveOllamaModelDigestFailsWhenModelIsNotInstalled(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"models":[]}`))
	}))
	defer server.Close()

	if _, err := services.ResolveOllamaModelDigest(t.Context(), server.URL, services.DefaultAssessmentModel()); err == nil {
		t.Fatal("expected missing model to fail evaluation preflight")
	}
}
