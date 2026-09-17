package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/spw32767/university-competency-system-backend/grading"
	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
	"github.com/spw32767/university-competency-system-backend/utils"
)

func (s *FreeElectiveService) ListRounds(ctx context.Context, claims *utils.Claims, filters models.FreeElectiveRoundFilters) ([]models.FreeElectiveRound, error) {
	facultyID, err := s.scopedFaculty(claims, filters.FacultyID)
	if err != nil {
		return nil, err
	}
	filters.FacultyID = facultyID
	if err := validateFreeElectiveRoundPeriod(filters.AcademicYearBE, filters.Semester); err != nil {
		return nil, err
	}
	if filters.Status != "" && !validFreeElectiveOfferingStatus(filters.Status) {
		return nil, FreeElectiveValidationError{Message: "status is invalid"}
	}
	return s.Repo.ListRounds(ctx, filters)
}

func (s *FreeElectiveService) GetRound(ctx context.Context, claims *utils.Claims, roundID uint64) (*models.FreeElectiveRoundDetail, error) {
	detail, err := s.Repo.GetRoundDetail(ctx, roundID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrFreeElectiveRoundNotFound
	}
	if err != nil {
		return nil, err
	}
	if _, err := s.scopedFaculty(claims, &detail.Round.FacultyID); err != nil {
		return nil, err
	}
	return detail, nil
}

func (s *FreeElectiveService) PreviewRound(ctx context.Context, claims *utils.Claims, payload models.PreviewFreeElectiveRoundPayload) (*models.FreeElectiveRoundPreview, error) {
	canonical, issues := s.validateAndNormalizeRound(ctx, claims, models.CreateFreeElectiveRoundPayload{
		FacultyID:      payload.FacultyID,
		AcademicYearBE: payload.AcademicYearBE,
		Semester:       payload.Semester,
		Courses:        payload.Courses,
	})
	preview := &models.FreeElectiveRoundPreview{
		Valid:          len(issues) == 0,
		FacultyID:      canonical.FacultyID,
		AcademicYearBE: canonical.AcademicYearBE,
		Semester:       canonical.Semester,
		Courses:        canonical.Courses,
		Errors:         issues,
	}
	if len(issues) == 0 {
		exists, err := s.Repo.RoundExists(ctx, canonical.FacultyID, canonical.AcademicYearBE, canonical.Semester)
		if err != nil {
			return nil, err
		}
		if exists {
			preview.Valid = false
			preview.Errors = append(preview.Errors, models.FreeElectiveRoundValidationIssue{
				Path:    "academic_year_be",
				Code:    "ROUND_ALREADY_EXISTS",
				Message: "a free-elective round already exists for this faculty, academic year, and semester",
			})
		}
	}
	return preview, nil
}

func (s *FreeElectiveService) CreateRound(ctx context.Context, claims *utils.Claims, payload models.CreateFreeElectiveRoundPayload) (*models.FreeElectiveRoundDetail, error) {
	canonical, issues := s.validateAndNormalizeRound(ctx, claims, payload)
	if len(issues) > 0 {
		return nil, FreeElectiveValidationError{Message: issues[0].Message}
	}
	exists, err := s.Repo.RoundExists(ctx, canonical.FacultyID, canonical.AcademicYearBE, canonical.Semester)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, FreeElectiveConflictError{
			Code:    "ROUND_ALREADY_EXISTS",
			Message: "a free-elective round already exists for this faculty, academic year, and semester",
		}
	}
	return s.Repo.CreateRound(ctx, canonical, uint64(claims.UserID))
}

