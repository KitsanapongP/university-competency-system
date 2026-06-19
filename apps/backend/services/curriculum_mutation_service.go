package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
)

type CurriculumConflictError struct {
	Code    string
	Message string
}

func (e CurriculumConflictError) Error() string {
	return e.Message
}

type CurriculumConfirmationRequiredError struct {
	Message string
	Data    any
}

func (e CurriculumConfirmationRequiredError) Error() string {
	return e.Message
}

type CurriculumValidationDetailsError struct {
	Message string
	Data    any
}

func (e CurriculumValidationDetailsError) Error() string {
	return e.Message
}

func (s *CurriculumService) UpdateCurriculumStatus(ctx context.Context, id uint64, payload models.UpdateCurriculumStatusPayload, roles []string, facultyID *int64) (*models.CurriculumDetail, error) {
	curriculum, err := s.getCurriculumForWrite(ctx, id, roles, facultyID)
	if err != nil {
		return nil, err
	}

	targetStatus := strings.ToLower(strings.TrimSpace(payload.Status))
	if targetStatus != "draft" && targetStatus != "active" && targetStatus != "inactive" {
		return nil, CurriculumValidationError{Message: "status must be draft, active, or inactive"}
	}
	if targetStatus == curriculum.Status {
		return s.GetCurriculumByID(ctx, id, roles, facultyID)
	}
	if targetStatus == "draft" {
		return nil, CurriculumValidationError{Message: "curriculum cannot transition back to draft"}
	}

	switch normalizeCurriculumStatus(curriculum.Status) {
	case "draft":
		if targetStatus != "active" {
			return nil, CurriculumValidationError{Message: "draft curriculum can only transition to active"}
		}
		if err := s.ensureCurriculumActivatable(ctx, curriculum.CurriculumID); err != nil {
			return nil, err
		}
	case "active":
		if targetStatus != "inactive" {
			return nil, CurriculumValidationError{Message: "active curriculum can only transition to inactive"}
		}
		activeTemplateCount, err := s.Repo.CountActiveTemplatesForCurriculum(ctx, curriculum.CurriculumID)
		if err != nil {
			return nil, err
		}
		if activeTemplateCount > 0 {
			return nil, CurriculumConflictError{
				Code:    "CURRICULUM_HAS_ACTIVE_TEMPLATE",
				Message: "curriculum cannot be inactive while active templates are connected",
			}
		}
	case "inactive":
		if targetStatus != "active" {
			return nil, CurriculumValidationError{Message: "inactive curriculum can only transition to active"}
		}
		if err := s.ensureCurriculumActivatable(ctx, curriculum.CurriculumID); err != nil {
			return nil, err
		}
	default:
		return nil, CurriculumValidationError{Message: "curriculum status is invalid"}
	}

	if err := s.Repo.UpdateCurriculumStatus(ctx, id, targetStatus); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrCurriculumNotFound
		}
		return nil, err
	}

	return s.GetCurriculumByID(ctx, id, roles, facultyID)
}

func (s *CurriculumService) CreateCategory(ctx context.Context, curriculumID uint64, payload models.CreateCurriculumCategoryPayload, roles []string, facultyID *int64) (*models.CurriculumDetail, error) {
	curriculum, err := s.getCurriculumForWrite(ctx, curriculumID, roles, facultyID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureStructureEditable(ctx, curriculum, payload.ConfirmImpact); err != nil {
		return nil, err
	}
	if err := validateCreateCategoryMutation(payload); err != nil {
		return nil, err
	}
	if payload.ParentID != nil {
		if *payload.ParentID == 0 {
			return nil, CurriculumValidationError{Message: "parent_id is invalid"}
		}
		if _, err := s.Repo.GetCategoryForCurriculum(ctx, curriculumID, *payload.ParentID); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return nil, CurriculumValidationError{Message: "parent_id is invalid"}
			}
			return nil, err
		}
	}

	payload.NameTH = strings.TrimSpace(payload.NameTH)
	if payload.Code != nil {
		value := strings.TrimSpace(*payload.Code)
		payload.Code = &value
	}

	if err := s.Repo.CreateCategory(ctx, curriculumID, payload); err != nil {
		return nil, err
	}

	return s.GetCurriculumByID(ctx, curriculumID, roles, facultyID)
}

