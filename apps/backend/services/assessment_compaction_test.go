package services

import (
	"encoding/json"
	"fmt"
	"os"
	"reflect"
	"strings"
	"testing"

	"github.com/spw32767/university-competency-system-backend/models"
)

func TestLargeAcademicPromptIsStructuredAndFitsExperimentalContext(t *testing.T) {
	raw, err := os.ReadFile("../testdata/learner_assessment/large-academic-history.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct {
		Input models.AssessmentProviderInput `json:"input"`
	}
	if err := json.Unmarshal(raw, &fixture); err != nil {
		t.Fatal(err)
	}
	input := fixture.Input
	system, user, err := BuildAssessmentPrompt(input)
	if err != nil {
		t.Fatal(err)
	}
	tokens := EstimateAssessmentPromptTokens(system, user)
	if tokens+1024+128 > 12288 {
		t.Fatalf("experimental context overflow: %d", tokens)
	}
	if strings.Contains(user, `"th"`) || strings.Contains(user, "Synthetic course") || strings.Contains(user, "not scores out of 100") {
		t.Fatal("repeated prose or source names leaked")
	}
	observations := BuildAssessmentObservations(input)
	if len(observations) != 16 {
		t.Fatalf("expected eight terms and eight competencies, got %d", len(observations))
	}
	count, refs := 0, 0
	for _, item := range observations {
		if item.FactType == "academic_summary" {
			count += *item.Values.RecordCount
			refs += len(item.EvidenceRefs)
		}
	}
	if count != 96 || refs != 96 {
		t.Fatalf("records lost: count=%d refs=%d", count, refs)
	}
	for i, j := 0, len(input.AcademicEvidence)-1; i < j; i, j = i+1, j-1 {
		input.AcademicEvidence[i], input.AcademicEvidence[j] = input.AcademicEvidence[j], input.AcademicEvidence[i]
	}
	_, reordered, _ := BuildAssessmentPrompt(input)
	if user != reordered || !reflect.DeepEqual(observations, BuildAssessmentObservations(input)) {
		t.Fatal("unstable ordering")
	}
	t.Logf("96 records -> 8 groups; user_bytes=%d estimated_input=%d total=%d", len(user), tokens, tokens+1152)
}

func TestCompactionDoesNotHideContextOverflow(t *testing.T) {
	snapshot := sampleAssessmentSnapshot()
	for i := 0; i < 200; i++ {
		course := snapshot.AcademicEvidence[0]
		course.EvidenceRef = fmt.Sprintf("course:large:%d", i)
		course.AcademicYear = uint64(2500 + i)
		snapshot.AcademicEvidence = append(snapshot.AcademicEvidence, course)
	}
	snapshot.Metadata = assessmentSourceMetadata(DefaultAssessmentContextBudget())
	prepared, err := PrepareAssessmentContext(&snapshot, DefaultAssessmentContextBudget())
	count := 0
	for _, course := range prepared.Input.AcademicEvidence {
		count += course.OccurrenceCount
	}
	if err == nil || count != len(snapshot.AcademicEvidence) {
		t.Fatal("oversized input was accepted or truncated")
	}
}

func TestStructuredAssertionsDoNotTrustDisplayProse(t *testing.T) {
	current, minimum := 3.25, 3.0
	observation := models.AssessmentObservation{Values: models.AssessmentFactValues{CurrentValue: &current, RequiredValue: &minimum}, Fact: models.AssessmentBilingualText{EN: "untrusted 999 grade A"}}
	if validateObservationAssertions(models.AssessmentBilingualText{TH: "ผลตรวจ", EN: "Value 999"}, observation) == nil {
		t.Fatal("display prose authorized an unsupported number")
	}
	if validateObservationAssertions(models.AssessmentBilingualText{TH: "ผลตรวจ", EN: "Grade A"}, observation) == nil {
		t.Fatal("display prose authorized an unsupported grade")
	}
	if err := validateObservationAssertions(models.AssessmentBilingualText{TH: "ผลตรวจ", EN: "Current 3.25; minimum 3.00"}, observation); err != nil {
		t.Fatal(err)
	}
}
