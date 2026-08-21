package repositories

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/spw32767/university-competency-system-backend/models"
)

func (r *CurriculumRepository) UpdateCurriculumMetadataTx(ctx context.Context, curriculumID uint64, payload models.UpdateCurriculumMetadataPayload, targetMajor MajorScope, updateCourseContext bool) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	result, err := tx.ExecContext(ctx, `
		UPDATE edu_curricula
		SET major_id = ?,
			code = ?,
			name_th = ?,
			name_en = ?,
			effective_year_be = ?,
			updated_at = NOW()
		WHERE curriculum_id = ?
			AND deleted_at IS NULL
	`, payload.MajorID, payload.CurriculumCode, payload.CurriculumNameTH, payload.CurriculumNameEN, payload.EffectiveYearBE, curriculumID)
	if err != nil {
		return err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return sql.ErrNoRows
	}

	if updateCourseContext {
		if _, err := tx.ExecContext(ctx, `
			UPDATE crs_courses
			SET faculty_id = ?,
				degree_level = ?,
				updated_at = NOW()
			WHERE curriculum_id = ?
		`, targetMajor.FacultyID, targetMajor.DegreeLevel, curriculumID); err != nil {
			return err
		}
	}

	return tx.Commit()
}

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
		FROM comp_templates tpl
		WHERE tpl.curriculum_id = ?
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
			tpl.template_id,
			tpl.template_id,
			tpl.code,
			tpl.name,
			COALESCE(sc.entry_year_be, 0),
			1,
			tpl.is_active
		FROM comp_templates tpl
		LEFT JOIN curri_template_assignments ta ON ta.template_id = tpl.template_id AND ta.deleted_at IS NULL
		LEFT JOIN edu_student_cohorts sc ON sc.cohort_id = ta.cohort_id AND sc.deleted_at IS NULL
		WHERE tpl.curriculum_id = ?
			AND tpl.deleted_at IS NULL
		ORDER BY sc.entry_year_be DESC, tpl.template_id DESC
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

