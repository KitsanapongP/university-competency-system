package services

import (
	"github.com/spw32767/university-competency-system-backend/models"
	"strings"
	"testing"
)

func TestAssessmentObservationsOnlyComparePublishedCriteria(t *testing.T) {
	input := models.AssessmentProviderInput{
		Readiness: models.AssessmentProviderReadiness{Results: []models.AssessmentProviderReadinessResult{
			{RequirementID: 1, NameTH: "GPA", Status: CooperativeCriterionMet},
			{RequirementID: 2, NameTH: "Seminar", Status: CooperativeCriterionNotMet},
			{RequirementID: 3, NameTH: "Research", Status: CooperativeCriterionMissing},
		}},
		AcademicEvidence: []models.AssessmentProviderCourse{{EvidenceRef: "course:1", CourseNameTH: "Programming", Grade: "B+"}},
		CompetencyScores: []models.AssessmentProviderCompetency{{CompetencyRef: "competency:1", NameTH: "Analysis", HasEvidence: true, CoreScore: 165}},
		ActivityEvidence: []models.AssessmentProviderActivity{{EvidenceRef: "activity:1", ActivityNameTH: "Workshop", AttendanceStatus: "attended"}},
	}
	observations := BuildAssessmentObservations(input)
	if len(observations) != 5 {
		t.Fatalf("observations = %+v", observations)
	}
	for index, kind := range []string{"strength", "limitation", "neutral", "neutral", "neutral"} {
		if observations[index].Kind != kind {
			t.Fatalf("observation %d kind = %s", index, observations[index].Kind)
		}
	}
	if !strings.Contains(observations[3].Fact.EN, "not scores out of 100") {
		t.Fatal("weighted contribution must not imply a normalized score")
	}
}

func TestAssessmentReadinessUnavailableIsNotLearnerLimitation(t *testing.T) {
	input := models.AssessmentProviderInput{Readiness: models.AssessmentProviderReadiness{Status: CooperativeReadinessNotConfigured}}
	if len(BuildAssessmentObservations(input)) != 0 {
		t.Fatal("unavailable readiness should not create a limitation")
	}
	if !strings.Contains(assessmentReadinessExplanation(input).EN, "cannot be checked") {
		t.Fatal("missing readiness explanation")
	}
}
