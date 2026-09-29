package services

import (
	"testing"

	"github.com/spw32767/university-competency-system-backend/models"
)

func TestValidateCooperativeRequirementsAllowsSubsetOfCriterionTypes(t *testing.T) {
	minimum := 3.25
	requirements := []models.CooperativeRequirement{
		{
			CriterionType: models.CoopCriterionOverallGPA,
			NameTH:        "เกรดเฉลี่ยรวม",
			MinimumValue:  &minimum,
		},
	}

	if err := validateCooperativeRequirements(nil, requirements, true); err != nil {
		t.Fatalf("validateCooperativeRequirements() error = %v, want one configured criterion to be valid", err)
	}
}

func TestValidateCooperativeRequirementsRequiresOneCompleteCriterionToPublish(t *testing.T) {
	if err := validateCooperativeRequirements(nil, nil, true); err == nil {
		t.Fatal("validateCooperativeRequirements() accepted an empty published set")
	}

	if err := validateCooperativeRequirements(nil, nil, false); err != nil {
		t.Fatalf("validateCooperativeRequirements() rejected an empty draft: %v", err)
	}
}

func TestValidateCooperativeRequirementsChecksCourseAndCategoryBelongToCurriculum(t *testing.T) {
	minimum := 3.0
	categoryID := uint64(10)
	courseID := uint64(20)
	letterGrade := "B"
	categories := []*models.CourseCategoryNode{
		{
			CategoryID: 1,
			IsActive:   true,
			Children: []*models.CourseCategoryNode{
				{
					CategoryID: 10,
					IsActive:   true,
					Courses: []*models.CurriculumCourseRow{
						{CourseID: courseID, IsActive: true, GradeScheme: "letter"},
					},
				},
			},
		},
	}

	valid := []models.CooperativeRequirement{
		{CriterionType: models.CoopCriterionCategoryGPA, NameTH: "GPA หมวด", MinimumValue: &minimum, CategoryID: &categoryID},
		{CriterionType: models.CoopCriterionCourseGrade, NameTH: "สัมมนา", CourseID: &courseID, MinimumGrade: &letterGrade},
	}
	if err := validateCooperativeRequirements(categories, valid, true); err != nil {
		t.Fatalf("validateCooperativeRequirements() rejected valid in-curriculum references: %v", err)
	}

	otherCourseID := uint64(99)
	valid[1].CourseID = &otherCourseID
	if err := validateCooperativeRequirements(categories, valid, true); err == nil {
		t.Fatal("validateCooperativeRequirements() accepted a course outside the curriculum")
	}
}

func TestAllowedCooperativeMinimumGradeFollowsCourseScheme(t *testing.T) {
	cases := []struct {
		name        string
		gradeScheme string
		grade       string
		want        bool
	}{
		{name: "letter B", gradeScheme: "letter", grade: "B", want: true},
		{name: "letter F is not a passing threshold", gradeScheme: "letter", grade: "F", want: false},
		{name: "satisfactory S", gradeScheme: "satisfactory", grade: "S", want: true},
		{name: "satisfactory U is not a passing threshold", gradeScheme: "satisfactory", grade: "U", want: false},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			if got := isAllowedCooperativeMinimumGrade(testCase.gradeScheme, testCase.grade); got != testCase.want {
				t.Fatalf("isAllowedCooperativeMinimumGrade(%q, %q) = %t, want %t", testCase.gradeScheme, testCase.grade, got, testCase.want)
			}
		})
	}
}
