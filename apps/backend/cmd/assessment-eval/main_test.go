package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/spw32767/university-competency-system-backend/config"
	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/services"
)

func TestSyntheticEvaluationFixturesFitDeclaredContextBudget(t *testing.T) {
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
		budget := services.DefaultAssessmentContextBudget()
		if fixture.Name == "large-academic-history" {
			budget.ContextTokens = 12288
		}
		diagnostics := services.EstimateAssessmentContextDiagnostics(
			fixture.Input,
			systemPrompt,
			userPrompt,
			budget,
			services.EstimateAssessmentPromptTokens(systemPrompt, userPrompt),
		)
		if diagnostics.EstimatedTotalTokens > diagnostics.ContextTokens {
			t.Fatalf("fixture %s exceeds test context budget: %+v", path, diagnostics)
		}
		if diagnostics.SourceDataBytes == 0 || diagnostics.CompetencyScoresBytes == 0 {
			t.Fatalf("fixture %s has incomplete section diagnostics: %+v", path, diagnostics)
		}
	}
}

func TestResolveEvaluationCasesDirectoryRejectsExternalPaths(t *testing.T) {
	if _, err := resolveEvaluationCasesDirectory(t.TempDir()); err == nil {
		t.Fatal("evaluation should reject fixture paths outside the checked-in synthetic fixture directory")
	}
	originalDirectory, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(filepath.Join("..", "..")); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := os.Chdir(originalDirectory); err != nil {
			t.Error(err)
		}
	})
	resolved, err := resolveEvaluationCasesDirectory(filepath.Join("testdata", "learner_assessment"))
	if err != nil {
		t.Fatalf("checked-in synthetic fixtures should be allowed: %v", err)
	}
	if !filepath.IsAbs(resolved) {
		t.Fatalf("resolved fixture path is not absolute: %s", resolved)
	}
}

func TestEvaluationFixturesUseCareerFreeCompactVersionOneInput(t *testing.T) {
	paths, err := filepath.Glob(filepath.Join("..", "..", "testdata", "learner_assessment", "*.json"))
	if err != nil {
		t.Fatal(err)
	}
	for _, path := range paths {
		data, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		for _, removedField := range []string{"\"career_paths\"", "\"eligible_careers\"", "\"career_recommendations\"", "\"career_recommendation_reason\""} {
			if strings.Contains(string(data), removedField) {
				t.Fatalf("fixture %s still contains removed v1.0 field %s", path, removedField)
			}
		}

		var document map[string]any
		if err := json.Unmarshal(data, &document); err != nil {
			t.Fatalf("decode %s: %v", path, err)
		}
		input := document["input"].(map[string]any)
		for _, competencyValue := range input["competency_scores"].([]any) {
			competency := competencyValue.(map[string]any)
			for _, scoreValue := range competency["course_scores"].([]any) {
				score := scoreValue.(map[string]any)
				for _, repeatedField := range []string{"course_code", "course_name_th", "course_name_en", "academic_year_be", "semester", "grade"} {
					if _, exists := score[repeatedField]; exists {
						t.Fatalf("fixture %s duplicates centralized course field %s", path, repeatedField)
					}
				}
			}
			for _, scoreValue := range competency["activity_scores"].([]any) {
				score := scoreValue.(map[string]any)
				if len(score) != 2 || score["evidence_ref"] == nil || score["activity_evidence_ref"] == nil {
					t.Fatalf("fixture %s activity score should contain only evidence references: %#v", path, score)
				}
			}
		}
	}
}

func TestAssessmentOutputShapeOmitsGeneratedValuesAndUnknownKeys(t *testing.T) {
	raw := []byte(`{"readiness_explanation":{"th":"SYNTHETIC_PRIVATE_TEXT","en":"other text"},"unexpected_private_key":"DO_NOT_PRINT","strengths":[]}`)
	shape := assessmentOutputShape(raw)
	for _, forbidden := range []string{"SYNTHETIC_PRIVATE_TEXT", "other text", "unexpected_private_key", "DO_NOT_PRINT"} {
		if strings.Contains(shape, forbidden) {
			t.Fatalf("output shape exposed generated content %q: %s", forbidden, shape)
		}
	}
	for _, expected := range []string{`"readiness_explanation"`, `"strengths"`, `"unknown_keys":1`, `"items":0`} {
		if !strings.Contains(shape, expected) {
			t.Fatalf("output shape omitted %q: %s", expected, shape)
		}
	}
}

func TestAssessmentOutputShapeReportsMalformedJSONWithoutSourceText(t *testing.T) {
	shape := assessmentOutputShape([]byte("PRIVATE_MODEL_OUTPUT{"))
	if strings.Contains(shape, "PRIVATE_MODEL_OUTPUT") {
		t.Fatalf("malformed output diagnostic exposed model content: %s", shape)
	}
	for _, expected := range []string{"malformed-json", "bytes=", "syntax_offset=", "class=invalid-syntax"} {
		if !strings.Contains(shape, expected) {
			t.Fatalf("malformed output diagnostic omitted %q: %s", expected, shape)
		}
	}
}

func TestEvaluateDirectoryContinuesAfterInvalidFixture(t *testing.T) {
	directory := t.TempDir()
	for _, name := range []string{"first.json", "second.json"} {
		fixture := evalFixture{Name: strings.TrimSuffix(name, ".json"), Input: models.AssessmentProviderInput{Completeness: "partial"}}
		data, err := json.Marshal(fixture)
		if err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(directory, name), data, 0o600); err != nil {
			t.Fatal(err)
		}
	}
	provider := &invalidAssessmentProvider{}
	err := evaluateDirectory(context.Background(), directory, provider, config.Config{
		AssessmentContextTokens:       4096,
		AssessmentOutputReserveTokens: 1024,
		AssessmentTokenSafetyMargin:   128,
	}, "synthetic-digest")
	if err == nil || provider.calls != 2 {
		t.Fatalf("evaluation should inspect both fixtures after validation failures: calls=%d err=%v", provider.calls, err)
	}
	for _, name := range []string{"first.json", "second.json"} {
		if !strings.Contains(err.Error(), name) {
			t.Fatalf("combined evaluation error omits %s: %v", name, err)
		}
	}
}

type invalidAssessmentProvider struct {
	calls int
}

func (provider *invalidAssessmentProvider) Generate(context.Context, string, string, json.RawMessage) ([]byte, error) {
	provider.calls++
	return []byte("{"), nil
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
