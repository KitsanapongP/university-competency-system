package repositories

import (
	"context"
	"database/sql"
	"strconv"

	"github.com/spw32767/university-competency-system-backend/models"
)

type CompetencyRepository struct {
	DB *sql.DB
}

func NewCompetencyRepository(db *sql.DB) *CompetencyRepository {
	return &CompetencyRepository{DB: db}
}

type CompetencyRecord struct {
	ID     int64
	Code   string
	NameTH string
	NameEN *string
}

type ActivityRecord struct {
	SessionCompetencyID int64
	CompetencyID        int64
	CompetencyCode      string
	CompetencyNameTH    string
	CompetencyNameEN    *string
	ActivityID          int64
	ActivityName        string
	ActivityCategory    *string
	ActivityType        *string
	SessionStatus       string
	StartAt             sql.NullTime
	MaxPercent          float64
	EarnedPercent       sql.NullFloat64
}

type CourseRecord struct {
	RecordID     int64
	CourseID     int64
	CompetencyID int64
	CourseName   string
	AcademicYear string // ปีการศึกษา (Buddhist Era)
	Score        sql.NullFloat64
}

type LearnerDashboardScope struct {
	CohortID     int64
	TemplateID   int64
	TemplateName string
	Competencies []CompetencyRecord
}

func (r *CompetencyRepository) ResolvePersonID(ctx context.Context, userID int64) (int64, error) {
	var personID sql.NullInt64
	if err := r.DB.QueryRowContext(ctx, `SELECT person_id FROM auth_users WHERE user_id = ?`, userID).Scan(&personID); err != nil {
		return 0, err
	}
	if personID.Valid {
		return personID.Int64, nil
	}

	var exists int
	if err := r.DB.QueryRowContext(ctx, `SELECT 1 FROM persons WHERE person_id = ?`, userID).Scan(&exists); err != nil {
		if err == sql.ErrNoRows {
			return 0, nil
		}
		return 0, err
	}
	return userID, nil
}

func (r *CompetencyRepository) GetCurrentCurriculumID(ctx context.Context, personID int64) (int64, error) {
	var curriculumID int64
	err := r.DB.QueryRowContext(ctx, `
SELECT ec.curriculum_id
FROM kku_enrollments e
JOIN kku_enrollment_curricula ec ON ec.enrollment_id = e.enrollment_id
WHERE e.person_id = ?
  AND e.deleted_at IS NULL
  AND ec.deleted_at IS NULL
  AND ec.is_current = 1
LIMIT 1
`, personID).Scan(&curriculumID)
	if err != nil {
		if err == sql.ErrNoRows {
			return 0, nil
		}
		return 0, err
	}
	return curriculumID, nil
}

func (r *CompetencyRepository) GetLearnerDashboardScope(ctx context.Context, personID int64) (LearnerDashboardScope, error) {
	var scope LearnerDashboardScope
	var cohortID sql.NullInt64
	var templateID sql.NullInt64
	var templateName sql.NullString

	err := r.DB.QueryRowContext(ctx, `
SELECT cohort.cohort_id, template.template_id, template.name
FROM kku_enrollments enrollment
JOIN kku_enrollment_curricula enrollmentCurriculum
	ON enrollmentCurriculum.enrollment_id = enrollment.enrollment_id
	AND enrollmentCurriculum.is_current = 1
	AND enrollmentCurriculum.deleted_at IS NULL
JOIN edu_student_cohorts cohort
	ON cohort.cohort_id = enrollmentCurriculum.cohort_id
	AND cohort.status = 'active'
	AND cohort.deleted_at IS NULL
LEFT JOIN curri_template_assignments assignment
	ON assignment.cohort_id = cohort.cohort_id
	AND assignment.deleted_at IS NULL
LEFT JOIN comp_templates template
	ON template.template_id = assignment.template_id
	AND template.is_active = 1
	AND template.deleted_at IS NULL
WHERE enrollment.person_id = ?
	AND enrollment.deleted_at IS NULL
ORDER BY cohort.entry_year_be DESC, assignment.assigned_at DESC
LIMIT 1`, personID).Scan(&cohortID, &templateID, &templateName)
	if err != nil {
		if err == sql.ErrNoRows {
			return scope, nil
		}
		return scope, err
	}
	if cohortID.Valid {
		scope.CohortID = cohortID.Int64
	}
	if templateID.Valid {
		scope.TemplateID = templateID.Int64
	}
	if templateName.Valid {
		scope.TemplateName = templateName.String
	}
	if scope.TemplateID == 0 {
		return scope, nil
	}

	rows, err := r.DB.QueryContext(ctx, `
SELECT DISTINCT competency.competency_id, competency.code, competency.name_th, competency.name_en
FROM comp_template_items item
JOIN comp_competencies competency
	ON competency.competency_id = item.competency_id
	AND competency.is_active = 1
	AND competency.deleted_at IS NULL
WHERE item.template_id = ?
	AND item.is_active = 1
	AND item.deleted_at IS NULL
ORDER BY competency.competency_id`, scope.TemplateID)
	if err != nil {
		return scope, err
	}
	defer rows.Close()

	for rows.Next() {
		var item CompetencyRecord
		var nameEN sql.NullString
		if err := rows.Scan(&item.ID, &item.Code, &item.NameTH, &nameEN); err != nil {
			return scope, err
		}
		if nameEN.Valid {
			item.NameEN = &nameEN.String
		}
		scope.Competencies = append(scope.Competencies, item)
	}
	if err := rows.Err(); err != nil {
		return scope, err
	}
	return scope, nil
}

