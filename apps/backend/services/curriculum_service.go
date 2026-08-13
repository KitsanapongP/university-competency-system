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
	ErrMajorNotFound       = errors.New("major not found")
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

func (s *CurriculumService) GetFaculties(ctx context.Context, roles []string, facultyID *int64) ([]*models.FacultyOption, error) {
	if hasRole(roles, "admin") {
		return s.Repo.GetFaculties(ctx)
	}
	if !hasRole(roles, "officer") || facultyID == nil || *facultyID <= 0 {
		return nil, ErrCurriculumForbidden
	}

	faculty, err := s.Repo.GetFacultyByID(ctx, uint64(*facultyID))
	if err != nil {
		return nil, err
	}

	return []*models.FacultyOption{faculty}, nil
}

func (s *CurriculumService) GetDepartments(ctx context.Context, roles []string, facultyID *int64, filters models.DepartmentFilters) ([]*models.DepartmentOption, error) {
	if hasRole(roles, "admin") {
		return s.Repo.GetDepartments(ctx, filters)
	}
	if !hasRole(roles, "officer") || facultyID == nil || *facultyID <= 0 {
		return nil, ErrCurriculumForbidden
	}

	scopedFacultyID := uint64(*facultyID)
	if filters.FacultyID != nil && *filters.FacultyID != scopedFacultyID {
		return nil, ErrCurriculumForbidden
	}
	filters.FacultyID = &scopedFacultyID
	return s.Repo.GetDepartments(ctx, filters)
}

