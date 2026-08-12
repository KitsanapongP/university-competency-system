package services

import (
	"context"
	"strings"

	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
)

// TemplateAssignmentError carries a stable API error code for the assignment
// workflow. The frontend translates its English message for the active locale.
type TemplateAssignmentError struct {
	Code    string
	Message string
	Data    any
}

func (e *TemplateAssignmentError) Error() string { return e.Message }

type TemplateAssignmentService struct {
	Templates   *repositories.TemplateRepository
	Cohorts     *repositories.StudentCohortRepository
	Assignments *repositories.TemplateAssignmentRepository
}

func NewTemplateAssignmentService(templates *repositories.TemplateRepository, cohorts *repositories.StudentCohortRepository, assignments *repositories.TemplateAssignmentRepository) *TemplateAssignmentService {
	return &TemplateAssignmentService{Templates: templates, Cohorts: cohorts, Assignments: assignments}
}

func (s *TemplateAssignmentService) GetAssignments(ctx context.Context, facultyID uint64, isAdmin bool) ([]models.TemplateAssignment, error) {
	var scopedFaculty *uint64
	if !isAdmin {
		if facultyID == 0 {
			return nil, assignmentError("FORBIDDEN", "faculty scope is required")
		}
		scopedFaculty = &facultyID
	}
	return s.Assignments.GetAssignments(ctx, scopedFaculty)
}

func (s *TemplateAssignmentService) GetAvailableTemplates(ctx context.Context, facultyID uint64, isAdmin bool) ([]models.TemplateAssignmentCandidate, error) {
	var scopedFaculty *uint64
	if !isAdmin {
		if facultyID == 0 {
			return nil, assignmentError("FORBIDDEN", "faculty scope is required")
		}
		scopedFaculty = &facultyID
	}
	return s.Assignments.GetAvailableTemplates(ctx, scopedFaculty)
}

func (s *TemplateAssignmentService) GetAvailableCohorts(ctx context.Context, templateID, facultyID uint64, isAdmin bool) ([]models.TemplateAssignmentCandidate, error) {
	template, err := s.templateForAccess(ctx, templateID, facultyID, isAdmin)
	if err != nil {
		return nil, err
	}
	if template.CurriculumID == 0 {
		return nil, assignmentError("TEMPLATE_HAS_NO_CURRICULUM", "template has no curriculum owner and is read-only")
	}
	if !template.IsActive {
		return nil, assignmentError("TEMPLATE_INACTIVE", "template must be active before assignment")
	}
	used, err := s.Assignments.HasAnyAssignmentForTemplate(ctx, templateID)
	if err != nil {
		return nil, err
	}
	if used {
		return nil, assignmentError("TEMPLATE_ALREADY_ASSIGNED", "template has already been assigned and cannot be reused")
	}
	return s.Assignments.GetAvailableCohorts(ctx, template.CurriculumID)
}

func (s *TemplateAssignmentService) CreateAssignment(ctx context.Context, userID, facultyID uint64, isAdmin bool, req models.CreateTemplateAssignmentRequest) (*models.TemplateAssignment, error) {
	if req.TemplateID == 0 || req.CohortID == 0 {
		return nil, assignmentError("BAD_REQUEST", "template and cohort are required")
	}
	if !req.Confirm {
		return nil, assignmentError("CONFIRMATION_REQUIRED", "assignment confirmation is required")
	}
	template, err := s.templateForAccess(ctx, req.TemplateID, facultyID, isAdmin)
	if err != nil {
		return nil, err
	}
	cohort, err := s.cohortForAccess(ctx, req.CohortID, facultyID, isAdmin)
	if err != nil {
		return nil, err
	}
	if err := validateNewAssignment(ctx, s.Assignments, template, cohort); err != nil {
		return nil, err
	}
	return s.Assignments.CreateAssignment(ctx, template.TemplateID, cohort.CohortID, userID)
}

func (s *TemplateAssignmentService) ReplaceAssignment(ctx context.Context, assignmentID, userID, facultyID uint64, isAdmin bool, req models.ReplaceTemplateAssignmentRequest) (*models.TemplateAssignment, error) {
	if req.TemplateID == 0 || strings.TrimSpace(req.Reason) == "" {
		return nil, assignmentError("BAD_REQUEST", "replacement template and reason are required")
	}
	if !req.Confirm {
		return nil, assignmentError("CONFIRMATION_REQUIRED", "replacement confirmation is required")
	}
	current, err := s.assignmentForAccess(ctx, assignmentID, facultyID, isAdmin)
	if err != nil {
		return nil, err
	}
	if current.ScoreLocked {
		return nil, assignmentError("ASSIGNMENT_LOCKED_BY_SCORES", "template assignment cannot be changed because the cohort has learner scores")
	}
	if current.TemplateID == req.TemplateID {
		return nil, assignmentError("BAD_REQUEST", "replacement template must be different from the current template")
	}
	replacement, err := s.templateForAccess(ctx, req.TemplateID, facultyID, isAdmin)
	if err != nil {
		return nil, err
	}
	cohort, err := s.cohortForAccess(ctx, current.CohortID, facultyID, isAdmin)
	if err != nil {
		return nil, err
	}
	if err := validateReplacementAssignment(ctx, s.Assignments, replacement, cohort); err != nil {
		return nil, err
	}
	return s.Assignments.ReplaceAssignment(ctx, assignmentID, replacement.TemplateID, userID, strings.TrimSpace(req.Reason))
}

