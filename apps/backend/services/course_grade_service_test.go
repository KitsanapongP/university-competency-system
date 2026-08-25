package services

import (
	"testing"

	"github.com/spw32767/university-competency-system-backend/models"
)

func TestNormalizeCourseGradeRowsForPreview(t *testing.T) {
	rows, issues := normalizeCourseGradeRowsForPreview([]models.UpsertCourseGradeRow{
		{RowNumber: 2, StudentCode: " 663040000-1 ", CourseCode: "CP101", AcademicYearBE: 2569, Semester: 1, Grade: " b+ "},
		{RowNumber: 3, StudentCode: "663040000-2", CourseCode: "CP101", AcademicYearBE: 2569, Semester: 4, Grade: "A"},
	})
	if len(rows) != 1 || rows[0].Grade != "B+" || rows[0].StudentCode != "663040000-1" {
		t.Fatalf("normalized rows = %#v, want one normalized B+ row", rows)
	}
	if len(issues) != 1 || issues[0].RowNumber != 3 {
		t.Fatalf("issues = %#v, want semester issue for row 3", issues)
	}
}

func TestEnsureUniqueGradeRowsRejectsSameTerm(t *testing.T) {
	rows := []models.UpsertCourseGradeRow{
		{StudentCode: "S1", CourseCode: "CP101", AcademicYearBE: 2569, Semester: 1},
		{StudentCode: "S1", CourseCode: "CP101", AcademicYearBE: 2569, Semester: 1},
	}
	if err := ensureUniqueGradeRows(rows); err == nil {
		t.Fatal("ensureUniqueGradeRows() = nil, want duplicate error")
	}
}

func TestGradeRowKeyKeepsRetakeTermsSeparate(t *testing.T) {
	first := gradeRowKey(models.UpsertCourseGradeRow{StudentCode: "S1", CourseCode: "CP101", AcademicYearBE: 2569, Semester: 1})
	second := gradeRowKey(models.UpsertCourseGradeRow{StudentCode: "S1", CourseCode: "CP101", AcademicYearBE: 2570, Semester: 1})
	if first == second {
		t.Fatalf("grade row keys are equal for different academic years: %q", first)
	}
}

func TestNormalizeCourseGradeRowsPreservesExistingRecordIdentity(t *testing.T) {
	rows, err := normalizeCourseGradeRows([]models.UpsertCourseGradeRow{
		{
			CourseStudentID: 42,
			EnrollmentID:    7,
			StudentCode:     "S1",
			CourseCode:      "CP101",
			AcademicYearBE:  2565,
			Semester:        1,
			Grade:           "C+",
		},
	}, false)
	if err != nil {
		t.Fatalf("normalizeCourseGradeRows() error = %v", err)
	}
	if len(rows) != 1 || rows[0].CourseStudentID != 42 {
		t.Fatalf("normalized rows = %#v, want existing course_student_id 42", rows)
	}
}

func TestEnsureUniqueGradeRowsAllowsRetakeInDifferentSemester(t *testing.T) {
	rows := []models.UpsertCourseGradeRow{
		{StudentCode: "S1", CourseCode: "CP101", AcademicYearBE: 2565, Semester: 1},
		{StudentCode: "S1", CourseCode: "CP101", AcademicYearBE: 2565, Semester: 2},
	}
	if err := ensureUniqueGradeRows(rows); err != nil {
		t.Fatalf("ensureUniqueGradeRows() error = %v, want different semesters to be allowed", err)
	}
}

func TestEnsureCourseGradeChangeSetRejectsEditAndDeleteTogether(t *testing.T) {
	err := ensureCourseGradeChangeSet(
		[]models.UpsertCourseGradeRow{{CourseStudentID: 42}},
		[]uint64{42},
	)
	if err == nil {
		t.Fatal("ensureCourseGradeChangeSet() = nil, want edit/delete conflict")
	}
}
