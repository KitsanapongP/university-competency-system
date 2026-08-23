package repositories

import (
	"context"
	"database/sql"
	"strings"

	"github.com/spw32767/university-competency-system-backend/models"
)

type ExecutiveAnalyticsRepository struct {
	DB *sql.DB
}

func NewExecutiveAnalyticsRepository(db *sql.DB) *ExecutiveAnalyticsRepository {
	return &ExecutiveAnalyticsRepository{DB: db}
}

func executiveScopeWhere(f models.ExecutiveAnalyticsFilters, prefix string) (string, []any) {
	where := []string{prefix + ".deleted_at IS NULL", "c.deleted_at IS NULL", "m.deleted_at IS NULL", "d.deleted_at IS NULL", "fac.deleted_at IS NULL"}
	args := make([]any, 0, 6)
	if f.FacultyID != nil {
		where = append(where, "fac.faculty_id = ?")
		args = append(args, *f.FacultyID)
	}
	if f.MajorID != nil {
		where = append(where, "m.major_id = ?")
		args = append(args, *f.MajorID)
	}
	if f.CurriculumID != nil {
		where = append(where, "c.curriculum_id = ?")
		args = append(args, *f.CurriculumID)
	}
	if f.CohortID != nil {
		where = append(where, "sc.cohort_id = ?")
		args = append(args, *f.CohortID)
	}
	if f.EntryYearBE != nil {
		where = append(where, "sc.entry_year_be = ?")
		args = append(args, *f.EntryYearBE)
	}
	return strings.Join(where, " AND "), args
}

func executivePlaceholders(count int) string {
	return strings.TrimSuffix(strings.Repeat("?,", count), ",")
}

