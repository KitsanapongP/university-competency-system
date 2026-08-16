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
	ErrStudentCohortNotFound  = errors.New("student cohort not found")
	ErrStudentCohortForbidden = errors.New("insufficient student cohort scope")
	ErrCohortStudentNotFound  = errors.New("cohort student not found")
)

type StudentCohortService struct {
	Repo *repositories.StudentCohortRepository
}

func NewStudentCohortService(repo *repositories.StudentCohortRepository) *StudentCohortService {
	return &StudentCohortService{Repo: repo}
}

type StudentCohortValidationError struct{ Message string }

func (e StudentCohortValidationError) Error() string { return e.Message }

type StudentCohortConflictError struct{ Code, Message string }

func (e StudentCohortConflictError) Error() string { return e.Message }

func (s *StudentCohortService) GetCohorts(ctx context.Context, filters models.StudentCohortFilters, roles []string, facultyID *int64) ([]*models.StudentCohort, error) {
	scoped, err := s.applyFacultyScope(filters, roles, facultyID)
	if err != nil {
		return nil, err
	}
	return s.Repo.GetCohorts(ctx, scoped)
}

func (s *StudentCohortService) GetCohort(ctx context.Context, cohortID uint64, roles []string, facultyID *int64) (*models.StudentCohort, error) {
	return s.getCohortForWrite(ctx, cohortID, roles, facultyID)
}

func (s *StudentCohortService) CreateCohort(ctx context.Context, payload models.UpsertStudentCohortPayload, userID int64, roles []string, facultyID *int64) (*models.StudentCohort, error) {
	payload = normalizeCohortPayload(payload)
	if payload.CurriculumID == 0 || payload.EntryYearBE == 0 {
		return nil, StudentCohortValidationError{Message: "curriculum_id and entry_year_be are required"}
	}
	curriculum, err := s.Repo.GetCurriculumForCohort(ctx, payload.CurriculumID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrStudentCohortNotFound
	}
	if err != nil {
		return nil, err
	}
	if err := ensureStudentCohortFacultyScope(curriculum.FacultyID, roles, facultyID); err != nil {
		return nil, err
	}
	if curriculum.Status != "active" {
		return nil, StudentCohortConflictError{Code: "CURRICULUM_NOT_ACTIVE", Message: "cohort requires an active curriculum"}
	}
	if payload.EntryYearBE < curriculum.EffectiveYearBE {
		return nil, StudentCohortValidationError{Message: "entry_year_be cannot be before curriculum effective year"}
	}
	return s.Repo.CreateCohort(ctx, payload, userID)
}

func (s *StudentCohortService) UpdateCohort(ctx context.Context, cohortID uint64, payload models.UpdateStudentCohortPayload, roles []string, facultyID *int64) (*models.StudentCohort, error) {
	cohort, err := s.getCohortForWrite(ctx, cohortID, roles, facultyID)
	if err != nil {
		return nil, err
	}
	if cohort.Status == "archived" {
		return nil, StudentCohortConflictError{Code: "COHORT_ARCHIVED", Message: "archived cohort is read-only"}
	}
	payload.Note = trimStudentNullable(payload.Note)
	if payload.CurriculumID == 0 {
		payload.CurriculumID = cohort.CurriculumID
	}
	if payload.EntryYearBE == 0 {
		payload.EntryYearBE = cohort.EntryYearBE
	}
	identityChanged := payload.CurriculumID != cohort.CurriculumID || payload.EntryYearBE != cohort.EntryYearBE
	if identityChanged {
		if cohort.Status != "draft" || cohort.RosterCount > 0 || cohort.TemplateCount > 0 {
			return nil, StudentCohortConflictError{Code: "COHORT_IDENTITY_LOCKED", Message: "curriculum and entry year can only be changed for an empty draft cohort without templates"}
		}
		curriculum, err := s.Repo.GetCurriculumForCohort(ctx, payload.CurriculumID)
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrStudentCohortNotFound
		}
		if err != nil {
			return nil, err
		}
		if err := ensureStudentCohortFacultyScope(curriculum.FacultyID, roles, facultyID); err != nil {
			return nil, err
		}
		if curriculum.Status != "active" {
			return nil, StudentCohortConflictError{Code: "CURRICULUM_NOT_ACTIVE", Message: "cohort requires an active curriculum"}
		}
		if payload.EntryYearBE < curriculum.EffectiveYearBE {
			return nil, StudentCohortValidationError{Message: "entry_year_be cannot be before curriculum effective year"}
		}
	}
	return s.Repo.UpdateCohort(ctx, cohortID, payload)
}

