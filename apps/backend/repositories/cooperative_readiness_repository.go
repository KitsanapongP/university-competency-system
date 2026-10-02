package repositories

import (
	"context"
	"database/sql"
	"errors"
	"reflect"

	"github.com/spw32767/university-competency-system-backend/models"
)

var (
	ErrCooperativeRequirementsEmpty   = errors.New("cooperative requirements must not be empty")
	ErrCooperativeRequirementsChanged = errors.New("cooperative requirements changed during publish")
)

type CooperativeReadinessRepository struct {
	DB *sql.DB
}

type cooperativeReadinessQueryer interface {
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
}

type CooperativeLearnerContext struct {
	EnrollmentID uint64
	CurriculumID uint64
	EntryYearBE  uint64
}

type CooperativeAcademicRecord struct {
	RecordID     uint64
	CourseID     uint64
	Source       string
	AcademicYear uint64
	Semester     uint64
	CourseCode   string
	CourseNameTH string
	CourseNameEN string
	Credits      int
	GradeScheme  string
	Grade        string
	CategoryIDs  []uint64
}

func NewCooperativeReadinessRepository(db *sql.DB) *CooperativeReadinessRepository {
	return &CooperativeReadinessRepository{DB: db}
}

func (r *CooperativeReadinessRepository) GetLearnerContext(ctx context.Context, userID uint64) (CooperativeLearnerContext, error) {
	var learner CooperativeLearnerContext
	var entryYear sql.NullInt64
	err := r.DB.QueryRowContext(ctx, `
		SELECT enrollment.enrollment_id, enrollmentCurriculum.curriculum_id, enrollment.entry_year_be
		FROM auth_users account
		JOIN kku_enrollments enrollment
			ON enrollment.person_id = account.person_id AND enrollment.deleted_at IS NULL
		JOIN kku_enrollment_curricula enrollmentCurriculum
			ON enrollmentCurriculum.enrollment_id = enrollment.enrollment_id
			AND enrollmentCurriculum.is_current = 1
			AND enrollmentCurriculum.deleted_at IS NULL
		WHERE account.user_id = ?
		ORDER BY enrollment.updated_at DESC, enrollment.enrollment_id DESC
		LIMIT 1`, userID).Scan(&learner.EnrollmentID, &learner.CurriculumID, &entryYear)
	if err != nil {
		return CooperativeLearnerContext{}, err
	}
	if entryYear.Valid && entryYear.Int64 > 0 {
		learner.EntryYearBE = uint64(entryYear.Int64)
	}
	return learner, nil
}

func (r *CooperativeReadinessRepository) GetAcademicRecords(ctx context.Context, enrollmentID, curriculumID uint64) ([]CooperativeAcademicRecord, error) {
	return r.GetAcademicRecordsWith(ctx, r.DB, enrollmentID, curriculumID)
}

func (r *CooperativeReadinessRepository) GetAcademicRecordsWith(ctx context.Context, queryer cooperativeReadinessQueryer, enrollmentID, curriculumID uint64) ([]CooperativeAcademicRecord, error) {
	categoryByCourse, err := r.getCourseCategoriesWith(ctx, queryer, curriculumID)
	if err != nil {
		return nil, err
	}
	records, err := r.getCurriculumAcademicRecordsWith(ctx, queryer, enrollmentID, categoryByCourse)
	if err != nil {
		return nil, err
	}
	freeElectiveRecords, err := r.getFreeElectiveAcademicRecordsWith(ctx, queryer, enrollmentID)
	if err != nil {
		return nil, err
	}
	records = append(records, freeElectiveRecords...)
	return records, nil
}

func (r *CooperativeReadinessRepository) getCourseCategoriesWith(ctx context.Context, queryer cooperativeReadinessQueryer, curriculumID uint64) (map[uint64][]uint64, error) {
	rows, err := queryer.QueryContext(ctx, `
		SELECT placement.course_id, category.category_id
		FROM crs_curriculum_courses placement
		JOIN crs_course_categories category
			ON category.category_id = placement.category_id
			AND category.curriculum_id = ?
			AND category.deleted_at IS NULL AND category.is_active = 1
		WHERE placement.deleted_at IS NULL AND placement.is_active = 1`, curriculumID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[uint64][]uint64)
	for rows.Next() {
		var courseID, categoryID uint64
		if err := rows.Scan(&courseID, &categoryID); err != nil {
			return nil, err
		}
		result[courseID] = append(result[courseID], categoryID)
	}
	return result, rows.Err()
}

