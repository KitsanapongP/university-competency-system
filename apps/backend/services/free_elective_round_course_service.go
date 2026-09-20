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

func (s *FreeElectiveService) GetRoundCourse(ctx context.Context, claims *utils.Claims, roundID, roundCourseID uint64) (*models.FreeElectiveRoundCourseDetail, error) {
	if _, err := s.roundCourseInScope(ctx, claims, roundID, roundCourseID); err != nil {
		return nil, err
	}
	detail, err := s.Repo.GetRoundCourseDetail(ctx, roundID, roundCourseID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrFreeElectiveRoundCourseNotFound
	}
	if err != nil {
		return nil, err
	}
	return detail, nil
}

func (s *FreeElectiveService) AddRoundCourse(ctx context.Context, claims *utils.Claims, roundID uint64, payload models.AddFreeElectiveRoundCoursePayload) (*models.FreeElectiveRoundCourse, error) {
	if _, err := s.GetRound(ctx, claims, roundID); err != nil {
		return nil, err
	}
	if payload.FreeElectiveCourseID == 0 {
		return nil, FreeElectiveValidationError{Message: "free_elective_course_id is required"}
	}
	course, err := s.GetCourse(ctx, claims, payload.FreeElectiveCourseID)
	if err != nil {
		return nil, err
	}
	if !course.IsActive {
		return nil, FreeElectiveConflictError{
			Code:    "COURSE_INACTIVE",
			Message: "inactive free-elective courses cannot be added to a round",
		}
	}
	if err := s.validateRoundCourseCompetencies(ctx, payload.Competencies); err != nil {
		return nil, err
	}
	input := models.FreeElectiveRoundCourseInput{
		FreeElectiveCourseID: course.FreeElectiveCourseID,
		CourseCode:           course.Code,
		CourseNameTH:         course.NameTH,
		CourseNameEN:         nullableRoundString(course.NameEN),
		Description:          nullableRoundString(course.Description),
		Credits:              course.Credits,
		GradeScheme:          course.GradeScheme,
		Competencies:         payload.Competencies,
	}
	created, err := s.Repo.AddRoundCourse(ctx, roundID, uint64(claims.UserID), input)
	if errors.Is(err, repositories.ErrFreeElectiveRoundLocked) {
		return nil, ErrFreeElectiveRoundLocked
	}
	if errors.Is(err, repositories.ErrFreeElectiveRoundCourseExists) {
		return nil, FreeElectiveConflictError{
			Code:    "COURSE_ALREADY_IN_ROUND",
			Message: "this free-elective course is already in the round",
		}
	}
	if errors.Is(err, repositories.ErrFreeElectiveRoundNotFound) {
		return nil, ErrFreeElectiveRoundNotFound
	}
	return created, err
}

func (s *FreeElectiveService) ReplaceRoundCourseCompetencies(ctx context.Context, claims *utils.Claims, roundID, roundCourseID uint64, payload models.ReplaceFreeElectiveRoundCourseCompetenciesPayload) (*models.FreeElectiveRoundCourseDetail, error) {
	if _, err := s.roundCourseInScope(ctx, claims, roundID, roundCourseID); err != nil {
		return nil, err
	}
	if err := s.validateRoundCourseCompetencies(ctx, payload.Competencies); err != nil {
		return nil, err
	}
	err := s.Repo.ReplaceRoundCourseCompetencies(ctx, roundID, roundCourseID, payload.Competencies)
	if errors.Is(err, repositories.ErrFreeElectiveRoundLocked) {
		return nil, ErrFreeElectiveRoundLocked
	}
	if errors.Is(err, repositories.ErrFreeElectiveRoundCourseNotFound) {
		return nil, ErrFreeElectiveRoundCourseNotFound
	}
	if err != nil {
		return nil, err
	}
	return s.GetRoundCourse(ctx, claims, roundID, roundCourseID)
}

