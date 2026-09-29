package repositories

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/go-sql-driver/mysql"
	"github.com/spw32767/university-competency-system-backend/models"
)

var (
	ErrFreeElectiveRoundLocked                     = errors.New("free-elective round is locked")
	ErrFreeElectiveRoundCourseUsed                 = errors.New("free-elective round course has enrollments")
	ErrFreeElectiveRoundNotFound                   = errors.New("free-elective round not found")
	ErrFreeElectiveRoundCourseExists               = errors.New("free-elective course is already in this round")
	ErrFreeElectiveRoundFacultyChangeRequiresEmpty = errors.New("faculty can change only on an empty draft round")
	ErrFreeElectiveRoundPeriodExists               = errors.New("free-elective round already exists for this period")
)

func scanFreeElectiveRound(scanner interface{ Scan(...any) error }) (models.FreeElectiveRound, error) {
	var item models.FreeElectiveRound
	var finalizedAt sql.NullTime
	if err := scanner.Scan(
		&item.RoundID,
		&item.FacultyID,
		&item.FacultyNameTH,
		&item.FacultyNameEN,
		&item.AcademicYearBE,
		&item.Semester,
		&item.Status,
		&item.ScoresRecalculationRequired,
		&finalizedAt,
		&item.CourseCount,
		&item.LearnerCount,
		&item.GradeCount,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		return item, err
	}
	if finalizedAt.Valid {
		item.FinalizedAt = &finalizedAt.Time
	}
	return item, nil
}

const freeElectiveRoundSelect = `
	SELECT round.round_id, round.faculty_id,
		faculty.name_th, COALESCE(faculty.name_en, ''),
		round.academic_year_be, round.semester, round.status,
		round.scores_recalculation_required, round.finalized_at,
		COUNT(DISTINCT roundCourse.round_course_id),
		COUNT(DISTINCT CASE WHEN enrollment.status IN ('enrolled', 'completed') THEN enrollment.enrollment_id END),
		COUNT(DISTINCT grade.grade_record_id),
		round.created_at, round.updated_at
	FROM ele_rounds round
	JOIN org_faculties faculty
		ON faculty.faculty_id = round.faculty_id AND faculty.deleted_at IS NULL
	LEFT JOIN ele_round_courses roundCourse
		ON roundCourse.round_id = round.round_id AND roundCourse.deleted_at IS NULL
	LEFT JOIN ele_course_enrollments enrollment
		ON enrollment.round_course_id = roundCourse.round_course_id
		AND enrollment.deleted_at IS NULL
	LEFT JOIN ele_course_grades grade
		ON grade.round_course_enrollment_id = enrollment.round_course_enrollment_id
		AND grade.deleted_at IS NULL
	WHERE round.deleted_at IS NULL`

func freeElectiveRoundGroupBy() string {
	return `
	GROUP BY round.round_id, round.faculty_id, faculty.name_th, faculty.name_en,
		round.academic_year_be, round.semester, round.status,
		round.scores_recalculation_required, round.finalized_at,
		round.created_at, round.updated_at`
}