func (r *ExecutiveAnalyticsRepository) GetFaculties(ctx context.Context, facultyID *uint64) ([]models.ExecutiveFacultyOption, error) {
	where := "f.deleted_at IS NULL AND f.is_active = 1"
	args := []any{}
	if facultyID != nil {
		where += " AND f.faculty_id = ?"
		args = append(args, *facultyID)
	}
	rows, err := r.DB.QueryContext(ctx, `SELECT f.faculty_id, f.name_th, COALESCE(f.name_en, '')
		FROM org_faculties f WHERE `+where+` ORDER BY f.name_th`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]models.ExecutiveFacultyOption, 0)
	for rows.Next() {
		var item models.ExecutiveFacultyOption
		if err := rows.Scan(&item.FacultyID, &item.NameTH, &item.NameEN); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *ExecutiveAnalyticsRepository) GetMajors(ctx context.Context, facultyID *uint64) ([]models.ExecutiveMajorOption, error) {
	where := "m.deleted_at IS NULL AND m.is_active = 1 AND d.deleted_at IS NULL AND d.is_active = 1 AND f.deleted_at IS NULL AND f.is_active = 1"
	args := []any{}
	if facultyID != nil {
		where += " AND f.faculty_id = ?"
		args = append(args, *facultyID)
	}
	rows, err := r.DB.QueryContext(ctx, `SELECT m.major_id, f.faculty_id, m.name_th, COALESCE(m.name_en, '')
		FROM edu_majors m
		JOIN org_departments d ON d.department_id = m.department_id
		JOIN org_faculties f ON f.faculty_id = d.faculty_id
		WHERE `+where+` ORDER BY m.name_th`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]models.ExecutiveMajorOption, 0)
	for rows.Next() {
		var item models.ExecutiveMajorOption
		if err := rows.Scan(&item.MajorID, &item.FacultyID, &item.NameTH, &item.NameEN); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *ExecutiveAnalyticsRepository) GetCurricula(ctx context.Context, f models.ExecutiveAnalyticsFilters) ([]models.ExecutiveCurriculumOption, error) {
	where := []string{"c.deleted_at IS NULL", "m.deleted_at IS NULL", "d.deleted_at IS NULL", "fac.deleted_at IS NULL"}
	args := []any{}
	if f.FacultyID != nil {
		where = append(where, "fac.faculty_id = ?")
		args = append(args, *f.FacultyID)
	}
	if f.MajorID != nil {
		where = append(where, "m.major_id = ?")
		args = append(args, *f.MajorID)
	}
	rows, err := r.DB.QueryContext(ctx, `SELECT c.curriculum_id, c.major_id, fac.faculty_id, c.code, c.name_th, COALESCE(c.name_en, ''), c.effective_year_be
		FROM edu_curricula c
		JOIN edu_majors m ON m.major_id = c.major_id
		JOIN org_departments d ON d.department_id = m.department_id
		JOIN org_faculties fac ON fac.faculty_id = d.faculty_id
		WHERE `+strings.Join(where, " AND ")+` ORDER BY c.effective_year_be DESC, c.name_th`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]models.ExecutiveCurriculumOption, 0)
	for rows.Next() {
		var item models.ExecutiveCurriculumOption
		if err := rows.Scan(&item.CurriculumID, &item.MajorID, &item.FacultyID, &item.Code, &item.NameTH, &item.NameEN, &item.Year); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *ExecutiveAnalyticsRepository) GetCohortOptions(ctx context.Context, f models.ExecutiveAnalyticsFilters) ([]models.ExecutiveCohortOption, error) {
	where, args := executiveScopeWhere(f, "sc")
	rows, err := r.DB.QueryContext(ctx, `SELECT sc.cohort_id, c.curriculum_id, c.code, c.name_th, COALESCE(c.name_en, ''), sc.entry_year_be
		FROM edu_student_cohorts sc
		JOIN edu_curricula c ON c.curriculum_id = sc.curriculum_id
		JOIN edu_majors m ON m.major_id = c.major_id
		JOIN org_departments d ON d.department_id = m.department_id
		JOIN org_faculties fac ON fac.faculty_id = d.faculty_id
		WHERE `+where+` ORDER BY sc.entry_year_be DESC, c.code`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]models.ExecutiveCohortOption, 0)
	for rows.Next() {
		var item models.ExecutiveCohortOption
		if err := rows.Scan(&item.CohortID, &item.CurriculumID, &item.Code, &item.NameTH, &item.NameEN, &item.EntryYearBE); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *ExecutiveAnalyticsRepository) GetCohortSummaries(ctx context.Context, f models.ExecutiveAnalyticsFilters) ([]models.ExecutiveCohortSummary, error) {
	where, args := executiveScopeWhere(f, "sc")
	query := `SELECT sc.cohort_id, c.curriculum_id, c.code, c.name_th, COALESCE(c.name_en, ''), m.major_id, m.name_th, fac.faculty_id, fac.name_th, sc.entry_year_be,
			COUNT(DISTINCT CASE WHEN e.enrollment_status = 'student' THEN e.enrollment_id END),
			CASE WHEN EXISTS (
				SELECT 1 FROM curri_template_assignments ta
				JOIN comp_templates tpl ON tpl.template_id = ta.template_id AND tpl.deleted_at IS NULL AND tpl.is_active = 1
				WHERE ta.cohort_id = sc.cohort_id AND ta.deleted_at IS NULL
			) THEN 1 ELSE 0 END,
			CASE WHEN EXISTS (
				SELECT 1 FROM comp_curriculum_requirements req
				WHERE req.cohort_id = sc.cohort_id AND req.deleted_at IS NULL
			) THEN 1 ELSE 0 END,
			CASE WHEN EXISTS (
				SELECT 1
				FROM score_course_competency_scores course_score
				JOIN crs_course_enrollment course_enrollment
					ON course_enrollment.course_student_id = course_score.course_student_id
					AND course_enrollment.deleted_at IS NULL
				JOIN kku_enrollment_curricula score_roster
					ON score_roster.enrollment_curriculum_id = course_enrollment.student_curricula_id
					AND score_roster.cohort_id = sc.cohort_id
					AND score_roster.deleted_at IS NULL
				JOIN kku_enrollments score_student
					ON score_student.enrollment_id = score_roster.enrollment_id
					AND score_student.enrollment_status = 'student'
					AND score_student.deleted_at IS NULL
				WHERE course_score.deleted_at IS NULL
			) THEN 1 ELSE 0 END,
			COALESCE(sc.course_scores_recalculation_required, 0)
		FROM edu_student_cohorts sc
		JOIN edu_curricula c ON c.curriculum_id = sc.curriculum_id
		JOIN edu_majors m ON m.major_id = c.major_id
		JOIN org_departments d ON d.department_id = m.department_id
		JOIN org_faculties fac ON fac.faculty_id = d.faculty_id
		LEFT JOIN kku_enrollment_curricula ec ON ec.cohort_id = sc.cohort_id AND ec.deleted_at IS NULL
		LEFT JOIN kku_enrollments e ON e.enrollment_id = ec.enrollment_id AND e.deleted_at IS NULL
		WHERE ` + where + `
		GROUP BY sc.cohort_id, c.curriculum_id, c.code, c.name_th, c.name_en, m.major_id, m.name_th,
			fac.faculty_id, fac.name_th, sc.entry_year_be, sc.course_scores_recalculation_required
		ORDER BY sc.entry_year_be DESC, c.code`
	rows, err := r.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]models.ExecutiveCohortSummary, 0)
	for rows.Next() {
		var item models.ExecutiveCohortSummary
		var hasTemplate, hasRequirements, hasScores, recalc int
		if err := rows.Scan(&item.CohortID, &item.CurriculumID, &item.CurriculumCode, &item.CurriculumNameTH, &item.CurriculumNameEN,
			&item.MajorID, &item.MajorNameTH, &item.FacultyID, &item.FacultyNameTH, &item.EntryYearBE,
			&item.StudentCount, &hasTemplate, &hasRequirements, &hasScores, &recalc); err != nil {
			return nil, err
		}
		item.HasTemplate, item.HasRequirements, item.HasScores, item.RecalculationRequired = hasTemplate == 1, hasRequirements == 1, hasScores == 1, recalc == 1
		item.Ready = item.HasTemplate && item.HasRequirements && item.HasScores && !item.RecalculationRequired
		item.ReadinessCode, item.ReadinessMessageTH, item.ReadinessMessageEN = cohortReadiness(item)
		items = append(items, item)
	}
	return items, rows.Err()
}

