package services

import (
	"context"
	"database/sql"
	"errors"

	"github.com/spw32767/university-competency-system-backend/grading"
	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
)

var fixedCourseGradeMap = grading.FixedCourseGradeMap

type CourseCompetencyScoringService struct {
	Cohorts *StudentCohortService
	Repo    *repositories.CourseCompetencyScoringRepository
}

func NewCourseCompetencyScoringService(cohorts *StudentCohortService, repo *repositories.CourseCompetencyScoringRepository) *CourseCompetencyScoringService {
	return &CourseCompetencyScoringService{Cohorts: cohorts, Repo: repo}
}

func (s *CourseCompetencyScoringService) GetRequirements(ctx context.Context, cohortID uint64, roles []string, facultyID *int64) ([]models.CohortCompetencyRequirement, error) {
	if _, err := s.Cohorts.GetCohort(ctx, cohortID, roles, facultyID); err != nil {
		return nil, err
	}
	return s.Repo.GetRequirements(ctx, cohortID)
}

func (s *CourseCompetencyScoringService) ReplaceRequirements(ctx context.Context, cohortID uint64, payload models.ReplaceCohortCompetencyRequirementsRequest, roles []string, facultyID *int64) ([]models.CohortCompetencyRequirement, error) {
	cohort, err := s.Cohorts.GetCohort(ctx, cohortID, roles, facultyID)
	if err != nil {
		return nil, err
	}
	if cohort.Status != "active" {
		return nil, StudentCohortConflictError{Code: "COHORT_NOT_ACTIVE", Message: "competency targets can only be changed for an active cohort"}
	}
	allowed, err := s.Repo.GetAssignedTemplateCompetencies(ctx, cohortID)
	if err != nil {
		return nil, err
	}
	allowedSet := make(map[uint64]bool, len(allowed))
	for _, id := range allowed {
		allowedSet[id] = true
	}
	seen := make(map[uint64]bool, len(payload.Requirements))
	for index := range payload.Requirements {
		requirement := &payload.Requirements[index]
		if requirement.CompetencyID == 0 || seen[requirement.CompetencyID] || !allowedSet[requirement.CompetencyID] {
			return nil, StudentCohortValidationError{Message: "requirements must use unique competencies from the assigned template"}
		}
		if requirement.TargetScore < 0 {
			return nil, StudentCohortValidationError{Message: "target_score must be zero or greater"}
		}
		seen[requirement.CompetencyID] = true
	}
	if err := s.Repo.ReplaceRequirements(ctx, cohortID, payload.Requirements); err != nil {
		return nil, err
	}
	return s.Repo.GetRequirements(ctx, cohortID)
}

func (s *CourseCompetencyScoringService) Recalculate(ctx context.Context, cohortID uint64, roles []string, facultyID *int64) (*models.CourseCompetencyRecalculationResult, error) {
	cohort, err := s.Cohorts.GetCohort(ctx, cohortID, roles, facultyID)
	if err != nil {
		return nil, err
	}
	if cohort.Status != "active" {
		return nil, StudentCohortConflictError{Code: "COHORT_NOT_ACTIVE", Message: "course scores can only be calculated for an active cohort"}
	}
	result, err := s.Repo.Recalculate(ctx, cohortID, fixedCourseGradeMap)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, StudentCohortConflictError{Code: "TEMPLATE_ASSIGNMENT_REQUIRED", Message: "an active assigned template is required before calculating course scores"}
	}
	return result, err
}

func (s *CourseCompetencyScoringService) GetSummary(ctx context.Context, cohortID uint64, roles []string, facultyID *int64) ([]models.CohortLearnerCompetencySummary, error) {
	if _, err := s.Cohorts.GetCohort(ctx, cohortID, roles, facultyID); err != nil {
		return nil, err
	}
	return s.Repo.GetSummary(ctx, cohortID)
}

func FixedCourseGradeScore(grade string) (float64, bool) {
	return grading.Score(grade)
}
