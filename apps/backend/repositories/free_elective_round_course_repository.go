package repositories

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/spw32767/university-competency-system-backend/grading"
	"github.com/spw32767/university-competency-system-backend/models"
)

var (
	ErrFreeElectiveRoundCourseNotFound      = errors.New("free-elective round course not found")
	ErrFreeElectiveRoundEnrollmentExists    = errors.New("learner is already enrolled in this round course")
	ErrFreeElectiveRoundEnrollmentNotFound  = errors.New("free-elective round enrollment not found")
	ErrFreeElectiveRoundEnrollmentInvalid   = errors.New("enrollment and curriculum selection do not match")
	ErrFreeElectiveRoundGradeTargetNotFound = errors.New("round course enrollment was not found")
)

const freeElectiveRoundCourseSelect = `
	SELECT roundCourse.round_course_id, roundCourse.round_id,
		roundCourse.free_elective_course_id, roundCourse.course_code,
		roundCourse.course_name_th, COALESCE(roundCourse.course_name_en, ''),
		COALESCE(roundCourse.description, ''), roundCourse.credits,
		roundCourse.grade_scheme, roundCourse.display_order,
		COUNT(DISTINCT CASE WHEN enrollment.status IN ('enrolled', 'completed') THEN enrollment.enrollment_id END),
		COUNT(DISTINCT grade.grade_record_id),
		roundCourse.created_at, roundCourse.updated_at
	FROM ele_free_elective_round_courses roundCourse
	JOIN ele_free_elective_rounds round
		ON round.round_id = roundCourse.round_id AND round.deleted_at IS NULL
	LEFT JOIN ele_free_elective_round_course_enrollments enrollment
		ON enrollment.round_course_id = roundCourse.round_course_id
		AND enrollment.deleted_at IS NULL
	LEFT JOIN ele_free_elective_round_course_grade_records grade
		ON grade.round_course_enrollment_id = enrollment.round_course_enrollment_id
		AND grade.deleted_at IS NULL
	WHERE roundCourse.deleted_at IS NULL`

func freeElectiveRoundCourseGroupBy() string {
	return `
	GROUP BY roundCourse.round_course_id, roundCourse.round_id,
		roundCourse.free_elective_course_id, roundCourse.course_code,
		roundCourse.course_name_th, roundCourse.course_name_en,
		roundCourse.description, roundCourse.credits, roundCourse.grade_scheme,
		roundCourse.display_order, roundCourse.created_at, roundCourse.updated_at`
}

func (r *FreeElectiveRepository) GetRoundCourse(ctx context.Context, roundID, roundCourseID uint64) (*models.FreeElectiveRoundCourse, error) {
	query := freeElectiveRoundCourseSelect +
		" AND roundCourse.round_id = ? AND roundCourse.round_course_id = ?" +
		freeElectiveRoundCourseGroupBy()
	course, err := scanFreeElectiveRoundCourse(r.DB.QueryRowContext(ctx, query, roundID, roundCourseID))
	if err != nil {
		return nil, err
	}
	course.Competencies, err = r.GetRoundCourseCompetencies(ctx, roundCourseID)
	if err != nil {
		return nil, err
	}
	return &course, nil
}

func (r *FreeElectiveRepository) GetRoundCourseDetail(ctx context.Context, roundID, roundCourseID uint64) (*models.FreeElectiveRoundCourseDetail, error) {
	course, err := r.GetRoundCourse(ctx, roundID, roundCourseID)
	if err != nil {
		return nil, err
	}
	enrollments, err := r.GetRoundCourseEnrollments(ctx, roundID, roundCourseID)
	if err != nil {
		return nil, err
	}
	return &models.FreeElectiveRoundCourseDetail{
		Course:        *course,
		AllowedGrades: grading.AllowedGrades(course.GradeScheme),
		Enrollments:   enrollments,
	}, nil
}

