package services

import (
	"testing"

	"github.com/spw32767/university-competency-system-backend/models"
)

func TestStudyYearUsesEntryYear(t *testing.T) {
	tests := []struct {
		name       string
		entryYear  uint64
		courseYear uint64
		expected   uint64
	}{
		{name: "first academic year", entryYear: 2566, courseYear: 2566, expected: 1},
		{name: "fourth academic year", entryYear: 2566, courseYear: 2569, expected: 4},
		{name: "missing entry year", entryYear: 0, courseYear: 2566, expected: 0},
		{name: "course before entry", entryYear: 2566, courseYear: 2565, expected: 0},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if actual := studyYear(test.entryYear, test.courseYear); actual != test.expected {
				t.Fatalf("studyYear(%d, %d) = %d, expected %d", test.entryYear, test.courseYear, actual, test.expected)
			}
		})
	}
}

func TestSortLearnerAcademicCoursesKeepsEveryAttemptAndGroupsChronologically(t *testing.T) {
	courses := []models.LearnerAcademicCourse{
		{RecordID: 4, Source: "free_elective", AcademicYearBE: 2567, Semester: 1, CourseCode: "FE200"},
		{RecordID: 2, Source: "curriculum", AcademicYearBE: 2566, Semester: 2, CourseCode: "CP101"},
		{RecordID: 5, Source: "curriculum", AcademicYearBE: 2566, Semester: 3, CourseCode: "CP102"},
		{RecordID: 3, Source: "curriculum", AcademicYearBE: 2566, Semester: 1, CourseCode: "CP101"},
		{RecordID: 1, Source: "curriculum", AcademicYearBE: 2566, Semester: 1, CourseCode: "CP101"},
	}

	sortLearnerAcademicCourses(courses)

	if len(courses) != 5 {
		t.Fatalf("expected every course attempt to remain, got %d records", len(courses))
	}

	expectedIDs := []uint64{1, 3, 2, 5, 4}
	for index, expectedID := range expectedIDs {
		if courses[index].RecordID != expectedID {
			t.Fatalf("course at position %d has id %d, expected %d", index, courses[index].RecordID, expectedID)
		}
	}
}
