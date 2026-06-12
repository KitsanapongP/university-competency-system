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

type MajorScope struct {
	FacultyID   uint64
	DegreeLevel string
}

type CreateCurriculumOptions struct {
	FacultyID   uint64
	CreatedBy   uint64
	DegreeLevel string
}

type rowScanner interface {
	Scan(dest ...any) error
}

const curriculumTotalsJoin = `
	LEFT JOIN (
		SELECT curriculum_id, COALESCE(SUM(course_credits), 0) AS total_credits
		FROM (
			SELECT cat.curriculum_id, cc.course_id, MAX(cc.credits) AS course_credits
			FROM crs_curriculum_courses cc
			JOIN crs_course_categories cat ON cat.category_id = cc.category_id
			JOIN crs_courses course ON course.course_id = cc.course_id
			WHERE cc.is_active = 1
				AND cc.deleted_at IS NULL
				AND course.deleted_at IS NULL
			GROUP BY cat.curriculum_id, cc.course_id
		) distinct_courses
		GROUP BY curriculum_id
	) totals ON totals.curriculum_id = c.curriculum_id
`

func NewCurriculumRepository(db *sql.DB) *CurriculumRepository {
	return &CurriculumRepository{DB: db}
}

func scanCurriculum(scanner rowScanner) (*models.Curriculum, error) {
	var c models.Curriculum
	var nameEn sql.NullString
	var deletedAt sql.NullTime

	if err := scanner.Scan(
		&c.CurriculumID,
		&c.MajorID,
		&c.CurriculumNameTH,
		&nameEn,
		&c.CurriculumCode,
		&c.EffectiveYearBE,
		&c.Status,
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
	c.IsActive = c.Status == "active"

	return &c, nil
}

func (r *CurriculumRepository) GetActiveCurriculums(ctx context.Context) ([]*models.Curriculum, error) {
	query := `
		SELECT c.curriculum_id, c.major_id, c.name_th, c.name_en, c.code, c.effective_year_be, c.status, COALESCE(totals.total_credits, 0), c.created_at, c.updated_at, c.deleted_at
		FROM edu_curricula c
	` + curriculumTotalsJoin + `
		WHERE c.status = 'active' AND c.deleted_at IS NULL
		ORDER BY c.effective_year_be DESC, c.curriculum_id DESC
	`

	rows, err := r.DB.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var curriculums []*models.Curriculum
	for rows.Next() {
		c, err := scanCurriculum(rows)
		if err != nil {
			return nil, err
		}
		curriculums = append(curriculums, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return curriculums, nil
}

func (r *CurriculumRepository) GetActiveCurriculumsByFaculty(ctx context.Context, facultyID uint64) ([]*models.Curriculum, error) {
	query := `
		SELECT c.curriculum_id, c.major_id, c.name_th, c.name_en, c.code, c.effective_year_be, c.status, COALESCE(totals.total_credits, 0), c.created_at, c.updated_at, c.deleted_at
		FROM edu_curricula c
	` + curriculumTotalsJoin + `
		JOIN edu_majors m ON m.major_id = c.major_id
		JOIN org_departments d ON d.department_id = m.department_id
		WHERE c.status = 'active'
			AND c.deleted_at IS NULL
			AND m.deleted_at IS NULL
			AND d.deleted_at IS NULL
			AND d.faculty_id = ?
		ORDER BY c.effective_year_be DESC, c.curriculum_id DESC
	`

	rows, err := r.DB.QueryContext(ctx, query, facultyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var curriculums []*models.Curriculum
	for rows.Next() {
		c, err := scanCurriculum(rows)
		if err != nil {
			return nil, err
		}
		curriculums = append(curriculums, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return curriculums, nil
}

func (r *CurriculumRepository) GetCurriculumByYear(ctx context.Context, year uint64) ([]*models.Curriculum, error) {
	query := `
		SELECT c.curriculum_id, c.major_id, c.name_th, c.name_en, c.code, c.effective_year_be, c.status, COALESCE(totals.total_credits, 0), c.created_at, c.updated_at, c.deleted_at
		FROM edu_curricula c
	` + curriculumTotalsJoin + `
		WHERE c.effective_year_be = ? AND c.status = 'active' AND c.deleted_at IS NULL
		ORDER BY c.curriculum_id DESC
	`

	rows, err := r.DB.QueryContext(ctx, query, year)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var curriculums []*models.Curriculum
	for rows.Next() {
		c, err := scanCurriculum(rows)
		if err != nil {
			return nil, err
		}
		curriculums = append(curriculums, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return curriculums, nil
}

func (r *CurriculumRepository) GetCurriculumByID(ctx context.Context, id uint64) (*models.Curriculum, error) {
	query := `
		SELECT c.curriculum_id, c.major_id, c.name_th, c.name_en, c.code, c.effective_year_be, c.status, COALESCE(totals.total_credits, 0), c.created_at, c.updated_at, c.deleted_at
		FROM edu_curricula c
	` + curriculumTotalsJoin + `
		WHERE c.curriculum_id = ? AND c.deleted_at IS NULL
	`

	return scanCurriculum(r.DB.QueryRowContext(ctx, query, id))
}

func (r *CurriculumRepository) GetMajorScope(ctx context.Context, majorID uint64) (MajorScope, error) {
	query := `
		SELECT d.faculty_id, COALESCE(m.degree_level, 'bachelor')
		FROM edu_majors m
		JOIN org_departments d ON d.department_id = m.department_id
		WHERE m.major_id = ?
			AND m.deleted_at IS NULL
			AND d.deleted_at IS NULL
	`

	var scope MajorScope
	err := r.DB.QueryRowContext(ctx, query, majorID).Scan(&scope.FacultyID, &scope.DegreeLevel)
	if err != nil {
		return MajorScope{}, err
	}

	return scope, nil
}

func (r *CurriculumRepository) CreateCurriculumTx(ctx context.Context, payload models.CreateCurriculumPayload, opts CreateCurriculumOptions) (*models.Curriculum, error) {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	res, err := tx.ExecContext(ctx, `
		INSERT INTO edu_curricula (major_id, code, name_th, name_en, effective_year_be, status)
		VALUES (?, ?, ?, ?, ?, 'active')
	`, payload.MajorID, payload.CurriculumCode, payload.CurriculumNameTH, payload.CurriculumNameEN, payload.EffectiveYearBE)
	if err != nil {
		return nil, fmt.Errorf("insert curriculum: %w", err)
	}

	curriculumID, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}

	for _, category := range payload.Categories {
		if err := r.insertCategory(ctx, tx, uint64(curriculumID), nil, category, opts); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return r.GetCurriculumByID(ctx, uint64(curriculumID))
}

func (r *CurriculumRepository) insertCategory(ctx context.Context, tx *sql.Tx, curriculumID uint64, parentID *uint64, payload models.CreateCategoryPayload, opts CreateCurriculumOptions) error {
	res, err := tx.ExecContext(ctx, `
		INSERT INTO crs_course_categories (curriculum_id, parent_id, code, name_th, name_en, required_credits, display_order, is_active)
		VALUES (?, ?, ?, ?, ?, ?, ?, 1)
	`, curriculumID, parentID, payload.Code, payload.NameTH, payload.NameEN, payload.RequiredCredits, payload.DisplayOrder)
	if err != nil {
		return fmt.Errorf("insert category %q: %w", payload.NameTH, err)
	}

	categoryID, err := res.LastInsertId()
	if err != nil {
		return err
	}

	for _, course := range payload.Courses {
		courseID, err := r.findOrCreateCourse(ctx, tx, course, opts)
		if err != nil {
			return err
		}

		_, err = tx.ExecContext(ctx, `
			INSERT INTO crs_curriculum_courses (category_id, course_id, credits, is_required, display_order, is_active)
			VALUES (?, ?, ?, ?, ?, 1)
		`, categoryID, courseID, course.Credits, course.IsRequired, course.DisplayOrder)
		if err != nil {
			return fmt.Errorf("link course %q to category %d: %w", course.Code, categoryID, err)
		}
	}

	newParentID := uint64(categoryID)
	for _, child := range payload.Children {
		if err := r.insertCategory(ctx, tx, curriculumID, &newParentID, child, opts); err != nil {
			return err
		}
	}

	return nil
}

func (r *CurriculumRepository) findOrCreateCourse(ctx context.Context, tx *sql.Tx, payload models.CreateCourseInCatPayload, opts CreateCurriculumOptions) (uint64, error) {
	degreeLevel := opts.DegreeLevel
	if degreeLevel == "" {
		degreeLevel = "bachelor"
	}

	var existingCourseID uint64
	err := tx.QueryRowContext(ctx, `
		SELECT course_id
		FROM crs_courses
		WHERE faculty_id = ?
			AND code = ?
			AND degree_level = ?
			AND deleted_at IS NULL
		LIMIT 1
	`, opts.FacultyID, payload.Code, degreeLevel).Scan(&existingCourseID)
	if err == nil {
		return existingCourseID, nil
	}
	if err != sql.ErrNoRows {
		return 0, err
	}

	var createdBy sql.NullInt64
	if opts.CreatedBy > 0 {
		createdBy = sql.NullInt64{Int64: int64(opts.CreatedBy), Valid: true}
	}

	res, err := tx.ExecContext(ctx, `
		INSERT INTO crs_courses (faculty_id, degree_level, code, name_th, name_en, credits, description, created_by, status, is_active)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1)
	`, opts.FacultyID, degreeLevel, payload.Code, payload.NameTH, payload.NameEN, payload.Credits, payload.Description, createdBy)
	if err != nil {
		return 0, fmt.Errorf("insert course %q: %w", payload.Code, err)
	}

	courseID, err := res.LastInsertId()
	if err != nil {
		return 0, err
	}

	return uint64(courseID), nil
}

func (r *CurriculumRepository) CalculateCurriculumTotalCredits(ctx context.Context, curriculumID uint64) (int, error) {
	query := `
		SELECT COALESCE(SUM(course_credits), 0)
		FROM (
			SELECT cc.course_id, MAX(cc.credits) AS course_credits
			FROM crs_curriculum_courses cc
			JOIN crs_course_categories cat ON cat.category_id = cc.category_id
			JOIN crs_courses course ON course.course_id = cc.course_id
			WHERE cat.curriculum_id = ?
				AND cc.is_active = 1
				AND cc.deleted_at IS NULL
				AND course.deleted_at IS NULL
			GROUP BY cc.course_id
		) distinct_courses
	`

	var totalCredits int
	if err := r.DB.QueryRowContext(ctx, query, curriculumID).Scan(&totalCredits); err != nil {
		return 0, err
	}

	return totalCredits, nil
}
