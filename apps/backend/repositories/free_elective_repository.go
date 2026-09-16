package repositories

import (
	"context"
	"database/sql"
	"strings"

	"github.com/spw32767/university-competency-system-backend/models"
)

type FreeElectiveRepository struct {
	DB *sql.DB
}

func NewFreeElectiveRepository(db *sql.DB) *FreeElectiveRepository {
	return &FreeElectiveRepository{DB: db}
}

const freeElectiveCourseSelect = `
	SELECT course.free_elective_course_id, course.faculty_id,
		faculty.name_th, COALESCE(faculty.name_en, ''), course.code,
		course.name_th, COALESCE(course.name_en, ''), COALESCE(course.description, ''),
		course.credits, course.grade_scheme, course.is_active,
		COALESCE(COUNT(DISTINCT offering.offering_id), 0),
		COALESCE(COUNT(DISTINCT CASE WHEN offering.status <> 'cancelled' THEN offering.offering_id END), 0),
		COALESCE(COUNT(DISTINCT CASE WHEN offering.status = 'finalized' THEN offering.offering_id END), 0),
		course.created_at, course.updated_at
	FROM ele_free_elective_courses course
	JOIN org_faculties faculty ON faculty.faculty_id = course.faculty_id AND faculty.deleted_at IS NULL
	LEFT JOIN ele_free_elective_offerings offering
		ON offering.free_elective_course_id = course.free_elective_course_id
		AND offering.deleted_at IS NULL
	WHERE course.deleted_at IS NULL`

func scanFreeElectiveCourse(scanner interface{ Scan(...any) error }) (*models.FreeElectiveCourse, error) {
	var course models.FreeElectiveCourse
	if err := scanner.Scan(
		&course.FreeElectiveCourseID,
		&course.FacultyID,
		&course.FacultyNameTH,
		&course.FacultyNameEN,
		&course.Code,
		&course.NameTH,
		&course.NameEN,
		&course.Description,
		&course.Credits,
		&course.GradeScheme,
		&course.IsActive,
		&course.OfferingCount,
		&course.ActiveOfferingCount,
		&course.FinalizedOfferingCount,
		&course.CreatedAt,
		&course.UpdatedAt,
	); err != nil {
		return nil, err
	}
	return &course, nil
}

func (r *FreeElectiveRepository) ListCourses(ctx context.Context, facultyID *uint64) ([]*models.FreeElectiveCourse, error) {
	query := freeElectiveCourseSelect
	args := make([]any, 0, 1)
	if facultyID != nil {
		query += " AND course.faculty_id = ?"
		args = append(args, *facultyID)
	}
	query += `
	GROUP BY course.free_elective_course_id, course.faculty_id, faculty.name_th,
		faculty.name_en, course.code, course.name_th, course.name_en,
		course.description, course.credits, course.grade_scheme, course.is_active,
		course.created_at, course.updated_at
	ORDER BY course.name_th, course.code`

	rows, err := r.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	courses := make([]*models.FreeElectiveCourse, 0)
	for rows.Next() {
		course, err := scanFreeElectiveCourse(rows)
		if err != nil {
			return nil, err
		}
		courses = append(courses, course)
	}
	return courses, rows.Err()
}

func (r *FreeElectiveRepository) GetCourse(ctx context.Context, courseID uint64) (*models.FreeElectiveCourse, error) {
	query := freeElectiveCourseSelect + `
		AND course.free_elective_course_id = ?
	GROUP BY course.free_elective_course_id, course.faculty_id, faculty.name_th,
		faculty.name_en, course.code, course.name_th, course.name_en,
		course.description, course.credits, course.grade_scheme, course.is_active,
		course.created_at, course.updated_at`
	return scanFreeElectiveCourse(r.DB.QueryRowContext(ctx, query, courseID))
}

