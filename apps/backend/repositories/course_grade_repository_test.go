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
		{name: "no period filter keeps all curriculum courses", want: ""},
		{
			name: "academic year and semester retain students without grades",
			filters: models.CourseGradeFilters{AcademicYearBE: uint64Ptr(2566), Semester: uint64Ptr(2)},
			want: "",
		},
		{
			name: "recorded status keeps matching grades",
			filters: models.CourseGradeFilters{Status: "recorded"},
			want: " AND grade.course_student_id IS NOT NULL",
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

func TestCourseGradeMatchesPeriod(t *testing.T) {
	tests := []struct {
		name    string
		filters models.CourseGradeFilters
		want    bool
	}{
		{name: "no period filter accepts a grade from any period", want: true},
		{
			name: "academic year and semester match the same grade period",
			filters: models.CourseGradeFilters{AcademicYearBE: uint64Ptr(2566), Semester: uint64Ptr(2)},
			want: true,
		},
		{
			name: "different year does not match",
			filters: models.CourseGradeFilters{AcademicYearBE: uint64Ptr(2565)},
			want: false,
		},
		{
			name: "different semester does not match",
			filters: models.CourseGradeFilters{Semester: uint64Ptr(1)},
			want: false,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			grade := models.CourseGrade{AcademicYearBE: 2566, Semester: 2}
			if got := courseGradeMatchesPeriod(grade, test.filters); got != test.want {
				t.Fatalf("courseGradeMatchesPeriod() = %t, want %t", got, test.want)
			}
		})
	}
}

func uint64Ptr(value uint64) *uint64 {
	return &value
}
