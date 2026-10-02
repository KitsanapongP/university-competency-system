package services

import (
	"testing"

	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
)

func TestAssessmentCourseScoringUsesBestCutoffGradeAndSplitsCoreBonus(t *testing.T) {
	evidence := []models.AssessmentAcademicEvidence{
		{RecordID: 1, CourseID: 10, Source: "curriculum", AcademicYear: 2566, Semester: 1, CourseCode: "CS101", GradeScheme: "letter", Grade: "B"},
		{RecordID: 2, CourseID: 10, Source: "curriculum", AcademicYear: 2567, Semester: 1, CourseCode: "CS101", GradeScheme: "letter", Grade: "A"},
		{RecordID: 3, CourseID: 11, Source: "curriculum", AcademicYear: 2567, Semester: 1, CourseCode: "CS102", GradeScheme: "letter", Grade: "B+"},
		{RecordID: 4, CourseID: 12, Source: "free_elective", AcademicYear: 2567, Semester: 1, CourseCode: "GE100", GradeScheme: "satisfactory", Grade: "S"},
	}
	setup := repositories.AssessmentCourseScoringSetup{
		HasAssignment:     true,
		HasActiveTemplate: true,
		Mappings: []repositories.AssessmentCourseMapping{
			{CourseID: 10, CompetencyID: 50, CompetencyNameTH: "การแก้ปัญหา", Weight: 40, ScoreType: "core"},
			{CourseID: 11, CompetencyID: 50, CompetencyNameTH: "การแก้ปัญหา", Weight: 30, ScoreType: "bonus"},
		},
	}

	results, available, reason := calculateAssessmentCourseScores(evidence, setup, "")
	if !available || reason != "" {
		t.Fatalf("expected course scores to be available, got available=%v reason=%q", available, reason)
	}
	if len(results) != 1 {
		t.Fatalf("expected one competency, got %d", len(results))
	}
	got := results[0]
	if got.CoreScore != 40 {
		t.Fatalf("expected core score 40 from best A, got %v", got.CoreScore)
	}
	if got.BonusScore != 25.5 {
		t.Fatalf("expected bonus score 25.5, got %v", got.BonusScore)
	}
	if !got.HasEvidence || len(got.CourseScores) != 2 {
		t.Fatalf("expected both course contributions as evidence, got %+v", got)
	}
}

func TestAssessmentCourseScoringDoesNotTreatMissingOrNonScoringGradesAsZeroEvidence(t *testing.T) {
	evidence := []models.AssessmentAcademicEvidence{
		{RecordID: 1, CourseID: 10, Source: "curriculum", GradeScheme: "letter", Grade: ""},
		{RecordID: 2, CourseID: 11, Source: "curriculum", GradeScheme: "letter", Grade: "W"},
		{RecordID: 3, CourseID: 12, Source: "curriculum", GradeScheme: "letter", Grade: "I"},
		{RecordID: 4, CourseID: 13, Source: "curriculum", GradeScheme: "satisfactory", Grade: "U"},
	}
	setup := repositories.AssessmentCourseScoringSetup{
		HasAssignment:     true,
		HasActiveTemplate: true,
		Mappings: []repositories.AssessmentCourseMapping{
			{CourseID: 10, CompetencyID: 50, Weight: 100, ScoreType: "core"},
			{CourseID: 11, CompetencyID: 51, Weight: 100, ScoreType: "core"},
			{CourseID: 12, CompetencyID: 52, Weight: 100, ScoreType: "bonus"},
			{CourseID: 13, CompetencyID: 53, Weight: 100, ScoreType: "bonus"},
		},
	}

	results, available, reason := calculateAssessmentCourseScores(evidence, setup, "")
	if available || reason != "no_mapped_course_grades_before_target" {
		t.Fatalf("expected missing score evidence, got available=%v reason=%q", available, reason)
	}
	for _, result := range results {
		if result.HasEvidence || result.CoreScore != 0 || result.BonusScore != 0 || len(result.CourseScores) != 0 {
			t.Fatalf("non-scoring grade must not be represented as score evidence: %+v", result)
		}
	}
}

func TestAssessmentCourseScoringMarksRecalculationAsUnavailable(t *testing.T) {
	setup := repositories.AssessmentCourseScoringSetup{
		HasAssignment:         true,
		HasActiveTemplate:     true,
		RecalculationRequired: true,
		Mappings: []repositories.AssessmentCourseMapping{
			{CourseID: 10, CompetencyID: 50, Weight: 100, ScoreType: "core"},
		},
	}
	results, available, reason := calculateAssessmentCourseScores(nil, setup, "course_scores_recalculation_required")
	if available || reason != "course_scores_recalculation_required" || len(results) != 0 {
		t.Fatalf("expected recalculation to suppress derived scores, got %+v %v %q", results, available, reason)
	}
}
