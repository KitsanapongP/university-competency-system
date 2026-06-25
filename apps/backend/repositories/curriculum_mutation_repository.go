package repositories

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/spw32767/university-competency-system-backend/models"
)

func (r *CurriculumRepository) GetCategoryForCurriculum(ctx context.Context, curriculumID uint64, categoryID uint64) (*models.CourseCategoryNode, error) {
	query := `
		SELECT category_id, curriculum_id, parent_id, code, name_th, name_en, required_credits, display_order, is_active, created_at, updated_at, deleted_at
		FROM crs_course_categories
		WHERE curriculum_id = ?
			AND category_id = ?
			AND deleted_at IS NULL
	`

	return scanCourseCategoryNode(r.DB.QueryRowContext(ctx, query, curriculumID, categoryID))
}

func (r *CurriculumRepository) GetCurriculumCourseForCurriculum(ctx context.Context, curriculumID uint64, curriculumCourseID uint64) (*models.CurriculumCourseRow, error) {
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
		WHERE cc.curriculum_course_id = ?
			AND cat.curriculum_id = ?
			AND cat.deleted_at IS NULL
			AND cc.deleted_at IS NULL
			AND course.deleted_at IS NULL
			AND course.curriculum_id = cat.curriculum_id
	`

	return scanCurriculumCourseRow(r.DB.QueryRowContext(ctx, query, curriculumCourseID, curriculumID))
}

func (r *CurriculumRepository) CountActiveTemplatesForCurriculum(ctx context.Context, curriculumID uint64) (int, error) {
	query := `
		SELECT COUNT(*)
		FROM curri_curriculum_templates cct
		JOIN comp_templates tpl ON tpl.template_id = cct.template_id
		WHERE cct.curriculum_id = ?
			AND cct.deleted_at IS NULL
			AND cct.is_active = 1
			AND tpl.deleted_at IS NULL
			AND tpl.is_active = 1
	`

	var count int
	if err := r.DB.QueryRowContext(ctx, query, curriculumID).Scan(&count); err != nil {
		return 0, err
	}

	return count, nil
}

func (r *CurriculumRepository) GetAffectedTemplatesForCurriculum(ctx context.Context, curriculumID uint64) ([]models.AffectedTemplate, error) {
	query := `
		SELECT
			cct.curriculum_template_id,
			cct.template_id,
			tpl.code,
			tpl.name,
			cct.cohort_year_be,
			cct.is_active,
			tpl.is_active
		FROM curri_curriculum_templates cct
		JOIN comp_templates tpl ON tpl.template_id = cct.template_id
		WHERE cct.curriculum_id = ?
			AND cct.deleted_at IS NULL
			AND tpl.deleted_at IS NULL
		ORDER BY cct.cohort_year_be DESC, cct.curriculum_template_id DESC
	`

	rows, err := r.DB.QueryContext(ctx, query, curriculumID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	templates := []models.AffectedTemplate{}
	for rows.Next() {
		var template models.AffectedTemplate
		var linkActive bool
		var templateActive bool

		if err := rows.Scan(
			&template.CurriculumTemplateID,
			&template.TemplateID,
			&template.Code,
			&template.Name,
			&template.CohortYearBE,
			&linkActive,
			&templateActive,
		); err != nil {
			return nil, err
		}

		template.IsActive = linkActive && templateActive
		template.Severity = "warning"
		if template.IsActive {
			template.Severity = "critical"
		}
		templates = append(templates, template)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return templates, nil
}

func (r *CurriculumRepository) ValidateCurriculumStructure(ctx context.Context, curriculumID uint64) ([]string, error) {
	violations := []string{}

	categoryCount, err := r.countCurriculumCategories(ctx, curriculumID)
	if err != nil {
		return nil, err
	}
	if categoryCount == 0 {
		violations = append(violations, "curriculum must have at least one category")
	}

	courseCount, err := r.countCurriculumCoursePlacements(ctx, curriculumID)
	if err != nil {
		return nil, err
	}
	if courseCount == 0 {
		violations = append(violations, "curriculum must have at least one course")
	}

	invalidCourseCount, err := r.countInvalidCurriculumCourses(ctx, curriculumID)
	if err != nil {
		return nil, err
	}
	if invalidCourseCount > 0 {
		violations = append(violations, "all courses must have code, name_th, and credits >= 0")
	}

	duplicateCodeCount, err := r.countDuplicateCurriculumCourseCodes(ctx, curriculumID)
	if err != nil {
		return nil, err
	}
	if duplicateCodeCount > 0 {
		violations = append(violations, "course code must be unique within the curriculum")
	}

	return violations, nil
}

func (r *CurriculumRepository) countCurriculumCategories(ctx context.Context, curriculumID uint64) (int, error) {
	var count int
	err := r.DB.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM crs_course_categories
		WHERE curriculum_id = ?
			AND deleted_at IS NULL
	`, curriculumID).Scan(&count)
	return count, err
}

