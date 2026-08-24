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

type CourseGradeRepository struct{ DB *sql.DB }

func NewCourseGradeRepository(db *sql.DB) *CourseGradeRepository {
	return &CourseGradeRepository{DB: db}
}

func (r *CourseGradeRepository) GetOverview(ctx context.Context, cohortID uint64, filters models.CourseGradeFilters) (*models.CourseGradeOverview, error) {
	overview := &models.CourseGradeOverview{CohortID: cohortID, Courses: make([]models.CourseGradeCourseSummary, 0), Students: make([]models.CourseGradeStudentSummary, 0)}
	if err := r.DB.QueryRowContext(ctx, `
		SELECT course_scores_recalculation_required, course_scores_recalculated_at
		FROM edu_student_cohorts WHERE cohort_id = ? AND deleted_at IS NULL`, cohortID).Scan(
		&overview.CourseScoresRecalculationRequired, &overview.CourseScoresRecalculatedAt); err != nil {
		return nil, err
	}
	courses, err := r.getCourseSummaries(ctx, cohortID, filters)
	if err != nil {
		return nil, err
	}
	students, err := r.getStudentSummaries(ctx, cohortID, filters, courses)
	if err != nil {
		return nil, err
	}
	if err := r.DB.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM kku_enrollment_curricula
		WHERE cohort_id = ? AND deleted_at IS NULL`, cohortID).Scan(&overview.TotalStudents); err != nil {
		return nil, err
	}
	overview.Courses = courses
	overview.Students = students
	overview.TotalCourses = len(courses)
	for _, course := range courses {
		overview.RecordedGrades += course.RecordedStudents
	}
	return overview, nil
}

func (r *CourseGradeRepository) GetStudentGrades(ctx context.Context, cohortID, enrollmentID uint64, filters models.CourseGradeFilters) (*models.CourseGradeStudentDetail, error) {
	gradeFilter, args := buildCourseGradeFilter(filters, "grade")
	args = append(args, cohortID, enrollmentID)
	searchWhere, searchArgs := courseGradeSearchWhereWithArgs(filters, "course")
	args = append(args, searchArgs...)
	query := `
		SELECT roster.enrollment_id, student.student_code,
			CONCAT_WS(' ', person.first_name_th, person.last_name_th),
			course.course_id, course.code, course.name_th, COALESCE(course.name_en, ''),
			CASE WHEN placement.is_required = 1 THEN 'core' ELSE 'bonus' END,
			course.credits, grade.course_student_id, grade.student_curricula_id,
			COALESCE(grade.academic_year_be, 0), COALESCE(grade.semester, 0), COALESCE(grade.grade, ''),
			COALESCE(grade.grade_source, 'manual'), grade.source_reference,
			COALESCE(grade.is_best_grade, 0), grade.updated_at,
			cohort.course_scores_recalculation_required
		FROM edu_student_cohorts cohort
		JOIN kku_enrollment_curricula roster ON roster.cohort_id = cohort.cohort_id AND roster.deleted_at IS NULL
		JOIN kku_enrollments student ON student.enrollment_id = roster.enrollment_id AND student.deleted_at IS NULL
		JOIN persons person ON person.person_id = student.person_id AND person.deleted_at IS NULL
		JOIN crs_course_categories category ON category.curriculum_id = cohort.curriculum_id AND category.deleted_at IS NULL
		JOIN crs_curriculum_courses placement ON placement.category_id = category.category_id AND placement.deleted_at IS NULL AND placement.is_active = 1
		JOIN crs_courses course ON course.course_id = placement.course_id AND course.deleted_at IS NULL AND course.is_active = 1
		LEFT JOIN crs_course_enrollment grade ON grade.student_curricula_id = roster.enrollment_curriculum_id
			AND grade.enrollment_id = roster.enrollment_id AND grade.course_id = course.course_id AND grade.deleted_at IS NULL` + gradeFilter + `
		WHERE cohort.cohort_id = ? AND roster.enrollment_id = ?` + searchWhere + `
		ORDER BY course.code, grade.academic_year_be DESC, grade.semester DESC`
	rows, err := r.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	detail := &models.CourseGradeStudentDetail{Grades: make([]models.CourseGrade, 0)}
	for rows.Next() {
		var item models.CourseGrade
		var courseStudentID, studentCurriculumID sql.NullInt64
		var grade, source, sourceReference sql.NullString
		var updatedAt sql.NullTime
		var recalc bool
		var credits int
		if err := rows.Scan(&detail.EnrollmentID, &detail.StudentCode, &detail.StudentNameTH,
			&item.CourseID, &item.CourseCode, &item.CourseNameTH, &item.CourseNameEN, &item.CourseType,
			&credits, &courseStudentID, &studentCurriculumID, &item.AcademicYearBE, &item.Semester,
			&grade, &source, &sourceReference, &item.IsBestGrade, &updatedAt, &recalc); err != nil {
			return nil, err
		}
		item.EnrollmentID = detail.EnrollmentID
		item.StudentCode = detail.StudentCode
		item.StudentNameTH = detail.StudentNameTH
		item.Credits = credits
		item.CourseStudentID = uint64OrZero(courseStudentID)
		item.EnrollmentCurriculumID = uint64OrZero(studentCurriculumID)
		item.Grade = grade.String
		item.GradeSource = source.String
		if sourceReference.Valid {
			value := sourceReference.String
			item.SourceReference = &value
		}
		if updatedAt.Valid {
			item.UpdatedAt = updatedAt.Time
		}
		detail.CourseScoresRecalculationRequired = recalc
		detail.Grades = append(detail.Grades, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(detail.Grades) == 0 {
		return nil, sql.ErrNoRows
	}
	return detail, nil
}

func (r *CourseGradeRepository) GetCourseGrades(ctx context.Context, cohortID, courseID uint64, filters models.CourseGradeFilters) (*models.CourseGradeCourseDetail, error) {
	detail := &models.CourseGradeCourseDetail{Students: make([]models.CourseGradeCourseRosterStudent, 0)}
	if err := r.DB.QueryRowContext(ctx, `
		SELECT course.course_id, course.code, course.name_th, COALESCE(course.name_en, ''),
			CASE WHEN placement.is_required = 1 THEN 'core' ELSE 'bonus' END, course.credits,
			cohort.course_scores_recalculation_required
		FROM edu_student_cohorts cohort
		JOIN crs_course_categories category ON category.curriculum_id = cohort.curriculum_id AND category.deleted_at IS NULL
		JOIN crs_curriculum_courses placement ON placement.category_id = category.category_id AND placement.deleted_at IS NULL AND placement.is_active = 1
		JOIN crs_courses course ON course.course_id = placement.course_id AND course.deleted_at IS NULL AND course.is_active = 1
		WHERE cohort.cohort_id = ? AND course.course_id = ?`, cohortID, courseID).Scan(
		&detail.Course.CourseID, &detail.Course.CourseCode, &detail.Course.CourseNameTH, &detail.Course.CourseNameEN,
		&detail.Course.CourseType, &detail.Course.Credits, &detail.CourseScoresRecalculationRequired); err != nil {
		return nil, err
	}

	rows, err := r.DB.QueryContext(ctx, `
		SELECT roster.enrollment_id, student.student_code, CONCAT_WS(' ', person.first_name_th, person.last_name_th)
		FROM kku_enrollment_curricula roster
		JOIN kku_enrollments student ON student.enrollment_id = roster.enrollment_id AND student.deleted_at IS NULL
		JOIN persons person ON person.person_id = student.person_id AND person.deleted_at IS NULL
		WHERE roster.cohort_id = ? AND roster.deleted_at IS NULL
		ORDER BY student.student_code`, cohortID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	studentIndex := make(map[uint64]int)
	for rows.Next() {
		var item models.CourseGradeCourseRosterStudent
		item.OtherGrades = make([]models.CourseGrade, 0)
		if err := rows.Scan(&item.EnrollmentID, &item.StudentCode, &item.StudentNameTH); err != nil {
			return nil, err
		}
		studentIndex[item.EnrollmentID] = len(detail.Students)
		detail.Students = append(detail.Students, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	gradeRows, err := r.DB.QueryContext(ctx, `
		SELECT grade.course_student_id, grade.enrollment_id, grade.student_curricula_id,
			grade.academic_year_be, grade.semester, COALESCE(grade.grade, ''),
			COALESCE(grade.grade_source, 'manual'), grade.source_reference,
			COALESCE(grade.is_best_grade, 0), grade.updated_at
		FROM kku_enrollment_curricula roster
		JOIN crs_course_enrollment grade ON grade.student_curricula_id = roster.enrollment_curriculum_id
			AND grade.enrollment_id = roster.enrollment_id AND grade.deleted_at IS NULL
		WHERE roster.cohort_id = ? AND roster.deleted_at IS NULL AND grade.course_id = ?
		ORDER BY grade.enrollment_id, grade.academic_year_be DESC, grade.semester DESC, grade.course_student_id DESC`, cohortID, courseID)
	if err != nil {
		return nil, err
	}
	defer gradeRows.Close()
	for gradeRows.Next() {
		var item models.CourseGrade
		var sourceReference sql.NullString
		var updatedAt sql.NullTime
		if err := gradeRows.Scan(&item.CourseStudentID, &item.EnrollmentID, &item.EnrollmentCurriculumID,
			&item.AcademicYearBE, &item.Semester, &item.Grade, &item.GradeSource, &sourceReference,
			&item.IsBestGrade, &updatedAt); err != nil {
			return nil, err
		}
		item.CourseID = detail.Course.CourseID
		item.CourseCode = detail.Course.CourseCode
		item.CourseNameTH = detail.Course.CourseNameTH
		item.CourseNameEN = detail.Course.CourseNameEN
		item.CourseType = detail.Course.CourseType
		item.Credits = detail.Course.Credits
		if sourceReference.Valid {
			value := sourceReference.String
			item.SourceReference = &value
		}
		if updatedAt.Valid {
			item.UpdatedAt = updatedAt.Time
		}
		index, found := studentIndex[item.EnrollmentID]
		if !found {
			continue
		}
		student := &detail.Students[index]
		if student.SelectedGrade == nil && courseGradeMatchesPeriod(item, filters) {
			selected := item
			student.SelectedGrade = &selected
			continue
		}
		student.OtherGrades = append(student.OtherGrades, item)
	}
	if err := gradeRows.Err(); err != nil {
		return nil, err
	}
	return detail, nil
}

func (r *CourseGradeRepository) GetExistingGrade(ctx context.Context, cohortID uint64, row models.UpsertCourseGradeRow) (*models.CourseGrade, error) {
	var item models.CourseGrade
	var sourceReference sql.NullString
	var updatedAt sql.NullTime
	err := r.DB.QueryRowContext(ctx, `
		SELECT grade.course_student_id, grade.enrollment_id, grade.student_curricula_id,
			student.student_code, CONCAT_WS(' ', person.first_name_th, person.last_name_th),
			grade.course_id, course.code, course.name_th, COALESCE(course.name_en, ''),
			grade.academic_year_be, grade.semester, COALESCE(grade.grade, ''),
			COALESCE(grade.grade_source, 'manual'), grade.source_reference,
			grade.is_best_grade, grade.updated_at
		FROM edu_student_cohorts cohort
		JOIN kku_enrollment_curricula roster ON roster.cohort_id = cohort.cohort_id AND roster.deleted_at IS NULL
		JOIN kku_enrollments student ON student.enrollment_id = roster.enrollment_id AND student.deleted_at IS NULL
		JOIN persons person ON person.person_id = student.person_id AND person.deleted_at IS NULL
		JOIN crs_course_enrollment grade ON grade.student_curricula_id = roster.enrollment_curriculum_id
			AND grade.enrollment_id = roster.enrollment_id AND grade.course_id = ?
			AND grade.academic_year_be = ? AND grade.semester = ? AND grade.deleted_at IS NULL
		JOIN crs_courses course ON course.course_id = grade.course_id AND course.deleted_at IS NULL
		WHERE cohort.cohort_id = ? AND roster.enrollment_id = ?`,
		row.CourseID, row.AcademicYearBE, row.Semester, cohortID, row.EnrollmentID).Scan(
		&item.CourseStudentID, &item.EnrollmentID, &item.EnrollmentCurriculumID, &item.StudentCode,
		&item.StudentNameTH, &item.CourseID, &item.CourseCode, &item.CourseNameTH, &item.CourseNameEN,
		&item.AcademicYearBE, &item.Semester, &item.Grade, &item.GradeSource, &sourceReference,
		&item.IsBestGrade, &updatedAt)
	if err != nil {
		return nil, err
	}
	if sourceReference.Valid {
		item.SourceReference = &sourceReference.String
	}
	if updatedAt.Valid {
		item.UpdatedAt = updatedAt.Time
	}
	return &item, nil
}

func (r *CourseGradeRepository) ResolveRow(ctx context.Context, cohortID uint64, row models.UpsertCourseGradeRow) (uint64, uint64, uint64, error) {
	var enrollmentID, enrollmentCurriculumID, courseID uint64
	studentCode := strings.TrimSpace(row.StudentCode)
	courseCode := strings.TrimSpace(row.CourseCode)
	query := `
		SELECT roster.enrollment_id, roster.enrollment_curriculum_id, course.course_id
		FROM edu_student_cohorts cohort
		JOIN kku_enrollment_curricula roster ON roster.cohort_id = cohort.cohort_id AND roster.deleted_at IS NULL
		JOIN kku_enrollments student ON student.enrollment_id = roster.enrollment_id AND student.deleted_at IS NULL
		JOIN crs_course_categories category ON category.curriculum_id = cohort.curriculum_id AND category.deleted_at IS NULL
		JOIN crs_curriculum_courses placement ON placement.category_id = category.category_id AND placement.deleted_at IS NULL AND placement.is_active = 1
		JOIN crs_courses course ON course.course_id = placement.course_id AND course.deleted_at IS NULL AND course.is_active = 1
		WHERE cohort.cohort_id = ? AND student.student_code = ?`
	args := []any{cohortID, studentCode}
	if row.EnrollmentID > 0 {
		query += " AND student.enrollment_id = ?"
		args = append(args, row.EnrollmentID)
	}
	if row.CourseID > 0 {
		query += " AND course.course_id = ?"
		args = append(args, row.CourseID)
	} else {
		query += " AND course.code = ?"
		args = append(args, courseCode)
	}
	query += " LIMIT 1"
	err := r.DB.QueryRowContext(ctx, query, args...).Scan(&enrollmentID, &enrollmentCurriculumID, &courseID)
	return enrollmentID, enrollmentCurriculumID, courseID, err
}

type resolvedCourseGrade struct {
	Row                    models.UpsertCourseGradeRow
	EnrollmentCurriculumID uint64
}

func (r *CourseGradeRepository) UpsertGrades(ctx context.Context, cohortID uint64, rows []models.UpsertCourseGradeRow, source string) (int, int, error) {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return 0, 0, err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.ExecContext(ctx, `SELECT cohort_id FROM edu_student_cohorts WHERE cohort_id = ? AND deleted_at IS NULL FOR UPDATE`, cohortID); err != nil {
		return 0, 0, err
	}
	resolved := make([]resolvedCourseGrade, 0, len(rows))
	for _, row := range rows {
		var enrollmentCurriculumID, courseID uint64
		query := `
			SELECT roster.enrollment_curriculum_id, course.course_id
			FROM edu_student_cohorts cohort
			JOIN kku_enrollment_curricula roster ON roster.cohort_id = cohort.cohort_id AND roster.deleted_at IS NULL
			JOIN kku_enrollments student ON student.enrollment_id = roster.enrollment_id AND student.deleted_at IS NULL
			JOIN crs_course_categories category ON category.curriculum_id = cohort.curriculum_id AND category.deleted_at IS NULL
			JOIN crs_curriculum_courses placement ON placement.category_id = category.category_id AND placement.deleted_at IS NULL AND placement.is_active = 1
			JOIN crs_courses course ON course.course_id = placement.course_id AND course.deleted_at IS NULL AND course.is_active = 1
			WHERE cohort.cohort_id = ? AND student.student_code = ? AND student.enrollment_id = ?`
		args := []any{cohortID, strings.TrimSpace(row.StudentCode), row.EnrollmentID}
		if row.CourseID > 0 {
			query += " AND course.course_id = ?"
			args = append(args, row.CourseID)
		} else {
			query += " AND course.code = ?"
			args = append(args, strings.TrimSpace(row.CourseCode))
		}
		if err := tx.QueryRowContext(ctx, query+" LIMIT 1", args...).Scan(&enrollmentCurriculumID, &courseID); err != nil {
			return 0, 0, err
		}
		row.CourseID = courseID
		resolved = append(resolved, resolvedCourseGrade{Row: row, EnrollmentCurriculumID: enrollmentCurriculumID})
	}
	imported, replaced := 0, 0
	for _, item := range resolved {
		var courseStudentID uint64
		if item.Row.CourseStudentID > 0 {
			existingErr := tx.QueryRowContext(ctx, `
				SELECT grade.course_student_id
				FROM crs_course_enrollment grade
				JOIN kku_enrollment_curricula roster ON roster.enrollment_curriculum_id = grade.student_curricula_id
					AND roster.enrollment_id = grade.enrollment_id AND roster.cohort_id = ? AND roster.deleted_at IS NULL
				WHERE grade.course_student_id = ? AND grade.deleted_at IS NULL FOR UPDATE`, cohortID, item.Row.CourseStudentID).Scan(&courseStudentID)
			if existingErr == nil {
				if _, err := tx.ExecContext(ctx, `
					UPDATE crs_course_enrollment
					SET course_id = ?, academic_year_be = ?, semester = ?, grade = ?, grade_source = ?, source_reference = ?, updated_at = NOW()
					WHERE course_student_id = ?`, item.Row.CourseID, item.Row.AcademicYearBE, item.Row.Semester, item.Row.Grade, source, item.Row.SourceReference, courseStudentID); err != nil {
					return 0, 0, err
				}
				replaced++
				continue
			}
			if !errors.Is(existingErr, sql.ErrNoRows) {
				return 0, 0, existingErr
			}
		}
		existingErr := tx.QueryRowContext(ctx, `
			SELECT course_student_id FROM crs_course_enrollment
			WHERE student_curricula_id = ? AND enrollment_id = ? AND course_id = ?
				AND academic_year_be = ? AND semester = ? AND deleted_at IS NULL FOR UPDATE`,
			item.EnrollmentCurriculumID, item.Row.EnrollmentID, item.Row.CourseID, item.Row.AcademicYearBE, item.Row.Semester).Scan(&courseStudentID)
		if existingErr == nil {
			if _, err := tx.ExecContext(ctx, `
				UPDATE crs_course_enrollment
				SET grade = ?, grade_source = ?, source_reference = ?, updated_at = NOW()
				WHERE course_student_id = ?`, item.Row.Grade, source, item.Row.SourceReference, courseStudentID); err != nil {
				return 0, 0, err
			}
			replaced++
			continue
		}
		if !errors.Is(existingErr, sql.ErrNoRows) {
			return 0, 0, existingErr
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO crs_course_enrollment
				(course_id, enrollment_id, student_curricula_id, academic_year_be, semester, grade, grade_source, source_reference, is_best_grade, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())`,
			item.Row.CourseID, item.Row.EnrollmentID, item.EnrollmentCurriculumID, item.Row.AcademicYearBE, item.Row.Semester,
			item.Row.Grade, source, item.Row.SourceReference); err != nil {
			return 0, 0, err
		}
		imported++
	}
	if err := r.recomputeBestGrades(ctx, tx, cohortID); err != nil {
		return 0, 0, err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE edu_student_cohorts SET course_scores_recalculation_required = 1, updated_at = NOW() WHERE cohort_id = ? AND deleted_at IS NULL`, cohortID); err != nil {
		return 0, 0, err
	}
	if err := tx.Commit(); err != nil {
		return 0, 0, err
	}
	return imported, replaced, nil
}

func (r *CourseGradeRepository) recomputeBestGrades(ctx context.Context, tx *sql.Tx, cohortID uint64) error {
	rows, err := tx.QueryContext(ctx, `
		SELECT grade.course_student_id, grade.enrollment_id, grade.course_id,
			grade.academic_year_be, grade.semester, COALESCE(grade.grade, '')
		FROM crs_course_enrollment grade
		JOIN kku_enrollment_curricula roster ON roster.enrollment_curriculum_id = grade.student_curricula_id
			AND roster.enrollment_id = grade.enrollment_id AND roster.cohort_id = ? AND roster.deleted_at IS NULL
		WHERE grade.deleted_at IS NULL`, cohortID)
	if err != nil {
		return err
	}
	defer rows.Close()
	type bestRow struct {
		id, year, semester uint64
		score              float64
	}
	best := make(map[string]bestRow)
	for rows.Next() {
		var id, enrollmentID, courseID, year, semester uint64
		var value string
		if err := rows.Scan(&id, &enrollmentID, &courseID, &year, &semester, &value); err != nil {
			return err
		}
		score, ok := grading.Score(value)
		if !ok {
			continue
		}
		key := fmt.Sprintf("%d:%d", enrollmentID, courseID)
		current, exists := best[key]
		if !exists || score > current.score || (score == current.score && (year > current.year || (year == current.year && semester > current.semester))) {
			best[key] = bestRow{id: id, year: year, semester: semester, score: score}
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE crs_course_enrollment grade
		JOIN kku_enrollment_curricula roster ON roster.enrollment_curriculum_id = grade.student_curricula_id
			AND roster.enrollment_id = grade.enrollment_id AND roster.cohort_id = ? AND roster.deleted_at IS NULL
		SET grade.is_best_grade = 0
		WHERE grade.deleted_at IS NULL`, cohortID); err != nil {
		return err
	}
	for _, item := range best {
		if _, err := tx.ExecContext(ctx, `UPDATE crs_course_enrollment SET is_best_grade = 1, updated_at = NOW() WHERE course_student_id = ?`, item.id); err != nil {
			return err
		}
	}
	return nil
}