func (s *CurriculumService) UpdateCategory(ctx context.Context, curriculumID uint64, categoryID uint64, payload models.UpdateCurriculumCategoryPayload, roles []string, facultyID *int64) (*models.CurriculumDetail, error) {
	curriculum, err := s.getCurriculumForWrite(ctx, curriculumID, roles, facultyID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureStructureEditable(ctx, curriculum, payload.ConfirmImpact); err != nil {
		return nil, err
	}
	if _, err := s.Repo.GetCategoryForCurriculum(ctx, curriculumID, categoryID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrCurriculumNotFound
		}
		return nil, err
	}
	if err := validateUpdateCategoryMutation(payload); err != nil {
		return nil, err
	}
	if err := s.validateCategoryMove(ctx, curriculumID, categoryID, payload.ParentID); err != nil {
		return nil, err
	}
	normalizeUpdateCategoryPayload(&payload)

	if err := s.Repo.UpdateCategory(ctx, curriculumID, categoryID, payload); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrCurriculumNotFound
		}
		return nil, err
	}

	return s.GetCurriculumByID(ctx, curriculumID, roles, facultyID)
}

func (s *CurriculumService) GetDeleteCategoryPreview(ctx context.Context, curriculumID uint64, categoryID uint64, roles []string, facultyID *int64) (*models.DeleteCategoryPreview, error) {
	if _, err := s.getCurriculumForWrite(ctx, curriculumID, roles, facultyID); err != nil {
		return nil, err
	}

	preview, err := s.Repo.GetCategoryDeletePreview(ctx, curriculumID, categoryID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrCurriculumNotFound
	}
	if err != nil {
		return nil, err
	}

	return preview, nil
}

func (s *CurriculumService) DeleteCategory(ctx context.Context, curriculumID uint64, categoryID uint64, confirmImpact bool, roles []string, facultyID *int64) (*models.CurriculumDetail, error) {
	curriculum, err := s.getCurriculumForWrite(ctx, curriculumID, roles, facultyID)
	if err != nil {
		return nil, err
	}

	preview, err := s.Repo.GetCategoryDeletePreview(ctx, curriculumID, categoryID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrCurriculumNotFound
	}
	if err != nil {
		return nil, err
	}
	if !confirmImpact {
		return nil, CurriculumConfirmationRequiredError{
			Message: "category delete requires confirmation",
			Data:    preview,
		}
	}
	if err := s.ensureStructureEditable(ctx, curriculum, true); err != nil {
		return nil, err
	}

	if err := s.Repo.DeleteCategoryTx(ctx, preview); err != nil {
		return nil, err
	}

	return s.GetCurriculumByID(ctx, curriculumID, roles, facultyID)
}

func (s *CurriculumService) CreateCourse(ctx context.Context, curriculumID uint64, categoryID uint64, payload models.CreateCurriculumCoursePayload, userID int64, roles []string, facultyID *int64) (*models.CurriculumDetail, error) {
	curriculum, err := s.getCurriculumForWrite(ctx, curriculumID, roles, facultyID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureStructureEditable(ctx, curriculum, payload.ConfirmImpact); err != nil {
		return nil, err
	}
	if err := validateCreateCourseMutation(payload); err != nil {
		return nil, err
	}
	if _, err := s.Repo.GetCategoryForCurriculum(ctx, curriculumID, categoryID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, CurriculumValidationError{Message: "category_id is invalid"}
		}
		return nil, err
	}

	normalizeCreateCoursePayload(&payload)

	majorScope, err := s.Repo.GetMajorScope(ctx, curriculum.MajorID)
	if err != nil {
		return nil, err
	}
	var createdBy uint64
	if userID > 0 {
		createdBy = uint64(userID)
	}

	if err := s.Repo.CreateCourseInCategoryTx(ctx, curriculumID, categoryID, payload, repositories.CreateCurriculumOptions{
		FacultyID:   majorScope.FacultyID,
		CreatedBy:   createdBy,
		DegreeLevel: majorScope.DegreeLevel,
	}); err != nil {
		return nil, err
	}

	return s.GetCurriculumByID(ctx, curriculumID, roles, facultyID)
}

func (s *CurriculumService) UpdateCourse(ctx context.Context, curriculumID uint64, courseID uint64, payload models.UpdateCurriculumCourseDetailPayload, roles []string, facultyID *int64) (*models.CurriculumDetail, error) {
	curriculum, err := s.getCurriculumForWrite(ctx, curriculumID, roles, facultyID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureStructureEditable(ctx, curriculum, payload.ConfirmImpact); err != nil {
		return nil, err
	}
	if err := validateUpdateCourseMutation(payload); err != nil {
		return nil, err
	}
	normalizeUpdateCoursePayload(&payload)

	if err := s.Repo.UpdateCourseForCurriculum(ctx, curriculumID, courseID, payload); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrCurriculumNotFound
		}
		return nil, err
	}

	return s.GetCurriculumByID(ctx, curriculumID, roles, facultyID)
}

