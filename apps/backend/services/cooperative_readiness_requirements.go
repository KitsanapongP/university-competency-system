package services

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"

	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
)

var (
	ErrCooperativeRequirementsNotFound = errors.New("cooperative requirements not found")
	ErrCooperativeRequirementsEmpty    = repositories.ErrCooperativeRequirementsEmpty
	ErrCooperativeRequirementsChanged  = repositories.ErrCooperativeRequirementsChanged
)

type CooperativeReadinessValidationError struct {
	Message string
}

func (e CooperativeReadinessValidationError) Error() string {
	return e.Message
}

type CooperativeReadinessService struct {
	Repo        *repositories.CooperativeReadinessRepository
	Curriculums *CurriculumService
}

func NewCooperativeReadinessService(repo *repositories.CooperativeReadinessRepository, curriculums *CurriculumService) *CooperativeReadinessService {
	return &CooperativeReadinessService{Repo: repo, Curriculums: curriculums}
}

func (s *CooperativeReadinessService) GetRequirements(ctx context.Context, curriculumID uint64, roles []string, facultyID *int64) (*models.CooperativeRequirementsResponse, error) {
	if _, err := s.curriculumScope(ctx, curriculumID, roles, facultyID); err != nil {
		return nil, err
	}
	return s.Repo.GetRequirementSets(ctx, curriculumID)
}

func (s *CooperativeReadinessService) SaveDraft(ctx context.Context, curriculumID, userID uint64, payload models.ReplaceCooperativeRequirementsPayload, roles []string, facultyID *int64) (*models.CooperativeRequirementsResponse, error) {
	curriculum, err := s.curriculumScope(ctx, curriculumID, roles, facultyID)
	if err != nil {
		return nil, err
	}
	if err := validateCooperativeRequirements(curriculum.Categories, payload.Requirements, false); err != nil {
		return nil, err
	}
	if err := s.Repo.ReplaceDraft(ctx, curriculumID, userID, payload.Requirements); err != nil {
		return nil, err
	}
	return s.Repo.GetRequirementSets(ctx, curriculumID)
}

func (s *CooperativeReadinessService) PublishDraft(ctx context.Context, curriculumID, userID uint64, roles []string, facultyID *int64) (*models.CooperativeRequirementsResponse, error) {
	curriculum, err := s.curriculumScope(ctx, curriculumID, roles, facultyID)
	if err != nil {
		return nil, err
	}
	sets, err := s.Repo.GetRequirementSets(ctx, curriculumID)
	if err != nil {
		return nil, err
	}
	if sets.Draft == nil {
		return nil, ErrCooperativeRequirementsNotFound
	}
	if err := validateCooperativeRequirements(curriculum.Categories, sets.Draft.Requirements, true); err != nil {
		return nil, err
	}
	if err := s.Repo.PublishDraft(ctx, curriculumID, userID, sets.Draft.Requirements); err != nil {
		return nil, err
	}
	return s.Repo.GetRequirementSets(ctx, curriculumID)
}

func (s *CooperativeReadinessService) curriculumScope(ctx context.Context, curriculumID uint64, roles []string, facultyID *int64) (*models.CurriculumDetail, error) {
	return s.Curriculums.GetCurriculumByID(ctx, curriculumID, roles, facultyID)
}

