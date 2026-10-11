package repositories

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/spw32767/university-competency-system-backend/models"
)

var (
	ErrAssessmentLearnerNotFound = errors.New("assessment learner scope not found")
	ErrAssessmentScopeIncomplete = errors.New("assessment learner scope is incomplete")
)

type AssessmentQueryer interface {
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

type AssessmentSourceRepository struct {
	DB *sql.DB
}

func (r *AssessmentSourceRepository) GetCurriculumNamesWith(ctx context.Context, queryer AssessmentQueryer, curriculumID uint64) (models.AssessmentBilingualText, error) {
	var names models.AssessmentBilingualText
	err := queryer.QueryRowContext(ctx, `SELECT name_th, COALESCE(name_en, '') FROM edu_curricula WHERE curriculum_id = ? AND deleted_at IS NULL`, curriculumID).Scan(&names.TH, &names.EN)
	return names, err
}

type AssessmentCourseMapping struct {
	TemplateItemID   uint64
	CourseID         uint64
	CompetencyID     uint64
	CompetencyCode   string
	CompetencyNameTH string
	CompetencyNameEN string
	Weight           float64
	ScoreType        string
}

type AssessmentCourseScoringSetup struct {
	CohortFound                       bool
	HasAssignment                     bool
	HasActiveTemplate                 bool
	TemplateID                        uint64
	RecalculationRequired             bool
	FreeElectiveRecalculationRequired bool
	Mappings                          []AssessmentCourseMapping
}

type AssessmentElectiveMapping struct {
	MappingID        uint64
	CompetencyID     uint64
	CompetencyCode   string
	CompetencyNameTH string
	CompetencyNameEN string
	Weight           float64
}

type AssessmentElectiveAttempt struct {
	EnrollmentRecordID   uint64
	FreeElectiveCourseID uint64
	GradeRecordID        uint64
	AcademicYearBE       uint64
	Semester             uint64
	CourseCode           string
	CourseNameTH         string
	CourseNameEN         string
	Credits              int
	GradeScheme          string
	Grade                string
	RoundStatus          string
	HasGrade             bool
	Mappings             []AssessmentElectiveMapping
}

func NewAssessmentSourceRepository(db *sql.DB) *AssessmentSourceRepository {
	return &AssessmentSourceRepository{DB: db}
}

func (r *AssessmentSourceRepository) GetLearnerScope(ctx context.Context, userID uint64) (models.LearnerAssessmentScope, error) {
	return r.GetLearnerScopeWith(ctx, r.DB, userID)
}

func (r *AssessmentSourceRepository) GetLearnerScopeWith(
	ctx context.Context,
	queryer AssessmentQueryer,
	userID uint64,
) (models.LearnerAssessmentScope, error) {
	var scope models.LearnerAssessmentScope
	var cohortID, entryYear sql.NullInt64
	err := queryer.QueryRowContext(ctx, `
		SELECT account.person_id,
			enrollment.enrollment_id,
			currentCurriculum.enrollment_curriculum_id,
			cohort.cohort_id,
			currentCurriculum.curriculum_id,
			department.faculty_id,
			enrollment.entry_year_be
		FROM auth_users account
		JOIN kku_enrollments enrollment
			ON enrollment.person_id = account.person_id
			AND enrollment.deleted_at IS NULL
		JOIN kku_enrollment_curricula currentCurriculum
			ON currentCurriculum.enrollment_id = enrollment.enrollment_id
			AND currentCurriculum.is_current = 1
			AND currentCurriculum.deleted_at IS NULL
		JOIN edu_curricula curriculum
			ON curriculum.curriculum_id = currentCurriculum.curriculum_id
			AND curriculum.deleted_at IS NULL
		JOIN edu_majors major
			ON major.major_id = curriculum.major_id
			AND major.deleted_at IS NULL
		JOIN org_departments department
			ON department.department_id = major.department_id
			AND department.deleted_at IS NULL
		LEFT JOIN edu_student_cohorts cohort
			ON cohort.cohort_id = currentCurriculum.cohort_id
			AND cohort.deleted_at IS NULL
		WHERE account.user_id = ?
		ORDER BY enrollment.updated_at DESC,
			enrollment.enrollment_id DESC,
			currentCurriculum.updated_at DESC,
			currentCurriculum.enrollment_curriculum_id DESC
		LIMIT 1`, userID).Scan(
		&scope.PersonID,
		&scope.EnrollmentID,
		&scope.EnrollmentCurriculumID,
		&cohortID,
		&scope.CurriculumID,
		&scope.FacultyID,
		&entryYear,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return models.LearnerAssessmentScope{}, ErrAssessmentLearnerNotFound
	}
	if err != nil {
		return models.LearnerAssessmentScope{}, err
	}
	if cohortID.Valid && cohortID.Int64 > 0 {
		scope.CohortID = uint64(cohortID.Int64)
	}
	if entryYear.Valid && entryYear.Int64 > 0 {
		scope.EntryYearBE = uint64(entryYear.Int64)
	}
	if !scope.SetTargetYear() || !scope.HasRequiredContext() {
		return models.LearnerAssessmentScope{}, ErrAssessmentScopeIncomplete
	}
	return scope, nil
}

func (r *AssessmentSourceRepository) GetLearnerScopeByEnrollmentCurriculumWith(
	ctx context.Context,
	queryer AssessmentQueryer,
	enrollmentCurriculumID uint64,
) (models.LearnerAssessmentScope, error) {
	var scope models.LearnerAssessmentScope
	var cohortID, entryYear sql.NullInt64
	err := queryer.QueryRowContext(ctx, `
		SELECT account.person_id,
			enrollment.enrollment_id,
			currentCurriculum.enrollment_curriculum_id,
			cohort.cohort_id,
			currentCurriculum.curriculum_id,
			department.faculty_id,
			enrollment.entry_year_be
		FROM kku_enrollment_curricula currentCurriculum
		JOIN kku_enrollments enrollment
			ON enrollment.enrollment_id = currentCurriculum.enrollment_id
			AND enrollment.deleted_at IS NULL
		JOIN auth_users account ON account.person_id = enrollment.person_id
		JOIN edu_curricula curriculum
			ON curriculum.curriculum_id = currentCurriculum.curriculum_id
			AND curriculum.deleted_at IS NULL
		JOIN edu_majors major
			ON major.major_id = curriculum.major_id
			AND major.deleted_at IS NULL
		JOIN org_departments department
			ON department.department_id = major.department_id
			AND department.deleted_at IS NULL
		LEFT JOIN edu_student_cohorts cohort
			ON cohort.cohort_id = currentCurriculum.cohort_id
			AND cohort.deleted_at IS NULL
		WHERE currentCurriculum.enrollment_curriculum_id = ?
			AND currentCurriculum.is_current = 1
			AND currentCurriculum.deleted_at IS NULL
		ORDER BY account.user_id
		LIMIT 1`, enrollmentCurriculumID).Scan(
		&scope.PersonID,
		&scope.EnrollmentID,
		&scope.EnrollmentCurriculumID,
		&cohortID,
		&scope.CurriculumID,
		&scope.FacultyID,
		&entryYear,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return models.LearnerAssessmentScope{}, ErrAssessmentLearnerNotFound
	}
	if err != nil {
		return models.LearnerAssessmentScope{}, err
	}
	if cohortID.Valid && cohortID.Int64 > 0 {
		scope.CohortID = uint64(cohortID.Int64)
	}
	if entryYear.Valid && entryYear.Int64 > 0 {
		scope.EntryYearBE = uint64(entryYear.Int64)
	}
	if !scope.SetTargetYear() || !scope.HasRequiredContext() {
		return models.LearnerAssessmentScope{}, ErrAssessmentScopeIncomplete
	}
	return scope, nil
}

func (r *AssessmentSourceRepository) GetCourseScoringSetupWith(
	ctx context.Context,
	queryer AssessmentQueryer,
	cohortID uint64,
) (AssessmentCourseScoringSetup, error) {
	var setup AssessmentCourseScoringSetup
	var assignmentTemplateID, activeTemplateID sql.NullInt64
	err := queryer.QueryRowContext(ctx, `
		SELECT cohort.course_scores_recalculation_required,
			cohort.free_elective_scores_recalculation_required,
			assignment.template_id,
			activeTemplate.template_id
		FROM edu_student_cohorts cohort
		LEFT JOIN curri_template_assignments assignment
			ON assignment.cohort_id = cohort.cohort_id
			AND assignment.deleted_at IS NULL
		LEFT JOIN comp_templates activeTemplate
			ON activeTemplate.template_id = assignment.template_id
			AND activeTemplate.curriculum_id = cohort.curriculum_id
			AND activeTemplate.is_active = 1
			AND activeTemplate.deleted_at IS NULL
		WHERE cohort.cohort_id = ? AND cohort.deleted_at IS NULL`, cohortID).Scan(
		&setup.RecalculationRequired,
		&setup.FreeElectiveRecalculationRequired,
		&assignmentTemplateID,
		&activeTemplateID,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return AssessmentCourseScoringSetup{}, ErrAssessmentCohortNotFound
	}
	if err != nil {
		return AssessmentCourseScoringSetup{}, err
	}
	setup.CohortFound = true
	setup.HasAssignment = assignmentTemplateID.Valid
	setup.HasActiveTemplate = activeTemplateID.Valid
	if !setup.HasActiveTemplate {
		return setup, nil
	}
	setup.TemplateID = uint64(activeTemplateID.Int64)
	setup.Mappings, err = getAssessmentCourseMappings(ctx, queryer, setup.TemplateID)
	if err != nil {
		return AssessmentCourseScoringSetup{}, err
	}
	return setup, nil
}

func getAssessmentCourseMappings(
	ctx context.Context,
	queryer AssessmentQueryer,
	templateID uint64,
) ([]AssessmentCourseMapping, error) {
	rows, err := queryer.QueryContext(ctx, `
		SELECT item.template_item_id, item.course_id, item.competency_id,
			COALESCE(competency.code, ''), COALESCE(competency.name_th, ''),
			COALESCE(competency.name_en, ''), COALESCE(item.weight, 0),
			CASE WHEN COALESCE(item.is_custom_course, 0) = 0 AND EXISTS (
				SELECT 1
				FROM crs_curriculum_courses placement
				JOIN crs_course_categories category
					ON category.category_id = placement.category_id
					AND category.deleted_at IS NULL
				JOIN comp_templates ownerTemplate
					ON ownerTemplate.template_id = item.template_id
				WHERE placement.course_id = item.course_id
					AND placement.is_required = 1
					AND placement.is_active = 1
					AND placement.deleted_at IS NULL
					AND category.curriculum_id = ownerTemplate.curriculum_id
			) THEN 'core' ELSE 'bonus' END AS score_type
		FROM comp_template_items item
		JOIN comp_competencies competency
			ON competency.competency_id = item.competency_id
			AND competency.deleted_at IS NULL
		WHERE item.template_id = ?
			AND item.course_id IS NOT NULL
			AND item.deleted_at IS NULL
			AND item.is_active = 1
		ORDER BY item.competency_id, item.course_id, item.template_item_id`, templateID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	mappings := make([]AssessmentCourseMapping, 0)
	for rows.Next() {
		var mapping AssessmentCourseMapping
		if err := rows.Scan(
			&mapping.TemplateItemID,
			&mapping.CourseID,
			&mapping.CompetencyID,
			&mapping.CompetencyCode,
			&mapping.CompetencyNameTH,
			&mapping.CompetencyNameEN,
			&mapping.Weight,
			&mapping.ScoreType,
		); err != nil {
			return nil, err
		}
		mappings = append(mappings, mapping)
	}
	return mappings, rows.Err()
}

func (r *AssessmentSourceRepository) GetElectiveAttemptsWith(
	ctx context.Context,
	queryer AssessmentQueryer,
	enrollmentID uint64,
	enrollmentCurriculumID uint64,
) ([]AssessmentElectiveAttempt, error) {
	rows, err := queryer.QueryContext(ctx, `
		SELECT selected.round_course_enrollment_id,
			course.free_elective_course_id,
			grade.grade_record_id,
			round.academic_year_be,
		round.semester,
			COALESCE(course.course_code, ''),
			COALESCE(course.course_name_th, ''),
			COALESCE(course.course_name_en, ''),
			COALESCE(course.credits, 0),
			COALESCE(course.grade_scheme, 'letter'),
			COALESCE(grade.grade, ''),
			round.status,
			mapping.round_course_competency_id,
			competency.competency_id,
			COALESCE(competency.code, ''),
			COALESCE(competency.name_th, ''),
			COALESCE(competency.name_en, ''),
			COALESCE(mapping.weight_percent, 0)
		FROM kku_enrollment_curricula roster
		JOIN kku_enrollments enrollment
			ON enrollment.enrollment_id = roster.enrollment_id
			AND enrollment.deleted_at IS NULL
		JOIN ele_course_enrollments selected
			ON selected.enrollment_id = roster.enrollment_id
			AND selected.enrollment_curriculum_id = roster.enrollment_curriculum_id
			AND selected.status IN ('enrolled', 'completed')
			AND selected.deleted_at IS NULL
		JOIN ele_round_courses course
			ON course.round_course_id = selected.round_course_id
			AND course.deleted_at IS NULL
		JOIN ele_rounds round
			ON round.round_id = course.round_id
			AND round.deleted_at IS NULL
			AND round.status <> 'cancelled'
		LEFT JOIN ele_course_grades grade
			ON grade.round_course_enrollment_id = selected.round_course_enrollment_id
			AND grade.deleted_at IS NULL
		LEFT JOIN ele_round_course_competencies mapping
			ON mapping.round_course_id = course.round_course_id
			AND mapping.deleted_at IS NULL
		LEFT JOIN comp_competencies competency
			ON competency.competency_id = mapping.competency_id
			AND competency.deleted_at IS NULL
		WHERE roster.enrollment_id = ?
			AND roster.enrollment_curriculum_id = ?
			AND roster.is_current = 1
			AND roster.deleted_at IS NULL
		ORDER BY round.academic_year_be, round.semester,
			course.free_elective_course_id, selected.round_course_enrollment_id,
			grade.grade_record_id, mapping.round_course_competency_id`,
		enrollmentID, enrollmentCurriculumID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type attemptKey struct {
		enrollmentRecordID uint64
		gradeRecordID      uint64
	}
	indexes := make(map[attemptKey]int)
	attempts := make([]AssessmentElectiveAttempt, 0)
	for rows.Next() {
		var attempt AssessmentElectiveAttempt
		var gradeRecordID, mappingID, competencyID sql.NullInt64
		var weight sql.NullFloat64
		var attemptMappingCode, attemptMappingNameTH, attemptMappingNameEN string
		if err := rows.Scan(
			&attempt.EnrollmentRecordID,
			&attempt.FreeElectiveCourseID,
			&gradeRecordID,
			&attempt.AcademicYearBE,
			&attempt.Semester,
			&attempt.CourseCode,
			&attempt.CourseNameTH,
			&attempt.CourseNameEN,
			&attempt.Credits,
			&attempt.GradeScheme,
			&attempt.Grade,
			&attempt.RoundStatus,
			&mappingID,
			&competencyID,
			&attemptMappingCode,
			&attemptMappingNameTH,
			&attemptMappingNameEN,
			&weight,
		); err != nil {
			return nil, err
		}
		if gradeRecordID.Valid && gradeRecordID.Int64 > 0 {
			attempt.GradeRecordID = uint64(gradeRecordID.Int64)
			attempt.HasGrade = true
		}
		key := attemptKey{enrollmentRecordID: attempt.EnrollmentRecordID, gradeRecordID: attempt.GradeRecordID}
		index, exists := indexes[key]
		if !exists {
			attempt.Mappings = make([]AssessmentElectiveMapping, 0)
			attempts = append(attempts, attempt)
			index = len(attempts) - 1
			indexes[key] = index
		}
		if mappingID.Valid && competencyID.Valid {
			attempts[index].Mappings = append(attempts[index].Mappings, AssessmentElectiveMapping{
				MappingID:        uint64(mappingID.Int64),
				CompetencyID:     uint64(competencyID.Int64),
				CompetencyCode:   attemptMappingCode,
				CompetencyNameTH: attemptMappingNameTH,
				CompetencyNameEN: attemptMappingNameEN,
				Weight:           weight.Float64,
			})
		}
	}
	return attempts, rows.Err()
}

func (r *AssessmentSourceRepository) GetActivityEvidenceWith(
	ctx context.Context,
	queryer AssessmentQueryer,
	personID uint64,
) ([]models.AssessmentActivityEvidence, error) {
	rows, err := queryer.QueryContext(ctx, `
		SELECT attendance.session_attendance_id,
			session.session_id,
			activity.activity_id,
			COALESCE(sessionCompetency.session_competency_id, 0),
			COALESCE(sessionCompetency.competency_id, 0),
			COALESCE(competency.code, ''),
			COALESCE(competency.name_th, ''),
			COALESCE(competency.name_en, ''),
			activity.name_th,
			COALESCE(activity.name_en, ''),
			COALESCE(activity.category, ''),
			COALESCE(activity.type, ''),
			session.start_at,
			attendance.status,
			session.status,
			COALESCE(sessionCompetency.max_percent, 0),
			session.scores_finalized_at,
			session.scores_recalculation_required,
		score.session_competency_score_id,
			result.session_competency_result_id,
			result.earned_percent
		FROM att_session_attendances attendance
		JOIN act_sessions session
			ON session.session_id = attendance.session_id
			AND session.status <> 'cancelled'
			AND session.deleted_at IS NULL
		JOIN act_activities activity
			ON activity.activity_id = session.activity_id
			AND activity.deleted_at IS NULL
		LEFT JOIN act_session_competencies sessionCompetency
			ON sessionCompetency.session_id = session.session_id
			AND sessionCompetency.deleted_at IS NULL
		LEFT JOIN comp_competencies competency
			ON competency.competency_id = sessionCompetency.competency_id
			AND competency.deleted_at IS NULL
		LEFT JOIN score_session_competency_scores score
			ON score.session_competency_id = sessionCompetency.session_competency_id
			AND score.person_id = attendance.person_id
			AND score.is_locked = 1
			AND score.deleted_at IS NULL
		LEFT JOIN score_session_competency_results result
			ON result.score_id = score.session_competency_score_id
			AND result.is_locked = 1
			AND result.deleted_at IS NULL
		WHERE attendance.person_id = ?
			AND attendance.status IN ('present', 'late')
			AND attendance.deleted_at IS NULL
		ORDER BY session.start_at, session.session_id,
			sessionCompetency.session_competency_id, attendance.session_attendance_id`, personID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	evidence := make([]models.AssessmentActivityEvidence, 0)
	for rows.Next() {
		var item models.AssessmentActivityEvidence
		var finalizedAt sql.NullTime
		var scoreID, resultID sql.NullInt64
		var earnedPercent sql.NullFloat64
		var scoresRecalculationRequired bool
		if err := rows.Scan(
			&item.AttendanceID,
			&item.SessionID,
			&item.ActivityID,
			&item.SessionCompetencyID,
			&item.CompetencyID,
			&item.CompetencyCode,
			&item.CompetencyNameTH,
			&item.CompetencyNameEN,
			&item.ActivityNameTH,
			&item.ActivityNameEN,
			&item.ActivityCategory,
			&item.ActivityType,
			&item.StartAt,
			&item.AttendanceStatus,
			&item.SessionStatus,
			&item.MaxPercent,
			&finalizedAt,
			&scoresRecalculationRequired,
			&scoreID,
			&resultID,
			&earnedPercent,
		); err != nil {
			return nil, err
		}
		item.EvidenceRef = assessmentActivityEvidenceRef(item.AttendanceID, item.SessionCompetencyID)
		switch {
		case item.SessionCompetencyID == 0:
			item.ScoreUnavailableReason = "activity_competency_not_configured"
		case item.SessionStatus != "completed":
			item.ScoreUnavailableReason = "session_not_completed"
		case !finalizedAt.Valid:
			item.ScoreUnavailableReason = "scores_not_finalized"
		case scoresRecalculationRequired:
			item.ScoreUnavailableReason = "scores_recalculation_required"
		case !scoreID.Valid || !resultID.Valid:
			item.ScoreUnavailableReason = "score_not_finalized"
		case !earnedPercent.Valid:
			item.ScoreUnavailableReason = "score_value_missing"
		default:
			value := earnedPercent.Float64
			item.EarnedPercent = &value
			item.ScoreEvidenceRef = assessmentActivityScoreEvidenceRef(scoreID.Int64, resultID.Int64)
		}
		evidence = append(evidence, item)
	}
	return evidence, rows.Err()
}

func assessmentActivityEvidenceRef(attendanceID, sessionCompetencyID uint64) string {
	return fmt.Sprintf("activity:%d:%d", attendanceID, sessionCompetencyID)
}

func assessmentActivityScoreEvidenceRef(scoreID, resultID int64) string {
	return fmt.Sprintf("activity-score:%d:%d", scoreID, resultID)
}

var ErrAssessmentCohortNotFound = errors.New("assessment cohort not found")