func cohortReadiness(item models.ExecutiveCohortSummary) (string, string, string) {
	if !item.HasTemplate {
		return "NO_TEMPLATE", "ยังไม่ได้เชื่อมแบบแผนการประเมิน", "No assessment plan is connected"
	}
	if !item.HasRequirements {
		return "NO_REQUIREMENTS", "ยังไม่ได้กำหนดเกณฑ์สมรรถนะ", "Competency requirements are not configured"
	}
	if item.RecalculationRequired {
		return "RECALCULATION_REQUIRED", "มีการเปลี่ยนแปลงและยังไม่ได้คำนวณคะแนนใหม่", "Scores need to be recalculated"
	}
	if !item.HasScores {
		return "NO_SCORES", "ยังไม่มีผลคะแนนที่พร้อมใช้", "No calculated course scores are available"
	}
	return "READY", "พร้อมใช้งาน", "Ready"
}

func (r *ExecutiveAnalyticsRepository) GetAggregates(ctx context.Context, cohortIDs []uint64) ([]models.ExecutiveCompetencyAggregate, error) {
	if len(cohortIDs) == 0 {
		return []models.ExecutiveCompetencyAggregate{}, nil
	}
	args := make([]any, len(cohortIDs))
	for i, id := range cohortIDs {
		args[i] = id
	}
	query := `SELECT req.cohort_id, cohort.entry_year_be, req.competency_id, comp.code, comp.name_th, COALESCE(comp.name_en, ''), req.target_score, req.is_required,
			COUNT(DISTINCT course_score.enrollment_id),
			COALESCE(SUM(CASE WHEN course_score.enrollment_id IS NOT NULL THEN COALESCE(result.core_score, 0) + COALESCE(result.course_bonus_score, 0) ELSE 0 END), 0)
		FROM comp_curriculum_requirements req
		JOIN edu_student_cohorts cohort ON cohort.cohort_id = req.cohort_id AND cohort.deleted_at IS NULL
		JOIN comp_competencies comp ON comp.competency_id = req.competency_id AND comp.deleted_at IS NULL
		JOIN kku_enrollment_curricula roster ON roster.cohort_id = req.cohort_id AND roster.deleted_at IS NULL
		JOIN kku_enrollments student ON student.enrollment_id = roster.enrollment_id
			AND student.enrollment_status = 'student' AND student.deleted_at IS NULL
		LEFT JOIN (
			SELECT score_roster.cohort_id, score_roster.enrollment_id, course_score.competency_id
			FROM score_course_competency_scores course_score
			JOIN crs_course_enrollment course_enrollment
				ON course_enrollment.course_student_id = course_score.course_student_id
				AND course_enrollment.deleted_at IS NULL
			JOIN kku_enrollment_curricula score_roster
				ON score_roster.enrollment_curriculum_id = course_enrollment.student_curricula_id
				AND score_roster.deleted_at IS NULL
			JOIN kku_enrollments score_student
				ON score_student.enrollment_id = score_roster.enrollment_id
				AND score_student.enrollment_status = 'student'
				AND score_student.deleted_at IS NULL
			WHERE course_score.deleted_at IS NULL
			GROUP BY score_roster.cohort_id, score_roster.enrollment_id, course_score.competency_id
		) course_score ON course_score.cohort_id = req.cohort_id
			AND course_score.enrollment_id = roster.enrollment_id
			AND course_score.competency_id = req.competency_id
		LEFT JOIN score_competency_result result ON result.enrollment_id = roster.enrollment_id
			AND result.competency_id = req.competency_id AND result.deleted_at IS NULL
		WHERE req.cohort_id IN (` + executivePlaceholders(len(cohortIDs)) + `) AND req.deleted_at IS NULL
		GROUP BY req.cohort_id, cohort.entry_year_be, req.competency_id, comp.code, comp.name_th, comp.name_en, req.target_score, req.is_required`
	rows, err := r.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]models.ExecutiveCompetencyAggregate, 0)
	for rows.Next() {
		var item models.ExecutiveCompetencyAggregate
		var required int
		if err := rows.Scan(&item.CohortID, &item.EntryYearBE, &item.CompetencyID, &item.Code, &item.NameTH, &item.NameEN, &item.TargetScore,
			&required, &item.EvaluatedCount, &item.AverageScore); err != nil {
			return nil, err
		}
		item.IsRequired = required == 1
		if item.EvaluatedCount > 0 {
			item.AverageScore /= float64(item.EvaluatedCount)
		}
		items = append(items, item)
	}
	for i := range items {
		var passed int
		err := r.DB.QueryRowContext(ctx, `SELECT COUNT(*)
			FROM score_competency_result result
			JOIN kku_enrollment_curricula roster ON roster.enrollment_id = result.enrollment_id
				AND roster.cohort_id = ? AND roster.deleted_at IS NULL
			JOIN kku_enrollments student ON student.enrollment_id = roster.enrollment_id
				AND student.enrollment_status = 'student' AND student.deleted_at IS NULL
			WHERE result.competency_id = ? AND result.deleted_at IS NULL
				AND COALESCE(result.core_score, 0) + COALESCE(result.course_bonus_score, 0) >= ?`,
			items[i].CohortID, items[i].CompetencyID, items[i].TargetScore).Scan(&passed)
		if err != nil {
			return nil, err
		}
		items[i].PassedCount = passed
		if items[i].EvaluatedCount > 0 {
			items[i].PassRate = float64(passed) * 100 / float64(items[i].EvaluatedCount)
		}
	}
	return items, nil
}