func (s *FreeElectiveService) DuplicateRound(ctx context.Context, claims *utils.Claims, roundID uint64, payload models.DuplicateFreeElectiveRoundPayload) (*models.FreeElectiveRoundDetail, error) {
	source, err := s.GetRound(ctx, claims, roundID)
	if err != nil {
		return nil, err
	}
	if err := validateFreeElectiveRoundPeriod(&payload.AcademicYearBE, &payload.Semester); err != nil {
		return nil, err
	}
	if payload.AcademicYearBE == source.Round.AcademicYearBE && payload.Semester == source.Round.Semester {
		return nil, FreeElectiveConflictError{
			Code:    "ROUND_ALREADY_EXISTS",
			Message: "the duplicate round must use a different academic year or semester",
		}
	}
	exists, err := s.Repo.RoundExists(ctx, source.Round.FacultyID, payload.AcademicYearBE, payload.Semester)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, FreeElectiveConflictError{
			Code:    "ROUND_ALREADY_EXISTS",
			Message: "a free-elective round already exists for this faculty, academic year, and semester",
		}
	}
	return s.Repo.DuplicateRound(ctx, roundID, payload, uint64(claims.UserID))
}

func (s *FreeElectiveService) UpdateRoundStatus(ctx context.Context, claims *utils.Claims, roundID uint64, status string) (*models.FreeElectiveRoundDetail, error) {
	detail, err := s.GetRound(ctx, claims, roundID)
	if err != nil {
		return nil, err
	}
	nextStatus := strings.ToLower(strings.TrimSpace(status))
	if nextStatus != "active" && nextStatus != "cancelled" && nextStatus != "finalized" {
		return nil, FreeElectiveValidationError{Message: "status must be active, finalized, or cancelled"}
	}
	if detail.Round.Status == "finalized" || detail.Round.Status == "cancelled" {
		return nil, FreeElectiveConflictError{Code: "ROUND_NOT_EDITABLE", Message: "finalized or cancelled round cannot change status"}
	}
	if nextStatus == "active" && len(detail.Courses) == 0 {
		return nil, FreeElectiveConflictError{Code: "COURSES_REQUIRED", Message: "add at least one course before opening the round"}
	}
	if nextStatus == "finalized" {
		return nil, FreeElectiveConflictError{Code: "ROUND_FINALIZE_UNAVAILABLE", Message: "round finalization is not available until learner and grade workflows are migrated"}
	}
	if err := s.Repo.UpdateRoundStatus(ctx, roundID, nextStatus, uint64(claims.UserID)); err != nil {
		if errors.Is(err, repositories.ErrFreeElectiveRoundNotFound) {
			return nil, ErrFreeElectiveRoundNotFound
		}
		return nil, err
	}
	return s.GetRound(ctx, claims, roundID)
}

