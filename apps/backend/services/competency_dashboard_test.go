package services

import (
	"database/sql"
	"testing"

	"github.com/spw32767/university-competency-system-backend/repositories"
)

func TestFilterCourseRecordsToAssignedTemplateCompetencies(t *testing.T) {
	records := []repositories.CourseRecord{
		{RecordID: 11, CompetencyID: 7, CourseName: "Software Engineering"},
		{RecordID: 12, CompetencyID: 99, CourseName: "Unmapped course"},
		{RecordID: 13, CompetencyID: 9, CourseName: "Database"},
	}
	allowed := []repositories.CompetencyRecord{
		{ID: 7},
		{ID: 9},
	}

	filtered := filterCourseRecords(records, allowed)
	if len(filtered) != 2 {
		t.Fatalf("expected 2 assigned competency records, got %d", len(filtered))
	}
	if filtered[0].RecordID != 11 || filtered[1].RecordID != 13 {
		t.Fatalf("unexpected filtered records: %#v", filtered)
	}
}

func TestFilterActivityRecordsToAssignedTemplateCompetencies(t *testing.T) {
	records := []repositories.ActivityRecord{
		{SessionCompetencyID: 21, CompetencyID: 7},
		{SessionCompetencyID: 22, CompetencyID: 100},
	}

	filtered := filterActivityRecords(records, []repositories.CompetencyRecord{{ID: 7}})
	if len(filtered) != 1 || filtered[0].SessionCompetencyID != 21 {
		t.Fatalf("unexpected filtered activity records: %#v", filtered)
	}
}

func TestHasAnyResultRecognizesZeroScoreResult(t *testing.T) {
	progress := map[int64]repositories.LearnerCompetencyProgressRecord{
		7: {HasResult: true},
	}

	if !hasAnyResult(progress) {
		t.Fatal("expected a persisted zero-score result to count as calculated")
	}
}

func TestProcessCoursesUsesScoreSnapshotAndAcademicYear(t *testing.T) {
	service := &CompetencyService{}
	rows := []repositories.CourseRecord{
		{
			RecordID:     501,
			CourseID:     99,
			CompetencyID: 7,
			CourseName:   "Software Engineering",
			AcademicYear: "2568",
			Score:        sql.NullFloat64{Float64: 10, Valid: true},
		},
	}

	activities := service.processCourses(rows)
	if len(activities[7]) != 1 {
		t.Fatalf("expected one course score activity, got %#v", activities)
	}
	item := activities[7][0]
	if item.ID != 501 || item.Year != "2568" || item.Score != 10 {
		t.Fatalf("course history did not preserve snapshot data: %#v", item)
	}
}