func (s *FreeElectiveService) DeleteRoundCourse(ctx context.Context, claims *utils.Claims, roundID, roundCourseID uint64) error {
	if _, err := s.roundCourseInScope(ctx, claims, roundID, roundCourseID); err != nil {
		return err
	}
	err := s.Repo.DeleteRoundCourse(ctx, roundID, roundCourseID)
	if errors.Is(err, repositories.ErrFreeElectiveRoundLocked) {
		return ErrFreeElectiveRoundLocked
	}
	if errors.Is(err, repositories.ErrFreeElectiveRoundCourseUsed) {
		return FreeElectiveConflictError{
			Code:    "ROUND_COURSE_HAS_LEARNERS",
			Message: "remove all learners before deleting this course from a draft round",
		}
	}
	if errors.Is(err, repositories.ErrFreeElectiveRoundCourseNotFound) {
		return ErrFreeElectiveRoundCourseNotFound
	}
	return err
}

func (s *FreeElectiveService) ListRoundCourseLearners(ctx context.Context, claims *utils.Claims, roundID, roundCourseID uint64, filters models.FreeElectiveRoundLearnerFilters) ([]models.FreeElectiveStudent, error) {
	if _, err := s.roundCourseInScope(ctx, claims, roundID, roundCourseID); err != nil {
		return nil, err
	}
	filters, err := s.scopeRoundCourseLearnerFilters(claims, filters)
	if err != nil {
		return nil, err
	}
	return s.Repo.ListRoundCourseLearners(ctx, roundID, roundCourseID, filters)
}

func (s *FreeElectiveService) GetRoundCourseLearnerSummary(ctx context.Context, claims *utils.Claims, roundID, roundCourseID uint64, filters models.FreeElectiveRoundLearnerFilters) (models.FreeElectiveRoundLearnerSummary, error) {
	if _, err := s.roundCourseInScope(ctx, claims, roundID, roundCourseID); err != nil {
		return models.FreeElectiveRoundLearnerSummary{}, err
	}
	filters, err := s.scopeRoundCourseLearnerFilters(claims, filters)
	if err != nil {
		return models.FreeElectiveRoundLearnerSummary{}, err
	}
	count, err := s.Repo.CountRoundCourseLearners(ctx, roundID, roundCourseID, filters)
	if err != nil {
		return models.FreeElectiveRoundLearnerSummary{}, err
	}
	return models.FreeElectiveRoundLearnerSummary{SelectableCount: count}, nil
}

func (s *FreeElectiveService) GetRoundCourseEnrollments(ctx context.Context, claims *utils.Claims, roundID, roundCourseID uint64) ([]models.FreeElectiveRoundEnrollment, error) {
	if _, err := s.roundCourseInScope(ctx, claims, roundID, roundCourseID); err != nil {
		return nil, err
	}
	enrollments, err := s.Repo.GetRoundCourseEnrollments(ctx, roundID, roundCourseID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrFreeElectiveRoundCourseNotFound
	}
	return enrollments, err
}

func (s *FreeElectiveService) AddRoundCourseEnrollments(ctx context.Context, claims *utils.Claims, roundID, roundCourseID uint64, payload models.AddFreeElectiveRoundEnrollmentsPayload) ([]models.FreeElectiveRoundEnrollment, error) {
	if _, err := s.roundCourseInScope(ctx, claims, roundID, roundCourseID); err != nil {
		return nil, err
	}
	if len(payload.Enrollments) == 0 {
		return nil, FreeElectiveValidationError{Message: "at least one learner is required"}
	}
	err := s.Repo.AddRoundCourseEnrollments(ctx, roundID, roundCourseID, uint64(claims.UserID), payload.Enrollments)
	if errors.Is(err, repositories.ErrFreeElectiveRoundLocked) {
		return nil, ErrFreeElectiveRoundLocked
	}
	if errors.Is(err, repositories.ErrFreeElectiveRoundCourseNotFound) {
		return nil, ErrFreeElectiveRoundCourseNotFound
	}
	if errors.Is(err, repositories.ErrFreeElectiveRoundEnrollmentExists) {
		return nil, FreeElectiveConflictError{
			Code:    "LEARNER_ALREADY_ENROLLED",
			Message: "one or more learners are already enrolled in this course for the round",
		}
	}
	if errors.Is(err, repositories.ErrFreeElectiveRoundEnrollmentInvalid) {
		return nil, FreeElectiveValidationError{Message: "each learner and curriculum selection must belong to the same active student"}
	}
	if err != nil {
		return nil, err
	}
	return s.GetRoundCourseEnrollments(ctx, claims, roundID, roundCourseID)
}