func (s *StudentCohortService) UpdateCohortStatus(ctx context.Context, cohortID uint64, payload models.UpdateStudentCohortStatusPayload, userID int64, roles []string, facultyID *int64) (*models.StudentCohort, error) {
	cohort, err := s.getCohortForWrite(ctx, cohortID, roles, facultyID)
	if err != nil {
		return nil, err
	}
	next := strings.ToLower(strings.TrimSpace(payload.Status))
	switch {
	case cohort.Status == "draft" && next == "active":
		return s.Repo.UpdateCohortStatus(ctx, cohortID, "active", nil, userID)
	case cohort.Status == "active" && next == "archived":
		if cohort.StudentCount > 0 || cohort.SuspendedCount > 0 {
			return nil, StudentCohortConflictError{Code: "COHORT_HAS_ACTIVE_STUDENTS", Message: "cohort cannot be archived while student or suspended members remain"}
		}
		activeTemplates, err := s.Repo.CountActiveTemplatesForCohort(ctx, cohort)
		if err != nil {
			return nil, err
		}
		if activeTemplates > 0 {
			return nil, StudentCohortConflictError{Code: "COHORT_HAS_ACTIVE_TEMPLATE", Message: "cohort cannot be archived while active templates are connected"}
		}
		return s.Repo.UpdateCohortStatus(ctx, cohortID, "archived", nil, userID)
	case cohort.Status == "archived" && next == "active":
		if !hasStudentCohortRole(roles, "admin") {
			return nil, ErrStudentCohortForbidden
		}
		if !payload.ConfirmReactivation {
			return nil, StudentCohortConflictError{Code: "CONFIRMATION_REQUIRED", Message: "cohort reactivation requires confirmation"}
		}
		reason := strings.TrimSpace(payload.ReactivationReason)
		if reason == "" {
			return nil, StudentCohortValidationError{Message: "reactivation_reason is required"}
		}
		return s.Repo.UpdateCohortStatus(ctx, cohortID, "active", &reason, userID)
	case next == "":
		return nil, StudentCohortValidationError{Message: "status is required"}
	default:
		return nil, StudentCohortConflictError{Code: "INVALID_STATUS_TRANSITION", Message: "invalid cohort status transition"}
	}
}

func (s *StudentCohortService) DeleteCohort(ctx context.Context, cohortID uint64, roles []string, facultyID *int64) error {
	cohort, err := s.getCohortForWrite(ctx, cohortID, roles, facultyID)
	if err != nil {
		return err
	}
	if cohort.Status != "draft" {
		return StudentCohortConflictError{Code: "COHORT_DELETE_NOT_ALLOWED", Message: "only draft cohort can be deleted"}
	}
	if cohort.RosterCount > 0 {
		return StudentCohortConflictError{Code: "COHORT_HAS_STUDENTS", Message: "cohort cannot be deleted while students are connected"}
	}
	activeTemplates, err := s.Repo.CountActiveTemplatesForCohort(ctx, cohort)
	if err != nil {
		return err
	}
	if activeTemplates > 0 {
		return StudentCohortConflictError{Code: "COHORT_HAS_ACTIVE_TEMPLATE", Message: "cohort cannot be deleted while active templates are connected"}
	}
	if err := s.Repo.SoftDeleteCohort(ctx, cohortID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrStudentCohortNotFound
		}
		return err
	}
	return nil
}

func (s *StudentCohortService) GetRoster(ctx context.Context, cohortID uint64, filters models.StudentRosterFilters, roles []string, facultyID *int64) ([]*models.CohortStudent, error) {
	if _, err := s.getCohortForWrite(ctx, cohortID, roles, facultyID); err != nil {
		return nil, err
	}
	filters.Search = strings.TrimSpace(filters.Search)
	filters.Status = strings.ToLower(strings.TrimSpace(filters.Status))
	if filters.Status != "" && !validStudentEnrollmentStatus(filters.Status) {
		return nil, StudentCohortValidationError{Message: "enrollment status is invalid"}
	}
	return s.Repo.GetRoster(ctx, cohortID, filters)
}

