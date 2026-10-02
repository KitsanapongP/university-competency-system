package repositories

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/spw32767/university-competency-system-backend/models"
)

var (
	ErrCareerPathNotFound     = errors.New("career path not found")
	ErrCareerPathConflict     = errors.New("career path changed or conflicts with another record")
	ErrCareerPathInvalidScope = errors.New("career path reference is outside the faculty scope")
)

type CareerPathRepository struct {
	DB *sql.DB
}

func NewCareerPathRepository(db *sql.DB) *CareerPathRepository {
	return &CareerPathRepository{DB: db}
}

func (r *CareerPathRepository) GetPublishedForCurriculumWith(
	ctx context.Context,
	queryer AssessmentQueryer,
	facultyID uint64,
	curriculumID uint64,
) ([]models.AssessmentCareerPath, error) {
	rows, err := queryer.QueryContext(ctx, `
		SELECT path.career_path_id, path.code, version.revision,
			version.name_th, version.name_en,
			version.description_th, version.description_en,
			version.skills_description_th, version.skills_description_en,
			competency.competency_id, competency.code,
			competency.name_th, competency.name_en
		FROM coop_career_paths path
		JOIN coop_career_versions version
			ON version.career_version_id = path.published_version_id
			AND version.career_path_id = path.career_path_id
			AND version.status = 'published'
		JOIN coop_career_curricula curriculumMapping
			ON curriculumMapping.career_version_id = version.career_version_id
			AND curriculumMapping.curriculum_id = ?
		LEFT JOIN coop_career_competencies competencyMapping
			ON competencyMapping.career_version_id = version.career_version_id
		LEFT JOIN comp_competencies competency
			ON competency.competency_id = competencyMapping.competency_id
			AND competency.deleted_at IS NULL
		WHERE path.faculty_id = ?
			AND path.status = 'active'
			AND path.deleted_at IS NULL
		ORDER BY path.career_path_id, competency.competency_id`, curriculumID, facultyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.AssessmentCareerPath, 0)
	indexes := make(map[uint64]int)
	for rows.Next() {
		var item models.AssessmentCareerPath
		var nameEN, descriptionTH, descriptionEN, skillsTH, skillsEN sql.NullString
		var competencyID sql.NullInt64
		var competencyCode, competencyNameTH, competencyNameEN sql.NullString
		if err := rows.Scan(
			&item.CareerPathID, &item.Code, &item.Revision,
			&item.NameTH, &nameEN, &descriptionTH, &descriptionEN,
			&skillsTH, &skillsEN, &competencyID, &competencyCode,
			&competencyNameTH, &competencyNameEN,
		); err != nil {
			return nil, err
		}
		item.NameEN = nullStringPointer(nameEN)
		item.DescriptionTH = nullStringPointer(descriptionTH)
		item.DescriptionEN = nullStringPointer(descriptionEN)
		item.SkillsTH = nullStringPointer(skillsTH)
		item.SkillsEN = nullStringPointer(skillsEN)
		index, exists := indexes[item.CareerPathID]
		if !exists {
			item.Competencies = make([]models.AssessmentCareerCompetency, 0)
			index = len(items)
			indexes[item.CareerPathID] = index
			items = append(items, item)
		}
		if competencyID.Valid {
			items[index].Competencies = append(items[index].Competencies, models.AssessmentCareerCompetency{
				CompetencyID:     uint64(competencyID.Int64),
				CompetencyCode:   competencyCode.String,
				CompetencyNameTH: competencyNameTH.String,
				CompetencyNameEN: competencyNameEN.String,
			})
		}
	}
	return items, rows.Err()
}

