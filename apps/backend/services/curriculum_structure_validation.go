package services

import (
	"strings"

	"github.com/spw32767/university-competency-system-backend/models"
)

const maxCurriculumCategoryLevels = 4

func validateCreateCategories(categories []models.CreateCategoryPayload, seenCourseCodes map[string]bool) error {
	return validateCreateCategoryLevel(categories, seenCourseCodes, 1)
}

func validateCreateCategoryLevel(categories []models.CreateCategoryPayload, seenCourseCodes map[string]bool, level int) error {
	if len(categories) == 0 {
		return nil
	}
	if level > maxCurriculumCategoryLevels {
		return CurriculumValidationError{Message: "category nesting cannot exceed 4 levels"}
	}

	for _, category := range categories {
		if strings.TrimSpace(category.NameTH) == "" {
			return CurriculumValidationError{Message: "category name_th is required"}
		}
		if category.RequiredCredits < 0 {
			return CurriculumValidationError{Message: "category required_credits must be zero or greater"}
		}
		if len(category.Children) > 0 && len(category.Courses) > 0 {
			return CurriculumValidationError{Message: "courses can only be placed in leaf categories"}
		}

		for _, course := range category.Courses {
			if course.CourseID != 0 {
				return CurriculumValidationError{Message: "course_id is not allowed when creating curriculum courses"}
			}
			if course.Credits < 0 {
				return CurriculumValidationError{Message: "course credits must be zero or greater"}
			}

			code := strings.TrimSpace(course.Code)
			if code == "" {
				return CurriculumValidationError{Message: "course code is required"}
			}
			if strings.TrimSpace(course.NameTH) == "" {
				return CurriculumValidationError{Message: "course name_th is required"}
			}

			normalizedCode := strings.ToLower(code)
			if seenCourseCodes[normalizedCode] {
				return CurriculumValidationError{Message: "duplicate course code in curriculum payload"}
			}
			seenCourseCodes[normalizedCode] = true
		}

		if err := validateCreateCategoryLevel(category.Children, seenCourseCodes, level+1); err != nil {
			return err
		}
	}

	return nil
}

func findCategoryNode(categories []*models.CourseCategoryNode, categoryID uint64) (*models.CourseCategoryNode, int) {
	for _, category := range categories {
		if category.CategoryID == categoryID {
			return category, 1
		}
		if child, depth := findCategoryNode(category.Children, categoryID); child != nil {
			return child, depth + 1
		}
	}
	return nil, 0
}

func categorySubtreeLevels(category *models.CourseCategoryNode) int {
	maxLevels := 1
	for _, child := range category.Children {
		maxLevels = max(maxLevels, 1+categorySubtreeLevels(child))
	}
	return maxLevels
}

func validateChildCategoryPlacement(categories []*models.CourseCategoryNode, parentID uint64) error {
	parent, parentLevel := findCategoryNode(categories, parentID)
	if parent == nil {
		return CurriculumValidationError{Message: "parent_id is invalid"}
	}
	if parentLevel >= maxCurriculumCategoryLevels {
		return CurriculumValidationError{Message: "category nesting cannot exceed 4 levels"}
	}
	if len(parent.Courses) > 0 {
		return CurriculumValidationError{Message: "categories with courses cannot have child categories"}
	}
	return nil
}

func validateCategoryMovePlacement(categories []*models.CourseCategoryNode, categoryID, parentID uint64) error {
	category, _ := findCategoryNode(categories, categoryID)
	parent, parentLevel := findCategoryNode(categories, parentID)
	if category == nil || parent == nil {
		return CurriculumValidationError{Message: "parent_id is invalid"}
	}
	if parentLevel+categorySubtreeLevels(category) > maxCurriculumCategoryLevels {
		return CurriculumValidationError{Message: "category nesting cannot exceed 4 levels"}
	}
	if len(parent.Courses) > 0 {
		return CurriculumValidationError{Message: "categories with courses cannot have child categories"}
	}
	return nil
}

func validateCourseCategoryPlacement(categories []*models.CourseCategoryNode, categoryID uint64) error {
	category, _ := findCategoryNode(categories, categoryID)
	if category == nil {
		return CurriculumValidationError{Message: "category_id is invalid"}
	}
	if len(category.Children) > 0 {
		return CurriculumValidationError{Message: "courses can only be placed in leaf categories"}
	}
	return nil
}