func (s *FreeElectiveService) AddAllRoundCourseLearners(ctx context.Context, claims *utils.Claims, roundID, roundCourseID uint64, filters models.FreeElectiveRoundLearnerFilters) ([]models.FreeElectiveRoundEnrollment, error) {
	if _, err := s.roundCourseInScope(ctx, claims, roundID, roundCourseID); err != nil {
		return nil, err
	}
	filters, err := s.scopeRoundCourseLearnerFilters(claims, filters)
	if err != nil {
		return nil, err
	}
	if err := validateRoundCourseLearnerSelection(filters); err != nil {
		return nil, err
	}
	_, err = s.Repo.AddAllRoundCourseLearners(ctx, roundID, roundCourseID, uint64(claims.UserID), filters)
	if errors.Is(err, repositories.ErrFreeElectiveRoundLocked) {
		return nil, ErrFreeElectiveRoundLocked
	}
	if errors.Is(err, repositories.ErrFreeElectiveRoundCourseNotFound) {
		return nil, ErrFreeElectiveRoundCourseNotFound
	}
	if err != nil {
		return nil, err
	}
	return s.GetRoundCourseEnrollments(ctx, claims, roundID, roundCourseID)
}

func (s *FreeElectiveService) scopeRoundCourseLearnerFilters(claims *utils.Claims, filters models.FreeElectiveRoundLearnerFilters) (models.FreeElectiveRoundLearnerFilters, error) {
	facultyID, err := s.scopedFaculty(claims, filters.FacultyID)
	if err != nil {
		return filters, err
	}
	filters.FacultyID = facultyID
	if filters.MajorID != nil && *filters.MajorID == 0 {
		filters.MajorID = nil
	}
	if filters.CurriculumID != nil && *filters.CurriculumID == 0 {
		filters.CurriculumID = nil
	}
	if filters.EntryYearBE != nil && *filters.EntryYearBE == 0 {
		filters.EntryYearBE = nil
	}
	return filters, nil
}

func validateRoundCourseLearnerSelection(filters models.FreeElectiveRoundLearnerFilters) error {
	if filters.FacultyID == nil && filters.MajorID == nil && filters.CurriculumID == nil &&
		filters.EntryYearBE == nil && strings.TrimSpace(filters.Search) == "" {
		return FreeElectiveValidationError{Message: "at least one learner filter is required when selecting all learners"}
	}
	return nil
}

func (s *FreeElectiveService) UpdateRoundCourseEnrollmentStatus(ctx context.Context, claims *utils.Claims, roundID, roundCourseID, roundCourseEnrollmentID uint64, payload models.UpdateFreeElectiveRoundEnrollmentStatusPayload) ([]models.FreeElectiveRoundEnrollment, error) {
	if _, err := s.roundCourseInScope(ctx, claims, roundID, roundCourseID); err != nil {
		return nil, err
	}
	status := strings.ToLower(strings.TrimSpace(payload.Status))
	if status != "enrolled" && status != "withdrawn" && status != "completed" {
		return nil, FreeElectiveValidationError{Message: "status must be enrolled, withdrawn, or completed"}
	}
	err := s.Repo.UpdateRoundCourseEnrollmentStatus(ctx, roundID, roundCourseID, roundCourseEnrollmentID, status)
	if errors.Is(err, repositories.ErrFreeElectiveRoundLocked) {
		return nil, ErrFreeElectiveRoundLocked
	}
	if errors.Is(err, repositories.ErrFreeElectiveRoundEnrollmentNotFound) {
		return nil, ErrFreeElectiveRoundEnrollmentNotFound
	}
	if err != nil {
		return nil, err
	}
	return s.GetRoundCourseEnrollments(ctx, claims, roundID, roundCourseID)
}

