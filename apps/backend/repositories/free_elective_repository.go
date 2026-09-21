package repositories

import (
	"context"
	"database/sql"
	"errors"
	"sort"
	"strings"

	"github.com/spw32767/university-competency-system-backend/grading"
	"github.com/spw32767/university-competency-system-backend/models"
)

type FreeElectiveRepository struct {
	DB *sql.DB
}

var (
	ErrFreeElectiveOfferingLocked      = errors.New("free-elective offering is locked")
	ErrFreeElectiveEnrollmentExists    = errors.New("learner is already enrolled in this offering")
	ErrFreeElectiveCapacityExceeded    = errors.New("offering capacity has been reached")
	ErrFreeElectiveEnrollmentInvalid   = errors.New("enrollment and curriculum selection do not match")
	ErrFreeElectiveGradeTargetNotFound = errors.New("offering enrollment was not found")
)

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
		&impact.OfferingCount,
		&impact.FinalizedOfferingCount,
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

const freeElectiveOfferingSelect = `
	SELECT offering.offering_id, offering.free_elective_course_id,
		course.code, course.name_th, COALESCE(course.name_en, ''), course.grade_scheme,
		course.faculty_id, faculty.name_th, COALESCE(faculty.name_en, ''),
		offering.academic_year_be, offering.semester, offering.section_no,
		offering.capacity, offering.status, offering.scores_recalculation_required,
		offering.finalized_at,
		COUNT(DISTINCT enrollment.offering_enrollment_id),
		COUNT(DISTINCT CASE WHEN grade.grade_record_id IS NOT NULL THEN enrollment.offering_enrollment_id END),
		COUNT(DISTINCT mapping.offering_competency_id),
		COALESCE(SUM(mapping.weight_percent), 0),
		offering.created_at, offering.updated_at
	FROM ele_free_elective_offerings offering
	JOIN ele_courses course
		ON course.free_elective_course_id = offering.free_elective_course_id
		AND course.deleted_at IS NULL
	JOIN org_faculties faculty
		ON faculty.faculty_id = course.faculty_id AND faculty.deleted_at IS NULL
	LEFT JOIN ele_offering_enrollments enrollment
		ON enrollment.offering_id = offering.offering_id AND enrollment.deleted_at IS NULL
	LEFT JOIN ele_offering_grade_records grade
		ON grade.offering_enrollment_id = enrollment.offering_enrollment_id AND grade.deleted_at IS NULL
	LEFT JOIN ele_offering_competencies mapping
		ON mapping.offering_id = offering.offering_id AND mapping.deleted_at IS NULL
	WHERE offering.deleted_at IS NULL`

func scanFreeElectiveOffering(scanner interface{ Scan(...any) error }) (*models.FreeElectiveOffering, error) {
	var offering models.FreeElectiveOffering
	var capacity sql.NullInt64
	var finalizedAt sql.NullTime
	if err := scanner.Scan(
		&offering.OfferingID,
		&offering.FreeElectiveCourseID,
		&offering.CourseCode,
		&offering.CourseNameTH,
		&offering.CourseNameEN,
		&offering.GradeScheme,
		&offering.FacultyID,
		&offering.FacultyNameTH,
		&offering.FacultyNameEN,
		&offering.AcademicYearBE,
		&offering.Semester,
		&offering.SectionNo,
		&capacity,
		&offering.Status,
		&offering.ScoresRecalculationRequired,
		&finalizedAt,
		&offering.StudentCount,
		&offering.GradedStudentCount,
		&offering.CompetencyCount,
		&offering.WeightTotal,
		&offering.CreatedAt,
		&offering.UpdatedAt,
	); err != nil {
		return nil, err
	}
	if capacity.Valid {
		value := int(capacity.Int64)
		offering.Capacity = &value
	}
	if finalizedAt.Valid {
		offering.FinalizedAt = &finalizedAt.Time
	}
	return &offering, nil
}

func freeElectiveOfferingGroupBy() string {
	return `
	GROUP BY offering.offering_id, offering.free_elective_course_id, course.code,
		course.name_th, course.name_en, course.grade_scheme, course.faculty_id, faculty.name_th,
		faculty.name_en, offering.academic_year_be,
		offering.semester, offering.section_no, offering.capacity, offering.status,
		offering.scores_recalculation_required, offering.finalized_at,
		offering.created_at, offering.updated_at`
}

func (r *FreeElectiveRepository) ListOfferings(ctx context.Context, filters models.FreeElectiveCourseFilters) ([]*models.FreeElectiveOffering, error) {
	query := freeElectiveOfferingSelect
	args := make([]any, 0, 4)
	if filters.FacultyID != nil {
		query += " AND course.faculty_id = ?"
		args = append(args, *filters.FacultyID)
	}
	if filters.YearBE != nil {
		query += " AND offering.academic_year_be = ?"
		args = append(args, *filters.YearBE)
	}
	if filters.Semester != nil {
		query += " AND offering.semester = ?"
		args = append(args, *filters.Semester)
	}
	if strings.TrimSpace(filters.Status) != "" {
		query += " AND offering.status = ?"
		args = append(args, strings.ToLower(strings.TrimSpace(filters.Status)))
	}
	query += freeElectiveOfferingGroupBy() + " ORDER BY offering.academic_year_be DESC, offering.semester DESC, course.name_th"

	rows, err := r.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	offerings := make([]*models.FreeElectiveOffering, 0)
	for rows.Next() {
		offering, err := scanFreeElectiveOffering(rows)
		if err != nil {
			return nil, err
		}
		offerings = append(offerings, offering)
	}
	return offerings, rows.Err()
}

