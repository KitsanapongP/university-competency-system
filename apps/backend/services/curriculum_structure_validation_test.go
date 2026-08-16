package services

import (
	"testing"

	"github.com/spw32767/university-competency-system-backend/models"
)

func categoryWithDepth(levels int, courseAtRoot bool) models.CreateCategoryPayload {
	rootCode := "1"
	category := models.CreateCategoryPayload{NameTH: "Category", Code: &rootCode}
	if courseAtRoot {
		category.Courses = []models.CreateCourseInCatPayload{{Code: "CS101", NameTH: "Course"}}
	}
	current := &category
	for level := 1; level < levels; level += 1 {
		code := currentCode(current.Code) + ".1"
		current.Children = []models.CreateCategoryPayload{{NameTH: "Category", Code: &code}}
		current = &current.Children[0]
	}
	return category
}

func currentCode(code *string) string {
	if code == nil {
		return ""
	}
	return *code
}

func stringPointer(value string) *string {
	return &value
}

func TestValidateCreateCategories(t *testing.T) {
	tests := []struct {
		name       string
		categories []models.CreateCategoryPayload
		wantErr    string
	}{
		{
			name:       "allows one through four levels",
			categories: []models.CreateCategoryPayload{categoryWithDepth(4, false)},
		},
		{
			name:       "rejects five levels",
			categories: []models.CreateCategoryPayload{categoryWithDepth(5, false)},
			wantErr:    "category nesting cannot exceed 4 levels",
		},
		{
			name: "allows a course in a leaf category",
			categories: []models.CreateCategoryPayload{{
				Code:    stringPointer("1"),
				NameTH:  "Leaf",
				Courses: []models.CreateCourseInCatPayload{{Code: "CS101", NameTH: "Course"}},
			}},
		},
		{
			name:       "rejects a course in a parent category",
			categories: []models.CreateCategoryPayload{categoryWithDepth(2, true)},
			wantErr:    "courses can only be placed in leaf categories",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateCreateCategories(tt.categories, map[string]bool{}, map[string]bool{})
			if tt.wantErr == "" && err != nil {
				t.Fatalf("validateCreateCategories() error = %v, want nil", err)
			}
			if tt.wantErr != "" && (err == nil || err.Error() != tt.wantErr) {
				t.Fatalf("validateCreateCategories() error = %v, want %q", err, tt.wantErr)
			}
		})
	}
}

func TestCategoryPlacementValidation(t *testing.T) {
	leafCourse := &models.CurriculumCourseRow{CurriculumCourseID: 1}
	tree := []*models.CourseCategoryNode{
		{
			CategoryID: 1,
			Children: []*models.CourseCategoryNode{
				{
					CategoryID: 2,
					Children: []*models.CourseCategoryNode{
						{
							CategoryID: 3,
							Children: []*models.CourseCategoryNode{
								{CategoryID: 4, Courses: []*models.CurriculumCourseRow{leafCourse}},
							},
						},
					},
				},
			},
		},
		{CategoryID: 5, Courses: []*models.CurriculumCourseRow{leafCourse}},
	}

	tests := []struct {
		name     string
		validate func() error
		wantErr  string
	}{
		{
			name:     "allows a child under a category below level four",
			validate: func() error { return validateChildCategoryPlacement(tree, 3) },
		},
		{
			name:     "rejects a child below level four",
			validate: func() error { return validateChildCategoryPlacement(tree, 4) },
			wantErr:  "category nesting cannot exceed 4 levels",
		},
		{
			name:     "rejects a child under a category with courses",
			validate: func() error { return validateChildCategoryPlacement(tree, 5) },
			wantErr:  "categories with courses cannot have child categories",
		},
		{
			name:     "rejects moving a category below level four",
			validate: func() error { return validateCategoryMovePlacement(tree, 5, 4) },
			wantErr:  "category nesting cannot exceed 4 levels",
		},
		{
			name:     "allows placing a course in a leaf category",
			validate: func() error { return validateCourseCategoryPlacement(tree, 4) },
		},
		{
			name:     "rejects placing a course in a parent category",
			validate: func() error { return validateCourseCategoryPlacement(tree, 1) },
			wantErr:  "courses can only be placed in leaf categories",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.validate()
			if tt.wantErr == "" && err != nil {
				t.Fatalf("validation error = %v, want nil", err)
			}
			if tt.wantErr != "" && (err == nil || err.Error() != tt.wantErr) {
				t.Fatalf("validation error = %v, want %q", err, tt.wantErr)
			}
		})
	}
}
