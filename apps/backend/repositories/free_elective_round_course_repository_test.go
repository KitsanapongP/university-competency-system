package repositories

import (
	"strings"
	"testing"

	"github.com/spw32767/university-competency-system-backend/models"
)

func TestRoundCourseLearnerScopeAppliesCohortFiltersAndSearch(t *testing.T) {
	facultyID := uint64(1)
	majorID := uint64(2)
	curriculumID := uint64(3)
	entryYear := uint64(2568)

	query, args := roundCourseLearnerScope(10, 20, models.FreeElectiveRoundLearnerFilters{
		Search:       "6530",
		FacultyID:    &facultyID,
		MajorID:      &majorID,
		CurriculumID: &curriculumID,
		EntryYearBE:  &entryYear,
	})

	for _, fragment := range []string{
		"faculty.faculty_id = ?",
		"major.major_id = ?",
		"curriculum.curriculum_id = ?",
		"cohort.entry_year_be = ?",
		"student.student_code LIKE ?",
	} {
		if !strings.Contains(query, fragment) {
			t.Fatalf("roundCourseLearnerScope() does not contain %q", fragment)
		}
	}
	if len(args) != 9 || args[0] != uint64(10) || args[1] != uint64(20) {
		t.Fatalf("roundCourseLearnerScope() args = %#v, want round and filter arguments", args)
	}
}

func TestRoundCourseLearnerScopeOmitsEmptyOptionalFilters(t *testing.T) {
	query, args := roundCourseLearnerScope(10, 20, models.FreeElectiveRoundLearnerFilters{})
	for _, fragment := range []string{
		"faculty.faculty_id = ?",
		"major.major_id = ?",
		"curriculum.curriculum_id = ?",
		"cohort.entry_year_be = ?",
		"student.student_code LIKE ?",
	} {
		if strings.Contains(query, fragment) {
			t.Fatalf("roundCourseLearnerScope() unexpectedly contains %q", fragment)
		}
	}
	if len(args) != 2 {
		t.Fatalf("roundCourseLearnerScope() args = %#v, want only round identifiers", args)
	}
}