func (r *CareerPathRepository) List(ctx context.Context, filters models.CareerPathFilters) ([]models.CareerPathSummary, int, error) {
	where, args := careerPathListWhere(filters)
	var total int
	if err := r.DB.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM coop_career_paths path
		LEFT JOIN coop_career_versions draft ON draft.career_version_id = path.draft_version_id
		LEFT JOIN coop_career_versions published ON published.career_version_id = path.published_version_id
		WHERE `+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	queryArgs := append(append([]any{}, args...), filters.PageSize, (filters.Page-1)*filters.PageSize)
	rows, err := r.DB.QueryContext(ctx, `
		SELECT path.career_path_id, path.faculty_id, path.code, path.status,
			draft.career_version_id, draft.name_th, draft.revision,
			published.career_version_id, published.name_th, published.name_en, published.revision,
			path.created_at, path.updated_at
		FROM coop_career_paths path
		LEFT JOIN coop_career_versions draft ON draft.career_version_id = path.draft_version_id
		LEFT JOIN coop_career_versions published ON published.career_version_id = path.published_version_id
		LEFT JOIN org_faculties faculty ON faculty.faculty_id = path.faculty_id
		WHERE `+where+`
		ORDER BY `+careerPathListOrderBy(filters)+`
		LIMIT ? OFFSET ?`, queryArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := make([]models.CareerPathSummary, 0)
	for rows.Next() {
		item, err := scanCareerPathSummary(rows)
		if err != nil {
			return nil, 0, err
		}
		items = append(items, item)
	}
	return items, total, rows.Err()
}

func careerPathListWhere(filters models.CareerPathFilters) (string, []any) {
	conditions := []string{"path.deleted_at IS NULL"}
	args := make([]any, 0, 3)
	if filters.FacultyID != nil {
		conditions = append(conditions, "path.faculty_id = ?")
		args = append(args, *filters.FacultyID)
	}
	if filters.Status != "" {
		conditions = append(conditions, "path.status = ?")
		args = append(args, filters.Status)
	}
	if filters.CurriculumID != nil {
		conditions = append(conditions, `EXISTS (
			SELECT 1 FROM coop_career_curricula careerCurriculum
			WHERE careerCurriculum.career_version_id = COALESCE(path.draft_version_id, path.published_version_id)
				AND careerCurriculum.curriculum_id = ?
		)`)
		args = append(args, *filters.CurriculumID)
	} else if filters.WithoutCurriculum {
		conditions = append(conditions, `NOT EXISTS (
			SELECT 1 FROM coop_career_curricula careerCurriculum
			WHERE careerCurriculum.career_version_id = COALESCE(path.draft_version_id, path.published_version_id)
		)`)
	}
	if search := strings.TrimSpace(filters.Search); search != "" {
		conditions = append(conditions, "(path.code LIKE ? OR draft.name_th LIKE ? OR draft.name_en LIKE ? OR published.name_th LIKE ? OR published.name_en LIKE ?)")
		pattern := "%" + search + "%"
		for range 5 {
			args = append(args, pattern)
		}
	}
	return strings.Join(conditions, " AND "), args
}

func careerPathListOrderBy(filters models.CareerPathFilters) string {
	var expression string
	switch filters.SortBy {
	case "faculty":
		if filters.Language == "en" {
			expression = "COALESCE(NULLIF(faculty.name_en, ''), NULLIF(faculty.name_th, ''), '')"
		} else {
			expression = "COALESCE(NULLIF(faculty.name_th, ''), NULLIF(faculty.name_en, ''), '')"
		}
	default:
		if filters.Language == "en" {
			expression = "COALESCE(NULLIF(published.name_en, ''), NULLIF(published.name_th, ''), NULLIF(draft.name_th, ''), path.code)"
		} else {
			expression = "COALESCE(NULLIF(published.name_th, ''), NULLIF(draft.name_th, ''), path.code)"
		}
	}

	direction := "ASC"
	if filters.SortOrder == "desc" {
		direction = "DESC"
	}
	return expression + " " + direction + ", path.career_path_id ASC"
}

type careerPathRowScanner interface {
	Scan(dest ...any) error
}

func scanCareerPathSummary(scanner careerPathRowScanner) (models.CareerPathSummary, error) {
	var item models.CareerPathSummary
	var draftID, draftRevision, publishedID, publishedRevision sql.NullInt64
	var draftName, publishedNameTH, publishedNameEN sql.NullString
	err := scanner.Scan(
		&item.CareerPathID, &item.FacultyID, &item.Code, &item.Status,
		&draftID, &draftName, &draftRevision,
		&publishedID, &publishedNameTH, &publishedNameEN, &publishedRevision,
		&item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		return item, err
	}
	item.DraftVersionID = nullUint64(draftID)
	item.DraftNameTH = nullStringPointer(draftName)
	item.DraftRevision = nullUint64(draftRevision)
	item.PublishedVersionID = nullUint64(publishedID)
	item.PublishedNameTH = nullStringPointer(publishedNameTH)
	item.PublishedNameEN = nullStringPointer(publishedNameEN)
	item.PublishedRevision = nullUint64(publishedRevision)
	return item, nil
}

func nullIDValue(value sql.NullInt64) uint64 {
	if !value.Valid || value.Int64 < 0 {
		return 0
	}
	return uint64(value.Int64)
}

func (r *CareerPathRepository) Get(ctx context.Context, careerPathID uint64) (*models.CareerPath, error) {
	var item models.CareerPath
	var draftID, publishedID sql.NullInt64
	err := r.DB.QueryRowContext(ctx, `
		SELECT career_path_id, faculty_id, code, status,
			draft_version_id, published_version_id, created_at, updated_at
		FROM coop_career_paths
		WHERE career_path_id = ? AND deleted_at IS NULL`, careerPathID).Scan(
		&item.CareerPathID, &item.FacultyID, &item.Code, &item.Status,
		&draftID, &publishedID, &item.CreatedAt, &item.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrCareerPathNotFound
	}
	if err != nil {
		return nil, err
	}
	if draftID.Valid {
		item.DraftVersion, err = r.getVersion(ctx, uint64(draftID.Int64))
		if err != nil {
			return nil, err
		}
	}
	if publishedID.Valid {
		item.PublishedVersion, err = r.getVersion(ctx, uint64(publishedID.Int64))
		if err != nil {
			return nil, err
		}
	}
	return &item, nil
}

func (r *CareerPathRepository) FindByFacultyCode(ctx context.Context, facultyID uint64, code string) (*models.CareerPath, error) {
	var careerPathID uint64
	err := r.DB.QueryRowContext(ctx, `
		SELECT career_path_id FROM coop_career_paths
		WHERE faculty_id = ? AND code = ? AND deleted_at IS NULL`, facultyID, strings.TrimSpace(code)).Scan(&careerPathID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrCareerPathNotFound
	}
	if err != nil {
		return nil, err
	}
	return r.Get(ctx, careerPathID)
}

func (r *CareerPathRepository) ValidateMappings(ctx context.Context, facultyID uint64, curriculumIDs, competencyIDs []uint64) error {
	tx, err := r.DB.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return err
	}
	defer tx.Rollback()
	return validateCareerPathMappingsTx(ctx, tx, facultyID, curriculumIDs, competencyIDs)
}

func (r *CareerPathRepository) CommitImport(ctx context.Context, writes []models.CareerPathImportWrite, userID uint64) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, write := range writes {
		if write.CareerPathID == nil {
			if write.Payload.FacultyID == nil || *write.Payload.FacultyID == 0 {
				return ErrCareerPathInvalidScope
			}
			facultyID := *write.Payload.FacultyID
			if err := validateCareerPathMappingsTx(ctx, tx, facultyID, write.Payload.CurriculumIDs, write.Payload.CompetencyIDs); err != nil {
				return err
			}
			result, err := tx.ExecContext(ctx, `
				INSERT INTO coop_career_paths (faculty_id, code, status, created_by)
				VALUES (?, ?, 'draft', ?)`, facultyID, strings.TrimSpace(write.Payload.Code), userID)
			if err != nil {
				return mapCareerPathWriteError(err)
			}
			id, err := result.LastInsertId()
			if err != nil {
				return err
			}
			versionID, err := insertCareerPathVersion(ctx, tx, uint64(id), 1, write.Payload, userID)
			if err != nil {
				return mapCareerPathWriteError(err)
			}
			if err := replaceCareerPathMappings(ctx, tx, versionID, write.Payload.CurriculumIDs, write.Payload.CompetencyIDs); err != nil {
				return err
			}
			if _, err := tx.ExecContext(ctx, `UPDATE coop_career_paths SET draft_version_id = ? WHERE career_path_id = ?`, versionID, id); err != nil {
				return err
			}
			continue
		}

		careerPathID := *write.CareerPathID
		var facultyID uint64
		var draftID, publishedID sql.NullInt64
		err := tx.QueryRowContext(ctx, `
			SELECT faculty_id, draft_version_id, published_version_id
			FROM coop_career_paths WHERE career_path_id = ? AND deleted_at IS NULL FOR UPDATE`, careerPathID).Scan(
			&facultyID, &draftID, &publishedID,
		)
		if errors.Is(err, sql.ErrNoRows) {
			return ErrCareerPathNotFound
		}
		if err != nil {
			return err
		}
		if (draftID.Valid && uint64(draftID.Int64) != write.ExpectedVersion) ||
			(!draftID.Valid && write.ExpectedVersion != 0) ||
			(nullIDValue(publishedID) != write.ExpectedPublishedVersion) {
			return ErrCareerPathConflict
		}
		if err := validateCareerPathMappingsTx(ctx, tx, facultyID, write.Payload.CurriculumIDs, write.Payload.CompetencyIDs); err != nil {
			return err
		}

		versionID := uint64(0)
		if draftID.Valid {
			versionID = uint64(draftID.Int64)
			_, err = tx.ExecContext(ctx, `
				UPDATE coop_career_versions SET name_th = ?, name_en = ?, description_th = ?,
					description_en = ?, skills_description_th = ?, skills_description_en = ?,
					source_reference = ?, updated_at = NOW()
				WHERE career_version_id = ? AND status = 'draft'`,
				strings.TrimSpace(write.Payload.NameTH), write.Payload.NameEN,
				write.Payload.DescriptionTH, write.Payload.DescriptionEN,
				write.Payload.SkillsTH, write.Payload.SkillsEN, write.Payload.SourceReference, versionID)
		} else {
			var revision uint64
			if err := tx.QueryRowContext(ctx, `SELECT COALESCE(MAX(revision), 0) + 1 FROM coop_career_versions WHERE career_path_id = ?`, careerPathID).Scan(&revision); err != nil {
				return err
			}
			versionID, err = insertCareerPathVersion(ctx, tx, careerPathID, revision, write.Payload, userID)
			if err == nil {
				_, err = tx.ExecContext(ctx, `UPDATE coop_career_paths SET draft_version_id = ? WHERE career_path_id = ?`, versionID, careerPathID)
			}
		}
		if err != nil {
			return mapCareerPathWriteError(err)
		}
		if err := replaceCareerPathMappings(ctx, tx, versionID, write.Payload.CurriculumIDs, write.Payload.CompetencyIDs); err != nil {
			return err
		}
	}

	if err := tx.Commit(); err != nil {
		return mapCareerPathWriteError(err)
	}
	return nil
}

func (r *CareerPathRepository) getVersion(ctx context.Context, versionID uint64) (*models.CareerPathVersion, error) {
	var version models.CareerPathVersion
	var nameEN, descriptionTH, descriptionEN, skillsTH, skillsEN, sourceReference sql.NullString
	var publishedAt sql.NullTime
	err := r.DB.QueryRowContext(ctx, `
		SELECT career_version_id, revision, status, name_th, name_en,
			description_th, description_en, skills_description_th, skills_description_en,
			source_reference, created_at, updated_at, published_at
		FROM coop_career_versions WHERE career_version_id = ?`, versionID).Scan(
		&version.CareerVersionID, &version.Revision, &version.Status, &version.NameTH,
		&nameEN, &descriptionTH, &descriptionEN, &skillsTH, &skillsEN,
		&sourceReference, &version.CreatedAt, &version.UpdatedAt, &publishedAt,
	)
	if err != nil {
		return nil, err
	}
	version.NameEN = nullStringPointer(nameEN)
	version.DescriptionTH = nullStringPointer(descriptionTH)
	version.DescriptionEN = nullStringPointer(descriptionEN)
	version.SkillsTH = nullStringPointer(skillsTH)
	version.SkillsEN = nullStringPointer(skillsEN)
	version.SourceReference = nullStringPointer(sourceReference)
	if publishedAt.Valid {
		version.PublishedAt = &publishedAt.Time
	}
	version.Curricula, err = r.getVersionOptions(ctx, versionID, true)
	if err != nil {
		return nil, err
	}
	version.Competencies, err = r.getVersionOptions(ctx, versionID, false)
	if err != nil {
		return nil, err
	}
	return &version, nil
}

func (r *CareerPathRepository) getVersionOptions(ctx context.Context, versionID uint64, curricula bool) ([]models.CareerPathOption, error) {
	query := `SELECT competency.competency_id, competency.code, competency.name_th, competency.name_en
		FROM coop_career_competencies mapping
		JOIN comp_competencies competency ON competency.competency_id = mapping.competency_id
		WHERE mapping.career_version_id = ? ORDER BY competency.name_th, competency.competency_id`
	if curricula {
		query = `SELECT curriculum.curriculum_id, curriculum.code, curriculum.name_th, curriculum.name_en
			FROM coop_career_curricula mapping
			JOIN edu_curricula curriculum ON curriculum.curriculum_id = mapping.curriculum_id
			WHERE mapping.career_version_id = ? ORDER BY curriculum.name_th, curriculum.curriculum_id`
	}
	rows, err := r.DB.QueryContext(ctx, query, versionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	options := make([]models.CareerPathOption, 0)
	for rows.Next() {
		var option models.CareerPathOption
		var nameEN sql.NullString
		if err := rows.Scan(&option.ID, &option.Code, &option.NameTH, &nameEN); err != nil {
			return nil, err
		}
		if nameEN.Valid {
			option.NameEN = nameEN.String
		}
		options = append(options, option)
	}
	return options, rows.Err()
}

func (r *CareerPathRepository) CreateDraft(ctx context.Context, payload models.CareerPathDraftPayload, userID uint64) (uint64, error) {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	if err := validateCareerPathMappingsTx(ctx, tx, *payload.FacultyID, payload.CurriculumIDs, payload.CompetencyIDs); err != nil {
		return 0, err
	}
	result, err := tx.ExecContext(ctx, `
		INSERT INTO coop_career_paths (faculty_id, code, status, created_by)
		VALUES (?, ?, 'draft', ?)`, *payload.FacultyID, strings.TrimSpace(payload.Code), userID)
	if err != nil {
		return 0, mapCareerPathWriteError(err)
	}
	careerPathID, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}
	versionID, err := insertCareerPathVersion(ctx, tx, uint64(careerPathID), 1, payload, userID)
	if err != nil {
		return 0, mapCareerPathWriteError(err)
	}
	if err := replaceCareerPathMappings(ctx, tx, versionID, payload.CurriculumIDs, payload.CompetencyIDs); err != nil {
		return 0, err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE coop_career_paths SET draft_version_id = ? WHERE career_path_id = ?`, versionID, careerPathID); err != nil {
		return 0, err
	}
	if err := tx.Commit(); err != nil {
		return 0, mapCareerPathWriteError(err)
	}
	return uint64(careerPathID), nil
}