func (r *FreeElectiveRepository) ListRounds(ctx context.Context, filters models.FreeElectiveRoundFilters) ([]models.FreeElectiveRound, error) {
	query := freeElectiveRoundSelect
	args := make([]any, 0, 4)
	if filters.FacultyID != nil {
		query += " AND round.faculty_id = ?"
		args = append(args, *filters.FacultyID)
	}
	if filters.AcademicYearBE != nil {
		query += " AND round.academic_year_be = ?"
		args = append(args, *filters.AcademicYearBE)
	}
	if filters.Semester != nil {
		query += " AND round.semester = ?"
		args = append(args, *filters.Semester)
	}
	if strings.TrimSpace(filters.Status) != "" {
		query += " AND round.status = ?"
		args = append(args, strings.ToLower(strings.TrimSpace(filters.Status)))
	}
	query += freeElectiveRoundGroupBy()
	query += " ORDER BY round.academic_year_be DESC, round.semester DESC, faculty.name_th, round.round_id DESC"

	rows, err := r.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.FreeElectiveRound, 0)
	for rows.Next() {
		item, err := scanFreeElectiveRound(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *FreeElectiveRepository) GetRound(ctx context.Context, roundID uint64) (models.FreeElectiveRound, error) {
	query := freeElectiveRoundSelect + " AND round.round_id = ?" + freeElectiveRoundGroupBy()
	return scanFreeElectiveRound(r.DB.QueryRowContext(ctx, query, roundID))
}

func (r *FreeElectiveRepository) RoundExists(ctx context.Context, facultyID, academicYearBE, semester uint64) (bool, error) {
	var exists bool
	err := r.DB.QueryRowContext(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM ele_rounds
			WHERE faculty_id = ? AND academic_year_be = ? AND semester = ?
				AND deleted_at IS NULL
		)`, facultyID, academicYearBE, semester).Scan(&exists)
	return exists, err
}

func scanFreeElectiveRoundCourse(scanner interface{ Scan(...any) error }) (models.FreeElectiveRoundCourse, error) {
	var item models.FreeElectiveRoundCourse
	if err := scanner.Scan(
		&item.RoundCourseID,
		&item.RoundID,
		&item.FreeElectiveCourseID,
		&item.CourseCode,
		&item.CourseNameTH,
		&item.CourseNameEN,
		&item.Description,
		&item.Credits,
		&item.GradeScheme,
		&item.DisplayOrder,
		&item.StudentCount,
		&item.GradedStudentCount,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		return item, err
	}
	return item, nil
}

func (r *FreeElectiveRepository) GetRoundCourses(ctx context.Context, roundID uint64) ([]models.FreeElectiveRoundCourse, error) {
	rows, err := r.DB.QueryContext(ctx, `
		SELECT roundCourse.round_course_id, roundCourse.round_id,
			roundCourse.free_elective_course_id, roundCourse.course_code,
			roundCourse.course_name_th, COALESCE(roundCourse.course_name_en, ''),
			COALESCE(roundCourse.description, ''), roundCourse.credits,
			roundCourse.grade_scheme, roundCourse.display_order,
			COUNT(DISTINCT CASE WHEN enrollment.status IN ('enrolled', 'completed') THEN enrollment.enrollment_id END),
			COUNT(DISTINCT grade.grade_record_id),
			roundCourse.created_at, roundCourse.updated_at
		FROM ele_round_courses roundCourse
		LEFT JOIN ele_course_enrollments enrollment
			ON enrollment.round_course_id = roundCourse.round_course_id
			AND enrollment.deleted_at IS NULL
		LEFT JOIN ele_course_grades grade
			ON grade.round_course_enrollment_id = enrollment.round_course_enrollment_id
			AND grade.deleted_at IS NULL
		WHERE roundCourse.round_id = ? AND roundCourse.deleted_at IS NULL
		GROUP BY roundCourse.round_course_id, roundCourse.round_id,
			roundCourse.free_elective_course_id, roundCourse.course_code,
			roundCourse.course_name_th, roundCourse.course_name_en,
			roundCourse.description, roundCourse.credits, roundCourse.grade_scheme,
			roundCourse.display_order, roundCourse.created_at, roundCourse.updated_at
		ORDER BY roundCourse.display_order, roundCourse.course_name_th, roundCourse.course_code`, roundID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.FreeElectiveRoundCourse, 0)
	for rows.Next() {
		item, err := scanFreeElectiveRoundCourse(rows)
		if err != nil {
			return nil, err
		}
		item.Competencies, err = r.GetRoundCourseCompetencies(ctx, item.RoundCourseID)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *FreeElectiveRepository) GetRoundDetail(ctx context.Context, roundID uint64) (*models.FreeElectiveRoundDetail, error) {
	round, err := r.GetRound(ctx, roundID)
	if err != nil {
		return nil, err
	}
	courses, err := r.GetRoundCourses(ctx, roundID)
	if err != nil {
		return nil, err
	}
	return &models.FreeElectiveRoundDetail{Round: round, Courses: courses}, nil
}

func (r *FreeElectiveRepository) GetRoundCourseCompetencies(ctx context.Context, roundCourseID uint64) ([]models.FreeElectiveRoundCourseCompetency, error) {
	rows, err := r.DB.QueryContext(ctx, `
		SELECT mapping.round_course_competency_id, mapping.round_course_id,
			mapping.competency_id, competency.code, competency.name_th,
			COALESCE(competency.name_en, ''), mapping.weight_percent,
			mapping.display_order
		FROM ele_round_course_competencies mapping
		JOIN comp_competencies competency
			ON competency.competency_id = mapping.competency_id
			AND competency.deleted_at IS NULL
		WHERE mapping.round_course_id = ? AND mapping.deleted_at IS NULL
		ORDER BY mapping.display_order, competency.name_th, competency.code`, roundCourseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.FreeElectiveRoundCourseCompetency, 0)
	for rows.Next() {
		var item models.FreeElectiveRoundCourseCompetency
		if err := rows.Scan(
			&item.RoundCourseCompetencyID,
			&item.RoundCourseID,
			&item.CompetencyID,
			&item.Code,
			&item.NameTH,
			&item.NameEN,
			&item.WeightPercent,
			&item.DisplayOrder,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

type freeElectiveRoundMasterCourse struct {
	ID          uint64
	Code        string
	NameTH      string
	NameEN      sql.NullString
	Description sql.NullString
	Credits     int
	GradeScheme string
	FacultyID   uint64
	IsActive    bool
}

func freeElectiveRoundNullableString(value string) *string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	copy := value
	return &copy
}

func freeElectiveRoundSnapshotString(value string) *string {
	copy := value
	return &copy
}

func getFreeElectiveRoundMasterCourse(ctx context.Context, tx *sql.Tx, courseID uint64) (freeElectiveRoundMasterCourse, error) {
	var course freeElectiveRoundMasterCourse
	err := tx.QueryRowContext(ctx, `
		SELECT free_elective_course_id, faculty_id, code, name_th,
			name_en, description, credits, grade_scheme, is_active
		FROM ele_courses
		WHERE free_elective_course_id = ? AND deleted_at IS NULL`, courseID).Scan(
		&course.ID,
		&course.FacultyID,
		&course.Code,
		&course.NameTH,
		&course.NameEN,
		&course.Description,
		&course.Credits,
		&course.GradeScheme,
		&course.IsActive,
	)
	return course, err
}

func getFreeElectiveRoundMasterCourseByCode(ctx context.Context, tx *sql.Tx, facultyID uint64, code string) (freeElectiveRoundMasterCourse, error) {
	var course freeElectiveRoundMasterCourse
	err := tx.QueryRowContext(ctx, `
		SELECT free_elective_course_id, faculty_id, code, name_th,
			name_en, description, credits, grade_scheme, is_active
		FROM ele_courses
		WHERE faculty_id = ? AND code = ? AND deleted_at IS NULL`,
		facultyID,
		strings.TrimSpace(code),
	).Scan(
		&course.ID,
		&course.FacultyID,
		&course.Code,
		&course.NameTH,
		&course.NameEN,
		&course.Description,
		&course.Credits,
		&course.GradeScheme,
		&course.IsActive,
	)
	return course, err
}

func createFreeElectiveRoundMasterCourse(ctx context.Context, tx *sql.Tx, facultyID, userID uint64, input models.FreeElectiveRoundCourseInput) (freeElectiveRoundMasterCourse, error) {
	result, err := tx.ExecContext(ctx, `
		INSERT INTO ele_courses
			(faculty_id, code, name_th, name_en, description, credits, grade_scheme,
			 is_active, created_by, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, NOW(), NOW())`,
		facultyID,
		strings.TrimSpace(input.CourseCode),
		strings.TrimSpace(input.CourseNameTH),
		input.CourseNameEN,
		input.Description,
		input.Credits,
		strings.ToLower(strings.TrimSpace(input.GradeScheme)),
		userID,
	)
	if err != nil {
		return freeElectiveRoundMasterCourse{}, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return freeElectiveRoundMasterCourse{}, err
	}
	return getFreeElectiveRoundMasterCourse(ctx, tx, uint64(id))
}

func insertFreeElectiveRoundCourse(ctx context.Context, tx *sql.Tx, roundID, facultyID, userID uint64, order int, input models.FreeElectiveRoundCourseInput) (uint64, error) {
	var (
		master freeElectiveRoundMasterCourse
		err    error
	)
	if input.FreeElectiveCourseID > 0 {
		master, err = getFreeElectiveRoundMasterCourse(ctx, tx, input.FreeElectiveCourseID)
	} else {
		master, err = getFreeElectiveRoundMasterCourseByCode(ctx, tx, facultyID, input.CourseCode)
		if errors.Is(err, sql.ErrNoRows) {
			master, err = createFreeElectiveRoundMasterCourse(ctx, tx, facultyID, userID, input)
		}
	}
	if err != nil {
		return 0, err
	}
	if !master.IsActive {
		return 0, errors.New("free-elective course is inactive")
	}
	courseCode := input.CourseCode
	if strings.TrimSpace(courseCode) == "" {
		courseCode = master.Code
	}
	courseNameTH := input.CourseNameTH
	if strings.TrimSpace(courseNameTH) == "" {
		courseNameTH = master.NameTH
	}
	courseNameEN := input.CourseNameEN
	if courseNameEN == nil {
		if master.NameEN.Valid {
			courseNameEN = freeElectiveRoundNullableString(master.NameEN.String)
		}
	}
	description := input.Description
	if description == nil && master.Description.Valid {
		description = freeElectiveRoundNullableString(master.Description.String)
	}
	credits := input.Credits
	if credits == 0 {
		credits = master.Credits
	}
	gradeScheme := input.GradeScheme
	if strings.TrimSpace(gradeScheme) == "" {
		gradeScheme = master.GradeScheme
	}
	result, err := tx.ExecContext(ctx, `
		INSERT INTO ele_round_courses
			(round_id, free_elective_course_id, course_code, course_name_th,
			 course_name_en, description, credits, grade_scheme, display_order,
			 created_by, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
		roundID,
		master.ID,
		courseCode,
		courseNameTH,
		courseNameEN,
		description,
		credits,
		gradeScheme,
		order,
		userID,
	)
	if err != nil {
		return 0, err
	}
	id, err := result.LastInsertId()
	return uint64(id), err
}

func insertFreeElectiveRoundCourseCompetencies(ctx context.Context, tx *sql.Tx, roundCourseID uint64, competencies []models.FreeElectiveRoundCompetencyInput) error {
	for order, competency := range competencies {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO ele_round_course_competencies
				(round_course_id, competency_id, weight_percent, display_order, created_at, updated_at)
			VALUES (?, ?, ?, ?, NOW(), NOW())`,
			roundCourseID,
			competency.CompetencyID,
			competency.WeightPercent,
			order+1,
		); err != nil {
			return err
		}
	}
	return nil
}

func (r *FreeElectiveRepository) CreateRound(ctx context.Context, payload models.CreateFreeElectiveRoundPayload, userID uint64) (*models.FreeElectiveRoundDetail, error) {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()

	result, err := tx.ExecContext(ctx, `
		INSERT INTO ele_rounds
			(faculty_id, academic_year_be, semester, status, created_by, created_at, updated_at)
		VALUES (?, ?, ?, 'draft', ?, NOW(), NOW())`,
		payload.FacultyID,
		payload.AcademicYearBE,
		payload.Semester,
		userID,
	)
	if err != nil {
		return nil, err
	}
	roundID, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}
	for order, input := range payload.Courses {
		roundCourseID, err := insertFreeElectiveRoundCourse(ctx, tx, uint64(roundID), payload.FacultyID, userID, order+1, input)
		if err != nil {
			return nil, err
		}
		if err := insertFreeElectiveRoundCourseCompetencies(ctx, tx, roundCourseID, input.Competencies); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return r.GetRoundDetail(ctx, uint64(roundID))
}

func (r *FreeElectiveRepository) DuplicateRound(ctx context.Context, sourceRoundID uint64, payload models.DuplicateFreeElectiveRoundPayload, userID uint64) (*models.FreeElectiveRoundDetail, error) {
	source, err := r.GetRoundDetail(ctx, sourceRoundID)
	if err != nil {
		return nil, err
	}
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()

	result, err := tx.ExecContext(ctx, `
		INSERT INTO ele_rounds
			(faculty_id, academic_year_be, semester, status, created_by, created_at, updated_at)
		VALUES (?, ?, ?, 'draft', ?, NOW(), NOW())`,
		source.Round.FacultyID,
		payload.AcademicYearBE,
		payload.Semester,
		userID,
	)
	if err != nil {
		return nil, err
	}
	roundID, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}
	for order, course := range source.Courses {
		input := models.FreeElectiveRoundCourseInput{
			FreeElectiveCourseID: course.FreeElectiveCourseID,
			CourseCode:           course.CourseCode,
			CourseNameTH:         course.CourseNameTH,
			CourseNameEN:         freeElectiveRoundSnapshotString(course.CourseNameEN),
			Description:          freeElectiveRoundSnapshotString(course.Description),
			Credits:              course.Credits,
			GradeScheme:          course.GradeScheme,
			Competencies:         make([]models.FreeElectiveRoundCompetencyInput, 0, len(course.Competencies)),
		}
		for _, competency := range course.Competencies {
			input.Competencies = append(input.Competencies, models.FreeElectiveRoundCompetencyInput{
				CompetencyID:  competency.CompetencyID,
				WeightPercent: competency.WeightPercent,
			})
		}
		roundCourseID, err := insertFreeElectiveRoundCourse(ctx, tx, uint64(roundID), source.Round.FacultyID, userID, order+1, input)
		if err != nil {
			return nil, err
		}
		if err := insertFreeElectiveRoundCourseCompetencies(ctx, tx, roundCourseID, input.Competencies); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return r.GetRoundDetail(ctx, uint64(roundID))
}

func (r *FreeElectiveRepository) UpdateRoundStatus(ctx context.Context, roundID uint64, status string, userID uint64) error {
	result, err := r.DB.ExecContext(ctx, `
		UPDATE ele_rounds
		SET status = ?,
			finalized_at = CASE WHEN ? = 'finalized' THEN NOW() ELSE finalized_at END,
			finalized_by = CASE WHEN ? = 'finalized' THEN ? ELSE finalized_by END,
			updated_at = NOW()
		WHERE round_id = ? AND deleted_at IS NULL`, status, status, status, userID, roundID)
	if err != nil {
		return err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return ErrFreeElectiveRoundNotFound
	}
	return nil
}

func (r *FreeElectiveRepository) UpdateRoundMetadata(ctx context.Context, roundID uint64, payload models.UpdateFreeElectiveRoundPayload, userID uint64) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	var status string
	var currentFacultyID, currentYear, currentSemester uint64
	var courseCount, learnerCount, gradeCount int
	err = tx.QueryRowContext(ctx, `
		SELECT round.status, round.faculty_id, round.academic_year_be, round.semester,
			(SELECT COUNT(*) FROM ele_round_courses course
				WHERE course.round_id = round.round_id AND course.deleted_at IS NULL),
			(SELECT COUNT(*) FROM ele_course_enrollments enrollment
				JOIN ele_round_courses course ON course.round_course_id = enrollment.round_course_id
				WHERE course.round_id = round.round_id AND course.deleted_at IS NULL
					AND enrollment.deleted_at IS NULL),
			(SELECT COUNT(*) FROM ele_course_grades grade
				JOIN ele_course_enrollments enrollment
					ON enrollment.round_course_enrollment_id = grade.round_course_enrollment_id
				JOIN ele_round_courses course ON course.round_course_id = enrollment.round_course_id
				WHERE course.round_id = round.round_id AND course.deleted_at IS NULL
					AND enrollment.deleted_at IS NULL AND grade.deleted_at IS NULL)
		FROM ele_rounds round
		WHERE round.round_id = ? AND round.deleted_at IS NULL
		FOR UPDATE`, roundID).Scan(
		&status,
		&currentFacultyID,
		&currentYear,
		&currentSemester,
		&courseCount,
		&learnerCount,
		&gradeCount,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrFreeElectiveRoundNotFound
	}
	if err != nil {
		return err
	}
	if err := ensureFreeElectiveRoundEditable(status); err != nil {
		return err
	}
	if status != "draft" && status != "active" {
		return ErrFreeElectiveRoundLocked
	}

	facultyChanged := currentFacultyID != payload.FacultyID
	periodChanged := currentYear != payload.AcademicYearBE || currentSemester != payload.Semester
	if facultyChanged && (status != "draft" || courseCount > 0 || learnerCount > 0 || gradeCount > 0) {
		return ErrFreeElectiveRoundFacultyChangeRequiresEmpty
	}
	if facultyChanged {
		var duplicate bool
		if err := tx.QueryRowContext(ctx, `
			SELECT EXISTS(
				SELECT 1 FROM ele_rounds
				WHERE faculty_id = ? AND academic_year_be = ? AND semester = ?
					AND round_id <> ? AND deleted_at IS NULL
			)`, payload.FacultyID, payload.AcademicYearBE, payload.Semester, roundID).Scan(&duplicate); err != nil {
			return err
		}
		if duplicate {
			return ErrFreeElectiveRoundPeriodExists
		}
	} else if periodChanged {
		var duplicate bool
		if err := tx.QueryRowContext(ctx, `
			SELECT EXISTS(
				SELECT 1 FROM ele_rounds
				WHERE faculty_id = ? AND academic_year_be = ? AND semester = ?
					AND round_id <> ? AND deleted_at IS NULL
			)`, currentFacultyID, payload.AcademicYearBE, payload.Semester, roundID).Scan(&duplicate); err != nil {
			return err
		}
		if duplicate {
			return ErrFreeElectiveRoundPeriodExists
		}
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE ele_rounds
		SET faculty_id = ?, academic_year_be = ?, semester = ?, updated_at = NOW()
		WHERE round_id = ? AND deleted_at IS NULL`,
		payload.FacultyID,
		payload.AcademicYearBE,
		payload.Semester,
		roundID,
	); err != nil {
		var mysqlErr *mysql.MySQLError
		if errors.As(err, &mysqlErr) && mysqlErr.Number == 1062 {
			return ErrFreeElectiveRoundPeriodExists
		}
		return err
	}

	if periodChanged && gradeCount > 0 {
		if err := r.recalculateFreeElectiveRoundScoresTx(ctx, tx, roundID, userID); err != nil {
			return err
		}
	}
	return tx.Commit()
}
