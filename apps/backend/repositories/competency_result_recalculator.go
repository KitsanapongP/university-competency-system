package repositories

import (
	"context"
	"database/sql"
	"fmt"
)

func recomputeCompetencyResultsTx(ctx context.Context, tx *sql.Tx, cohortID uint64) error {
	_, err := tx.ExecContext(ctx, `
		INSERT INTO score_competency_result (enrollment_id, competency_id, core_score, course_bonus_score, activity_score, final_score, created_at, updated_at)
		SELECT roster.enrollment_id, requirement.competency_id,
			COALESCE(SUM(CASE WHEN score.score_type_snapshot = 'core' THEN score.weighted_score ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN score.score_type_snapshot = 'bonus' THEN score.weighted_score ELSE 0 END), 0),
			COALESCE(activity.activity_score, 0),
			COALESCE(SUM(score.weighted_score), 0) + COALESCE(activity.activity_score, 0), NOW(), NOW()
		FROM kku_enrollment_curricula roster
		JOIN comp_curriculum_requirements requirement ON requirement.cohort_id = roster.cohort_id AND requirement.deleted_at IS NULL
		LEFT JOIN crs_course_enrollment courseEnrollment ON courseEnrollment.enrollment_id = roster.enrollment_id AND courseEnrollment.student_curricula_id = roster.enrollment_curriculum_id AND courseEnrollment.deleted_at IS NULL
		LEFT JOIN score_course_competency_scores score ON score.course_student_id = courseEnrollment.course_student_id AND score.competency_id = requirement.competency_id AND score.deleted_at IS NULL
		LEFT JOIN (
			SELECT enrollmentCurriculum.cohort_id, enrollment.enrollment_id, sessionComp.competency_id, SUM(sessionResult.earned_percent) AS activity_score
			FROM score_session_competency_results sessionResult
			JOIN score_session_competency_scores sessionScore ON sessionScore.session_competency_score_id = sessionResult.score_id AND sessionScore.deleted_at IS NULL
			JOIN act_session_competencies sessionComp ON sessionComp.session_competency_id = sessionScore.session_competency_id AND sessionComp.deleted_at IS NULL
			JOIN kku_enrollments enrollment ON enrollment.person_id = sessionScore.person_id AND enrollment.deleted_at IS NULL
			JOIN kku_enrollment_curricula enrollmentCurriculum ON enrollmentCurriculum.enrollment_id = enrollment.enrollment_id AND enrollmentCurriculum.deleted_at IS NULL
			WHERE sessionResult.deleted_at IS NULL
			GROUP BY enrollmentCurriculum.cohort_id, enrollment.enrollment_id, sessionComp.competency_id
		) activity ON activity.cohort_id = roster.cohort_id AND activity.enrollment_id = roster.enrollment_id AND activity.competency_id = requirement.competency_id
		WHERE roster.cohort_id = ? AND roster.deleted_at IS NULL
		GROUP BY roster.enrollment_id, requirement.competency_id, activity.activity_score
		ON DUPLICATE KEY UPDATE core_score=VALUES(core_score), course_bonus_score=VALUES(course_bonus_score), activity_score=VALUES(activity_score), final_score=VALUES(final_score), deleted_at=NULL, updated_at=NOW()`, cohortID)
	if err != nil {
		return fmt.Errorf("recompute competency results: %w", err)
	}
	return nil
}
