package services

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
)

const (
	careerPathImportSchemaVersion = 1
	careerPathImportMaxRows       = 500
	careerPathImportMaxRelations  = 200
)

var ErrCareerPathImportInvalid = errors.New("career path import is invalid")

type CareerPathImportStore interface {
	FindByFacultyCode(context.Context, uint64, string) (*models.CareerPath, error)
	ValidateMappings(context.Context, uint64, []uint64, []uint64) error
	CommitImport(context.Context, []models.CareerPathImportWrite, uint64) error
}

type CareerPathImportService struct {
	Repo CareerPathImportStore
}

func NewCareerPathImportService(repo CareerPathImportStore) *CareerPathImportService {
	return &CareerPathImportService{Repo: repo}
}

type careerPathImportPlan struct {
	RowNumber       int
	Action          string
	CareerPathID    *uint64
	ExpectedVersion uint64
	ExpectedPublish uint64
	Selected        bool
	Valid           bool
	Payload         models.CareerPathDraftPayload
	Previous        *models.CareerPathDraftPayload
	Issues          []models.CareerPathImportIssue
}

type careerPathImportFingerprint struct {
	FacultyID uint64
	Rows      []careerPathImportFingerprintRow
}

type careerPathImportFingerprintRow struct {
	RowNumber       int
	Action          string
	CareerPathID    *uint64
	ExpectedVersion uint64
	ExpectedPublish uint64
	Payload         models.CareerPathDraftPayload
}

func (s *CareerPathImportService) Preview(ctx context.Context, payload models.CareerPathImportPayload, roles []string, facultyID *int64) (*models.CareerPathImportPreview, error) {
	faculty, err := resolveCareerPathFaculty(payload.FacultyID, roles, facultyID)
	if err != nil {
		return nil, err
	}
	payload.FacultyID = &faculty
	plans, issues, err := s.analyze(ctx, payload, false)
	if err != nil {
		return nil, err
	}
	return buildCareerPathImportPreview(faculty, plans, issues), nil
}

func (s *CareerPathImportService) Commit(ctx context.Context, payload models.CareerPathImportPayload, userID uint64, roles []string, facultyID *int64) error {
	faculty, err := resolveCareerPathFaculty(payload.FacultyID, roles, facultyID)
	if err != nil {
		return err
	}
	payload.FacultyID = &faculty
	plans, issues, err := s.analyze(ctx, payload, true)
	if err != nil {
		return err
	}
	preview := buildCareerPathImportPreview(faculty, plans, issues)
	if payload.PreviewToken == "" || preview.PreviewToken != payload.PreviewToken {
		return repositories.ErrCareerPathConflict
	}

	writes := make([]models.CareerPathImportWrite, 0, len(plans))
	for _, plan := range plans {
		if !plan.Selected {
			continue
		}
		if !plan.Valid {
			return ErrCareerPathImportInvalid
		}
		writes = append(writes, models.CareerPathImportWrite{
			CareerPathID:             plan.CareerPathID,
			ExpectedVersion:          plan.ExpectedVersion,
			ExpectedPublishedVersion: plan.ExpectedPublish,
			Payload:                  plan.Payload,
		})
	}
	if len(writes) == 0 {
		return ErrCareerPathImportInvalid
	}
	return s.Repo.CommitImport(ctx, writes, userID)
}

