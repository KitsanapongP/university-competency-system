package services

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
)

type importedCategoryState struct {
	code       string
	nameTH     string
	parentCode string
	existing   bool
}

func (s *CurriculumService) PreviewStructureImport(ctx context.Context, curriculumID uint64, payload models.CurriculumStructureImportPayload, roles []string, facultyID *int64) (*models.CurriculumStructureImportPreview, error) {
	if _, err := s.getCurriculumForWrite(ctx, curriculumID, roles, facultyID); err != nil {
		return nil, err
	}
	preview, _, err := s.analyzeStructureImport(ctx, curriculumID, payload)
	return preview, err
}

func (s *CurriculumService) CommitStructureImport(ctx context.Context, curriculumID uint64, payload models.CurriculumStructureImportPayload, userID int64, roles []string, facultyID *int64) (*models.CurriculumDetail, error) {
	curriculum, err := s.getCurriculumForWrite(ctx, curriculumID, roles, facultyID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureStructureEditable(ctx, curriculum, payload.ConfirmImpact); err != nil {
		return nil, err
	}

	preview, plan, err := s.analyzeStructureImport(ctx, curriculumID, payload)
	if err != nil {
		return nil, err
	}
	if !preview.Valid {
		return nil, CurriculumValidationDetailsError{
			Message: "curriculum structure import contains invalid rows",
			Data:    preview,
		}
	}
	if !preview.CanImport {
		return nil, CurriculumValidationDetailsError{
			Message: "curriculum structure import has no new courses to import",
			Data:    preview,
		}
	}

	majorScope, err := s.Repo.GetMajorScope(ctx, curriculum.MajorID)
	if err != nil {
		return nil, err
	}
	if err := s.Repo.CommitCurriculumStructureImport(ctx, curriculumID, plan, repositories.CreateCurriculumOptions{
		FacultyID:   majorScope.FacultyID,
		DegreeLevel: majorScope.DegreeLevel,
		CreatedBy:   uint64(max(userID, 0)),
	}); err != nil {
		if errors.Is(err, repositories.ErrCurriculumCourseCodeAlreadyPlaced) {
			return nil, CurriculumConflictError{Code: "DUPLICATE", Message: "course code already exists in this curriculum"}
		}
		return nil, err
	}

	return s.GetCurriculumByID(ctx, curriculumID, roles, facultyID)
}

func (s *CurriculumService) analyzeStructureImport(ctx context.Context, curriculumID uint64, payload models.CurriculumStructureImportPayload) (*models.CurriculumStructureImportPreview, models.CurriculumStructureImportPlan, error) {
	preview := &models.CurriculumStructureImportPreview{Issues: []models.CurriculumStructureImportIssue{}}
	plan := models.CurriculumStructureImportPlan{}
	if len(payload.Rows) == 0 {
		preview.Issues = append(preview.Issues, importIssue(0, "file", "import file has no course rows"))
		return preview, plan, nil
	}

	tree, err := s.Repo.GetCurriculumCategoryTree(ctx, curriculumID)
	if err != nil {
		return nil, plan, err
	}
	existingCategories := map[string]*models.CourseCategoryNode{}
	existingCourseCodes := map[string]bool{}
	existingCategoryHasChildren := map[string]bool{}
	var collectExisting func([]*models.CourseCategoryNode)
	collectExisting = func(categories []*models.CourseCategoryNode) {
		for _, category := range categories {
			if code := categoryCode(category); code != "" {
				existingCategories[strings.ToLower(code)] = category
				if len(category.Children) > 0 {
					existingCategoryHasChildren[strings.ToLower(code)] = true
				}
			}
			for _, course := range category.Courses {
				existingCourseCodes[strings.ToLower(strings.TrimSpace(course.Code))] = true
			}
			collectExisting(category.Children)
		}
	}
	collectExisting(tree)

	categoryStates := map[string]importedCategoryState{}
	importedCourseCodes := map[string]bool{}
	categoryUsedByCourse := map[string]bool{}
	categoryHasChild := map[string]bool{}
	usedCategoryCodes := map[string]bool{}

	for _, row := range payload.Rows {
		rowNumber := row.RowNumber
		if rowNumber <= 0 {
			rowNumber = 1
		}
		if hasImportCategoryGap(row.Categories) {
			preview.Issues = append(preview.Issues, importIssue(rowNumber, "categories", "category levels must be continuous from level 1"))
			continue
		}
		categories := normalizeImportCategories(row.Categories)
		if len(categories) == 0 {
			preview.Issues = append(preview.Issues, importIssue(rowNumber, "categories", "at least one category level is required"))
			continue
		}
		if len(categories) > maxCurriculumCategoryLevels {
			preview.Issues = append(preview.Issues, importIssue(rowNumber, "categories", "category nesting cannot exceed 4 levels"))
			continue
		}

		parentCode := ""
		rowValid := true
		for index, category := range categories {
			if err := validateCurriculumCategoryCode(category.Code); err != nil {
				preview.Issues = append(preview.Issues, importIssue(rowNumber, fmt.Sprintf("category_level_%d", index+1), err.Error()))
				rowValid = false
				continue
			}
			if category.NameTH == "" {
				preview.Issues = append(preview.Issues, importIssue(rowNumber, fmt.Sprintf("category_name_level_%d", index+1), "category name_th is required"))
				rowValid = false
			}
			if parentCode != "" && !strings.HasPrefix(category.Code, parentCode+".") {
				preview.Issues = append(preview.Issues, importIssue(rowNumber, fmt.Sprintf("category_level_%d", index+1), "category code must extend its parent code"))
				rowValid = false
			}
			if strings.Count(category.Code, ".") != index {
				preview.Issues = append(preview.Issues, importIssue(rowNumber, fmt.Sprintf("category_level_%d", index+1), "category code must match its category level"))
				rowValid = false
			}
			key := strings.ToLower(category.Code)
			if current, exists := categoryStates[key]; exists {
				if current.nameTH != category.NameTH || current.parentCode != parentCode {
					preview.Issues = append(preview.Issues, importIssue(rowNumber, fmt.Sprintf("category_level_%d", index+1), "category code conflicts with another imported category"))
					rowValid = false
				}
			} else if existing, exists := existingCategories[key]; exists {
				existingParentCode := ""
				if existing.ParentID != nil {
					for _, candidate := range existingCategories {
						if candidate.CategoryID == *existing.ParentID {
							existingParentCode = categoryCode(candidate)
							break
						}
					}
				}
				if existing.NameTH != category.NameTH || existingParentCode != parentCode {
					preview.Issues = append(preview.Issues, importIssue(rowNumber, fmt.Sprintf("category_level_%d", index+1), "category code conflicts with the current curriculum structure"))
					rowValid = false
				}
				categoryStates[key] = importedCategoryState{code: category.Code, nameTH: category.NameTH, parentCode: parentCode, existing: true}
			} else {
				categoryStates[key] = importedCategoryState{code: category.Code, nameTH: category.NameTH, parentCode: parentCode}
			}
			if parentCode != "" {
				categoryHasChild[strings.ToLower(parentCode)] = true
			}
			parentCode = category.Code
		}

		courseCode := strings.TrimSpace(row.CourseCode)
		courseNameTH := strings.TrimSpace(row.CourseNameTH)
		if courseCode == "" {
			preview.Issues = append(preview.Issues, importIssue(rowNumber, "course_code", "course code is required"))
			rowValid = false
		}
		if courseNameTH == "" {
			preview.Issues = append(preview.Issues, importIssue(rowNumber, "course_name_th", "course name_th is required"))
			rowValid = false
		}
		if row.Credits < 0 {
			preview.Issues = append(preview.Issues, importIssue(rowNumber, "credits", "course credits must be zero or greater"))
			rowValid = false
		}
		if row.IsRequired == nil {
			preview.Issues = append(preview.Issues, importIssue(rowNumber, "course_type", "course type is required"))
			rowValid = false
		}
		courseKey := strings.ToLower(courseCode)
		if courseCode != "" && (existingCourseCodes[courseKey] || importedCourseCodes[courseKey]) {
			preview.Issues = append(preview.Issues, importWarning(rowNumber, "course_code", "course code already exists in this curriculum"))
			preview.SkippedCourseCount++
			continue
		}
		if rowValid {
			importedCourseCodes[courseKey] = true
			categoryUsedByCourse[strings.ToLower(parentCode)] = true
			markImportCategoryPath(categoryStates, parentCode, usedCategoryCodes)
			nameEN := trimStringPointer(row.CourseNameEN)
			plan.Courses = append(plan.Courses, models.CurriculumStructureImportCoursePlan{
				CategoryCode: parentCode,
				Code:         courseCode,
				NameTH:       courseNameTH,
				NameEN:       nameEN,
				Credits:      row.Credits,
				IsRequired:   *row.IsRequired,
			})
		}
	}

	for categoryCode := range categoryUsedByCourse {
		if categoryHasChild[categoryCode] || existingCategoryHasChildren[categoryCode] {
			preview.Issues = append(preview.Issues, importIssue(0, "categories", "courses can only be placed in leaf categories"))
		}
	}

	for key, state := range categoryStates {
		if !usedCategoryCodes[key] {
			continue
		}
		if state.existing {
			preview.ExistingCategoryCount++
			continue
		}
		plan.Categories = append(plan.Categories, models.CurriculumStructureImportCategoryPlan{
			Code: state.code, NameTH: state.nameTH, ParentCode: state.parentCode,
		})
	}
	sort.Slice(plan.Categories, func(i, j int) bool {
		leftDepth := strings.Count(plan.Categories[i].Code, ".")
		rightDepth := strings.Count(plan.Categories[j].Code, ".")
		if leftDepth != rightDepth {
			return leftDepth < rightDepth
		}
		return plan.Categories[i].Code < plan.Categories[j].Code
	})

	preview.NewCategoryCount = len(plan.Categories)
	preview.CourseCount = len(plan.Courses)
	preview.Valid = !hasImportErrors(preview.Issues)
	preview.CanImport = preview.Valid && preview.CourseCount > 0
	if !preview.Valid {
		plan = models.CurriculumStructureImportPlan{}
	}
	return preview, plan, nil
}

func normalizeImportCategories(categories []models.CurriculumStructureImportCategory) []models.CurriculumStructureImportCategory {
	result := make([]models.CurriculumStructureImportCategory, 0, len(categories))
	for _, category := range categories {
		code := strings.TrimSpace(category.Code)
		nameTH := strings.TrimSpace(category.NameTH)
		if code == "" && nameTH == "" {
			continue
		}
		result = append(result, models.CurriculumStructureImportCategory{Code: code, NameTH: nameTH})
	}
	return result
}

func hasImportCategoryGap(categories []models.CurriculumStructureImportCategory) bool {
	seenEmpty := false
	for _, category := range categories {
		hasCode := strings.TrimSpace(category.Code) != ""
		hasName := strings.TrimSpace(category.NameTH) != ""
		if !hasCode && !hasName {
			seenEmpty = true
			continue
		}
		if seenEmpty {
			return true
		}
	}
	return false
}

func importIssue(rowNumber int, field, message string) models.CurriculumStructureImportIssue {
	return models.CurriculumStructureImportIssue{RowNumber: rowNumber, Field: field, Message: message, Severity: "error"}
}

func importWarning(rowNumber int, field, message string) models.CurriculumStructureImportIssue {
	return models.CurriculumStructureImportIssue{RowNumber: rowNumber, Field: field, Message: message, Severity: "warning"}
}

func hasImportErrors(issues []models.CurriculumStructureImportIssue) bool {
	for _, issue := range issues {
		if issue.Severity != "warning" {
			return true
		}
	}
	return false
}

func markImportCategoryPath(states map[string]importedCategoryState, code string, used map[string]bool) {
	for code != "" {
		key := strings.ToLower(code)
		if used[key] {
			return
		}
		used[key] = true
		state, ok := states[key]
		if !ok {
			return
		}
		code = state.parentCode
	}
}