func (r *FreeElectiveRepository) GetRoundCourseEnrollments(ctx context.Context, roundID, roundCourseID uint64) ([]models.FreeElectiveRoundEnrollment, error) {
	rows, err := r.DB.QueryContext(ctx, `
		SELECT selected.round_course_enrollment_id, selected.round_course_id,
			selected.enrollment_id, selected.enrollment_curriculum_id,
			student.student_code,
			CONCAT_WS(' ', person.first_name_th, person.last_name_th),
			CONCAT_WS(' ', person.first_name_en, person.last_name_en),
			curriculum.curriculum_id, curriculum.name_th,
			COALESCE(curriculum.name_en, ''), COALESCE(cohort.cohort_id, 0),
			COALESCE(cohort.entry_year_be, 0), student.enrollment_status,
			selected.status, grade.grade_record_id, grade.grade, grade.grade_source,
			COALESCE(grade.is_best_grade, 0), grade.updated_at
		FROM ele_free_elective_round_course_enrollments selected
		JOIN ele_free_elective_round_courses roundCourse
			ON roundCourse.round_course_id = selected.round_course_id
			AND roundCourse.round_id = ? AND roundCourse.deleted_at IS NULL
		JOIN ele_free_elective_rounds round
			ON round.round_id = roundCourse.round_id AND round.deleted_at IS NULL
		JOIN kku_enrollments student
			ON student.enrollment_id = selected.enrollment_id
			AND student.deleted_at IS NULL
		JOIN persons person
			ON person.person_id = student.person_id AND person.deleted_at IS NULL
		JOIN kku_enrollment_curricula roster
			ON roster.enrollment_curriculum_id = selected.enrollment_curriculum_id
			AND roster.enrollment_id = selected.enrollment_id
			AND roster.deleted_at IS NULL
		JOIN edu_curricula curriculum
			ON curriculum.curriculum_id = roster.curriculum_id
			AND curriculum.deleted_at IS NULL
		LEFT JOIN edu_student_cohorts cohort
			ON cohort.cohort_id = roster.cohort_id AND cohort.deleted_at IS NULL
		LEFT JOIN ele_free_elective_round_course_grade_records grade
			ON grade.round_course_enrollment_id = selected.round_course_enrollment_id
			AND grade.deleted_at IS NULL
		WHERE selected.round_course_id = ? AND selected.deleted_at IS NULL
		ORDER BY student.student_code, selected.round_course_enrollment_id`, roundID, roundCourseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.FreeElectiveRoundEnrollment, 0)
	for rows.Next() {
		item, err := scanFreeElectiveRoundEnrollment(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func scanFreeElectiveRoundEnrollment(scanner interface{ Scan(...any) error }) (models.FreeElectiveRoundEnrollment, error) {
	var item models.FreeElectiveRoundEnrollment
	var gradeRecordID sql.NullInt64
	var grade, source sql.NullString
	var updatedAt sql.NullTime
	if err := scanner.Scan(
		&item.RoundCourseEnrollmentID,
		&item.RoundCourseID,
		&item.EnrollmentID,
		&item.EnrollmentCurriculumID,
		&item.StudentCode,
		&item.StudentNameTH,
		&item.StudentNameEN,
		&item.CurriculumID,
		&item.CurriculumNameTH,
		&item.CurriculumNameEN,
		&item.CohortID,
		&item.EntryYearBE,
		&item.EnrollmentStatus,
		&item.Status,
		&gradeRecordID,
		&grade,
		&source,
		&item.IsBestGrade,
		&updatedAt,
	); err != nil {
		return item, err
	}
	if gradeRecordID.Valid {
		value := uint64(gradeRecordID.Int64)
		item.GradeRecordID = &value
	}
	item.Grade = grade.String
	item.GradeSource = source.String
	if updatedAt.Valid {
		item.UpdatedAt = &updatedAt.Time
	}
	return item, nil
}

func (r *FreeElectiveRepository) ActiveCompetencyIDs(ctx context.Context, ids []uint64) (map[uint64]struct{}, error) {
	result := make(map[uint64]struct{}, len(ids))
	if len(ids) == 0 {
		return result, nil
	}
	placeholders := make([]string, len(ids))
	args := make([]any, len(ids))
	for index, id := range ids {
		placeholders[index] = "?"
		args[index] = id
	}
	rows, err := r.DB.QueryContext(ctx, fmt.Sprintf(`
		SELECT competency_id
		FROM comp_competencies
		WHERE deleted_at IS NULL AND competency_id IN (%s)`, strings.Join(placeholders, ",")), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id uint64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		result[id] = struct{}{}
	}
	return result, rows.Err()
}

func lockFreeElectiveRound(ctx context.Context, tx *sql.Tx, roundID uint64) (string, error) {
	var status string
	err := tx.QueryRowContext(ctx, `
		SELECT status
		FROM ele_free_elective_rounds
		WHERE round_id = ? AND deleted_at IS NULL
		FOR UPDATE`, roundID).Scan(&status)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrFreeElectiveRoundNotFound
	}
	return status, err
}

func ensureFreeElectiveRoundEditable(status string) error {
	if status == "finalized" || status == "cancelled" {
		return ErrFreeElectiveRoundLocked
	}
	return nil
}

func markFreeElectiveRoundScoresRequired(ctx context.Context, tx *sql.Tx, roundID uint64) error {
	_, err := tx.ExecContext(ctx, `
		UPDATE ele_free_elective_rounds
		SET scores_recalculation_required = 1, updated_at = NOW()
		WHERE round_id = ? AND deleted_at IS NULL`, roundID)
	return err
}

func (r *FreeElectiveRepository) AddRoundCourse(ctx context.Context, roundID, userID uint64, input models.FreeElectiveRoundCourseInput) (*models.FreeElectiveRoundCourse, error) {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()

	status, err := lockFreeElectiveRound(ctx, tx, roundID)
	if err != nil {
		return nil, err
	}
	if err := ensureFreeElectiveRoundEditable(status); err != nil {
		return nil, err
	}
	var facultyID uint64
	if err := tx.QueryRowContext(ctx, `
		SELECT faculty_id
		FROM ele_free_elective_rounds
		WHERE round_id = ? AND deleted_at IS NULL`, roundID).Scan(&facultyID); err != nil {
		return nil, err
	}
	var exists bool
	if err := tx.QueryRowContext(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM ele_free_elective_round_courses
			WHERE round_id = ? AND free_elective_course_id = ? AND deleted_at IS NULL
		)`, roundID, input.FreeElectiveCourseID).Scan(&exists); err != nil {
		return nil, err
	}
	if exists {
		return nil, ErrFreeElectiveRoundCourseExists
	}
	var displayOrder int
	if err := tx.QueryRowContext(ctx, `
		SELECT COALESCE(MAX(display_order), 0) + 1
		FROM ele_free_elective_round_courses
		WHERE round_id = ? AND deleted_at IS NULL`, roundID).Scan(&displayOrder); err != nil {
		return nil, err
	}
	roundCourseID, err := insertFreeElectiveRoundCourse(ctx, tx, roundID, facultyID, userID, displayOrder, input)
	if err != nil {
		return nil, err
	}
	if err := insertFreeElectiveRoundCourseCompetencies(ctx, tx, roundCourseID, input.Competencies); err != nil {
		return nil, err
	}
	if err := markFreeElectiveRoundScoresRequired(ctx, tx, roundID); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return r.GetRoundCourse(ctx, roundID, roundCourseID)
}

func (r *FreeElectiveRepository) ReplaceRoundCourseCompetencies(ctx context.Context, roundID, roundCourseID uint64, competencies []models.FreeElectiveRoundCompetencyInput) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	status, err := lockFreeElectiveRound(ctx, tx, roundID)
	if err != nil {
		return err
	}
	if err := ensureFreeElectiveRoundEditable(status); err != nil {
		return err
	}
	var exists bool
	if err := tx.QueryRowContext(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM ele_free_elective_round_courses
			WHERE round_id = ? AND round_course_id = ? AND deleted_at IS NULL
		)`, roundID, roundCourseID).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return ErrFreeElectiveRoundCourseNotFound
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE score_free_elective_round_course_competency_scores score
		JOIN ele_free_elective_round_course_competencies mapping
			ON mapping.round_course_competency_id = score.round_course_competency_id
		SET score.deleted_at = NOW(), score.updated_at = NOW()
		WHERE mapping.round_course_id = ? AND score.deleted_at IS NULL`, roundCourseID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE ele_free_elective_round_course_competencies
		SET deleted_at = NOW(), updated_at = NOW()
		WHERE round_course_id = ? AND deleted_at IS NULL`, roundCourseID); err != nil {
		return err
	}
	if err := insertFreeElectiveRoundCourseCompetencies(ctx, tx, roundCourseID, competencies); err != nil {
		return err
	}
	if err := markFreeElectiveRoundScoresRequired(ctx, tx, roundID); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *FreeElectiveRepository) DeleteRoundCourse(ctx context.Context, roundID, roundCourseID uint64) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	status, err := lockFreeElectiveRound(ctx, tx, roundID)
	if err != nil {
		return err
	}
	if status != "draft" {
		return ErrFreeElectiveRoundLocked
	}
	var learnerCount int
	if err := tx.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM ele_free_elective_round_course_enrollments
		WHERE round_course_id = ? AND deleted_at IS NULL`, roundCourseID).Scan(&learnerCount); err != nil {
		return err
	}
	if learnerCount > 0 {
		return ErrFreeElectiveRoundCourseUsed
	}
	result, err := tx.ExecContext(ctx, `
		UPDATE ele_free_elective_round_courses
		SET deleted_at = NOW(), updated_at = NOW()
		WHERE round_id = ? AND round_course_id = ? AND deleted_at IS NULL`, roundID, roundCourseID)
	if err != nil {
		return err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return ErrFreeElectiveRoundCourseNotFound
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE ele_free_elective_round_course_competencies
		SET deleted_at = NOW(), updated_at = NOW()
		WHERE round_course_id = ? AND deleted_at IS NULL`, roundCourseID); err != nil {
		return err
	}
	return tx.Commit()
}

