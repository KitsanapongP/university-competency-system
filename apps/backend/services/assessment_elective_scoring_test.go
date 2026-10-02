package services

import (
	"testing"

	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
)

func TestAssessmentElectiveScoringUsesBestGradeAndSelectedOfferingWeight(t *testing.T) {
	attempts := []repositories.AssessmentElectiveAttempt{
		{
			EnrollmentRecordID:   101,
			FreeElectiveCourseID: 9,
			GradeRecordID:        1001,
			AcademicYearBE:       2567,
			Semester:             1,
			CourseCode:           "GE001",
			CourseNameTH:         "วิชาเดิม",
			GradeScheme:          "letter",
			Grade:                "B",
			RoundStatus:          "finalized",
			HasGrade:             true,
			Mappings:             []repositories.AssessmentElectiveMapping{{MappingID: 1, CompetencyID: 5, CompetencyNameTH: "การสื่อสาร", Weight: 80}},
		},
		{
			EnrollmentRecordID:   202,
			FreeElectiveCourseID: 9,
			GradeRecordID:        2001,
			AcademicYearBE:       2567,
			Semester:             2,
			CourseCode:           "GE001",
			CourseNameTH:         "วิชารอบใหม่",
			GradeScheme:          "letter",
			Grade:                "A",
			RoundStatus:          "finalized",
			HasGrade:             true,
			Mappings:             []repositories.AssessmentElectiveMapping{{MappingID: 2, CompetencyID: 5, CompetencyNameTH: "การสื่อสาร", Weight: 25}},
		},
	}

	results, available, reason := calculateAssessmentElectiveScores(attempts, 2568, 1, true, false)
	if !available || reason != "" {
		t.Fatalf("expected elective score to be available, got available=%v reason=%q", available, reason)
	}
	if len(results) != 1 || results[0].FreeElectiveScore != 25 {
		t.Fatalf("expected best grade from second offering weighted at 25%%, got %+v", results)
	}
	if len(results[0].ElectiveScores) != 1 || results[0].ElectiveScores[0].CourseEvidenceRef != "course:free_elective:202" {
		t.Fatalf("expected evidence from the best-grade offering only, got %+v", results[0].ElectiveScores)
	}
}

func TestAssessmentElectiveScoringHonorsCutoffAndDoesNotSubstituteUnfinalizedBestAttempt(t *testing.T) {
	attempts := []repositories.AssessmentElectiveAttempt{
		{
			EnrollmentRecordID:   10,
			FreeElectiveCourseID: 3,
			GradeRecordID:        100,
			AcademicYearBE:       2567,
			Semester:             1,
			GradeScheme:          "letter",
			Grade:                "A",
			RoundStatus:          "finalized",
			HasGrade:             true,
			Mappings:             []repositories.AssessmentElectiveMapping{{CompetencyID: 2, Weight: 100}},
		},
		{
			EnrollmentRecordID:   11,
			FreeElectiveCourseID: 3,
			GradeRecordID:        101,
			AcademicYearBE:       2568,
			Semester:             1,
			GradeScheme:          "letter",
			Grade:                "A",
			RoundStatus:          "active",
			HasGrade:             true,
			Mappings:             []repositories.AssessmentElectiveMapping{{CompetencyID: 2, Weight: 100}},
		},
		{
			EnrollmentRecordID:   12,
			FreeElectiveCourseID: 7,
			GradeRecordID:        102,
			AcademicYearBE:       2568,
			Semester:             2,
			GradeScheme:          "letter",
			Grade:                "A",
			RoundStatus:          "finalized",
			HasGrade:             true,
			Mappings:             []repositories.AssessmentElectiveMapping{{CompetencyID: 8, Weight: 100}},
		},
	}

	results, available, reason := calculateAssessmentElectiveScores(attempts, 2568, 2, true, false)
	if available || reason != "elective_offering_not_finalized" {
		t.Fatalf("expected the higher/latest unfinalized attempt to suppress old score, got available=%v reason=%q", available, reason)
	}
	if len(results) != 0 {
		t.Fatalf("post-cutoff and superseded scores must not appear, got %+v", results)
	}
}

func TestAssessmentElectiveScoringDistinguishesSFromNonScoringGrades(t *testing.T) {
	tests := []struct {
		name      string
		grade     string
		available bool
		wantScore float64
	}{
		{name: "S", grade: "S", available: true, wantScore: 33.33},
		{name: "U", grade: "U", available: false},
		{name: "W", grade: "W", available: false},
		{name: "I", grade: "I", available: false},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			attempts := []repositories.AssessmentElectiveAttempt{{
				EnrollmentRecordID:   1,
				FreeElectiveCourseID: 2,
				GradeRecordID:        3,
				AcademicYearBE:       2567,
				Semester:             1,
				GradeScheme:          "satisfactory",
				Grade:                test.grade,
				RoundStatus:          "finalized",
				HasGrade:             true,
				Mappings:             []repositories.AssessmentElectiveMapping{{CompetencyID: 5, Weight: 33.33}},
			}}
			results, available, _ := calculateAssessmentElectiveScores(attempts, 2568, 1, true, false)
			if available != test.available {
				t.Fatalf("available = %v, want %v", available, test.available)
			}
			if test.available {
				if len(results) != 1 || results[0].FreeElectiveScore != test.wantScore || results[0].ElectiveScores[0].WeightedScore != 33.33 {
					t.Fatalf("unexpected S score result: %+v", results)
				}
			}
		})
	}
}

func TestAssessmentElectiveScoreMergesByCompetencyMasterID(t *testing.T) {
	course := []models.AssessmentCompetencyScore{{
		CompetencyID:     10,
		CompetencyNameTH: "ชื่อเดิม",
		CoreScore:        50,
		HasEvidence:      true,
		CourseScores:     []models.AssessmentCourseScore{{EvidenceRef: "course:curriculum:1"}},
	}}
	elective := []models.AssessmentCompetencyScore{{
		CompetencyID:      10,
		CompetencyNameTH:  "ชื่อใหม่",
		FreeElectiveScore: 20,
		HasEvidence:       true,
		ElectiveScores:    []models.AssessmentCourseScore{{EvidenceRef: "course:free_elective:2"}},
	}}

	merged := mergeAssessmentCompetencyScores(course, elective)
	if len(merged) != 1 || merged[0].CoreScore != 50 || merged[0].FreeElectiveScore != 20 {
		t.Fatalf("expected a single competency merged by master ID, got %+v", merged)
	}
	if merged[0].CompetencyNameTH != "ชื่อเดิม" || len(merged[0].CourseScores) != 1 || len(merged[0].ElectiveScores) != 1 {
		t.Fatalf("expected stable names and both evidence sources, got %+v", merged[0])
	}
}
