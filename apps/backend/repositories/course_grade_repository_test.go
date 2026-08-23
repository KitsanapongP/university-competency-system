package repositories

import (
	"testing"

	"github.com/spw32767/university-competency-system-backend/models"
)

func TestCourseGradeResultWhereFiltersSelectedAcademicPeriod(t *testing.T) {
	tests := []struct {
		name    string
		filters models.CourseGradeFilters
		want    string
	}{
		{
			name: "no period filter keeps all curriculum courses",
			want: "",
		},
		{
			name: "academic year and semester retain students without grades",
			filters: models.CourseGradeFilters{
				AcademicYearBE: uint64Ptr(2566),
				Semester:       uint64Ptr(2),
			},
			want: "",
		},
		{
			name: "recorded status keeps matching grades",
			filters: models.CourseGradeFilters{
				Status: "recorded",
			},
			want: " AND grade.course_student_id IS NOT NULL",
		},
		{
			name: "missing status keeps courses without a matching grade",
			filters: models.CourseGradeFilters{
				AcademicYearBE: uint64Ptr(2566),
				Semester:       uint64Ptr(2),
				Status:         "missing",
			},
			want: " AND grade.course_student_id IS NULL",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := courseGradeResultWhere(test.filters); got != test.want {
				t.Fatalf("courseGradeResultWhere() = %q, want %q", got, test.want)
			}
		})
	}
}

func uint64Ptr(value uint64) *uint64 {
	return &value
}