// UpdateCategoryWithCodeCascade persists a category edit and the code changes
// inherited by descendants as one unit. display_order remains independent from code.
func (r *CurriculumRepository) UpdateCategoryWithCodeCascade(ctx context.Context, curriculumID uint64, categoryID uint64, payload models.UpdateCurriculumCategoryPayload, codeUpdates map[uint64]string) error {
	var parentID any
	if payload.ParentID.Set && payload.ParentID.Valid {
		parentID = payload.ParentID.Value
	}

	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	res, err := tx.ExecContext(ctx, `
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

	for descendantID, code := range codeUpdates {
		if descendantID == categoryID {
			continue
		}
		if _, err := tx.ExecContext(ctx, `
			UPDATE crs_course_categories
			SET code = ?, updated_at = NOW()
			WHERE curriculum_id = ?
				AND category_id = ?
				AND deleted_at IS NULL
		`, code, curriculumID, descendantID); err != nil {
			return err
		}
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

func (r *CurriculumRepository) CommitCurriculumStructureImport(ctx context.Context, curriculumID uint64, plan models.CurriculumStructureImportPlan, opts CreateCurriculumOptions) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	rows, err := tx.QueryContext(ctx, `
		SELECT category_id, code
		FROM crs_course_categories
		WHERE curriculum_id = ?
			AND deleted_at IS NULL
	`, curriculumID)
	if err != nil {
		return err
	}
	categoryIDs := map[string]uint64{}
	for rows.Next() {
		var categoryID uint64
		var code sql.NullString
		if err := rows.Scan(&categoryID, &code); err != nil {
			rows.Close()
			return err
		}
		if code.Valid && strings.TrimSpace(code.String) != "" {
			categoryIDs[strings.ToLower(strings.TrimSpace(code.String))] = categoryID
		}
	}
	if err := rows.Close(); err != nil {
		return err
	}

	nextCategoryOrder := map[uint64]int{}
	for _, category := range plan.Categories {
		var parentID any
		var parentKey uint64
		if category.ParentCode != "" {
			resolvedParentID, ok := categoryIDs[strings.ToLower(category.ParentCode)]
			if !ok {
				return fmt.Errorf("import parent category %q was not found", category.ParentCode)
			}
			parentID = resolvedParentID
			parentKey = resolvedParentID
		}
		if _, loaded := nextCategoryOrder[parentKey]; !loaded {
			var displayOrder int
			if err := tx.QueryRowContext(ctx, `
				SELECT COALESCE(MAX(display_order), 0)
				FROM crs_course_categories
				WHERE curriculum_id = ?
					AND parent_id <=> ?
					AND deleted_at IS NULL
			`, curriculumID, parentID).Scan(&displayOrder); err != nil {
				return err
			}
			nextCategoryOrder[parentKey] = displayOrder
		}
		nextCategoryOrder[parentKey]++
		res, err := tx.ExecContext(ctx, `
			INSERT INTO crs_course_categories (curriculum_id, parent_id, code, name_th, required_credits, display_order, is_active)
			VALUES (?, ?, ?, ?, 0, ?, 1)
		`, curriculumID, parentID, category.Code, category.NameTH, nextCategoryOrder[parentKey])
		if err != nil {
			return err
		}
		categoryID, err := res.LastInsertId()
		if err != nil {
			return err
		}
		categoryIDs[strings.ToLower(category.Code)] = uint64(categoryID)
	}

	nextCourseOrder := map[uint64]int{}
	for _, course := range plan.Courses {
		categoryID, ok := categoryIDs[strings.ToLower(course.CategoryCode)]
		if !ok {
			return fmt.Errorf("import category %q was not found", course.CategoryCode)
		}
		if _, loaded := nextCourseOrder[categoryID]; !loaded {
			var displayOrder int
			if err := tx.QueryRowContext(ctx, `
				SELECT COALESCE(MAX(display_order), 0)
				FROM crs_curriculum_courses
				WHERE category_id = ?
					AND deleted_at IS NULL
			`, categoryID).Scan(&displayOrder); err != nil {
				return err
			}
			nextCourseOrder[categoryID] = displayOrder
		}
		nextCourseOrder[categoryID]++
		courseID, err := r.createCourse(ctx, tx, curriculumID, models.CreateCourseInCatPayload{
			Code: course.Code, NameTH: course.NameTH, NameEN: course.NameEN, Credits: course.Credits,
		}, opts)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO crs_curriculum_courses (category_id, course_id, is_required, display_order, is_active)
			VALUES (?, ?, 1, ?, 1)
		`, categoryID, courseID, nextCourseOrder[categoryID]); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (r *CurriculumRepository) UpdateCourseForCurriculum(ctx context.Context, curriculumID uint64, courseID uint64, payload models.UpdateCurriculumCourseDetailPayload) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	res, err := tx.ExecContext(ctx, `
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
		var exists int
		err := tx.QueryRowContext(ctx, `
			SELECT 1
			FROM crs_courses
			WHERE curriculum_id = ?
				AND course_id = ?
				AND deleted_at IS NULL
			LIMIT 1
		`, curriculumID, courseID).Scan(&exists)
		if err == sql.ErrNoRows {
			return sql.ErrNoRows
		}
		if err != nil {
			return err
		}
	}

	if payload.IsRequired != nil {
		if _, err := tx.ExecContext(ctx, `
			UPDATE crs_curriculum_courses cc
			JOIN crs_course_categories cat ON cat.category_id = cc.category_id
			SET cc.is_required = ?
			WHERE cc.course_id = ?
				AND cat.curriculum_id = ?
				AND cat.deleted_at IS NULL
				AND cc.deleted_at IS NULL
		`, *payload.IsRequired, courseID, curriculumID); err != nil {
			return err
		}
	}

	return tx.Commit()
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
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var courseID uint64
	if err := tx.QueryRowContext(ctx, `
		SELECT cc.course_id
		FROM crs_curriculum_courses cc
		JOIN crs_course_categories cat ON cat.category_id = cc.category_id
		WHERE cc.curriculum_course_id = ?
			AND cat.curriculum_id = ?
			AND cat.deleted_at IS NULL
			AND cc.deleted_at IS NULL
	`, curriculumCourseID, curriculumID).Scan(&courseID); err != nil {
		return err
	}

	res, err := tx.ExecContext(ctx, `
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

	if err := retireTemplateMappingsForRemovedCourseTx(ctx, tx, curriculumID, courseID); err != nil {
		return err
	}

	return tx.Commit()
}

// retireTemplateMappingsForRemovedCourseTx retires mappings only when the
// course no longer has any active placement in the owning Curriculum. This
// preserves a mapping when the same course is still placed in another category.
func retireTemplateMappingsForRemovedCourseTx(ctx context.Context, tx *sql.Tx, curriculumID, courseID uint64) error {
	_, err := tx.ExecContext(ctx, `
		UPDATE comp_template_items cti
		JOIN curri_curriculum_templates cct ON cct.template_id = cti.template_id
		SET cti.is_active = 0,
			cti.deleted_at = NOW()
		WHERE cct.curriculum_id = ?
			AND cct.deleted_at IS NULL
			AND cti.course_id = ?
			AND (cti.is_custom_course = 0 OR cti.is_custom_course IS NULL)
			AND cti.deleted_at IS NULL
			AND NOT EXISTS (
				SELECT 1
				FROM curri_curriculum_templates current_cct
				JOIN crs_curriculum_courses remaining ON remaining.course_id = cti.course_id
				JOIN crs_course_categories remaining_cat ON remaining_cat.category_id = remaining.category_id
				WHERE current_cct.template_id = cti.template_id
					AND current_cct.deleted_at IS NULL
					AND remaining_cat.curriculum_id = current_cct.curriculum_id
					AND remaining.course_id = cti.course_id
					AND remaining.is_active = 1
					AND remaining.deleted_at IS NULL
					AND remaining_cat.is_active = 1
					AND remaining_cat.deleted_at IS NULL
			)
	`, curriculumID, courseID)
	return err
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

func (r *CurriculumRepository) DeleteCategoryTx(ctx context.Context, curriculumID uint64, preview *models.DeleteCategoryPreview) error {
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
		if err := retireTemplateMappingsForRemovedCategoriesTx(ctx, tx, curriculumID, preview.SubtreeCategoryIDs); err != nil {
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

func retireTemplateMappingsForRemovedCategoriesTx(ctx context.Context, tx *sql.Tx, curriculumID uint64, categoryIDs []uint64) error {
	if len(categoryIDs) == 0 {
		return nil
	}

	categoryPlaceholders := placeholders(len(categoryIDs))
	categoryArgs := uint64sToAny(categoryIDs)
	args := append([]any{curriculumID}, categoryArgs...)
	_, err := tx.ExecContext(ctx, fmt.Sprintf(`
		UPDATE comp_template_items cti
		JOIN curri_curriculum_templates cct ON cct.template_id = cti.template_id
		JOIN crs_curriculum_courses removed ON removed.course_id = cti.course_id
		SET cti.is_active = 0,
			cti.deleted_at = NOW()
		WHERE cct.curriculum_id = ?
			AND cct.deleted_at IS NULL
			AND removed.category_id IN (%s)
			AND (cti.is_custom_course = 0 OR cti.is_custom_course IS NULL)
			AND cti.deleted_at IS NULL
			AND NOT EXISTS (
				SELECT 1
				FROM crs_curriculum_courses remaining
				JOIN crs_course_categories remaining_cat ON remaining_cat.category_id = remaining.category_id
				WHERE remaining.course_id = cti.course_id
					AND remaining_cat.curriculum_id = cct.curriculum_id
					AND remaining.is_active = 1
					AND remaining.deleted_at IS NULL
					AND remaining_cat.is_active = 1
					AND remaining_cat.deleted_at IS NULL
			)
	`, categoryPlaceholders), args...)
	return err
}

func (r *CurriculumRepository) CountConnectedTemplatesForCurriculum(ctx context.Context, curriculumID uint64) (int, error) {
	var count int
	err := r.DB.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM comp_templates tpl
		WHERE tpl.curriculum_id = ?
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
