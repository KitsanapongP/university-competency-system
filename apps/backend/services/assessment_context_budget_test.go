package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"testing"
	"unicode/utf8"

	"github.com/spw32767/university-competency-system-backend/models"
)

func TestPrepareAssessmentContextIsDeterministicAndPreservesAggregatedProvenance(t *testing.T) {
	snapshot := sampleAssessmentSnapshot()
	activity := snapshot.ActivityEvidence[0]
	activity.ScoreEvidenceRef = "activity-score:1"
	snapshot.ActivityEvidence[0] = activity
	snapshot.CourseScores[0].ActivityScores[0].EvidenceRef = "activity-score:1"
	snapshot.CourseScores[0].ActivityScores[0].ActivityEvidenceRef = activity.EvidenceRef
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
	if first.Input.CompetencyScores[0].CourseScores[0].CourseRef != first.Input.AcademicEvidence[0].EvidenceRef {
		t.Fatal("compact course score should reference the centralized academic evidence")
	}
	encoded, err := json.Marshal(first.Input)
	if err != nil {
		t.Fatal(err)
	}
	var promptInput map[string]any
	if err := json.Unmarshal(encoded, &promptInput); err != nil {
		t.Fatal(err)
	}
	competencies := promptInput["competency_scores"].([]any)
	competency := competencies[0].(map[string]any)
	scores := competency["course_scores"].([]any)
	score := scores[0].(map[string]any)
	for _, repeatedField := range []string{"course_code", "course_name_th", "academic_year_be", "semester", "grade"} {
		if _, exists := score[repeatedField]; exists {
			t.Fatalf("compact competency course score repeats centralized field %q", repeatedField)
		}
	}
	activityScores := competency["activity_scores"].([]any)
	activityScore := activityScores[0].(map[string]any)
	if len(activityScore) != 2 || activityScore["evidence_ref"] == nil || activityScore["activity_evidence_ref"] == nil {
		t.Fatalf("compact activity score should contain references only: %#v", activityScore)
	}
	for _, repeatedField := range []string{"activity_name_th", "activity_name_en", "start_at", "attendance_status", "earned_percent"} {
		if _, exists := activityScore[repeatedField]; exists {
			t.Fatalf("compact competency activity score repeats centralized field %q", repeatedField)
		}
	}
	if first.Diagnostics.SourceDataBytes == 0 || first.Diagnostics.CompetencyScoresBytes == 0 ||
		first.Diagnostics.EstimatedInputTokens != first.EstimatedTokens ||
		first.Diagnostics.EstimatedTotalTokens <= first.Diagnostics.EstimatedInputTokens {
		t.Fatalf("context diagnostics are incomplete: %+v", first.Diagnostics)
	}
}

func TestPrepareAssessmentContextReturnsTypedExceededErrorWithoutDroppingFacts(t *testing.T) {
	snapshot := sampleAssessmentSnapshot()
	for index := 0; index < 30; index++ {
		snapshot.AcademicEvidence = append(snapshot.AcademicEvidence, models.AssessmentAcademicEvidence{
			EvidenceRef:  fmt.Sprintf("course:extra:%d", index),
			CourseCode:   fmt.Sprintf("PRIVATE-COURSE-CONTENT-%03d", index),
			CourseNameTH: fmt.Sprintf("รายวิชาหลักฐานที่ต้องคงไว้ %d %s", index, repeatAssessmentText("เนื้อหา", 80)),
			Grade:        "B",
		})
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
	if len(prepared.Input.AcademicEvidence) != len(snapshot.AcademicEvidence) {
		t.Fatal("context preparation must not silently drop distinct academic evidence")
	}
	if prepared.Diagnostics.InputBudgetTokens != budget.ContextTokens-budget.OutputReserveTokens-budget.SafetyMarginTokens ||
		prepared.Diagnostics.EstimatedTotalTokens <= prepared.Diagnostics.ContextTokens {
		t.Fatalf("expected input/output budget diagnostics, got %+v", prepared.Diagnostics)
	}
	if strings.Contains(err.Error(), "PRIVATE-COURSE-CONTENT") {
		t.Fatalf("context diagnostics must not include source text: %v", err)
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
