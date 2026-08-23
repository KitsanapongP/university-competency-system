package services

import (
	"errors"
	"testing"

	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/utils"
)

func TestExecutiveScopeRestrictsDeanToClaimedFaculty(t *testing.T) {
	repository := &ExecutiveAnalyticsService{}
	facultyID := int64(7)
	sameFaculty := uint64(7)
	otherFaculty := uint64(8)
	claims := &utils.Claims{Roles: []string{"dean"}, FacultyID: &facultyID}

	scoped, err := repository.scopedFilters(claims, models.ExecutiveAnalyticsFilters{FacultyID: &sameFaculty})
	if err != nil {
		t.Fatalf("same faculty should be allowed: %v", err)
	}
	if scoped.FacultyID == nil || *scoped.FacultyID != sameFaculty {
		t.Fatalf("expected faculty %d, got %#v", sameFaculty, scoped.FacultyID)
	}

	_, err = repository.scopedFilters(claims, models.ExecutiveAnalyticsFilters{FacultyID: &otherFaculty})
	if !errors.Is(err, ErrExecutiveForbidden) {
		t.Fatalf("expected cross-faculty request to be forbidden, got %v", err)
	}
}

func TestExecutiveScopeAllowsAdminFacultySelection(t *testing.T) {
	facultyID := uint64(8)
	claims := &utils.Claims{Roles: []string{"admin"}}
	scoped, err := (&ExecutiveAnalyticsService{}).scopedFilters(
		claims,
		models.ExecutiveAnalyticsFilters{FacultyID: &facultyID},
	)
	if err != nil {
		t.Fatalf("admin should select a faculty: %v", err)
	}
	if scoped.FacultyID == nil || *scoped.FacultyID != facultyID {
		t.Fatalf("expected selected faculty %d", facultyID)
	}
}

func TestSummarizeCompetenciesSeparatesRequiredAndTrackingFlags(t *testing.T) {
	items := []models.ExecutiveCompetencyAggregate{
		{CompetencyID: 1, NameTH: "การสื่อสาร", TargetScore: 80, IsRequired: true, AverageScore: 70, EvaluatedCount: 2, PassedCount: 1},
		{CompetencyID: 1, NameTH: "การสื่อสาร", TargetScore: 80, IsRequired: true, AverageScore: 90, EvaluatedCount: 2, PassedCount: 2},
		{CompetencyID: 2, NameTH: "การเรียนรู้สิ่งใหม่", TargetScore: 0, IsRequired: false, AverageScore: 75, EvaluatedCount: 2, PassedCount: 0},
	}

	got := summarizeCompetencies(items)
	if len(got) != 2 {
		t.Fatalf("expected two competencies, got %d", len(got))
	}
	for _, item := range got {
		if item.CompetencyID == 1 {
			if !item.IsRequired || item.EvaluatedCount != 4 || item.PassedCount != 3 {
				t.Fatalf("required aggregate was incorrect: %#v", item)
			}
			if item.AverageScore != 80 || item.PassRate != 75 {
				t.Fatalf("required score aggregate was incorrect: %#v", item)
			}
		}
		if item.CompetencyID == 2 && item.IsRequired {
			t.Fatal("tracking competency must not become a graduation requirement")
		}
	}
}

func TestAggregateStudentsDoesNotUseTrackingCompetencyForPassing(t *testing.T) {
	facts := []models.ExecutiveStudentFact{
		{EnrollmentID: 10, StudentCode: "S001", CompetencyID: 1, IsRequired: true, TargetScore: 80, CourseTotal: 85, HasScore: true},
		{EnrollmentID: 10, StudentCode: "S001", CompetencyID: 2, IsRequired: false, TargetScore: 0, CourseTotal: 0, HasScore: false},
		{EnrollmentID: 11, StudentCode: "S002", CompetencyID: 1, IsRequired: true, TargetScore: 80, CourseTotal: 70, HasScore: true},
	}

	got := aggregateStudents(facts)
	if len(got) != 2 {
		t.Fatalf("expected two students, got %d", len(got))
	}
	if !got[0].Passed || got[0].RequiredCount != 1 {
		t.Fatalf("student above required target should pass: %#v", got[0])
	}
	if got[1].Passed || got[1].RequiredCount != 1 {
		t.Fatalf("student below required target should not pass: %#v", got[1])
	}
}
