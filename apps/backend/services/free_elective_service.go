package services

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/spw32767/university-competency-system-backend/grading"
	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
	"github.com/spw32767/university-competency-system-backend/utils"
)

var (
	ErrFreeElectiveForbidden      = errors.New("insufficient free-elective scope")
	ErrFreeElectiveCourseNotFound = errors.New("free-elective course not found")
)

type FreeElectiveValidationError struct {
	Message string
}

func (e FreeElectiveValidationError) Error() string {
	return e.Message
}

type FreeElectiveConflictError struct {
	Code    string
	Message string
	Data    any
}

func (e FreeElectiveConflictError) Error() string {
	return e.Message
}

type FreeElectiveService struct {
	Repo *repositories.FreeElectiveRepository
}

func NewFreeElectiveService(repo *repositories.FreeElectiveRepository) *FreeElectiveService {
	return &FreeElectiveService{Repo: repo}
}

func freeElectiveHasRole(claims *utils.Claims, role string) bool {
	for _, item := range claims.Roles {
		if item == role {
			return true
		}
	}
	return false
}

func (s *FreeElectiveService) scopedFaculty(claims *utils.Claims, requested *uint64) (*uint64, error) {
	if freeElectiveHasRole(claims, "admin") {
		return requested, nil
	}
	if !freeElectiveHasRole(claims, "officer") || claims.FacultyID == nil || *claims.FacultyID <= 0 {
		return nil, ErrFreeElectiveForbidden
	}
	scoped := uint64(*claims.FacultyID)
	if requested != nil && *requested != scoped {
		return nil, ErrFreeElectiveForbidden
	}
	return &scoped, nil
}

func (s *FreeElectiveService) ListCourses(ctx context.Context, claims *utils.Claims, filters models.FreeElectiveCourseFilters) ([]*models.FreeElectiveCourse, error) {
	facultyID, err := s.scopedFaculty(claims, filters.FacultyID)
	if err != nil {
		return nil, err
	}
	return s.Repo.ListCourses(ctx, facultyID)
}

func (s *FreeElectiveService) CreateCourse(ctx context.Context, claims *utils.Claims, payload models.UpsertFreeElectiveCoursePayload) (*models.FreeElectiveCourse, error) {
	facultyID, err := s.scopedFaculty(claims, nonZeroFreeElectiveID(payload.FacultyID))
	if err != nil {
		return nil, err
	}
	if facultyID == nil || *facultyID == 0 {
		return nil, FreeElectiveValidationError{Message: "faculty_id is required"}
	}
	payload.FacultyID = *facultyID
	if err := validateFreeElectiveCoursePayload(payload); err != nil {
		return nil, err
	}
	return s.Repo.CreateCourse(ctx, payload, uint64(claims.UserID))
}

func (s *FreeElectiveService) UpdateCourse(ctx context.Context, claims *utils.Claims, courseID uint64, payload models.UpsertFreeElectiveCoursePayload) (*models.FreeElectiveCourse, error) {
	existing, err := s.Repo.GetCourse(ctx, courseID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrFreeElectiveCourseNotFound
	}
	if err != nil {
		return nil, err
	}
	if _, err := s.scopedFaculty(claims, &existing.FacultyID); err != nil {
		return nil, err
	}
	if payload.FacultyID == 0 {
		payload.FacultyID = existing.FacultyID
	}
	facultyID, err := s.scopedFaculty(claims, &payload.FacultyID)
	if err != nil {
		return nil, err
	}
	payload.FacultyID = *facultyID
	if payload.GradeScheme == "" {
		payload.GradeScheme = existing.GradeScheme
	}
	if payload.Code == "" {
		payload.Code = existing.Code
	}
	if payload.NameTH == "" {
		payload.NameTH = existing.NameTH
	}
	if payload.Credits == 0 {
		payload.Credits = existing.Credits
	}
	if err := validateFreeElectiveCoursePayload(payload); err != nil {
		return nil, err
	}

	nextScheme := strings.ToLower(strings.TrimSpace(payload.GradeScheme))
	resetGrades := nextScheme != existing.GradeScheme &&
		(existing.OfferingCount > 0 || existing.FinalizedOfferingCount > 0)
	if resetGrades {
		impact, err := s.Repo.GetCourseImpact(ctx, courseID)
		if err != nil {
			return nil, err
		}
		impact.PreviousScheme = existing.GradeScheme
		impact.NextScheme = nextScheme
		if !payload.ConfirmImpact {
			return nil, FreeElectiveConflictError{
				Code:    "GRADE_SCHEME_CHANGE_REQUIRES_CONFIRMATION",
				Message: "changing the grade scheme will clear current grade records and reopen offerings",
				Data:    impact,
			}
		}
	}
	if err := s.Repo.UpdateCourse(ctx, courseID, payload, uint64(claims.UserID), resetGrades); errors.Is(err, sql.ErrNoRows) {
		return nil, ErrFreeElectiveCourseNotFound
	} else if err != nil {
		return nil, err
	}
	return s.Repo.GetCourse(ctx, courseID)
}

func (s *FreeElectiveService) GetCourse(ctx context.Context, claims *utils.Claims, courseID uint64) (*models.FreeElectiveCourse, error) {
	course, err := s.Repo.GetCourse(ctx, courseID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrFreeElectiveCourseNotFound
	}
	if err != nil {
		return nil, err
	}
	if _, err := s.scopedFaculty(claims, &course.FacultyID); err != nil {
		return nil, err
	}
	return course, nil
}

func validateFreeElectiveCoursePayload(payload models.UpsertFreeElectiveCoursePayload) error {
	if payload.FacultyID == 0 {
		return FreeElectiveValidationError{Message: "faculty_id is required"}
	}
	if strings.TrimSpace(payload.Code) == "" {
		return FreeElectiveValidationError{Message: "code is required"}
	}
	if strings.TrimSpace(payload.NameTH) == "" {
		return FreeElectiveValidationError{Message: "name_th is required"}
	}
	if payload.Credits <= 0 {
		return FreeElectiveValidationError{Message: "credits must be greater than zero"}
	}
	if !grading.IsValidScheme(payload.GradeScheme) {
		return FreeElectiveValidationError{Message: "grade_scheme must be letter or satisfactory"}
	}
	return nil
}

func nonZeroFreeElectiveID(value uint64) *uint64 {
	if value == 0 {
		return nil
	}
	return &value
}
