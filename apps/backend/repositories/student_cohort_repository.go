package repositories

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/spw32767/university-competency-system-backend/models"
)

type StudentCohortRepository struct {
	DB *sql.DB
}

type CohortCurriculum struct {
	CurriculumID    uint64
	FacultyID       uint64
	EffectiveYearBE uint64
	Status          string
}

func NewStudentCohortRepository(db *sql.DB) *StudentCohortRepository {
	return &StudentCohortRepository{DB: db}
}

func (r *StudentCohortRepository) GetCohorts(ctx context.Context, filters models.StudentCohortFilters) ([]*models.StudentCohort, error) {
	query, args := buildStudentCohortQuery(filters, false)
	rows, err := r.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]*models.StudentCohort, 0)
	for rows.Next() {
		item, err := scanStudentCohort(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *StudentCohortRepository) GetCohortByID(ctx context.Context, cohortID uint64) (*models.StudentCohort, error) {
	query, args := buildStudentCohortQuery(models.StudentCohortFilters{}, true)
	args = append(args, cohortID)
	return scanStudentCohort(r.DB.QueryRowContext(ctx, query, args...))
}

func (r *StudentCohortRepository) GetCurriculumForCohort(ctx context.Context, curriculumID uint64) (*CohortCurriculum, error) {
	item := &CohortCurriculum{}
	err := r.DB.QueryRowContext(ctx, `
		SELECT curriculum_id, faculty_id, effective_year_be, status
		FROM edu_curricula
		WHERE curriculum_id = ? AND deleted_at IS NULL
	`, curriculumID).Scan(&item.CurriculumID, &item.FacultyID, &item.EffectiveYearBE, &item.Status)
	if err != nil {
		return nil, err
	}
	return item, nil
}

func (r *StudentCohortRepository) CreateCohort(ctx context.Context, payload models.UpsertStudentCohortPayload, userID int64) (*models.StudentCohort, error) {
	result, err := r.DB.ExecContext(ctx, `
		INSERT INTO edu_student_cohorts (curriculum_id, entry_year_be, status, note, created_by)
		VALUES (?, ?, 'draft', ?, ?)
	`, payload.CurriculumID, payload.EntryYearBE, payload.Note, userID)
	if err != nil {
		return nil, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}
	return r.GetCohortByID(ctx, uint64(id))
}

func (r *StudentCohortRepository) UpdateCohort(ctx context.Context, cohortID uint64, payload models.UpdateStudentCohortPayload) (*models.StudentCohort, error) {
	result, err := r.DB.ExecContext(ctx, `
		UPDATE edu_student_cohorts
		SET curriculum_id = ?, entry_year_be = ?, note = ?, updated_at = NOW()
		WHERE cohort_id = ? AND deleted_at IS NULL
	`, payload.CurriculumID, payload.EntryYearBE, payload.Note, cohortID)
	if err != nil {
		return nil, err
	}
	if err := ensureAffected(result); err != nil {
		return nil, err
	}
	return r.GetCohortByID(ctx, cohortID)
}

func (r *StudentCohortRepository) UpdateCohortStatus(ctx context.Context, cohortID uint64, status string, reason *string, userID int64) (*models.StudentCohort, error) {
	var result sql.Result
	var err error
	if status == "active" && reason != nil {
		result, err = r.DB.ExecContext(ctx, `
			UPDATE edu_student_cohorts
			SET status = ?, last_reactivation_reason = ?, last_reactivated_at = NOW(), last_reactivated_by = ?, updated_at = NOW()
			WHERE cohort_id = ? AND deleted_at IS NULL
		`, status, reason, userID, cohortID)
	} else {
		result, err = r.DB.ExecContext(ctx, `
			UPDATE edu_student_cohorts SET status = ?, updated_at = NOW()
			WHERE cohort_id = ? AND deleted_at IS NULL
		`, status, cohortID)
	}
	if err != nil {
		return nil, err
	}
	if err := ensureAffected(result); err != nil {
		return nil, err
	}
	return r.GetCohortByID(ctx, cohortID)
}

func (r *StudentCohortRepository) SoftDeleteCohort(ctx context.Context, cohortID uint64) error {
	result, err := r.DB.ExecContext(ctx, `
		UPDATE edu_student_cohorts SET deleted_at = NOW(), updated_at = NOW()
		WHERE cohort_id = ? AND deleted_at IS NULL
	`, cohortID)
	if err != nil {
		return err
	}
	return ensureAffected(result)
}

func (r *StudentCohortRepository) GetRoster(ctx context.Context, cohortID uint64, filters models.StudentRosterFilters) ([]*models.CohortStudent, error) {
	args := []any{cohortID}
	where := []string{"ec.cohort_id = ?", "ec.deleted_at IS NULL", "e.deleted_at IS NULL", "p.deleted_at IS NULL"}
	if filters.Status != "" {
		where = append(where, "e.enrollment_status = ?")
		args = append(args, filters.Status)
	}
	if filters.Search != "" {
		where = append(where, "(e.student_code LIKE ? OR p.first_name_th LIKE ? OR p.last_name_th LIKE ? OR COALESCE(p.first_name_en, '') LIKE ? OR COALESCE(p.last_name_en, '') LIKE ?)")
		search := "%" + filters.Search + "%"
		args = append(args, search, search, search, search, search)
	}
	rows, err := r.DB.QueryContext(ctx, `
		SELECT ec.enrollment_curriculum_id, e.enrollment_id, p.person_id, e.student_code,
			p.prefix_th, p.first_name_th, p.last_name_th, p.first_name_en, p.last_name_en,
			p.email, p.phone, e.enrollment_status, e.is_kku_student, ec.created_at, ec.updated_at
		FROM kku_enrollment_curricula ec
		JOIN kku_enrollments e ON e.enrollment_id = ec.enrollment_id
		JOIN persons p ON p.person_id = e.person_id
		WHERE `+strings.Join(where, " AND ")+`
		ORDER BY e.student_code
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]*models.CohortStudent, 0)
	for rows.Next() {
		item, err := scanCohortStudent(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *StudentCohortRepository) GetCohortStudentByEnrollmentID(ctx context.Context, cohortID, enrollmentID uint64) (*models.CohortStudent, error) {
	return scanCohortStudent(r.DB.QueryRowContext(ctx, `
		SELECT ec.enrollment_curriculum_id, e.enrollment_id, p.person_id, e.student_code,
			p.prefix_th, p.first_name_th, p.last_name_th, p.first_name_en, p.last_name_en,
			p.email, p.phone, e.enrollment_status, e.is_kku_student, ec.created_at, ec.updated_at
		FROM kku_enrollment_curricula ec
		JOIN kku_enrollments e ON e.enrollment_id = ec.enrollment_id AND e.deleted_at IS NULL
		JOIN persons p ON p.person_id = e.person_id AND p.deleted_at IS NULL
		WHERE ec.cohort_id = ? AND ec.enrollment_id = ? AND ec.deleted_at IS NULL
	`, cohortID, enrollmentID))
}

// FindStudentByCode returns the live enrollment and its current live cohort, if any.
// A nil cohort ID means the student identity exists but is not currently in a cohort.
func (r *StudentCohortRepository) FindStudentByCode(ctx context.Context, studentCode string) (*models.CohortStudent, *uint64, error) {
	student := &models.CohortStudent{}
	var cohortID *uint64
	err := r.DB.QueryRowContext(ctx, `
		SELECT e.enrollment_id, e.enrollment_id, p.person_id, e.student_code,
			p.prefix_th, p.first_name_th, p.last_name_th, p.first_name_en, p.last_name_en,
			p.email, p.phone, e.enrollment_status, e.is_kku_student, e.created_at, e.updated_at,
			(
				SELECT ec.cohort_id FROM kku_enrollment_curricula ec
				WHERE ec.enrollment_id = e.enrollment_id AND ec.deleted_at IS NULL
				ORDER BY ec.is_current DESC, ec.enrollment_curriculum_id DESC LIMIT 1
			)
		FROM kku_enrollments e
		JOIN persons p ON p.person_id = e.person_id AND p.deleted_at IS NULL
		WHERE e.student_code = ? AND e.deleted_at IS NULL
	`, studentCode).Scan(&student.EnrollmentCurriculumID, &student.EnrollmentID, &student.PersonID, &student.StudentCode,
		&student.PrefixTH, &student.FirstNameTH, &student.LastNameTH, &student.FirstNameEN, &student.LastNameEN,
		&student.Email, &student.Phone, &student.EnrollmentStatus, &student.IsKKUStudent, &student.CreatedAt, &student.UpdatedAt,
		&cohortID)
	if err != nil {
		return nil, nil, err
	}
	return student, cohortID, nil
}

func (r *StudentCohortRepository) CreateCohortStudent(ctx context.Context, cohort *models.StudentCohort, payload models.UpsertCohortStudentPayload) (*models.CohortStudent, error) {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()

	personResult, err := tx.ExecContext(ctx, `
		INSERT INTO persons (prefix_th, first_name_th, last_name_th, first_name_en, last_name_en, email, phone)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, payload.PrefixTH, payload.FirstNameTH, payload.LastNameTH, payload.FirstNameEN, payload.LastNameEN, payload.Email, payload.Phone)
	if err != nil {
		return nil, err
	}
	personID, err := personResult.LastInsertId()
	if err != nil {
		return nil, err
	}

	enrollmentResult, err := tx.ExecContext(ctx, `
		INSERT INTO kku_enrollments (person_id, student_code, faculty_id, major_id, entry_year_be, enrollment_status, is_kku_student)
		VALUES (?, ?, ?, ?, ?, ?, 1)
	`, personID, payload.StudentCode, cohort.FacultyID, cohort.MajorID, cohort.EntryYearBE, payload.EnrollmentStatus)
	if err != nil {
		return nil, err
	}
	enrollmentID, err := enrollmentResult.LastInsertId()
	if err != nil {
		return nil, err
	}

	_, err = tx.ExecContext(ctx, `
		INSERT INTO kku_enrollment_curricula (enrollment_id, curriculum_id, cohort_id, start_academic_year_be, start_semester, is_current, change_reason)
		VALUES (?, ?, ?, ?, 1, 1, 'initial')
	`, enrollmentID, cohort.CurriculumID, cohort.CohortID, cohort.EntryYearBE)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return r.GetCohortStudentByEnrollmentID(ctx, cohort.CohortID, uint64(enrollmentID))
}

func (r *StudentCohortRepository) UpdateCohortStudent(ctx context.Context, cohortID, enrollmentID uint64, payload models.UpsertCohortStudentPayload) (*models.CohortStudent, error) {
	result, err := r.DB.ExecContext(ctx, `
		UPDATE persons p
		JOIN kku_enrollments e ON e.person_id = p.person_id
		JOIN kku_enrollment_curricula ec ON ec.enrollment_id = e.enrollment_id
		SET p.prefix_th = ?, p.first_name_th = ?, p.last_name_th = ?, p.first_name_en = ?, p.last_name_en = ?,
			p.email = ?, p.phone = ?, e.enrollment_status = ?, e.is_kku_student = ?,
			p.updated_at = NOW(), e.updated_at = NOW()
		WHERE ec.cohort_id = ? AND e.enrollment_id = ?
			AND ec.deleted_at IS NULL AND e.deleted_at IS NULL AND p.deleted_at IS NULL
	`, payload.PrefixTH, payload.FirstNameTH, payload.LastNameTH, payload.FirstNameEN, payload.LastNameEN,
		payload.Email, payload.Phone, payload.EnrollmentStatus, enrollmentStatusIsCurrent(payload.EnrollmentStatus), cohortID, enrollmentID)
	if err != nil {
		return nil, err
	}
	if err := ensureAffected(result); err != nil {
		return nil, err
	}
	return r.GetCohortStudentByEnrollmentID(ctx, cohortID, enrollmentID)
}

func (r *StudentCohortRepository) SoftRemoveCohortStudent(ctx context.Context, cohortID, enrollmentID uint64) error {
	result, err := r.DB.ExecContext(ctx, `
		UPDATE kku_enrollment_curricula SET deleted_at = NOW(), updated_at = NOW(), is_current = NULL
		WHERE cohort_id = ? AND enrollment_id = ? AND deleted_at IS NULL
	`, cohortID, enrollmentID)
	if err != nil {
		return err
	}
	return ensureAffected(result)
}

func (r *StudentCohortRepository) CountStudentDependencies(ctx context.Context, enrollmentID, personID uint64) (int, error) {
	var count int
	err := r.DB.QueryRowContext(ctx, `
		SELECT (
			SELECT COUNT(*) FROM crs_course_enrollment WHERE enrollment_id = ? AND deleted_at IS NULL
		) + (
			SELECT COUNT(*) FROM score_competency_result WHERE enrollment_id = ? AND deleted_at IS NULL
		) + (
			SELECT COUNT(*) FROM att_session_attendances WHERE person_id = ? AND deleted_at IS NULL
		) + (
			SELECT COUNT(*) FROM score_session_competency_scores WHERE person_id = ? AND deleted_at IS NULL
		)
	`, enrollmentID, enrollmentID, personID, personID).Scan(&count)
	return count, err
}

func (r *StudentCohortRepository) CountActiveTemplatesForCohort(ctx context.Context, cohort *models.StudentCohort) (int, error) {
	var count int
	err := r.DB.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM curri_curriculum_templates cct
		JOIN comp_templates t ON t.template_id = cct.template_id
		WHERE cct.curriculum_id = ? AND cct.cohort_year_be = ? AND cct.deleted_at IS NULL
			AND cct.is_active = 1 AND t.deleted_at IS NULL AND t.is_active = 1
	`, cohort.CurriculumID, cohort.EntryYearBE).Scan(&count)
	return count, err
}

func (r *StudentCohortRepository) ImportCohortStudents(ctx context.Context, cohort *models.StudentCohort, rows []models.ImportCohortStudentRow) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	for _, row := range rows {
		var existingEnrollmentID uint64
		err := tx.QueryRowContext(ctx, `SELECT enrollment_id FROM kku_enrollments WHERE student_code = ? AND deleted_at IS NULL`, row.StudentCode).Scan(&existingEnrollmentID)
		if err == nil {
			if !row.ApplyUpdate {
				continue
			}
			_, err = tx.ExecContext(ctx, `
				UPDATE persons p JOIN kku_enrollments e ON e.person_id = p.person_id
				SET p.prefix_th = ?, p.first_name_th = ?, p.last_name_th = ?, p.first_name_en = ?, p.last_name_en = ?,
					p.email = ?, p.phone = ?, e.enrollment_status = ?, e.is_kku_student = ?,
					p.updated_at = NOW(), e.updated_at = NOW()
				WHERE e.enrollment_id = ?
			`, row.PrefixTH, row.FirstNameTH, row.LastNameTH, row.FirstNameEN, row.LastNameEN, row.Email, row.Phone,
				row.EnrollmentStatus, enrollmentStatusIsCurrent(row.EnrollmentStatus), existingEnrollmentID)
			if err != nil {
				return err
			}
			continue
		}
		if !errors.Is(err, sql.ErrNoRows) {
			return err
		}

		personResult, err := tx.ExecContext(ctx, `
			INSERT INTO persons (prefix_th, first_name_th, last_name_th, first_name_en, last_name_en, email, phone)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`, row.PrefixTH, row.FirstNameTH, row.LastNameTH, row.FirstNameEN, row.LastNameEN, row.Email, row.Phone)
		if err != nil {
			return err
		}
		personID, err := personResult.LastInsertId()
		if err != nil {
			return err
		}
		enrollmentResult, err := tx.ExecContext(ctx, `
			INSERT INTO kku_enrollments (person_id, student_code, faculty_id, major_id, entry_year_be, enrollment_status, is_kku_student)
			VALUES (?, ?, ?, ?, ?, ?, 1)
		`, personID, row.StudentCode, cohort.FacultyID, cohort.MajorID, cohort.EntryYearBE, row.EnrollmentStatus)
		if err != nil {
			return err
		}
		enrollmentID, err := enrollmentResult.LastInsertId()
		if err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, `
			INSERT INTO kku_enrollment_curricula (enrollment_id, curriculum_id, cohort_id, start_academic_year_be, start_semester, is_current, change_reason)
			VALUES (?, ?, ?, ?, 1, 1, 'initial')
		`, enrollmentID, cohort.CurriculumID, cohort.CohortID, cohort.EntryYearBE)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

func buildStudentCohortQuery(filters models.StudentCohortFilters, byID bool) (string, []any) {
	args := make([]any, 0)
	where := []string{"sc.deleted_at IS NULL"}
	if byID {
		where = append(where, "sc.cohort_id = ?")
	} else {
		if filters.FacultyID != nil {
			where = append(where, "c.faculty_id = ?")
			args = append(args, *filters.FacultyID)
		}
		if filters.MajorID != nil {
			where = append(where, "c.major_id = ?")
			args = append(args, *filters.MajorID)
		}
		if filters.CurriculumID != nil {
			where = append(where, "sc.curriculum_id = ?")
			args = append(args, *filters.CurriculumID)
		}
		if filters.EntryYearBE != nil {
			where = append(where, "sc.entry_year_be = ?")
			args = append(args, *filters.EntryYearBE)
		}
		if filters.Status != "" {
			where = append(where, "sc.status = ?")
			args = append(args, filters.Status)
		}
		if filters.Search != "" {
			where = append(where, "(c.code LIKE ? OR c.name_th LIKE ? OR COALESCE(c.name_en, '') LIKE ? OR m.name_th LIKE ?)")
			search := "%" + filters.Search + "%"
			args = append(args, search, search, search, search)
		}
	}
	query := `
		SELECT sc.cohort_id, sc.curriculum_id, c.code, c.name_th, c.name_en, c.effective_year_be,
			c.major_id, m.name_th, c.faculty_id, f.name_th, sc.entry_year_be, sc.status, sc.note,
			COALESCE(roster.roster_count, 0), COALESCE(roster.student_count, 0), COALESCE(roster.suspended_count, 0),
			COALESCE(templates.template_count, 0), COALESCE(templates.active_template_count, 0), sc.last_reactivation_reason,
			sc.last_reactivated_at, sc.last_reactivated_by, sc.created_at, sc.updated_at
		FROM edu_student_cohorts sc
		JOIN edu_curricula c ON c.curriculum_id = sc.curriculum_id AND c.deleted_at IS NULL
		JOIN edu_majors m ON m.major_id = c.major_id
		JOIN org_faculties f ON f.faculty_id = c.faculty_id
		LEFT JOIN (
			SELECT ec.cohort_id, COUNT(*) AS roster_count,
				SUM(e.enrollment_status = 'student') AS student_count,
				SUM(e.enrollment_status = 'suspended') AS suspended_count
			FROM kku_enrollment_curricula ec
			JOIN kku_enrollments e ON e.enrollment_id = ec.enrollment_id AND e.deleted_at IS NULL
			WHERE ec.deleted_at IS NULL AND ec.cohort_id IS NOT NULL
			GROUP BY ec.cohort_id
		) roster ON roster.cohort_id = sc.cohort_id
		LEFT JOIN (
			SELECT cct.curriculum_id, cct.cohort_year_be,
				COUNT(*) AS template_count,
				SUM(CASE WHEN cct.is_active = 1 AND t.is_active = 1 THEN 1 ELSE 0 END) AS active_template_count
			FROM curri_curriculum_templates cct
			JOIN comp_templates t ON t.template_id = cct.template_id AND t.deleted_at IS NULL
			WHERE cct.deleted_at IS NULL
			GROUP BY cct.curriculum_id, cct.cohort_year_be
		) templates ON templates.curriculum_id = sc.curriculum_id AND templates.cohort_year_be = sc.entry_year_be
		WHERE ` + strings.Join(where, " AND ") + `
	`
	if !byID {
		query += " ORDER BY sc.entry_year_be DESC, c.code, sc.cohort_id DESC"
	}
	return query, args
}

type scanner interface{ Scan(...any) error }

func scanStudentCohort(row scanner) (*models.StudentCohort, error) {
	item := &models.StudentCohort{}
	err := row.Scan(&item.CohortID, &item.CurriculumID, &item.CurriculumCode, &item.CurriculumNameTH, &item.CurriculumNameEN,
		&item.CurriculumEffectiveYear, &item.MajorID, &item.MajorNameTH, &item.FacultyID, &item.FacultyNameTH,
		&item.EntryYearBE, &item.Status, &item.Note, &item.RosterCount, &item.StudentCount, &item.SuspendedCount,
		&item.TemplateCount, &item.ActiveTemplateCount, &item.LastReactivationReason, &item.LastReactivatedAt, &item.LastReactivatedBy,
		&item.CreatedAt, &item.UpdatedAt)
	return item, err
}

func scanCohortStudent(row scanner) (*models.CohortStudent, error) {
	item := &models.CohortStudent{}
	err := row.Scan(&item.EnrollmentCurriculumID, &item.EnrollmentID, &item.PersonID, &item.StudentCode,
		&item.PrefixTH, &item.FirstNameTH, &item.LastNameTH, &item.FirstNameEN, &item.LastNameEN,
		&item.Email, &item.Phone, &item.EnrollmentStatus, &item.IsKKUStudent, &item.CreatedAt, &item.UpdatedAt)
	return item, err
}

func enrollmentStatusIsCurrent(status string) bool {
	return status == "student" || status == "suspended"
}