func (r *CurriculumRepository) countCurriculumCoursePlacements(ctx context.Context, curriculumID uint64) (int, error) {
	var count int
	err := r.DB.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM crs_curriculum_courses cc
		JOIN crs_course_categories cat ON cat.category_id = cc.category_id
		JOIN crs_courses course ON course.course_id = cc.course_id
		WHERE cat.curriculum_id = ?
			AND cc.deleted_at IS NULL
			AND cat.deleted_at IS NULL
			AND course.deleted_at IS NULL
			AND course.curriculum_id = cat.curriculum_id
	`, curriculumID).Scan(&count)
	return count, err
}

func (r *CurriculumRepository) countInvalidCurriculumCourses(ctx context.Context, curriculumID uint64) (int, error) {
	var count int
	err := r.DB.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM crs_curriculum_courses cc
		JOIN crs_course_categories cat ON cat.category_id = cc.category_id
		JOIN crs_courses course ON course.course_id = cc.course_id
		WHERE cat.curriculum_id = ?
			AND cc.deleted_at IS NULL
			AND cat.deleted_at IS NULL
			AND course.deleted_at IS NULL
			AND course.curriculum_id = cat.curriculum_id
			AND (
				TRIM(course.code) = ''
				OR TRIM(course.name_th) = ''
				OR course.credits < 0
			)
	`, curriculumID).Scan(&count)
	return count, err
}

