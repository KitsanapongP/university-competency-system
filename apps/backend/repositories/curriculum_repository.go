package repositories

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/spw32767/university-competency-system-backend/models"
)

type CurriculumRepository struct {
	DB *sql.DB
}

type MajorScope struct {
	FacultyID   uint64
	DegreeLevel string
	FacultyCode string
	MajorCode   string
	IsActive    bool
}

type CreateCurriculumOptions struct {
	FacultyID   uint64
	CreatedBy   uint64
	DegreeLevel string
}

type CurriculumNameDuplicate struct {
	CurriculumID    uint64
	MajorID         uint64
	MajorNameTH     string
	NameTH          string
	EffectiveYearBE uint64
}

type duplicateCategoryRow struct {
	CategoryID      uint64
	ParentID        *uint64
	Code            *string
	NameTH          string
	NameEN          *string
	RequiredCredits int
	DisplayOrder    int
}

type duplicateCourseRow struct {
	CurriculumCourseID uint64
	CategoryID         uint64
	CourseID           uint64
	Code               string
	NameTH             string
	NameEN             *string
	Credits            int
	Description        *string
	IsRequired         bool
	IsLocked           bool
	DisplayOrder       int
}

type rowScanner interface {
	Scan(dest ...any) error
}

const curriculumStatsJoin = `
	LEFT JOIN (
		SELECT curriculum_id, COALESCE(SUM(course_credits), 0) AS total_credits, COUNT(*) AS course_count
		FROM (
			SELECT cat.curriculum_id, cc.course_id, MAX(course.credits) AS course_credits
			FROM crs_curriculum_courses cc
			JOIN crs_course_categories cat ON cat.category_id = cc.category_id
			JOIN crs_courses course ON course.course_id = cc.course_id
			WHERE cc.is_active = 1
				AND cc.deleted_at IS NULL
				AND cat.deleted_at IS NULL
				AND course.deleted_at IS NULL
				AND course.curriculum_id = cat.curriculum_id
			GROUP BY cat.curriculum_id, cc.course_id
		) distinct_courses
		GROUP BY curriculum_id
	) course_stats ON course_stats.curriculum_id = c.curriculum_id
	LEFT JOIN (
		SELECT curriculum_id, COUNT(*) AS category_count
		FROM crs_course_categories
		WHERE deleted_at IS NULL
		GROUP BY curriculum_id
	) category_stats ON category_stats.curriculum_id = c.curriculum_id
	LEFT JOIN (
		SELECT
			tpl.curriculum_id,
			COUNT(DISTINCT tpl.template_id) AS template_count,
			COUNT(DISTINCT CASE WHEN tpl.is_active = 1 THEN tpl.template_id END) AS active_template_count
		FROM comp_templates tpl
		WHERE tpl.deleted_at IS NULL
			AND tpl.curriculum_id IS NOT NULL
		GROUP BY tpl.curriculum_id
	) template_stats ON template_stats.curriculum_id = c.curriculum_id
`

func NewCurriculumRepository(db *sql.DB) *CurriculumRepository {
	return &CurriculumRepository{DB: db}
}

func scanCurriculum(scanner rowScanner) (*models.Curriculum, error) {
	var c models.Curriculum
	var majorNameEn sql.NullString
	var nameEn sql.NullString
	var deletedAt sql.NullTime

	if err := scanner.Scan(
		&c.CurriculumID,
		&c.MajorID,
		&c.FacultyID,
		&c.MajorNameTH,
		&majorNameEn,
		&c.CurriculumNameTH,
		&nameEn,
		&c.CurriculumCode,
		&c.EffectiveYearBE,
		&c.Status,
		&c.TotalCredits,
		&c.CourseCount,
		&c.CategoryCount,
		&c.TemplateCount,
		&c.ActiveTemplateCount,
		&c.CreatedAt,
		&c.UpdatedAt,
		&deletedAt,
	); err != nil {
		return nil, err
	}

	if nameEn.Valid {
		c.CurriculumNameEN = &nameEn.String
	}
	if majorNameEn.Valid {
		c.MajorNameEN = &majorNameEn.String
	}
	if deletedAt.Valid {
		c.DeletedAt = &deletedAt.Time
	}
	c.IsActive = c.Status == "active"

	return &c, nil
}