func (r *FreeElectiveRepository) CreateCourse(ctx context.Context, payload models.UpsertFreeElectiveCoursePayload, userID uint64) (*models.FreeElectiveCourse, error) {
	result, err := r.DB.ExecContext(ctx, `
		INSERT INTO ele_free_elective_courses
			(faculty_id, code, name_th, name_en, description, credits, grade_scheme, is_active, created_by, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
		payload.FacultyID,
		strings.TrimSpace(payload.Code),
		strings.TrimSpace(payload.NameTH),
		nullableFreeElectiveString(payload.NameEN),
		nullableFreeElectiveString(payload.Description),
		payload.Credits,
		strings.ToLower(strings.TrimSpace(payload.GradeScheme)),
		freeElectiveBoolOrDefault(payload.IsActive, true),
		userID,
	)
	if err != nil {
		return nil, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}
	return r.GetCourse(ctx, uint64(id))
}

func (r *FreeElectiveRepository) UpdateCourse(ctx context.Context, courseID uint64, payload models.UpsertFreeElectiveCoursePayload, userID uint64, resetGrades bool) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if resetGrades {
		if err := resetFreeElectiveCourseData(ctx, tx, courseID); err != nil {
			return err
		}
	}

	result, err := tx.ExecContext(ctx, `
		UPDATE ele_free_elective_courses
		SET faculty_id = ?, code = ?, name_th = ?, name_en = ?, description = ?,
			credits = ?, grade_scheme = ?, is_active = ?, updated_at = NOW()
		WHERE free_elective_course_id = ? AND deleted_at IS NULL`,
		payload.FacultyID,
		strings.TrimSpace(payload.Code),
		strings.TrimSpace(payload.NameTH),
		nullableFreeElectiveString(payload.NameEN),
		nullableFreeElectiveString(payload.Description),
		payload.Credits,
		strings.ToLower(strings.TrimSpace(payload.GradeScheme)),
		freeElectiveBoolOrDefault(payload.IsActive, true),
		courseID,
	)
	if err != nil {
		return err
	}
	if affected, err := result.RowsAffected(); err != nil {
		return err
	} else if affected == 0 {
		return sql.ErrNoRows
	}

	return tx.Commit()
}

func (r *FreeElectiveRepository) GetCourseImpact(ctx context.Context, courseID uint64) (models.FreeElectiveImpact, error) {
	var impact models.FreeElectiveImpact
	err := r.DB.QueryRowContext(ctx, `
		SELECT
			COUNT(DISTINCT grade.grade_record_id),
			COUNT(DISTINCT enrollment.enrollment_id),
			COUNT(DISTINCT offering.offering_id),
			COUNT(DISTINCT CASE WHEN offering.status = 'finalized' THEN offering.offering_id END),
			COUNT(DISTINCT cohort.cohort_id)
		FROM ele_free_elective_courses course
		LEFT JOIN ele_free_elective_offerings offering
			ON offering.free_elective_course_id = course.free_elective_course_id
			AND offering.deleted_at IS NULL
		LEFT JOIN ele_offering_enrollments enrollment
			ON enrollment.offering_id = offering.offering_id AND enrollment.deleted_at IS NULL
		LEFT JOIN ele_offering_grade_records grade
			ON grade.offering_enrollment_id = enrollment.offering_enrollment_id AND grade.deleted_at IS NULL
		LEFT JOIN kku_enrollment_curricula roster
			ON roster.enrollment_id = enrollment.enrollment_id AND roster.deleted_at IS NULL
		LEFT JOIN edu_student_cohorts cohort
			ON cohort.cohort_id = roster.cohort_id AND cohort.deleted_at IS NULL
		WHERE course.free_elective_course_id = ? AND course.deleted_at IS NULL`, courseID).Scan(
		&impact.GradeRecordCount,
		&impact.LearnerCount,
		&impact.OfferingCount,
		&impact.FinalizedOfferingCount,
		&impact.CohortCount,
	)
	return impact, err
}

func resetFreeElectiveCourseData(ctx context.Context, tx *sql.Tx, courseID uint64) error {
	if _, err := tx.ExecContext(ctx, `
		UPDATE score_free_elective_competency_scores score
		JOIN ele_offering_grade_records grade ON grade.grade_record_id = score.grade_record_id
		JOIN ele_offering_enrollments enrollment ON enrollment.offering_enrollment_id = grade.offering_enrollment_id
		JOIN ele_free_elective_offerings offering ON offering.offering_id = enrollment.offering_id
		SET score.deleted_at = NOW(), score.updated_at = NOW()
		WHERE offering.free_elective_course_id = ? AND score.deleted_at IS NULL`, courseID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE ele_offering_grade_records grade
		JOIN ele_offering_enrollments enrollment ON enrollment.offering_enrollment_id = grade.offering_enrollment_id
		JOIN ele_free_elective_offerings offering ON offering.offering_id = enrollment.offering_id
		SET grade.deleted_at = NOW(), grade.updated_at = NOW()
		WHERE offering.free_elective_course_id = ? AND grade.deleted_at IS NULL`, courseID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE ele_free_elective_offerings
		SET status = CASE WHEN status = 'cancelled' THEN status ELSE 'draft' END,
			finalized_at = NULL, finalized_by = NULL,
			scores_recalculation_required = 1, updated_at = NOW()
		WHERE free_elective_course_id = ? AND deleted_at IS NULL`, courseID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE score_competency_result result
		JOIN kku_enrollment_curricula roster ON roster.enrollment_id = result.enrollment_id AND roster.deleted_at IS NULL
		JOIN ele_offering_enrollments enrollment ON enrollment.enrollment_id = roster.enrollment_id AND enrollment.deleted_at IS NULL
		JOIN ele_free_elective_offerings offering ON offering.offering_id = enrollment.offering_id AND offering.deleted_at IS NULL
		SET result.free_elective_score = 0,
			result.final_score = result.core_score + result.course_bonus_score + result.activity_score,
			result.updated_at = NOW()
		WHERE offering.free_elective_course_id = ? AND result.deleted_at IS NULL`, courseID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE edu_student_cohorts cohort
		JOIN kku_enrollment_curricula roster ON roster.cohort_id = cohort.cohort_id AND roster.deleted_at IS NULL
		JOIN ele_offering_enrollments enrollment ON enrollment.enrollment_id = roster.enrollment_id AND enrollment.deleted_at IS NULL
		JOIN ele_free_elective_offerings offering ON offering.offering_id = enrollment.offering_id AND offering.deleted_at IS NULL
		SET cohort.free_elective_scores_recalculation_required = 1, cohort.updated_at = NOW()
		WHERE offering.free_elective_course_id = ? AND cohort.deleted_at IS NULL`, courseID); err != nil {
		return err
	}
	return nil
}

func nullableFreeElectiveString(value *string) any {
	if value == nil {
		return nil
	}
	valueCopy := strings.TrimSpace(*value)
	if valueCopy == "" {
		return nil
	}
	return valueCopy
}

func freeElectiveBoolOrDefault(value *bool, fallback bool) bool {
	if value == nil {
		return fallback
	}
	return *value
}