func (s *CurriculumService) UpdateCurriculumCoursePlacement(ctx context.Context, curriculumID uint64, curriculumCourseID uint64, payload models.UpdateCurriculumCoursePlacementPayload, roles []string, facultyID *int64) (*models.CurriculumDetail, error) {
	curriculum, err := s.getCurriculumForWrite(ctx, curriculumID, roles, facultyID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureStructureEditable(ctx, curriculum, payload.ConfirmImpact); err != nil {
		return nil, err
	}
	if payload.DisplayOrder != nil && *payload.DisplayOrder < 0 {
		return nil, CurriculumValidationError{Message: "display_order must be zero or greater"}
	}
	if payload.CategoryID != nil {
		if *payload.CategoryID == 0 {
			return nil, CurriculumValidationError{Message: "category_id is invalid"}
		}
		if _, err := s.Repo.GetCategoryForCurriculum(ctx, curriculumID, *payload.CategoryID); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return nil, CurriculumValidationError{Message: "category_id is invalid"}
			}
			return nil, err
		}
	}
	if _, err := s.Repo.GetCurriculumCourseForCurriculum(ctx, curriculumID, curriculumCourseID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrCurriculumNotFound
		}
		return nil, err
	}

	if err := s.Repo.UpdateCurriculumCoursePlacement(ctx, curriculumID, curriculumCourseID, payload); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrCurriculumNotFound
		}
		return nil, err
	}

	return s.GetCurriculumByID(ctx, curriculumID, roles, facultyID)
}

func (s *CurriculumService) DeleteCurriculumCoursePlacement(ctx context.Context, curriculumID uint64, curriculumCourseID uint64, confirmImpact bool, roles []string, facultyID *int64) (*models.CurriculumDetail, error) {
	curriculum, err := s.getCurriculumForWrite(ctx, curriculumID, roles, facultyID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureStructureEditable(ctx, curriculum, confirmImpact); err != nil {
		return nil, err
	}
	if _, err := s.Repo.GetCurriculumCourseForCurriculum(ctx, curriculumID, curriculumCourseID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrCurriculumNotFound
		}
		return nil, err
	}

	if err := s.Repo.SoftRemoveCurriculumCourse(ctx, curriculumID, curriculumCourseID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrCurriculumNotFound
		}
		return nil, err
	}

	return s.GetCurriculumByID(ctx, curriculumID, roles, facultyID)
}

func (s *CurriculumService) getCurriculumForWrite(ctx context.Context, id uint64, roles []string, facultyID *int64) (*models.Curriculum, error) {
	curriculum, err := s.Repo.GetCurriculumByID(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrCurriculumNotFound
	}
	if err != nil {
		return nil, err
	}
	if err := s.ensureCurriculumScope(ctx, curriculum, roles, facultyID); err != nil {
		return nil, err
	}

	return curriculum, nil
}

func (s *CurriculumService) ensureCurriculumScope(ctx context.Context, curriculum *models.Curriculum, roles []string, facultyID *int64) error {
	if hasRole(roles, "admin") {
		return nil
	}
	if !hasRole(roles, "officer") || facultyID == nil || *facultyID <= 0 {
		return ErrCurriculumForbidden
	}

	majorScope, err := s.Repo.GetMajorScope(ctx, curriculum.MajorID)
	if err != nil {
		return err
	}
	if majorScope.FacultyID != uint64(*facultyID) {
		return ErrCurriculumForbidden
	}

	return nil
}

func (s *CurriculumService) ensureStructureEditable(ctx context.Context, curriculum *models.Curriculum, confirmImpact bool) error {
	switch normalizeCurriculumStatus(curriculum.Status) {
	case "draft":
		return nil
	case "active":
		activeTemplateCount, err := s.Repo.CountActiveTemplatesForCurriculum(ctx, curriculum.CurriculumID)
		if err != nil {
			return err
		}
		if activeTemplateCount > 0 {
			return CurriculumConflictError{
				Code:    "CURRICULUM_STRUCTURE_LOCKED",
				Message: "curriculum structure is locked while active templates are connected",
			}
		}
		return nil
	case "inactive":
		affectedTemplates, err := s.Repo.GetAffectedTemplatesForCurriculum(ctx, curriculum.CurriculumID)
		if err != nil {
			return err
		}
		if len(affectedTemplates) > 0 && !confirmImpact {
			return CurriculumConfirmationRequiredError{
				Message: "inactive curriculum edit requires confirmation because templates are connected",
				Data: models.CurriculumImpact{
					AffectedTemplates: affectedTemplates,
				},
			}
		}
		return nil
	default:
		return CurriculumValidationError{Message: fmt.Sprintf("curriculum status %q is invalid", curriculum.Status)}
	}
}