func (s *CareerPathImportService) analyze(ctx context.Context, payload models.CareerPathImportPayload, useSelection bool) ([]careerPathImportPlan, []models.CareerPathImportIssue, error) {
	if payload.SchemaVersion != careerPathImportSchemaVersion {
		return nil, []models.CareerPathImportIssue{careerImportIssue(0, "schema_version", "UNSUPPORTED_SCHEMA", "unsupported schema version", "error")}, nil
	}
	if len(payload.Rows) == 0 || len(payload.Rows) > careerPathImportMaxRows {
		return nil, []models.CareerPathImportIssue{careerImportIssue(0, "rows", "INVALID_ROW_COUNT", "row count is outside the supported limit", "error")}, nil
	}
	if payload.FacultyID == nil || *payload.FacultyID == 0 {
		return nil, nil, ErrCareerPathInvalid
	}

	codeCounts := make(map[string]int, len(payload.Rows))
	for _, row := range payload.Rows {
		code := normalizedCareerPathCode(row.Code)
		if code != "" {
			codeCounts[code]++
		}
	}
	usedRows := make(map[int]bool, len(payload.Rows))
	plans := make([]careerPathImportPlan, 0, len(payload.Rows))
	for index, row := range payload.Rows {
		rowNumber := row.RowNumber
		if rowNumber <= 0 {
			rowNumber = index + 1
		}
		plan := careerPathImportPlan{RowNumber: rowNumber, Selected: !useSelection && row.Action != "skip", Valid: true, Issues: []models.CareerPathImportIssue{}}
		if useSelection {
			plan.Selected = row.Selected
		}
		if usedRows[rowNumber] {
			plan.addIssue("row_number", "DUPLICATE_ROW_NUMBER", "row number appears more than once")
		}
		usedRows[rowNumber] = true
		code := strings.TrimSpace(row.Code)
		if code == "" {
			plan.addIssue("code", "CODE_REQUIRED", "career path code is required")
		}
		if codeCounts[normalizedCareerPathCode(code)] > 1 {
			plan.addIssue("code", "DUPLICATE_FILE_CODE", "career path code appears more than once in the import")
		}
		if len(careerPathImportCurriculumIDs(row)) > careerPathImportMaxRelations || len(careerPathImportCompetencyIDs(row)) > careerPathImportMaxRelations {
			plan.addIssue("relationships", "TOO_MANY_RELATIONSHIPS", "too many linked records")
		}
		if err := validateCareerPathImportClearFields(row.ClearFields); err != nil {
			plan.addIssue("clear_fields", "INVALID_CLEAR_FIELD", err.Error())
		}
		if !plan.Valid {
			plans = append(plans, plan)
			continue
		}

		existing, err := s.Repo.FindByFacultyCode(ctx, *payload.FacultyID, code)
		if err != nil && !errors.Is(err, repositories.ErrCareerPathNotFound) {
			return nil, nil, err
		}
		action := strings.ToLower(strings.TrimSpace(row.Action))
		if action == "" {
			if existing == nil {
				action = "create"
			} else {
				action = "skip"
			}
		}
		if action != "create" && action != "update" && action != "skip" {
			plan.addIssue("action", "INVALID_ACTION", "action must be create, update, or skip")
			plans = append(plans, plan)
			continue
		}
		plan.Action = action
		if action == "skip" {
			plan.Selected = false
			if existing != nil {
				plan.CareerPathID = &existing.CareerPathID
			}
			plans = append(plans, plan)
			continue
		}
		if action == "create" && existing != nil {
			plan.addIssue("code", "CAREER_PATH_EXISTS", "career path code already exists; choose update or skip")
			plans = append(plans, plan)
			continue
		}
		if action == "update" && existing == nil {
			plan.addIssue("code", "CAREER_PATH_NOT_FOUND", "no career path with this code exists in the selected faculty")
			plans = append(plans, plan)
			continue
		}

		var baseline models.CareerPathDraftPayload
		if existing != nil {
			plan.CareerPathID = &existing.CareerPathID
			if existing.DraftVersion != nil {
				plan.ExpectedVersion = existing.DraftVersion.CareerVersionID
				baseline = draftPayloadFromVersion(existing.Code, *payload.FacultyID, existing.DraftVersion)
			} else if existing.PublishedVersion != nil {
				plan.ExpectedPublish = existing.PublishedVersion.CareerVersionID
				baseline = draftPayloadFromVersion(existing.Code, *payload.FacultyID, existing.PublishedVersion)
			}
			previous := baseline
			plan.Previous = &previous
		}
		plan.Payload = mergeCareerPathImportRow(row, code, *payload.FacultyID, baseline)
		if err := validateCareerPathDraft(plan.Payload); err != nil {
			plan.addIssue("fields", "DRAFT_INVALID", "code, Thai name, and relationship identifiers must be valid")
		}
		if plan.Valid {
			if err := s.Repo.ValidateMappings(ctx, *payload.FacultyID, plan.Payload.CurriculumIDs, plan.Payload.CompetencyIDs); err != nil {
				if errors.Is(err, repositories.ErrCareerPathInvalidScope) {
					plan.addIssue("relationships", "REFERENCE_OUT_OF_SCOPE", "a curriculum or competency is missing, inactive, or outside the allowed scope")
				} else {
					return nil, nil, err
				}
			}
		}
		plans = append(plans, plan)
	}
	return plans, nil, nil
}

func buildCareerPathImportPreview(facultyID uint64, plans []careerPathImportPlan, globalIssues []models.CareerPathImportIssue) *models.CareerPathImportPreview {
	preview := &models.CareerPathImportPreview{Valid: len(globalIssues) == 0, Issues: globalIssues, Rows: make([]models.CareerPathImportPreviewRow, 0, len(plans))}
	fingerprint := careerPathImportFingerprint{FacultyID: facultyID, Rows: make([]careerPathImportFingerprintRow, 0, len(plans))}
	for _, plan := range plans {
		if !plan.Valid {
			preview.Valid = false
		}
		if plan.Valid && plan.Selected && plan.Action != "skip" {
			preview.CanCommit = true
		}
		preview.Rows = append(preview.Rows, models.CareerPathImportPreviewRow{
			RowNumber:                plan.RowNumber,
			Action:                   plan.Action,
			CareerPathID:             plan.CareerPathID,
			ExpectedVersion:          plan.ExpectedVersion,
			ExpectedPublishedVersion: plan.ExpectedPublish,
			Selected:                 plan.Selected,
			Valid:                    plan.Valid,
			Payload:                  plan.Payload,
			Previous:                 plan.Previous,
			Issues:                   plan.Issues,
		})
		fingerprint.Rows = append(fingerprint.Rows, careerPathImportFingerprintRow{
			RowNumber:       plan.RowNumber,
			Action:          plan.Action,
			CareerPathID:    plan.CareerPathID,
			ExpectedVersion: plan.ExpectedVersion,
			ExpectedPublish: plan.ExpectedPublish,
			Payload:         plan.Payload,
		})
	}
	serialized, _ := json.Marshal(fingerprint)
	digest := sha256.Sum256(serialized)
	preview.PreviewToken = hex.EncodeToString(digest[:])
	return preview
}

