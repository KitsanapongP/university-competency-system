package repositories

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/spw32767/university-competency-system-backend/models"
)

type TemplateAssignmentRepository struct {
	DB *sql.DB
}

func NewTemplateAssignmentRepository(db *sql.DB) *TemplateAssignmentRepository {
	return &TemplateAssignmentRepository{DB: db}
}

func (r *TemplateAssignmentRepository) GetAssignments(ctx context.Context, facultyID *uint64) ([]models.TemplateAssignment, error) {
	args := make([]any, 0, 1)
	where := "ta.deleted_at IS NULL"
	if facultyID != nil {
		where += " AND t.faculty_id = ?"
		args = append(args, *facultyID)
	}
	query := assignmentSelectQuery + " WHERE " + where + " ORDER BY sc.entry_year_be DESC, c.code, ta.assigned_at DESC"
	return r.queryAssignments(ctx, query, args...)
}

func (r *TemplateAssignmentRepository) GetAssignmentByID(ctx context.Context, assignmentID uint64) (*models.TemplateAssignment, error) {
	items, err := r.queryAssignments(ctx, assignmentSelectQuery+" WHERE ta.template_assignment_id = ? AND ta.deleted_at IS NULL", assignmentID)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, nil
	}
	return &items[0], nil
}

func (r *TemplateAssignmentRepository) GetCohortAssignmentHistory(ctx context.Context, cohortID uint64) ([]models.TemplateAssignment, error) {
	return r.queryAssignments(ctx, assignmentSelectQuery+" WHERE ta.cohort_id = ? ORDER BY ta.assigned_at DESC, ta.template_assignment_id DESC", cohortID)
}

func (r *TemplateAssignmentRepository) GetAvailableTemplates(ctx context.Context, facultyID *uint64) ([]models.TemplateAssignmentCandidate, error) {
	args := make([]any, 0, 1)
	where := "t.deleted_at IS NULL AND t.is_active = 1 AND t.curriculum_id IS NOT NULL"
	if facultyID != nil {
		where += " AND t.faculty_id = ?"
		args = append(args, *facultyID)
	}
	query := `
		SELECT t.template_id, t.code, t.name, t.curriculum_id, c.code, c.name_th
		FROM comp_templates t
		JOIN edu_curricula c ON c.curriculum_id = t.curriculum_id AND c.deleted_at IS NULL
		WHERE ` + where + `
			AND NOT EXISTS (
				SELECT 1 FROM curri_template_assignments prior
				WHERE prior.template_id = t.template_id
			)
		ORDER BY c.code, t.name, t.template_id DESC
	`
	rows, err := r.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.TemplateAssignmentCandidate, 0)
	for rows.Next() {
		var item models.TemplateAssignmentCandidate
		if err := rows.Scan(&item.TemplateID, &item.TemplateCode, &item.TemplateName, &item.CurriculumID, &item.CurriculumCode, &item.CurriculumNameTH); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *TemplateAssignmentRepository) GetAvailableCohorts(ctx context.Context, curriculumID uint64) ([]models.TemplateAssignmentCandidate, error) {
	const query = `
		SELECT sc.cohort_id, sc.entry_year_be, COALESCE(roster.roster_count, 0), sc.curriculum_id, c.code, c.name_th
		FROM edu_student_cohorts sc
		JOIN edu_curricula c ON c.curriculum_id = sc.curriculum_id AND c.deleted_at IS NULL
		LEFT JOIN (
			SELECT ec.cohort_id, COUNT(*) AS roster_count
			FROM kku_enrollment_curricula ec
			WHERE ec.deleted_at IS NULL AND ec.cohort_id IS NOT NULL
			GROUP BY ec.cohort_id
		) roster ON roster.cohort_id = sc.cohort_id
		WHERE sc.curriculum_id = ?
			AND sc.status = 'active'
			AND sc.deleted_at IS NULL
			AND NOT EXISTS (
				SELECT 1 FROM curri_template_assignments live
				WHERE live.cohort_id = sc.cohort_id AND live.deleted_at IS NULL
			)
		ORDER BY sc.entry_year_be DESC, sc.cohort_id DESC
	`
	rows, err := r.DB.QueryContext(ctx, query, curriculumID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.TemplateAssignmentCandidate, 0)
	for rows.Next() {
		var item models.TemplateAssignmentCandidate
		if err := rows.Scan(&item.CohortID, &item.EntryYearBE, &item.RosterCount, &item.CurriculumID, &item.CurriculumCode, &item.CurriculumNameTH); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *TemplateAssignmentRepository) HasAnyAssignmentForTemplate(ctx context.Context, templateID uint64) (bool, error) {
	var exists bool
	err := r.DB.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM curri_template_assignments WHERE template_id = ?)`, templateID).Scan(&exists)
	return exists, err
}

func (r *TemplateAssignmentRepository) GetLiveAssignmentForCohort(ctx context.Context, cohortID uint64) (*models.TemplateAssignment, error) {
	items, err := r.queryAssignments(ctx, assignmentSelectQuery+" WHERE ta.cohort_id = ? AND ta.deleted_at IS NULL", cohortID)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, nil
	}
	return &items[0], nil
}

func (r *TemplateAssignmentRepository) HasCohortScores(ctx context.Context, cohortID uint64) (bool, error) {
	const query = `
		SELECT (
			EXISTS (
				SELECT 1
				FROM score_course_competency_scores sccs
				JOIN crs_course_enrollment cce ON cce.course_student_id = sccs.course_student_id AND cce.deleted_at IS NULL
				JOIN kku_enrollment_curricula kec ON kec.enrollment_curriculum_id = cce.student_curricula_id AND kec.deleted_at IS NULL
				WHERE kec.cohort_id = ? AND sccs.deleted_at IS NULL
			)
			OR EXISTS (
				SELECT 1
				FROM score_session_competency_scores sscs
				JOIN kku_enrollments ke ON ke.person_id = sscs.person_id AND ke.deleted_at IS NULL
				JOIN kku_enrollment_curricula kec ON kec.enrollment_id = ke.enrollment_id AND kec.deleted_at IS NULL
				WHERE kec.cohort_id = ? AND sscs.deleted_at IS NULL
			)
			OR EXISTS (
				SELECT 1
				FROM score_competency_result scr
				JOIN kku_enrollment_curricula kec ON kec.enrollment_id = scr.enrollment_id AND kec.deleted_at IS NULL
				WHERE kec.cohort_id = ? AND scr.deleted_at IS NULL
			)
		)
	`
	var locked bool
	if err := r.DB.QueryRowContext(ctx, query, cohortID, cohortID, cohortID).Scan(&locked); err != nil {
		return false, err
	}
	return locked, nil
}

func (r *TemplateAssignmentRepository) CreateAssignment(ctx context.Context, templateID, cohortID, userID uint64) (*models.TemplateAssignment, error) {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()

	if err := lockAssignmentTemplate(ctx, tx, templateID); err != nil {
		return nil, err
	}
	if err := lockAssignmentCohort(ctx, tx, cohortID); err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO curri_template_assignments (template_id, cohort_id, assigned_by, assigned_at, created_at, updated_at)
		VALUES (?, ?, ?, NOW(), NOW(), NOW())
	`, templateID, cohortID, userID); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return r.GetLiveAssignmentForCohort(ctx, cohortID)
}