func roundCourseLearnerScope(roundID, roundCourseID uint64, filters models.FreeElectiveRoundLearnerFilters) (string, []any) {
	query := `
		FROM ele_free_elective_round_courses roundCourse
		JOIN ele_free_elective_rounds round
			ON round.round_id = roundCourse.round_id AND round.deleted_at IS NULL
		JOIN kku_enrollments student
			ON student.deleted_at IS NULL AND student.enrollment_status = 'student'
		JOIN persons person
			ON person.person_id = student.person_id AND person.deleted_at IS NULL
		JOIN kku_enrollment_curricula roster
			ON roster.enrollment_id = student.enrollment_id
			AND roster.deleted_at IS NULL
			AND roster.enrollment_curriculum_id = (
				SELECT currentRoster.enrollment_curriculum_id
				FROM kku_enrollment_curricula currentRoster
				WHERE currentRoster.enrollment_id = student.enrollment_id
					AND currentRoster.deleted_at IS NULL
				ORDER BY COALESCE(currentRoster.is_current, 0) DESC,
					currentRoster.enrollment_curriculum_id DESC
				LIMIT 1
			)
		JOIN edu_curricula curriculum
			ON curriculum.curriculum_id = roster.curriculum_id AND curriculum.deleted_at IS NULL
		JOIN edu_majors major
			ON major.major_id = curriculum.major_id AND major.deleted_at IS NULL
		JOIN org_departments department
			ON department.department_id = major.department_id AND department.deleted_at IS NULL
		JOIN org_faculties faculty
			ON faculty.faculty_id = department.faculty_id AND faculty.deleted_at IS NULL
		LEFT JOIN edu_student_cohorts cohort
			ON cohort.cohort_id = roster.cohort_id AND cohort.deleted_at IS NULL
		WHERE roundCourse.round_id = ? AND roundCourse.round_course_id = ?
			AND roundCourse.deleted_at IS NULL
			AND NOT EXISTS (
				SELECT 1
				FROM ele_free_elective_round_course_enrollments selected
				WHERE selected.round_course_id = roundCourse.round_course_id
					AND selected.enrollment_id = student.enrollment_id
					AND selected.deleted_at IS NULL
			)`
	args := []any{roundID, roundCourseID}
	if filters.FacultyID != nil {
		query += " AND faculty.faculty_id = ?"
		args = append(args, *filters.FacultyID)
	}
	if filters.MajorID != nil {
		query += " AND major.major_id = ?"
		args = append(args, *filters.MajorID)
	}
	if filters.CurriculumID != nil {
		query += " AND curriculum.curriculum_id = ?"
		args = append(args, *filters.CurriculumID)
	}
	if filters.EntryYearBE != nil {
		query += " AND cohort.entry_year_be = ?"
		args = append(args, *filters.EntryYearBE)
	}
	search := strings.TrimSpace(filters.Search)
	if search != "" {
		like := "%" + search + "%"
		query += ` AND (student.student_code LIKE ?
			OR CONCAT_WS(' ', person.first_name_th, person.last_name_th) LIKE ?
			OR CONCAT_WS(' ', person.first_name_en, person.last_name_en) LIKE ?)`
		args = append(args, like, like, like)
	}
	return query, args
}