func (r *FreeElectiveRepository) GetOffering(ctx context.Context, offeringID uint64) (*models.FreeElectiveOffering, error) {
	query := freeElectiveOfferingSelect + " AND offering.offering_id = ?" + freeElectiveOfferingGroupBy()
	return scanFreeElectiveOffering(r.DB.QueryRowContext(ctx, query, offeringID))
}

func (r *FreeElectiveRepository) CreateOffering(ctx context.Context, payload models.UpsertFreeElectiveOfferingPayload, userID uint64) (*models.FreeElectiveOffering, error) {
	result, err := r.DB.ExecContext(ctx, `
		INSERT INTO ele_free_elective_offerings
			(free_elective_course_id, academic_year_be, semester, section_no, capacity, created_by, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
		payload.FreeElectiveCourseID,
		payload.AcademicYearBE,
		payload.Semester,
		strings.TrimSpace(payload.SectionNo),
		payload.Capacity,
		userID,
	)
	if err != nil {
		return nil, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}
	return r.GetOffering(ctx, uint64(id))
}

func (r *FreeElectiveRepository) UpdateOfferingStatus(ctx context.Context, offeringID uint64, status string) error {
	result, err := r.DB.ExecContext(ctx, `
		UPDATE ele_free_elective_offerings
		SET status = ?, updated_at = NOW()
		WHERE offering_id = ? AND deleted_at IS NULL`, status, offeringID)
	if err != nil {
		return err
	}
	if affected, err := result.RowsAffected(); err != nil {
		return err
	} else if affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *FreeElectiveRepository) GetOfferingReadiness(ctx context.Context, offeringID uint64) (models.FreeElectiveReadiness, error) {
	var readiness models.FreeElectiveReadiness
	var mappingCount, studentCount, missingGradeCount, invalidGradeCount int
	err := r.DB.QueryRowContext(ctx, `
		SELECT
			(SELECT COUNT(*) FROM ele_offering_competencies mapping WHERE mapping.offering_id = offering.offering_id AND mapping.deleted_at IS NULL),
			(SELECT COUNT(*) FROM ele_offering_enrollments enrollment WHERE enrollment.offering_id = offering.offering_id AND enrollment.deleted_at IS NULL AND enrollment.status IN ('enrolled', 'completed')),
			(SELECT COUNT(*)
			 FROM ele_offering_enrollments enrollment
			 LEFT JOIN ele_offering_grade_records grade
				ON grade.offering_enrollment_id = enrollment.offering_enrollment_id AND grade.deleted_at IS NULL
			 WHERE enrollment.offering_id = offering.offering_id
				AND enrollment.deleted_at IS NULL AND enrollment.status IN ('enrolled', 'completed')
				AND grade.grade_record_id IS NULL),
			(SELECT COUNT(*)
			 FROM ele_offering_enrollments enrollment
			 JOIN ele_offering_grade_records grade
				ON grade.offering_enrollment_id = enrollment.offering_enrollment_id AND grade.deleted_at IS NULL
			 JOIN ele_courses course ON course.free_elective_course_id = offering.free_elective_course_id
			 WHERE enrollment.offering_id = offering.offering_id
				AND enrollment.deleted_at IS NULL AND enrollment.status IN ('enrolled', 'completed')
				AND NOT (
					(course.grade_scheme = 'letter' AND grade.grade IN ('A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F', 'W', 'I'))
					OR (course.grade_scheme = 'satisfactory' AND grade.grade IN ('S', 'U', 'W', 'I'))
				))
		FROM ele_free_elective_offerings offering
		WHERE offering.offering_id = ? AND offering.deleted_at IS NULL`, offeringID).Scan(
		&mappingCount,
		&studentCount,
		&missingGradeCount,
		&invalidGradeCount,
	)
	if err != nil {
		return readiness, err
	}
	readiness.CompetencyMapped = mappingCount > 0
	readiness.WeightsValid = readiness.CompetencyMapped
	readiness.StudentsAdded = studentCount > 0
	readiness.GradesComplete = studentCount > 0 && missingGradeCount == 0 && invalidGradeCount == 0
	if !readiness.CompetencyMapped {
		readiness.Codes = append(readiness.Codes, "COMPETENCY_REQUIRED")
		readiness.MessagesTH = append(readiness.MessagesTH, "กรุณาเพิ่มสมรรถนะอย่างน้อย 1 ด้าน")
		readiness.MessagesEN = append(readiness.MessagesEN, "Add at least one competency mapping")
	}
	if !readiness.StudentsAdded {
		readiness.Codes = append(readiness.Codes, "STUDENTS_REQUIRED")
		readiness.MessagesTH = append(readiness.MessagesTH, "กรุณาเพิ่มผู้เรียนในรอบนี้")
		readiness.MessagesEN = append(readiness.MessagesEN, "Add at least one learner")
	}
	if !readiness.GradesComplete {
		readiness.Codes = append(readiness.Codes, "GRADES_REQUIRED")
		readiness.MessagesTH = append(readiness.MessagesTH, "กรุณากรอกผลการเรียนให้ครบและถูกต้อง")
		readiness.MessagesEN = append(readiness.MessagesEN, "Enter a valid grade for every learner")
	}
	readiness.Ready = len(readiness.Codes) == 0
	return readiness, nil
}

func (r *FreeElectiveRepository) FinalizeOffering(ctx context.Context, offeringID, userID uint64) error {
	result, err := r.DB.ExecContext(ctx, `
		UPDATE ele_free_elective_offerings
		SET status = 'finalized', finalized_at = NOW(), finalized_by = ?,
			scores_recalculation_required = 1, updated_at = NOW()
		WHERE offering_id = ? AND status = 'active' AND deleted_at IS NULL`, userID, offeringID)
	if err != nil {
		return err
	}
	if affected, err := result.RowsAffected(); err != nil {
		return err
	} else if affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func scanFreeElectiveCompetency(scanner interface{ Scan(...any) error }) (models.FreeElectiveCompetency, error) {
	var item models.FreeElectiveCompetency
	if err := scanner.Scan(
		&item.OfferingCompetencyID,
		&item.OfferingID,
		&item.CompetencyID,
		&item.Code,
		&item.NameTH,
		&item.NameEN,
		&item.WeightPercent,
		&item.DisplayOrder,
	); err != nil {
		return item, err
	}
	return item, nil
}

func (r *FreeElectiveRepository) GetOfferingCompetencies(ctx context.Context, offeringID uint64) ([]models.FreeElectiveCompetency, error) {
	rows, err := r.DB.QueryContext(ctx, `
		SELECT mapping.offering_competency_id, mapping.offering_id, mapping.competency_id,
			competency.code, competency.name_th, COALESCE(competency.name_en, ''),
			mapping.weight_percent, mapping.display_order
		FROM ele_offering_competencies mapping
		JOIN comp_competencies competency
			ON competency.competency_id = mapping.competency_id AND competency.deleted_at IS NULL
		WHERE mapping.offering_id = ? AND mapping.deleted_at IS NULL
		ORDER BY mapping.display_order, competency.name_th, competency.code`, offeringID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]models.FreeElectiveCompetency, 0)
	for rows.Next() {
		item, err := scanFreeElectiveCompetency(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *FreeElectiveRepository) ReplaceOfferingCompetencies(ctx context.Context, offeringID uint64, inputs []models.FreeElectiveCompetencyInput) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	var status string
	if err := tx.QueryRowContext(ctx, `
		SELECT status FROM ele_free_elective_offerings
		WHERE offering_id = ? AND deleted_at IS NULL FOR UPDATE`, offeringID).Scan(&status); err != nil {
		return err
	}
	if status == "finalized" || status == "cancelled" {
		return ErrFreeElectiveOfferingLocked
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE ele_offering_competencies
		SET deleted_at = NOW(), updated_at = NOW()
		WHERE offering_id = ? AND deleted_at IS NULL`, offeringID); err != nil {
		return err
	}
	for index, input := range inputs {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO ele_offering_competencies
				(offering_id, competency_id, weight_percent, display_order, created_at, updated_at)
			VALUES (?, ?, ?, ?, NOW(), NOW())`, offeringID, input.CompetencyID, input.WeightPercent, index+1); err != nil {
			return err
		}
	}
	_, err = tx.ExecContext(ctx, `
		UPDATE ele_free_elective_offerings
		SET scores_recalculation_required = CASE WHEN status = 'finalized' THEN 1 ELSE scores_recalculation_required END,
			updated_at = NOW()
		WHERE offering_id = ? AND deleted_at IS NULL`, offeringID)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (r *FreeElectiveRepository) CopyPreviousOfferingCompetencies(ctx context.Context, offeringID uint64) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	var courseID, year, semester uint64
	var status string
	if err := tx.QueryRowContext(ctx, `
		SELECT free_elective_course_id, academic_year_be, semester, status
		FROM ele_free_elective_offerings
		WHERE offering_id = ? AND deleted_at IS NULL FOR UPDATE`, offeringID).Scan(&courseID, &year, &semester, &status); err != nil {
		return err
	}
	if status == "finalized" || status == "cancelled" {
		return ErrFreeElectiveOfferingLocked
	}
	var previousID uint64
	if err := tx.QueryRowContext(ctx, `
		SELECT offering_id
		FROM ele_free_elective_offerings
		WHERE free_elective_course_id = ? AND deleted_at IS NULL
			AND status <> 'cancelled'
			AND (academic_year_be < ? OR (academic_year_be = ? AND semester < ?))
		ORDER BY academic_year_be DESC, semester DESC, offering_id DESC
		LIMIT 1`, courseID, year, year, semester).Scan(&previousID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE ele_offering_competencies
		SET deleted_at = NOW(), updated_at = NOW()
		WHERE offering_id = ? AND deleted_at IS NULL`, offeringID); err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `
		INSERT INTO ele_offering_competencies
			(offering_id, competency_id, weight_percent, display_order, created_at, updated_at)
		SELECT ?, competency_id, weight_percent, display_order, NOW(), NOW()
		FROM ele_offering_competencies
		WHERE offering_id = ? AND deleted_at IS NULL`, offeringID, previousID)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func scanFreeElectiveEnrollment(scanner interface{ Scan(...any) error }) (models.FreeElectiveEnrollment, error) {
	var item models.FreeElectiveEnrollment
	var gradeRecordID sql.NullInt64
	var grade, source sql.NullString
	var updatedAt sql.NullTime
	if err := scanner.Scan(
		&item.OfferingEnrollmentID,
		&item.OfferingID,
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
			&course.OfferingEnrollmentID,
			&course.OfferingID,
			&course.CourseCode,
			&course.CourseNameTH,
			&course.CourseNameEN,
			&course.AcademicYearBE,
			&course.Semester,
			&course.SectionNo,
			&course.OfferingStatus,
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

func (r *FreeElectiveRepository) GetStudentAvailableOfferings(ctx context.Context, enrollmentID uint64) ([]*models.FreeElectiveOffering, error) {
	query := freeElectiveOfferingSelect + `
		AND offering.status = 'active'
		AND NOT EXISTS (
			SELECT 1
			FROM ele_offering_enrollments selected
			WHERE selected.offering_id = offering.offering_id
				AND selected.enrollment_id = ?
				AND selected.deleted_at IS NULL
		)` + freeElectiveOfferingGroupBy() + `
		ORDER BY offering.academic_year_be DESC, offering.semester DESC, course.name_th, offering.section_no`

	rows, err := r.DB.QueryContext(ctx, query, enrollmentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	offerings := make([]*models.FreeElectiveOffering, 0)
	for rows.Next() {
		offering, err := scanFreeElectiveOffering(rows)
		if err != nil {
			return nil, err
		}
		offerings = append(offerings, offering)
	}
	return offerings, rows.Err()
}

func (r *FreeElectiveRepository) GetOfferingEnrollments(ctx context.Context, offeringID uint64) ([]models.FreeElectiveEnrollment, error) {
	rows, err := r.DB.QueryContext(ctx, `
		SELECT selected.offering_enrollment_id, selected.offering_id, selected.enrollment_id,
			selected.enrollment_curriculum_id, student.student_code,
			CONCAT_WS(' ', person.first_name_th, person.last_name_th),
			CONCAT_WS(' ', person.first_name_en, person.last_name_en),
			curriculum.curriculum_id, curriculum.name_th, COALESCE(curriculum.name_en, ''),
			COALESCE(cohort.cohort_id, 0), COALESCE(cohort.entry_year_be, 0), student.enrollment_status, selected.status,
			grade.grade_record_id, grade.grade, grade.grade_source,
			COALESCE(grade.is_best_grade, 0), grade.updated_at
		FROM ele_offering_enrollments selected
		JOIN kku_enrollments student ON student.enrollment_id = selected.enrollment_id AND student.deleted_at IS NULL
		JOIN persons person ON person.person_id = student.person_id AND person.deleted_at IS NULL
		JOIN kku_enrollment_curricula roster ON roster.enrollment_curriculum_id = selected.enrollment_curriculum_id
			AND roster.enrollment_id = selected.enrollment_id AND roster.deleted_at IS NULL
		JOIN edu_curricula curriculum ON curriculum.curriculum_id = roster.curriculum_id AND curriculum.deleted_at IS NULL
		LEFT JOIN edu_student_cohorts cohort ON cohort.cohort_id = roster.cohort_id AND cohort.deleted_at IS NULL
		LEFT JOIN ele_offering_grade_records grade
			ON grade.offering_enrollment_id = selected.offering_enrollment_id AND grade.deleted_at IS NULL
		WHERE selected.offering_id = ? AND selected.deleted_at IS NULL
		ORDER BY student.student_code`, offeringID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	enrollments := make([]models.FreeElectiveEnrollment, 0)
	for rows.Next() {
		item, err := scanFreeElectiveEnrollment(rows)
		if err != nil {
			return nil, err
		}
		enrollments = append(enrollments, item)
	}
	return enrollments, rows.Err()
}

func (r *FreeElectiveRepository) AddOfferingEnrollments(ctx context.Context, offeringID, userID uint64, inputs []models.FreeElectiveEnrollmentInput) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	var status string
	var capacity sql.NullInt64
	if err := tx.QueryRowContext(ctx, `
		SELECT status, capacity FROM ele_free_elective_offerings
		WHERE offering_id = ? AND deleted_at IS NULL FOR UPDATE`, offeringID).Scan(&status, &capacity); err != nil {
		return err
	}
	if status == "finalized" || status == "cancelled" {
		return ErrFreeElectiveOfferingLocked
	}
	var currentCount int
	if err := tx.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM ele_offering_enrollments
		WHERE offering_id = ? AND deleted_at IS NULL AND status IN ('enrolled', 'completed')`, offeringID).Scan(&currentCount); err != nil {
		return err
	}
	seen := make(map[uint64]struct{}, len(inputs))
	for _, input := range inputs {
		if input.EnrollmentID == 0 || input.EnrollmentCurriculumID == 0 {
			return ErrFreeElectiveEnrollmentInvalid
		}
		if _, exists := seen[input.EnrollmentID]; exists {
			return ErrFreeElectiveEnrollmentExists
		}
		seen[input.EnrollmentID] = struct{}{}
		var enrollmentID, curriculumID uint64
		if err := tx.QueryRowContext(ctx, `
			SELECT student.enrollment_id, roster.curriculum_id
			FROM kku_enrollments student
			JOIN kku_enrollment_curricula roster
				ON roster.enrollment_curriculum_id = ? AND roster.enrollment_id = student.enrollment_id
			WHERE student.enrollment_id = ? AND student.enrollment_status = 'student'
				AND student.deleted_at IS NULL AND roster.deleted_at IS NULL`, input.EnrollmentCurriculumID, input.EnrollmentID).Scan(&enrollmentID, &curriculumID); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return ErrFreeElectiveEnrollmentInvalid
			}
			return err
		}
		var existingID uint64
		if err := tx.QueryRowContext(ctx, `
			SELECT offering_enrollment_id FROM ele_offering_enrollments
			WHERE offering_id = ? AND enrollment_id = ? AND deleted_at IS NULL
			FOR UPDATE`, offeringID, enrollmentID).Scan(&existingID); err == nil {
			return ErrFreeElectiveEnrollmentExists
		} else if !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		if capacity.Valid && int64(currentCount+1) > capacity.Int64 {
			return ErrFreeElectiveCapacityExceeded
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO ele_offering_enrollments
				(offering_id, enrollment_id, enrollment_curriculum_id, status, enrolled_at, enrolled_by, created_at, updated_at)
			VALUES (?, ?, ?, 'enrolled', NOW(), ?, NOW(), NOW())`, offeringID, enrollmentID, input.EnrollmentCurriculumID, userID); err != nil {
			return err
		}
		currentCount++
	}
	_, err = tx.ExecContext(ctx, `
		UPDATE ele_free_elective_offerings
		SET scores_recalculation_required = 1, updated_at = NOW()
		WHERE offering_id = ? AND deleted_at IS NULL`, offeringID)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (r *FreeElectiveRepository) UpdateOfferingEnrollmentStatus(ctx context.Context, offeringID, enrollmentID uint64, status string) error {
	result, err := r.DB.ExecContext(ctx, `
		UPDATE ele_offering_enrollments selected
		JOIN ele_free_elective_offerings offering ON offering.offering_id = selected.offering_id
		SET selected.status = ?, selected.updated_at = NOW(), offering.scores_recalculation_required = 1
		WHERE selected.offering_id = ? AND selected.offering_enrollment_id = ?
			AND selected.deleted_at IS NULL AND offering.deleted_at IS NULL
			AND offering.status IN ('draft', 'active')`, status, offeringID, enrollmentID)
	if err != nil {
		return err
	}
	if affected, err := result.RowsAffected(); err != nil {
		return err
	} else if affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

type FreeElectiveStudentOfferingTarget struct {
	OfferingID     uint64
	OfferingStatus string
	Status         string
	GradeScheme    string
}

func (r *FreeElectiveRepository) GetStudentOfferingTarget(ctx context.Context, enrollmentID, offeringEnrollmentID uint64) (FreeElectiveStudentOfferingTarget, error) {
	var target FreeElectiveStudentOfferingTarget
	err := r.DB.QueryRowContext(ctx, `
		SELECT selected.offering_id, offering.status, selected.status, course.grade_scheme
		FROM ele_offering_enrollments selected
		JOIN ele_free_elective_offerings offering
			ON offering.offering_id = selected.offering_id AND offering.deleted_at IS NULL
		JOIN ele_courses course
			ON course.free_elective_course_id = offering.free_elective_course_id AND course.deleted_at IS NULL
		WHERE selected.offering_enrollment_id = ? AND selected.enrollment_id = ?
			AND selected.deleted_at IS NULL`, offeringEnrollmentID, enrollmentID).Scan(
		&target.OfferingID,
		&target.OfferingStatus,
		&target.Status,
		&target.GradeScheme,
	)
	return target, err
}

func (r *FreeElectiveRepository) UpdateStudentOfferingStatus(ctx context.Context, enrollmentID, offeringEnrollmentID uint64, status string) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	var offeringStatus, currentStatus string
	if err := tx.QueryRowContext(ctx, `
		SELECT offering.status, selected.status
		FROM ele_offering_enrollments selected
		JOIN ele_free_elective_offerings offering
			ON offering.offering_id = selected.offering_id AND offering.deleted_at IS NULL
		WHERE selected.offering_enrollment_id = ? AND selected.enrollment_id = ?
			AND selected.deleted_at IS NULL FOR UPDATE`, offeringEnrollmentID, enrollmentID).Scan(&offeringStatus, &currentStatus); err != nil {
		return err
	}
	if offeringStatus == "finalized" || offeringStatus == "cancelled" || currentStatus == "completed" {
		return ErrFreeElectiveOfferingLocked
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE ele_offering_enrollments
		SET status = ?, updated_at = NOW()
		WHERE offering_enrollment_id = ? AND enrollment_id = ? AND deleted_at IS NULL`, status, offeringEnrollmentID, enrollmentID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE ele_free_elective_offerings offering
		JOIN ele_offering_enrollments selected ON selected.offering_id = offering.offering_id
		SET offering.scores_recalculation_required = 1, offering.updated_at = NOW()
		WHERE selected.offering_enrollment_id = ? AND offering.deleted_at IS NULL`, offeringEnrollmentID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE edu_student_cohorts cohort
		JOIN kku_enrollment_curricula roster ON roster.cohort_id = cohort.cohort_id
		JOIN ele_offering_enrollments selected
			ON selected.enrollment_curriculum_id = roster.enrollment_curriculum_id
			AND selected.offering_enrollment_id = ?
		SET cohort.free_elective_scores_recalculation_required = 1, cohort.updated_at = NOW()
		WHERE roster.enrollment_id = ? AND roster.deleted_at IS NULL AND cohort.deleted_at IS NULL`, offeringEnrollmentID, enrollmentID); err != nil {
		return err
	}
	return tx.Commit()
}

type FreeElectiveGradeTarget struct {
	OfferingEnrollmentID uint64
	EnrollmentID         uint64
	StudentCode          string
	HasGrade             bool
}

func (r *FreeElectiveRepository) GetOfferingGradeTargets(ctx context.Context, offeringID uint64) (map[string]FreeElectiveGradeTarget, error) {
	rows, err := r.DB.QueryContext(ctx, `
		SELECT selected.offering_enrollment_id, selected.enrollment_id, student.student_code,
			CASE WHEN grade.grade_record_id IS NULL THEN 0 ELSE 1 END
		FROM ele_offering_enrollments selected
		JOIN kku_enrollments student ON student.enrollment_id = selected.enrollment_id AND student.deleted_at IS NULL
		LEFT JOIN ele_offering_grade_records grade
			ON grade.offering_enrollment_id = selected.offering_enrollment_id AND grade.deleted_at IS NULL
		WHERE selected.offering_id = ? AND selected.deleted_at IS NULL
		ORDER BY student.student_code`, offeringID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	targets := make(map[string]FreeElectiveGradeTarget)
	for rows.Next() {
		var target FreeElectiveGradeTarget
		var hasGrade bool
		if err := rows.Scan(&target.OfferingEnrollmentID, &target.EnrollmentID, &target.StudentCode, &hasGrade); err != nil {
			return nil, err
		}
		target.HasGrade = hasGrade
		targets[strings.ToUpper(strings.TrimSpace(target.StudentCode))] = target
	}
	return targets, rows.Err()
}

func (r *FreeElectiveRepository) UpsertOfferingGrade(ctx context.Context, offeringID uint64, write models.FreeElectiveGradeWrite, userID uint64) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if err := writeOfferingGradeTx(ctx, tx, offeringID, write, userID); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *FreeElectiveRepository) ImportOfferingGrades(ctx context.Context, offeringID, userID uint64, writes []models.FreeElectiveGradeWrite) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	for _, write := range writes {
		if err := writeOfferingGradeTx(ctx, tx, offeringID, write, userID); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func writeOfferingGradeTx(ctx context.Context, tx *sql.Tx, offeringID uint64, write models.FreeElectiveGradeWrite, userID uint64) error {
	var status string
	var enrollmentID, courseID, academicYear, semester uint64
	if err := tx.QueryRowContext(ctx, `
		SELECT offering.status, selected.enrollment_id, offering.free_elective_course_id,
			offering.academic_year_be, offering.semester
		FROM ele_free_elective_offerings offering
		JOIN ele_offering_enrollments selected ON selected.offering_id = offering.offering_id
			AND selected.offering_enrollment_id = ? AND selected.deleted_at IS NULL
		WHERE offering.offering_id = ? AND offering.deleted_at IS NULL
		FOR UPDATE`, write.OfferingEnrollmentID, offeringID).Scan(&status, &enrollmentID, &courseID, &academicYear, &semester); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrFreeElectiveGradeTargetNotFound
		}
		return err
	}
	if status == "finalized" || status == "cancelled" {
		return ErrFreeElectiveOfferingLocked
	}
	var gradeRecordID uint64
	err := tx.QueryRowContext(ctx, `
		SELECT grade_record_id FROM ele_offering_grade_records
		WHERE offering_enrollment_id = ? AND deleted_at IS NULL FOR UPDATE`, write.OfferingEnrollmentID).Scan(&gradeRecordID)
	if errors.Is(err, sql.ErrNoRows) {
		result, err := tx.ExecContext(ctx, `
			INSERT INTO ele_offering_grade_records
				(offering_enrollment_id, grade, grade_source, source_reference, recorded_by, recorded_at, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, NOW(), NOW(), NOW())`, write.OfferingEnrollmentID, strings.ToUpper(strings.TrimSpace(write.Grade)), write.GradeSource, nullableFreeElectiveString(write.SourceReference), userID)
		if err != nil {
			return err
		}
		id, err := result.LastInsertId()
		if err != nil {
			return err
		}
		gradeRecordID = uint64(id)
	} else if err != nil {
		return err
	} else {
		if _, err := tx.ExecContext(ctx, `
			UPDATE ele_offering_grade_records
			SET grade = ?, grade_source = ?, source_reference = ?, recorded_by = ?, recorded_at = NOW(), updated_at = NOW()
			WHERE grade_record_id = ? AND deleted_at IS NULL`, strings.ToUpper(strings.TrimSpace(write.Grade)), write.GradeSource, nullableFreeElectiveString(write.SourceReference), userID, gradeRecordID); err != nil {
			return err
		}
	}
	if err := recomputeFreeElectiveBestGradeFlagsTx(ctx, tx, enrollmentID, courseID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE ele_free_elective_offerings
		SET scores_recalculation_required = 1, updated_at = NOW()
		WHERE offering_id = ? AND deleted_at IS NULL`, offeringID); err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `
		UPDATE edu_student_cohorts cohort
		JOIN kku_enrollment_curricula roster ON roster.enrollment_id = ? AND roster.enrollment_curriculum_id = (
			SELECT selected.enrollment_curriculum_id
			FROM ele_offering_enrollments selected
			WHERE selected.offering_enrollment_id = ?
		) AND roster.deleted_at IS NULL
		SET cohort.free_elective_scores_recalculation_required = 1, cohort.updated_at = NOW()
		WHERE cohort.cohort_id = roster.cohort_id AND cohort.deleted_at IS NULL`, enrollmentID, write.OfferingEnrollmentID)
	return err
}

type freeElectiveGradeAttempt struct {
	GradeRecordID  uint64
	Grade          string
	Scheme         string
	AcademicYearBE uint64
	Semester       uint64
	Best           grading.GradeAttempt
}

func recomputeFreeElectiveBestGradeFlagsTx(ctx context.Context, tx *sql.Tx, enrollmentID, courseID uint64) error {
	rows, err := tx.QueryContext(ctx, `
		SELECT grade.grade_record_id, grade.grade, course.grade_scheme,
			offering.academic_year_be, offering.semester
		FROM ele_offering_grade_records grade
		JOIN ele_offering_enrollments selected ON selected.offering_enrollment_id = grade.offering_enrollment_id
			AND selected.enrollment_id = ? AND selected.deleted_at IS NULL
			AND selected.status IN ('enrolled', 'completed')
		JOIN ele_free_elective_offerings offering ON offering.offering_id = selected.offering_id
			AND offering.free_elective_course_id = ? AND offering.deleted_at IS NULL
		JOIN ele_courses course ON course.free_elective_course_id = offering.free_elective_course_id
		WHERE grade.deleted_at IS NULL`, enrollmentID, courseID)
	if err != nil {
		return err
	}
	attempts := make([]freeElectiveGradeAttempt, 0)
	for rows.Next() {
		var attempt freeElectiveGradeAttempt
		if err := rows.Scan(&attempt.GradeRecordID, &attempt.Grade, &attempt.Scheme, &attempt.AcademicYearBE, &attempt.Semester); err != nil {
			rows.Close()
			return err
		}
		attempt.Best = grading.GradeAttempt{
			Evaluation:     grading.Evaluate(attempt.Scheme, attempt.Grade),
			AcademicYearBE: attempt.AcademicYearBE,
			Semester:       attempt.Semester,
		}
		attempts = append(attempts, attempt)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()
	sort.SliceStable(attempts, func(i, j int) bool {
		return grading.IsBetterAttempt(attempts[i].Best, attempts[j].Best)
	})
	if _, err := tx.ExecContext(ctx, `
		UPDATE ele_offering_grade_records grade
		JOIN ele_offering_enrollments selected ON selected.offering_enrollment_id = grade.offering_enrollment_id
		JOIN ele_free_elective_offerings offering ON offering.offering_id = selected.offering_id
		SET grade.is_best_grade = 0, grade.updated_at = NOW()
		WHERE selected.enrollment_id = ? AND offering.free_elective_course_id = ?
			AND grade.deleted_at IS NULL`, enrollmentID, courseID); err != nil {
		return err
	}
	if len(attempts) == 0 {
		return nil
	}
	_, err = tx.ExecContext(ctx, `
		UPDATE ele_offering_grade_records
		SET is_best_grade = 1, updated_at = NOW()
		WHERE grade_record_id = ? AND deleted_at IS NULL`, attempts[0].GradeRecordID)
	return err
}

type freeElectiveScoreCandidate struct {
	GradeRecordID          uint64
	OfferingID             uint64
	EnrollmentID           uint64
	EnrollmentCurriculumID uint64
	CohortID               uint64
	AcademicYearBE         uint64
	Semester               uint64
	Grade                  string
	GradeScheme            string
	Evaluation             grading.Evaluation
}

func (r *FreeElectiveRepository) FinalizeOfferingAndCalculate(ctx context.Context, offeringID, userID uint64) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	var courseID uint64
	var status string
	if err := tx.QueryRowContext(ctx, `
		SELECT free_elective_course_id, status
		FROM ele_free_elective_offerings
		WHERE offering_id = ? AND deleted_at IS NULL FOR UPDATE`, offeringID).Scan(&courseID, &status); err != nil {
		return err
	}
	if status != "active" {
		return ErrFreeElectiveOfferingLocked
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE ele_free_elective_offerings
		SET status = 'finalized', finalized_at = NOW(), finalized_by = ?,
			scores_recalculation_required = 1, updated_at = NOW()
		WHERE offering_id = ? AND deleted_at IS NULL`, userID, offeringID); err != nil {
		return err
	}
	if err := recalculateFreeElectiveCourseTx(ctx, tx, courseID, userID); err != nil {
		return err
	}
	return tx.Commit()
}

func recalculateFreeElectiveCourseTx(ctx context.Context, tx *sql.Tx, courseID, userID uint64) error {
	if _, err := tx.ExecContext(ctx, `
		UPDATE score_free_elective_competency_scores score
		JOIN ele_offering_grade_records grade ON grade.grade_record_id = score.grade_record_id
		JOIN ele_offering_enrollments selected ON selected.offering_enrollment_id = grade.offering_enrollment_id
		JOIN ele_free_elective_offerings offering ON offering.offering_id = selected.offering_id
		SET score.deleted_at = NOW(), score.updated_at = NOW()
		WHERE offering.free_elective_course_id = ? AND score.deleted_at IS NULL`, courseID); err != nil {
		return err
	}
	cohortIDs, err := getFinalizedFreeElectiveCohortIDs(ctx, tx, courseID)
	if err != nil {
		return err
	}
	candidates, err := getFinalizedFreeElectiveCandidates(ctx, tx, courseID)
	if err != nil {
		return err
	}
	bestByEnrollment := make(map[uint64]freeElectiveScoreCandidate)
	for _, candidate := range candidates {
		if !candidate.Evaluation.HasScore {
			continue
		}
		current, exists := bestByEnrollment[candidate.EnrollmentID]
		if !exists || grading.IsBetterAttempt(
			grading.GradeAttempt{Evaluation: candidate.Evaluation, AcademicYearBE: candidate.AcademicYearBE, Semester: candidate.Semester},
			grading.GradeAttempt{Evaluation: current.Evaluation, AcademicYearBE: current.AcademicYearBE, Semester: current.Semester},
		) {
			bestByEnrollment[candidate.EnrollmentID] = candidate
		}
	}
	for _, candidate := range bestByEnrollment {
		if err := insertFreeElectiveScoresTx(ctx, tx, candidate, userID); err != nil {
			return err
		}
	}
	for cohortID := range cohortIDs {
		if err := recomputeCompetencyResultsTx(ctx, tx, cohortID); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `
			UPDATE edu_student_cohorts
			SET free_elective_scores_recalculation_required = 0,
				free_elective_scores_recalculated_at = NOW(), updated_at = NOW()
			WHERE cohort_id = ? AND deleted_at IS NULL`, cohortID); err != nil {
			return err
		}
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE ele_free_elective_offerings
		SET scores_recalculation_required = 0, scores_recalculated_at = NOW(),
			scores_recalculated_by = ?, updated_at = NOW()
		WHERE free_elective_course_id = ? AND status = 'finalized' AND deleted_at IS NULL`, userID, courseID); err != nil {
		return err
	}
	return nil
}

func getFinalizedFreeElectiveCohortIDs(ctx context.Context, tx *sql.Tx, courseID uint64) (map[uint64]struct{}, error) {
	rows, err := tx.QueryContext(ctx, `
		SELECT DISTINCT roster.cohort_id
		FROM ele_offering_enrollments selected
		JOIN ele_free_elective_offerings offering ON offering.offering_id = selected.offering_id
			AND offering.status = 'finalized' AND offering.deleted_at IS NULL
		JOIN kku_enrollment_curricula roster ON roster.enrollment_curriculum_id = selected.enrollment_curriculum_id
			AND roster.enrollment_id = selected.enrollment_id AND roster.deleted_at IS NULL
		JOIN kku_enrollments student ON student.enrollment_id = selected.enrollment_id
			AND student.enrollment_status = 'student' AND student.deleted_at IS NULL
		WHERE offering.free_elective_course_id = ?
			AND selected.status IN ('enrolled', 'completed')
			AND selected.deleted_at IS NULL
			AND roster.cohort_id IS NOT NULL
		UNION
		SELECT DISTINCT roster.cohort_id
		FROM score_free_elective_competency_scores score
		JOIN ele_offering_grade_records grade ON grade.grade_record_id = score.grade_record_id
		JOIN ele_offering_enrollments selected ON selected.offering_enrollment_id = grade.offering_enrollment_id
		JOIN ele_free_elective_offerings offering ON offering.offering_id = selected.offering_id
		JOIN kku_enrollment_curricula roster ON roster.enrollment_curriculum_id = selected.enrollment_curriculum_id
			AND roster.enrollment_id = selected.enrollment_id AND roster.deleted_at IS NULL
		JOIN kku_enrollments student ON student.enrollment_id = selected.enrollment_id
			AND student.enrollment_status = 'student' AND student.deleted_at IS NULL
		WHERE offering.free_elective_course_id = ?
			AND offering.deleted_at IS NULL
			AND roster.cohort_id IS NOT NULL`, courseID, courseID)
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

func getFinalizedFreeElectiveCandidates(ctx context.Context, tx *sql.Tx, courseID uint64) ([]freeElectiveScoreCandidate, error) {
	rows, err := tx.QueryContext(ctx, `
		SELECT grade.grade_record_id, selected.offering_id, selected.enrollment_id,
			selected.enrollment_curriculum_id, COALESCE(roster.cohort_id, 0),
			offering.academic_year_be, offering.semester, grade.grade, course.grade_scheme
		FROM ele_offering_grade_records grade
		JOIN ele_offering_enrollments selected ON selected.offering_enrollment_id = grade.offering_enrollment_id
			AND selected.deleted_at IS NULL
		JOIN ele_free_elective_offerings offering ON offering.offering_id = selected.offering_id
			AND offering.status = 'finalized' AND offering.deleted_at IS NULL
		JOIN ele_courses course ON course.free_elective_course_id = offering.free_elective_course_id
		JOIN kku_enrollment_curricula roster ON roster.enrollment_curriculum_id = selected.enrollment_curriculum_id
			AND roster.enrollment_id = selected.enrollment_id AND roster.deleted_at IS NULL
		JOIN kku_enrollments student ON student.enrollment_id = selected.enrollment_id
			AND student.enrollment_status = 'student' AND student.deleted_at IS NULL
		WHERE grade.deleted_at IS NULL AND selected.status IN ('enrolled', 'completed')
			AND course.free_elective_course_id = ?`, courseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	candidates := make([]freeElectiveScoreCandidate, 0)
	for rows.Next() {
		var candidate freeElectiveScoreCandidate
		if err := rows.Scan(
			&candidate.GradeRecordID,
			&candidate.OfferingID,
			&candidate.EnrollmentID,
			&candidate.EnrollmentCurriculumID,
			&candidate.CohortID,
			&candidate.AcademicYearBE,
			&candidate.Semester,
			&candidate.Grade,
			&candidate.GradeScheme,
		); err != nil {
			return nil, err
		}
		candidate.Evaluation = grading.Evaluate(candidate.GradeScheme, candidate.Grade)
		candidates = append(candidates, candidate)
	}
	return candidates, rows.Err()
}

func insertFreeElectiveScoresTx(ctx context.Context, tx *sql.Tx, candidate freeElectiveScoreCandidate, userID uint64) error {
	mappings, err := tx.QueryContext(ctx, `
		SELECT offering_competency_id, weight_percent
		FROM ele_offering_competencies
		WHERE offering_id = ? AND deleted_at IS NULL
		ORDER BY display_order, offering_competency_id`, candidate.OfferingID)
	if err != nil {
		return err
	}
	defer mappings.Close()
	for mappings.Next() {
		var mappingID uint64
		var weight float64
		if err := mappings.Scan(&mappingID, &weight); err != nil {
			return err
		}
		weighted := candidate.Evaluation.Score * weight / 100
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO score_free_elective_competency_scores
				(grade_record_id, offering_competency_id, raw_score, weighted_score,
				 weight_snapshot, grade_snapshot, grade_scheme_snapshot, calculated_by,
				 calculated_at, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())
			ON DUPLICATE KEY UPDATE raw_score = VALUES(raw_score), weighted_score = VALUES(weighted_score),
				weight_snapshot = VALUES(weight_snapshot), grade_snapshot = VALUES(grade_snapshot),
				grade_scheme_snapshot = VALUES(grade_scheme_snapshot), calculated_by = VALUES(calculated_by),
				calculated_at = NOW(), deleted_at = NULL, updated_at = NOW()`,
			candidate.GradeRecordID, mappingID, candidate.Evaluation.Score, weighted, weight,
			strings.ToUpper(strings.TrimSpace(candidate.Grade)), candidate.GradeScheme, userID); err != nil {
			return err
		}
	}
	return mappings.Err()
}