func (r *CompetencyRepository) GetCompetencies(ctx context.Context) ([]CompetencyRecord, error) {
	rows, err := r.DB.QueryContext(ctx, `
SELECT competency_id, code, name_th, name_en
FROM comp_competencies
WHERE is_active = 1 AND deleted_at IS NULL
ORDER BY competency_id
`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []CompetencyRecord
	for rows.Next() {
		var rec CompetencyRecord
		var nameEN sql.NullString
		if err := rows.Scan(&rec.ID, &rec.Code, &rec.NameTH, &nameEN); err != nil {
			return nil, err
		}
		if nameEN.Valid {
			rec.NameEN = &nameEN.String
		}
		items = append(items, rec)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func (r *CompetencyRepository) GetCompetencyOptions(ctx context.Context) ([]*models.CompetencyOption, error) {
	rows, err := r.DB.QueryContext(ctx, `
		SELECT
			c.competency_id,
			c.code,
			c.name_th,
			c.name_en,
			c.description,
			c.is_active,
			COALESCE(template_stats.template_usage_count, 0),
			c.created_at,
			c.updated_at
		FROM comp_competencies c
		LEFT JOIN (
			SELECT cti.competency_id, COUNT(DISTINCT cti.template_id) AS template_usage_count
			FROM comp_template_items cti
			JOIN comp_templates tpl ON tpl.template_id = cti.template_id
			WHERE cti.deleted_at IS NULL
				AND tpl.deleted_at IS NULL
			GROUP BY cti.competency_id
		) template_stats ON template_stats.competency_id = c.competency_id
		WHERE c.deleted_at IS NULL
		ORDER BY c.competency_id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	competencies := make([]*models.CompetencyOption, 0)
	for rows.Next() {
		item, err := scanCompetencyOption(rows)
		if err != nil {
			return nil, err
		}
		competencies = append(competencies, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return competencies, nil
}

func (r *CompetencyRepository) GetCompetencyByID(ctx context.Context, competencyID uint64) (*models.CompetencyOption, error) {
	query := `
		SELECT
			c.competency_id,
			c.code,
			c.name_th,
			c.name_en,
			c.description,
			c.is_active,
			COALESCE(template_stats.template_usage_count, 0),
			c.created_at,
			c.updated_at
		FROM comp_competencies c
		LEFT JOIN (
			SELECT cti.competency_id, COUNT(DISTINCT cti.template_id) AS template_usage_count
			FROM comp_template_items cti
			JOIN comp_templates tpl ON tpl.template_id = cti.template_id
			WHERE cti.deleted_at IS NULL
				AND tpl.deleted_at IS NULL
			GROUP BY cti.competency_id
		) template_stats ON template_stats.competency_id = c.competency_id
		WHERE c.competency_id = ?
			AND c.deleted_at IS NULL
	`
	return scanCompetencyOption(r.DB.QueryRowContext(ctx, query, competencyID))
}

func (r *CompetencyRepository) CreateCompetency(ctx context.Context, payload models.UpsertCompetencyPayload) (*models.CompetencyOption, error) {
	result, err := r.DB.ExecContext(ctx, `
		INSERT INTO comp_competencies (code, name_th, name_en, description, is_active)
		VALUES (?, ?, ?, ?, 1)
	`, payload.Code, payload.NameTH, payload.NameEN, payload.Description)
	if err != nil {
		return nil, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}
	return r.GetCompetencyByID(ctx, uint64(id))
}

func (r *CompetencyRepository) UpdateCompetency(ctx context.Context, competencyID uint64, payload models.UpsertCompetencyPayload) (*models.CompetencyOption, error) {
	result, err := r.DB.ExecContext(ctx, `
		UPDATE comp_competencies
		SET code = ?, name_th = ?, name_en = ?, description = ?, updated_at = NOW()
		WHERE competency_id = ?
			AND deleted_at IS NULL
	`, payload.Code, payload.NameTH, payload.NameEN, payload.Description, competencyID)
	if err != nil {
		return nil, err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return nil, err
	}
	if affected == 0 {
		return nil, sql.ErrNoRows
	}
	return r.GetCompetencyByID(ctx, competencyID)
}

func (r *CompetencyRepository) SoftDeleteCompetency(ctx context.Context, competencyID uint64) error {
	result, err := r.DB.ExecContext(ctx, `
		UPDATE comp_competencies
		SET deleted_at = NOW(), updated_at = NOW()
		WHERE competency_id = ?
			AND deleted_at IS NULL
	`, competencyID)
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
	return nil
}

func (r *CompetencyRepository) CountTemplateUsageForCompetency(ctx context.Context, competencyID uint64) (int, error) {
	var count int
	err := r.DB.QueryRowContext(ctx, `
		SELECT COUNT(DISTINCT cti.template_id)
		FROM comp_template_items cti
		JOIN comp_templates tpl ON tpl.template_id = cti.template_id
		WHERE cti.competency_id = ?
			AND cti.deleted_at IS NULL
			AND tpl.deleted_at IS NULL
	`, competencyID).Scan(&count)
	return count, err
}

func (r *CompetencyRepository) GetRequirementsByCurriculum(ctx context.Context, curriculumID int64) (map[int64]float64, error) {
	rows, err := r.DB.QueryContext(ctx, `
SELECT competency_id, target_percent
FROM comp_curriculum_requirements
WHERE curriculum_id = ? AND deleted_at IS NULL
`, curriculumID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	requirements := make(map[int64]float64)
	for rows.Next() {
		var competencyID int64
		var target float64
		if err := rows.Scan(&competencyID, &target); err != nil {
			return nil, err
		}
		requirements[competencyID] = target
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return requirements, nil
}

func (r *CompetencyRepository) GetActivitiesByPerson(ctx context.Context, personID int64) ([]ActivityRecord, error) {
	rows, err := r.DB.QueryContext(ctx, `
SELECT
   sc.session_competency_id,
   sc.competency_id,
   c.code,
   c.name_th,
   c.name_en,
   a.activity_id,
   a.name_th,
  a.category,
  a.type,
  s.status,
   s.start_at,
   sc.max_percent,
   csr.earned_percent
FROM act_session_competencies sc
JOIN comp_competencies c ON c.competency_id = sc.competency_id AND c.is_active = 1 AND c.deleted_at IS NULL
JOIN act_sessions s ON s.session_id = sc.session_id
  AND s.status = 'completed'
  AND s.scores_finalized_at IS NOT NULL
  AND s.deleted_at IS NULL
JOIN act_activities a ON a.activity_id = s.activity_id AND a.deleted_at IS NULL
JOIN score_session_competency_scores scc
	ON scc.session_competency_id = sc.session_competency_id
	AND scc.person_id = ?
	AND scc.is_locked = 1
	AND scc.deleted_at IS NULL
JOIN score_session_competency_results csr
  ON csr.score_id = scc.session_competency_score_id
  AND csr.is_locked = 1
  AND csr.deleted_at IS NULL
WHERE sc.deleted_at IS NULL
ORDER BY s.start_at DESC
`, personID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []ActivityRecord
	for rows.Next() {
		var rec ActivityRecord
		var category sql.NullString
		var actType sql.NullString
		var nameEN sql.NullString
		if err := rows.Scan(
			&rec.SessionCompetencyID,
			&rec.CompetencyID,
			&rec.CompetencyCode,
			&rec.CompetencyNameTH,
			&nameEN,
			&rec.ActivityID,
			&rec.ActivityName,
			&category,
			&actType,
			&rec.SessionStatus,
			&rec.StartAt,
			&rec.MaxPercent,
			&rec.EarnedPercent,
		); err != nil {
			return nil, err
		}
		if nameEN.Valid {
			rec.CompetencyNameEN = &nameEN.String
		}
		if category.Valid {
			rec.ActivityCategory = &category.String
		}
		if actType.Valid {
			rec.ActivityType = &actType.String
		}
		items = append(items, rec)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

type LearnerCompetencyProgressRecord struct {
	CoreScore        float64
	CourseBonusScore float64
	ActivityScore    float64
	AccumulatedScore float64
	TargetScore      float64
	Passed           bool
	HasResult        bool
}

// GetLearnerCompetencyProgress returns the active Cohort's accumulated score
// components. Course Total, not Activity, is the graduation target check.
func (r *CompetencyRepository) GetLearnerCompetencyProgress(ctx context.Context, personID int64) (map[int64]LearnerCompetencyProgressRecord, error) {
	rows, err := r.DB.QueryContext(ctx, `
		SELECT requirement.competency_id, COALESCE(result.core_score, 0), COALESCE(result.course_bonus_score, 0),
			COALESCE(result.activity_score, 0), COALESCE(result.final_score, 0), requirement.target_score,
			CASE WHEN requirement.is_required = 0 OR COALESCE(result.core_score, 0) + COALESCE(result.course_bonus_score, 0) >= requirement.target_score THEN 1 ELSE 0 END,
			CASE WHEN result.competency_result_id IS NULL THEN 0 ELSE 1 END
		FROM kku_enrollments enrollment
		JOIN kku_enrollment_curricula cohortEnrollment ON cohortEnrollment.enrollment_id = enrollment.enrollment_id AND cohortEnrollment.deleted_at IS NULL
		JOIN edu_student_cohorts cohort ON cohort.cohort_id = cohortEnrollment.cohort_id AND cohort.status = 'active' AND cohort.deleted_at IS NULL
		JOIN comp_curriculum_requirements requirement ON requirement.cohort_id = cohort.cohort_id AND requirement.deleted_at IS NULL
		LEFT JOIN score_competency_result result ON result.enrollment_id = enrollment.enrollment_id AND result.competency_id = requirement.competency_id AND result.deleted_at IS NULL
		WHERE enrollment.person_id = ? AND enrollment.deleted_at IS NULL
		ORDER BY cohort.entry_year_be DESC, requirement.display_order`, personID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	progress := make(map[int64]LearnerCompetencyProgressRecord)
	for rows.Next() {
		var competencyID int64
		var item LearnerCompetencyProgressRecord
		if err := rows.Scan(&competencyID, &item.CoreScore, &item.CourseBonusScore, &item.ActivityScore, &item.AccumulatedScore, &item.TargetScore, &item.Passed, &item.HasResult); err != nil {
			return nil, err
		}
		if _, exists := progress[competencyID]; !exists {
			progress[competencyID] = item
		}
	}
	return progress, rows.Err()
}

type competencyScanner interface {
	Scan(dest ...any) error
}

func scanCompetencyOption(scanner competencyScanner) (*models.CompetencyOption, error) {
	var item models.CompetencyOption
	var nameEN sql.NullString
	var description sql.NullString
	var isActive bool
	if err := scanner.Scan(
		&item.CompetencyID,
		&item.Code,
		&item.NameTH,
		&nameEN,
		&description,
		&isActive,
		&item.TemplateUsageCount,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		return nil, err
	}
	if nameEN.Valid {
		item.NameEN = &nameEN.String
	}
	if description.Valid {
		item.Description = &description.String
	}
	item.IsActive = isActive
	item.CanEdit = true
	item.CanDelete = item.TemplateUsageCount == 0
	return &item, nil
}

func (r *CompetencyRepository) GetCoursesByPerson(ctx context.Context, personID int64) ([]CourseRecord, error) {
	rows, err := r.DB.QueryContext(ctx, `
SELECT
	score.score_id,
	grade.course_id,
	score.competency_id,
	course.name_th,
	COALESCE(grade.academic_year_be, 0),
	COALESCE(score.weighted_score, 0)
FROM kku_enrollments enrollment
JOIN kku_enrollment_curricula enrollmentCurriculum
	ON enrollmentCurriculum.enrollment_id = enrollment.enrollment_id
	AND enrollmentCurriculum.is_current = 1
	AND enrollmentCurriculum.deleted_at IS NULL
JOIN edu_student_cohorts cohort
	ON cohort.cohort_id = enrollmentCurriculum.cohort_id
	AND cohort.status = 'active'
	AND cohort.deleted_at IS NULL
JOIN crs_course_enrollment grade
	ON grade.enrollment_id = enrollment.enrollment_id
	AND grade.student_curricula_id = enrollmentCurriculum.enrollment_curriculum_id
	AND grade.is_best_grade = 1
	AND grade.deleted_at IS NULL
JOIN crs_courses course
	ON course.course_id = grade.course_id
	AND course.deleted_at IS NULL
JOIN score_course_competency_scores score
	ON score.course_student_id = grade.course_student_id
	AND score.deleted_at IS NULL
WHERE enrollment.person_id = ?
	AND enrollment.deleted_at IS NULL
ORDER BY grade.academic_year_be DESC, course.name_th ASC, score.score_id`, personID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []CourseRecord
	for rows.Next() {
		var rec CourseRecord
		var yearBE int64
		var weightedScore float64
		if err := rows.Scan(
			&rec.RecordID,
			&rec.CourseID,
			&rec.CompetencyID,
			&rec.CourseName,
			&yearBE,
			&weightedScore,
		); err != nil {
			return nil, err
		}
		rec.AcademicYear = strconv.FormatInt(yearBE, 10)
		rec.Score.Float64 = weightedScore
		rec.Score.Valid = true
		items = append(items, rec)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}