func (r *CareerPathRepository) UpdateDraft(ctx context.Context, careerPathID, expectedVersionID, userID uint64, payload models.CareerPathDraftPayload) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var facultyID uint64
	var draftVersionID sql.NullInt64
	err = tx.QueryRowContext(ctx, `
		SELECT faculty_id, draft_version_id
		FROM coop_career_paths WHERE career_path_id = ? AND deleted_at IS NULL FOR UPDATE`, careerPathID).Scan(
		&facultyID, &draftVersionID,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrCareerPathNotFound
	}
	if err != nil {
		return err
	}
	if (draftVersionID.Valid && uint64(draftVersionID.Int64) != expectedVersionID) || (!draftVersionID.Valid && expectedVersionID != 0) {
		return ErrCareerPathConflict
	}
	if err := validateCareerPathMappingsTx(ctx, tx, facultyID, payload.CurriculumIDs, payload.CompetencyIDs); err != nil {
		return err
	}

	var versionID uint64
	if draftVersionID.Valid {
		versionID = uint64(draftVersionID.Int64)
		_, err = tx.ExecContext(ctx, `
			UPDATE coop_career_versions SET name_th = ?, name_en = ?, description_th = ?,
				description_en = ?, skills_description_th = ?, skills_description_en = ?,
				source_reference = ?, updated_at = NOW()
			WHERE career_version_id = ? AND status = 'draft'`,
			strings.TrimSpace(payload.NameTH), payload.NameEN, payload.DescriptionTH,
			payload.DescriptionEN, payload.SkillsTH, payload.SkillsEN, payload.SourceReference, versionID)
	} else {
		var nextRevision uint64
		if err := tx.QueryRowContext(ctx, `SELECT COALESCE(MAX(revision), 0) + 1 FROM coop_career_versions WHERE career_path_id = ?`, careerPathID).Scan(&nextRevision); err != nil {
			return err
		}
		versionID, err = insertCareerPathVersion(ctx, tx, careerPathID, nextRevision, payload, userID)
		if err == nil {
			_, err = tx.ExecContext(ctx, `UPDATE coop_career_paths SET draft_version_id = ? WHERE career_path_id = ?`, versionID, careerPathID)
		}
	}
	if err != nil {
		return mapCareerPathWriteError(err)
	}
	if _, err := tx.ExecContext(ctx, `UPDATE coop_career_paths SET code = ?, updated_at = NOW() WHERE career_path_id = ?`, strings.TrimSpace(payload.Code), careerPathID); err != nil {
		return mapCareerPathWriteError(err)
	}
	if err := replaceCareerPathMappings(ctx, tx, versionID, payload.CurriculumIDs, payload.CompetencyIDs); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return mapCareerPathWriteError(err)
	}
	return nil
}

