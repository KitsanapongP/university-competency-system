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

func TestActivityCompetenciesAreDerivedFromFinalizedSessionRecords(t *testing.T) {
	nameEN := "Communication"
	records := []repositories.ActivityRecord{
		{
			SessionCompetencyID: 21,
			CompetencyID:        7,
			CompetencyCode:      "tst_csk",
			CompetencyNameTH:    "การคิดเชิงระบบ",
			CompetencyNameEN:    &nameEN,
		},
		{
			SessionCompetencyID: 22,
			CompetencyID:        7,
			CompetencyCode:      "tst_csk",
			CompetencyNameTH:    "การคิดเชิงระบบ",
			CompetencyNameEN:    &nameEN,
		},
		{
			SessionCompetencyID: 23,
			CompetencyID:        100,
			CompetencyCode:      "activity_only",
			CompetencyNameTH:    "สมรรถนะกิจกรรม",
		},
	}

	competencies := activityCompetencies(records)
	if len(competencies) != 2 {
		t.Fatalf("expected two unique activity competencies, got %#v", competencies)
	}
	if competencies[0].ID != 7 || competencies[1].ID != 100 {
		t.Fatalf("expected deterministic activity competency ordering, got %#v", competencies)
	}
	if competencies[1].NameTH != "สมรรถนะกิจกรรม" {
		t.Fatalf("expected activity-only competency to be preserved, got %#v", competencies[1])
	}
}

func TestActivityProgressAccumulatesScoresAcrossSessionsWithoutCap(t *testing.T) {
	records := []repositories.ActivityRecord{
		{CompetencyID: 7, EarnedPercent: sql.NullFloat64{Float64: 65, Valid: true}},
		{CompetencyID: 7, EarnedPercent: sql.NullFloat64{Float64: 55, Valid: true}},
		{CompetencyID: 100, EarnedPercent: sql.NullFloat64{Float64: 25, Valid: true}},
	}

	progress := activityProgress(records)
	if progress[7].ActivityScore != 120 || progress[7].AccumulatedScore != 120 {
		t.Fatalf("expected activity score to accumulate above 100, got %#v", progress[7])
	}
	if progress[100].ActivityScore != 25 {
		t.Fatalf("expected independent activity competency score, got %#v", progress[100])
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
