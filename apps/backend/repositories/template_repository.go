package repositories

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
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
			t.template_id, t.faculty_id, COALESCE(t.curriculum_id, 0),
			COALESCE(c.name_th, 'ไม่ระบุหลักสูตร'), c.name_en, COALESCE(c.code, ''),
			t.code, t.name, t.description, COALESCE(t.version_year_be, 0),
			t.is_active, t.created_at, t.updated_at,
			(SELECT COUNT(DISTINCT competency_id) FROM comp_template_items cti WHERE cti.template_id = t.template_id AND cti.deleted_at IS NULL),
			(SELECT COUNT(DISTINCT course_id) FROM comp_template_items cti WHERE cti.template_id = t.template_id AND cti.course_id IS NOT NULL AND cti.deleted_at IS NULL),
			COALESCE((SELECT COUNT(DISTINCT cc.course_id) FROM crs_curriculum_courses cc JOIN crs_course_categories cat ON cat.category_id = cc.category_id WHERE cat.curriculum_id = t.curriculum_id AND cc.is_active = 1 AND cc.deleted_at IS NULL AND cat.deleted_at IS NULL), 0) + COALESCE((SELECT COUNT(DISTINCT template_course_id) FROM comp_template_courses ctc WHERE ctc.template_id = t.template_id AND ctc.deleted_at IS NULL), 0) AS total_course_count
		FROM comp_templates t
		LEFT JOIN edu_curricula c ON c.curriculum_id = t.curriculum_id AND c.deleted_at IS NULL
		WHERE t.faculty_id = ? AND t.deleted_at IS NULL
		ORDER BY t.created_at DESC, t.template_id DESC
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
			&t.CompetencyCount, &t.MappedCourseCount, &t.TotalCourseCount,
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
			t.template_id, t.faculty_id, COALESCE(t.curriculum_id, 0),
			COALESCE(c.name_th, 'ไม่ระบุหลักสูตร'), c.name_en, COALESCE(c.code, ''),
			t.code, t.name, t.description, COALESCE(t.version_year_be, 0),
			t.is_active, t.created_at, t.updated_at,
			(SELECT COUNT(DISTINCT competency_id) FROM comp_template_items cti WHERE cti.template_id = t.template_id AND cti.deleted_at IS NULL),
			(SELECT COUNT(DISTINCT course_id) FROM comp_template_items cti WHERE cti.template_id = t.template_id AND cti.course_id IS NOT NULL AND cti.deleted_at IS NULL),
			COALESCE((SELECT COUNT(DISTINCT cc.course_id) FROM crs_curriculum_courses cc JOIN crs_course_categories cat ON cat.category_id = cc.category_id WHERE cat.curriculum_id = t.curriculum_id AND cc.is_active = 1 AND cc.deleted_at IS NULL AND cat.deleted_at IS NULL), 0) + COALESCE((SELECT COUNT(DISTINCT template_course_id) FROM comp_template_courses ctc WHERE ctc.template_id = t.template_id AND ctc.deleted_at IS NULL), 0) AS total_course_count
		FROM comp_templates t
		LEFT JOIN edu_curricula c ON c.curriculum_id = t.curriculum_id AND c.deleted_at IS NULL
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
		&t.CompetencyCount, &t.MappedCourseCount, &t.TotalCourseCount,
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
	code := fmt.Sprintf("tpl_%d_%d", facultyID, now.UnixNano())

	// New templates begin inactive. Activation runs the readiness validation in the service.
	res, err := tx.ExecContext(ctx, `
		INSERT INTO comp_templates (faculty_id, curriculum_id, code, name, version_year_be, is_active, created_by, created_at, updated_at)
		VALUES (?, ?, ?, ?, NULL, 0, ?, ?, ?)
	`, facultyID, req.CurriculumID, code, req.Name, userID, now, now)
	if err != nil {
		return nil, fmt.Errorf("insert comp_templates failed: %w", err)
	}

	templateID, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}

	// 2. Insert new competencies if any.
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

	// 3. Insert initial template items (course_id IS NULL).
	for idx, cid := range compIDs {
		_, err = tx.ExecContext(ctx, `
			INSERT INTO comp_template_items (template_id, competency_id, course_id, display_order, is_active, created_at, updated_at)
			VALUES (?, ?, NULL, ?, 0, ?, ?)
			ON DUPLICATE KEY UPDATE
				deleted_at = NULL,
				display_order = VALUES(display_order),
				is_active = 0,
				updated_at = VALUES(updated_at)
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

func (r *TemplateRepository) UpdateTemplateName(ctx context.Context, templateID uint64, name string) error {
	_, err := r.DB.ExecContext(ctx, `UPDATE comp_templates SET name = ?, updated_at = NOW() WHERE template_id = ?`, name, templateID)
	return err
}

func (r *TemplateRepository) UpdateTemplateStatus(ctx context.Context, templateID uint64, isActive bool) error {
	activeInt := 0
	if isActive {
		activeInt = 1
	}

	_, err := r.DB.ExecContext(ctx, `UPDATE comp_templates SET is_active = ?, updated_at = NOW() WHERE template_id = ?`, activeInt, templateID)
	return err
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

	_, err = tx.ExecContext(ctx, `UPDATE comp_template_items SET deleted_at = ?, updated_at = ? WHERE template_id = ?`, now, now, templateID)
	if err != nil {
		return err
	}

	_, err = tx.ExecContext(ctx, `UPDATE comp_template_categories SET deleted_at = ?, updated_at = ? WHERE template_id = ?`, now, now, templateID)
	if err != nil {
		return err
	}

	_, err = tx.ExecContext(ctx, `UPDATE comp_template_courses SET deleted_at = ?, updated_at = ? WHERE template_id = ?`, now, now, templateID)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (r *TemplateRepository) HasLiveTemplateAssignment(ctx context.Context, templateID uint64) (bool, error) {
	var exists bool
	err := r.DB.QueryRowContext(ctx, `
        SELECT EXISTS(
            SELECT 1
            FROM curri_template_assignments
            WHERE template_id = ? AND deleted_at IS NULL
        )
    `, templateID).Scan(&exists)
	return exists, err
}

func (r *TemplateRepository) GetTemplateItems(ctx context.Context, templateID uint64) ([]models.TemplateItem, error) {
	query := `
		SELECT 
			cti.template_item_id, cti.template_id, cti.course_id,
			COALESCE(crs.code, ctc.code, ''), COALESCE(crs.name_th, ctc.name_th, ''), COALESCE(crs.name_en, ctc.name_en),
			cti.competency_id, COALESCE(c.code, ''), COALESCE(c.name_th, ''),
			cti.weight, cti.display_order, cti.is_active, COALESCE(cti.is_custom_course, 0)
		FROM comp_template_items cti
		JOIN comp_competencies c ON cti.competency_id = c.competency_id AND c.deleted_at IS NULL
		LEFT JOIN crs_courses crs ON cti.course_id = crs.course_id AND (cti.is_custom_course = 0 OR cti.is_custom_course IS NULL) AND crs.deleted_at IS NULL
		LEFT JOIN comp_template_courses ctc ON cti.course_id = ctc.template_course_id AND cti.is_custom_course = 1 AND ctc.deleted_at IS NULL
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
		var isCustomCourse bool

		err := rows.Scan(
			&item.TemplateItemID, &item.TemplateID, &courseID,
			&courseCode, &courseNameTH, &courseNameEN,
			&item.CompetencyID, &item.CompetencyCode, &item.CompetencyName,
			&weight, &item.DisplayOrder, &item.IsActive, &isCustomCourse,
		)
		if err != nil {
			return nil, err
		}

		item.IsCustomCourse = isCustomCourse
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

// GetTemplateCoreWeightSums returns the total weight per competency for
// required Curriculum courses owned by the Template. Template Additional
// Courses are intentionally excluded because they are bonus scores.
func (r *TemplateRepository) GetTemplateCoreWeightSums(ctx context.Context, templateID uint64) (map[uint64]float64, error) {
	const query = `
		SELECT cti.competency_id, COALESCE(SUM(cti.weight), 0)
		FROM comp_template_items cti
		JOIN comp_templates t
			ON t.template_id = cti.template_id
			AND t.deleted_at IS NULL
		JOIN crs_curriculum_courses cc
			ON cc.course_id = cti.course_id
			AND cc.is_required = 1
			AND cc.is_active = 1
			AND cc.deleted_at IS NULL
		JOIN crs_course_categories cat
			ON cat.category_id = cc.category_id
			AND cat.curriculum_id = t.curriculum_id
			AND cat.deleted_at IS NULL
		WHERE cti.template_id = ?
			AND cti.course_id IS NOT NULL
			AND COALESCE(cti.is_custom_course, 0) = 0
			AND cti.weight IS NOT NULL
			AND cti.deleted_at IS NULL
		GROUP BY cti.competency_id
	`

	rows, err := r.DB.QueryContext(ctx, query, templateID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sums := make(map[uint64]float64)
	for rows.Next() {
		var competencyID uint64
		var weightSum float64
		if err := rows.Scan(&competencyID, &weightSum); err != nil {
			return nil, err
		}
		sums[competencyID] = weightSum
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return sums, nil
}

func (r *TemplateRepository) GetTemplateCategories(ctx context.Context, templateID uint64) ([]models.TemplateCategory, error) {
	query := `
		SELECT template_category_id, template_id, curriculum_parent_id, parent_id, code, name, display_order, is_active
		FROM comp_template_categories
		WHERE template_id = ? AND deleted_at IS NULL
		ORDER BY display_order ASC, template_category_id ASC
	`
	rows, err := r.DB.QueryContext(ctx, query, templateID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var cats []models.TemplateCategory
	for rows.Next() {
		var cat models.TemplateCategory
		var curriParentID, parentID sql.NullInt64
		var code sql.NullString
		err := rows.Scan(&cat.TemplateCategoryID, &cat.TemplateID, &curriParentID, &parentID, &code, &cat.Name, &cat.DisplayOrder, &cat.IsActive)
		if err != nil {
			return nil, err
		}
		if curriParentID.Valid {
			pid := uint64(curriParentID.Int64)
			cat.CurriculumParentID = &pid
		}
		if parentID.Valid {
			pid := uint64(parentID.Int64)
			cat.ParentID = &pid
		}
		if code.Valid {
			cat.Code = &code.String
		}
		cats = append(cats, cat)
	}
	return cats, rows.Err()
}

func (r *TemplateRepository) GetTemplateCourses(ctx context.Context, templateID uint64) ([]models.TemplateCourse, error) {
	query := `
		SELECT template_course_id, template_id, curriculum_category_id, template_category_id, code, name_th, name_en, credits, description, display_order, is_active
		FROM comp_template_courses
		WHERE template_id = ? AND deleted_at IS NULL
		ORDER BY display_order ASC, template_course_id ASC
	`
	rows, err := r.DB.QueryContext(ctx, query, templateID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var courses []models.TemplateCourse
	for rows.Next() {
		var c models.TemplateCourse
		var curriCatID, tplCatID sql.NullInt64
		var nameEN, desc sql.NullString
		err := rows.Scan(&c.TemplateCourseID, &c.TemplateID, &curriCatID, &tplCatID, &c.Code, &c.NameTH, &nameEN, &c.Credits, &desc, &c.DisplayOrder, &c.IsActive)
		if err != nil {
			return nil, err
		}
		if curriCatID.Valid {
			id := uint64(curriCatID.Int64)
			c.CurriculumCategoryID = &id
		}
		if tplCatID.Valid {
			id := uint64(tplCatID.Int64)
			c.TemplateCategoryID = &id
		}
		if nameEN.Valid {
			c.NameEN = &nameEN.String
		}
		if desc.Valid {
			c.Description = &desc.String
		}
		courses = append(courses, c)
	}
	return courses, rows.Err()
}

func (r *TemplateRepository) GetTemplateCompetencies(ctx context.Context, templateID uint64) ([]models.TemplateCompetency, error) {
	query := `
		SELECT c.competency_id, c.code, c.name_th, COALESCE(c.name_en, ''), c.is_active
		FROM comp_template_items cti
		JOIN comp_competencies c ON cti.competency_id = c.competency_id AND c.deleted_at IS NULL
		WHERE cti.template_id = ? AND cti.deleted_at IS NULL AND cti.course_id IS NULL
		GROUP BY c.competency_id, c.code, c.name_th, COALESCE(c.name_en, ''), c.is_active
		ORDER BY MIN(cti.display_order) ASC, c.competency_id ASC
	`
	rows, err := r.DB.QueryContext(ctx, query, templateID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var comps []models.TemplateCompetency
	for rows.Next() {
		var comp models.TemplateCompetency
		var nameEN string
		err := rows.Scan(&comp.CompetencyID, &comp.Code, &comp.NameTH, &nameEN, &comp.IsActive)
		if err != nil {
			return nil, err
		}
		if nameEN != "" {
			comp.NameEN = nameEN
		}
		comps = append(comps, comp)
	}

	// Fallback for legacy templates where course_id IS NULL items were not created
	if len(comps) == 0 {
		fallbackQuery := `
			SELECT c.competency_id, c.code, c.name_th, COALESCE(c.name_en, ''), c.is_active
			FROM comp_template_items cti
			JOIN comp_competencies c ON cti.competency_id = c.competency_id AND c.deleted_at IS NULL
			WHERE cti.template_id = ? AND cti.deleted_at IS NULL
			GROUP BY c.competency_id, c.code, c.name_th, COALESCE(c.name_en, ''), c.is_active
			ORDER BY c.competency_id ASC
		`
		fRows, err := r.DB.QueryContext(ctx, fallbackQuery, templateID)
		if err == nil {
			defer fRows.Close()
			for fRows.Next() {
				var comp models.TemplateCompetency
				var nameEN string
				if err := fRows.Scan(&comp.CompetencyID, &comp.Code, &comp.NameTH, &nameEN, &comp.IsActive); err == nil {
					if nameEN != "" {
						comp.NameEN = nameEN
					}
					comps = append(comps, comp)
				}
			}
		}
	}

	return comps, nil
}

func templateCompetencyPlaceholders(ids []uint64) (string, []any) {
	placeholders := make([]string, len(ids))
	args := make([]any, len(ids))
	for index, id := range ids {
		placeholders[index] = "?"
		args[index] = id
	}
	return strings.Join(placeholders, ", "), args
}

// ValidateActiveCompetencyIDs ensures every requested competency is available for selection.
func (r *TemplateRepository) ValidateActiveCompetencyIDs(ctx context.Context, competencyIDs []uint64) error {
	if len(competencyIDs) == 0 {
		return nil
	}

	placeholders, args := templateCompetencyPlaceholders(competencyIDs)
	query := fmt.Sprintf(`
		SELECT competency_id
		FROM comp_competencies
		WHERE competency_id IN (%s)
		  AND is_active = 1
		  AND deleted_at IS NULL
	`, placeholders)

	rows, err := r.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return err
	}
	defer rows.Close()

	found := make(map[uint64]struct{}, len(competencyIDs))
	for rows.Next() {
		var competencyID uint64
		if err := rows.Scan(&competencyID); err != nil {
			return err
		}
		found[competencyID] = struct{}{}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if len(found) != len(competencyIDs) {
		return fmt.Errorf("one or more selected competencies are unavailable")
	}
	return nil
}

// HasLearnerCourseScores reports whether the cohort currently assigned to the
// template has any learner score or computed competency result.
func (r *TemplateRepository) HasLearnerCourseScores(ctx context.Context, templateID uint64) (bool, error) {
	const query = `
		SELECT EXISTS (
			SELECT 1
			FROM curri_template_assignments ta
			WHERE ta.template_id = ?
				AND ta.deleted_at IS NULL
				AND (
					EXISTS (
						SELECT 1
						FROM score_course_competency_scores sccs
						JOIN crs_course_enrollment cce ON cce.course_student_id = sccs.course_student_id AND cce.deleted_at IS NULL
						JOIN kku_enrollment_curricula kec ON kec.enrollment_curriculum_id = cce.student_curricula_id AND kec.deleted_at IS NULL
						WHERE kec.cohort_id = ta.cohort_id AND sccs.deleted_at IS NULL
					)
					OR EXISTS (
						SELECT 1
						FROM score_session_competency_scores sscs
						JOIN kku_enrollments ke ON ke.person_id = sscs.person_id AND ke.deleted_at IS NULL
						JOIN kku_enrollment_curricula kec ON kec.enrollment_id = ke.enrollment_id AND kec.deleted_at IS NULL
						WHERE kec.cohort_id = ta.cohort_id AND sscs.deleted_at IS NULL
					)
					OR EXISTS (
						SELECT 1
						FROM score_competency_result scr
						JOIN kku_enrollment_curricula kec ON kec.enrollment_id = scr.enrollment_id AND kec.deleted_at IS NULL
						WHERE kec.cohort_id = ta.cohort_id AND scr.deleted_at IS NULL
					)
				)
		)
	`

	var hasScores bool
	if err := r.DB.QueryRowContext(ctx, query, templateID).Scan(&hasScores); err != nil {
		return false, err
	}
	return hasScores, nil
}

// CurriculumBelongsToFaculty validates that a template owner curriculum is
// available in the caller's faculty scope.
func (r *TemplateRepository) CurriculumBelongsToFaculty(ctx context.Context, curriculumID, facultyID uint64) (bool, error) {
	const query = `
		SELECT EXISTS (
			SELECT 1
			FROM edu_curricula c
			JOIN edu_majors m ON m.major_id = c.major_id AND m.deleted_at IS NULL
			JOIN org_departments d ON d.department_id = m.department_id AND d.deleted_at IS NULL
			WHERE c.curriculum_id = ?
				AND c.deleted_at IS NULL
				AND d.faculty_id = ?
		)
	`
	var exists bool
	if err := r.DB.QueryRowContext(ctx, query, curriculumID, facultyID).Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}

func (r *TemplateRepository) GetCurriculumFacultyID(ctx context.Context, curriculumID uint64) (uint64, error) {
	const query = `
		SELECT d.faculty_id
		FROM edu_curricula c
		JOIN edu_majors m ON m.major_id = c.major_id AND m.deleted_at IS NULL
		JOIN org_departments d ON d.department_id = m.department_id AND d.deleted_at IS NULL
		WHERE c.curriculum_id = ? AND c.deleted_at IS NULL
	`
	var facultyID uint64
	if err := r.DB.QueryRowContext(ctx, query, curriculumID).Scan(&facultyID); err != nil {
		return 0, err
	}
	return facultyID, nil
}

func (r *TemplateRepository) GetTemplateCompetencyImpacts(ctx context.Context, templateID uint64, competencyIDs []uint64) ([]models.TemplateCompetencyImpact, error) {
	if len(competencyIDs) == 0 {
		return []models.TemplateCompetencyImpact{}, nil
	}

	placeholders, args := templateCompetencyPlaceholders(competencyIDs)
	query := fmt.Sprintf(`
		SELECT cti.competency_id, c.code, c.name_th, COUNT(*)
		FROM comp_template_items cti
		JOIN comp_competencies c ON c.competency_id = cti.competency_id
		WHERE cti.template_id = ?
		  AND cti.competency_id IN (%s)
		  AND cti.course_id IS NOT NULL
		  AND cti.deleted_at IS NULL
		GROUP BY cti.competency_id, c.code, c.name_th
		ORDER BY c.name_th, c.code
	`, placeholders)

	queryArgs := append([]any{templateID}, args...)
	rows, err := r.DB.QueryContext(ctx, query, queryArgs...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	impacts := make([]models.TemplateCompetencyImpact, 0)
	for rows.Next() {
		var impact models.TemplateCompetencyImpact
		if err := rows.Scan(&impact.CompetencyID, &impact.Code, &impact.NameTH, &impact.MappingCount); err != nil {
			return nil, err
		}
		impacts = append(impacts, impact)
	}
	return impacts, rows.Err()
}

// ReplaceTemplateCompetencies synchronizes template competency markers and removes related mappings.
func (r *TemplateRepository) ReplaceTemplateCompetencies(ctx context.Context, templateID uint64, competencyIDs, removedCompetencyIDs []uint64) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var lockedTemplateID uint64
	if err := tx.QueryRowContext(ctx, `SELECT template_id FROM comp_templates WHERE template_id = ? AND deleted_at IS NULL FOR UPDATE`, templateID).Scan(&lockedTemplateID); err != nil {
		return err
	}

	now := time.Now()
	if len(removedCompetencyIDs) > 0 {
		placeholders, args := templateCompetencyPlaceholders(removedCompetencyIDs)
		query := fmt.Sprintf(`
			UPDATE comp_template_items
			SET deleted_at = ?, updated_at = ?
			WHERE template_id = ?
			  AND competency_id IN (%s)
			  AND deleted_at IS NULL
		`, placeholders)
		queryArgs := append([]any{now, now, templateID}, args...)
		if _, err := tx.ExecContext(ctx, query, queryArgs...); err != nil {
			return fmt.Errorf("remove template competency mappings failed: %w", err)
		}
	}

	for index, competencyID := range competencyIDs {
		var markerID uint64
		err := tx.QueryRowContext(ctx, `
			SELECT template_item_id
			FROM comp_template_items
			WHERE template_id = ?
			  AND competency_id = ?
			  AND course_id IS NULL
			ORDER BY (deleted_at IS NULL) DESC, template_item_id DESC
			LIMIT 1
		`, templateID, competencyID).Scan(&markerID)
		if err != nil && err != sql.ErrNoRows {
			return fmt.Errorf("find template competency marker failed: %w", err)
		}

		if err == sql.ErrNoRows {
			if _, err := tx.ExecContext(ctx, `
				INSERT INTO comp_template_items (template_id, competency_id, course_id, display_order, is_active, created_at, updated_at)
				VALUES (?, ?, NULL, ?, 1, ?, ?)
			`, templateID, competencyID, index+1, now, now); err != nil {
				return fmt.Errorf("insert template competency marker failed: %w", err)
			}
			continue
		}

		if _, err := tx.ExecContext(ctx, `
			UPDATE comp_template_items
			SET deleted_at = NULL, display_order = ?, is_active = 1, updated_at = ?
			WHERE template_item_id = ?
		`, index+1, now, markerID); err != nil {
			return fmt.Errorf("restore template competency marker failed: %w", err)
		}
		if _, err := tx.ExecContext(ctx, `
			UPDATE comp_template_items
			SET deleted_at = ?, updated_at = ?
			WHERE template_id = ?
			  AND competency_id = ?
			  AND course_id IS NULL
			  AND template_item_id <> ?
			  AND deleted_at IS NULL
		`, now, now, templateID, competencyID, markerID); err != nil {
			return fmt.Errorf("deduplicate template competency markers failed: %w", err)
		}
	}

	return tx.Commit()
}

func (r *TemplateRepository) GetTemplateStructure(ctx context.Context, templateID uint64) (*models.TemplateStructureResponse, error) {
	items, err := r.GetTemplateItems(ctx, templateID)
	if err != nil {
		return nil, err
	}
	cats, err := r.GetTemplateCategories(ctx, templateID)
	if err != nil {
		return nil, err
	}
	courses, err := r.GetTemplateCourses(ctx, templateID)
	if err != nil {
		return nil, err
	}
	comps, err := r.GetTemplateCompetencies(ctx, templateID)
	if err != nil {
		return nil, err
	}
	if cats == nil {
		cats = []models.TemplateCategory{}
	}
	if courses == nil {
		courses = []models.TemplateCourse{}
	}
	if items == nil {
		items = []models.TemplateItem{}
	}
	if comps == nil {
		comps = []models.TemplateCompetency{}
	}
	return &models.TemplateStructureResponse{
		Items:            items,
		CustomCategories: cats,
		CustomCourses:    courses,
		Competencies:     comps,
	}, nil
}

func (r *TemplateRepository) SaveTemplateItems(ctx context.Context, templateID uint64, req models.UpdateTemplateItemsRequest) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// 0. Acquire exclusive row lock on template row to serialize concurrent saves and prevent InnoDB gap-lock deadlocks (Error 1213)
	var tID uint64
	err = tx.QueryRowContext(ctx, `SELECT template_id FROM comp_templates WHERE template_id = ? FOR UPDATE`, templateID).Scan(&tID)
	if err != nil && err != sql.ErrNoRows {
		return fmt.Errorf("lock template row failed: %w", err)
	}

	now := time.Now()
	catIDMap := make(map[uint64]uint64)
	courseIDMap := make(map[uint64]uint64)

	// 1. Soft delete existing custom categories and courses for this template
	_, err = tx.ExecContext(ctx, `UPDATE comp_template_categories SET deleted_at = ?, updated_at = ? WHERE template_id = ? AND deleted_at IS NULL`, now, now, templateID)
	if err != nil {
		return fmt.Errorf("clear old custom categories failed: %w", err)
	}
	_, err = tx.ExecContext(ctx, `UPDATE comp_template_courses SET deleted_at = ?, updated_at = ? WHERE template_id = ? AND deleted_at IS NULL`, now, now, templateID)
	if err != nil {
		return fmt.Errorf("clear old custom courses failed: %w", err)
	}

	// 2. Insert custom categories
	for idx, cat := range req.CustomCategories {
		var curriParentID, parentID sql.NullInt64
		if cat.CurriculumParentID != nil {
			curriParentID = sql.NullInt64{Int64: int64(*cat.CurriculumParentID), Valid: true}
		}
		if cat.ParentID != nil {
			pid := *cat.ParentID
			if newPID, exists := catIDMap[pid]; exists {
				pid = newPID
			}
			parentID = sql.NullInt64{Int64: int64(pid), Valid: true}
		}
		res, err := tx.ExecContext(ctx, `
			INSERT INTO comp_template_categories (template_id, curriculum_parent_id, parent_id, code, name, display_order, is_active, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, templateID, curriParentID, parentID, cat.Code, cat.Name, idx+1, cat.IsActive, now, now)
		if err != nil {
			return fmt.Errorf("insert custom category failed: %w", err)
		}
		newID, _ := res.LastInsertId()
		if cat.TemplateCategoryID != 0 {
			catIDMap[cat.TemplateCategoryID] = uint64(newID)
		}
	}

	// 3. Insert custom courses
	for idx, c := range req.CustomCourses {
		var curriCatID, tplCatID sql.NullInt64
		if c.CurriculumCategoryID != nil {
			curriCatID = sql.NullInt64{Int64: int64(*c.CurriculumCategoryID), Valid: true}
		}
		if c.TemplateCategoryID != nil {
			tid := *c.TemplateCategoryID
			if newTID, exists := catIDMap[tid]; exists {
				tid = newTID
			}
			tplCatID = sql.NullInt64{Int64: int64(tid), Valid: true}
		}
		res, err := tx.ExecContext(ctx, `
			INSERT INTO comp_template_courses (template_id, curriculum_category_id, template_category_id, code, name_th, name_en, credits, description, display_order, is_active, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, templateID, curriCatID, tplCatID, c.Code, c.NameTH, c.NameEN, c.Credits, c.Description, idx+1, c.IsActive, now, now)
		if err != nil {
			return fmt.Errorf("insert custom course failed: %w", err)
		}
		newID, _ := res.LastInsertId()
		if c.TemplateCourseID != 0 {
			courseIDMap[c.TemplateCourseID] = uint64(newID)
		}
	}

	// 4. Soft delete existing course mappings for this template
	_, err = tx.ExecContext(ctx, `
		UPDATE comp_template_items 
		SET deleted_at = ?, updated_at = ? 
		WHERE template_id = ? AND course_id IS NOT NULL AND deleted_at IS NULL
	`, now, now, templateID)
	if err != nil {
		return fmt.Errorf("clear old course items failed: %w", err)
	}

	// 5. Insert new mappings
	for idx, item := range req.Items {
		cID := item.CourseID
		if item.IsCustomCourse {
			if newCID, exists := courseIDMap[cID]; exists {
				cID = newCID
			}
		}
		customInt := 0
		if item.IsCustomCourse {
			customInt = 1
		}
		_, err = tx.ExecContext(ctx, `
			INSERT INTO comp_template_items (template_id, competency_id, course_id, is_custom_course, weight, display_order, is_active, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
		`, templateID, item.CompetencyID, cID, customInt, item.Weight, idx+1, now, now)
		if err != nil {
			return fmt.Errorf("insert template item failed for course %d comp %d: %w", cID, item.CompetencyID, err)
		}
	}

	return tx.Commit()
}