func (r *CareerPathRepository) PublishMany(ctx context.Context, careerPathIDs []uint64, userID uint64) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, careerPathID := range careerPathIDs {
		var draftID, publishedID sql.NullInt64
		if err := tx.QueryRowContext(ctx, `
			SELECT draft_version_id, published_version_id
			FROM coop_career_paths WHERE career_path_id = ? AND deleted_at IS NULL FOR UPDATE`, careerPathID).Scan(&draftID, &publishedID); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return ErrCareerPathNotFound
			}
			return err
		}
		if !draftID.Valid {
			return ErrCareerPathConflict
		}
		if publishedID.Valid {
			if _, err := tx.ExecContext(ctx, `UPDATE coop_career_versions SET status = 'superseded' WHERE career_version_id = ?`, publishedID.Int64); err != nil {
				return err
			}
		}
		if _, err := tx.ExecContext(ctx, `
			UPDATE coop_career_versions
			SET status = 'published', reviewed_by = ?, reviewed_at = NOW(), published_by = ?, published_at = NOW()
			WHERE career_version_id = ? AND status = 'draft'`, userID, userID, draftID.Int64); err != nil {
			return err
		}
		result, err := tx.ExecContext(ctx, `
			UPDATE coop_career_paths
			SET draft_version_id = NULL, published_version_id = ?, status = 'active', updated_at = NOW()
			WHERE career_path_id = ? AND draft_version_id = ?`, draftID.Int64, careerPathID, draftID.Int64)
		if err != nil {
			return err
		}
		if affected, _ := result.RowsAffected(); affected != 1 {
			return ErrCareerPathConflict
		}
	}
	return tx.Commit()
}

