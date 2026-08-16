package repositories

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/spw32767/university-competency-system-backend/models"
)

type ActivitySessionRepository struct {
	DB *sql.DB
}

func NewActivitySessionRepository(db *sql.DB) *ActivitySessionRepository {
	return &ActivitySessionRepository{DB: db}
}

func (r *ActivitySessionRepository) GetSessionsByActivity(ctx context.Context, activityID uint64) ([]*models.ActivitySession, error) {
	rows, err := r.DB.QueryContext(ctx, activitySessionSelectQuery(`
		WHERE s.activity_id = ?
			AND s.deleted_at IS NULL
			AND a.deleted_at IS NULL
		ORDER BY s.session_no ASC, s.session_id ASC
	`), activityID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sessions := make([]*models.ActivitySession, 0)
	for rows.Next() {
		session, err := scanActivitySession(rows)
		if err != nil {
			return nil, err
		}
		sessions = append(sessions, session)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return sessions, nil
}

func (r *ActivitySessionRepository) GetSessionByID(ctx context.Context, sessionID uint64) (*models.ActivitySession, error) {
	session, err := scanActivitySession(r.DB.QueryRowContext(ctx, activitySessionSelectQuery(`
		WHERE s.session_id = ?
			AND s.deleted_at IS NULL
			AND a.deleted_at IS NULL
	`), sessionID))
	if err != nil {
		return nil, err
	}

	assignments, err := r.GetAssignmentsBySession(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	competencies, err := r.GetCompetenciesBySession(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	session.Assignments = assignments
	session.Competencies = competencies
	return session, nil
}

func (r *ActivitySessionRepository) CreateSession(ctx context.Context, activityID uint64, data models.ActivitySessionData) (*models.ActivitySession, error) {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var nextSessionNo uint
	if err := tx.QueryRowContext(ctx, `
		SELECT COALESCE(MAX(session_no), 0) + 1
		FROM act_sessions
		WHERE activity_id = ?
	`, activityID).Scan(&nextSessionNo); err != nil {
		return nil, err
	}

	result, err := tx.ExecContext(ctx, `
		INSERT INTO act_sessions (
			activity_id,
			session_no,
			start_at,
			end_at,
			timezone,
			location_name,
			location_detail,
			latitude,
			longitude,
			capacity,
			registration_required,
			grading_mode,
			max_raw_score,
			pass_threshold,
			late_grace_minutes,
			late_penalty_factor,
			require_checkout,
			min_attendance_minutes,
			status,
			is_setup_finalized,
			scores_recalculation_required
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', 0, 0)
	`, activityID, nextSessionNo, data.StartAt, data.EndAt, data.Timezone, data.LocationName, data.LocationDetail,
		data.Latitude, data.Longitude, data.Capacity, data.RegistrationRequired, data.GradingMode, data.MaxRawScore,
		data.PassThreshold, data.LateGraceMinutes, data.LatePenaltyFactor, data.RequireCheckout, data.MinAttendanceMinutes)
	if err != nil {
		return nil, err
	}

	sessionID, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return r.GetSessionByID(ctx, uint64(sessionID))
}

func (r *ActivitySessionRepository) UpdateSession(ctx context.Context, sessionID uint64, data models.ActivitySessionData) (*models.ActivitySession, error) {
	result, err := r.DB.ExecContext(ctx, `
		UPDATE act_sessions
		SET start_at = ?,
			end_at = ?,
			timezone = ?,
			location_name = ?,
			location_detail = ?,
			latitude = ?,
			longitude = ?,
			capacity = ?,
			registration_required = ?,
			grading_mode = ?,
			max_raw_score = ?,
			pass_threshold = ?,
			late_grace_minutes = ?,
			late_penalty_factor = ?,
			require_checkout = ?,
			min_attendance_minutes = ?,
			updated_at = NOW()
		WHERE session_id = ?
			AND deleted_at IS NULL
	`, data.StartAt, data.EndAt, data.Timezone, data.LocationName, data.LocationDetail, data.Latitude, data.Longitude,
		data.Capacity, data.RegistrationRequired, data.GradingMode, data.MaxRawScore, data.PassThreshold,
		data.LateGraceMinutes, data.LatePenaltyFactor, data.RequireCheckout, data.MinAttendanceMinutes, sessionID)
	if err != nil {
		return nil, err
	}
	if err := ensureAffected(result); err != nil {
		return nil, err
	}
	return r.GetSessionByID(ctx, sessionID)
}

func (r *ActivitySessionRepository) UpdateSessionStatus(ctx context.Context, sessionID uint64, status string) (*models.ActivitySession, error) {
	result, err := r.DB.ExecContext(ctx, `
		UPDATE act_sessions
		SET status = ?,
			updated_at = NOW()
		WHERE session_id = ?
			AND deleted_at IS NULL
	`, status, sessionID)
	if err != nil {
		return nil, err
	}
	if err := ensureAffected(result); err != nil {
		return nil, err
	}
	return r.GetSessionByID(ctx, sessionID)
}

func (r *ActivitySessionRepository) FinalizeSession(ctx context.Context, sessionID uint64, userID int64) (*models.ActivitySession, error) {
	result, err := r.DB.ExecContext(ctx, `
		UPDATE act_sessions
		SET is_setup_finalized = 1,
			setup_finalized_at = NOW(),
			setup_finalized_by = ?,
			updated_at = NOW()
		WHERE session_id = ?
			AND deleted_at IS NULL
	`, userID, sessionID)
	if err != nil {
		return nil, err
	}
	if err := ensureAffected(result); err != nil {
		return nil, err
	}
	return r.GetSessionByID(ctx, sessionID)
}

func (r *ActivitySessionRepository) SoftDeleteSession(ctx context.Context, sessionID uint64) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `
		UPDATE act_session_assignments
		SET deleted_at = NOW(), updated_at = NOW()
		WHERE session_id = ?
			AND deleted_at IS NULL
	`, sessionID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE act_session_competencies
		SET deleted_at = NOW(), updated_at = NOW()
		WHERE session_id = ?
			AND deleted_at IS NULL
	`, sessionID); err != nil {
		return err
	}
	result, err := tx.ExecContext(ctx, `
		UPDATE act_sessions
		SET deleted_at = NOW(), updated_at = NOW()
		WHERE session_id = ?
			AND deleted_at IS NULL
	`, sessionID)
	if err != nil {
		return err
	}
	if err := ensureAffected(result); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *ActivitySessionRepository) GetAssignmentsBySession(ctx context.Context, sessionID uint64) ([]*models.ActivitySessionAssignment, error) {
	rows, err := r.DB.QueryContext(ctx, `
		SELECT
			asa.session_assignment_id,
			asa.session_id,
			asa.user_id,
			u.display_name,
			u.email,
			u.user_type,
			u.faculty_id,
			asa.assignment_role,
			asa.can_record_attendance,
			asa.can_grade,
			asa.can_finalize,
			asa.note,
			asa.created_by,
			asa.created_at,
			asa.updated_at
		FROM act_session_assignments asa
		JOIN auth_users u ON u.user_id = asa.user_id
		WHERE asa.session_id = ?
			AND asa.deleted_at IS NULL
			AND u.deleted_at IS NULL
		ORDER BY asa.assignment_role ASC, u.display_name ASC
	`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	assignments := make([]*models.ActivitySessionAssignment, 0)
	for rows.Next() {
		item, err := scanSessionAssignment(rows)
		if err != nil {
			return nil, err
		}
		assignments = append(assignments, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return assignments, nil
}

func (r *ActivitySessionRepository) ReplaceAssignments(ctx context.Context, sessionID uint64, assignments []models.UpsertSessionAssignmentPayload, userID int64) ([]*models.ActivitySessionAssignment, error) {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	desired := make(map[string]struct{}, len(assignments))
	for _, item := range assignments {
		desired[assignmentKey(item.UserID, item.AssignmentRole)] = struct{}{}
	}

	rows, err := tx.QueryContext(ctx, `
		SELECT user_id, assignment_role
		FROM act_session_assignments
		WHERE session_id = ?
			AND deleted_at IS NULL
	`, sessionID)
	if err != nil {
		return nil, err
	}
	activeKeys := make([]string, 0)
	for rows.Next() {
		var activeUserID uint64
		var activeRole string
		if err := rows.Scan(&activeUserID, &activeRole); err != nil {
			rows.Close()
			return nil, err
		}
		activeKeys = append(activeKeys, assignmentKey(activeUserID, activeRole))
	}
	if err := rows.Close(); err != nil {
		return nil, err
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for _, key := range activeKeys {
		if _, ok := desired[key]; ok {
			continue
		}
		userIDValue, role := splitAssignmentKey(key)
		if _, err := tx.ExecContext(ctx, `
			UPDATE act_session_assignments
			SET deleted_at = NOW(), updated_at = NOW()
			WHERE session_id = ?
				AND user_id = ?
				AND assignment_role = ?
				AND deleted_at IS NULL
		`, sessionID, userIDValue, role); err != nil {
			return nil, err
		}
	}

	for _, item := range assignments {
		_, err := tx.ExecContext(ctx, `
			INSERT INTO act_session_assignments (
				session_id,
				user_id,
				assignment_role,
				can_record_attendance,
				can_grade,
				can_finalize,
				note,
				created_by
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE
				can_record_attendance = VALUES(can_record_attendance),
				can_grade = VALUES(can_grade),
				can_finalize = VALUES(can_finalize),
				note = VALUES(note),
				created_by = VALUES(created_by),
				deleted_at = NULL,
				updated_at = NOW()
		`, sessionID, item.UserID, item.AssignmentRole, boolValue(item.CanRecordAttendance), boolValue(item.CanGrade),
			boolValue(item.CanFinalize), item.Note, userID)
		if err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return r.GetAssignmentsBySession(ctx, sessionID)
}

func (r *ActivitySessionRepository) GetCompetenciesBySession(ctx context.Context, sessionID uint64) ([]*models.ActivitySessionCompetency, error) {
	rows, err := r.DB.QueryContext(ctx, `
		SELECT
			sc.session_competency_id,
			sc.session_id,
			sc.competency_id,
			c.code,
			c.name_th,
			c.name_en,
			sc.max_percent,
			sc.created_at,
			sc.updated_at
		FROM act_session_competencies sc
		JOIN comp_competencies c ON c.competency_id = sc.competency_id
		WHERE sc.session_id = ?
			AND sc.deleted_at IS NULL
			AND c.deleted_at IS NULL
		ORDER BY c.name_th ASC, c.code ASC
	`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	competencies := make([]*models.ActivitySessionCompetency, 0)
	for rows.Next() {
		item, err := scanSessionCompetency(rows)
		if err != nil {
			return nil, err
		}
		competencies = append(competencies, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return competencies, nil
}

func (r *ActivitySessionRepository) ReplaceCompetencies(ctx context.Context, sessionID uint64, competencies []models.UpsertSessionCompetencyPayload) ([]*models.ActivitySessionCompetency, error) {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	desired := make(map[uint64]struct{}, len(competencies))
	for _, item := range competencies {
		desired[item.CompetencyID] = struct{}{}
	}

	rows, err := tx.QueryContext(ctx, `
		SELECT competency_id
		FROM act_session_competencies
		WHERE session_id = ?
			AND deleted_at IS NULL
	`, sessionID)
	if err != nil {
		return nil, err
	}
	activeIDs := make([]uint64, 0)
	for rows.Next() {
		var competencyID uint64
		if err := rows.Scan(&competencyID); err != nil {
			rows.Close()
			return nil, err
		}
		activeIDs = append(activeIDs, competencyID)
	}
	if err := rows.Close(); err != nil {
		return nil, err
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for _, competencyID := range activeIDs {
		if _, ok := desired[competencyID]; ok {
			continue
		}
		if _, err := tx.ExecContext(ctx, `
			UPDATE act_session_competencies
			SET deleted_at = NOW(), updated_at = NOW()
			WHERE session_id = ?
				AND competency_id = ?
				AND deleted_at IS NULL
		`, sessionID, competencyID); err != nil {
			return nil, err
		}
	}

	for _, item := range competencies {
		_, err := tx.ExecContext(ctx, `
			INSERT INTO act_session_competencies (
				session_id,
				competency_id,
				max_percent
			)
			VALUES (?, ?, ?)
			ON DUPLICATE KEY UPDATE
				max_percent = VALUES(max_percent),
				deleted_at = NULL,
				updated_at = NOW()
		`, sessionID, item.CompetencyID, item.MaxPercent)
		if err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return r.GetCompetenciesBySession(ctx, sessionID)
}

func (r *ActivitySessionRepository) CountRegistrationsForSession(ctx context.Context, sessionID uint64) (int, error) {
	var count int
	err := r.DB.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM act_session_registrations
		WHERE session_id = ?
			AND deleted_at IS NULL
	`, sessionID).Scan(&count)
	return count, err
}

func (r *ActivitySessionRepository) CountAttendancesForSession(ctx context.Context, sessionID uint64) (int, error) {
	var count int
	err := r.DB.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM att_session_attendances
		WHERE session_id = ?
			AND deleted_at IS NULL
	`, sessionID).Scan(&count)
	return count, err
}

func (r *ActivitySessionRepository) GetAssigneeOptions(ctx context.Context, facultyID uint64) ([]*models.SessionAssigneeOption, error) {
	rows, err := r.DB.QueryContext(ctx, `
		SELECT
			user_id,
			display_name,
			email,
			user_type,
			faculty_id
		FROM auth_users
		WHERE deleted_at IS NULL
			AND is_active = 1
			AND user_type IN ('staff', 'mixed')
			AND faculty_id = ?
		ORDER BY display_name ASC, username ASC
	`, facultyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	options := make([]*models.SessionAssigneeOption, 0)
	for rows.Next() {
		var item models.SessionAssigneeOption
		var email sql.NullString
		var userFacultyID sql.NullInt64
		if err := rows.Scan(&item.UserID, &item.DisplayName, &email, &item.UserType, &userFacultyID); err != nil {
			return nil, err
		}
		if email.Valid {
			item.Email = &email.String
		}
		if userFacultyID.Valid && userFacultyID.Int64 > 0 {
			value := uint64(userFacultyID.Int64)
			item.FacultyID = &value
		}
		options = append(options, &item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return options, nil
}

func (r *ActivitySessionRepository) UserAssignableToFaculty(ctx context.Context, userID uint64, facultyID uint64) (bool, error) {
	var exists int
	err := r.DB.QueryRowContext(ctx, `
		SELECT 1
		FROM auth_users
		WHERE user_id = ?
			AND faculty_id = ?
			AND is_active = 1
			AND user_type IN ('staff', 'mixed')
			AND deleted_at IS NULL
		LIMIT 1
	`, userID, facultyID).Scan(&exists)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return exists == 1, nil
}

func (r *ActivitySessionRepository) CompetencyActiveExists(ctx context.Context, competencyID uint64) (bool, error) {
	var exists int
	err := r.DB.QueryRowContext(ctx, `
		SELECT 1
		FROM comp_competencies
		WHERE competency_id = ?
			AND is_active = 1
			AND deleted_at IS NULL
		LIMIT 1
	`, competencyID).Scan(&exists)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return exists == 1, nil
}

func activitySessionSelectQuery(whereClause string) string {
	return `
		SELECT
			s.session_id,
			s.activity_id,
			a.code AS activity_code,
			a.name_th AS activity_name_th,
			a.status AS activity_status,
			a.faculty_id,
			s.session_no,
			s.start_at,
			s.end_at,
			s.timezone,
			s.location_name,
			s.location_detail,
			s.latitude,
			s.longitude,
			s.capacity,
			s.registration_required,
			s.grading_mode,
			s.max_raw_score,
			s.pass_threshold,
			s.late_grace_minutes,
			s.late_penalty_factor,
			s.require_checkout,
			s.min_attendance_minutes,
			s.status,
			s.is_setup_finalized,
			s.setup_finalized_at,
			s.setup_finalized_by,
			s.scores_finalized_at,
			s.scores_finalized_by,
			s.scores_recalculation_required,
			COALESCE(assign_stats.assignment_count, 0) AS assignment_count,
			COALESCE(comp_stats.competency_count, 0) AS competency_count,
			COALESCE(comp_stats.percent_total, 0) AS competency_percent_total,
			COALESCE(reg_stats.registration_count, 0) AS registration_count,
			COALESCE(att_stats.attendance_count, 0) AS attendance_count,
			s.created_at,
			s.updated_at,
			s.deleted_at
		FROM act_sessions s
		JOIN act_activities a ON a.activity_id = s.activity_id
		LEFT JOIN (
			SELECT session_id, COUNT(*) AS assignment_count
			FROM act_session_assignments
			WHERE deleted_at IS NULL
			GROUP BY session_id
		) assign_stats ON assign_stats.session_id = s.session_id
		LEFT JOIN (
			SELECT session_id, COUNT(*) AS competency_count, SUM(max_percent) AS percent_total
			FROM act_session_competencies
			WHERE deleted_at IS NULL
			GROUP BY session_id
		) comp_stats ON comp_stats.session_id = s.session_id
		LEFT JOIN (
			SELECT session_id, COUNT(*) AS registration_count
			FROM act_session_registrations
			WHERE deleted_at IS NULL
			GROUP BY session_id
		) reg_stats ON reg_stats.session_id = s.session_id
		LEFT JOIN (
			SELECT session_id, COUNT(*) AS attendance_count
			FROM att_session_attendances
			WHERE deleted_at IS NULL
			GROUP BY session_id
		) att_stats ON att_stats.session_id = s.session_id
	` + whereClause
}

func scanActivitySession(scanner interface {
	Scan(dest ...any) error
}) (*models.ActivitySession, error) {
	var session models.ActivitySession
	var locationName sql.NullString
	var locationDetail sql.NullString
	var latitude sql.NullFloat64
	var longitude sql.NullFloat64
	var capacity sql.NullInt64
	var passThreshold sql.NullFloat64
	var minAttendanceMinutes sql.NullInt64
	var setupFinalizedAt sql.NullTime
	var setupFinalizedBy sql.NullInt64
	var scoresFinalizedAt sql.NullTime
	var scoresFinalizedBy sql.NullInt64
	var deletedAt sql.NullTime

	if err := scanner.Scan(
		&session.SessionID,
		&session.ActivityID,
		&session.ActivityCode,
		&session.ActivityNameTH,
		&session.ActivityStatus,
		&session.FacultyID,
		&session.SessionNo,
		&session.StartAt,
		&session.EndAt,
		&session.Timezone,
		&locationName,
		&locationDetail,
		&latitude,
		&longitude,
		&capacity,
		&session.RegistrationRequired,
		&session.GradingMode,
		&session.MaxRawScore,
		&passThreshold,
		&session.LateGraceMinutes,
		&session.LatePenaltyFactor,
		&session.RequireCheckout,
		&minAttendanceMinutes,
		&session.Status,
		&session.IsSetupFinalized,
		&setupFinalizedAt,
		&setupFinalizedBy,
		&scoresFinalizedAt,
		&scoresFinalizedBy,
		&session.ScoresRecalculationRequired,
		&session.AssignmentCount,
		&session.CompetencyCount,
		&session.CompetencyPercentTotal,
		&session.RegistrationCount,
		&session.AttendanceCount,
		&session.CreatedAt,
		&session.UpdatedAt,
		&deletedAt,
	); err != nil {
		return nil, err
	}

	if locationName.Valid {
		session.LocationName = &locationName.String
	}
	if locationDetail.Valid {
		session.LocationDetail = &locationDetail.String
	}
	if latitude.Valid {
		session.Latitude = &latitude.Float64
	}
	if longitude.Valid {
		session.Longitude = &longitude.Float64
	}
	if capacity.Valid && capacity.Int64 >= 0 {
		value := uint(capacity.Int64)
		session.Capacity = &value
	}
	if passThreshold.Valid {
		session.PassThreshold = &passThreshold.Float64
	}
	if minAttendanceMinutes.Valid && minAttendanceMinutes.Int64 >= 0 {
		value := uint(minAttendanceMinutes.Int64)
		session.MinAttendanceMinutes = &value
	}
	if setupFinalizedAt.Valid {
		session.SetupFinalizedAt = &setupFinalizedAt.Time
	}
	if setupFinalizedBy.Valid && setupFinalizedBy.Int64 > 0 {
		value := uint64(setupFinalizedBy.Int64)
		session.SetupFinalizedBy = &value
	}
	if scoresFinalizedAt.Valid {
		session.ScoresFinalizedAt = &scoresFinalizedAt.Time
	}
	if scoresFinalizedBy.Valid && scoresFinalizedBy.Int64 > 0 {
		value := uint64(scoresFinalizedBy.Int64)
		session.ScoresFinalizedBy = &value
	}
	if deletedAt.Valid {
		session.DeletedAt = &deletedAt.Time
	}

	activityEditable := session.ActivityStatus == "draft" || session.ActivityStatus == "published"
	locked := !activityEditable || session.IsSetupFinalized || session.Status == "cancelled"
	session.CanEdit = !locked
	session.CanDelete = !locked && session.RegistrationCount == 0 && session.AttendanceCount == 0
	session.CanFinalize = activityEditable && !session.IsSetupFinalized && session.Status != "cancelled"
	session.CanCancel = activityEditable && session.Status == "scheduled"
	session.CanComplete = activityEditable && session.Status == "scheduled"

	return &session, nil
}

func scanSessionAssignment(scanner interface {
	Scan(dest ...any) error
}) (*models.ActivitySessionAssignment, error) {
	var item models.ActivitySessionAssignment
	var email sql.NullString
	var userFacultyID sql.NullInt64
	var note sql.NullString
	var createdBy sql.NullInt64

	if err := scanner.Scan(
		&item.SessionAssignmentID,
		&item.SessionID,
		&item.UserID,
		&item.DisplayName,
		&email,
		&item.UserType,
		&userFacultyID,
		&item.AssignmentRole,
		&item.CanRecordAttendance,
		&item.CanGrade,
		&item.CanFinalize,
		&note,
		&createdBy,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		return nil, err
	}
	if email.Valid {
		item.Email = &email.String
	}
	if userFacultyID.Valid && userFacultyID.Int64 > 0 {
		value := uint64(userFacultyID.Int64)
		item.UserFacultyID = &value
	}
	if note.Valid {
		item.Note = &note.String
	}
	if createdBy.Valid && createdBy.Int64 > 0 {
		value := uint64(createdBy.Int64)
		item.CreatedBy = &value
	}
	return &item, nil
}

func scanSessionCompetency(scanner interface {
	Scan(dest ...any) error
}) (*models.ActivitySessionCompetency, error) {
	var item models.ActivitySessionCompetency
	var nameEN sql.NullString
	if err := scanner.Scan(
		&item.SessionCompetencyID,
		&item.SessionID,
		&item.CompetencyID,
		&item.CompetencyCode,
		&item.CompetencyNameTH,
		&nameEN,
		&item.MaxPercent,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		return nil, err
	}
	if nameEN.Valid {
		item.CompetencyNameEN = &nameEN.String
	}
	return &item, nil
}

func assignmentKey(userID uint64, role string) string {
	return fmt.Sprintf("%d:%s", userID, role)
}

func splitAssignmentKey(key string) (uint64, string) {
	var userID uint64
	var role string
	_, _ = fmt.Sscanf(key, "%d:%s", &userID, &role)
	return userID, role
}