func (s *StudentCohortService) AddStudent(ctx context.Context, cohortID uint64, payload models.UpsertCohortStudentPayload, roles []string, facultyID *int64) (*models.CohortStudent, error) {
	cohort, err := s.getCohortForWrite(ctx, cohortID, roles, facultyID)
	if err != nil {
		return nil, err
	}
	if err := ensureCohortRosterWritable(cohort); err != nil {
		return nil, err
	}
	payload, err = normalizeStudentPayload(payload)
	if err != nil {
		return nil, err
	}
	if _, _, err := s.Repo.FindStudentByCode(ctx, payload.StudentCode); err == nil {
		return nil, StudentCohortConflictError{Code: "STUDENT_CODE_EXISTS", Message: "student code already exists"}
	} else if !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	return s.Repo.CreateCohortStudent(ctx, cohort, payload)
}

func (s *StudentCohortService) UpdateStudent(ctx context.Context, cohortID, enrollmentID uint64, payload models.UpsertCohortStudentPayload, roles []string, facultyID *int64) (*models.CohortStudent, error) {
	cohort, err := s.getCohortForWrite(ctx, cohortID, roles, facultyID)
	if err != nil {
		return nil, err
	}
	if err := ensureCohortRosterWritable(cohort); err != nil {
		return nil, err
	}
	existing, err := s.Repo.GetCohortStudentByEnrollmentID(ctx, cohortID, enrollmentID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrCohortStudentNotFound
	}
	if err != nil {
		return nil, err
	}
	payload, err = normalizeStudentPayload(payload)
	if err != nil {
		return nil, err
	}
	if payload.StudentCode != existing.StudentCode {
		return nil, StudentCohortConflictError{Code: "STUDENT_CODE_IMMUTABLE", Message: "student code cannot be changed"}
	}
	return s.Repo.UpdateCohortStudent(ctx, cohortID, enrollmentID, payload)
}

func (s *StudentCohortService) RemoveStudent(ctx context.Context, cohortID, enrollmentID uint64, roles []string, facultyID *int64) error {
	cohort, err := s.getCohortForWrite(ctx, cohortID, roles, facultyID)
	if err != nil {
		return err
	}
	if err := ensureCohortRosterWritable(cohort); err != nil {
		return err
	}
	student, err := s.Repo.GetCohortStudentByEnrollmentID(ctx, cohortID, enrollmentID)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrCohortStudentNotFound
	}
	if err != nil {
		return err
	}
	dependencies, err := s.Repo.CountStudentDependencies(ctx, student.EnrollmentID, student.PersonID)
	if err != nil {
		return err
	}
	if dependencies > 0 {
		return StudentCohortConflictError{Code: "STUDENT_HAS_ACADEMIC_USAGE", Message: "student cannot be removed after academic, attendance, or score usage exists"}
	}
	return s.Repo.SoftRemoveCohortStudent(ctx, cohortID, enrollmentID)
}

func (s *StudentCohortService) PreviewImport(ctx context.Context, cohortID uint64, payload models.ImportCohortStudentsPayload, roles []string, facultyID *int64) (*models.CohortImportPreview, error) {
	cohort, err := s.getCohortForWrite(ctx, cohortID, roles, facultyID)
	if err != nil {
		return nil, err
	}
	if err := ensureCohortRosterWritable(cohort); err != nil {
		return nil, err
	}
	return s.inspectImport(ctx, cohort, payload.Rows)
}

func (s *StudentCohortService) CommitImport(ctx context.Context, cohortID uint64, payload models.ImportCohortStudentsPayload, roles []string, facultyID *int64) (*models.CohortImportPreview, error) {
	cohort, err := s.getCohortForWrite(ctx, cohortID, roles, facultyID)
	if err != nil {
		return nil, err
	}
	if err := ensureCohortRosterWritable(cohort); err != nil {
		return nil, err
	}
	preview, err := s.inspectImport(ctx, cohort, payload.Rows)
	if err != nil {
		return nil, err
	}
	if len(preview.Errors) > 0 {
		return preview, StudentCohortConflictError{Code: "IMPORT_VALIDATION_FAILED", Message: "import contains invalid or conflicting rows"}
	}
	if err := s.Repo.ImportCohortStudents(ctx, cohort, preview.ValidRows); err != nil {
		return nil, err
	}
	return preview, nil
}

