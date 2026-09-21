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
		COALESCE(COUNT(DISTINCT roundCourse.round_course_id), 0),
		COALESCE(COUNT(DISTINCT CASE WHEN round.status <> 'cancelled' THEN roundCourse.round_course_id END), 0),
		COALESCE(COUNT(DISTINCT CASE WHEN round.status = 'finalized' THEN roundCourse.round_course_id END), 0),
		course.created_at, course.updated_at
	FROM ele_courses course
	JOIN org_faculties faculty ON faculty.faculty_id = course.faculty_id AND faculty.deleted_at IS NULL
	LEFT JOIN ele_round_courses roundCourse
		ON roundCourse.free_elective_course_id = course.free_elective_course_id
		AND roundCourse.deleted_at IS NULL
	LEFT JOIN ele_rounds round
		ON round.round_id = roundCourse.round_id AND round.deleted_at IS NULL
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
		&course.RoundCount,
		&course.ActiveRoundCount,
		&course.FinalizedRoundCount,
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

func (r *FreeElectiveRepository) FindCourseByCode(ctx context.Context, facultyID uint64, code string) (*models.FreeElectiveCourse, error) {
	query := freeElectiveCourseSelect + `
		AND course.faculty_id = ? AND course.code = ?
	GROUP BY course.free_elective_course_id, course.faculty_id, faculty.name_th,
		faculty.name_en, course.code, course.name_th, course.name_en,
		course.description, course.credits, course.grade_scheme, course.is_active,
		course.created_at, course.updated_at`
	return scanFreeElectiveCourse(r.DB.QueryRowContext(
		ctx,
		query,
		facultyID,
		strings.TrimSpace(code),
	))
}

func (r *FreeElectiveRepository) CreateCourse(ctx context.Context, payload models.UpsertFreeElectiveCoursePayload, userID uint64) (*models.FreeElectiveCourse, error) {
	result, err := r.DB.ExecContext(ctx, `
		INSERT INTO ele_courses
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
		UPDATE ele_courses
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
	if _, err := tx.ExecContext(ctx, `
		UPDATE ele_round_courses
		SET grade_scheme = ?, updated_at = NOW()
		WHERE free_elective_course_id = ? AND deleted_at IS NULL`,
		strings.ToLower(strings.TrimSpace(payload.GradeScheme)), courseID); err != nil {
		return err
	}

	return tx.Commit()
}

func (r *FreeElectiveRepository) GetCourseImpact(ctx context.Context, courseID uint64) (models.FreeElectiveImpact, error) {
	var impact models.FreeElectiveImpact
	err := r.DB.QueryRowContext(ctx, `
		SELECT
			COUNT(DISTINCT grade.grade_record_id),
			COUNT(DISTINCT enrollment.enrollment_id),
			COUNT(DISTINCT roundCourse.round_course_id),
			COUNT(DISTINCT CASE WHEN round.status = 'finalized' THEN roundCourse.round_course_id END),
			COUNT(DISTINCT cohort.cohort_id)
		FROM ele_courses course
		LEFT JOIN ele_round_courses roundCourse
			ON roundCourse.free_elective_course_id = course.free_elective_course_id
			AND roundCourse.deleted_at IS NULL
		LEFT JOIN ele_rounds round
			ON round.round_id = roundCourse.round_id AND round.deleted_at IS NULL
		LEFT JOIN ele_course_enrollments enrollment
			ON enrollment.round_course_id = roundCourse.round_course_id AND enrollment.deleted_at IS NULL
		LEFT JOIN ele_course_grades grade
			ON grade.round_course_enrollment_id = enrollment.round_course_enrollment_id AND grade.deleted_at IS NULL
		LEFT JOIN kku_enrollment_curricula roster
			ON roster.enrollment_id = enrollment.enrollment_id AND roster.deleted_at IS NULL
		LEFT JOIN edu_student_cohorts cohort
			ON cohort.cohort_id = roster.cohort_id AND cohort.deleted_at IS NULL
		WHERE course.free_elective_course_id = ? AND course.deleted_at IS NULL`, courseID).Scan(
		&impact.GradeRecordCount,
		&impact.LearnerCount,
		&impact.RoundCount,
		&impact.FinalizedRoundCount,
		&impact.CohortCount,
	)
	return impact, err
}

func resetFreeElectiveCourseData(ctx context.Context, tx *sql.Tx, courseID uint64) error {
	cohortIDs, err := getFreeElectiveCourseCohortIDs(ctx, tx, courseID)
	if err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE ele_course_scores score
		JOIN ele_course_grades grade ON grade.grade_record_id = score.grade_record_id
		JOIN ele_course_enrollments enrollment ON enrollment.round_course_enrollment_id = grade.round_course_enrollment_id
		JOIN ele_round_courses roundCourse ON roundCourse.round_course_id = enrollment.round_course_id
		SET score.deleted_at = NOW(), score.updated_at = NOW()
		WHERE roundCourse.free_elective_course_id = ? AND score.deleted_at IS NULL`, courseID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE ele_course_grades grade
		JOIN ele_course_enrollments enrollment ON enrollment.round_course_enrollment_id = grade.round_course_enrollment_id
		JOIN ele_round_courses roundCourse ON roundCourse.round_course_id = enrollment.round_course_id
		SET grade.deleted_at = NOW(), grade.updated_at = NOW()
		WHERE roundCourse.free_elective_course_id = ? AND grade.deleted_at IS NULL`, courseID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE ele_rounds round
		JOIN ele_round_courses roundCourse ON roundCourse.round_id = round.round_id
		SET round.status = CASE WHEN round.status = 'cancelled' THEN round.status ELSE 'draft' END,
			round.finalized_at = NULL, round.finalized_by = NULL,
			round.scores_recalculation_required = 1, round.updated_at = NOW()
		WHERE roundCourse.free_elective_course_id = ?
			AND roundCourse.deleted_at IS NULL AND round.deleted_at IS NULL`, courseID); err != nil {
		return err
	}
	for cohortID := range cohortIDs {
		if err := recomputeCompetencyResultsTx(ctx, tx, cohortID); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `
			UPDATE edu_student_cohorts
			SET free_elective_scores_recalculation_required = 1,
				free_elective_scores_recalculated_at = NULL, updated_at = NOW()
			WHERE cohort_id = ? AND deleted_at IS NULL`, cohortID); err != nil {
			return err
		}
	}
	return nil
}

