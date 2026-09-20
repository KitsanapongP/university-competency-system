package services

import (
	"context"
	"errors"
	"testing"

	"github.com/spw32767/university-competency-system-backend/models"
)

func TestValidateNewRoundCourseRequiresInlineFields(t *testing.T) {
	tests := []struct {
		name  string
		input models.FreeElectiveRoundCourseInput
		path  string
		code  string
	}{
		{
			name: "course name",
			input: models.FreeElectiveRoundCourseInput{
				CourseCode:  "GE101",
				Credits:     3,
				GradeScheme: "letter",
			},
			path: "courses[0].course_name_th",
			code: "COURSE_NAME_REQUIRED",
		},
		{
			name: "credits",
			input: models.FreeElectiveRoundCourseInput{
				CourseCode:   "GE101",
				CourseNameTH: "วิชาเสรี",
				GradeScheme:  "letter",
			},
			path: "courses[0].credits",
			code: "INVALID_CREDITS",
		},
		{
			name: "grade scheme",
			input: models.FreeElectiveRoundCourseInput{
				CourseCode:   "GE101",
				CourseNameTH: "วิชาเสรี",
				Credits:      3,
				GradeScheme:  "numeric",
			},
			path: "courses[0].grade_scheme",
			code: "INVALID_GRADE_SCHEME",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			issue := validateNewRoundCourse(test.input, "courses[0]")
			if issue == nil {
				t.Fatal("validateNewRoundCourse() = nil, want validation issue")
			}
			if issue.Path != test.path || issue.Code != test.code {
				t.Fatalf("validateNewRoundCourse() = %#v, want path %q and code %q", issue, test.path, test.code)
			}
		})
	}
}

func TestValidateNewRoundCourseAcceptsCompleteInlineCourse(t *testing.T) {
	issue := validateNewRoundCourse(models.FreeElectiveRoundCourseInput{
		CourseCode:   "GE101",
		CourseNameTH: "วิชาเสรี",
		Credits:      3,
		GradeScheme:  "satisfactory",
	}, "courses[0]")
	if issue != nil {
		t.Fatalf("validateNewRoundCourse() = %#v, want nil", issue)
	}
}

func TestValidateRoundCourseCompetenciesAllowsEmptyMappings(t *testing.T) {
	service := &FreeElectiveService{}

	if err := service.validateRoundCourseCompetencies(context.Background(), nil); err != nil {
		t.Fatalf("validateRoundCourseCompetencies() = %v, want nil for an optional mapping", err)
	}
}

func TestRoundCourseLearnerSelectionRequiresAtLeastOneFilter(t *testing.T) {
	if err := validateRoundCourseLearnerSelection(models.FreeElectiveRoundLearnerFilters{}); err == nil {
		t.Fatal("validateRoundCourseLearnerSelection() = nil, want a filter validation error")
	}

	entryYear := uint64(2568)
	curriculumID := uint64(12)
	majorID := uint64(15)
	facultyID := uint64(20)
	tests := []models.FreeElectiveRoundLearnerFilters{
		{FacultyID: &facultyID},
		{MajorID: &majorID},
		{CurriculumID: &curriculumID},
		{EntryYearBE: &entryYear},
		{Search: "6530"},
		{CurriculumID: &curriculumID, EntryYearBE: &entryYear},
	}
	for _, filters := range tests {
		if err := validateRoundCourseLearnerSelection(filters); err != nil {
			t.Fatalf("validateRoundCourseLearnerSelection(%#v) = %v, want nil", filters, err)
		}
	}
}

func TestValidateRoundCourseEnrollmentIDs(t *testing.T) {
	valid := []uint64{11, 12, 13}
	if err := validateRoundCourseEnrollmentIDs(valid); err != nil {
		t.Fatalf("validateRoundCourseEnrollmentIDs(%v) = %v, want nil", valid, err)
	}

	tests := []struct {
		name string
		ids  []uint64
	}{
		{name: "empty", ids: nil},
		{name: "zero id", ids: []uint64{11, 0}},
		{name: "duplicate id", ids: []uint64{11, 11}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if err := validateRoundCourseEnrollmentIDs(test.ids); err == nil {
				t.Fatalf("validateRoundCourseEnrollmentIDs(%v) = nil, want validation error", test.ids)
			}
		})
	}
}

func TestNormalizeFreeElectiveCourseCodeIsCaseInsensitiveAndTrimmed(t *testing.T) {
	if got := normalizeFreeElectiveCourseCode(" ge101 "); got != "GE101" {
		t.Fatalf("normalizeFreeElectiveCourseCode() = %q, want GE101", got)
	}
}

func TestRoundCourseErrorCodeMapsKnownResolutionErrors(t *testing.T) {
	tests := map[string]string{
		"the selected free-elective course was not found":               "COURSE_NOT_FOUND",
		"the selected course belongs to another faculty":                "COURSE_FACULTY_MISMATCH",
		"inactive free-elective courses cannot be added to a new round": "COURSE_INACTIVE",
	}
	for message, want := range tests {
		if got := roundCourseErrorCode(errors.New(message)); got != want {
			t.Fatalf("roundCourseErrorCode(%q) = %q, want %q", message, got, want)
		}
	}
}