func (r *FreeElectiveRepository) ListRoundCourseLearners(ctx context.Context, roundID, roundCourseID uint64, filters models.FreeElectiveRoundLearnerFilters) ([]models.FreeElectiveStudent, error) {
	scope, args := roundCourseLearnerScope(roundID, roundCourseID, filters)
	rows, err := r.DB.QueryContext(ctx, `
		SELECT student.enrollment_id, roster.enrollment_curriculum_id,
			faculty.faculty_id, faculty.name_th, COALESCE(faculty.name_en, ''),
			major.major_id, major.name_th, COALESCE(major.name_en, ''),
			student.student_code,
			CONCAT_WS(' ', person.first_name_th, person.last_name_th),
			CONCAT_WS(' ', person.first_name_en, person.last_name_en),
			curriculum.curriculum_id, curriculum.name_th, COALESCE(curriculum.name_en, ''),
			COALESCE(cohort.entry_year_be, 0)`+scope+`
		ORDER BY student.student_code`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.FreeElectiveStudent, 0)
	for rows.Next() {
		var item models.FreeElectiveStudent
		if err := rows.Scan(
			&item.EnrollmentID,
			&item.EnrollmentCurriculumID,
			&item.FacultyID,
			&item.FacultyNameTH,
			&item.FacultyNameEN,
			&item.MajorID,
			&item.MajorNameTH,
			&item.MajorNameEN,
			&item.StudentCode,
			&item.StudentNameTH,
			&item.StudentNameEN,
			&item.CurriculumID,
			&item.CurriculumNameTH,
			&item.CurriculumNameEN,
			&item.EntryYearBE,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *FreeElectiveRepository) CountRoundCourseLearners(ctx context.Context, roundID, roundCourseID uint64, filters models.FreeElectiveRoundLearnerFilters) (int, error) {
	scope, args := roundCourseLearnerScope(roundID, roundCourseID, filters)
	var count int
	if err := r.DB.QueryRowContext(ctx, "SELECT COUNT(DISTINCT student.enrollment_id)"+scope, args...).Scan(&count); err != nil {
		return 0, err
	}
	return count, nil
}

func (r *FreeElectiveRepository) AddRoundCourseEnrollments(ctx context.Context, roundID, roundCourseID, userID uint64, inputs []models.FreeElectiveEnrollmentInput) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	status, err := lockFreeElectiveRound(ctx, tx, roundID)
	if err != nil {
		return err
	}
	if err := ensureFreeElectiveRoundEditable(status); err != nil {
		return err
	}
	var courseExists bool
	if err := tx.QueryRowContext(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM ele_free_elective_round_courses
			WHERE round_id = ? AND round_course_id = ? AND deleted_at IS NULL
		)`, roundID, roundCourseID).Scan(&courseExists); err != nil {
		return err
	}
	if !courseExists {
		return ErrFreeElectiveRoundCourseNotFound
	}
	seen := make(map[uint64]struct{}, len(inputs))
	for _, input := range inputs {
		if input.EnrollmentID == 0 || input.EnrollmentCurriculumID == 0 {
			return ErrFreeElectiveRoundEnrollmentInvalid
		}
		if _, exists := seen[input.EnrollmentID]; exists {
			return ErrFreeElectiveRoundEnrollmentExists
		}
		seen[input.EnrollmentID] = struct{}{}
		var validPair bool
		if err := tx.QueryRowContext(ctx, `
			SELECT EXISTS(
				SELECT 1
				FROM kku_enrollments student
				JOIN kku_enrollment_curricula roster
					ON roster.enrollment_id = student.enrollment_id
					AND roster.enrollment_curriculum_id = ?
					AND roster.deleted_at IS NULL
				WHERE student.enrollment_id = ? AND student.enrollment_status = 'student'
					AND student.deleted_at IS NULL
			)`, input.EnrollmentCurriculumID, input.EnrollmentID).Scan(&validPair); err != nil {
			return err
		}
		if !validPair {
			return ErrFreeElectiveRoundEnrollmentInvalid
		}
		var existing bool
		if err := tx.QueryRowContext(ctx, `
			SELECT EXISTS(
				SELECT 1
				FROM ele_free_elective_round_course_enrollments
				WHERE round_course_id = ? AND enrollment_id = ? AND deleted_at IS NULL
			)`, roundCourseID, input.EnrollmentID).Scan(&existing); err != nil {
			return err
		}
		if existing {
			return ErrFreeElectiveRoundEnrollmentExists
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO ele_free_elective_round_course_enrollments
				(round_course_id, enrollment_id, enrollment_curriculum_id,
				 status, enrolled_at, enrolled_by, created_at, updated_at)
			VALUES (?, ?, ?, 'enrolled', NOW(), ?, NOW(), NOW())`,
			roundCourseID, input.EnrollmentID, input.EnrollmentCurriculumID, userID); err != nil {
			return err
		}
	}
	if err := markFreeElectiveRoundScoresRequired(ctx, tx, roundID); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *FreeElectiveRepository) AddAllRoundCourseLearners(ctx context.Context, roundID, roundCourseID, userID uint64, filters models.FreeElectiveRoundLearnerFilters) (int, error) {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer func() { _ = tx.Rollback() }()
	status, err := lockFreeElectiveRound(ctx, tx, roundID)
	if err != nil {
		return 0, err
	}
	if err := ensureFreeElectiveRoundEditable(status); err != nil {
		return 0, err
	}
	var courseExists bool
	if err := tx.QueryRowContext(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM ele_free_elective_round_courses
			WHERE round_id = ? AND round_course_id = ? AND deleted_at IS NULL
		)`, roundID, roundCourseID).Scan(&courseExists); err != nil {
		return 0, err
	}
	if !courseExists {
		return 0, ErrFreeElectiveRoundCourseNotFound
	}
	scope, scopeArgs := roundCourseLearnerScope(roundID, roundCourseID, filters)
	result, err := tx.ExecContext(ctx, `
		INSERT INTO ele_free_elective_round_course_enrollments
			(round_course_id, enrollment_id, enrollment_curriculum_id,
			 status, enrolled_at, enrolled_by, created_at, updated_at)
		SELECT ?, student.enrollment_id, roster.enrollment_curriculum_id,
			'enrolled', NOW(), ?, NOW(), NOW()`+scope, append([]any{roundCourseID, userID}, scopeArgs...)...)
	if err != nil {
		return 0, err
	}
	added, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}
	if added > 0 {
		if err := markFreeElectiveRoundScoresRequired(ctx, tx, roundID); err != nil {
			return 0, err
		}
	}
	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return int(added), nil
}

func (r *FreeElectiveRepository) UpdateRoundCourseEnrollmentStatus(ctx context.Context, roundID, roundCourseID, enrollmentID uint64, status string) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	roundStatus, err := lockFreeElectiveRound(ctx, tx, roundID)
	if err != nil {
		return err
	}
	if err := ensureFreeElectiveRoundEditable(roundStatus); err != nil {
		return err
	}
	result, err := tx.ExecContext(ctx, `
		UPDATE ele_free_elective_round_course_enrollments
		SET status = ?, updated_at = NOW()
		WHERE round_course_enrollment_id = ? AND round_course_id = ? AND deleted_at IS NULL`,
		status, enrollmentID, roundCourseID)
	if err != nil {
		return err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return ErrFreeElectiveRoundEnrollmentNotFound
	}
	if err := markFreeElectiveRoundScoresRequired(ctx, tx, roundID); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *FreeElectiveRepository) UpsertRoundCourseGrade(ctx context.Context, roundID, roundCourseID, roundCourseEnrollmentID, userID uint64, grade, source string, sourceReference *string) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	status, err := lockFreeElectiveRound(ctx, tx, roundID)
	if err != nil {
		return err
	}
	if err := ensureFreeElectiveRoundEditable(status); err != nil {
		return err
	}
	if err := r.upsertRoundCourseGradeByEnrollmentKey(
		ctx,
		tx,
		roundID,
		roundCourseID,
		roundCourseEnrollmentID,
		userID,
		grade,
		source,
		sourceReference,
	); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *FreeElectiveRepository) upsertRoundCourseGradeByEnrollmentKey(ctx context.Context, tx *sql.Tx, roundID, roundCourseID, roundCourseEnrollmentID, userID uint64, grade, source string, sourceReference *string) error {
	var targetRoundID uint64
	var targetStatus, enrollmentStatus string
	if err := tx.QueryRowContext(ctx, `
		SELECT roundCourse.round_id, round.status, selected.status
		FROM ele_free_elective_round_course_enrollments selected
		JOIN ele_free_elective_round_courses roundCourse
			ON roundCourse.round_course_id = selected.round_course_id
		JOIN ele_free_elective_rounds round
			ON round.round_id = roundCourse.round_id
		WHERE selected.round_course_enrollment_id = ?
			AND selected.round_course_id = ? AND roundCourse.round_id = ?
			AND selected.deleted_at IS NULL AND roundCourse.deleted_at IS NULL
			AND round.deleted_at IS NULL
		FOR UPDATE`, roundCourseEnrollmentID, roundCourseID, roundID).Scan(
		&targetRoundID, &targetStatus, &enrollmentStatus); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrFreeElectiveRoundGradeTargetNotFound
		}
		return err
	}
	if targetRoundID != roundID {
		return ErrFreeElectiveRoundGradeTargetNotFound
	}
	if err := ensureFreeElectiveRoundEditable(targetStatus); err != nil {
		return err
	}
	if enrollmentStatus == "withdrawn" {
		return ErrFreeElectiveRoundEnrollmentInvalid
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO ele_free_elective_round_course_grade_records
			(round_course_enrollment_id, grade, grade_source, source_reference,
			 is_best_grade, recorded_by, recorded_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, 0, ?, NOW(), NOW(), NOW())
		ON DUPLICATE KEY UPDATE
			grade = VALUES(grade), grade_source = VALUES(grade_source),
			source_reference = VALUES(source_reference), recorded_by = VALUES(recorded_by),
			recorded_at = NOW(), updated_at = NOW()`,
		roundCourseEnrollmentID, grade, source, sourceReference, userID); err != nil {
		return err
	}
	return markFreeElectiveRoundScoresRequired(ctx, tx, roundID)
}