func (r *TemplateAssignmentRepository) ReplaceAssignment(ctx context.Context, assignmentID, replacementTemplateID, userID uint64, reason string) (*models.TemplateAssignment, error) {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()

	var currentTemplateID, cohortID uint64
	err = tx.QueryRowContext(ctx, `
		SELECT template_id, cohort_id
		FROM curri_template_assignments
		WHERE template_assignment_id = ? AND deleted_at IS NULL
		FOR UPDATE
	`, assignmentID).Scan(&currentTemplateID, &cohortID)
	if err != nil {
		return nil, err
	}
	if err := lockAssignmentTemplate(ctx, tx, replacementTemplateID); err != nil {
		return nil, err
	}
	if err := lockAssignmentCohort(ctx, tx, cohortID); err != nil {
		return nil, err
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE curri_template_assignments
		SET ended_by = ?, ended_at = NOW(), end_reason = ?, deleted_at = NOW(), updated_at = NOW()
		WHERE template_assignment_id = ? AND deleted_at IS NULL
	`, userID, reason, assignmentID); err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE comp_templates SET is_active = 0, updated_at = NOW() WHERE template_id = ?`, currentTemplateID); err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO curri_template_assignments (template_id, cohort_id, assigned_by, assigned_at, created_at, updated_at)
		VALUES (?, ?, ?, NOW(), NOW(), NOW())
	`, replacementTemplateID, cohortID, userID); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return r.GetLiveAssignmentForCohort(ctx, cohortID)
}

func (r *TemplateAssignmentRepository) RemoveAssignment(ctx context.Context, assignmentID, userID uint64, reason string) (*models.TemplateAssignment, error) {
	current, err := r.GetAssignmentByID(ctx, assignmentID)
	if err != nil || current == nil {
		return current, err
	}
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()
	if err := lockAssignmentTemplate(ctx, tx, current.TemplateID); err != nil {
		return nil, err
	}
	if err := lockAssignmentCohort(ctx, tx, current.CohortID); err != nil {
		return nil, err
	}
	result, err := tx.ExecContext(ctx, `
		UPDATE curri_template_assignments
		SET ended_by = ?, ended_at = NOW(), end_reason = ?, deleted_at = NOW(), updated_at = NOW()
		WHERE template_assignment_id = ? AND deleted_at IS NULL
	`, userID, reason, assignmentID)
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
	if _, err := tx.ExecContext(ctx, `UPDATE comp_templates SET is_active = 0, updated_at = NOW() WHERE template_id = ?`, current.TemplateID); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	endedAt := time.Now()
	current.EndedBy = &userID
	current.EndedAt = &endedAt
	current.EndReason = &reason
	current.DeletedAt = &endedAt
	current.TemplateIsActive = false
	return current, nil
}

func lockAssignmentTemplate(ctx context.Context, tx *sql.Tx, templateID uint64) error {
	var lockedID uint64
	err := tx.QueryRowContext(ctx, `SELECT template_id FROM comp_templates WHERE template_id = ? AND deleted_at IS NULL FOR UPDATE`, templateID).Scan(&lockedID)
	if errors.Is(err, sql.ErrNoRows) {
		return sql.ErrNoRows
	}
	return err
}

func lockAssignmentCohort(ctx context.Context, tx *sql.Tx, cohortID uint64) error {
	var lockedID uint64
	err := tx.QueryRowContext(ctx, `SELECT cohort_id FROM edu_student_cohorts WHERE cohort_id = ? AND deleted_at IS NULL FOR UPDATE`, cohortID).Scan(&lockedID)
	if errors.Is(err, sql.ErrNoRows) {
		return sql.ErrNoRows
	}
	return err
}

const assignmentSelectQuery = `
	SELECT ta.template_assignment_id, t.template_id, t.name, t.code, t.is_active,
		COALESCE(t.curriculum_id, 0), COALESCE(c.code, ''), COALESCE(c.name_th, ''),
		sc.cohort_id, sc.entry_year_be, sc.status, COALESCE(roster.roster_count, 0),
		ta.assigned_by, ta.assigned_at, ta.ended_by, ta.ended_at, ta.end_reason, ta.deleted_at
	FROM curri_template_assignments ta
	JOIN comp_templates t ON t.template_id = ta.template_id
	JOIN edu_student_cohorts sc ON sc.cohort_id = ta.cohort_id
	LEFT JOIN edu_curricula c ON c.curriculum_id = t.curriculum_id
	LEFT JOIN (
		SELECT ec.cohort_id, COUNT(*) AS roster_count
		FROM kku_enrollment_curricula ec
		WHERE ec.deleted_at IS NULL AND ec.cohort_id IS NOT NULL
		GROUP BY ec.cohort_id
	) roster ON roster.cohort_id = sc.cohort_id
`

func (r *TemplateAssignmentRepository) queryAssignments(ctx context.Context, query string, args ...any) ([]models.TemplateAssignment, error) {
	rows, err := r.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.TemplateAssignment, 0)
	for rows.Next() {
		var item models.TemplateAssignment
		var templateActive bool
		var assignedBy, endedBy sql.NullInt64
		var endedAt, deletedAt sql.NullTime
		var endReason sql.NullString
		if err := rows.Scan(
			&item.TemplateAssignmentID, &item.TemplateID, &item.TemplateName, &item.TemplateCode, &templateActive,
			&item.CurriculumID, &item.CurriculumCode, &item.CurriculumNameTH,
			&item.CohortID, &item.EntryYearBE, &item.CohortStatus, &item.RosterCount,
			&assignedBy, &item.AssignedAt, &endedBy, &endedAt, &endReason, &deletedAt,
		); err != nil {
			return nil, err
		}
		item.TemplateIsActive = templateActive
		if assignedBy.Valid {
			value := uint64(assignedBy.Int64)
			item.AssignedBy = &value
		}
		if endedBy.Valid {
			value := uint64(endedBy.Int64)
			item.EndedBy = &value
		}
		if endedAt.Valid {
			item.EndedAt = &endedAt.Time
		}
		if endReason.Valid {
			item.EndReason = &endReason.String
		}
		if deletedAt.Valid {
			item.DeletedAt = &deletedAt.Time
		}
		locked, err := r.HasCohortScores(ctx, item.CohortID)
		if err != nil {
			return nil, err
		}
		item.ScoreLocked = locked
		items = append(items, item)
	}
	return items, rows.Err()
}
