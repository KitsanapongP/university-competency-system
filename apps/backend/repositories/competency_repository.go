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
	CourseID     int64
	CompetencyID int64
	CourseName   string
	AcademicYear string // ปีการศึกษา (Buddhist Era)
	Score        sql.NullFloat64
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
  a.activity_id,
  a.name_th,
  a.category,
  a.type,
  s.status,
  s.start_at,
  sc.max_percent,
  csr.earned_percent
FROM act_session_competencies sc
JOIN comp_competencies c ON c.competency_id = sc.competency_id AND c.deleted_at IS NULL
JOIN act_sessions s ON s.session_id = sc.session_id AND s.deleted_at IS NULL
JOIN act_activities a ON a.activity_id = s.activity_id AND a.deleted_at IS NULL
LEFT JOIN score_session_competency_scores scc
  ON scc.session_competency_id = sc.session_competency_id
  AND scc.person_id = ?
  AND scc.deleted_at IS NULL
LEFT JOIN score_session_competency_results csr
  ON csr.score_id = scc.session_competency_score_id
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
		if err := rows.Scan(
			&rec.SessionCompetencyID,
			&rec.CompetencyID,
			&rec.CompetencyCode,
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

// เพิ่ม GetCoursesByPerson method ใน CompetencyRepository
func (r *CompetencyRepository) GetCoursesByPerson(ctx context.Context, personID int64) ([]CourseRecord, error) {
	rows, err := r.DB.QueryContext(ctx, `
        SELECT
            sc.section_competency_id,
            sc.competency_id,
            c.name_th,
            cs.academic_year_be,
            sc.max_percent,
            COALESCE(scr.earned_percent, 0) AS earned_percent
        FROM crs_section_enrollments se
        JOIN crs_course_sections cs 
            ON cs.section_id = se.section_id
            AND cs.deleted_at IS NULL
        JOIN crs_courses c 
            ON c.course_id = cs.course_id
            AND c.deleted_at IS NULL
        JOIN crs_section_competencies sc 
            ON sc.section_id = cs.section_id
            AND sc.deleted_at IS NULL
        LEFT JOIN score_section_competency_scores scs 
            ON scs.section_competency_id = sc.section_competency_id
            AND scs.person_id = ?
            AND scs.deleted_at IS NULL
        LEFT JOIN score_section_competency_results scr 
            ON scr.score_id = scs.section_competency_score_id
            AND scr.deleted_at IS NULL
        WHERE se.person_id = ?
            AND se.deleted_at IS NULL
            AND se.status IN ('enrolled', 'completed')
        ORDER BY cs.academic_year_be DESC, c.name_th ASC
    `, personID, personID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []CourseRecord
	for rows.Next() {
		var rec CourseRecord
		var yearBE int
		var maxPercent float64
		var earnedPercent float64
		if err := rows.Scan(
			&rec.CourseID,
			&rec.CompetencyID,
			&rec.CourseName,
			&yearBE,
			&maxPercent,
			&earnedPercent,
		); err != nil {
			return nil, err
		}
		rec.AcademicYear = strconv.Itoa(yearBE)
		rec.Score.Float64 = earnedPercent
		rec.Score.Valid = true
		items = append(items, rec)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}
