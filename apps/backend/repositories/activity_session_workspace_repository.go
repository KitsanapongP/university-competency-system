package repositories

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/spw32767/university-competency-system-backend/models"
)

type ActivitySessionWorkspaceRepository struct {
	DB *sql.DB
}

type SessionAssignmentPermission struct {
	CanRecordAttendance bool
	CanGrade            bool
	CanFinalize         bool
}

type StoredSessionScore struct {
	SessionCompetencyID uint64
	PersonID            uint64
	RawScore            *float64
	FinalScore          *float64
	Notes               *string
	GradingSource       string
	IsLocked            bool
}

func NewActivitySessionWorkspaceRepository(db *sql.DB) *ActivitySessionWorkspaceRepository {
	return &ActivitySessionWorkspaceRepository{DB: db}
}

func (r *ActivitySessionWorkspaceRepository) GetAssignmentPermission(ctx context.Context, sessionID uint64, userID int64) (*SessionAssignmentPermission, error) {
	var permission SessionAssignmentPermission
	err := r.DB.QueryRowContext(ctx, `
		SELECT can_record_attendance, can_grade, can_finalize
		FROM act_session_assignments
		WHERE session_id = ? AND user_id = ? AND deleted_at IS NULL
		LIMIT 1
	`, sessionID, userID).Scan(&permission.CanRecordAttendance, &permission.CanGrade, &permission.CanFinalize)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &permission, nil
}