func (s *StudentCohortService) inspectImport(ctx context.Context, cohort *models.StudentCohort, rows []models.ImportCohortStudentRow) (*models.CohortImportPreview, error) {
	preview := &models.CohortImportPreview{ValidRows: make([]models.ImportCohortStudentRow, 0), UpdateCandidates: make([]models.CohortStudent, 0), SkippedRows: make([]models.CohortImportIssue, 0), Errors: make([]models.CohortImportIssue, 0)}
	if len(rows) == 0 {
		return preview, StudentCohortValidationError{Message: "at least one import row is required"}
	}
	if len(rows) > 1000 {
		return preview, StudentCohortValidationError{Message: "import supports at most 1000 rows"}
	}
	seen := make(map[string]bool)
	for index, row := range rows {
		row.RowNumber = row.RowNumber
		if row.RowNumber <= 0 {
			row.RowNumber = index + 2
		}
		normalized, err := normalizeImportStudentRow(row)
		if err != nil {
			preview.Errors = append(preview.Errors, models.CohortImportIssue{RowNumber: row.RowNumber, StudentCode: strings.TrimSpace(row.StudentCode), Message: err.Error()})
			continue
		}
		if seen[normalized.StudentCode] {
			preview.Errors = append(preview.Errors, models.CohortImportIssue{RowNumber: normalized.RowNumber, StudentCode: normalized.StudentCode, Message: "student code is duplicated in this file"})
			continue
		}
		seen[normalized.StudentCode] = true
		existing, existingCohortID, err := s.Repo.FindStudentByCode(ctx, normalized.StudentCode)
		if errors.Is(err, sql.ErrNoRows) {
			preview.ValidRows = append(preview.ValidRows, normalized)
			continue
		}
		if err != nil {
			return nil, err
		}
		if existingCohortID == nil || *existingCohortID != cohort.CohortID {
			preview.Errors = append(preview.Errors, models.CohortImportIssue{RowNumber: normalized.RowNumber, StudentCode: normalized.StudentCode, Message: "student code already belongs to another curriculum or cohort"})
			continue
		}
		if sameStudentData(existing, normalized) {
			preview.SkippedRows = append(preview.SkippedRows, models.CohortImportIssue{RowNumber: normalized.RowNumber, StudentCode: normalized.StudentCode, Message: "student already exists in this cohort"})
			continue
		}
		preview.UpdateCandidates = append(preview.UpdateCandidates, *existing)
		preview.ValidRows = append(preview.ValidRows, normalized)
	}
	return preview, nil
}

func (s *StudentCohortService) getCohortForWrite(ctx context.Context, cohortID uint64, roles []string, facultyID *int64) (*models.StudentCohort, error) {
	cohort, err := s.Repo.GetCohortByID(ctx, cohortID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrStudentCohortNotFound
	}
	if err != nil {
		return nil, err
	}
	if err := ensureStudentCohortFacultyScope(cohort.FacultyID, roles, facultyID); err != nil {
		return nil, err
	}
	return cohort, nil
}

func (s *StudentCohortService) applyFacultyScope(filters models.StudentCohortFilters, roles []string, facultyID *int64) (models.StudentCohortFilters, error) {
	if hasStudentCohortRole(roles, "admin") {
		return filters, nil
	}
	if !hasStudentCohortRole(roles, "officer") || facultyID == nil || *facultyID <= 0 {
		return filters, ErrStudentCohortForbidden
	}
	scoped := uint64(*facultyID)
	if filters.FacultyID != nil && *filters.FacultyID != scoped {
		return filters, ErrStudentCohortForbidden
	}
	filters.FacultyID = &scoped
	return filters, nil
}

