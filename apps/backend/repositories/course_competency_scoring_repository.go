package repositories

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/spw32767/university-competency-system-backend/models"
)

type CourseCompetencyScoringRepository struct{ DB *sql.DB }

func NewCourseCompetencyScoringRepository(db *sql.DB) *CourseCompetencyScoringRepository {
	return &CourseCompetencyScoringRepository{DB: db}
}

type courseMapping struct {
	TemplateItemID uint64
	CourseID       uint64
	CompetencyID   uint64
	Weight         float64
	IsCore         bool
}

type courseGrade struct {
	CourseStudentID uint64
	EnrollmentID    uint64
	StudentCode     string
	CourseID        uint64
	CourseCode      string
	Grade           string
}

func (r *CourseCompetencyScoringRepository) GetRequirements(ctx context.Context, cohortID uint64) ([]models.CohortCompetencyRequirement, error) {
	const query = `
		SELECT selected.competency_id, comp.code, comp.name_th, COALESCE(req.target_score, 80), COALESCE(req.is_required, 1), COALESCE(req.display_order, selected.display_order),
			COALESCE(SUM(CASE WHEN ccc.is_required = 1 THEN item.weight ELSE 0 END), 0) AS core_weight,
			COALESCE(SUM(CASE WHEN ccc.is_required = 0 OR item.is_custom_course = 1 THEN item.weight ELSE 0 END), 0) AS bonus_weight
		FROM (
			SELECT assignment.template_id, item.competency_id, MIN(item.display_order) AS display_order
			FROM curri_template_assignments assignment
			JOIN comp_template_items item ON item.template_id = assignment.template_id AND item.deleted_at IS NULL
			WHERE assignment.cohort_id = ? AND assignment.deleted_at IS NULL
			GROUP BY assignment.template_id, item.competency_id
		) selected
		JOIN comp_competencies comp ON comp.competency_id = selected.competency_id AND comp.deleted_at IS NULL
		LEFT JOIN comp_curriculum_requirements req ON req.cohort_id = ? AND req.competency_id = selected.competency_id AND req.deleted_at IS NULL
		LEFT JOIN comp_template_items item ON item.template_id = selected.template_id AND item.competency_id = selected.competency_id
			AND item.course_id IS NOT NULL AND item.deleted_at IS NULL
		LEFT JOIN crs_curriculum_courses ccc ON ccc.course_id = item.course_id AND item.is_custom_course = 0
			AND ccc.deleted_at IS NULL AND ccc.is_active = 1
		GROUP BY selected.template_id, selected.competency_id, selected.display_order, comp.code, comp.name_th, req.target_score, req.is_required, req.display_order
		ORDER BY COALESCE(req.display_order, selected.display_order), comp.name_th, comp.code`
	rows, err := r.DB.QueryContext(ctx, query, cohortID, cohortID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]models.CohortCompetencyRequirement, 0)
	for rows.Next() {
		var item models.CohortCompetencyRequirement
		if err := rows.Scan(&item.CompetencyID, &item.CompetencyCode, &item.CompetencyName, &item.TargetScore, &item.IsRequired, &item.DisplayOrder, &item.CoreWeight, &item.BonusWeight); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *CourseCompetencyScoringRepository) GetAssignedTemplateCompetencies(ctx context.Context, cohortID uint64) ([]uint64, error) {
	rows, err := r.DB.QueryContext(ctx, `
		SELECT DISTINCT item.competency_id
		FROM curri_template_assignments assignment
		JOIN comp_template_items item ON item.template_id = assignment.template_id AND item.deleted_at IS NULL
		WHERE assignment.cohort_id = ? AND assignment.deleted_at IS NULL
		ORDER BY item.competency_id`, cohortID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	ids := make([]uint64, 0)
	for rows.Next() {
		var id uint64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func (r *CourseCompetencyScoringRepository) ReplaceRequirements(ctx context.Context, cohortID uint64, requirements []models.CohortCompetencyRequirementInput) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, `UPDATE comp_curriculum_requirements SET deleted_at = NOW(), updated_at = NOW() WHERE cohort_id = ? AND deleted_at IS NULL`, cohortID); err != nil {
		return err
	}
	for index, requirement := range requirements {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO comp_curriculum_requirements (curriculum_id, cohort_year_be, cohort_id, competency_id, target_score, is_required, display_order, created_at, updated_at)
			SELECT cohort.curriculum_id, cohort.entry_year_be, cohort.cohort_id, ?, ?, ?, ?, NOW(), NOW()
			FROM edu_student_cohorts cohort WHERE cohort.cohort_id = ? AND cohort.deleted_at IS NULL
			ON DUPLICATE KEY UPDATE target_score = VALUES(target_score), is_required = VALUES(is_required), display_order = VALUES(display_order), deleted_at = NULL, updated_at = NOW()`,
			requirement.CompetencyID, requirement.TargetScore, requirement.IsRequired, index+1, cohortID); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *CourseCompetencyScoringRepository) getScoringTemplate(ctx context.Context, tx *sql.Tx, cohortID uint64) (uint64, error) {
	var templateID uint64
	err := tx.QueryRowContext(ctx, `
		SELECT assignment.template_id FROM curri_template_assignments assignment
		JOIN comp_templates template ON template.template_id = assignment.template_id AND template.deleted_at IS NULL AND template.is_active = 1
		JOIN edu_student_cohorts cohort ON cohort.cohort_id = assignment.cohort_id AND cohort.deleted_at IS NULL
		WHERE assignment.cohort_id = ? AND assignment.deleted_at IS NULL
		FOR UPDATE`, cohortID).Scan(&templateID)
	return templateID, err
}

func (r *CourseCompetencyScoringRepository) getMappings(ctx context.Context, tx *sql.Tx, templateID uint64) ([]courseMapping, error) {
	rows, err := tx.QueryContext(ctx, `
		SELECT item.template_item_id, item.course_id, item.competency_id, COALESCE(item.weight, 0),
			CASE WHEN item.is_custom_course = 0 AND EXISTS (
				SELECT 1 FROM crs_curriculum_courses placement
				JOIN crs_course_categories category ON category.category_id = placement.category_id AND category.deleted_at IS NULL
				JOIN comp_templates template ON template.template_id = item.template_id
				WHERE placement.course_id = item.course_id AND placement.is_required = 1 AND placement.is_active = 1
					AND placement.deleted_at IS NULL AND category.curriculum_id = template.curriculum_id
			) THEN 1 ELSE 0 END AS is_core
		FROM comp_template_items item
		WHERE item.template_id = ? AND item.course_id IS NOT NULL AND item.deleted_at IS NULL AND item.is_active = 1`, templateID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	mappings := make([]courseMapping, 0)
	for rows.Next() {
		var item courseMapping
		if err := rows.Scan(&item.TemplateItemID, &item.CourseID, &item.CompetencyID, &item.Weight, &item.IsCore); err != nil {
			return nil, err
		}
		mappings = append(mappings, item)
	}
	return mappings, rows.Err()
}

func (r *CourseCompetencyScoringRepository) getGrades(ctx context.Context, tx *sql.Tx, cohortID uint64) ([]courseGrade, error) {
	rows, err := tx.QueryContext(ctx, `
		SELECT enrollment.course_student_id, enrollment.enrollment_id, student.student_code, enrollment.course_id, course.code, COALESCE(enrollment.grade, '')
		FROM kku_enrollment_curricula cohortEnrollment
		JOIN kku_enrollments student ON student.enrollment_id = cohortEnrollment.enrollment_id AND student.deleted_at IS NULL
		JOIN crs_course_enrollment enrollment ON enrollment.student_curricula_id = cohortEnrollment.enrollment_curriculum_id
			AND enrollment.enrollment_id = cohortEnrollment.enrollment_id AND enrollment.deleted_at IS NULL AND enrollment.is_best_grade = 1
		JOIN crs_courses course ON course.course_id = enrollment.course_id AND course.deleted_at IS NULL
		WHERE cohortEnrollment.cohort_id = ? AND cohortEnrollment.deleted_at IS NULL`, cohortID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	grades := make([]courseGrade, 0)
	for rows.Next() {
		var grade courseGrade
		if err := rows.Scan(&grade.CourseStudentID, &grade.EnrollmentID, &grade.StudentCode, &grade.CourseID, &grade.CourseCode, &grade.Grade); err != nil {
			return nil, err
		}
		grades = append(grades, grade)
	}
	return grades, rows.Err()
}

func (r *CourseCompetencyScoringRepository) Recalculate(ctx context.Context, cohortID uint64, gradeScores map[string]float64) (*models.CourseCompetencyRecalculationResult, error) {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	templateID, err := r.getScoringTemplate(ctx, tx, cohortID)
	if err != nil {
		return nil, err
	}
	mappings, err := r.getMappings(ctx, tx, templateID)
	if err != nil {
		return nil, err
	}
	grades, err := r.getGrades(ctx, tx, cohortID)
	if err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE score_course_competency_scores score
		JOIN crs_course_enrollment enrollment ON enrollment.course_student_id = score.course_student_id
		JOIN kku_enrollment_curricula cohortEnrollment ON cohortEnrollment.enrollment_curriculum_id = enrollment.student_curricula_id
		SET score.deleted_at = NOW(), score.updated_at = NOW()
		WHERE cohortEnrollment.cohort_id = ? AND cohortEnrollment.deleted_at IS NULL AND score.deleted_at IS NULL`, cohortID); err != nil {
		return nil, err
	}
	mappingByCourse := make(map[uint64][]courseMapping)
	for _, mapping := range mappings {
		mappingByCourse[mapping.CourseID] = append(mappingByCourse[mapping.CourseID], mapping)
	}
	result := &models.CourseCompetencyRecalculationResult{CohortID: cohortID, Warnings: make([]models.CourseCompetencyScoreWarning, 0), CalculatedAt: time.Now()}
	students := make(map[uint64]struct{})
	for _, grade := range grades {
		students[grade.EnrollmentID] = struct{}{}
		score, known := gradeScores[grade.Grade]
		if grade.Grade == "" || grade.Grade == "S" || grade.Grade == "U" || grade.Grade == "W" || grade.Grade == "I" || grade.Grade == "F" {
			continue
		}
		if !known {
			result.Warnings = append(result.Warnings, models.CourseCompetencyScoreWarning{Code: "GRADE_NOT_MAPPED", Message: "grade is not in the fixed grade map", StudentCode: grade.StudentCode, CourseCode: grade.CourseCode})
			continue
		}
		if len(mappingByCourse[grade.CourseID]) == 0 {
			result.Warnings = append(result.Warnings, models.CourseCompetencyScoreWarning{Code: "COURSE_NOT_MAPPED", Message: "course has no competency mapping in the assigned template", StudentCode: grade.StudentCode, CourseCode: grade.CourseCode})
			continue
		}
		for _, mapping := range mappingByCourse[grade.CourseID] {
			scoreType := "bonus"
			if mapping.IsCore {
				scoreType = "core"
			}
			weighted := score * mapping.Weight / 100
			if _, err := tx.ExecContext(ctx, `
				INSERT INTO score_course_competency_scores (course_student_id, competency_id, template_id, template_item_id, raw_score, weighted_score, weight_snapshot, grade_snapshot, score_type_snapshot, calculated_at, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())
				ON DUPLICATE KEY UPDATE template_id=VALUES(template_id), template_item_id=VALUES(template_item_id), raw_score=VALUES(raw_score), weighted_score=VALUES(weighted_score), weight_snapshot=VALUES(weight_snapshot), grade_snapshot=VALUES(grade_snapshot), score_type_snapshot=VALUES(score_type_snapshot), calculated_at=NOW(), deleted_at=NULL, updated_at=NOW()`,
				grade.CourseStudentID, mapping.CompetencyID, templateID, mapping.TemplateItemID, score, weighted, mapping.Weight, grade.Grade, scoreType); err != nil {
				return nil, err
			}
			result.CourseScores++
		}
	}
	if err := r.recomputeResults(ctx, tx, cohortID); err != nil {
		return nil, err
	}
	result.CalculatedStudents = len(students)
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return result, nil
}

func (r *CourseCompetencyScoringRepository) recomputeResults(ctx context.Context, tx *sql.Tx, cohortID uint64) error {
	_, err := tx.ExecContext(ctx, `
		INSERT INTO score_competency_result (enrollment_id, competency_id, core_score, course_bonus_score, activity_score, final_score, created_at, updated_at)
		SELECT roster.enrollment_id, requirement.competency_id,
			COALESCE(SUM(CASE WHEN score.score_type_snapshot = 'core' THEN score.weighted_score ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN score.score_type_snapshot = 'bonus' THEN score.weighted_score ELSE 0 END), 0),
			COALESCE(activity.activity_score, 0),
			COALESCE(SUM(score.weighted_score), 0) + COALESCE(activity.activity_score, 0), NOW(), NOW()
		FROM kku_enrollment_curricula roster
		JOIN comp_curriculum_requirements requirement ON requirement.cohort_id = roster.cohort_id AND requirement.deleted_at IS NULL
		LEFT JOIN crs_course_enrollment courseEnrollment ON courseEnrollment.enrollment_id = roster.enrollment_id AND courseEnrollment.student_curricula_id = roster.enrollment_curriculum_id AND courseEnrollment.deleted_at IS NULL
		LEFT JOIN score_course_competency_scores score ON score.course_student_id = courseEnrollment.course_student_id AND score.competency_id = requirement.competency_id AND score.deleted_at IS NULL
		LEFT JOIN (
			SELECT enrollmentCurriculum.cohort_id, enrollment.enrollment_id, sessionComp.competency_id, SUM(sessionResult.earned_percent) AS activity_score
			FROM score_session_competency_results sessionResult
			JOIN score_session_competency_scores sessionScore ON sessionScore.session_competency_score_id = sessionResult.score_id AND sessionScore.deleted_at IS NULL
			JOIN act_session_competencies sessionComp ON sessionComp.session_competency_id = sessionScore.session_competency_id AND sessionComp.deleted_at IS NULL
			JOIN kku_enrollments enrollment ON enrollment.person_id = sessionScore.person_id AND enrollment.deleted_at IS NULL
			JOIN kku_enrollment_curricula enrollmentCurriculum ON enrollmentCurriculum.enrollment_id = enrollment.enrollment_id AND enrollmentCurriculum.deleted_at IS NULL
			WHERE sessionResult.deleted_at IS NULL
			GROUP BY enrollmentCurriculum.cohort_id, enrollment.enrollment_id, sessionComp.competency_id
		) activity ON activity.cohort_id = roster.cohort_id AND activity.enrollment_id = roster.enrollment_id AND activity.competency_id = requirement.competency_id
		WHERE roster.cohort_id = ? AND roster.deleted_at IS NULL
		GROUP BY roster.enrollment_id, requirement.competency_id, activity.activity_score
		ON DUPLICATE KEY UPDATE core_score=VALUES(core_score), course_bonus_score=VALUES(course_bonus_score), activity_score=VALUES(activity_score), final_score=VALUES(final_score), deleted_at=NULL, updated_at=NOW()`, cohortID)
	if err != nil {
		return fmt.Errorf("recompute competency results: %w", err)
	}
	return nil
}

func (r *CourseCompetencyScoringRepository) GetSummary(ctx context.Context, cohortID uint64) ([]models.CohortLearnerCompetencySummary, error) {
	const query = `
		SELECT roster.enrollment_id, enrollment.student_code, CONCAT_WS(' ', person.first_name_th, person.last_name_th), requirement.competency_id, competency.code, competency.name_th,
			requirement.target_score, COALESCE(result.core_score, 0), COALESCE(result.course_bonus_score, 0),
			COALESCE(result.core_score, 0) + COALESCE(result.course_bonus_score, 0), COALESCE(result.activity_score, 0), COALESCE(result.final_score, 0),
			CASE WHEN requirement.is_required = 0 OR COALESCE(result.core_score, 0) + COALESCE(result.course_bonus_score, 0) >= requirement.target_score THEN 1 ELSE 0 END
		FROM kku_enrollment_curricula roster
		JOIN kku_enrollments enrollment ON enrollment.enrollment_id = roster.enrollment_id AND enrollment.deleted_at IS NULL
		JOIN persons person ON person.person_id = enrollment.person_id AND person.deleted_at IS NULL
		JOIN comp_curriculum_requirements requirement ON requirement.cohort_id = roster.cohort_id AND requirement.deleted_at IS NULL
		JOIN comp_competencies competency ON competency.competency_id = requirement.competency_id AND competency.deleted_at IS NULL
		LEFT JOIN score_competency_result result ON result.enrollment_id = roster.enrollment_id AND result.competency_id = requirement.competency_id AND result.deleted_at IS NULL
		WHERE roster.cohort_id = ? AND roster.deleted_at IS NULL
		ORDER BY person.first_name_th, person.last_name_th, requirement.display_order, competency.name_th`
	rows, err := r.DB.QueryContext(ctx, query, cohortID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]models.CohortLearnerCompetencySummary, 0)
	for rows.Next() {
		var item models.CohortLearnerCompetencySummary
		if err := rows.Scan(&item.EnrollmentID, &item.StudentCode, &item.StudentNameTH, &item.CompetencyID, &item.CompetencyCode, &item.CompetencyName, &item.TargetScore, &item.CoreScore, &item.CourseBonusScore, &item.CourseTotalScore, &item.ActivityScore, &item.AccumulatedScore, &item.PassedRequirement); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