func (r *CooperativeReadinessRepository) getCurriculumAcademicRecordsWith(ctx context.Context, queryer cooperativeReadinessQueryer, enrollmentID uint64, categoryByCourse map[uint64][]uint64) ([]CooperativeAcademicRecord, error) {
	rows, err := queryer.QueryContext(ctx, `
		SELECT grade.course_student_id, grade.course_id, grade.academic_year_be,
			grade.semester, COALESCE(course.code, ''), COALESCE(course.name_th, ''),
			COALESCE(course.name_en, ''), COALESCE(course.credits, 0),
			COALESCE(course.grade_scheme, 'letter'), COALESCE(grade.grade, '')
		FROM crs_course_enrollment grade
		JOIN crs_courses course ON course.course_id = grade.course_id AND course.deleted_at IS NULL
		WHERE grade.enrollment_id = ? AND grade.deleted_at IS NULL
		ORDER BY grade.academic_year_be, grade.semester, grade.course_student_id`, enrollmentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]CooperativeAcademicRecord, 0)
	for rows.Next() {
		var record CooperativeAcademicRecord
		record.Source = "curriculum"
		if err := rows.Scan(
			&record.RecordID,
			&record.CourseID,
			&record.AcademicYear,
			&record.Semester,
			&record.CourseCode,
			&record.CourseNameTH,
			&record.CourseNameEN,
			&record.Credits,
			&record.GradeScheme,
			&record.Grade,
		); err != nil {
			return nil, err
		}
		record.CategoryIDs = categoryByCourse[record.CourseID]
		result = append(result, record)
	}
	return result, rows.Err()
}

func (r *CooperativeReadinessRepository) getFreeElectiveAcademicRecordsWith(ctx context.Context, queryer cooperativeReadinessQueryer, enrollmentID uint64) ([]CooperativeAcademicRecord, error) {
	rows, err := queryer.QueryContext(ctx, `
		SELECT selected.round_course_enrollment_id, roundCourse.free_elective_course_id,
			round.academic_year_be, round.semester, COALESCE(roundCourse.course_code, ''),
			COALESCE(roundCourse.course_name_th, ''), COALESCE(roundCourse.course_name_en, ''),
			COALESCE(roundCourse.credits, 0), COALESCE(roundCourse.grade_scheme, 'letter'),
			COALESCE(grade.grade, '')
		FROM ele_course_enrollments selected
		JOIN ele_round_courses roundCourse
			ON roundCourse.round_course_id = selected.round_course_id
			AND roundCourse.deleted_at IS NULL
		JOIN ele_rounds round
			ON round.round_id = roundCourse.round_id
			AND round.deleted_at IS NULL AND round.status <> 'cancelled'
		LEFT JOIN ele_course_grades grade
			ON grade.round_course_enrollment_id = selected.round_course_enrollment_id
			AND grade.deleted_at IS NULL
		WHERE selected.enrollment_id = ? AND selected.deleted_at IS NULL
		ORDER BY round.academic_year_be, round.semester, selected.round_course_enrollment_id`, enrollmentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]CooperativeAcademicRecord, 0)
	for rows.Next() {
		var record CooperativeAcademicRecord
		record.Source = "free_elective"
		if err := rows.Scan(
			&record.RecordID,
			&record.CourseID,
			&record.AcademicYear,
			&record.Semester,
			&record.CourseCode,
			&record.CourseNameTH,
			&record.CourseNameEN,
			&record.Credits,
			&record.GradeScheme,
			&record.Grade,
		); err != nil {
			return nil, err
		}
		result = append(result, record)
	}
	return result, rows.Err()
}

func (r *CooperativeReadinessRepository) GetRequirementSets(ctx context.Context, curriculumID uint64, semester uint) (*models.CooperativeRequirementsResponse, error) {
	return r.GetRequirementSetsWith(ctx, r.DB, curriculumID, semester)
}

