package models

import "testing"

func TestLearnerAssessmentScopeSetsTargetYearFromEntryYear(t *testing.T) {
	scope := LearnerAssessmentScope{EntryYearBE: 2565}
	if !scope.SetTargetYear() {
		t.Fatal("expected target year to be computed")
	}
	if scope.TargetYearBE != 2568 {
		t.Fatalf("expected target year 2568, got %d", scope.TargetYearBE)
	}
}

func TestLearnerAssessmentScopeDoesNotInventTargetYear(t *testing.T) {
	scope := LearnerAssessmentScope{}
	if scope.SetTargetYear() {
		t.Fatal("expected a missing entry year to remain unavailable")
	}
	if scope.TargetYearBE != 0 {
		t.Fatalf("expected no target year, got %d", scope.TargetYearBE)
	}
}

func TestLearnerAssessmentScopeRequiresAcademicOwnershipContext(t *testing.T) {
	scope := LearnerAssessmentScope{
		PersonID:               1,
		EnrollmentID:           2,
		EnrollmentCurriculumID: 3,
		CurriculumID:           4,
		FacultyID:              5,
		EntryYearBE:            2565,
		TargetYearBE:           2568,
	}
	if !scope.HasRequiredContext() {
		t.Fatal("expected complete learner scope to be accepted")
	}
	scope.CurriculumID = 0
	if scope.HasRequiredContext() {
		t.Fatal("expected a missing curriculum to invalidate the scope")
	}
}
