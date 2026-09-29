package services

import (
	"testing"

	"github.com/spw32767/university-competency-system-backend/models"
)

func codePointer(value string) *string {
	return &value
}

func TestValidateCurriculumCategoryCode(t *testing.T) {
	validCodes := []string{"1", "3", "3.1", "3.10.4.2"}
	for _, code := range validCodes {
		if err := validateCurriculumCategoryCode(code); err != nil {
			t.Fatalf("expected %q to be valid: %v", code, err)
		}
	}

	invalidCodes := []string{"", "1.", "1.a", "1.2.3.4.5"}
	for _, code := range invalidCodes {
		if err := validateCurriculumCategoryCode(code); err == nil {
			t.Fatalf("expected %q to be invalid", code)
		}
	}
}

func TestValidateCategoryCodeUpdatesCascadesSubtreePrefix(t *testing.T) {
	root := &models.CourseCategoryNode{
		CategoryID: 1,
		Code:       codePointer("1"),
		Children: []*models.CourseCategoryNode{
			{
				CategoryID: 2,
				Code:       codePointer("1.1"),
				Children: []*models.CourseCategoryNode{{
					CategoryID: 3,
					Code:       codePointer("1.1.2"),
				}},
			},
		},
	}

	updates, err := validateCategoryCodeUpdates([]*models.CourseCategoryNode{root}, 1, "3")
	if err != nil {
		t.Fatalf("validate category update: %v", err)
	}
	if updates[1] != "3" || updates[2] != "3.1" || updates[3] != "3.1.2" {
		t.Fatalf("unexpected cascade updates: %#v", updates)
	}
}

func TestValidateCategoryCodeUpdatesRejectsDuplicate(t *testing.T) {
	categories := []*models.CourseCategoryNode{
		{CategoryID: 1, Code: codePointer("1")},
		{CategoryID: 2, Code: codePointer("2")},
	}

	if _, err := validateCategoryCodeUpdates(categories, 1, "2"); err == nil {
		t.Fatal("expected duplicate code to be rejected")
	}
}