func (r *ActivitySessionWorkspaceRepository) GetMyAssignedSessionIDs(ctx context.Context, userID int64) ([]uint64, error) {
	rows, err := r.DB.QueryContext(ctx, `
		SELECT DISTINCT asa.session_id
		FROM act_session_assignments asa
		JOIN act_sessions s ON s.session_id = asa.session_id
		JOIN act_activities a ON a.activity_id = s.activity_id
		WHERE asa.user_id = ?
			AND asa.deleted_at IS NULL
			AND s.deleted_at IS NULL
			AND a.deleted_at IS NULL
		ORDER BY s.start_at DESC, s.session_id DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ids := make([]uint64, 0)
	for rows.Next() {
		var id uint64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func (r *ActivitySessionWorkspaceRepository) GetParticipants(ctx context.Context, sessionID uint64, facultyID uint64) ([]*models.ActivitySessionParticipant, error) {
	rows, err := r.DB.QueryContext(ctx, `
		SELECT
			roster.person_id,
			e.enrollment_id,
			COALESCE(e.student_code, ''),
			TRIM(CONCAT_WS(' ', p.prefix_th, p.first_name_th, p.last_name_th)),
			TRIM(CONCAT_WS(' ', p.first_name_en, p.last_name_en)),
			rg.status,
			rg.source,
			att.status,
			att.checkin_at,
			att.checkout_at,
			att.notes,
			CASE WHEN att.session_attendance_id IS NULL THEN 0 ELSE 1 END
		FROM (
			SELECT person_id
			FROM act_session_registrations
			WHERE session_id = ? AND status = 'approved' AND deleted_at IS NULL
			UNION
			SELECT person_id
			FROM att_session_attendances
			WHERE session_id = ? AND deleted_at IS NULL
		) roster
		JOIN persons p ON p.person_id = roster.person_id AND p.deleted_at IS NULL
		LEFT JOIN act_session_registrations rg
			ON rg.session_id = ? AND rg.person_id = roster.person_id AND rg.deleted_at IS NULL
		LEFT JOIN att_session_attendances att
			ON att.session_id = ? AND att.person_id = roster.person_id AND att.deleted_at IS NULL
		LEFT JOIN kku_enrollments e
			ON e.enrollment_id = (
				SELECT e2.enrollment_id
				FROM kku_enrollments e2
				WHERE e2.person_id = roster.person_id
					AND e2.faculty_id = ?
					AND e2.enrollment_status = 'student'
					AND e2.is_kku_student = 1
					AND e2.deleted_at IS NULL
				ORDER BY e2.enrollment_id ASC
				LIMIT 1
			)
		ORDER BY p.first_name_th ASC, p.last_name_th ASC, roster.person_id ASC
	`, sessionID, sessionID, sessionID, sessionID, facultyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	participants := make([]*models.ActivitySessionParticipant, 0)
	for rows.Next() {
		item, err := scanActivitySessionParticipant(rows)
		if err != nil {
			return nil, err
		}
		participants = append(participants, item)
	}
	return participants, rows.Err()
}

func (r *ActivitySessionWorkspaceRepository) SearchWalkInCandidates(ctx context.Context, facultyID uint64, query string) ([]*models.WalkInCandidate, error) {
	query = strings.TrimSpace(query)
	rows, err := r.DB.QueryContext(ctx, `
		SELECT e.person_id, e.enrollment_id, COALESCE(e.student_code, ''),
			TRIM(CONCAT_WS(' ', p.prefix_th, p.first_name_th, p.last_name_th)),
			TRIM(CONCAT_WS(' ', p.first_name_en, p.last_name_en))
		FROM kku_enrollments e
		JOIN persons p ON p.person_id = e.person_id
		WHERE e.faculty_id = ?
			AND e.enrollment_status = 'student'
			AND e.is_kku_student = 1
			AND e.deleted_at IS NULL
			AND p.deleted_at IS NULL
			AND (?, '' = '' OR e.student_code LIKE CONCAT('%', ?, '%')
				OR p.first_name_th LIKE CONCAT('%', ?, '%')
				OR p.last_name_th LIKE CONCAT('%', ?, '%')
				OR p.first_name_en LIKE CONCAT('%', ?, '%')
				OR p.last_name_en LIKE CONCAT('%', ?, '%'))
		ORDER BY p.first_name_th ASC, p.last_name_th ASC
		LIMIT 30
	`, facultyID, query, query, query, query, query, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]*models.WalkInCandidate, 0)
	for rows.Next() {
		item := &models.WalkInCandidate{}
		if err := rows.Scan(&item.PersonID, &item.EnrollmentID, &item.StudentCode, &item.NameTH, &item.NameEN); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *ActivitySessionWorkspaceRepository) IsActiveStudentInFaculty(ctx context.Context, personID, facultyID uint64) (bool, error) {
	var found int
	err := r.DB.QueryRowContext(ctx, `
		SELECT 1 FROM kku_enrollments
		WHERE person_id = ? AND faculty_id = ?
			AND enrollment_status = 'student' AND is_kku_student = 1 AND deleted_at IS NULL
		LIMIT 1
	`, personID, facultyID).Scan(&found)
	if err == sql.ErrNoRows {
		return false, nil
	}
	return found == 1, err
}

func (r *ActivitySessionWorkspaceRepository) AddWalkIn(ctx context.Context, sessionID, personID uint64, status string, checkinAt time.Time, notes *string, userID int64) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(ctx, `
		INSERT INTO act_session_registrations (session_id, person_id, status, approved_by, approved_at, source, created_by)
		VALUES (?, ?, 'approved', ?, NOW(), 'officer', ?)
		ON DUPLICATE KEY UPDATE status = 'approved', approved_by = VALUES(approved_by), approved_at = NOW(),
			source = 'officer', created_by = VALUES(created_by), deleted_at = NULL, updated_at = NOW()
	`, sessionID, personID, userID, userID)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `
		INSERT INTO att_session_attendances (session_id, person_id, status, checkin_at, checkin_method, notes, recorded_by)
		VALUES (?, ?, ?, ?, 'manual', ?, ?)
		ON DUPLICATE KEY UPDATE status = VALUES(status), checkin_at = VALUES(checkin_at), checkin_method = 'manual',
			checkout_at = NULL, checkout_method = NULL, notes = VALUES(notes), recorded_by = VALUES(recorded_by), deleted_at = NULL, updated_at = NOW()
	`, sessionID, personID, status, checkinAt, notes, userID)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (r *ActivitySessionWorkspaceRepository) UpsertAttendance(ctx context.Context, sessionID, personID uint64, status string, checkinAt, checkoutAt *time.Time, notes *string, userID int64) error {
	_, err := r.DB.ExecContext(ctx, `
		INSERT INTO att_session_attendances (
			session_id, person_id, status, checkin_at, checkout_at, checkin_method, checkout_method, notes, recorded_by
		) VALUES (?, ?, ?, ?, ?,
			CASE WHEN ? IS NULL THEN NULL ELSE 'manual' END,
			CASE WHEN ? IS NULL THEN NULL ELSE 'manual' END, ?, ?)
		ON DUPLICATE KEY UPDATE status = VALUES(status), checkin_at = VALUES(checkin_at), checkout_at = VALUES(checkout_at),
			checkin_method = VALUES(checkin_method), checkout_method = VALUES(checkout_method), notes = VALUES(notes),
			recorded_by = VALUES(recorded_by), deleted_at = NULL, updated_at = NOW()
	`, sessionID, personID, status, checkinAt, checkoutAt, checkinAt, checkoutAt, notes, userID)
	return err
}

func (r *ActivitySessionWorkspaceRepository) MarkUnrecordedAbsent(ctx context.Context, sessionID uint64, userID int64) (int64, error) {
	result, err := r.DB.ExecContext(ctx, `
		INSERT INTO att_session_attendances (session_id, person_id, status, notes, recorded_by)
		SELECT rg.session_id, rg.person_id, 'absent', 'Marked absent after session completion', ?
		FROM act_session_registrations rg
		LEFT JOIN att_session_attendances att
			ON att.session_id = rg.session_id AND att.person_id = rg.person_id AND att.deleted_at IS NULL
		WHERE rg.session_id = ? AND rg.status = 'approved' AND rg.deleted_at IS NULL
			AND att.session_attendance_id IS NULL
	`, userID, sessionID)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

func (r *ActivitySessionWorkspaceRepository) GetStoredScores(ctx context.Context, sessionID uint64) ([]StoredSessionScore, error) {
	rows, err := r.DB.QueryContext(ctx, `
		SELECT scs.session_competency_id, scs.person_id, scs.raw_score, scs.final_score, scs.notes, scs.grading_source, scs.is_locked
		FROM score_session_competency_scores scs
		JOIN act_session_competencies ascx ON ascx.session_competency_id = scs.session_competency_id
		WHERE ascx.session_id = ? AND ascx.deleted_at IS NULL AND scs.deleted_at IS NULL
	`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]StoredSessionScore, 0)
	for rows.Next() {
		var item StoredSessionScore
		var raw, final sql.NullFloat64
		var notes sql.NullString
		if err := rows.Scan(&item.SessionCompetencyID, &item.PersonID, &raw, &final, &notes, &item.GradingSource, &item.IsLocked); err != nil {
			return nil, err
		}
		if raw.Valid {
			item.RawScore = &raw.Float64
		}
		if final.Valid {
			item.FinalScore = &final.Float64
		}
		if notes.Valid {
			item.Notes = &notes.String
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *ActivitySessionWorkspaceRepository) SaveScores(ctx context.Context, sessionID uint64, entries []models.UpsertSessionScorePayload, maxRawScore, penaltyFactor float64, attendance map[uint64]string, source string, userID int64) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, item := range entries {
		status := attendance[item.PersonID]
		penalty := 1.0
		if status == "late" {
			penalty = penaltyFactor
		}
		var final any
		if item.RawScore != nil {
			final = *item.RawScore * penalty
		}
		_, err := tx.ExecContext(ctx, `
			INSERT INTO score_session_competency_scores (
				session_competency_id, person_id, grading_source, raw_score, max_raw_score_snapshot,
				attendance_status_snapshot, penalty_factor_snapshot, final_score, graded_by, graded_at, notes
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
			ON DUPLICATE KEY UPDATE grading_source = VALUES(grading_source), raw_score = VALUES(raw_score),
				max_raw_score_snapshot = VALUES(max_raw_score_snapshot), attendance_status_snapshot = VALUES(attendance_status_snapshot),
				penalty_factor_snapshot = VALUES(penalty_factor_snapshot), final_score = VALUES(final_score), graded_by = VALUES(graded_by),
				graded_at = NOW(), notes = VALUES(notes), deleted_at = NULL, updated_at = NOW()
		`, item.SessionCompetencyID, item.PersonID, source, item.RawScore, maxRawScore, status, penalty, final, userID, item.Notes)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *ActivitySessionWorkspaceRepository) UpsertAttendanceOnlyScores(ctx context.Context, session *models.ActivitySession, participants []*models.ActivitySessionParticipant, userID int64) error {
	entries := make([]models.UpsertSessionScorePayload, 0)
	for _, participant := range participants {
		if !participant.EligibleForScoring {
			continue
		}
		for _, competency := range session.Competencies {
			raw := session.MaxRawScore
			entries = append(entries, models.UpsertSessionScorePayload{PersonID: participant.PersonID, SessionCompetencyID: competency.SessionCompetencyID, RawScore: &raw})
		}
	}
	attendance := make(map[uint64]string, len(participants))
	for _, participant := range participants {
		if participant.AttendanceStatus != nil {
			attendance[participant.PersonID] = *participant.AttendanceStatus
		}
	}
	return r.SaveScores(ctx, session.SessionID, entries, session.MaxRawScore, session.LatePenaltyFactor, attendance, "attendance", userID)
}

func (r *ActivitySessionWorkspaceRepository) GetExactActiveEnrollmentID(ctx context.Context, personID, facultyID uint64) (*uint64, error) {
	rows, err := r.DB.QueryContext(ctx, `
		SELECT enrollment_id FROM kku_enrollments
		WHERE person_id = ? AND faculty_id = ? AND enrollment_status = 'student'
			AND is_kku_student = 1 AND deleted_at IS NULL
	`, personID, facultyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	ids := make([]uint64, 0, 2)
	for rows.Next() {
		var id uint64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(ids) != 1 {
		return nil, nil
	}
	return &ids[0], nil
}

func (r *ActivitySessionWorkspaceRepository) FinalizeScores(ctx context.Context, session *models.ActivitySession, participants []*models.ActivitySessionParticipant, enrollmentIDs map[uint64]uint64, userID int64) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// A correction can turn a previously eligible attendee into absent/excused.
	// Remove that session's old contribution before rebuilding the aggregate.
	for _, participant := range participants {
		if participant.EligibleForScoring {
			continue
		}
		if _, err := tx.ExecContext(ctx, `
			UPDATE score_session_competency_results scr
			JOIN score_session_competency_scores scs ON scs.session_competency_score_id = scr.score_id
			JOIN act_session_competencies ascx ON ascx.session_competency_id = scs.session_competency_id
			SET scr.deleted_at = NOW(), scr.updated_at = NOW()
			WHERE ascx.session_id = ? AND scs.person_id = ? AND ascx.deleted_at IS NULL AND scr.deleted_at IS NULL
		`, session.SessionID, participant.PersonID); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `
			UPDATE score_session_competency_scores scs
			JOIN act_session_competencies ascx ON ascx.session_competency_id = scs.session_competency_id
			SET scs.deleted_at = NOW(), scs.updated_at = NOW()
			WHERE ascx.session_id = ? AND scs.person_id = ? AND ascx.deleted_at IS NULL AND scs.deleted_at IS NULL
		`, session.SessionID, participant.PersonID); err != nil {
			return err
		}
	}

	for _, participant := range participants {
		if !participant.EligibleForScoring {
			continue
		}
		for _, competency := range session.Competencies {
			var scoreID uint64
			var raw float64
			var final float64
			var attendanceStatus string
			err := tx.QueryRowContext(ctx, `
				SELECT session_competency_score_id, raw_score, final_score, attendance_status_snapshot
				FROM score_session_competency_scores
				WHERE session_competency_id = ? AND person_id = ? AND deleted_at IS NULL
			`, competency.SessionCompetencyID, participant.PersonID).Scan(&scoreID, &raw, &final, &attendanceStatus)
			if err != nil {
				return err
			}
			factor := final / session.MaxRawScore
			earned := factor * competency.MaxPercent
			if _, err := tx.ExecContext(ctx, `
				INSERT INTO score_session_competency_results (score_id, max_percent_snapshot, factor_snapshot, earned_percent, computed_by, computed_at, is_locked, locked_at)
				VALUES (?, ?, ?, ?, ?, NOW(), 1, NOW())
				ON DUPLICATE KEY UPDATE max_percent_snapshot = VALUES(max_percent_snapshot), factor_snapshot = VALUES(factor_snapshot),
					earned_percent = VALUES(earned_percent), computed_by = VALUES(computed_by), computed_at = NOW(), is_locked = 1, locked_at = NOW(), deleted_at = NULL
			`, scoreID, competency.MaxPercent, factor, earned, userID); err != nil {
				return err
			}
			if _, err := tx.ExecContext(ctx, `UPDATE score_session_competency_scores SET is_locked = 1, locked_at = NOW(), updated_at = NOW() WHERE session_competency_score_id = ?`, scoreID); err != nil {
				return err
			}
		}
	}

	for personID, enrollmentID := range enrollmentIDs {
		for _, competency := range session.Competencies {
			var sessionTotal float64
			if err := tx.QueryRowContext(ctx, `
				SELECT COALESCE(SUM(scr.earned_percent), 0)
				FROM score_session_competency_results scr
				JOIN score_session_competency_scores scs ON scs.session_competency_score_id = scr.score_id
				JOIN act_session_competencies ascx ON ascx.session_competency_id = scs.session_competency_id
				JOIN act_sessions sx ON sx.session_id = ascx.session_id
				WHERE scs.person_id = ? AND ascx.competency_id = ? AND sx.deleted_at IS NULL
					AND scs.deleted_at IS NULL AND scr.deleted_at IS NULL AND ascx.deleted_at IS NULL
			`, personID, competency.CompetencyID).Scan(&sessionTotal); err != nil {
				return err
			}
			var courseTotal float64
			if err := tx.QueryRowContext(ctx, `
				SELECT COALESCE(SUM(sccs.weighted_score), 0)
				FROM score_course_competency_scores sccs
				JOIN crs_course_enrollment cce ON cce.course_student_id = sccs.course_student_id
				WHERE cce.enrollment_id = ? AND sccs.competency_id = ?
					AND cce.deleted_at IS NULL AND sccs.deleted_at IS NULL
			`, enrollmentID, competency.CompetencyID).Scan(&courseTotal); err != nil {
				return err
			}
			if _, err := tx.ExecContext(ctx, `
				INSERT INTO score_competency_result (enrollment_id, competency_id, final_score)
				VALUES (?, ?, ?)
				ON DUPLICATE KEY UPDATE final_score = VALUES(final_score), deleted_at = NULL, updated_at = NOW()
			`, enrollmentID, competency.CompetencyID, courseTotal+sessionTotal); err != nil {
				return err
			}
		}
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE act_sessions
		SET scores_finalized_at = NOW(), scores_finalized_by = ?, scores_recalculation_required = 0, updated_at = NOW()
		WHERE session_id = ? AND deleted_at IS NULL
	`, userID, session.SessionID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE score_session_correction_logs
		SET resolved_at = NOW(), resolved_by = ?
		WHERE session_id = ? AND resolved_at IS NULL
	`, userID, session.SessionID); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *ActivitySessionWorkspaceRepository) OpenCorrection(ctx context.Context, sessionID uint64, reason string, userID int64) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var finalizedAt sql.NullTime
	var finalizedBy sql.NullInt64
	if err := tx.QueryRowContext(ctx, `SELECT scores_finalized_at, scores_finalized_by FROM act_sessions WHERE session_id = ? AND deleted_at IS NULL FOR UPDATE`, sessionID).Scan(&finalizedAt, &finalizedBy); err != nil {
		return err
	}
	var at any
	var by any
	if finalizedAt.Valid {
		at = finalizedAt.Time
	}
	if finalizedBy.Valid {
		by = finalizedBy.Int64
	}
	_, err = tx.ExecContext(ctx, `
		INSERT INTO score_session_correction_logs (session_id, reason, previous_scores_finalized_at, previous_scores_finalized_by, opened_by)
		VALUES (?, ?, ?, ?, ?)
	`, sessionID, reason, at, by, userID)
	if err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE act_sessions SET scores_recalculation_required = 1, updated_at = NOW() WHERE session_id = ?`, sessionID); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `
		UPDATE score_session_competency_scores scs
		JOIN act_session_competencies ascx ON ascx.session_competency_id = scs.session_competency_id
		SET scs.is_locked = 0, scs.locked_at = NULL, scs.updated_at = NOW()
		WHERE ascx.session_id = ? AND ascx.deleted_at IS NULL AND scs.deleted_at IS NULL
	`, sessionID); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `
		UPDATE score_session_competency_results scr
		JOIN score_session_competency_scores scs ON scs.session_competency_score_id = scr.score_id
		JOIN act_session_competencies ascx ON ascx.session_competency_id = scs.session_competency_id
		SET scr.is_locked = 0, scr.locked_at = NULL, scr.updated_at = NOW()
		WHERE ascx.session_id = ? AND ascx.deleted_at IS NULL AND scs.deleted_at IS NULL AND scr.deleted_at IS NULL
	`, sessionID); err != nil {
		return err
	}
	return tx.Commit()
}

