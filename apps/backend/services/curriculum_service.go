package services

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
)

var (
	ErrCurriculumForbidden = errors.New("curriculum access forbidden")
	ErrCurriculumNotFound  = errors.New("curriculum not found")
)

type CurriculumValidationError struct {
	Message string
}

func (e CurriculumValidationError) Error() string {
	return e.Message
}

type CurriculumService struct {
	Repo *repositories.CurriculumRepository
}

func NewCurriculumService(repo *repositories.CurriculumRepository) *CurriculumService {
	return &CurriculumService{Repo: repo}
}

func (s *CurriculumService) GetCurriculums(ctx context.Context, roles []string, facultyID *int64) ([]*models.Curriculum, error) {
	if hasRole(roles, "admin") {
		return s.Repo.GetCurriculums(ctx)
	}
	if !hasRole(roles, "officer") || facultyID == nil || *facultyID <= 0 {
		return nil, ErrCurriculumForbidden
	}

	return s.Repo.GetCurriculumsByFaculty(ctx, uint64(*facultyID))
}

func (s *CurriculumService) GetCurriculumByID(ctx context.Context, id uint64, roles []string, facultyID *int64) (*models.CurriculumDetail, error) {
	curriculum, err := s.Repo.GetCurriculumByID(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrCurriculumNotFound
	}
	if err != nil {
		return nil, err
	}

	if !hasRole(roles, "admin") {
		if !hasRole(roles, "officer") || facultyID == nil || *facultyID <= 0 {
			return nil, ErrCurriculumForbidden
		}
		majorScope, err := s.Repo.GetMajorScope(ctx, curriculum.MajorID)
		if err != nil {
			return nil, err
		}
		if majorScope.FacultyID != uint64(*facultyID) {
			return nil, ErrCurriculumForbidden
		}
	}

	categories, err := s.Repo.GetCurriculumCategoryTree(ctx, id)
	if err != nil {
		return nil, err
	}

	return &models.CurriculumDetail{
		Curriculum: *curriculum,
		Categories: categories,
	}, nil
}

func (s *CurriculumService) CreateCurriculum(ctx context.Context, payload models.CreateCurriculumPayload, userID int64, roles []string, facultyID *int64) (*models.Curriculum, error) {
	if err := validateCreateCurriculumPayload(payload); err != nil {
		return nil, err
	}

	majorScope, err := s.Repo.GetMajorScope(ctx, payload.MajorID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, CurriculumValidationError{Message: "major_id is invalid"}
	}
	if err != nil {
		return nil, err
	}

	isAdmin := hasRole(roles, "admin")
	if !isAdmin {
		if !hasRole(roles, "officer") || facultyID == nil || *facultyID <= 0 {
			return nil, ErrCurriculumForbidden
		}
		if uint64(*facultyID) != majorScope.FacultyID {
			return nil, ErrCurriculumForbidden
		}
	}

	var createdBy uint64
	if userID > 0 {
		createdBy = uint64(userID)
	}

	curriculum, err := s.Repo.CreateCurriculumTx(ctx, payload, repositories.CreateCurriculumOptions{
		FacultyID:   majorScope.FacultyID,
		CreatedBy:   createdBy,
		DegreeLevel: majorScope.DegreeLevel,
	})

	return curriculum, err
}

func validateCreateCurriculumPayload(payload models.CreateCurriculumPayload) error {
	if payload.MajorID == 0 {
		return CurriculumValidationError{Message: "major_id is required"}
	}
	if strings.TrimSpace(payload.CurriculumCode) == "" {
		return CurriculumValidationError{Message: "curriculum_code is required"}
	}
	if strings.TrimSpace(payload.CurriculumNameTH) == "" {
		return CurriculumValidationError{Message: "curriculum_name_th is required"}
	}
	if payload.EffectiveYearBE == 0 {
		return CurriculumValidationError{Message: "effective_year_be is required"}
	}

	seenCourseCodes := map[string]bool{}
	return validateCreateCategories(payload.Categories, seenCourseCodes)
}

func validateCreateCategories(categories []models.CreateCategoryPayload, seenCourseCodes map[string]bool) error {
	for _, category := range categories {
		if strings.TrimSpace(category.NameTH) == "" {
			return CurriculumValidationError{Message: "category name_th is required"}
		}
		if category.RequiredCredits < 0 {
			return CurriculumValidationError{Message: "category required_credits must be zero or greater"}
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

		if err := validateCreateCategories(category.Children, seenCourseCodes); err != nil {
			return err
		}
	}

	return nil
}

func hasRole(roles []string, role string) bool {
	for _, r := range roles {
		if r == role {
			return true
		}
	}
	return false
}