func (r *ExecutiveAnalyticsRepository) GetStudentFacts(ctx context.Context, f models.ExecutiveAnalyticsFilters) ([]models.ExecutiveStudentFact, error) {
	where, args := executiveScopeWhere(f, "sc")
	competencyJoin := "LEFT JOIN comp_curriculum_requirements req ON req.cohort_id = sc.cohort_id AND req.deleted_at IS NULL"
	if f.CompetencyID != nil {
		competencyJoin += " AND req.competency_id = ?"
		args = append(args, *f.CompetencyID)
	}
	if f.EnrollmentID != nil {
		where += " AND e.enrollment_id = ?"
		args = append(args, *f.EnrollmentID)
	}
	query := `SELECT e.enrollment_id, e.student_code, CONCAT_WS(' ', p.first_name_th, p.last_name_th),
			CONCAT_WS(' ', p.first_name_en, p.last_name_en), sc.cohort_id, c.code, c.name_th, sc.entry_year_be,
			COALESCE(req.competency_id, 0), COALESCE(comp.code, ''), COALESCE(comp.name_th, ''),
			COALESCE(comp.name_en, ''), COALESCE(req.target_score, 0), COALESCE(req.is_required, 0),
			COALESCE(result.core_score, 0) + COALESCE(result.course_bonus_score, 0),
			CASE WHEN result.enrollment_id IS NULL THEN 0 ELSE 1 END
		FROM edu_student_cohorts sc
		JOIN edu_curricula c ON c.curriculum_id = sc.curriculum_id
		JOIN edu_majors m ON m.major_id = c.major_id
		JOIN org_departments d ON d.department_id = m.department_id
		JOIN org_faculties fac ON fac.faculty_id = d.faculty_id
		JOIN kku_enrollment_curricula roster ON roster.cohort_id = sc.cohort_id AND roster.deleted_at IS NULL
		JOIN kku_enrollments e ON e.enrollment_id = roster.enrollment_id
			AND e.enrollment_status = 'student' AND e.deleted_at IS NULL
		JOIN persons p ON p.person_id = e.person_id AND p.deleted_at IS NULL ` + competencyJoin + `
		LEFT JOIN comp_competencies comp ON comp.competency_id = req.competency_id AND comp.deleted_at IS NULL
		LEFT JOIN score_competency_result result ON result.enrollment_id = e.enrollment_id
			AND result.competency_id = req.competency_id AND result.deleted_at IS NULL
			AND EXISTS (
				SELECT 1
				FROM score_course_competency_scores course_score
				JOIN crs_course_enrollment course_enrollment
					ON course_enrollment.course_student_id = course_score.course_student_id
					AND course_enrollment.deleted_at IS NULL
				WHERE course_enrollment.student_curricula_id = roster.enrollment_curriculum_id
					AND course_score.competency_id = req.competency_id
					AND course_score.deleted_at IS NULL
			)
		WHERE ` + where + ` ORDER BY sc.entry_year_be, e.student_code, req.display_order`
	rows, err := r.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]models.ExecutiveStudentFact, 0)
	for rows.Next() {
		var item models.ExecutiveStudentFact
		var required, hasScore int
		if err := rows.Scan(&item.EnrollmentID, &item.StudentCode, &item.StudentNameTH, &item.StudentNameEN,
			&item.CohortID, &item.CurriculumCode, &item.CurriculumNameTH, &item.EntryYearBE,
			&item.CompetencyID, &item.CompetencyCode, &item.CompetencyNameTH, &item.CompetencyNameEN,
			&item.TargetScore, &required, &item.CourseTotal, &hasScore); err != nil {
			return nil, err
		}
		item.IsRequired, item.HasScore = required == 1, hasScore == 1
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *ExecutiveAnalyticsRepository) GetStudentCourses(ctx context.Context, cohortID, enrollmentID uint64) ([]models.ExecutiveStudentCourse, error) {
	rows, err := r.DB.QueryContext(ctx, `SELECT cce.course_student_id, cce.course_id, course.code, course.name_th, COALESCE(course.name_en, ''),
			COALESCE(cce.academic_year_be, 0), COALESCE(cce.semester, 0), COALESCE(cce.grade, ''),
			score.competency_id, COALESCE(competency.code, ''), COALESCE(competency.name_th, ''),
			COALESCE(competency.name_en, ''), COALESCE(score.weighted_score, 0)
		FROM crs_course_enrollment cce
		JOIN kku_enrollment_curricula roster ON roster.enrollment_curriculum_id = cce.student_curricula_id
			AND roster.deleted_at IS NULL
		JOIN crs_courses course ON course.course_id = cce.course_id AND course.deleted_at IS NULL
		LEFT JOIN score_course_competency_scores score ON score.course_student_id = cce.course_student_id
			AND score.deleted_at IS NULL
		LEFT JOIN comp_competencies competency ON competency.competency_id = score.competency_id
			AND competency.deleted_at IS NULL
		WHERE roster.cohort_id = ? AND roster.enrollment_id = ? AND cce.deleted_at IS NULL
		ORDER BY cce.academic_year_be, cce.semester, course.code, competency.code`, cohortID, enrollmentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.ExecutiveStudentCourse, 0)
	courseByEnrollment := make(map[uint64]int)
	for rows.Next() {
		var courseEnrollmentID uint64
		var courseID uint64
		var courseCode, courseNameTH, courseNameEN, grade string
		var academicYearBE, semester uint64
		var competencyID sql.NullInt64
		var competencyCode, competencyNameTH, competencyNameEN string
		var weightedScore float64
		if err := rows.Scan(
			&courseEnrollmentID,
			&courseID,
			&courseCode,
			&courseNameTH,
			&courseNameEN,
			&academicYearBE,
			&semester,
			&grade,
			&competencyID,
			&competencyCode,
			&competencyNameTH,
			&competencyNameEN,
			&weightedScore,
		); err != nil {
			return nil, err
		}
		index, exists := courseByEnrollment[courseEnrollmentID]
		if !exists {
			items = append(items, models.ExecutiveStudentCourse{
				CourseID:       courseID,
				CourseCode:     courseCode,
				CourseNameTH:   courseNameTH,
				CourseNameEN:   courseNameEN,
				AcademicYearBE: academicYearBE,
				Semester:       semester,
				Grade:          grade,
				Competencies:   make([]models.ExecutiveStudentCourseCompetency, 0),
			})
			index = len(items) - 1
			courseByEnrollment[courseEnrollmentID] = index
		}
		if competencyID.Valid {
			items[index].Competencies = append(items[index].Competencies, models.ExecutiveStudentCourseCompetency{
				CompetencyID:     uint64(competencyID.Int64),
				CompetencyCode:   competencyCode,
				CompetencyNameTH: competencyNameTH,
				CompetencyNameEN: competencyNameEN,
				Score:            weightedScore,
			})
		}
	}
	return items, rows.Err()
}