func ensureStudentCohortFacultyScope(target uint64, roles []string, facultyID *int64) error {
	if hasStudentCohortRole(roles, "admin") {
		return nil
	}
	if !hasStudentCohortRole(roles, "officer") || facultyID == nil || *facultyID <= 0 || target != uint64(*facultyID) {
		return ErrStudentCohortForbidden
	}
	return nil
}

func ensureCohortRosterWritable(cohort *models.StudentCohort) error {
	if cohort.Status == "archived" {
		return StudentCohortConflictError{Code: "COHORT_ARCHIVED", Message: "archived cohort is read-only"}
	}
	return nil
}

func normalizeCohortPayload(payload models.UpsertStudentCohortPayload) models.UpsertStudentCohortPayload {
	payload.Note = trimStudentNullable(payload.Note)
	return payload
}

func normalizeStudentPayload(payload models.UpsertCohortStudentPayload) (models.UpsertCohortStudentPayload, error) {
	payload.StudentCode = strings.TrimSpace(payload.StudentCode)
	payload.FirstNameTH = strings.TrimSpace(payload.FirstNameTH)
	payload.LastNameTH = strings.TrimSpace(payload.LastNameTH)
	payload.PrefixTH, payload.FirstNameEN, payload.LastNameEN, payload.Email, payload.Phone = trimStudentNullable(payload.PrefixTH), trimStudentNullable(payload.FirstNameEN), trimStudentNullable(payload.LastNameEN), trimStudentNullable(payload.Email), trimStudentNullable(payload.Phone)
	payload.EnrollmentStatus = strings.ToLower(strings.TrimSpace(payload.EnrollmentStatus))
	if payload.EnrollmentStatus == "" {
		payload.EnrollmentStatus = "student"
	}
	if payload.StudentCode == "" || payload.FirstNameTH == "" || payload.LastNameTH == "" {
		return payload, StudentCohortValidationError{Message: "student_code, first_name_th, and last_name_th are required"}
	}
	if !validStudentEnrollmentStatus(payload.EnrollmentStatus) {
		return payload, StudentCohortValidationError{Message: "enrollment_status is invalid"}
	}
	return payload, nil
}

func normalizeImportStudentRow(row models.ImportCohortStudentRow) (models.ImportCohortStudentRow, error) {
	payload, err := normalizeStudentPayload(models.UpsertCohortStudentPayload{StudentCode: row.StudentCode, PrefixTH: row.PrefixTH, FirstNameTH: row.FirstNameTH, LastNameTH: row.LastNameTH, FirstNameEN: row.FirstNameEN, LastNameEN: row.LastNameEN, Email: row.Email, Phone: row.Phone, EnrollmentStatus: row.EnrollmentStatus})
	if err != nil {
		return row, err
	}
	row.StudentCode, row.PrefixTH, row.FirstNameTH, row.LastNameTH = payload.StudentCode, payload.PrefixTH, payload.FirstNameTH, payload.LastNameTH
	row.FirstNameEN, row.LastNameEN, row.Email, row.Phone, row.EnrollmentStatus = payload.FirstNameEN, payload.LastNameEN, payload.Email, payload.Phone, payload.EnrollmentStatus
	return row, nil
}

func validStudentEnrollmentStatus(status string) bool {
	switch status {
	case "student", "suspended", "alumni", "inactive":
		return true
	default:
		return false
	}
}
func hasStudentCohortRole(roles []string, expected string) bool {
	for _, role := range roles {
		if role == expected {
			return true
		}
	}
	return false
}
func trimStudentNullable(value *string) *string {
	if value == nil {
		return nil
	}
	normalized := strings.TrimSpace(*value)
	if normalized == "" {
		return nil
	}
	return &normalized
}
func sameStudentData(existing *models.CohortStudent, row models.ImportCohortStudentRow) bool {
	return existing.FirstNameTH == row.FirstNameTH && existing.LastNameTH == row.LastNameTH && nullableStudentEqual(existing.PrefixTH, row.PrefixTH) && nullableStudentEqual(existing.FirstNameEN, row.FirstNameEN) && nullableStudentEqual(existing.LastNameEN, row.LastNameEN) && nullableStudentEqual(existing.Email, row.Email) && nullableStudentEqual(existing.Phone, row.Phone) && existing.EnrollmentStatus == row.EnrollmentStatus
}
func nullableStudentEqual(a, b *string) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}
