package services

import (
	"testing"

	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
)

func TestBuildAssessmentAcademicEvidenceAppliesSemesterCutoffAndKeepsSummer(t *testing.T) {
	records := []repositories.CooperativeAcademicRecord{
		{RecordID: 1, Source: "curriculum", AcademicYear: 2567, Semester: 3, Grade: "A"},
		{RecordID: 2, Source: "curriculum", AcademicYear: 2568, Semester: 1, Grade: "B"},
		{RecordID: 3, Source: "curriculum", AcademicYear: 2568, Semester: 2, Grade: "A"},
		{RecordID: 4, Source: "curriculum", AcademicYear: 2568, Semester: 3, Grade: "A"},
	}

	evidence := buildAssessmentAcademicEvidence(records, 2568, 2)
	if len(evidence) != 2 {
		t.Fatalf("expected summer and semester 1 evidence, got %d records", len(evidence))
	}
	if evidence[0].Semester != 3 || evidence[0].AcademicYear != 2567 {
		t.Fatalf("expected previous academic year's summer first, got %d/%d", evidence[0].AcademicYear, evidence[0].Semester)
	}
	if evidence[1].Semester != 1 || evidence[1].AcademicYear != 2568 {
		t.Fatalf("expected target year's semester 1, got %d/%d", evidence[1].AcademicYear, evidence[1].Semester)
	}
}

func TestBuildAssessmentAcademicEvidenceUsesSourceQualifiedIdentity(t *testing.T) {
	records := []repositories.CooperativeAcademicRecord{
		{RecordID: 9, CourseID: 20, Source: "curriculum", AcademicYear: 2567, Semester: 1, Grade: "A"},
		{RecordID: 9, CourseID: 20, Source: "free_elective", AcademicYear: 2567, Semester: 1, Grade: "S"},
	}
	evidence := buildAssessmentAcademicEvidence(records, 2568, 1)
	if len(evidence) != 2 {
		t.Fatalf("expected both source records, got %d", len(evidence))
	}
	if evidence[0].EvidenceRef == evidence[1].EvidenceRef {
		t.Fatalf("source-qualified refs must not collide: %q", evidence[0].EvidenceRef)
	}
}

func TestAssessmentBaseAvailabilityExplainsMissingSources(t *testing.T) {
	readiness := models.CooperativeReadinessResult{Status: CooperativeReadinessNotConfigured}
	availability := buildAssessmentBaseAvailability(readiness, nil, false, "template_assignment_missing", false, "cohort_not_found")
	if len(availability) != 4 {
		t.Fatalf("expected four source statuses, got %d", len(availability))
	}
	if availability[0].Available || availability[0].Reason != "criteria_not_published" {
		t.Fatalf("expected readiness configuration reason, got %+v", availability[0])
	}
	if availability[1].Available || availability[1].Reason != "no_graded_courses_before_target" {
		t.Fatalf("expected academic grade reason, got %+v", availability[1])
	}
	if availability[2].Available || availability[2].Reason != "template_assignment_missing" {
		t.Fatalf("expected course mapping reason, got %+v", availability[2])
	}
	if availability[3].Available || availability[3].Reason != "cohort_not_found" {
		t.Fatalf("expected elective scoring reason, got %+v", availability[3])
	}
}
