package services

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"

	"github.com/spw32767/university-competency-system-backend/models"
)

func TestAssessmentQualitativeProjectionPreservesEvidenceAndInput(t *testing.T) {
	input := validAssessmentProviderInput()
	value, grade := 3.57, "B+"
	input.Readiness.Results[0].CurrentValue = &value
	input.Readiness.Results[0].CurrentGrade = &grade
	input.Readiness.Results[0].NameTH = "private source instruction"
	input.Readiness.Results = append(input.Readiness.Results, models.AssessmentProviderReadinessResult{RequirementID: 99, Status: "missing_grade"})
	input.AcademicEvidence[0].Grade = grade
	input.AcademicEvidence[0].CourseNameEN = "private source instruction"
	input.CompetencyScores = []models.AssessmentProviderCompetency{{CompetencyRef: "competency:5", HasEvidence: true, CoreScore: 999.75, NameTH: "private source instruction"}}
	input.ActivityEvidence = []models.AssessmentProviderActivity{{EvidenceRef: "activity:8", AttendanceStatus: "attended", ActivityNameTH: "private source instruction", Score: &value}}
	before, _ := json.Marshal(input)
	original := BuildAssessmentObservations(input)
	projected := buildAssessmentQualitativeObservations(input)
	if len(projected) != len(original) {
		t.Fatal("lost known observations")
	}
	for i, item := range projected {
		if item.ObservationID != original[i].ObservationID || item.Kind != original[i].Kind {
			t.Fatal("changed lineage or classification")
		}
		if item.Meaning == "" || item.MeaningTH == "" {
			t.Fatal("missing qualitative meaning")
		}
	}
	_, prompt, err := BuildAssessmentPrompt(input)
	if err != nil {
		t.Fatal(err)
	}
	for _, forbidden := range []string{"3.57", "999.75", "B+", "private source instruction", "grade_counts", "current_value", "readiness:99"} {
		if strings.Contains(prompt, forbidden) {
			t.Fatalf("source value leaked: %s", forbidden)
		}
	}
	after, _ := json.Marshal(input)
	if !reflect.DeepEqual(before, after) {
		t.Fatal("projection mutated input")
	}
	if !strings.Contains(projected[0].Meaning, "criterion is met") || !strings.Contains(projected[1].Meaning, "not yet met") {
		t.Fatal("readiness reversed")
	}
	if !strings.Contains(projected[3].MeaningTH, "คะแนนสมรรถนะสะสม") || !strings.Contains(projected[4].MeaningTH, "การเข้าร่วมกิจกรรม") {
		t.Fatal("missing reviewed Thai terminology")
	}
}

func TestAssessmentQualitativeAcademicAvailability(t *testing.T) {
	for _, tc := range []struct {
		name   string
		grades []string
		want   string
	}{
		{"published", []string{"B+"}, "Recorded academic results"},
		{"pending", []string{""}, "awaiting publication"},
		{"mixed", []string{"A", ""}, "coexist"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			input := models.AssessmentProviderInput{}
			for _, grade := range tc.grades {
				input.AcademicEvidence = append(input.AcademicEvidence, models.AssessmentProviderCourse{Grade: grade})
			}
			items := buildAssessmentQualitativeObservations(input)
			if len(items) != 1 || items[0].Kind != "neutral" || !strings.Contains(items[0].Meaning, tc.want) {
				t.Fatalf("wrong academic projection: %+v", items)
			}
		})
	}
	if len(buildAssessmentQualitativeObservations(models.AssessmentProviderInput{})) != 0 {
		t.Fatal("empty input invented evidence")
	}
}
