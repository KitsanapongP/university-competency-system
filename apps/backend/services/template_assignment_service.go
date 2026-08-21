package services

import (
	"context"
	"fmt"
	"math"
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
		historical, err := s.Assignments.HasHistoricalAssignmentForTemplate(ctx, templateID)
		if err != nil {
			return nil, err
		}
		if !historical {
			return nil, assignmentError("TEMPLATE_INACTIVE", "template must be active before assignment")
		}
		if err := s.validateTemplateReactivation(ctx, templateID); err != nil {
			return nil, err
		}
	}
	used, err := s.Assignments.HasLiveAssignmentForTemplate(ctx, templateID)
	if err != nil {
		return nil, err
	}
	if used {
		return nil, assignmentError("TEMPLATE_CURRENTLY_ASSIGNED", "template is currently assigned to another student cohort")
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
	if err := s.validateNewAssignment(ctx, template, cohort); err != nil {
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
	if err := s.validateReplacementAssignment(ctx, replacement, cohort); err != nil {
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
	if _, err := s.assignmentForAccess(ctx, assignmentID, facultyID, isAdmin); err != nil {
		return nil, err
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

func (s *TemplateAssignmentService) validateNewAssignment(ctx context.Context, template *models.Template, cohort *models.StudentCohort) error {
	if err := s.validateAssignmentPair(ctx, template, cohort); err != nil {
		return err
	}
	live, err := s.Assignments.GetLiveAssignmentForCohort(ctx, cohort.CohortID)
	if err != nil {
		return err
	}
	if live != nil {
		return assignmentError("COHORT_ALREADY_ASSIGNED", "student cohort already has a current template assignment")
	}
	return nil
}

func (s *TemplateAssignmentService) validateReplacementAssignment(ctx context.Context, template *models.Template, cohort *models.StudentCohort) error {
	return s.validateAssignmentPair(ctx, template, cohort)
}

func (s *TemplateAssignmentService) validateAssignmentPair(ctx context.Context, template *models.Template, cohort *models.StudentCohort) error {
	if template.CurriculumID == 0 {
		return assignmentError("TEMPLATE_HAS_NO_CURRICULUM", "template has no curriculum owner and is read-only")
	}
	if !template.IsActive {
		historical, err := s.Assignments.HasHistoricalAssignmentForTemplate(ctx, template.TemplateID)
		if err != nil {
			return err
		}
		if !historical {
			return assignmentError("TEMPLATE_INACTIVE", "template must be active before assignment")
		}
		if err := s.validateTemplateReactivation(ctx, template.TemplateID); err != nil {
			return err
		}
	}
	if cohort.Status != "active" {
		return assignmentError("COHORT_INACTIVE", "student cohort must be active before assignment")
	}
	if template.CurriculumID != cohort.CurriculumID {
		return assignmentError("CURRICULUM_MISMATCH", "template and student cohort must belong to the same curriculum")
	}
	used, err := s.Assignments.HasLiveAssignmentForTemplate(ctx, template.TemplateID)
	if err != nil {
		return err
	}
	if used {
		return assignmentError("TEMPLATE_CURRENTLY_ASSIGNED", "template is currently assigned to another student cohort")
	}
	return nil
}

func (s *TemplateAssignmentService) validateTemplateReactivation(ctx context.Context, templateID uint64) error {
	items, err := s.Templates.GetTemplateItems(ctx, templateID)
	if err != nil {
		return err
	}

	coreWeightSums, err := s.Templates.GetTemplateCoreWeightSums(ctx, templateID)
	if err != nil {
		return err
	}
	return validateTemplateCoreReadiness(items, coreWeightSums)
}

func validateTemplateCoreReadiness(items []models.TemplateItem, coreWeightSums map[uint64]float64) error {
	if len(items) == 0 {
		return assignmentError("TEMPLATE_REACTIVATION_NOT_READY", "template has no competency configuration")
	}
	if len(coreWeightSums) == 0 {
		return assignmentError("TEMPLATE_REACTIVATION_NOT_READY", "template has no core course weights")
	}

	compNames := make(map[uint64]string)
	for _, item := range items {
		compNames[item.CompetencyID] = item.CompetencyName
	}
	for competencyID, name := range compNames {
		sum := coreWeightSums[competencyID]
		if math.Abs(sum-100.0) > 0.05 {
			if name == "" {
				name = fmt.Sprintf("competency %d", competencyID)
			}
			return assignmentError("TEMPLATE_REACTIVATION_NOT_READY", fmt.Sprintf("competency %q has core weight %.2f%%; expected 100%%", name, sum))
		}
	}
	return nil
}

func assignmentError(code, message string) *TemplateAssignmentError {
	return &TemplateAssignmentError{Code: code, Message: message}
}
