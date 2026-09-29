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
	ErrFreeElectiveForbidden               = errors.New("insufficient free-elective scope")
	ErrFreeElectiveCourseNotFound          = errors.New("free-elective course not found")
	ErrFreeElectiveRoundNotFound           = errors.New("free-elective round not found")
	ErrFreeElectiveRoundCourseNotFound     = errors.New("free-elective round course not found")
	ErrFreeElectiveRoundEnrollmentNotFound = errors.New("free-elective round enrollment not found")
	ErrFreeElectiveRoundLocked             = errors.New("free-elective round is locked")
	ErrFreeElectiveStudentGroupNotFound    = errors.New("free-elective student group not found")
	ErrFreeElectiveStudentNotFound         = errors.New("free-elective student not found")
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
	resetGrades := false
	if nextScheme != existing.GradeScheme {
		impact, err := s.Repo.GetCourseImpact(ctx, courseID)
		if err != nil {
			return nil, err
		}
		resetGrades = impact.GradeRecordCount > 0
		impact.PreviousScheme = existing.GradeScheme
		impact.NextScheme = nextScheme
		if resetGrades && !payload.ConfirmImpact {
			return nil, FreeElectiveConflictError{
				Code:    "GRADE_SCHEME_CHANGE_REQUIRES_CONFIRMATION",
					Message: "changing the grade scheme will clear current grade records and reopen rounds",
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

func validateFreeElectiveGrade(value, scheme string) error {
	if strings.TrimSpace(value) == "" {
		return FreeElectiveValidationError{Message: "grade is required"}
	}
	if err := grading.ValidateGrade(scheme, value); err != nil {
		return FreeElectiveValidationError{Message: "grade is not allowed for this course grade scheme"}
	}
	return nil
}

func (s *FreeElectiveService) GetStudentGroups(ctx context.Context, claims *utils.Claims, filters models.FreeElectiveStudentGroupFilters) ([]models.FreeElectiveStudentGroup, error) {
	facultyID, err := s.scopedFaculty(claims, filters.FacultyID)
	if err != nil {
		return nil, err
	}
	filters.FacultyID = facultyID
	return s.Repo.GetStudentGroups(ctx, filters)
}

func (s *FreeElectiveService) GetCohortStudents(ctx context.Context, claims *utils.Claims, cohortID uint64) ([]models.FreeElectiveStudent, error) {
	facultyID, err := s.scopedFaculty(claims, nil)
	if err != nil {
		return nil, err
	}
	groups, err := s.Repo.GetStudentGroups(ctx, models.FreeElectiveStudentGroupFilters{FacultyID: facultyID})
	if err != nil {
		return nil, err
	}
	var group *models.FreeElectiveStudentGroup
	for index := range groups {
		if groups[index].CohortID == cohortID {
			group = &groups[index]
			break
		}
	}
	if group == nil {
		return nil, ErrFreeElectiveStudentGroupNotFound
	}
	return s.Repo.GetCohortStudents(ctx, cohortID)
}

func (s *FreeElectiveService) GetStudentDetail(ctx context.Context, claims *utils.Claims, enrollmentID uint64) (*models.FreeElectiveStudentDetail, error) {
	detail, err := s.getScopedStudentDetail(ctx, claims, enrollmentID)
	if err != nil {
		return nil, err
	}
	return detail, nil
}

func (s *FreeElectiveService) getScopedStudentDetail(ctx context.Context, claims *utils.Claims, enrollmentID uint64) (*models.FreeElectiveStudentDetail, error) {
	detail, err := s.Repo.GetStudentDetail(ctx, enrollmentID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrFreeElectiveStudentNotFound
	}
	if err != nil {
		return nil, err
	}
	if detail.Student.FacultyID > 0 {
		if _, err := s.scopedFaculty(claims, &detail.Student.FacultyID); err != nil {
			return nil, err
		}
		return detail, nil
	}
	if !freeElectiveHasRole(claims, "admin") {
		return nil, ErrFreeElectiveForbidden
	}
	return detail, nil
}

func nonZeroFreeElectiveID(value uint64) *uint64 {
	if value == 0 {
		return nil
	}
	return &value
}