func (s *TemplateAssignmentService) RemoveAssignment(ctx context.Context, assignmentID, userID, facultyID uint64, isAdmin bool, req models.RemoveTemplateAssignmentRequest) (*models.TemplateAssignment, error) {
	if strings.TrimSpace(req.Reason) == "" {
		return nil, assignmentError("BAD_REQUEST", "unassignment reason is required")
	}
	if !req.Confirm {
		return nil, assignmentError("CONFIRMATION_REQUIRED", "unassignment confirmation is required")
	}
	current, err := s.assignmentForAccess(ctx, assignmentID, facultyID, isAdmin)
	if err != nil {
		return nil, err
	}
	if current.ScoreLocked {
		return nil, assignmentError("ASSIGNMENT_LOCKED_BY_SCORES", "template assignment cannot be removed because the cohort has learner scores")
	}
	return s.Assignments.RemoveAssignment(ctx, assignmentID, userID, strings.TrimSpace(req.Reason))
}

func (s *TemplateAssignmentService) GetHistory(ctx context.Context, cohortID, facultyID uint64, isAdmin bool) ([]models.TemplateAssignment, error) {
	if _, err := s.cohortForAccess(ctx, cohortID, facultyID, isAdmin); err != nil {
		return nil, err
	}
	return s.Assignments.GetCohortAssignmentHistory(ctx, cohortID)
}

func (s *TemplateAssignmentService) templateForAccess(ctx context.Context, templateID, facultyID uint64, isAdmin bool) (*models.Template, error) {
	template, err := s.Templates.GetTemplateByID(ctx, templateID)
	if err != nil {
		return nil, err
	}
	if template == nil {
		return nil, assignmentError("NOT_FOUND", "template not found")
	}
	if !isAdmin && (facultyID == 0 || template.FacultyID != facultyID) {
		return nil, assignmentError("FORBIDDEN", "you do not have access to this template")
	}
	return template, nil
}

func (s *TemplateAssignmentService) cohortForAccess(ctx context.Context, cohortID, facultyID uint64, isAdmin bool) (*models.StudentCohort, error) {
	cohort, err := s.Cohorts.GetCohortByID(ctx, cohortID)
	if err != nil {
		return nil, err
	}
	if cohort == nil {
		return nil, assignmentError("NOT_FOUND", "student cohort not found")
	}
	if !isAdmin && (facultyID == 0 || cohort.FacultyID != facultyID) {
		return nil, assignmentError("FORBIDDEN", "you do not have access to this student cohort")
	}
	return cohort, nil
}

func (s *TemplateAssignmentService) assignmentForAccess(ctx context.Context, assignmentID, facultyID uint64, isAdmin bool) (*models.TemplateAssignment, error) {
	assignment, err := s.Assignments.GetAssignmentByID(ctx, assignmentID)
	if err != nil {
		return nil, err
	}
	if assignment == nil {
		return nil, assignmentError("NOT_FOUND", "template assignment not found")
	}
	if _, err := s.templateForAccess(ctx, assignment.TemplateID, facultyID, isAdmin); err != nil {
		return nil, err
	}
	return assignment, nil
}

func validateNewAssignment(ctx context.Context, repo *repositories.TemplateAssignmentRepository, template *models.Template, cohort *models.StudentCohort) error {
	if err := validateAssignmentPair(ctx, repo, template, cohort); err != nil {
		return err
	}
	live, err := repo.GetLiveAssignmentForCohort(ctx, cohort.CohortID)
	if err != nil {
		return err
	}
	if live != nil {
		return assignmentError("COHORT_ALREADY_ASSIGNED", "student cohort already has a current template assignment")
	}
	return nil
}

func validateReplacementAssignment(ctx context.Context, repo *repositories.TemplateAssignmentRepository, template *models.Template, cohort *models.StudentCohort) error {
	return validateAssignmentPair(ctx, repo, template, cohort)
}

func validateAssignmentPair(ctx context.Context, repo *repositories.TemplateAssignmentRepository, template *models.Template, cohort *models.StudentCohort) error {
	if template.CurriculumID == 0 {
		return assignmentError("TEMPLATE_HAS_NO_CURRICULUM", "template has no curriculum owner and is read-only")
	}
	if !template.IsActive {
		return assignmentError("TEMPLATE_INACTIVE", "template must be active before assignment")
	}
	if cohort.Status != "active" {
		return assignmentError("COHORT_INACTIVE", "student cohort must be active before assignment")
	}
	if template.CurriculumID != cohort.CurriculumID {
		return assignmentError("CURRICULUM_MISMATCH", "template and student cohort must belong to the same curriculum")
	}
	used, err := repo.HasAnyAssignmentForTemplate(ctx, template.TemplateID)
	if err != nil {
		return err
	}
	if used {
		return assignmentError("TEMPLATE_ALREADY_ASSIGNED", "template has already been assigned and cannot be reused")
	}
	return nil
}

func assignmentError(code, message string) *TemplateAssignmentError {
	return &TemplateAssignmentError{Code: code, Message: message}
}
