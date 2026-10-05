package services

import (
	"github.com/spw32767/university-competency-system-backend/models"
	"strings"
	"testing"
)

func TestAssessmentProsePreservesMissingCriteriaAndSourceScope(t *testing.T) {
	input := models.AssessmentProviderInput{Semester: 1, TargetYearBE: 2569,
		Readiness:    models.AssessmentProviderReadiness{RequirementCount: 1, Results: []models.AssessmentProviderReadinessResult{{RequirementID: 4, NameTH: "Seminar", Status: CooperativeCriterionMissing}}},
		Availability: []models.AssessmentSourceAvailability{{Source: "course_competency_scores", Reason: "course_scores_recalculation_required"}},
	}
	report := newAssessmentProseReport(input)
	if !strings.Contains(report.Narrative.Readiness[0].Text.EN, "no met or not-met conclusion") || len(report.Narrative.Readiness[0].EvidenceRefs) != 1 {
		t.Fatal("missing criteria must remain accessible without being failed")
	}
	if !strings.Contains(report.Narrative.DataScope[0].Text.EN, "recalculation") || !strings.Contains(report.Narrative.DataScope[0].Text.EN, "latest") {
		t.Fatal("source scope and reason must be explicit")
	}
	if len(report.Narrative.Development) != 0 {
		t.Fatal("unavailable data must not fabricate limitations")
	}
}