func (r *CareerPathRepository) DeactivateMany(ctx context.Context, careerPathIDs []uint64) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, careerPathID := range careerPathIDs {
		result, err := tx.ExecContext(ctx, `
			UPDATE coop_career_paths SET status = 'inactive', updated_at = NOW()
			WHERE career_path_id = ? AND deleted_at IS NULL AND published_version_id IS NOT NULL`, careerPathID)
		if err != nil {
			return err
		}
		if affected, _ := result.RowsAffected(); affected != 1 {
			return ErrCareerPathConflict
		}
	}
	return tx.Commit()
}

func (r *CareerPathRepository) SoftDelete(ctx context.Context, careerPathID uint64) error {
	result, err := r.DB.ExecContext(ctx, `
		UPDATE coop_career_paths SET status = 'inactive', deleted_at = NOW(), updated_at = NOW()
		WHERE career_path_id = ? AND deleted_at IS NULL`, careerPathID)
	if err != nil {
		return err
	}
	if affected, _ := result.RowsAffected(); affected != 1 {
		return ErrCareerPathNotFound
	}
	return nil
}

func insertCareerPathVersion(ctx context.Context, tx *sql.Tx, careerPathID, revision uint64, payload models.CareerPathDraftPayload, userID uint64) (uint64, error) {
	result, err := tx.ExecContext(ctx, `
		INSERT INTO coop_career_versions (
			career_path_id, revision, status, name_th, name_en, description_th,
			description_en, skills_description_th, skills_description_en,
			source_reference, created_by
		) VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?)`,
		careerPathID, revision, strings.TrimSpace(payload.NameTH), payload.NameEN,
		payload.DescriptionTH, payload.DescriptionEN, payload.SkillsTH,
		payload.SkillsEN, payload.SourceReference, userID)
	if err != nil {
		return 0, err
	}
	id, err := result.LastInsertId()
	return uint64(id), err
}