// RecalculateRoundCourseBestGrade marks the active best grade across all
// rounds for the same learner and master free-elective course.
func (r *FreeElectiveRepository) RecalculateRoundCourseBestGrade(ctx context.Context, enrollmentID, masterCourseID uint64) error {
	rows, err := r.DB.QueryContext(ctx, `
		SELECT grade.grade_record_id, grade.grade, roundCourse.grade_scheme,
			round.academic_year_be, round.semester
		FROM ele_free_elective_round_course_grade_records grade
		JOIN ele_free_elective_round_course_enrollments selected
			ON selected.round_course_enrollment_id = grade.round_course_enrollment_id
			AND selected.enrollment_id = ? AND selected.deleted_at IS NULL
			AND selected.status IN ('enrolled', 'completed')
		JOIN ele_free_elective_round_courses roundCourse
			ON roundCourse.round_course_id = selected.round_course_id
			AND roundCourse.free_elective_course_id = ? AND roundCourse.deleted_at IS NULL
		JOIN ele_free_elective_rounds round
			ON round.round_id = roundCourse.round_id AND round.deleted_at IS NULL
		WHERE grade.deleted_at IS NULL`, enrollmentID, masterCourseID)
	if err != nil {
		return err
	}
	type candidate struct {
		id       uint64
		grade    string
		scheme   string
		year     uint64
		semester uint64
	}
	candidates := make([]candidate, 0)
	for rows.Next() {
		var item candidate
		if err := rows.Scan(&item.id, &item.grade, &item.scheme, &item.year, &item.semester); err != nil {
			_ = rows.Close()
			return err
		}
		candidates = append(candidates, item)
	}
	if err := rows.Err(); err != nil {
		_ = rows.Close()
		return err
	}
	_ = rows.Close()

	var bestID uint64
	var best grading.GradeAttempt
	for _, item := range candidates {
		attempt := grading.GradeAttempt{
			Evaluation:     grading.Evaluate(item.scheme, item.grade),
			AcademicYearBE: item.year,
			Semester:       item.semester,
		}
		if bestID == 0 || grading.IsBetterAttempt(attempt, best) {
			bestID = item.id
			best = attempt
		}
	}

	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.ExecContext(ctx, `
		UPDATE ele_free_elective_round_course_grade_records grade
		JOIN ele_free_elective_round_course_enrollments selected
			ON selected.round_course_enrollment_id = grade.round_course_enrollment_id
		JOIN ele_free_elective_round_courses roundCourse
			ON roundCourse.round_course_id = selected.round_course_id
		SET grade.is_best_grade = CASE WHEN grade.grade_record_id = ? THEN 1 ELSE 0 END,
			grade.updated_at = NOW()
		WHERE selected.enrollment_id = ? AND roundCourse.free_elective_course_id = ?
			AND selected.deleted_at IS NULL AND grade.deleted_at IS NULL`, bestID, enrollmentID, masterCourseID); err != nil {
		return err
	}
	return tx.Commit()
}