func (s *CurriculumService) ensureCurriculumActivatable(ctx context.Context, curriculumID uint64) error {
	violations, err := s.Repo.ValidateCurriculumStructure(ctx, curriculumID)
	if err != nil {
		return err
	}
	if len(violations) > 0 {
		return CurriculumValidationDetailsError{
			Message: "curriculum structure is not ready to activate",
			Data: map[string]any{
				"violations": violations,
			},
		}
	}
	return nil
}

func (s *CurriculumService) validateCategoryMove(ctx context.Context, curriculumID uint64, categoryID uint64, parentID models.OptionalUint64) error {
	if !parentID.Set {
		return nil
	}
	if !parentID.Valid {
		return nil
	}
	if parentID.Value == 0 || parentID.Value == categoryID {
		return CurriculumValidationError{Message: "parent_id is invalid"}
	}
	if _, err := s.Repo.GetCategoryForCurriculum(ctx, curriculumID, parentID.Value); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return CurriculumValidationError{Message: "parent_id is invalid"}
		}
		return err
	}

	subtreeIDs, err := s.Repo.GetCategorySubtreeIDs(ctx, curriculumID, categoryID)
	if err != nil {
		return err
	}
	for _, subtreeID := range subtreeIDs {
		if subtreeID == parentID.Value {
			return CurriculumValidationError{Message: "category cannot be moved under itself or its child category"}
		}
	}

	return nil
}

func validateCreateCategoryMutation(payload models.CreateCurriculumCategoryPayload) error {
	if strings.TrimSpace(payload.NameTH) == "" {
		return CurriculumValidationError{Message: "category name_th is required"}
	}
	if payload.RequiredCredits < 0 {
		return CurriculumValidationError{Message: "category required_credits must be zero or greater"}
	}
	if payload.DisplayOrder < 0 {
		return CurriculumValidationError{Message: "category display_order must be zero or greater"}
	}
	return nil
}

func validateUpdateCategoryMutation(payload models.UpdateCurriculumCategoryPayload) error {
	if payload.NameTH != nil && strings.TrimSpace(*payload.NameTH) == "" {
		return CurriculumValidationError{Message: "category name_th cannot be empty"}
	}
	if payload.RequiredCredits != nil && *payload.RequiredCredits < 0 {
		return CurriculumValidationError{Message: "category required_credits must be zero or greater"}
	}
	if payload.DisplayOrder != nil && *payload.DisplayOrder < 0 {
		return CurriculumValidationError{Message: "category display_order must be zero or greater"}
	}
	return nil
}

func validateCreateCourseMutation(payload models.CreateCurriculumCoursePayload) error {
	if strings.TrimSpace(payload.Code) == "" {
		return CurriculumValidationError{Message: "course code is required"}
	}
	if strings.TrimSpace(payload.NameTH) == "" {
		return CurriculumValidationError{Message: "course name_th is required"}
	}
	if payload.Credits < 0 {
		return CurriculumValidationError{Message: "course credits must be zero or greater"}
	}
	if payload.DisplayOrder < 0 {
		return CurriculumValidationError{Message: "course display_order must be zero or greater"}
	}
	return nil
}

func validateUpdateCourseMutation(payload models.UpdateCurriculumCourseDetailPayload) error {
	if payload.Code != nil && strings.TrimSpace(*payload.Code) == "" {
		return CurriculumValidationError{Message: "course code cannot be empty"}
	}
	if payload.NameTH != nil && strings.TrimSpace(*payload.NameTH) == "" {
		return CurriculumValidationError{Message: "course name_th cannot be empty"}
	}
	if payload.Credits != nil && *payload.Credits < 0 {
		return CurriculumValidationError{Message: "course credits must be zero or greater"}
	}
	return nil
}

func normalizeUpdateCategoryPayload(payload *models.UpdateCurriculumCategoryPayload) {
	payload.Code = trimStringPointer(payload.Code)
	payload.NameTH = trimStringPointer(payload.NameTH)
	payload.NameEN = trimStringPointer(payload.NameEN)
}

func normalizeCreateCoursePayload(payload *models.CreateCurriculumCoursePayload) {
	payload.Code = strings.TrimSpace(payload.Code)
	payload.NameTH = strings.TrimSpace(payload.NameTH)
	payload.NameEN = trimStringPointer(payload.NameEN)
	payload.Description = trimStringPointer(payload.Description)
}

func normalizeUpdateCoursePayload(payload *models.UpdateCurriculumCourseDetailPayload) {
	payload.Code = trimStringPointer(payload.Code)
	payload.NameTH = trimStringPointer(payload.NameTH)
	payload.NameEN = trimStringPointer(payload.NameEN)
	payload.Description = trimStringPointer(payload.Description)
}

func trimStringPointer(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	return &trimmed
}

func normalizeCurriculumStatus(status string) string {
	if status == "retired" {
		return "inactive"
	}
	return status
}