func (r *CurriculumRepository) GetCurriculums(ctx context.Context) ([]*models.Curriculum, error) {
	query := `
		SELECT c.curriculum_id, c.major_id, d.faculty_id, m.name_th, m.name_en, c.name_th, c.name_en, c.code, c.effective_year_be, c.status,
			COALESCE(course_stats.total_credits, 0),
			COALESCE(course_stats.course_count, 0),
			COALESCE(category_stats.category_count, 0),
			COALESCE(template_stats.template_count, 0),
			COALESCE(template_stats.active_template_count, 0),
			c.created_at, c.updated_at, c.deleted_at
		FROM edu_curricula c
	` + curriculumStatsJoin + `
		JOIN edu_majors m ON m.major_id = c.major_id
		JOIN org_departments d ON d.department_id = m.department_id
		WHERE c.deleted_at IS NULL
			AND m.deleted_at IS NULL
			AND d.deleted_at IS NULL
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

func (r *CurriculumRepository) GetCurriculumsByFaculty(ctx context.Context, facultyID uint64) ([]*models.Curriculum, error) {
	query := `
		SELECT c.curriculum_id, c.major_id, d.faculty_id, m.name_th, m.name_en, c.name_th, c.name_en, c.code, c.effective_year_be, c.status,
			COALESCE(course_stats.total_credits, 0),
			COALESCE(course_stats.course_count, 0),
			COALESCE(category_stats.category_count, 0),
			COALESCE(template_stats.template_count, 0),
			COALESCE(template_stats.active_template_count, 0),
			c.created_at, c.updated_at, c.deleted_at
		FROM edu_curricula c
	` + curriculumStatsJoin + `
		JOIN edu_majors m ON m.major_id = c.major_id
		JOIN org_departments d ON d.department_id = m.department_id
		WHERE c.deleted_at IS NULL
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

func (r *CurriculumRepository) GetMajors(ctx context.Context, filters models.MajorFilters) ([]*models.MajorOption, error) {
	query, args := majorListQuery(filters, "ORDER BY f.name_th, d.name_th, m.name_th, m.major_id")
	rows, err := r.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanMajorOptions(rows)
}

func (r *CurriculumRepository) GetMajorsByFaculty(ctx context.Context, facultyID uint64) ([]*models.MajorOption, error) {
	filters := models.MajorFilters{FacultyID: &facultyID}
	query, args := majorListQuery(filters, "ORDER BY d.name_th, m.name_th, m.major_id")
	rows, err := r.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanMajorOptions(rows)
}

func majorListQuery(filters models.MajorFilters, orderBy string) (string, []any) {
	args := []any{}
	conditions := []string{
		"m.deleted_at IS NULL",
		"d.deleted_at IS NULL",
		"f.deleted_at IS NULL",
		"d.is_active = 1",
		"f.is_active = 1",
	}
	if !filters.IncludeInactive {
		conditions = append(conditions, "m.is_active = 1")
	}
	if filters.FacultyID != nil {
		conditions = append(conditions, "d.faculty_id = ?")
		args = append(args, *filters.FacultyID)
	}
	if filters.DepartmentID != nil {
		conditions = append(conditions, "m.department_id = ?")
		args = append(args, *filters.DepartmentID)
	}

	query := `
		SELECT
			m.major_id,
			m.department_id,
			d.faculty_id,
			m.code,
			m.name_th,
			m.name_en,
			m.degree_level,
			m.is_active,
			COALESCE(curriculum_stats.curriculum_count, 0),
			d.name_th,
			d.name_en,
			f.name_th,
			f.name_en,
			m.created_at,
			m.updated_at
		FROM edu_majors m
		JOIN org_departments d ON d.department_id = m.department_id
		JOIN org_faculties f ON f.faculty_id = d.faculty_id
		LEFT JOIN (
			SELECT major_id, COUNT(*) AS curriculum_count
			FROM edu_curricula
			WHERE deleted_at IS NULL
			GROUP BY major_id
		) curriculum_stats ON curriculum_stats.major_id = m.major_id
		WHERE ` + strings.Join(conditions, "\n\t\t\tAND ") + `
		` + orderBy + `
	`

	return query, args
}

func (r *CurriculumRepository) GetMajorByID(ctx context.Context, majorID uint64) (*models.MajorOption, error) {
	query := `
		SELECT
			m.major_id,
			m.department_id,
			d.faculty_id,
			m.code,
			m.name_th,
			m.name_en,
			m.degree_level,
			m.is_active,
			COALESCE(curriculum_stats.curriculum_count, 0),
			d.name_th,
			d.name_en,
			f.name_th,
			f.name_en,
			m.created_at,
			m.updated_at
		FROM edu_majors m
		JOIN org_departments d ON d.department_id = m.department_id
		JOIN org_faculties f ON f.faculty_id = d.faculty_id
		LEFT JOIN (
			SELECT major_id, COUNT(*) AS curriculum_count
			FROM edu_curricula
			WHERE deleted_at IS NULL
			GROUP BY major_id
		) curriculum_stats ON curriculum_stats.major_id = m.major_id
		WHERE m.major_id = ?
			AND m.deleted_at IS NULL
			AND d.deleted_at IS NULL
			AND f.deleted_at IS NULL
	`

	return scanMajorOption(r.DB.QueryRowContext(ctx, query, majorID))
}

func (r *CurriculumRepository) GetDepartments(ctx context.Context, filters models.DepartmentFilters) ([]*models.DepartmentOption, error) {
	args := []any{}
	conditions := []string{
		"d.deleted_at IS NULL",
		"f.deleted_at IS NULL",
		"d.is_active = 1",
		"f.is_active = 1",
	}
	if filters.FacultyID != nil {
		conditions = append(conditions, "d.faculty_id = ?")
		args = append(args, *filters.FacultyID)
	}

	query := `
		SELECT d.department_id, d.faculty_id, d.code, d.name_th, d.name_en, d.is_active
		FROM org_departments d
		JOIN org_faculties f ON f.faculty_id = d.faculty_id
		WHERE ` + strings.Join(conditions, "\n\t\t\tAND ") + `
		ORDER BY f.name_th, d.name_th, d.department_id
	`

	rows, err := r.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	departments := []*models.DepartmentOption{}
	for rows.Next() {
		department, err := scanDepartmentOption(rows)
		if err != nil {
			return nil, err
		}
		departments = append(departments, department)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return departments, nil
}

func (r *CurriculumRepository) GetDepartmentByID(ctx context.Context, departmentID uint64) (*models.DepartmentOption, error) {
	query := `
		SELECT d.department_id, d.faculty_id, d.code, d.name_th, d.name_en, d.is_active
		FROM org_departments d
		JOIN org_faculties f ON f.faculty_id = d.faculty_id
		WHERE d.department_id = ?
			AND d.deleted_at IS NULL
			AND f.deleted_at IS NULL
			AND d.is_active = 1
			AND f.is_active = 1
	`

	return scanDepartmentOption(r.DB.QueryRowContext(ctx, query, departmentID))
}

func (r *CurriculumRepository) CreateMajor(ctx context.Context, payload models.UpsertMajorPayload) (*models.MajorOption, error) {
	isActive := true
	if payload.IsActive != nil {
		isActive = *payload.IsActive
	}

	res, err := r.DB.ExecContext(ctx, `
		INSERT INTO edu_majors (department_id, code, name_th, name_en, degree_level, is_active)
		VALUES (?, ?, ?, ?, ?, ?)
	`, payload.DepartmentID, payload.Code, payload.NameTH, payload.NameEN, payload.DegreeLevel, isActive)
	if err != nil {
		return nil, err
	}

	majorID, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}

	return r.GetMajorByID(ctx, uint64(majorID))
}

func (r *CurriculumRepository) UpdateMajor(ctx context.Context, majorID uint64, payload models.UpsertMajorPayload) (*models.MajorOption, error) {
	isActive := true
	if payload.IsActive != nil {
		isActive = *payload.IsActive
	}

	_, err := r.DB.ExecContext(ctx, `
		UPDATE edu_majors
		SET department_id = ?,
			code = ?,
			name_th = ?,
			name_en = ?,
			degree_level = ?,
			is_active = ?
		WHERE major_id = ?
			AND deleted_at IS NULL
	`, payload.DepartmentID, payload.Code, payload.NameTH, payload.NameEN, payload.DegreeLevel, isActive, majorID)
	if err != nil {
		return nil, err
	}

	return r.GetMajorByID(ctx, majorID)
}

func (r *CurriculumRepository) UpdateMajorStatus(ctx context.Context, majorID uint64, isActive bool) (*models.MajorOption, error) {
	_, err := r.DB.ExecContext(ctx, `
		UPDATE edu_majors
		SET is_active = ?
		WHERE major_id = ?
			AND deleted_at IS NULL
	`, isActive, majorID)
	if err != nil {
		return nil, err
	}

	return r.GetMajorByID(ctx, majorID)
}

func (r *CurriculumRepository) GetFaculties(ctx context.Context) ([]*models.FacultyOption, error) {
	query := `
		SELECT faculty_id, code, name_th, name_en
		FROM org_faculties
		WHERE deleted_at IS NULL
			AND is_active = 1
		ORDER BY name_th, faculty_id
	`

	rows, err := r.DB.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanFacultyOptions(rows)
}

func (r *CurriculumRepository) GetFacultyByID(ctx context.Context, facultyID uint64) (*models.FacultyOption, error) {
	query := `
		SELECT faculty_id, code, name_th, name_en
		FROM org_faculties
		WHERE faculty_id = ?
			AND deleted_at IS NULL
			AND is_active = 1
	`

	faculties, err := scanFacultyOptionsFromRow(r.DB.QueryRowContext(ctx, query, facultyID))
	if err != nil {
		return nil, err
	}
	return faculties, nil
}

func scanFacultyOptions(rows *sql.Rows) ([]*models.FacultyOption, error) {
	faculties := []*models.FacultyOption{}
	for rows.Next() {
		faculty, err := scanFacultyOption(rows)
		if err != nil {
			return nil, err
		}
		faculties = append(faculties, faculty)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return faculties, nil
}

func scanFacultyOptionsFromRow(row *sql.Row) (*models.FacultyOption, error) {
	return scanFacultyOption(row)
}

func scanFacultyOption(scanner rowScanner) (*models.FacultyOption, error) {
	var faculty models.FacultyOption
	var nameEn sql.NullString

	if err := scanner.Scan(
		&faculty.FacultyID,
		&faculty.Code,
		&faculty.NameTH,
		&nameEn,
	); err != nil {
		return nil, err
	}

	if nameEn.Valid {
		faculty.NameEN = &nameEn.String
	}

	return &faculty, nil
}

func scanMajorOptions(rows *sql.Rows) ([]*models.MajorOption, error) {
	majors := []*models.MajorOption{}
	for rows.Next() {
		major, err := scanMajorOption(rows)
		if err != nil {
			return nil, err
		}

		majors = append(majors, major)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return majors, nil
}

func scanMajorOption(scanner rowScanner) (*models.MajorOption, error) {
	var major models.MajorOption
	var nameEn sql.NullString
	var degreeLevel sql.NullString
	var departmentNameEn sql.NullString
	var facultyNameEn sql.NullString

	if err := scanner.Scan(
		&major.MajorID,
		&major.DepartmentID,
		&major.FacultyID,
		&major.Code,
		&major.NameTH,
		&nameEn,
		&degreeLevel,
		&major.IsActive,
		&major.CurriculumCount,
		&major.DepartmentNameTH,
		&departmentNameEn,
		&major.FacultyNameTH,
		&facultyNameEn,
		&major.CreatedAt,
		&major.UpdatedAt,
	); err != nil {
		return nil, err
	}

	if nameEn.Valid {
		major.NameEN = &nameEn.String
	}
	if degreeLevel.Valid {
		major.DegreeLevel = &degreeLevel.String
	}
	if departmentNameEn.Valid {
		major.DepartmentNameEN = &departmentNameEn.String
	}
	if facultyNameEn.Valid {
		major.FacultyNameEN = &facultyNameEn.String
	}

	return &major, nil
}

func scanDepartmentOption(scanner rowScanner) (*models.DepartmentOption, error) {
	var department models.DepartmentOption
	var nameEn sql.NullString

	if err := scanner.Scan(
		&department.DepartmentID,
		&department.FacultyID,
		&department.Code,
		&department.NameTH,
		&nameEn,
		&department.IsActive,
	); err != nil {
		return nil, err
	}

	if nameEn.Valid {
		department.NameEN = &nameEn.String
	}

	return &department, nil
}

func (r *CurriculumRepository) GetCurriculumByYear(ctx context.Context, year uint64) ([]*models.Curriculum, error) {
	query := `
		SELECT c.curriculum_id, c.major_id, d.faculty_id, m.name_th, m.name_en, c.name_th, c.name_en, c.code, c.effective_year_be, c.status,
			COALESCE(course_stats.total_credits, 0),
			COALESCE(course_stats.course_count, 0),
			COALESCE(category_stats.category_count, 0),
			COALESCE(template_stats.template_count, 0),
			COALESCE(template_stats.active_template_count, 0),
			c.created_at, c.updated_at, c.deleted_at
		FROM edu_curricula c
	` + curriculumStatsJoin + `
		JOIN edu_majors m ON m.major_id = c.major_id
		JOIN org_departments d ON d.department_id = m.department_id
		WHERE c.effective_year_be = ? AND c.status = 'active' AND c.deleted_at IS NULL
			AND m.deleted_at IS NULL
			AND d.deleted_at IS NULL
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
		SELECT c.curriculum_id, c.major_id, d.faculty_id, m.name_th, m.name_en, c.name_th, c.name_en, c.code, c.effective_year_be, c.status,
			COALESCE(course_stats.total_credits, 0),
			COALESCE(course_stats.course_count, 0),
			COALESCE(category_stats.category_count, 0),
			COALESCE(template_stats.template_count, 0),
			COALESCE(template_stats.active_template_count, 0),
			c.created_at, c.updated_at, c.deleted_at
		FROM edu_curricula c
	` + curriculumStatsJoin + `
		JOIN edu_majors m ON m.major_id = c.major_id
		JOIN org_departments d ON d.department_id = m.department_id
		WHERE c.curriculum_id = ? AND c.deleted_at IS NULL
			AND m.deleted_at IS NULL
			AND d.deleted_at IS NULL
	`

	return scanCurriculum(r.DB.QueryRowContext(ctx, query, id))
}

func (r *CurriculumRepository) GetCurriculumCategoryTree(ctx context.Context, curriculumID uint64) ([]*models.CourseCategoryNode, error) {
	categories, err := r.getCurriculumCategories(ctx, curriculumID)
	if err != nil {
		return nil, err
	}
	if len(categories) == 0 {
		return []*models.CourseCategoryNode{}, nil
	}

	coursesByCategory, err := r.getCurriculumCoursesByCategory(ctx, curriculumID)
	if err != nil {
		return nil, err
	}

	byID := make(map[uint64]*models.CourseCategoryNode, len(categories))
	for _, category := range categories {
		category.Children = []*models.CourseCategoryNode{}
		category.Courses = coursesByCategory[category.CategoryID]
		if category.Courses == nil {
			category.Courses = []*models.CurriculumCourseRow{}
		}
		byID[category.CategoryID] = category
	}

	roots := []*models.CourseCategoryNode{}
	for _, category := range categories {
		if category.ParentID == nil {
			roots = append(roots, category)
			continue
		}

		parent, ok := byID[*category.ParentID]
		if !ok {
			roots = append(roots, category)
			continue
		}

		parent.Children = append(parent.Children, category)
	}

	return roots, nil
}

func (r *CurriculumRepository) getCurriculumCategories(ctx context.Context, curriculumID uint64) ([]*models.CourseCategoryNode, error) {
	query := `
		SELECT category_id, curriculum_id, parent_id, code, name_th, name_en, required_credits, display_order, is_active, created_at, updated_at, deleted_at
		FROM crs_course_categories
		WHERE curriculum_id = ?
			AND deleted_at IS NULL
		ORDER BY COALESCE(parent_id, 0), display_order, category_id
	`

	rows, err := r.DB.QueryContext(ctx, query, curriculumID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	categories := []*models.CourseCategoryNode{}
	for rows.Next() {
		category, err := scanCourseCategoryNode(rows)
		if err != nil {
			return nil, err
		}
		categories = append(categories, category)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return categories, nil
}

func scanCourseCategoryNode(scanner rowScanner) (*models.CourseCategoryNode, error) {
	var category models.CourseCategoryNode
	var parentID sql.NullInt64
	var code sql.NullString
	var nameEn sql.NullString
	var deletedAt sql.NullTime

	if err := scanner.Scan(
		&category.CategoryID,
		&category.CurriculumID,
		&parentID,
		&code,
		&category.NameTH,
		&nameEn,
		&category.RequiredCredits,
		&category.DisplayOrder,
		&category.IsActive,
		&category.CreatedAt,
		&category.UpdatedAt,
		&deletedAt,
	); err != nil {
		return nil, err
	}

	if parentID.Valid {
		v := uint64(parentID.Int64)
		category.ParentID = &v
	}
	if code.Valid {
		category.Code = &code.String
	}
	if nameEn.Valid {
		category.NameEN = &nameEn.String
	}
	if deletedAt.Valid {
		category.DeletedAt = &deletedAt.Time
	}

	return &category, nil
}

func (r *CurriculumRepository) getCurriculumCoursesByCategory(ctx context.Context, curriculumID uint64) (map[uint64][]*models.CurriculumCourseRow, error) {
	query := `
		SELECT
			cc.curriculum_course_id,
			cc.category_id,
			cc.course_id,
			course.code,
			course.name_th,
			course.name_en,
			course.credits,
			course.description,
			cc.is_required,
			cc.is_locked,
			cc.display_order,
			cc.is_active,
			cc.created_at,
			cc.updated_at,
			cc.deleted_at
		FROM crs_curriculum_courses cc
		JOIN crs_course_categories cat ON cat.category_id = cc.category_id
		JOIN crs_courses course ON course.course_id = cc.course_id
		WHERE cat.curriculum_id = ?
			AND cat.deleted_at IS NULL
			AND cc.deleted_at IS NULL
			AND course.deleted_at IS NULL
			AND course.curriculum_id = cat.curriculum_id
		ORDER BY cc.category_id, cc.display_order, cc.curriculum_course_id
	`

	rows, err := r.DB.QueryContext(ctx, query, curriculumID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	coursesByCategory := map[uint64][]*models.CurriculumCourseRow{}
	for rows.Next() {
		course, err := scanCurriculumCourseRow(rows)
		if err != nil {
			return nil, err
		}
		coursesByCategory[course.CategoryID] = append(coursesByCategory[course.CategoryID], course)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return coursesByCategory, nil
}

func scanCurriculumCourseRow(scanner rowScanner) (*models.CurriculumCourseRow, error) {
	var course models.CurriculumCourseRow
	var nameEn sql.NullString
	var description sql.NullString
	var deletedAt sql.NullTime

	if err := scanner.Scan(
		&course.CurriculumCourseID,
		&course.CategoryID,
		&course.CourseID,
		&course.Code,
		&course.NameTH,
		&nameEn,
		&course.Credits,
		&description,
		&course.IsRequired,
		&course.IsLocked,
		&course.DisplayOrder,
		&course.IsActive,
		&course.CreatedAt,
		&course.UpdatedAt,
		&deletedAt,
	); err != nil {
		return nil, err
	}

	if nameEn.Valid {
		course.NameEN = &nameEn.String
	}
	if description.Valid {
		course.Description = &description.String
	}
	if deletedAt.Valid {
		course.DeletedAt = &deletedAt.Time
	}

	return &course, nil
}

func (r *CurriculumRepository) GetMajorScope(ctx context.Context, majorID uint64) (MajorScope, error) {
	query := `
		SELECT
			d.faculty_id,
			COALESCE(m.degree_level, 'bachelor'),
			f.code,
			m.code,
			m.is_active
		FROM edu_majors m
		JOIN org_departments d ON d.department_id = m.department_id
		JOIN org_faculties f ON f.faculty_id = d.faculty_id
		WHERE m.major_id = ?
			AND m.deleted_at IS NULL
			AND d.deleted_at IS NULL
			AND f.deleted_at IS NULL
	`

	var scope MajorScope
	err := r.DB.QueryRowContext(ctx, query, majorID).Scan(
		&scope.FacultyID,
		&scope.DegreeLevel,
		&scope.FacultyCode,
		&scope.MajorCode,
		&scope.IsActive,
	)
	if err != nil {
		return MajorScope{}, err
	}

	return scope, nil
}

func (r *CurriculumRepository) GetCurriculumCodesByMajor(ctx context.Context, majorID uint64) ([]string, error) {
	rows, err := r.DB.QueryContext(ctx, `
		SELECT code
		FROM edu_curricula
		WHERE major_id = ?
	`, majorID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	codes := make([]string, 0)
	for rows.Next() {
		var code string
		if err := rows.Scan(&code); err != nil {
			return nil, err
		}
		codes = append(codes, code)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return codes, nil
}

func (r *CurriculumRepository) FindLiveCurriculumNameDuplicate(ctx context.Context, majorID uint64, effectiveYearBE uint64, nameTH string) (*CurriculumNameDuplicate, error) {
	query := `
		SELECT c.curriculum_id, c.major_id, m.name_th, c.name_th, c.effective_year_be
		FROM edu_curricula c
		JOIN edu_majors m ON m.major_id = c.major_id
		WHERE c.major_id = ?
			AND c.effective_year_be = ?
			AND c.name_th = ?
			AND c.deleted_at IS NULL
		LIMIT 1
	`

	var duplicate CurriculumNameDuplicate
	err := r.DB.QueryRowContext(ctx, query, majorID, effectiveYearBE, nameTH).Scan(
		&duplicate.CurriculumID,
		&duplicate.MajorID,
		&duplicate.MajorNameTH,
		&duplicate.NameTH,
		&duplicate.EffectiveYearBE,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	return &duplicate, nil
}

func (r *CurriculumRepository) CountLiveCurriculumCodeDuplicate(ctx context.Context, majorID uint64, code string) (int, error) {
	var count int
	err := r.DB.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM edu_curricula
		WHERE major_id = ?
			AND code = ?
			AND deleted_at IS NULL
	`, majorID, code).Scan(&count)
	return count, err
}

func (r *CurriculumRepository) FindLiveCurriculumNameDuplicateExcept(ctx context.Context, majorID uint64, effectiveYearBE uint64, nameTH string, curriculumID uint64) (*CurriculumNameDuplicate, error) {
	query := `
		SELECT c.curriculum_id, c.major_id, m.name_th, c.name_th, c.effective_year_be
		FROM edu_curricula c
		JOIN edu_majors m ON m.major_id = c.major_id
		WHERE c.major_id = ?
			AND c.effective_year_be = ?
			AND c.name_th = ?
			AND c.curriculum_id <> ?
			AND c.deleted_at IS NULL
		LIMIT 1
	`

	var duplicate CurriculumNameDuplicate
	err := r.DB.QueryRowContext(ctx, query, majorID, effectiveYearBE, nameTH, curriculumID).Scan(
		&duplicate.CurriculumID,
		&duplicate.MajorID,
		&duplicate.MajorNameTH,
		&duplicate.NameTH,
		&duplicate.EffectiveYearBE,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &duplicate, nil
}

func (r *CurriculumRepository) CountLiveCurriculumCodeDuplicateExcept(ctx context.Context, majorID uint64, code string, curriculumID uint64) (int, error) {
	var count int
	err := r.DB.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM edu_curricula
		WHERE major_id = ?
			AND code = ?
			AND curriculum_id <> ?
			AND deleted_at IS NULL
	`, majorID, code, curriculumID).Scan(&count)
	return count, err
}

func (r *CurriculumRepository) CreateCurriculumTx(ctx context.Context, payload models.CreateCurriculumPayload, opts CreateCurriculumOptions) (*models.Curriculum, error) {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	res, err := tx.ExecContext(ctx, `
		INSERT INTO edu_curricula (major_id, code, name_th, name_en, effective_year_be, status)
		VALUES (?, ?, ?, ?, ?, 'draft')
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

func (r *CurriculumRepository) DuplicateCurriculumTx(ctx context.Context, sourceCurriculumID uint64, payload models.CreateCurriculumPayload, opts CreateCurriculumOptions) (*models.Curriculum, error) {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	res, err := tx.ExecContext(ctx, `
		INSERT INTO edu_curricula (major_id, code, name_th, name_en, effective_year_be, status)
		VALUES (?, ?, ?, ?, ?, 'draft')
	`, payload.MajorID, payload.CurriculumCode, payload.CurriculumNameTH, payload.CurriculumNameEN, payload.EffectiveYearBE)
	if err != nil {
		return nil, fmt.Errorf("insert duplicated curriculum: %w", err)
	}

	curriculumID, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}
	targetCurriculumID := uint64(curriculumID)

	categories, err := r.getDuplicateCategoryRows(ctx, tx, sourceCurriculumID)
	if err != nil {
		return nil, err
	}
	categoryIDMap, err := r.duplicateCategories(ctx, tx, targetCurriculumID, categories)
	if err != nil {
		return nil, err
	}

	courses, err := r.getDuplicateCourseRows(ctx, tx, sourceCurriculumID)
	if err != nil {
		return nil, err
	}
	if err := r.duplicateCurriculumCourses(ctx, tx, targetCurriculumID, courses, categoryIDMap, opts); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return r.GetCurriculumByID(ctx, targetCurriculumID)
}

func (r *CurriculumRepository) getDuplicateCategoryRows(ctx context.Context, tx *sql.Tx, sourceCurriculumID uint64) ([]duplicateCategoryRow, error) {
	rows, err := tx.QueryContext(ctx, `
		SELECT category_id, parent_id, code, name_th, name_en, required_credits, display_order
		FROM crs_course_categories
		WHERE curriculum_id = ?
			AND is_active = 1
			AND deleted_at IS NULL
		ORDER BY COALESCE(parent_id, 0), display_order, category_id
	`, sourceCurriculumID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	categories := []duplicateCategoryRow{}
	for rows.Next() {
		var category duplicateCategoryRow
		if err := rows.Scan(
			&category.CategoryID,
			&category.ParentID,
			&category.Code,
			&category.NameTH,
			&category.NameEN,
			&category.RequiredCredits,
			&category.DisplayOrder,
		); err != nil {
			return nil, err
		}
		categories = append(categories, category)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return categories, nil
}

func (r *CurriculumRepository) duplicateCategories(ctx context.Context, tx *sql.Tx, targetCurriculumID uint64, categories []duplicateCategoryRow) (map[uint64]uint64, error) {
	categoryIDMap := map[uint64]uint64{}
	pending := append([]duplicateCategoryRow(nil), categories...)

	for len(pending) > 0 {
		progress := false
		nextPending := []duplicateCategoryRow{}

		for _, category := range pending {
			var parentID *uint64
			if category.ParentID != nil {
				mappedParentID, ok := categoryIDMap[*category.ParentID]
				if !ok {
					nextPending = append(nextPending, category)
					continue
				}
				parentID = &mappedParentID
			}

			res, err := tx.ExecContext(ctx, `
				INSERT INTO crs_course_categories (curriculum_id, parent_id, code, name_th, name_en, required_credits, display_order, is_active)
				VALUES (?, ?, ?, ?, ?, ?, ?, 1)
			`, targetCurriculumID, parentID, category.Code, category.NameTH, category.NameEN, category.RequiredCredits, category.DisplayOrder)
			if err != nil {
				return nil, fmt.Errorf("duplicate category %q: %w", category.NameTH, err)
			}
			newCategoryID, err := res.LastInsertId()
			if err != nil {
				return nil, err
			}
			categoryIDMap[category.CategoryID] = uint64(newCategoryID)
			progress = true
		}

		if !progress {
			return nil, fmt.Errorf("duplicate curriculum category tree is invalid")
		}
		pending = nextPending
	}

	return categoryIDMap, nil
}

func (r *CurriculumRepository) getDuplicateCourseRows(ctx context.Context, tx *sql.Tx, sourceCurriculumID uint64) ([]duplicateCourseRow, error) {
	rows, err := tx.QueryContext(ctx, `
		SELECT
			cc.curriculum_course_id,
			cc.category_id,
			course.course_id,
			course.code,
			course.name_th,
			course.name_en,
			course.credits,
			course.description,
			cc.is_required,
			cc.is_locked,
			cc.display_order
		FROM crs_curriculum_courses cc
		JOIN crs_course_categories cat ON cat.category_id = cc.category_id
		JOIN crs_courses course ON course.course_id = cc.course_id
		WHERE cat.curriculum_id = ?
			AND cat.is_active = 1
			AND cat.deleted_at IS NULL
			AND cc.is_active = 1
			AND cc.deleted_at IS NULL
			AND course.deleted_at IS NULL
			AND course.curriculum_id = cat.curriculum_id
		ORDER BY cat.display_order, cc.display_order, cc.curriculum_course_id
	`, sourceCurriculumID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	courses := []duplicateCourseRow{}
	for rows.Next() {
		var course duplicateCourseRow
		if err := rows.Scan(
			&course.CurriculumCourseID,
			&course.CategoryID,
			&course.CourseID,
			&course.Code,
			&course.NameTH,
			&course.NameEN,
			&course.Credits,
			&course.Description,
			&course.IsRequired,
			&course.IsLocked,
			&course.DisplayOrder,
		); err != nil {
			return nil, err
		}
		courses = append(courses, course)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return courses, nil
}

func (r *CurriculumRepository) duplicateCurriculumCourses(ctx context.Context, tx *sql.Tx, targetCurriculumID uint64, courses []duplicateCourseRow, categoryIDMap map[uint64]uint64, opts CreateCurriculumOptions) error {
	courseIDMap := map[uint64]uint64{}

	for _, course := range courses {
		targetCategoryID, ok := categoryIDMap[course.CategoryID]
		if !ok {
			continue
		}

		targetCourseID, ok := courseIDMap[course.CourseID]
		if !ok {
			var err error
			targetCourseID, err = r.createCourse(ctx, tx, targetCurriculumID, models.CreateCourseInCatPayload{
				Code:        course.Code,
				NameTH:      course.NameTH,
				NameEN:      course.NameEN,
				Credits:     course.Credits,
				Description: course.Description,
			}, opts)
			if err != nil {
				return err
			}
			courseIDMap[course.CourseID] = targetCourseID
		}

		_, err := tx.ExecContext(ctx, `
			INSERT INTO crs_curriculum_courses (category_id, course_id, is_required, is_locked, display_order, is_active)
			VALUES (?, ?, ?, ?, ?, 1)
		`, targetCategoryID, targetCourseID, course.IsRequired, course.IsLocked, course.DisplayOrder)
		if err != nil {
			return fmt.Errorf("duplicate curriculum course %d: %w", course.CurriculumCourseID, err)
		}
	}

	return nil
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
		courseID, err := r.createCourse(ctx, tx, curriculumID, course, opts)
		if err != nil {
			return err
		}

		_, err = tx.ExecContext(ctx, `
			INSERT INTO crs_curriculum_courses (category_id, course_id, is_required, display_order, is_active)
			VALUES (?, ?, ?, ?, 1)
		`, categoryID, courseID, course.IsRequired, course.DisplayOrder)
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

func (r *CurriculumRepository) createCourse(ctx context.Context, tx *sql.Tx, curriculumID uint64, payload models.CreateCourseInCatPayload, opts CreateCurriculumOptions) (uint64, error) {
	degreeLevel := opts.DegreeLevel
	if degreeLevel == "" {
		degreeLevel = "bachelor"
	}

	var createdBy sql.NullInt64
	if opts.CreatedBy > 0 {
		createdBy = sql.NullInt64{Int64: int64(opts.CreatedBy), Valid: true}
	}

	res, err := tx.ExecContext(ctx, `
		INSERT INTO crs_courses (curriculum_id, faculty_id, degree_level, code, name_th, name_en, credits, description, created_by, status, is_active)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1)
	`, curriculumID, opts.FacultyID, degreeLevel, payload.Code, payload.NameTH, payload.NameEN, payload.Credits, payload.Description, createdBy)
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
			SELECT cc.course_id, MAX(course.credits) AS course_credits
			FROM crs_curriculum_courses cc
			JOIN crs_course_categories cat ON cat.category_id = cc.category_id
			JOIN crs_courses course ON course.course_id = cc.course_id
			WHERE cat.curriculum_id = ?
				AND cc.is_active = 1
				AND cc.deleted_at IS NULL
				AND cat.deleted_at IS NULL
				AND course.deleted_at IS NULL
				AND course.curriculum_id = cat.curriculum_id
			GROUP BY cc.course_id
		) distinct_courses
	`

	var totalCredits int
	if err := r.DB.QueryRowContext(ctx, query, curriculumID).Scan(&totalCredits); err != nil {
		return 0, err
	}

	return totalCredits, nil
}
