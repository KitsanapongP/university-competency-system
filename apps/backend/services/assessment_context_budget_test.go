package services

import (
	"errors"
	"fmt"
	"reflect"
	"strings"
	"testing"
	"unicode/utf8"
)

func TestPrepareAssessmentContextIsDeterministicAndPreservesAggregatedProvenance(t *testing.T) {
	snapshot := sampleAssessmentSnapshot()
	baseCourse := snapshot.AcademicEvidence[0]
	baseScore := snapshot.CourseScores[0].CourseScores[0]
	snapshot.AcademicEvidence = nil
	snapshot.CourseScores[0].CourseScores = nil
	for index := 1; index <= 4; index++ {
		course := baseCourse
		course.EvidenceRef = fmt.Sprintf("course:curriculum:%d", index)
		snapshot.AcademicEvidence = append(snapshot.AcademicEvidence, course)
		score := baseScore
		score.EvidenceRef = fmt.Sprintf("score:course:%d", index)
		score.CourseEvidenceRef = course.EvidenceRef
		snapshot.CourseScores[0].CourseScores = append(snapshot.CourseScores[0].CourseScores, score)
	}

	first, err := PrepareAssessmentContext(&snapshot, DefaultAssessmentContextBudget())
	if err != nil {
		t.Fatal(err)
	}
	second, err := PrepareAssessmentContext(&snapshot, DefaultAssessmentContextBudget())
	if err != nil {
		t.Fatal(err)
	}
	if first.UserPrompt != second.UserPrompt || first.EstimatedTokens != second.EstimatedTokens || !reflect.DeepEqual(first.Provenance, second.Provenance) {
		t.Fatal("identical source snapshot and budget must produce identical context and provenance")
	}
	if len(first.Input.AcademicEvidence) != 1 || first.Input.AcademicEvidence[0].OccurrenceCount != 4 {
		t.Fatalf("expected four duplicate course facts to be represented once with count, got %+v", first.Input.AcademicEvidence)
	}
	refs := expandAssessmentProvenance([]string{first.Input.AcademicEvidence[0].EvidenceRef}, first.Provenance)
	if len(refs) != 4 {
		t.Fatalf("aggregated course provenance expanded to %d refs, want 4: %#v", len(refs), refs)
	}
	if len(first.Input.CompetencyScores[0].CourseScores) != 1 || first.Input.CompetencyScores[0].CourseScores[0].OccurrenceCount != 4 {
		t.Fatalf("expected matching duplicate scores to be aggregated, got %+v", first.Input.CompetencyScores[0].CourseScores)
	}
}

func TestPrepareAssessmentContextReturnsTypedExceededErrorWithoutDroppingFacts(t *testing.T) {
	snapshot := sampleAssessmentSnapshot()
	for index := 0; index < 30; index++ {
		career := snapshot.EligibleCareers[0]
		career.CareerPathID += uint64(index + 1)
		career.Code = fmt.Sprintf("CAREER-%d", index)
		career.NameTH = fmt.Sprintf("สายงานทดสอบ %d", index)
		career.DescriptionTH = assessmentStringPointer(fmt.Sprintf("รายละเอียดที่ต้องคงไว้ %s", repeatAssessmentText("เนื้อหา", 80)))
		snapshot.EligibleCareers = append(snapshot.EligibleCareers, career)
	}
	budget := AssessmentContextBudget{ContextTokens: 1024, OutputReserveTokens: 256, SafetyMarginTokens: 64}
	snapshot.Metadata = assessmentSourceMetadata(budget)
	prepared, err := PrepareAssessmentContext(&snapshot, budget)
	if !errors.Is(err, ErrAssessmentContextExceeded) {
		t.Fatalf("expected typed context exceeded error, got %v", err)
	}
	var exceeded AssessmentContextExceededError
	if !errors.As(err, &exceeded) || exceeded.EstimatedTokens <= exceeded.ContextTokens {
		t.Fatalf("expected budget details in typed error, got %#v", err)
	}
	if len(prepared.Input.EligibleCareers) != len(snapshot.EligibleCareers) {
		t.Fatal("context preparation must not silently drop eligible career paths")
	}
}

func TestAssessmentTokenEstimateIncludesThaiAndMargin(t *testing.T) {
	latin := EstimateAssessmentPromptTokens("", "one two three")
	thai := EstimateAssessmentPromptTokens("", "ภาษาไทย")
	if latin < 5 || thai <= utf8.RuneCountInString("ภาษาไทย") {
		t.Fatalf("token estimator should account for Latin words, Thai runes, and margin: latin=%d thai=%d", latin, thai)
	}
}

func repeatAssessmentText(value string, count int) string {
	return strings.Repeat(value, count)
}