func (plan *careerPathImportPlan) addIssue(field, code, message string) {
	plan.Valid = false
	plan.Issues = append(plan.Issues, careerImportIssue(plan.RowNumber, field, code, message, "error"))
}

func careerImportIssue(rowNumber int, field, code, message, severity string) models.CareerPathImportIssue {
	return models.CareerPathImportIssue{RowNumber: rowNumber, Field: field, Code: code, Message: message, Severity: severity}
}

func normalizedCareerPathCode(code string) string {
	return strings.ToLower(strings.TrimSpace(code))
}

func careerPathImportCurriculumIDs(row models.CareerPathImportRow) []uint64 {
	if row.CurriculumIDs == nil {
		return nil
	}
	return *row.CurriculumIDs
}

func careerPathImportCompetencyIDs(row models.CareerPathImportRow) []uint64 {
	if row.CompetencyIDs == nil {
		return nil
	}
	return *row.CompetencyIDs
}

var careerPathImportClearableFields = map[string]bool{
	"name_en":               true,
	"description_th":        true,
	"description_en":        true,
	"skills_description_th": true,
	"skills_description_en": true,
	"source_reference":      true,
	"curriculum_ids":        true,
	"competency_ids":        true,
}

func validateCareerPathImportClearFields(fields []string) error {
	seen := make(map[string]struct{}, len(fields))
	for _, field := range fields {
		if !careerPathImportClearableFields[field] {
			return fmt.Errorf("field %q cannot be cleared", field)
		}
		if _, exists := seen[field]; exists {
			return fmt.Errorf("field %q appears more than once", field)
		}
		seen[field] = struct{}{}
	}
	return nil
}

func mergeCareerPathImportRow(row models.CareerPathImportRow, code string, facultyID uint64, baseline models.CareerPathDraftPayload) models.CareerPathDraftPayload {
	result := baseline
	if result.FacultyID == nil {
		result.FacultyID = &facultyID
	}
	result.Code = code
	if value := nonBlank(row.NameTH); value != nil {
		result.NameTH = *value
	}
	result.NameEN = mergeImportString(row.NameEN, result.NameEN, row.ClearFields, "name_en")
	result.DescriptionTH = mergeImportString(row.DescriptionTH, result.DescriptionTH, row.ClearFields, "description_th")
	result.DescriptionEN = mergeImportString(row.DescriptionEN, result.DescriptionEN, row.ClearFields, "description_en")
	result.SkillsTH = mergeImportString(row.SkillsTH, result.SkillsTH, row.ClearFields, "skills_description_th")
	result.SkillsEN = mergeImportString(row.SkillsEN, result.SkillsEN, row.ClearFields, "skills_description_en")
	result.SourceReference = mergeImportString(row.SourceReference, result.SourceReference, row.ClearFields, "source_reference")
	if containsString(row.ClearFields, "curriculum_ids") {
		result.CurriculumIDs = []uint64{}
	} else if row.CurriculumIDs != nil && len(*row.CurriculumIDs) > 0 {
		result.CurriculumIDs = append([]uint64{}, (*row.CurriculumIDs)...)
	}
	if containsString(row.ClearFields, "competency_ids") {
		result.CompetencyIDs = []uint64{}
	} else if row.CompetencyIDs != nil && len(*row.CompetencyIDs) > 0 {
		result.CompetencyIDs = append([]uint64{}, (*row.CompetencyIDs)...)
	}
	return result
}

func mergeImportString(incoming, previous *string, clearFields []string, field string) *string {
	if containsString(clearFields, field) {
		return nil
	}
	if value := nonBlank(incoming); value != nil {
		return value
	}
	return previous
}

func nonBlank(value *string) *string {
	if value == nil || strings.TrimSpace(*value) == "" {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	return &trimmed
}

func containsString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func draftPayloadFromVersion(code string, facultyID uint64, version *models.CareerPathVersion) models.CareerPathDraftPayload {
	if version == nil {
		return models.CareerPathDraftPayload{}
	}
	curriculumIDs := make([]uint64, 0, len(version.Curricula))
	for _, item := range version.Curricula {
		curriculumIDs = append(curriculumIDs, item.ID)
	}
	competencyIDs := make([]uint64, 0, len(version.Competencies))
	for _, item := range version.Competencies {
		competencyIDs = append(competencyIDs, item.ID)
	}
	return models.CareerPathDraftPayload{
		FacultyID: &facultyID, Code: code, NameTH: version.NameTH,
		NameEN: version.NameEN, DescriptionTH: version.DescriptionTH,
		DescriptionEN: version.DescriptionEN, SkillsTH: version.SkillsTH,
		SkillsEN: version.SkillsEN, SourceReference: version.SourceReference,
		CurriculumIDs: curriculumIDs, CompetencyIDs: competencyIDs,
	}
}
