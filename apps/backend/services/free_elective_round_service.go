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
	if err := validateFreeElectiveRoundFilters(filters); err != nil {
		return nil, err
	}
	if filters.Status != "" && !validFreeElectiveRoundStatus(filters.Status) {
		return nil, FreeElectiveValidationError{Message: "status is invalid"}
	}
	return s.Repo.ListRounds(ctx, filters)
}

func validFreeElectiveRoundStatus(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "draft", "active", "finalized", "cancelled":
		return true
	default:
		return false
	}
}

func canRevertActiveRoundToDraft(round models.FreeElectiveRound) bool {
	return round.Status == "active" && round.LearnerCount == 0 && round.GradeCount == 0
}

func canChangeFreeElectiveRoundFaculty(round models.FreeElectiveRound) bool {
	return round.Status == "draft" && round.CourseCount == 0 && round.LearnerCount == 0 && round.GradeCount == 0
}

func validateFreeElectiveRoundMetadata(payload models.UpdateFreeElectiveRoundPayload) error {
	if payload.FacultyID == 0 {
		return FreeElectiveValidationError{Message: "faculty_id is required"}
	}
	return validateFreeElectiveRoundPeriod(&payload.AcademicYearBE, &payload.Semester)
}

func validateFreeElectiveRoundFilters(filters models.FreeElectiveRoundFilters) error {
	if filters.AcademicYearBE != nil && *filters.AcademicYearBE == 0 {
		return FreeElectiveValidationError{Message: "academic_year_be must be greater than zero"}
	}
	if filters.Semester != nil && (*filters.Semester < 1 || *filters.Semester > 3) {
		return FreeElectiveValidationError{Message: "semester must be 1, 2, or 3"}
	}
	return nil
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

func (s *FreeElectiveService) RecalculateRoundScores(ctx context.Context, claims *utils.Claims, roundID uint64) (*models.FreeElectiveRoundDetail, error) {
	if _, err := s.GetRound(ctx, claims, roundID); err != nil {
		return nil, err
	}
	if err := s.Repo.RecalculateFreeElectiveRoundScores(ctx, roundID, uint64(claims.UserID)); err != nil {
		if errors.Is(err, repositories.ErrFreeElectiveRoundLocked) {
			return nil, ErrFreeElectiveRoundLocked
		}
		if errors.Is(err, repositories.ErrFreeElectiveRoundNotFound) {
			return nil, ErrFreeElectiveRoundNotFound
		}
		return nil, err
	}
	return s.GetRound(ctx, claims, roundID)
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

func (s *FreeElectiveService) UpdateRoundMetadata(ctx context.Context, claims *utils.Claims, roundID uint64, payload models.UpdateFreeElectiveRoundPayload) (*models.FreeElectiveRoundDetail, error) {
	existing, err := s.GetRound(ctx, claims, roundID)
	if err != nil {
		return nil, err
	}
	if err := validateFreeElectiveRoundMetadata(payload); err != nil {
		return nil, err
	}
	if _, err := s.scopedFaculty(claims, &payload.FacultyID); err != nil {
		return nil, err
	}
	if existing.Round.Status != "draft" && existing.Round.Status != "active" {
		return nil, ErrFreeElectiveRoundLocked
	}
	if payload.FacultyID != existing.Round.FacultyID && !freeElectiveHasRole(claims, "admin") {
		return nil, ErrFreeElectiveForbidden
	}
	if payload.FacultyID != existing.Round.FacultyID && !canChangeFreeElectiveRoundFaculty(existing.Round) {
		return nil, FreeElectiveConflictError{
			Code:    "ROUND_FACULTY_CHANGE_REQUIRES_EMPTY",
			Message: "the faculty can be changed only while a draft round has no courses, learners, or grades",
		}
	}

	err = s.Repo.UpdateRoundMetadata(ctx, roundID, payload, uint64(claims.UserID))
	if errors.Is(err, repositories.ErrFreeElectiveRoundNotFound) {
		return nil, ErrFreeElectiveRoundNotFound
	}
	if errors.Is(err, repositories.ErrFreeElectiveRoundLocked) {
		return nil, ErrFreeElectiveRoundLocked
	}
	if errors.Is(err, repositories.ErrFreeElectiveRoundFacultyChangeRequiresEmpty) {
		return nil, FreeElectiveConflictError{
			Code:    "ROUND_FACULTY_CHANGE_REQUIRES_EMPTY",
			Message: "the faculty can be changed only while a draft round has no courses, learners, or grades",
		}
	}
	if errors.Is(err, repositories.ErrFreeElectiveRoundPeriodExists) {
		return nil, FreeElectiveConflictError{
			Code:    "ROUND_ALREADY_EXISTS",
			Message: "a free-elective round already exists for this faculty, academic year, and semester",
		}
	}
	if err != nil {
		return nil, err
	}
	return s.GetRound(ctx, claims, roundID)
}

func (s *FreeElectiveService) UpdateRoundStatus(ctx context.Context, claims *utils.Claims, roundID uint64, status string) (*models.FreeElectiveRoundDetail, error) {
	detail, err := s.GetRound(ctx, claims, roundID)
	if err != nil {
		return nil, err
	}
	nextStatus := strings.ToLower(strings.TrimSpace(status))
	if nextStatus != "draft" && nextStatus != "active" && nextStatus != "cancelled" && nextStatus != "finalized" {
		return nil, FreeElectiveValidationError{Message: "status must be draft, active, finalized, or cancelled"}
	}
	if detail.Round.Status == "finalized" || detail.Round.Status == "cancelled" {
		return nil, FreeElectiveConflictError{Code: "ROUND_NOT_EDITABLE", Message: "finalized or cancelled round cannot change status"}
	}
	if nextStatus == "draft" {
		if !canRevertActiveRoundToDraft(detail.Round) {
			return nil, FreeElectiveConflictError{
				Code:    "ROUND_REVERT_DRAFT_REQUIRES_EMPTY",
				Message: "an active round can return to draft only when it has no learners or grades",
				Data: map[string]int{
					"learner_count": detail.Round.LearnerCount,
					"grade_count":   detail.Round.GradeCount,
				},
			}
		}
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
	seenCourses := make(map[string]struct{}, len(payload.Courses))
	canonical.Courses = make([]models.FreeElectiveRoundCourseInput, 0, len(payload.Courses))
	for index, input := range payload.Courses {
		path := fmt.Sprintf("courses[%d]", index)
		course, err := s.resolveRoundCourse(ctx, claims, canonical.FacultyID, input)
		if err != nil {
			issuePath := path + ".course_code"
			if input.FreeElectiveCourseID > 0 {
				issuePath = path + ".free_elective_course_id"
			}
			issues = append(issues, roundValidationIssue(issuePath, roundCourseErrorCode(err), err.Error()))
			continue
		}

		courseCode := strings.TrimSpace(input.CourseCode)
		if course != nil {
			courseCode = course.Code
		}
		courseKey := normalizeFreeElectiveCourseCode(courseCode)
		if courseKey == "" {
			issues = append(issues, roundValidationIssue(path+".course_code", "COURSE_REQUIRED", "course code is required"))
			continue
		}
		if _, exists := seenCourses[courseKey]; exists {
			issues = append(issues, roundValidationIssue(path+".course_code", "DUPLICATE_COURSE", "the same course cannot be added to a round twice"))
			continue
		}
		seenCourses[courseKey] = struct{}{}

		if course == nil {
			if issue := validateNewRoundCourse(input, path); issue != nil {
				issues = append(issues, *issue)
				continue
			}
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
		canonicalCourse := input
		canonicalCourse.FreeElectiveCourseID = 0
		canonicalCourse.CourseCode = strings.TrimSpace(input.CourseCode)
		canonicalCourse.CourseNameTH = strings.TrimSpace(input.CourseNameTH)
		canonicalCourse.CourseNameEN = nullableRoundString(pointerStringValue(input.CourseNameEN))
		canonicalCourse.Description = nullableRoundString(pointerStringValue(input.Description))
		canonicalCourse.GradeScheme = strings.ToLower(strings.TrimSpace(input.GradeScheme))
		canonicalCourse.Competencies = validCompetencies
		if course != nil {
			canonicalCourse.FreeElectiveCourseID = course.FreeElectiveCourseID
			canonicalCourse.CourseCode = course.Code
			canonicalCourse.CourseNameTH = course.NameTH
			canonicalCourse.CourseNameEN = nullableRoundString(course.NameEN)
			canonicalCourse.Description = nullableRoundString(course.Description)
			canonicalCourse.Credits = course.Credits
			canonicalCourse.GradeScheme = course.GradeScheme
		}
		canonical.Courses = append(canonical.Courses, canonicalCourse)
	}
	return canonical, issues
}

func (s *FreeElectiveService) resolveRoundCourse(ctx context.Context, claims *utils.Claims, facultyID uint64, input models.FreeElectiveRoundCourseInput) (*models.FreeElectiveCourse, error) {
	if input.FreeElectiveCourseID > 0 {
		course, err := s.GetCourse(ctx, claims, input.FreeElectiveCourseID)
		if errors.Is(err, ErrFreeElectiveCourseNotFound) {
			return nil, errors.New("the selected free-elective course was not found")
		}
		if err != nil {
			return nil, err
		}
		if course.FacultyID != facultyID {
			return nil, errors.New("the selected course belongs to another faculty")
		}
		if !course.IsActive {
			return nil, errors.New("inactive free-elective courses cannot be added to a new round")
		}
		return course, nil
	}

	code := strings.TrimSpace(input.CourseCode)
	if code == "" {
		return nil, nil
	}
	existing, err := s.Repo.FindCourseByCode(ctx, facultyID, code)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if !existing.IsActive {
		return nil, errors.New("inactive free-elective courses cannot be added to a new round")
	}
	return existing, nil
}

func validateNewRoundCourse(input models.FreeElectiveRoundCourseInput, path string) *models.FreeElectiveRoundValidationIssue {
	if strings.TrimSpace(input.CourseNameTH) == "" {
		issue := roundValidationIssue(path+".course_name_th", "COURSE_NAME_REQUIRED", "course name in Thai is required")
		return &issue
	}
	if input.Credits <= 0 {
		issue := roundValidationIssue(path+".credits", "INVALID_CREDITS", "credits must be greater than zero")
		return &issue
	}
	if !grading.IsValidScheme(input.GradeScheme) {
		issue := roundValidationIssue(path+".grade_scheme", "INVALID_GRADE_SCHEME", "grade scheme must be letter or satisfactory")
		return &issue
	}
	return nil
}

func roundCourseErrorCode(err error) string {
	switch err.Error() {
	case "the selected free-elective course was not found":
		return "COURSE_NOT_FOUND"
	case "the selected course belongs to another faculty":
		return "COURSE_FACULTY_MISMATCH"
	case "inactive free-elective courses cannot be added to a new round":
		return "COURSE_INACTIVE"
	default:
		return "COURSE_UNAVAILABLE"
	}
}

func normalizeFreeElectiveCourseCode(code string) string {
	return strings.ToUpper(strings.TrimSpace(code))
}

func pointerStringValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
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