func (s *FreeElectiveService) validateAndNormalizeRound(ctx context.Context, claims *utils.Claims, payload models.CreateFreeElectiveRoundPayload) (models.CreateFreeElectiveRoundPayload, []models.FreeElectiveRoundValidationIssue) {
	canonical := payload
	issues := make([]models.FreeElectiveRoundValidationIssue, 0)
	facultyID, err := s.scopedFaculty(claims, nonZeroFreeElectiveID(payload.FacultyID))
	if err != nil {
		issues = append(issues, roundValidationIssue("faculty_id", "FACULTY_SCOPE_FORBIDDEN", "the selected faculty is outside your access scope"))
	} else if facultyID == nil || *facultyID == 0 {
		issues = append(issues, roundValidationIssue("faculty_id", "FACULTY_REQUIRED", "faculty_id is required"))
	} else {
		canonical.FacultyID = *facultyID
	}
	if err := validateFreeElectiveRoundPeriod(&canonical.AcademicYearBE, &canonical.Semester); err != nil {
		issues = append(issues, roundValidationIssue("academic_year_be", "INVALID_PERIOD", err.Error()))
	}
	if len(payload.Courses) == 0 {
		issues = append(issues, roundValidationIssue("courses", "COURSES_REQUIRED", "at least one free-elective course is required"))
	}
	seenCourses := make(map[uint64]struct{}, len(payload.Courses))
	canonical.Courses = make([]models.FreeElectiveRoundCourseInput, 0, len(payload.Courses))
	for index, input := range payload.Courses {
		path := fmt.Sprintf("courses[%d]", index)
		if input.FreeElectiveCourseID == 0 {
			issues = append(issues, roundValidationIssue(path+".free_elective_course_id", "COURSE_REQUIRED", "choose a free-elective course"))
			continue
		}
		if _, exists := seenCourses[input.FreeElectiveCourseID]; exists {
			issues = append(issues, roundValidationIssue(path+".free_elective_course_id", "DUPLICATE_COURSE", "the same course cannot be added to a round twice"))
			continue
		}
		seenCourses[input.FreeElectiveCourseID] = struct{}{}
		course, err := s.GetCourse(ctx, claims, input.FreeElectiveCourseID)
		if errors.Is(err, ErrFreeElectiveCourseNotFound) {
			issues = append(issues, roundValidationIssue(path+".free_elective_course_id", "COURSE_NOT_FOUND", "the selected free-elective course was not found"))
			continue
		}
		if err != nil {
			issues = append(issues, roundValidationIssue(path+".free_elective_course_id", "COURSE_UNAVAILABLE", err.Error()))
			continue
		}
		if !course.IsActive {
			issues = append(issues, roundValidationIssue(path+".free_elective_course_id", "COURSE_INACTIVE", "inactive free-elective courses cannot be added to a new round"))
			continue
		}
		if len(input.Competencies) == 0 {
			issues = append(issues, roundValidationIssue(path+".competencies", "COMPETENCIES_REQUIRED", "add at least one competency to this course"))
		}
		seenCompetencies := make(map[uint64]struct{}, len(input.Competencies))
		validCompetencies := make([]models.FreeElectiveRoundCompetencyInput, 0, len(input.Competencies))
		for competencyIndex, competency := range input.Competencies {
			competencyPath := fmt.Sprintf("%s.competencies[%d]", path, competencyIndex)
			if competency.CompetencyID == 0 {
				issues = append(issues, roundValidationIssue(competencyPath+".competency_id", "COMPETENCY_REQUIRED", "choose a competency"))
				continue
			}
			if _, exists := seenCompetencies[competency.CompetencyID]; exists {
				issues = append(issues, roundValidationIssue(competencyPath+".competency_id", "DUPLICATE_COMPETENCY", "the same competency cannot be mapped twice to one course"))
				continue
			}
			seenCompetencies[competency.CompetencyID] = struct{}{}
			if competency.WeightPercent < 0 || competency.WeightPercent > 100 {
				issues = append(issues, roundValidationIssue(competencyPath+".weight_percent", "INVALID_WEIGHT", "weight must be between 0 and 100"))
				continue
			}
			validCompetencies = append(validCompetencies, competency)
		}
		canonical.Courses = append(canonical.Courses, models.FreeElectiveRoundCourseInput{
			RoundCourseID:        input.RoundCourseID,
			FreeElectiveCourseID: course.FreeElectiveCourseID,
			CourseCode:           course.Code,
			CourseNameTH:         course.NameTH,
			CourseNameEN:         nullableRoundString(course.NameEN),
			Description:          nullableRoundString(course.Description),
			Credits:              course.Credits,
			GradeScheme:          course.GradeScheme,
			Competencies:         validCompetencies,
		})
	}
	return canonical, issues
}

func validateFreeElectiveRoundPeriod(year *uint64, semester *uint64) error {
	if year == nil || *year == 0 {
		return FreeElectiveValidationError{Message: "academic_year_be is required"}
	}
	if semester == nil || *semester < 1 || *semester > 3 {
		return FreeElectiveValidationError{Message: "semester must be 1, 2, or 3"}
	}
	return nil
}

func roundValidationIssue(path, code, message string) models.FreeElectiveRoundValidationIssue {
	return models.FreeElectiveRoundValidationIssue{Path: path, Code: code, Message: message}
}

func nullableRoundString(value string) *string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	copy := value
	return &copy
}

func freeElectiveRoundRawScore(scheme, grade string) (float64, bool) {
	evaluation := grading.Evaluate(scheme, grade)
	return evaluation.Score, evaluation.HasScore
}