func (s *FreeElectiveService) UpsertRoundCourseGrade(ctx context.Context, claims *utils.Claims, roundID, roundCourseID, roundCourseEnrollmentID uint64, payload models.UpsertFreeElectiveRoundGradePayload) ([]models.FreeElectiveRoundEnrollment, error) {
	course, err := s.roundCourseInScope(ctx, claims, roundID, roundCourseID)
	if err != nil {
		return nil, err
	}
	if err := validateFreeElectiveGrade(payload.Grade, course.GradeScheme); err != nil {
		return nil, err
	}
	source := strings.ToLower(strings.TrimSpace(payload.GradeSource))
	if source == "" {
		source = "manual"
	}
	if source != "manual" && source != "excel" && source != "reg" {
		return nil, FreeElectiveValidationError{Message: "grade_source is invalid"}
	}
	err = s.Repo.UpsertRoundCourseGrade(
		ctx,
		roundID,
		roundCourseID,
		roundCourseEnrollmentID,
		uint64(claims.UserID),
		grading.Normalize(payload.Grade),
		source,
		payload.SourceReference,
	)
	if errors.Is(err, repositories.ErrFreeElectiveRoundLocked) {
		return nil, ErrFreeElectiveRoundLocked
	}
	if errors.Is(err, repositories.ErrFreeElectiveRoundGradeTargetNotFound) {
		return nil, ErrFreeElectiveRoundEnrollmentNotFound
	}
	if errors.Is(err, repositories.ErrFreeElectiveRoundEnrollmentInvalid) {
		return nil, FreeElectiveConflictError{
			Code:    "WITHDRAWN_ENROLLMENT",
			Message: "restore the learner before entering a grade",
		}
	}
	if err != nil {
		return nil, err
	}

	enrollments, err := s.GetRoundCourseEnrollments(ctx, claims, roundID, roundCourseID)
	if err != nil {
		return nil, err
	}
	for _, enrollment := range enrollments {
		if enrollment.RoundCourseEnrollmentID != roundCourseEnrollmentID {
			continue
		}
		if err := s.Repo.RecalculateRoundCourseBestGrade(ctx, enrollment.EnrollmentID, course.FreeElectiveCourseID); err != nil {
			return nil, err
		}
		return s.GetRoundCourseEnrollments(ctx, claims, roundID, roundCourseID)
	}
	return nil, ErrFreeElectiveRoundEnrollmentNotFound
}

func (s *FreeElectiveService) roundCourseInScope(ctx context.Context, claims *utils.Claims, roundID, roundCourseID uint64) (*models.FreeElectiveRoundCourse, error) {
	round, err := s.GetRound(ctx, claims, roundID)
	if err != nil {
		return nil, err
	}
	for index := range round.Courses {
		if round.Courses[index].RoundCourseID == roundCourseID {
			return &round.Courses[index], nil
		}
	}
	return nil, ErrFreeElectiveRoundCourseNotFound
}

func (s *FreeElectiveService) validateRoundCourseCompetencies(ctx context.Context, inputs []models.FreeElectiveRoundCompetencyInput) error {
	if len(inputs) == 0 {
		return nil
	}
	ids := make([]uint64, 0, len(inputs))
	seen := make(map[uint64]struct{}, len(inputs))
	for _, input := range inputs {
		if input.CompetencyID == 0 {
			return FreeElectiveValidationError{Message: "competency_id is required"}
		}
		if _, exists := seen[input.CompetencyID]; exists {
			return FreeElectiveValidationError{Message: "each competency can be added only once per course"}
		}
		if input.WeightPercent < 0 || input.WeightPercent > 100 {
			return FreeElectiveValidationError{Message: "weight_percent must be between zero and one hundred"}
		}
		seen[input.CompetencyID] = struct{}{}
		ids = append(ids, input.CompetencyID)
	}
	active, err := s.Repo.ActiveCompetencyIDs(ctx, ids)
	if err != nil {
		return err
	}
	for _, id := range ids {
		if _, exists := active[id]; !exists {
			return FreeElectiveValidationError{Message: fmt.Sprintf("competency %d was not found", id)}
		}
	}
	return nil
}