func scanActivitySessionParticipant(scanner interface{ Scan(dest ...any) error }) (*models.ActivitySessionParticipant, error) {
	var item models.ActivitySessionParticipant
	var enrollmentID sql.NullInt64
	var registrationStatus, registrationSource, attendanceStatus sql.NullString
	var checkinAt, checkoutAt sql.NullTime
	var notes sql.NullString
	if err := scanner.Scan(&item.PersonID, &enrollmentID, &item.StudentCode, &item.NameTH, &item.NameEN,
		&registrationStatus, &registrationSource, &attendanceStatus, &checkinAt, &checkoutAt, &notes, &item.AttendanceRecorded); err != nil {
		return nil, err
	}
	if enrollmentID.Valid {
		value := uint64(enrollmentID.Int64)
		item.EnrollmentID = &value
	}
	if registrationStatus.Valid {
		item.RegistrationStatus = &registrationStatus.String
	}
	if registrationSource.Valid {
		item.RegistrationSource = &registrationSource.String
	}
	if attendanceStatus.Valid {
		item.AttendanceStatus = &attendanceStatus.String
	}
	if checkinAt.Valid {
		item.CheckinAt = &checkinAt.Time
	}
	if checkoutAt.Valid {
		item.CheckoutAt = &checkoutAt.Time
	}
	if notes.Valid {
		item.AttendanceNotes = &notes.String
	}
	return &item, nil
}

func formatParticipantName(participant *models.ActivitySessionParticipant) string {
	if participant.StudentCode != "" {
		return fmt.Sprintf("%s (%s)", participant.NameTH, participant.StudentCode)
	}
	return participant.NameTH
}