func getFreeElectiveCourseCohortIDs(ctx context.Context, tx *sql.Tx, courseID uint64) (map[uint64]struct{}, error) {
	rows, err := tx.QueryContext(ctx, `
		SELECT DISTINCT roster.cohort_id
		FROM ele_round_courses roundCourse
		JOIN ele_course_enrollments enrollment
			ON enrollment.round_course_id = roundCourse.round_course_id AND enrollment.deleted_at IS NULL
		JOIN kku_enrollment_curricula roster
			ON roster.enrollment_curriculum_id = enrollment.enrollment_curriculum_id
			AND roster.enrollment_id = enrollment.enrollment_id AND roster.deleted_at IS NULL
		JOIN kku_enrollments student ON student.enrollment_id = enrollment.enrollment_id
			AND student.enrollment_status = 'student' AND student.deleted_at IS NULL
		WHERE roundCourse.free_elective_course_id = ?
			AND roundCourse.deleted_at IS NULL AND roster.cohort_id IS NOT NULL
		UNION
		SELECT DISTINCT roster.cohort_id
		FROM ele_course_scores score
		JOIN ele_course_grades grade ON grade.grade_record_id = score.grade_record_id
		JOIN ele_course_enrollments enrollment ON enrollment.round_course_enrollment_id = grade.round_course_enrollment_id
		JOIN ele_round_courses roundCourse ON roundCourse.round_course_id = enrollment.round_course_id
		JOIN kku_enrollment_curricula roster
			ON roster.enrollment_curriculum_id = enrollment.enrollment_curriculum_id
			AND roster.enrollment_id = enrollment.enrollment_id AND roster.deleted_at IS NULL
		JOIN kku_enrollments student ON student.enrollment_id = enrollment.enrollment_id
			AND student.enrollment_status = 'student' AND student.deleted_at IS NULL
		WHERE roundCourse.free_elective_course_id = ?
			AND roundCourse.deleted_at IS NULL AND roster.cohort_id IS NOT NULL`, courseID, courseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	cohortIDs := make(map[uint64]struct{})
	for rows.Next() {
		var cohortID uint64
		if err := rows.Scan(&cohortID); err != nil {
			return nil, err
		}
		if cohortID > 0 {
			cohortIDs[cohortID] = struct{}{}
		}
	}
	return cohortIDs, rows.Err()
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

func (r *FreeElectiveRepository) GetStudentGroups(ctx context.Context, filters models.FreeElectiveStudentGroupFilters) ([]models.FreeElectiveStudentGroup, error) {
	query := `
		SELECT cohort.cohort_id, faculty.faculty_id, faculty.name_th, COALESCE(faculty.name_en, ''),
			major.major_id, major.name_th, COALESCE(major.name_en, ''), curriculum.curriculum_id,
			curriculum.name_th, COALESCE(curriculum.name_en, ''), cohort.entry_year_be,
			COUNT(DISTINCT student.enrollment_id), COUNT(DISTINCT selected.enrollment_id)
		FROM edu_student_cohorts cohort
		JOIN edu_curricula curriculum ON curriculum.curriculum_id = cohort.curriculum_id AND curriculum.deleted_at IS NULL
		JOIN edu_majors major ON major.major_id = curriculum.major_id AND major.deleted_at IS NULL
		JOIN org_departments department ON department.department_id = major.department_id AND department.deleted_at IS NULL
		JOIN org_faculties faculty ON faculty.faculty_id = department.faculty_id AND faculty.deleted_at IS NULL
		LEFT JOIN kku_enrollment_curricula roster
			ON roster.cohort_id = cohort.cohort_id AND roster.deleted_at IS NULL
		LEFT JOIN kku_enrollments student
			ON student.enrollment_id = roster.enrollment_id
			AND student.deleted_at IS NULL AND student.enrollment_status = 'student'
		LEFT JOIN ele_course_enrollments selected
			ON selected.enrollment_id = student.enrollment_id
			AND selected.deleted_at IS NULL AND selected.status IN ('enrolled', 'completed')
		WHERE cohort.deleted_at IS NULL AND cohort.status <> 'archived'`
	args := make([]any, 0, 4)
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
	query += `
		GROUP BY cohort.cohort_id, faculty.faculty_id, faculty.name_th, faculty.name_en,
			major.major_id, major.name_th, major.name_en, curriculum.curriculum_id, curriculum.name_th,
			curriculum.name_en, cohort.entry_year_be
		ORDER BY faculty.name_th, major.name_th, curriculum.name_th, cohort.entry_year_be DESC`

	rows, err := r.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	groups := make([]models.FreeElectiveStudentGroup, 0)
	for rows.Next() {
		var item models.FreeElectiveStudentGroup
		if err := rows.Scan(
			&item.CohortID,
			&item.FacultyID,
			&item.FacultyNameTH,
			&item.FacultyNameEN,
			&item.MajorID,
			&item.MajorNameTH,
			&item.MajorNameEN,
			&item.CurriculumID,
			&item.CurriculumNameTH,
			&item.CurriculumNameEN,
			&item.EntryYearBE,
			&item.StudentCount,
			&item.SelectedCount,
		); err != nil {
			return nil, err
		}
		groups = append(groups, item)
	}
	return groups, rows.Err()
}

func (r *FreeElectiveRepository) GetCohortStudents(ctx context.Context, cohortID uint64) ([]models.FreeElectiveStudent, error) {
	rows, err := r.DB.QueryContext(ctx, `
		SELECT student.enrollment_id, roster.enrollment_curriculum_id, COALESCE(student.faculty_id, 0), COALESCE(student.student_code, ''),
			CONCAT_WS(' ', person.first_name_th, person.last_name_th),
			CONCAT_WS(' ', person.first_name_en, person.last_name_en),
			curriculum.curriculum_id, curriculum.name_th, COALESCE(curriculum.name_en, ''), COALESCE(cohort.entry_year_be, 0)
		FROM edu_student_cohorts cohort
		JOIN kku_enrollment_curricula roster ON roster.cohort_id = cohort.cohort_id AND roster.deleted_at IS NULL
		JOIN kku_enrollments student ON student.enrollment_id = roster.enrollment_id
			AND student.deleted_at IS NULL AND student.enrollment_status = 'student'
		JOIN persons person ON person.person_id = student.person_id AND person.deleted_at IS NULL
		JOIN edu_curricula curriculum ON curriculum.curriculum_id = roster.curriculum_id AND curriculum.deleted_at IS NULL
		WHERE cohort.cohort_id = ? AND cohort.deleted_at IS NULL
		ORDER BY student.student_code`, cohortID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	students := make([]models.FreeElectiveStudent, 0)
	for rows.Next() {
		var item models.FreeElectiveStudent
		if err := rows.Scan(
			&item.EnrollmentID,
			&item.EnrollmentCurriculumID,
			&item.FacultyID,
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
		students = append(students, item)
	}
	return students, rows.Err()
}

func (r *FreeElectiveRepository) GetStudentDetail(ctx context.Context, enrollmentID uint64) (*models.FreeElectiveStudentDetail, error) {
	var student models.FreeElectiveStudent
	if err := r.DB.QueryRowContext(ctx, `
		SELECT student.enrollment_id, roster.enrollment_curriculum_id, COALESCE(student.faculty_id, 0),
			COALESCE(student.student_code, ''), CONCAT_WS(' ', person.first_name_th, person.last_name_th),
			CONCAT_WS(' ', person.first_name_en, person.last_name_en), curriculum.curriculum_id,
			curriculum.name_th, COALESCE(curriculum.name_en, ''), COALESCE(cohort.entry_year_be, 0)
		FROM kku_enrollments student
		JOIN persons person ON person.person_id = student.person_id AND person.deleted_at IS NULL
		JOIN kku_enrollment_curricula roster ON roster.enrollment_id = student.enrollment_id
			AND roster.deleted_at IS NULL
		JOIN edu_curricula curriculum ON curriculum.curriculum_id = roster.curriculum_id
			AND curriculum.deleted_at IS NULL
		LEFT JOIN edu_student_cohorts cohort ON cohort.cohort_id = roster.cohort_id
			AND cohort.deleted_at IS NULL
		WHERE student.enrollment_id = ? AND student.enrollment_status = 'student'
			AND student.deleted_at IS NULL
		ORDER BY COALESCE(roster.is_current, 0) DESC, roster.enrollment_curriculum_id DESC
		LIMIT 1`, enrollmentID).Scan(
		&student.EnrollmentID,
		&student.EnrollmentCurriculumID,
		&student.FacultyID,
		&student.StudentCode,
		&student.StudentNameTH,
		&student.StudentNameEN,
		&student.CurriculumID,
		&student.CurriculumNameTH,
		&student.CurriculumNameEN,
		&student.EntryYearBE,
	); err != nil {
		return nil, err
	}

	rows, err := r.DB.QueryContext(ctx, `
		SELECT selected.round_course_enrollment_id, selected.round_course_id,
			roundCourse.course_code, roundCourse.course_name_th,
			COALESCE(roundCourse.course_name_en, ''), round.academic_year_be,
			round.semester, '', round.status, roundCourse.grade_scheme,
			COALESCE(grade.grade, ''), COALESCE(grade.grade_source, ''),
			COALESCE(grade.is_best_grade, 0), selected.status
		FROM ele_course_enrollments selected
		JOIN ele_round_courses roundCourse
			ON roundCourse.round_course_id = selected.round_course_id
			AND roundCourse.deleted_at IS NULL
		JOIN ele_rounds round
			ON round.round_id = roundCourse.round_id
			AND round.deleted_at IS NULL
		LEFT JOIN ele_course_grades grade
			ON grade.round_course_enrollment_id = selected.round_course_enrollment_id
			AND grade.deleted_at IS NULL
		WHERE selected.enrollment_id = ? AND selected.deleted_at IS NULL
		ORDER BY round.academic_year_be, round.semester, roundCourse.course_code`, enrollmentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	studentCourses := make([]models.FreeElectiveStudentCourse, 0)
	for rows.Next() {
		var course models.FreeElectiveStudentCourse
		if err := rows.Scan(
			&course.RoundCourseEnrollmentID,
			&course.RoundCourseID,
			&course.CourseCode,
			&course.CourseNameTH,
			&course.CourseNameEN,
			&course.AcademicYearBE,
			&course.Semester,
			&course.SectionNo,
			&course.RoundStatus,
			&course.GradeScheme,
			&course.Grade,
			&course.GradeSource,
			&course.IsBestGrade,
			&course.Status,
		); err != nil {
			return nil, err
		}
		studentCourses = append(studentCourses, course)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &models.FreeElectiveStudentDetail{
		Student: student,
		Courses: studentCourses,
	}, nil
}