func validateCooperativeRequirements(categories []*models.CourseCategoryNode, requirements []models.CooperativeRequirement, requireComplete bool) error {
	if requireComplete && len(requirements) == 0 {
		return CooperativeReadinessValidationError{Message: "at least one cooperative requirement is required"}
	}

	scope := buildCooperativeCurriculumScope(categories)
	for index, requirement := range requirements {
		if !isCooperativeCriterionType(requirement.CriterionType) {
			return CooperativeReadinessValidationError{Message: fmt.Sprintf("requirements[%d].criterion_type is invalid", index)}
		}
		if math.IsNaN(valueOrZero(requirement.MinimumValue)) || math.IsInf(valueOrZero(requirement.MinimumValue), 0) || valueOrZero(requirement.MinimumValue) < 0 {
			return CooperativeReadinessValidationError{Message: fmt.Sprintf("requirements[%d].minimum_value must not be negative", index)}
		}

		if requirement.CategoryID != nil {
			if _, exists := scope.categories[*requirement.CategoryID]; !exists {
				return CooperativeReadinessValidationError{Message: fmt.Sprintf("requirements[%d].category_id must belong to this curriculum", index)}
			}
		}
		course, hasCourse := scope.courses[valueOrZeroUint(requirement.CourseID)]
		if requirement.CourseID != nil && !hasCourse {
			return CooperativeReadinessValidationError{Message: fmt.Sprintf("requirements[%d].course_id must belong to this curriculum", index)}
		}

		if requireComplete && strings.TrimSpace(requirement.NameTH) == "" {
			return CooperativeReadinessValidationError{Message: fmt.Sprintf("requirements[%d].name_th is required", index)}
		}
		if !requireComplete {
			if requirement.CriterionType == models.CoopCriterionCourseGrade && requirement.MinimumGrade != nil && hasCourse && !isAllowedCooperativeMinimumGrade(course.GradeScheme, *requirement.MinimumGrade) {
				return CooperativeReadinessValidationError{Message: fmt.Sprintf("requirements[%d].minimum_grade is not allowed for the selected course", index)}
			}
			continue
		}

		switch requirement.CriterionType {
		case models.CoopCriterionOverallGPA:
			if requirement.MinimumValue == nil || *requirement.MinimumValue > 4 {
				return CooperativeReadinessValidationError{Message: fmt.Sprintf("requirements[%d].minimum_value must be between 0 and 4", index)}
			}
		case models.CoopCriterionCategoryGPA:
			if requirement.CategoryID == nil || requirement.MinimumValue == nil || *requirement.MinimumValue > 4 {
				return CooperativeReadinessValidationError{Message: fmt.Sprintf("requirements[%d] needs a curriculum category and GPA between 0 and 4", index)}
			}
		case models.CoopCriterionCourseGrade:
			if requirement.CourseID == nil || requirement.MinimumGrade == nil || !isAllowedCooperativeMinimumGrade(course.GradeScheme, *requirement.MinimumGrade) {
				return CooperativeReadinessValidationError{Message: fmt.Sprintf("requirements[%d] needs a course and a passing grade allowed by its grade scheme", index)}
			}
		case models.CoopCriterionCategoryCredits:
			if requirement.CategoryID == nil || requirement.MinimumValue == nil {
				return CooperativeReadinessValidationError{Message: fmt.Sprintf("requirements[%d] needs a curriculum category and minimum credits", index)}
			}
		case models.CoopCriterionFreeElectiveCredit:
			if requirement.MinimumValue == nil {
				return CooperativeReadinessValidationError{Message: fmt.Sprintf("requirements[%d].minimum_value is required", index)}
			}
		}
	}
	return nil
}

type cooperativeCurriculumScope struct {
	categories map[uint64]*models.CourseCategoryNode
	courses    map[uint64]models.CurriculumCourseRow
}

func buildCooperativeCurriculumScope(nodes []*models.CourseCategoryNode) cooperativeCurriculumScope {
	scope := cooperativeCurriculumScope{
		categories: make(map[uint64]*models.CourseCategoryNode),
		courses:    make(map[uint64]models.CurriculumCourseRow),
	}
	var walk func([]*models.CourseCategoryNode)
	walk = func(items []*models.CourseCategoryNode) {
		for _, category := range items {
			if category == nil || !category.IsActive || category.DeletedAt != nil {
				continue
			}
			scope.categories[category.CategoryID] = category
			for _, course := range category.Courses {
				if course.IsActive && course.DeletedAt == nil {
					scope.courses[course.CourseID] = *course
				}
			}
			walk(category.Children)
		}
	}
	walk(nodes)
	return scope
}

func isCooperativeCriterionType(value string) bool {
	switch value {
	case models.CoopCriterionOverallGPA,
		models.CoopCriterionCategoryGPA,
		models.CoopCriterionCourseGrade,
		models.CoopCriterionCategoryCredits,
		models.CoopCriterionFreeElectiveCredit:
		return true
	default:
		return false
	}
}

func isAllowedCooperativeMinimumGrade(gradeScheme, minimumGrade string) bool {
	grade := strings.ToUpper(strings.TrimSpace(minimumGrade))
	switch strings.ToLower(strings.TrimSpace(gradeScheme)) {
	case "letter":
		switch grade {
		case "A", "B+", "B", "C+", "C", "D+", "D":
			return true
		}
	case "satisfactory":
		return grade == "S"
	}
	return false
}

func valueOrZero(value *float64) float64 {
	if value == nil {
		return 0
	}
	return *value
}

func valueOrZeroUint(value *uint64) uint64 {
	if value == nil {
		return 0
	}
	return *value
}