func (r *CourseGradeRepository) getCourseSummaries(ctx context.Context, cohortID uint64, filters models.CourseGradeFilters) ([]models.CourseGradeCourseSummary, error) {
	gradeFilter, args := buildCourseGradeFilter(filters, "grade")
	args = append(args, cohortID)
	searchWhere, searchArgs := courseGradeSearchWhereWithArgs(filters, "course")
	args = append(args, searchArgs...)
	totalStudents := "COUNT(DISTINCT grade.enrollment_id)"
	missingWhere := ""
	having := "HAVING COUNT(DISTINCT grade.course_student_id) > 0"
	if filters.Status == "missing" {
		totalStudents = "COUNT(DISTINCT roster.enrollment_id)"
		missingWhere = ` AND NOT EXISTS (
			SELECT 1
			FROM crs_course_enrollment any_grade
			JOIN kku_enrollment_curricula any_roster ON any_roster.enrollment_curriculum_id = any_grade.student_curricula_id
				AND any_roster.enrollment_id = any_grade.enrollment_id
				AND any_roster.cohort_id = cohort.cohort_id
				AND any_roster.deleted_at IS NULL
			WHERE any_grade.course_id = course.course_id AND any_grade.deleted_at IS NULL
		)`
		having = ""
	}
	query := `
		SELECT course.course_id, course.code, course.name_th, COALESCE(course.name_en, ''),
			CASE WHEN placement.is_required = 1 THEN 'core' ELSE 'bonus' END, course.credits,
			` + totalStudents + `,
			COUNT(DISTINCT CASE WHEN grade.course_student_id IS NOT NULL THEN roster.enrollment_id END)
		FROM edu_student_cohorts cohort
		JOIN crs_course_categories category ON category.curriculum_id = cohort.curriculum_id AND category.deleted_at IS NULL
		JOIN crs_curriculum_courses placement ON placement.category_id = category.category_id AND placement.deleted_at IS NULL AND placement.is_active = 1
		JOIN crs_courses course ON course.course_id = placement.course_id AND course.deleted_at IS NULL AND course.is_active = 1
		LEFT JOIN kku_enrollment_curricula roster ON roster.cohort_id = cohort.cohort_id AND roster.deleted_at IS NULL
		LEFT JOIN crs_course_enrollment grade ON grade.student_curricula_id = roster.enrollment_curriculum_id
			AND grade.enrollment_id = roster.enrollment_id AND grade.course_id = course.course_id AND grade.deleted_at IS NULL` + gradeFilter + `
		WHERE cohort.cohort_id = ?` + searchWhere + missingWhere + `
		GROUP BY course.course_id, course.code, course.name_th, course.name_en, placement.is_required, course.credits
		` + having + `
		ORDER BY course.code`
	rows, err := r.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]models.CourseGradeCourseSummary, 0)
	for rows.Next() {
		var item models.CourseGradeCourseSummary
		if err := rows.Scan(&item.CourseID, &item.CourseCode, &item.CourseNameTH, &item.CourseNameEN, &item.CourseType, &item.Credits, &item.TotalStudents, &item.RecordedStudents); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *CourseGradeRepository) getStudentSummaries(ctx context.Context, cohortID uint64, filters models.CourseGradeFilters, courses []models.CourseGradeCourseSummary) ([]models.CourseGradeStudentSummary, error) {
	items := make([]models.CourseGradeStudentSummary, 0)
	if len(courses) == 0 {
		rows, err := r.DB.QueryContext(ctx, `
			SELECT roster.enrollment_id, student.student_code, CONCAT_WS(' ', person.first_name_th, person.last_name_th), 0, 0
			FROM kku_enrollment_curricula roster
			JOIN kku_enrollments student ON student.enrollment_id = roster.enrollment_id AND student.deleted_at IS NULL
			JOIN persons person ON person.person_id = student.person_id AND person.deleted_at IS NULL
			WHERE roster.cohort_id = ? AND roster.deleted_at IS NULL
			ORDER BY student.student_code`, cohortID)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		for rows.Next() {
			var item models.CourseGradeStudentSummary
			if err := rows.Scan(&item.EnrollmentID, &item.StudentCode, &item.StudentNameTH, &item.TotalCourses, &item.RecordedCourses); err != nil {
				return nil, err
			}
			items = append(items, item)
		}
		return items, rows.Err()
	}

	placeholders := make([]string, 0, len(courses))
	args := []any{len(courses)}
	for _, course := range courses {
		placeholders = append(placeholders, "?")
		args = append(args, course.CourseID)
	}
	gradeFilter, gradeArgs := buildCourseGradeFilter(filters, "grade")
	args = append(args, gradeArgs...)
	args = append(args, cohortID)
	query := `
		SELECT roster.enrollment_id, student.student_code, CONCAT_WS(' ', person.first_name_th, person.last_name_th),
			?, COUNT(DISTINCT grade.course_id)
		FROM kku_enrollment_curricula roster
		JOIN kku_enrollments student ON student.enrollment_id = roster.enrollment_id AND student.deleted_at IS NULL
		JOIN persons person ON person.person_id = student.person_id AND person.deleted_at IS NULL
		LEFT JOIN crs_course_enrollment grade ON grade.student_curricula_id = roster.enrollment_curriculum_id
			AND grade.enrollment_id = roster.enrollment_id AND grade.course_id IN (` + strings.Join(placeholders, ",") + `)
			AND grade.deleted_at IS NULL` + gradeFilter + `
		WHERE roster.cohort_id = ? AND roster.deleted_at IS NULL
		GROUP BY roster.enrollment_id, student.student_code, person.first_name_th, person.last_name_th
		ORDER BY student.student_code`
	rows, err := r.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var item models.CourseGradeStudentSummary
		if err := rows.Scan(&item.EnrollmentID, &item.StudentCode, &item.StudentNameTH, &item.TotalCourses, &item.RecordedCourses); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func buildCourseGradeFilter(filters models.CourseGradeFilters, alias string) (string, []any) {
	conditions := make([]string, 0)
	args := make([]any, 0)
	if filters.AcademicYearBE != nil {
		conditions = append(conditions, alias+".academic_year_be = ?")
		args = append(args, *filters.AcademicYearBE)
	}
	if filters.Semester != nil {
		conditions = append(conditions, alias+".semester = ?")
		args = append(args, *filters.Semester)
	}
	if len(conditions) == 0 {
		return "", args
	}
	return " AND " + strings.Join(conditions, " AND "), args
}

func courseGradeMatchesPeriod(grade models.CourseGrade, filters models.CourseGradeFilters) bool {
	if filters.AcademicYearBE != nil && grade.AcademicYearBE != *filters.AcademicYearBE {
		return false
	}
	if filters.Semester != nil && grade.Semester != *filters.Semester {
		return false
	}
	return true
}

func courseGradeSearchWhereWithArgs(filters models.CourseGradeFilters, alias string) (string, []any) {
	conditions := make([]string, 0)
	args := make([]any, 0)
	if filters.Search != "" {
		search := "%" + filters.Search + "%"
		conditions = append(conditions, "("+alias+".code LIKE ? OR "+alias+".name_th LIKE ? OR COALESCE("+alias+".name_en, '') LIKE ?)")
		args = append(args, search, search, search)
	}
	if filters.CourseID != nil {
		conditions = append(conditions, alias+".course_id = ?")
		args = append(args, *filters.CourseID)
	}
	if len(conditions) == 0 {
		return "", args
	}
	return " AND " + strings.Join(conditions, " AND "), args
}

func courseGradeResultWhere(filters models.CourseGradeFilters) string {
	switch filters.Status {
	case "recorded":
		return " AND grade.course_student_id IS NOT NULL"
	case "missing":
		return " AND grade.course_student_id IS NULL"
	}
	return ""
}

func uint64OrZero(value sql.NullInt64) uint64 {
	if !value.Valid || value.Int64 < 0 {
		return 0
	}
	return uint64(value.Int64)
}
