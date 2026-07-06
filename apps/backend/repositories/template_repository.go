package repositories

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/spw32767/university-competency-system-backend/models"
)

type TemplateRepository struct {
	DB *sql.DB
}

func NewTemplateRepository(db *sql.DB) *TemplateRepository {
	return &TemplateRepository{DB: db}
}

func (r *TemplateRepository) GetTemplatesByFaculty(ctx context.Context, facultyID uint64) ([]models.Template, error) {
	query := `
		SELECT 
			t.template_id, t.faculty_id, COALESCE(cct.curriculum_id, 0),
			COALESCE(c.name_th, 'ไม่ระบุหลักสูตร'), c.name_en, COALESCE(c.code, ''),
			t.code, t.name, t.description, COALESCE(cct.cohort_year_be, t.version_year_be, 0),
			t.is_active, t.created_at, t.updated_at,
			(SELECT COUNT(DISTINCT competency_id) FROM comp_template_items cti WHERE cti.template_id = t.template_id AND cti.deleted_at IS NULL),
			(SELECT COUNT(DISTINCT course_id) FROM comp_template_items cti WHERE cti.template_id = t.template_id AND cti.course_id IS NOT NULL AND cti.deleted_at IS NULL)
		FROM comp_templates t
		LEFT JOIN curri_curriculum_templates cct ON t.template_id = cct.template_id AND cct.deleted_at IS NULL
		LEFT JOIN edu_curricula c ON c.curriculum_id = cct.curriculum_id AND c.deleted_at IS NULL
		WHERE t.faculty_id = ? AND t.deleted_at IS NULL
		ORDER BY COALESCE(cct.cohort_year_be, t.version_year_be, 0) DESC, t.template_id DESC
	`

	rows, err := r.DB.QueryContext(ctx, query, facultyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var templates []models.Template
	for rows.Next() {
		var t models.Template
		var curNameEN sql.NullString
		var desc sql.NullString
		var isActive bool

		err := rows.Scan(
			&t.TemplateID, &t.FacultyID, &t.CurriculumID,
			&t.CurriculumNameTH, &curNameEN, &t.CurriculumCode,
			&t.Code, &t.Name, &desc, &t.CohortYearBE,
			&isActive, &t.CreatedAt, &t.UpdatedAt,
			&t.CompetencyCount, &t.MappedCourseCount,
		)
		if err != nil {
			return nil, err
		}

		if curNameEN.Valid {
			t.CurriculumNameEN = &curNameEN.String
		}
		if desc.Valid {
			t.Description = &desc.String
		}
		t.IsActive = isActive
		if isActive {
			t.Status = "Active"
		} else {
			t.Status = "Inactive"
		}

		templates = append(templates, t)
	}

	return templates, rows.Err()
}

func (r *TemplateRepository) GetTemplateByID(ctx context.Context, templateID uint64) (*models.Template, error) {
	query := `
		SELECT 
			t.template_id, t.faculty_id, COALESCE(cct.curriculum_id, 0),
			COALESCE(c.name_th, 'ไม่ระบุหลักสูตร'), c.name_en, COALESCE(c.code, ''),
			t.code, t.name, t.description, COALESCE(cct.cohort_year_be, t.version_year_be, 0),
			t.is_active, t.created_at, t.updated_at,
			(SELECT COUNT(DISTINCT competency_id) FROM comp_template_items cti WHERE cti.template_id = t.template_id AND cti.deleted_at IS NULL),
			(SELECT COUNT(DISTINCT course_id) FROM comp_template_items cti WHERE cti.template_id = t.template_id AND cti.course_id IS NOT NULL AND cti.deleted_at IS NULL)
		FROM comp_templates t
		LEFT JOIN curri_curriculum_templates cct ON t.template_id = cct.template_id AND cct.deleted_at IS NULL
		LEFT JOIN edu_curricula c ON c.curriculum_id = cct.curriculum_id AND c.deleted_at IS NULL
		WHERE t.template_id = ? AND t.deleted_at IS NULL
	`

	var t models.Template
	var curNameEN sql.NullString
	var desc sql.NullString
	var isActive bool

	err := r.DB.QueryRowContext(ctx, query, templateID).Scan(
		&t.TemplateID, &t.FacultyID, &t.CurriculumID,
		&t.CurriculumNameTH, &curNameEN, &t.CurriculumCode,
		&t.Code, &t.Name, &desc, &t.CohortYearBE,
		&isActive, &t.CreatedAt, &t.UpdatedAt,
		&t.CompetencyCount, &t.MappedCourseCount,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	if curNameEN.Valid {
		t.CurriculumNameEN = &curNameEN.String
	}
	if desc.Valid {
		t.Description = &desc.String
	}
	t.IsActive = isActive
	if isActive {
		t.Status = "Active"
	} else {
		t.Status = "Inactive"
	}

	return &t, nil
}

func (r *TemplateRepository) CreateTemplate(ctx context.Context, facultyID uint64, userID uint64, req models.CreateTemplateRequest) (*models.Template, error) {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	now := time.Now()
	code := fmt.Sprintf("tpl_%d_%d_%d", facultyID, req.CohortYearBE, now.Unix())

	// 1. Insert comp_templates
	res, err := tx.ExecContext(ctx, `
		INSERT INTO comp_templates (faculty_id, code, name, version_year_be, is_active, created_by, created_at, updated_at)
		VALUES (?, ?, ?, ?, 1, ?, ?, ?)
	`, facultyID, code, req.Name, req.CohortYearBE, userID, now, now)
	if err != nil {
		return nil, fmt.Errorf("insert comp_templates failed: %w", err)
	}

	templateID, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}

	// 2. Insert curri_curriculum_templates if CurriculumID > 0
	if req.CurriculumID > 0 {
		_, err = tx.ExecContext(ctx, `
			INSERT INTO curri_curriculum_templates (curriculum_id, template_id, cohort_year_be, is_active, created_by, created_at, updated_at)
			VALUES (?, ?, ?, 1, ?, ?, ?)
		`, req.CurriculumID, templateID, req.CohortYearBE, userID, now, now)
		if err != nil {
			return nil, fmt.Errorf("insert curri_curriculum_templates failed: %w", err)
		}
	}

	// 3. Insert new competencies if any
	compIDs := make([]uint64, len(req.CompetencyIDs))
	copy(compIDs, req.CompetencyIDs)

	for i, nc := range req.NewCompetencies {
		cCode := fmt.Sprintf("comp_custom_%d_%d", templateID, i+1)
		cRes, err := tx.ExecContext(ctx, `
			INSERT INTO comp_competencies (code, name_th, is_active, created_at, updated_at)
			VALUES (?, ?, 1, ?, ?)
		`, cCode, nc.Name, now, now)
		if err != nil {
			return nil, fmt.Errorf("insert custom competency failed: %w", err)
		}
		cID, err := cRes.LastInsertId()
		if err != nil {
			return nil, err
		}
		compIDs = append(compIDs, uint64(cID))
	}

	// 4. Insert initial template items (course_id IS NULL)
	for idx, cid := range compIDs {
		_, err = tx.ExecContext(ctx, `
			INSERT INTO comp_template_items (template_id, competency_id, course_id, display_order, is_active, created_at, updated_at)
			VALUES (?, ?, NULL, ?, 1, ?, ?)
		`, templateID, cid, idx+1, now, now)
		if err != nil {
			return nil, fmt.Errorf("insert initial comp_template_items failed: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return r.GetTemplateByID(ctx, uint64(templateID))
}

func (r *TemplateRepository) UpdateTemplateStatus(ctx context.Context, templateID uint64, isActive bool) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	activeInt := 0
	if isActive {
		activeInt = 1
	}

	_, err = tx.ExecContext(ctx, `UPDATE comp_templates SET is_active = ?, updated_at = NOW() WHERE template_id = ?`, activeInt, templateID)
	if err != nil {
		return err
	}

	_, err = tx.ExecContext(ctx, `UPDATE curri_curriculum_templates SET is_active = ?, updated_at = NOW() WHERE template_id = ?`, activeInt, templateID)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (r *TemplateRepository) DeleteTemplate(ctx context.Context, templateID uint64) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	now := time.Now()
	_, err = tx.ExecContext(ctx, `UPDATE comp_templates SET deleted_at = ?, updated_at = ? WHERE template_id = ?`, now, now, templateID)
	if err != nil {
		return err
	}

	_, err = tx.ExecContext(ctx, `UPDATE curri_curriculum_templates SET deleted_at = ?, updated_at = ? WHERE template_id = ?`, now, now, templateID)
	if err != nil {
		return err
	}

	_, err = tx.ExecContext(ctx, `UPDATE comp_template_items SET deleted_at = ?, updated_at = ? WHERE template_id = ?`, now, now, templateID)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (r *TemplateRepository) GetTemplateItems(ctx context.Context, templateID uint64) ([]models.TemplateItem, error) {
	query := `
		SELECT 
			cti.template_item_id, cti.template_id, cti.course_id,
			COALESCE(crs.code, ''), COALESCE(crs.name_th, ''), crs.name_en,
			cti.competency_id, COALESCE(c.code, ''), COALESCE(c.name_th, ''),
			cti.weight, cti.display_order, cti.is_active
		FROM comp_template_items cti
		JOIN comp_competencies c ON cti.competency_id = c.competency_id AND c.deleted_at IS NULL
		LEFT JOIN crs_courses crs ON cti.course_id = crs.course_id AND crs.deleted_at IS NULL
		WHERE cti.template_id = ? AND cti.deleted_at IS NULL
		ORDER BY cti.display_order ASC, cti.template_item_id ASC
	`

	rows, err := r.DB.QueryContext(ctx, query, templateID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.TemplateItem
	for rows.Next() {
		var item models.TemplateItem
		var courseID sql.NullInt64
		var courseCode, courseNameTH string
		var courseNameEN sql.NullString
		var weight sql.NullFloat64

		err := rows.Scan(
			&item.TemplateItemID, &item.TemplateID, &courseID,
			&courseCode, &courseNameTH, &courseNameEN,
			&item.CompetencyID, &item.CompetencyCode, &item.CompetencyName,
			&weight, &item.DisplayOrder, &item.IsActive,
		)
		if err != nil {
			return nil, err
		}

		if courseID.Valid {
			cID := uint64(courseID.Int64)
			item.CourseID = &cID
			item.CourseCode = courseCode
			item.CourseNameTH = courseNameTH
			if courseNameEN.Valid {
				item.CourseNameEN = &courseNameEN.String
			}
		}
		if weight.Valid {
			w := weight.Float64
			item.Weight = &w
		}

		items = append(items, item)
	}

	return items, rows.Err()
}

func (r *TemplateRepository) SaveTemplateItems(ctx context.Context, templateID uint64, items []models.TemplateItemInput) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Soft delete existing course mappings for this template
	now := time.Now()
	_, err = tx.ExecContext(ctx, `
		UPDATE comp_template_items 
		SET deleted_at = ?, updated_at = ? 
		WHERE template_id = ? AND course_id IS NOT NULL AND deleted_at IS NULL
	`, now, now, templateID)
	if err != nil {
		return fmt.Errorf("clear old course items failed: %w", err)
	}

	// Insert new mappings
	for idx, item := range items {
		_, err = tx.ExecContext(ctx, `
			INSERT INTO comp_template_items (template_id, competency_id, course_id, weight, display_order, is_active, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, 1, ?, ?)
		`, templateID, item.CompetencyID, item.CourseID, item.Weight, idx+1, now, now)
		if err != nil {
			return fmt.Errorf("insert template item failed for course %d comp %d: %w", item.CourseID, item.CompetencyID, err)
		}
	}

	return tx.Commit()
}
