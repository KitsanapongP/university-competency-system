package repositories

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/spw32767/university-competency-system-backend/models"
)

type CurriculumRepository struct {
	DB *sql.DB
}

func NewCurriculumRepository(db *sql.DB) *CurriculumRepository {
	return &CurriculumRepository{DB: db}
}

func scanCurriculum(rows *sql.Rows) (*models.Curriculum, error) {
	var c models.Curriculum
	var nameEn sql.NullString
	var deletedAt sql.NullTime

	if err := rows.Scan(
		&c.CurriculumID,
		&c.MajorID,
		&c.CurriculumNameTH,
		&nameEn,
		&c.CurriculumCode,
		&c.EffectiveYearBE,
		&c.Status,
		&c.IsActive,
		&c.TotalCredits,
		&c.CreatedAt,
		&c.UpdatedAt,
		&deletedAt,
	); err != nil {
		return nil, err
	}

	if nameEn.Valid {
		c.CurriculumNameEN = &nameEn.String
	}
	if deletedAt.Valid {
		c.DeletedAt = &deletedAt.Time
	}

	return &c, nil
}

// ดึงหลักสูตรที่มีการใช้งาน (Status='active')
func (r *CurriculumRepository) GetActiveCurriculums(ctx context.Context) ([]*models.Curriculum, error) {
	var curriculums []*models.Curriculum

	query := `
        SELECT curriculum_id, major_id, name_th, name_en, code, effective_year_be, status, is_active, total_credits, created_at, updated_at, deleted_at
        FROM edu_curricula
        WHERE status = 'active' AND is_active = 1 AND deleted_at IS NULL
        ORDER BY effective_year_be DESC, curriculum_id DESC
    `

	rows, err := r.DB.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		c, err := scanCurriculum(rows)
		if err != nil {
			return nil, err
		}
		curriculums = append(curriculums, c)
	}
	return curriculums, nil
}

func (r *CurriculumRepository) GetCurriculumByYear(ctx context.Context, year uint64) ([]*models.Curriculum, error) {
	var curriculums []*models.Curriculum

	query := `
        SELECT curriculum_id, major_id, name_th, name_en, code, effective_year_be, status, is_active, total_credits, created_at, updated_at, deleted_at
        FROM edu_curricula
        WHERE effective_year_be = ? AND status = 'active' AND is_active = 1 AND deleted_at IS NULL
        ORDER BY curriculum_id DESC
    `

	rows, err := r.DB.QueryContext(ctx, query, year)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		c, err := scanCurriculum(rows)
		if err != nil {
			return nil, err
		}
		curriculums = append(curriculums, c)
	}
	return curriculums, nil
}

func (r *CurriculumRepository) GetCurriculumByID(ctx context.Context, id uint64) (*models.Curriculum, error) {
	query := `
        SELECT curriculum_id, major_id, name_th, name_en, code, effective_year_be, status, is_active, total_credits, created_at, updated_at, deleted_at
        FROM edu_curricula
        WHERE curriculum_id = ? AND deleted_at IS NULL
    `
	rows, err := r.DB.QueryContext(ctx, query, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	if rows.Next() {
		return scanCurriculum(rows)
	}
	return nil, sql.ErrNoRows
}

// CreateCurriculumTx สร้าง Curriculum, Categories, และ Courses ภายใต้ Transaction เดียว
func (r *CurriculumRepository) CreateCurriculumTx(ctx context.Context, payload models.CreateCurriculumPayload) (*models.Curriculum, error) {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	// Defer a rollback in case anything fails. If tx.Commit() is called first, Rollback() does nothing.
	defer tx.Rollback()

	// 1. Insert Curriculum
	queryCurriculum := `
		INSERT INTO edu_curricula (major_id, code, name_th, name_en, effective_year_be, total_credits, status, is_active)
		VALUES (?, ?, ?, ?, ?, ?, 'active', 1)
	`
	res, err := tx.ExecContext(ctx, queryCurriculum, 
		payload.MajorID, payload.CurriculumCode, payload.CurriculumNameTH, payload.CurriculumNameEN, payload.EffectiveYearBE, payload.TotalCredits,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to insert curriculum: %v", err)
	}
	
	curriculumID, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}

	// 2. Insert Categories and Courses
	queryCategory := `
		INSERT INTO crs_course_categories (curriculum_id, code, name_th, name_en, required_credits, display_order, is_active)
		VALUES (?, ?, ?, ?, ?, ?, 1)
	`
	queryCourse := `
		INSERT INTO crs_curriculum_courses (category_id, course_id, is_required, display_order, is_active)
		VALUES (?, ?, ?, ?, 1)
	`

	for _, catPayload := range payload.Categories {
		catRes, err := tx.ExecContext(ctx, queryCategory,
			curriculumID, catPayload.Code, catPayload.NameTH, catPayload.NameEN, catPayload.RequiredCredits, catPayload.DisplayOrder,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to insert category %s: %v", catPayload.NameTH, err)
		}
		
		categoryID, err := catRes.LastInsertId()
		if err != nil {
			return nil, err
		}

		for _, coursePayload := range catPayload.Courses {
			_, err = tx.ExecContext(ctx, queryCourse,
				categoryID, coursePayload.CourseID, coursePayload.IsRequired, coursePayload.DisplayOrder,
			)
			if err != nil {
				return nil, fmt.Errorf("failed to insert course %d into category %d: %v", coursePayload.CourseID, categoryID, err)
			}
		}
	}

	// Commit Transaction
	if err = tx.Commit(); err != nil {
		return nil, err
	}

	// Return the newly created curriculum
	return r.GetCurriculumByID(ctx, uint64(curriculumID))
}