func validateCareerPathMappingsTx(ctx context.Context, tx *sql.Tx, facultyID uint64, curriculumIDs, competencyIDs []uint64) error {
	if len(curriculumIDs) > 0 {
		placeholders, args := uintIDPlaceholders(curriculumIDs)
		args = append([]any{facultyID}, args...)
		var count int
		err := tx.QueryRowContext(ctx, `
			SELECT COUNT(DISTINCT curriculum.curriculum_id)
			FROM edu_curricula curriculum
			JOIN edu_majors major ON major.major_id = curriculum.major_id AND major.deleted_at IS NULL
			JOIN org_departments department ON department.department_id = major.department_id AND department.deleted_at IS NULL
			WHERE department.faculty_id = ? AND curriculum.curriculum_id IN (`+placeholders+`)
				AND curriculum.deleted_at IS NULL`, args...).Scan(&count)
		if err != nil {
			return err
		}
		if count != len(curriculumIDs) {
			return ErrCareerPathInvalidScope
		}
	}
	if len(competencyIDs) > 0 {
		placeholders, args := uintIDPlaceholders(competencyIDs)
		var count int
		err := tx.QueryRowContext(ctx, `
			SELECT COUNT(*) FROM comp_competencies
			WHERE competency_id IN (`+placeholders+`) AND is_active = 1 AND deleted_at IS NULL`, args...).Scan(&count)
		if err != nil {
			return err
		}
		if count != len(competencyIDs) {
			return ErrCareerPathInvalidScope
		}
	}
	return nil
}