func (r *CooperativeReadinessRepository) GetRequirementSetsWith(ctx context.Context, queryer cooperativeReadinessQueryer, curriculumID uint64, semester uint) (*models.CooperativeRequirementsResponse, error) {
	response := &models.CooperativeRequirementsResponse{CurriculumID: curriculumID}
	rows, err := queryer.QueryContext(ctx, `
		SELECT requirement_set_id, curriculum_id, semester, revision, status,
			created_at, updated_at, published_at
		FROM crs_coop_requirement_sets
		WHERE curriculum_id = ? AND semester = ? AND status IN ('draft', 'published')
		ORDER BY FIELD(status, 'draft', 'published')`, curriculumID, semester)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sets := make([]models.CooperativeRequirementSet, 0, 2)
	for rows.Next() {
		var set models.CooperativeRequirementSet
		var publishedAt sql.NullTime
		if err := rows.Scan(
			&set.RequirementSetID,
			&set.CurriculumID,
			&set.Semester,
			&set.Revision,
			&set.Status,
			&set.CreatedAt,
			&set.UpdatedAt,
			&publishedAt,
		); err != nil {
			return nil, err
		}
		if publishedAt.Valid {
			set.PublishedAt = &publishedAt.Time
		}
		sets = append(sets, set)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for index := range sets {
		requirements, err := r.getRequirementsWith(ctx, queryer, sets[index].RequirementSetID)
		if err != nil {
			return nil, err
		}
		sets[index].Requirements = requirements
		set := sets[index]
		switch set.Status {
		case "draft":
			response.Draft = &set
		case "published":
			response.Published = &set
		}
	}
	return response, nil
}

func (r *CooperativeReadinessRepository) getRequirementsWith(ctx context.Context, queryer cooperativeReadinessQueryer, setID uint64) ([]models.CooperativeRequirement, error) {
	rows, err := queryer.QueryContext(ctx, `
		SELECT requirement_id, criterion_type, name_th, name_en,
			minimum_value, minimum_grade, category_id, course_id, display_order
		FROM crs_coop_requirements
		WHERE requirement_set_id = ?
		ORDER BY display_order, requirement_id`, setID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	requirements := make([]models.CooperativeRequirement, 0)
	for rows.Next() {
		requirement, err := scanCooperativeRequirement(rows)
		if err != nil {
			return nil, err
		}
		requirements = append(requirements, requirement)
	}
	return requirements, rows.Err()
}

type cooperativeRequirementScanner interface {
	Scan(dest ...any) error
}

func scanCooperativeRequirement(scanner cooperativeRequirementScanner) (models.CooperativeRequirement, error) {
	var requirement models.CooperativeRequirement
	var nameEN, minimumGrade sql.NullString
	var minimumValue sql.NullFloat64
	var categoryID, courseID sql.NullInt64
	err := scanner.Scan(
		&requirement.RequirementID,
		&requirement.CriterionType,
		&requirement.NameTH,
		&nameEN,
		&minimumValue,
		&minimumGrade,
		&categoryID,
		&courseID,
		&requirement.DisplayOrder,
	)
	if err != nil {
		return requirement, err
	}
	if nameEN.Valid {
		requirement.NameEN = &nameEN.String
	}
	if minimumValue.Valid {
		requirement.MinimumValue = &minimumValue.Float64
	}
	if minimumGrade.Valid {
		requirement.MinimumGrade = &minimumGrade.String
	}
	if categoryID.Valid {
		value := uint64(categoryID.Int64)
		requirement.CategoryID = &value
	}
	if courseID.Valid {
		value := uint64(courseID.Int64)
		requirement.CourseID = &value
	}
	return requirement, nil
}

func (r *CooperativeReadinessRepository) ReplaceDraft(ctx context.Context, curriculumID uint64, semester uint, userID uint64, requirements []models.CooperativeRequirement) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var lockedCurriculumID uint64
	if err := tx.QueryRowContext(ctx, `
		SELECT curriculum_id FROM edu_curricula
		WHERE curriculum_id = ? AND deleted_at IS NULL FOR UPDATE`, curriculumID,
	).Scan(&lockedCurriculumID); err != nil {
		return err
	}

	var setID, revision uint64
	err = tx.QueryRowContext(ctx, `
		SELECT requirement_set_id, revision
		FROM crs_coop_requirement_sets
		WHERE curriculum_id = ? AND semester = ? AND status = 'draft' FOR UPDATE`, curriculumID, semester,
	).Scan(&setID, &revision)
	if errors.Is(err, sql.ErrNoRows) {
		if err := tx.QueryRowContext(ctx, `
			SELECT COALESCE(MAX(revision), 0) + 1
			FROM crs_coop_requirement_sets WHERE curriculum_id = ? AND semester = ?`, curriculumID, semester,
		).Scan(&revision); err != nil {
			return err
		}
		result, err := tx.ExecContext(ctx, `
			INSERT INTO crs_coop_requirement_sets (curriculum_id, semester, revision, status, created_by)
			VALUES (?, ?, ?, 'draft', NULLIF(?, 0))`, curriculumID, semester, revision, userID)
		if err != nil {
			return err
		}
		insertedID, err := result.LastInsertId()
		if err != nil {
			return err
		}
		setID = uint64(insertedID)
	} else if err != nil {
		return err
	}

	if _, err := tx.ExecContext(ctx, `DELETE FROM crs_coop_requirements WHERE requirement_set_id = ?`, setID); err != nil {
		return err
	}
	for index, requirement := range requirements {
		if requirement.CriterionType == "" {
			continue
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO crs_coop_requirements (
				requirement_set_id, criterion_type, name_th, name_en,
				minimum_value, minimum_grade, category_id, course_id, display_order
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			setID,
			requirement.CriterionType,
			requirement.NameTH,
			requirement.NameEN,
			requirement.MinimumValue,
			requirement.MinimumGrade,
			requirement.CategoryID,
			requirement.CourseID,
			index,
		); err != nil {
			return err
		}
	}
	_, err = tx.ExecContext(ctx, `
		UPDATE crs_coop_requirement_sets SET updated_at = CURRENT_TIMESTAMP
		WHERE requirement_set_id = ?`, setID)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (r *CooperativeReadinessRepository) PublishDraft(ctx context.Context, curriculumID uint64, semester uint, userID uint64, expected []models.CooperativeRequirement) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var lockedCurriculumID uint64
	if err := tx.QueryRowContext(ctx, `
		SELECT curriculum_id FROM edu_curricula
		WHERE curriculum_id = ? AND deleted_at IS NULL FOR UPDATE`, curriculumID,
	).Scan(&lockedCurriculumID); err != nil {
		return err
	}

	var draftID uint64
	if err := tx.QueryRowContext(ctx, `
		SELECT requirement_set_id FROM crs_coop_requirement_sets
		WHERE curriculum_id = ? AND semester = ? AND status = 'draft' FOR UPDATE`, curriculumID, semester,
	).Scan(&draftID); err != nil {
		return err
	}

	actual, err := getCooperativeRequirementsTx(ctx, tx, draftID)
	if err != nil {
		return err
	}
	if !reflect.DeepEqual(actual, expected) {
		return ErrCooperativeRequirementsChanged
	}
	if len(actual) == 0 {
		return ErrCooperativeRequirementsEmpty
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE crs_coop_requirement_sets
		SET status = 'archived'
		WHERE curriculum_id = ? AND semester = ? AND status = 'published'`, curriculumID, semester); err != nil {
		return err
	}
	result, err := tx.ExecContext(ctx, `
		UPDATE crs_coop_requirement_sets
		SET status = 'published', published_by = NULLIF(?, 0), published_at = CURRENT_TIMESTAMP
		WHERE requirement_set_id = ? AND status = 'draft'`, userID, draftID)
	if err != nil {
		return err
	}
	changed, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if changed != 1 {
		return ErrCooperativeRequirementsChanged
	}
	return tx.Commit()
}

func getCooperativeRequirementsTx(ctx context.Context, tx *sql.Tx, setID uint64) ([]models.CooperativeRequirement, error) {
	rows, err := tx.QueryContext(ctx, `
		SELECT requirement_id, criterion_type, name_th, name_en,
			minimum_value, minimum_grade, category_id, course_id, display_order
		FROM crs_coop_requirements
		WHERE requirement_set_id = ?
		ORDER BY display_order, requirement_id FOR UPDATE`, setID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.CooperativeRequirement, 0)
	for rows.Next() {
		item, err := scanCooperativeRequirement(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
