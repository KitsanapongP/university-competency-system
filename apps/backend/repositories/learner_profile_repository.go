package repositories

import (
	"context"
	"database/sql"

	"github.com/spw32767/university-competency-system-backend/models"
)

type LearnerProfileRepository struct {
	DB *sql.DB
}

func NewLearnerProfileRepository(db *sql.DB) *LearnerProfileRepository {
	return &LearnerProfileRepository{DB: db}
}

func (r *LearnerProfileRepository) ResolvePersonID(ctx context.Context, userID int64) (int64, error) {
	var personID sql.NullInt64
	if err := r.DB.QueryRowContext(ctx, `
		SELECT person_id
		FROM auth_users
		WHERE user_id = ?`, userID).Scan(&personID); err != nil {
		return 0, err
	}
	if personID.Valid {
		return personID.Int64, nil
	}

	return 0, nil
}

func (r *LearnerProfileRepository) GetProfile(ctx context.Context, personID int64) (models.LearnerAcademicProfile, error) {
	var (
		profile                            models.LearnerAcademicProfile
		entryYear                          sql.NullInt64
		facultyNameTH, facultyNameEN       string
		majorNameTH, majorNameEN           string
		curriculumNameTH, curriculumNameEN string
	)

	err := r.DB.QueryRowContext(ctx, `
		SELECT
			COALESCE(enrollment.student_code, ''),
			COALESCE(NULLIF(TRIM(CONCAT_WS(' ', person.first_name_th, person.last_name_th)), ''), ''),
			COALESCE(NULLIF(TRIM(CONCAT_WS(' ', person.first_name_en, person.last_name_en)), ''), ''),
			COALESCE(enrollment.entry_year_be, 0),
			COALESCE(faculty.name_th, ''),
			COALESCE(faculty.name_en, ''),
			COALESCE(major.name_th, ''),
			COALESCE(major.name_en, ''),
			COALESCE(curriculum.name_th, ''),
			COALESCE(curriculum.name_en, '')
		FROM kku_enrollments enrollment
		JOIN persons person
			ON person.person_id = enrollment.person_id
			AND person.deleted_at IS NULL
		LEFT JOIN org_faculties faculty
			ON faculty.faculty_id = enrollment.faculty_id
			AND faculty.deleted_at IS NULL
		LEFT JOIN edu_majors major
			ON major.major_id = enrollment.major_id
			AND major.deleted_at IS NULL
		LEFT JOIN kku_enrollment_curricula enrollmentCurriculum
			ON enrollmentCurriculum.enrollment_id = enrollment.enrollment_id
			AND enrollmentCurriculum.is_current = 1
			AND enrollmentCurriculum.deleted_at IS NULL
		LEFT JOIN edu_curricula curriculum
			ON curriculum.curriculum_id = enrollmentCurriculum.curriculum_id
			AND curriculum.deleted_at IS NULL
		WHERE enrollment.person_id = ?
			AND enrollment.deleted_at IS NULL
		ORDER BY enrollment.updated_at DESC, enrollment.enrollment_id DESC
		LIMIT 1`, personID).Scan(
		&profile.StudentCode,
		&profile.NameTH,
		&profile.NameEN,
		&entryYear,
		&facultyNameTH,
		&facultyNameEN,
		&majorNameTH,
		&majorNameEN,
		&curriculumNameTH,
		&curriculumNameEN,
	)
	if err != nil {
		return models.LearnerAcademicProfile{}, err
	}

	if entryYear.Valid && entryYear.Int64 > 0 {
		profile.EntryYearBE = uint64(entryYear.Int64)
	}
	profile.FacultyNameTH = facultyNameTH
	profile.FacultyNameEN = facultyNameEN
	profile.MajorNameTH = majorNameTH
	profile.MajorNameEN = majorNameEN
	profile.CurriculumNameTH = curriculumNameTH
	profile.CurriculumNameEN = curriculumNameEN

	return profile, nil
}

func (r *LearnerProfileRepository) GetCurriculumCourseHistory(ctx context.Context, personID int64) ([]models.LearnerAcademicCourse, error) {
	rows, err := r.DB.QueryContext(ctx, `
		SELECT
			courseEnrollment.course_student_id,
			courseEnrollment.course_id,
			courseEnrollment.academic_year_be,
			courseEnrollment.semester,
			COALESCE(course.code, ''),
			COALESCE(course.name_th, ''),
			COALESCE(course.name_en, ''),
			COALESCE(course.credits, 0),
			COALESCE(course.grade_scheme, 'letter'),
			COALESCE(courseEnrollment.grade, '')
		FROM kku_enrollments enrollment
		JOIN crs_course_enrollment courseEnrollment
			ON courseEnrollment.enrollment_id = enrollment.enrollment_id
			AND courseEnrollment.deleted_at IS NULL
		JOIN crs_courses course
			ON course.course_id = courseEnrollment.course_id
			AND course.deleted_at IS NULL
		WHERE enrollment.person_id = ?
			AND enrollment.deleted_at IS NULL
		ORDER BY courseEnrollment.academic_year_be,
			courseEnrollment.semester,
			course.code,
			courseEnrollment.course_student_id`, personID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanLearnerAcademicCourses(rows, "curriculum")
}

func (r *LearnerProfileRepository) GetFreeElectiveCourseHistory(ctx context.Context, personID int64) ([]models.LearnerAcademicCourse, error) {
	rows, err := r.DB.QueryContext(ctx, `
		SELECT
			enrollment.round_course_enrollment_id,
			roundCourse.free_elective_course_id,
			round.academic_year_be,
			round.semester,
			COALESCE(roundCourse.course_code, ''),
			COALESCE(roundCourse.course_name_th, ''),
			COALESCE(roundCourse.course_name_en, ''),
			COALESCE(roundCourse.credits, 0),
			COALESCE(roundCourse.grade_scheme, 'letter'),
			COALESCE(grade.grade, '')
		FROM kku_enrollments learnerEnrollment
		JOIN ele_course_enrollments enrollment
			ON enrollment.enrollment_id = learnerEnrollment.enrollment_id
			AND enrollment.deleted_at IS NULL
		JOIN ele_round_courses roundCourse
			ON roundCourse.round_course_id = enrollment.round_course_id
			AND roundCourse.deleted_at IS NULL
		JOIN ele_rounds round
			ON round.round_id = roundCourse.round_id
			AND round.deleted_at IS NULL
		LEFT JOIN ele_course_grades grade
			ON grade.round_course_enrollment_id = enrollment.round_course_enrollment_id
			AND grade.deleted_at IS NULL
		WHERE learnerEnrollment.person_id = ?
			AND learnerEnrollment.deleted_at IS NULL
		ORDER BY round.academic_year_be,
			round.semester,
			roundCourse.course_code,
			enrollment.round_course_enrollment_id`, personID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanLearnerAcademicCourses(rows, "free_elective")
}

func scanLearnerAcademicCourses(rows *sql.Rows, source string) ([]models.LearnerAcademicCourse, error) {
	courses := make([]models.LearnerAcademicCourse, 0)
	for rows.Next() {
		var course models.LearnerAcademicCourse
		if err := rows.Scan(
			&course.RecordID,
			&course.CourseID,
			&course.AcademicYearBE,
			&course.Semester,
			&course.CourseCode,
			&course.CourseNameTH,
			&course.CourseNameEN,
			&course.Credits,
			&course.GradeScheme,
			&course.Grade,
		); err != nil {
			return nil, err
		}
		course.Source = source
		courses = append(courses, course)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return courses, nil
}