func (r *CurriculumRepository) countDuplicateCurriculumCourseCodes(ctx context.Context, curriculumID uint64) (int, error) {
	var count int
	err := r.DB.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM (
			SELECT LOWER(TRIM(course.code)) AS normalized_code
			FROM crs_curriculum_courses cc
			JOIN crs_course_categories cat ON cat.category_id = cc.category_id
			JOIN crs_courses course ON course.course_id = cc.course_id
			WHERE cat.curriculum_id = ?
				AND cc.deleted_at IS NULL
				AND cat.deleted_at IS NULL
				AND course.deleted_at IS NULL
				AND course.curriculum_id = cat.curriculum_id
			GROUP BY LOWER(TRIM(course.code))
			HAVING COUNT(*) > 1
		) duplicate_codes
	`, curriculumID).Scan(&count)
	return count, err
}

func (r *CurriculumRepository) UpdateCurriculumStatus(ctx context.Context, curriculumID uint64, status string) error {
	res, err := r.DB.ExecContext(ctx, `
		UPDATE edu_curricula
		SET status = ?
		WHERE curriculum_id = ?
			AND deleted_at IS NULL
	`, status, curriculumID)
	if err != nil {
		return err
	}

	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return sql.ErrNoRows
	}

	return nil
}

func (r *CurriculumRepository) CreateCategory(ctx context.Context, curriculumID uint64, payload models.CreateCurriculumCategoryPayload) error {
	_, err := r.DB.ExecContext(ctx, `
		INSERT INTO crs_course_categories (curriculum_id, parent_id, code, name_th, name_en, required_credits, display_order, is_active)
		VALUES (?, ?, ?, ?, ?, ?, ?, 1)
	`, curriculumID, payload.ParentID, payload.Code, payload.NameTH, payload.NameEN, payload.RequiredCredits, payload.DisplayOrder)
	return err
}

func (r *CurriculumRepository) UpdateCategory(ctx context.Context, curriculumID uint64, categoryID uint64, payload models.UpdateCurriculumCategoryPayload) error {
	var parentID any
	if payload.ParentID.Set && payload.ParentID.Valid {
		parentID = payload.ParentID.Value
	}

	res, err := r.DB.ExecContext(ctx, `
		UPDATE crs_course_categories
		SET parent_id = CASE WHEN ? THEN ? ELSE parent_id END,
			code = COALESCE(?, code),
			name_th = COALESCE(?, name_th),
			name_en = COALESCE(?, name_en),
			required_credits = COALESCE(?, required_credits),
			display_order = COALESCE(?, display_order)
		WHERE curriculum_id = ?
			AND category_id = ?
			AND deleted_at IS NULL
	`, payload.ParentID.Set, parentID, payload.Code, payload.NameTH, payload.NameEN, payload.RequiredCredits, payload.DisplayOrder, curriculumID, categoryID)
	if err != nil {
		return err
	}

	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return sql.ErrNoRows
	}

	return nil
}

func (r *CurriculumRepository) RenumberCategoryCodes(ctx context.Context, curriculumID uint64) error {
	categories, err := r.getCurriculumCategories(ctx, curriculumID)
	if err != nil {
		return err
	}

	childrenByParent := make(map[uint64][]*models.CourseCategoryNode)
	roots := make([]*models.CourseCategoryNode, 0)
	for _, category := range categories {
		if category.ParentID == nil {
			roots = append(roots, category)
			continue
		}
		childrenByParent[*category.ParentID] = append(childrenByParent[*category.ParentID], category)
	}

	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var updateCodes func(nodes []*models.CourseCategoryNode, parentCode string) error
	updateCodes = func(nodes []*models.CourseCategoryNode, parentCode string) error {
		for index, category := range nodes {
			code := fmt.Sprintf("%d", index+1)
			if parentCode != "" {
				code = fmt.Sprintf("%s.%d", parentCode, index+1)
			}

			currentCode := ""
			if category.Code != nil {
				currentCode = *category.Code
			}
			if currentCode != code {
				if _, err := tx.ExecContext(ctx, `
					UPDATE crs_course_categories
					SET code = ?, updated_at = NOW()
					WHERE curriculum_id = ?
						AND category_id = ?
						AND deleted_at IS NULL
				`, code, curriculumID, category.CategoryID); err != nil {
					return err
				}
			}

			if err := updateCodes(childrenByParent[category.CategoryID], code); err != nil {
				return err
			}
		}
		return nil
	}

	if err := updateCodes(roots, ""); err != nil {
		return err
	}

	return tx.Commit()
}

func (r *CurriculumRepository) CreateCourseInCategoryTx(ctx context.Context, curriculumID uint64, categoryID uint64, payload models.CreateCurriculumCoursePayload, opts CreateCurriculumOptions) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	coursePayload := models.CreateCourseInCatPayload{
		Code:        payload.Code,
		NameTH:      payload.NameTH,
		NameEN:      payload.NameEN,
		Credits:     payload.Credits,
		Description: payload.Description,
	}
	courseID, err := r.createCourse(ctx, tx, curriculumID, coursePayload, opts)
	if err != nil {
		return err
	}

	_, err = tx.ExecContext(ctx, `
		INSERT INTO crs_curriculum_courses (category_id, course_id, is_required, display_order, is_active)
		VALUES (?, ?, ?, ?, 1)
	`, categoryID, courseID, payload.IsRequired, payload.DisplayOrder)
	if err != nil {
		return fmt.Errorf("link course %q to category %d: %w", payload.Code, categoryID, err)
	}

	return tx.Commit()
}

func (r *CurriculumRepository) UpdateCourseForCurriculum(ctx context.Context, curriculumID uint64, courseID uint64, payload models.UpdateCurriculumCourseDetailPayload) error {
	res, err := r.DB.ExecContext(ctx, `
		UPDATE crs_courses
		SET code = COALESCE(?, code),
			name_th = COALESCE(?, name_th),
			name_en = COALESCE(?, name_en),
			credits = COALESCE(?, credits),
			description = COALESCE(?, description)
		WHERE curriculum_id = ?
			AND course_id = ?
			AND deleted_at IS NULL
	`, payload.Code, payload.NameTH, payload.NameEN, payload.Credits, payload.Description, curriculumID, courseID)
	if err != nil {
		return err
	}

	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		exists, err := r.curriculumCourseRecordExists(ctx, curriculumID, courseID)
		if err != nil {
			return err
		}
		if !exists {
			return sql.ErrNoRows
		}
	}

	return nil
}

func (r *CurriculumRepository) curriculumCourseRecordExists(ctx context.Context, curriculumID uint64, courseID uint64) (bool, error) {
	var exists int
	err := r.DB.QueryRowContext(ctx, `
		SELECT 1
		FROM crs_courses
		WHERE curriculum_id = ?
			AND course_id = ?
			AND deleted_at IS NULL
		LIMIT 1
	`, curriculumID, courseID).Scan(&exists)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

func (r *CurriculumRepository) UpdateCurriculumCoursePlacement(ctx context.Context, curriculumID uint64, curriculumCourseID uint64, payload models.UpdateCurriculumCoursePlacementPayload) error {
	res, err := r.DB.ExecContext(ctx, `
		UPDATE crs_curriculum_courses cc
		JOIN crs_course_categories cat ON cat.category_id = cc.category_id
		SET cc.category_id = COALESCE(?, cc.category_id),
			cc.is_required = COALESCE(?, cc.is_required),
			cc.is_locked = COALESCE(?, cc.is_locked),
			cc.display_order = COALESCE(?, cc.display_order)
		WHERE cc.curriculum_course_id = ?
			AND cat.curriculum_id = ?
			AND cat.deleted_at IS NULL
			AND cc.deleted_at IS NULL
	`, payload.CategoryID, payload.IsRequired, payload.IsLocked, payload.DisplayOrder, curriculumCourseID, curriculumID)
	if err != nil {
		return err
	}

	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return sql.ErrNoRows
	}

	return nil
}

func (r *CurriculumRepository) SoftRemoveCurriculumCourse(ctx context.Context, curriculumID uint64, curriculumCourseID uint64) error {
	res, err := r.DB.ExecContext(ctx, `
		UPDATE crs_curriculum_courses cc
		JOIN crs_course_categories cat ON cat.category_id = cc.category_id
		SET cc.is_active = 0,
			cc.deleted_at = NOW()
		WHERE cc.curriculum_course_id = ?
			AND cat.curriculum_id = ?
			AND cat.deleted_at IS NULL
			AND cc.deleted_at IS NULL
	`, curriculumCourseID, curriculumID)
	if err != nil {
		return err
	}

	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return sql.ErrNoRows
	}

	return nil
}

func (r *CurriculumRepository) GetCategoryDeletePreview(ctx context.Context, curriculumID uint64, categoryID uint64) (*models.DeleteCategoryPreview, error) {
	category, err := r.GetCategoryForCurriculum(ctx, curriculumID, categoryID)
	if err != nil {
		return nil, err
	}

	subtreeIDs, err := r.GetCategorySubtreeIDs(ctx, curriculumID, categoryID)
	if err != nil {
		return nil, err
	}

	target, err := r.findCategoryDeleteTarget(ctx, category)
	if err != nil {
		return nil, err
	}

	affectedCourseIDs, err := r.getCurriculumCourseIDsInCategories(ctx, subtreeIDs)
	if err != nil {
		return nil, err
	}

	affectedTemplates, err := r.GetAffectedTemplatesForCurriculum(ctx, curriculumID)
	if err != nil {
		return nil, err
	}

	preview := &models.DeleteCategoryPreview{
		CategoryID:                  category.CategoryID,
		CategoryNameTH:              category.NameTH,
		SubtreeCategoryIDs:          subtreeIDs,
		AffectedCurriculumCourseIDs: affectedCourseIDs,
		AffectedTemplates:           affectedTemplates,
	}

	if target != nil {
		preview.MoveTargetCategoryID = &target.CategoryID
		preview.MoveTargetCategoryNameTH = &target.NameTH
	} else {
		preview.SoftRemovedCurriculumCourseIDs = affectedCourseIDs
	}

	return preview, nil
}

func (r *CurriculumRepository) GetCategorySubtreeIDs(ctx context.Context, curriculumID uint64, categoryID uint64) ([]uint64, error) {
	query := `
		WITH RECURSIVE category_tree AS (
			SELECT category_id
			FROM crs_course_categories
			WHERE curriculum_id = ?
				AND category_id = ?
				AND deleted_at IS NULL
			UNION ALL
			SELECT child.category_id
			FROM crs_course_categories child
			JOIN category_tree parent ON parent.category_id = child.parent_id
			WHERE child.curriculum_id = ?
				AND child.deleted_at IS NULL
		)
		SELECT category_id
		FROM category_tree
	`

	rows, err := r.DB.QueryContext(ctx, query, curriculumID, categoryID, curriculumID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ids := []uint64{}
	for rows.Next() {
		var id uint64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return nil, sql.ErrNoRows
	}

	return ids, nil
}

func (r *CurriculumRepository) findCategoryDeleteTarget(ctx context.Context, category *models.CourseCategoryNode) (*models.CourseCategoryNode, error) {
	previousSibling, err := r.findSiblingCategory(ctx, category, true)
	if err != nil {
		return nil, err
	}
	if previousSibling != nil {
		return previousSibling, nil
	}

	nextSibling, err := r.findSiblingCategory(ctx, category, false)
	if err != nil {
		return nil, err
	}
	if nextSibling != nil {
		return nextSibling, nil
	}

	if category.ParentID != nil {
		return r.GetCategoryForCurriculum(ctx, category.CurriculumID, *category.ParentID)
	}

	return nil, nil
}

func (r *CurriculumRepository) findSiblingCategory(ctx context.Context, category *models.CourseCategoryNode, previous bool) (*models.CourseCategoryNode, error) {
	comparison := ">"
	order := "ASC"
	categoryComparison := ">"
	if previous {
		comparison = "<"
		order = "DESC"
		categoryComparison = "<"
	}

	var query string
	args := []any{category.CurriculumID, category.CategoryID, category.DisplayOrder, category.DisplayOrder, category.CategoryID}
	if category.ParentID == nil {
		query = fmt.Sprintf(`
			SELECT category_id, curriculum_id, parent_id, code, name_th, name_en, required_credits, display_order, is_active, created_at, updated_at, deleted_at
			FROM crs_course_categories
			WHERE curriculum_id = ?
				AND parent_id IS NULL
				AND category_id <> ?
				AND deleted_at IS NULL
				AND (display_order %s ? OR (display_order = ? AND category_id %s ?))
			ORDER BY display_order %s, category_id %s
			LIMIT 1
		`, comparison, categoryComparison, order, order)
	} else {
		query = fmt.Sprintf(`
			SELECT category_id, curriculum_id, parent_id, code, name_th, name_en, required_credits, display_order, is_active, created_at, updated_at, deleted_at
			FROM crs_course_categories
			WHERE curriculum_id = ?
				AND parent_id = ?
				AND category_id <> ?
				AND deleted_at IS NULL
				AND (display_order %s ? OR (display_order = ? AND category_id %s ?))
			ORDER BY display_order %s, category_id %s
			LIMIT 1
		`, comparison, categoryComparison, order, order)
		args = []any{category.CurriculumID, *category.ParentID, category.CategoryID, category.DisplayOrder, category.DisplayOrder, category.CategoryID}
	}

	sibling, err := scanCourseCategoryNode(r.DB.QueryRowContext(ctx, query, args...))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return sibling, nil
}

func (r *CurriculumRepository) getCurriculumCourseIDsInCategories(ctx context.Context, categoryIDs []uint64) ([]uint64, error) {
	if len(categoryIDs) == 0 {
		return []uint64{}, nil
	}

	query := fmt.Sprintf(`
		SELECT curriculum_course_id
		FROM crs_curriculum_courses
		WHERE deleted_at IS NULL
			AND category_id IN (%s)
		ORDER BY curriculum_course_id
	`, placeholders(len(categoryIDs)))

	args := uint64sToAny(categoryIDs)
	rows, err := r.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ids := []uint64{}
	for rows.Next() {
		var id uint64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return ids, nil
}

func (r *CurriculumRepository) DeleteCategoryTx(ctx context.Context, preview *models.DeleteCategoryPreview) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	categoryPlaceholders := placeholders(len(preview.SubtreeCategoryIDs))
	categoryArgs := uint64sToAny(preview.SubtreeCategoryIDs)

	if preview.MoveTargetCategoryID != nil {
		args := append([]any{*preview.MoveTargetCategoryID}, categoryArgs...)
		_, err = tx.ExecContext(ctx, fmt.Sprintf(`
			UPDATE crs_curriculum_courses
			SET category_id = ?
			WHERE deleted_at IS NULL
				AND category_id IN (%s)
		`, categoryPlaceholders), args...)
		if err != nil {
			return err
		}
	} else {
		_, err = tx.ExecContext(ctx, fmt.Sprintf(`
			UPDATE crs_curriculum_courses
			SET is_active = 0,
				deleted_at = NOW()
			WHERE deleted_at IS NULL
				AND category_id IN (%s)
		`, categoryPlaceholders), categoryArgs...)
		if err != nil {
			return err
		}
	}

	_, err = tx.ExecContext(ctx, fmt.Sprintf(`
		UPDATE crs_course_categories
		SET is_active = 0,
			deleted_at = NOW()
		WHERE deleted_at IS NULL
			AND category_id IN (%s)
	`, categoryPlaceholders), categoryArgs...)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (r *CurriculumRepository) CountConnectedTemplatesForCurriculum(ctx context.Context, curriculumID uint64) (int, error) {
	var count int
	err := r.DB.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM curri_curriculum_templates cct
		JOIN comp_templates tpl ON tpl.template_id = cct.template_id
		WHERE cct.curriculum_id = ?
			AND cct.deleted_at IS NULL
			AND tpl.deleted_at IS NULL
	`, curriculumID).Scan(&count)
	return count, err
}