func replaceCareerPathMappings(ctx context.Context, tx *sql.Tx, versionID uint64, curriculumIDs, competencyIDs []uint64) error {
	if _, err := tx.ExecContext(ctx, `DELETE FROM coop_career_curricula WHERE career_version_id = ?`, versionID); err != nil {
		return err
	}
	for _, id := range curriculumIDs {
		if _, err := tx.ExecContext(ctx, `INSERT INTO coop_career_curricula (career_version_id, curriculum_id) VALUES (?, ?)`, versionID, id); err != nil {
			return err
		}
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM coop_career_competencies WHERE career_version_id = ?`, versionID); err != nil {
		return err
	}
	for _, id := range competencyIDs {
		if _, err := tx.ExecContext(ctx, `INSERT INTO coop_career_competencies (career_version_id, competency_id) VALUES (?, ?)`, versionID, id); err != nil {
			return err
		}
	}
	return nil
}

func uintIDPlaceholders(ids []uint64) (string, []any) {
	placeholders := make([]string, len(ids))
	args := make([]any, len(ids))
	for index, id := range ids {
		placeholders[index] = "?"
		args[index] = id
	}
	return strings.Join(placeholders, ","), args
}

func mapCareerPathWriteError(err error) error {
	if err == nil {
		return nil
	}
	message := strings.ToLower(err.Error())
	if strings.Contains(message, "duplicate") || strings.Contains(message, "uq_coop_career_path_faculty_code_live") {
		return fmt.Errorf("%w: %v", ErrCareerPathConflict, err)
	}
	return err
}

func nullUint64(value sql.NullInt64) *uint64 {
	if !value.Valid {
		return nil
	}
	result := uint64(value.Int64)
	return &result
}

func nullStringPointer(value sql.NullString) *string {
	if !value.Valid {
		return nil
	}
	result := value.String
	return &result
}