func (s *CurriculumService) GetMajors(ctx context.Context, roles []string, facultyID *int64, filters models.MajorFilters) ([]*models.MajorOption, error) {
	if hasRole(roles, "admin") {
		return s.Repo.GetMajors(ctx, filters)
	}
	if !hasRole(roles, "officer") || facultyID == nil || *facultyID <= 0 {
		return nil, ErrCurriculumForbidden
	}

	scopedFacultyID := uint64(*facultyID)
	if filters.FacultyID != nil && *filters.FacultyID != scopedFacultyID {
		return nil, ErrCurriculumForbidden
	}
	filters.FacultyID = &scopedFacultyID
	return s.Repo.GetMajors(ctx, filters)
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
	normalizeCreateCurriculumPayload(&payload)
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

	duplicate, err := s.Repo.FindLiveCurriculumNameDuplicate(ctx, payload.MajorID, payload.EffectiveYearBE, payload.CurriculumNameTH)
	if err != nil {
		return nil, err
	}
	if duplicate != nil {
		return nil, CurriculumConflictError{
			Code:    "DUPLICATE",
			Message: "curriculum name already exists in this major and effective year",
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

func (s *CurriculumService) DuplicateCurriculum(ctx context.Context, sourceCurriculumID uint64, payload models.DuplicateCurriculumPayload, userID int64, roles []string, facultyID *int64) (*models.Curriculum, error) {
	source, err := s.getCurriculumForWrite(ctx, sourceCurriculumID, roles, facultyID)
	if err != nil {
		return nil, err
	}

	createPayload := duplicatePayloadToCreatePayload(payload)
	normalizeCreateCurriculumPayload(&createPayload)
	if err := validateCreateCurriculumPayload(createPayload); err != nil {
		return nil, err
	}

	majorScope, err := s.Repo.GetMajorScope(ctx, createPayload.MajorID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, CurriculumValidationError{Message: "major_id is invalid"}
	}
	if err != nil {
		return nil, err
	}

	if err := s.ensureFacultyScope(majorScope.FacultyID, roles, facultyID); err != nil {
		return nil, err
	}
	sourceScope, err := s.Repo.GetMajorScope(ctx, source.MajorID)
	if err != nil {
		return nil, err
	}
	if sourceScope.FacultyID != majorScope.FacultyID {
		return nil, ErrCurriculumForbidden
	}

	duplicateName, err := s.Repo.FindLiveCurriculumNameDuplicate(ctx, createPayload.MajorID, createPayload.EffectiveYearBE, createPayload.CurriculumNameTH)
	if err != nil {
		return nil, err
	}
	if duplicateName != nil {
		return nil, CurriculumConflictError{
			Code:    "DUPLICATE",
			Message: "curriculum name already exists in this major and effective year",
		}
	}

	duplicateCode, err := s.Repo.CountLiveCurriculumCodeDuplicate(ctx, createPayload.MajorID, createPayload.CurriculumCode)
	if err != nil {
		return nil, err
	}
	if duplicateCode > 0 {
		return nil, CurriculumConflictError{
			Code:    "DUPLICATE",
			Message: "curriculum code already exists in this major",
		}
	}

	var createdBy uint64
	if userID > 0 {
		createdBy = uint64(userID)
	}

	return s.Repo.DuplicateCurriculumTx(ctx, sourceCurriculumID, createPayload, repositories.CreateCurriculumOptions{
		FacultyID:   majorScope.FacultyID,
		CreatedBy:   createdBy,
		DegreeLevel: majorScope.DegreeLevel,
	})
}

func (s *CurriculumService) CreateMajor(ctx context.Context, payload models.UpsertMajorPayload, roles []string, facultyID *int64) (*models.MajorOption, error) {
	if err := validateUpsertMajorPayload(&payload); err != nil {
		return nil, err
	}
	if err := s.ensureDepartmentScope(ctx, payload.DepartmentID, roles, facultyID); err != nil {
		return nil, err
	}
	return s.Repo.CreateMajor(ctx, payload)
}

func (s *CurriculumService) UpdateMajor(ctx context.Context, majorID uint64, payload models.UpsertMajorPayload, roles []string, facultyID *int64) (*models.MajorOption, error) {
	existing, err := s.Repo.GetMajorByID(ctx, majorID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrMajorNotFound
	}
	if err != nil {
		return nil, err
	}
	if err := s.ensureFacultyScope(existing.FacultyID, roles, facultyID); err != nil {
		return nil, err
	}
	if err := validateUpsertMajorPayload(&payload); err != nil {
		return nil, err
	}
	if err := s.ensureDepartmentScope(ctx, payload.DepartmentID, roles, facultyID); err != nil {
		return nil, err
	}
	return s.Repo.UpdateMajor(ctx, majorID, payload)
}

func (s *CurriculumService) UpdateMajorStatus(ctx context.Context, majorID uint64, payload models.UpdateMajorStatusPayload, roles []string, facultyID *int64) (*models.MajorOption, error) {
	if payload.IsActive == nil {
		return nil, CurriculumValidationError{Message: "is_active is required"}
	}

	existing, err := s.Repo.GetMajorByID(ctx, majorID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrMajorNotFound
	}
	if err != nil {
		return nil, err
	}
	if err := s.ensureFacultyScope(existing.FacultyID, roles, facultyID); err != nil {
		return nil, err
	}
	if existing.IsActive == *payload.IsActive {
		return existing, nil
	}

	return s.Repo.UpdateMajorStatus(ctx, majorID, *payload.IsActive)
}

func (s *CurriculumService) ensureDepartmentScope(ctx context.Context, departmentID uint64, roles []string, facultyID *int64) error {
	department, err := s.Repo.GetDepartmentByID(ctx, departmentID)
	if errors.Is(err, sql.ErrNoRows) {
		return CurriculumValidationError{Message: "department_id is invalid"}
	}
	if err != nil {
		return err
	}
	return s.ensureFacultyScope(department.FacultyID, roles, facultyID)
}

func (s *CurriculumService) ensureFacultyScope(targetFacultyID uint64, roles []string, facultyID *int64) error {
	if hasRole(roles, "admin") {
		return nil
	}
	if !hasRole(roles, "officer") || facultyID == nil || *facultyID <= 0 {
		return ErrCurriculumForbidden
	}
	if targetFacultyID != uint64(*facultyID) {
		return ErrCurriculumForbidden
	}
	return nil
}

func validateUpsertMajorPayload(payload *models.UpsertMajorPayload) error {
	payload.Code = strings.TrimSpace(payload.Code)
	payload.NameTH = strings.TrimSpace(payload.NameTH)
	payload.DegreeLevel = strings.ToLower(strings.TrimSpace(payload.DegreeLevel))
	payload.NameEN = trimStringPointer(payload.NameEN)

	if payload.DepartmentID == 0 {
		return CurriculumValidationError{Message: "department_id is required"}
	}
	if payload.Code == "" {
		return CurriculumValidationError{Message: "code is required"}
	}
	if payload.NameTH == "" {
		return CurriculumValidationError{Message: "name_th is required"}
	}
	switch payload.DegreeLevel {
	case "bachelor", "master", "phd", "other":
		return nil
	default:
		return CurriculumValidationError{Message: "degree_level must be bachelor, master, phd, or other"}
	}
}

func normalizeCreateCurriculumPayload(payload *models.CreateCurriculumPayload) {
	payload.CurriculumCode = strings.TrimSpace(payload.CurriculumCode)
	payload.CurriculumNameTH = strings.TrimSpace(payload.CurriculumNameTH)
	payload.CurriculumNameEN = trimStringPointer(payload.CurriculumNameEN)
}

func duplicatePayloadToCreatePayload(payload models.DuplicateCurriculumPayload) models.CreateCurriculumPayload {
	return models.CreateCurriculumPayload{
		MajorID:          payload.MajorID,
		CurriculumNameTH: payload.CurriculumNameTH,
		CurriculumNameEN: payload.CurriculumNameEN,
		CurriculumCode:   payload.CurriculumCode,
		EffectiveYearBE:  payload.EffectiveYearBE,
	}
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
	return validateCreateCategories(payload.Categories, seenCourseCodes, map[string]bool{})
}

func hasRole(roles []string, role string) bool {
	for _, r := range roles {
		if r == role {
			return true
		}
	}
	return false
}