func (r *CurriculumRepository) CountCurriculumRealUsage(ctx context.Context, curriculumID uint64) (int, error) {
	var count int
	err := r.DB.QueryRowContext(ctx, `
		SELECT
			CASE WHEN
				EXISTS (
					SELECT 1
					FROM kku_enrollment_curricula kec
					WHERE kec.curriculum_id = ?
						AND kec.deleted_at IS NULL
				)
				OR EXISTS (
					SELECT 1
					FROM crs_course_enrollment cce
					JOIN crs_courses course ON course.course_id = cce.course_id
					WHERE course.curriculum_id = ?
						AND course.deleted_at IS NULL
						AND cce.deleted_at IS NULL
				)
				OR EXISTS (
					SELECT 1
					FROM score_course_competency_scores score
					JOIN crs_course_enrollment cce ON cce.course_student_id = score.course_student_id
					JOIN crs_courses course ON course.course_id = cce.course_id
					WHERE course.curriculum_id = ?
						AND course.deleted_at IS NULL
						AND cce.deleted_at IS NULL
						AND score.deleted_at IS NULL
				)
			THEN 1 ELSE 0 END
	`, curriculumID, curriculumID, curriculumID).Scan(&count)
	return count, err
}

func (r *CurriculumRepository) SoftDeleteCurriculum(ctx context.Context, curriculumID uint64) error {
	res, err := r.DB.ExecContext(ctx, `
		UPDATE edu_curricula
		SET deleted_at = NOW(),
			updated_at = NOW()
		WHERE curriculum_id = ?
			AND deleted_at IS NULL
	`, curriculumID)
	if err != nil {
		return err
	}

	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return sql.ErrNoRows
	}

	return nil
}

func placeholders(count int) string {
	if count <= 0 {
		return ""
	}
	return strings.TrimRight(strings.Repeat("?,", count), ",")
}

func uint64sToAny(values []uint64) []any {
	args := make([]any, 0, len(values))
	for _, value := range values {
		args = append(args, value)
	}
	return args
}