func (r *ExecutiveAnalyticsRepository) GetCourseSources(ctx context.Context, cohortIDs []uint64, competencyID uint64, enrollmentID *uint64) ([]models.ExecutiveCourseSource, error) {
	if len(cohortIDs) == 0 {
		return []models.ExecutiveCourseSource{}, nil
	}
	args := make([]any, 0, len(cohortIDs)+2)
	for _, id := range cohortIDs {
		args = append(args, id)
	}
	args = append(args, competencyID)
	studentFilter := ""
	if enrollmentID != nil {
		studentFilter = " AND roster.enrollment_id = ?"
		args = append(args, *enrollmentID)
	}
	query := `SELECT roster.cohort_id, cce.course_id, course.code, course.name_th, COALESCE(course.name_en, ''),
			COALESCE(score.template_id, 0), COALESCE(tpl.name, ''), COALESCE(SUM(score.weighted_score), 0),
			COUNT(DISTINCT roster.enrollment_id)
		FROM score_course_competency_scores score
		JOIN crs_course_enrollment cce ON cce.course_student_id = score.course_student_id AND cce.deleted_at IS NULL
		JOIN kku_enrollment_curricula roster ON roster.enrollment_curriculum_id = cce.student_curricula_id AND roster.deleted_at IS NULL
		JOIN kku_enrollments student ON student.enrollment_id = roster.enrollment_id
			AND student.enrollment_status = 'student' AND student.deleted_at IS NULL
		JOIN crs_courses course ON course.course_id = cce.course_id AND course.deleted_at IS NULL
		LEFT JOIN comp_templates tpl ON tpl.template_id = score.template_id AND tpl.deleted_at IS NULL
		WHERE roster.cohort_id IN (` + executivePlaceholders(len(cohortIDs)) + `)
			AND score.competency_id = ? AND score.deleted_at IS NULL` + studentFilter + `
		GROUP BY roster.cohort_id, cce.course_id, course.code, course.name_th, course.name_en, score.template_id, tpl.name
		ORDER BY roster.cohort_id, course.code`
	rows, err := r.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]models.ExecutiveCourseSource, 0)
	for rows.Next() {
		var item models.ExecutiveCourseSource
		if err := rows.Scan(&item.CohortID, &item.CourseID, &item.CourseCode, &item.CourseNameTH, &item.CourseNameEN,
			&item.TemplateID, &item.TemplateName, &item.Contribution, &item.StudentCount); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
