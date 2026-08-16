package services

import (
	"regexp"
	"strings"

	"github.com/spw32767/university-competency-system-backend/models"
)

var curriculumCategoryCodePattern = regexp.MustCompile(`^[0-9]+(?:\.[0-9]+){0,3}$`)

func validateCurriculumCategoryCode(code string) error {
	if strings.TrimSpace(code) == "" {
		return CurriculumValidationError{Message: "category code is required"}
	}
	if !curriculumCategoryCodePattern.MatchString(code) {
		return CurriculumValidationError{Message: "category code must contain up to 4 numeric levels"}
	}
	return nil
}

func categoryCode(category *models.CourseCategoryNode) string {
	if category == nil || category.Code == nil {
		return ""
	}
	return strings.TrimSpace(*category.Code)
}

func categoryCodeCascade(category *models.CourseCategoryNode, oldPrefix, newPrefix string, updates map[uint64]string) {
	for _, child := range category.Children {
		currentCode := categoryCode(child)
		if strings.HasPrefix(currentCode, oldPrefix+".") {
			nextCode := newPrefix + strings.TrimPrefix(currentCode, oldPrefix)
			updates[child.CategoryID] = nextCode
			categoryCodeCascade(child, currentCode, nextCode, updates)
			continue
		}
		categoryCodeCascade(child, currentCode, currentCode, updates)
	}
}

func validateCategoryCodeUpdates(categories []*models.CourseCategoryNode, categoryID uint64, nextCode string) (map[uint64]string, error) {
	category, _ := findCategoryNode(categories, categoryID)
	if category == nil {
		return nil, CurriculumValidationError{Message: "category_id is invalid"}
	}
	if err := validateCurriculumCategoryCode(nextCode); err != nil {
		return nil, err
	}

	updates := map[uint64]string{categoryID: nextCode}
	currentCode := categoryCode(category)
	if currentCode != "" && currentCode != nextCode {
		categoryCodeCascade(category, currentCode, nextCode, updates)
	}

	used := make(map[string]uint64)
	var walk func([]*models.CourseCategoryNode) error
	walk = func(nodes []*models.CourseCategoryNode) error {
		for _, node := range nodes {
			code := categoryCode(node)
			if replacement, ok := updates[node.CategoryID]; ok {
				code = replacement
			}
			if code != "" {
				if err := validateCurriculumCategoryCode(code); err != nil {
					return err
				}
				key := strings.ToLower(code)
				if existingID, exists := used[key]; exists && existingID != node.CategoryID {
					return CurriculumConflictError{Code: "DUPLICATE", Message: "category code already exists in this curriculum"}
				}
				used[key] = node.CategoryID
			}
			if err := walk(node.Children); err != nil {
				return err
			}
		}
		return nil
	}

	if err := walk(categories); err != nil {
		return nil, err
	}
	return updates, nil
}

func validateCategoryCodeForCreate(categories []*models.CourseCategoryNode, code string) error {
	if err := validateCurriculumCategoryCode(code); err != nil {
		return err
	}
	needle := strings.ToLower(strings.TrimSpace(code))
	var walk func([]*models.CourseCategoryNode) error
	walk = func(nodes []*models.CourseCategoryNode) error {
		for _, node := range nodes {
			if strings.EqualFold(categoryCode(node), needle) {
				return CurriculumConflictError{Code: "DUPLICATE", Message: "category code already exists in this curriculum"}
			}
			if err := walk(node.Children); err != nil {
				return err
			}
		}
		return nil
	}
	if err := walk(categories); err != nil {
		return err
	}
	return nil
}
