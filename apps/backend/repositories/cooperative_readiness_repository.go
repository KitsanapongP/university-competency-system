package repositories

import (
	"context"
	"database/sql"
	"errors"
	"reflect"

	"github.com/spw32767/university-competency-system-backend/models"
)

var (
	ErrCooperativeRequirementsEmpty   = errors.New("cooperative requirements must not be empty")
	ErrCooperativeRequirementsChanged = errors.New("cooperative requirements changed during publish")
)

type CooperativeReadinessRepository struct {
	DB *sql.DB
}

func NewCooperativeReadinessRepository(db *sql.DB) *CooperativeReadinessRepository {
	return &CooperativeReadinessRepository{DB: db}
}

func (r *CooperativeReadinessRepository) GetRequirementSets(ctx context.Context, curriculumID uint64) (*models.CooperativeRequirementsResponse, error) {
	response := &models.CooperativeRequirementsResponse{CurriculumID: curriculumID}
	rows, err := r.DB.QueryContext(ctx, `
		SELECT requirement_set_id, curriculum_id, revision, status,
			created_at, updated_at, published_at
		FROM crs_coop_requirement_sets
		WHERE curriculum_id = ? AND status IN ('draft', 'published')
		ORDER BY FIELD(status, 'draft', 'published')`, curriculumID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sets := make([]models.CooperativeRequirementSet, 0, 2)
	for rows.Next() {
		var set models.CooperativeRequirementSet
		var publishedAt sql.NullTime
		if err := rows.Scan(
			&set.RequirementSetID,
			&set.CurriculumID,
			&set.Revision,
			&set.Status,
			&set.CreatedAt,
			&set.UpdatedAt,
			&publishedAt,
		); err != nil {
			return nil, err
		}
		if publishedAt.Valid {
			set.PublishedAt = &publishedAt.Time
		}
		sets = append(sets, set)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for index := range sets {
		requirements, err := r.getRequirements(ctx, sets[index].RequirementSetID)
		if err != nil {
			return nil, err
		}
		sets[index].Requirements = requirements
		set := sets[index]
		switch set.Status {
		case "draft":
			response.Draft = &set
		case "published":
			response.Published = &set
		}
	}
	return response, nil
}

func (r *CooperativeReadinessRepository) getRequirements(ctx context.Context, setID uint64) ([]models.CooperativeRequirement, error) {
	rows, err := r.DB.QueryContext(ctx, `
		SELECT requirement_id, criterion_type, name_th, name_en,
			minimum_value, minimum_grade, category_id, course_id, display_order
		FROM crs_coop_requirements
		WHERE requirement_set_id = ?
		ORDER BY display_order, requirement_id`, setID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	requirements := make([]models.CooperativeRequirement, 0)
	for rows.Next() {
		requirement, err := scanCooperativeRequirement(rows)
		if err != nil {
			return nil, err
		}
		requirements = append(requirements, requirement)
	}
	return requirements, rows.Err()
}

type cooperativeRequirementScanner interface {
	Scan(dest ...any) error
}

func scanCooperativeRequirement(scanner cooperativeRequirementScanner) (models.CooperativeRequirement, error) {
	var requirement models.CooperativeRequirement
	var nameEN, minimumGrade sql.NullString
	var minimumValue sql.NullFloat64
	var categoryID, courseID sql.NullInt64
	err := scanner.Scan(
		&requirement.RequirementID,
		&requirement.CriterionType,
		&requirement.NameTH,
		&nameEN,
		&minimumValue,
		&minimumGrade,
		&categoryID,
		&courseID,
		&requirement.DisplayOrder,
	)
	if err != nil {
		return requirement, err
	}
	if nameEN.Valid {
		requirement.NameEN = &nameEN.String
	}
	if minimumValue.Valid {
		requirement.MinimumValue = &minimumValue.Float64
	}
	if minimumGrade.Valid {
		requirement.MinimumGrade = &minimumGrade.String
	}
	if categoryID.Valid {
		value := uint64(categoryID.Int64)
		requirement.CategoryID = &value
	}
	if courseID.Valid {
		value := uint64(courseID.Int64)
		requirement.CourseID = &value
	}
	return requirement, nil
}

func (r *CooperativeReadinessRepository) ReplaceDraft(ctx context.Context, curriculumID, userID uint64, requirements []models.CooperativeRequirement) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var lockedCurriculumID uint64
	if err := tx.QueryRowContext(ctx, `
		SELECT curriculum_id FROM edu_curricula
		WHERE curriculum_id = ? AND deleted_at IS NULL FOR UPDATE`, curriculumID,
	).Scan(&lockedCurriculumID); err != nil {
		return err
	}

	var setID, revision uint64
	err = tx.QueryRowContext(ctx, `
		SELECT requirement_set_id, revision
		FROM crs_coop_requirement_sets
		WHERE curriculum_id = ? AND status = 'draft' FOR UPDATE`, curriculumID,
	).Scan(&setID, &revision)
	if errors.Is(err, sql.ErrNoRows) {
		if err := tx.QueryRowContext(ctx, `
			SELECT COALESCE(MAX(revision), 0) + 1
			FROM crs_coop_requirement_sets WHERE curriculum_id = ?`, curriculumID,
		).Scan(&revision); err != nil {
			return err
		}
		result, err := tx.ExecContext(ctx, `
			INSERT INTO crs_coop_requirement_sets (curriculum_id, revision, status, created_by)
			VALUES (?, ?, 'draft', NULLIF(?, 0))`, curriculumID, revision, userID)
		if err != nil {
			return err
		}
		insertedID, err := result.LastInsertId()
		if err != nil {
			return err
		}
		setID = uint64(insertedID)
	} else if err != nil {
		return err
	}

	if _, err := tx.ExecContext(ctx, `DELETE FROM crs_coop_requirements WHERE requirement_set_id = ?`, setID); err != nil {
		return err
	}
	for index, requirement := range requirements {
		if requirement.CriterionType == "" {
			continue
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO crs_coop_requirements (
				requirement_set_id, criterion_type, name_th, name_en,
				minimum_value, minimum_grade, category_id, course_id, display_order
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			setID,
			requirement.CriterionType,
			requirement.NameTH,
			requirement.NameEN,
			requirement.MinimumValue,
			requirement.MinimumGrade,
			requirement.CategoryID,
			requirement.CourseID,
			index,
		); err != nil {
			return err
		}
	}
	_, err = tx.ExecContext(ctx, `
		UPDATE crs_coop_requirement_sets SET updated_at = CURRENT_TIMESTAMP
		WHERE requirement_set_id = ?`, setID)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (r *CooperativeReadinessRepository) PublishDraft(ctx context.Context, curriculumID, userID uint64, expected []models.CooperativeRequirement) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var lockedCurriculumID uint64
	if err := tx.QueryRowContext(ctx, `
		SELECT curriculum_id FROM edu_curricula
		WHERE curriculum_id = ? AND deleted_at IS NULL FOR UPDATE`, curriculumID,
	).Scan(&lockedCurriculumID); err != nil {
		return err
	}

	var draftID uint64
	if err := tx.QueryRowContext(ctx, `
		SELECT requirement_set_id FROM crs_coop_requirement_sets
		WHERE curriculum_id = ? AND status = 'draft' FOR UPDATE`, curriculumID,
	).Scan(&draftID); err != nil {
		return err
	}

	actual, err := getCooperativeRequirementsTx(ctx, tx, draftID)
	if err != nil {
		return err
	}
	if !reflect.DeepEqual(actual, expected) {
		return ErrCooperativeRequirementsChanged
	}
	if len(actual) == 0 {
		return ErrCooperativeRequirementsEmpty
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE crs_coop_requirement_sets
		SET status = 'archived'
		WHERE curriculum_id = ? AND status = 'published'`, curriculumID); err != nil {
		return err
	}
	result, err := tx.ExecContext(ctx, `
		UPDATE crs_coop_requirement_sets
		SET status = 'published', published_by = NULLIF(?, 0), published_at = CURRENT_TIMESTAMP
		WHERE requirement_set_id = ? AND status = 'draft'`, userID, draftID)
	if err != nil {
		return err
	}
	changed, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if changed != 1 {
		return ErrCooperativeRequirementsChanged
	}
	return tx.Commit()
}

func getCooperativeRequirementsTx(ctx context.Context, tx *sql.Tx, setID uint64) ([]models.CooperativeRequirement, error) {
	rows, err := tx.QueryContext(ctx, `
		SELECT requirement_id, criterion_type, name_th, name_en,
			minimum_value, minimum_grade, category_id, course_id, display_order
		FROM crs_coop_requirements
		WHERE requirement_set_id = ?
		ORDER BY display_order, requirement_id FOR UPDATE`, setID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.CooperativeRequirement, 0)
	for rows.Next() {
		item, err := scanCooperativeRequirement(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
