package services

import (
	"encoding/json"
	"errors"
	"github.com/spw32767/university-competency-system-backend/models"
	"strings"
	"testing"
)

func TestAPIEvidenceUnavailableScoresAreNull(t *testing.T) {
	input := models.AssessmentProviderInput{Availability: []models.AssessmentSourceAvailability{{Source: "course_competency_scores", Available: true}, {Source: "free_elective_competency_scores", Reason: "recalculation_required"}}, CompetencyScores: []models.AssessmentProviderCompetency{{CompetencyRef: "score-alpha", CoreScore: 20, FreeElectiveScore: 100}}}
	raw, _ := json.Marshal(BuildAssessmentAPIEvidence(input))
	if !strings.Contains(string(raw), `"free_elective":null`) || !strings.Contains(string(raw), `"core":20`) {
		t.Fatalf("incorrect availability: %s", raw)
	}
	for _, key := range []string{"person_id", "enrollment_id", "student_id", "career_paths"} {
		if strings.Contains(string(raw), key) {
			t.Fatalf("unexpected field %s", key)
		}
	}
}

func TestAPIOutputEnvelopeDoesNotRepairInvalidContent(t *testing.T) {
	valid := []byte(`{"strengths":[],"development":[],"observations":[]}`)
	normalized, err := NormalizeAssessmentAPIOutput(valid)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = ValidateAssessmentProviderOutput(normalized, models.AssessmentProviderInput{}); err != nil {
		t.Fatal(err)
	}
	for _, raw := range []string{`{"strengths":[],"development":[],"observations":[],"extra":true}`, `{"strengths":null,"development":[],"observations":[]}`, `{"strengths":[{"sentences":[{"observation_id":"unknown","intent":"explanation","text":{"th":"ข้อความ","en":"Text"}}]}],"development":[],"observations":[]}`} {
		normalized, err = NormalizeAssessmentAPIOutput([]byte(raw))
		if err == nil {
			_, err = ValidateAssessmentProviderOutput(normalized, models.AssessmentProviderInput{})
		}
		if !errors.Is(err, ErrAssessmentOutputInvalid) {
			t.Fatalf("accepted invalid output: %v", err)
		}
	}
}

func TestAPIContextAndVersions(t *testing.T) {
	snapshot := sampleAssessmentSnapshot()
	b := AssessmentContextBudget{ContextTokens: 50000, OutputReserveTokens: 3072, SafetyMarginTokens: 128}
	snapshot.Metadata = assessmentSourceMetadata(b, AssessmentGenerationConfig{Provider: "deepseek", Model: "test"})
	prepared, err := PrepareAssessmentContext(&snapshot, b)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(prepared.UserPrompt, `"courses"`) || !strings.Contains(prepared.UserPrompt, `"source_availability"`) || strings.Contains(prepared.SystemPrompt, "exactly one coherent sentence") {
		t.Fatal("Ollama prompt reused")
	}
	if !strings.Contains(string(AssessmentAPIOutputJSONSchema(prepared.Input)), `"maxItems":3`) {
		t.Fatal("missing API prose allowance")
	}
}
