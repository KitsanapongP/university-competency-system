package services

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
)

type ActivitySessionWorkspaceService struct {
	SessionRepo   *repositories.ActivitySessionRepository
	WorkspaceRepo *repositories.ActivitySessionWorkspaceRepository
}

func NewActivitySessionWorkspaceService(sessionRepo *repositories.ActivitySessionRepository, workspaceRepo *repositories.ActivitySessionWorkspaceRepository) *ActivitySessionWorkspaceService {
	return &ActivitySessionWorkspaceService{SessionRepo: sessionRepo, WorkspaceRepo: workspaceRepo}
}

func (s *ActivitySessionWorkspaceService) GetSession(ctx context.Context, sessionID uint64, roles []string, facultyID *int64, userID int64) (*models.ActivitySession, error) {
	return s.getWorkspaceSession(ctx, sessionID, roles, facultyID, userID, "read")
}

func (s *ActivitySessionWorkspaceService) GetParticipants(ctx context.Context, sessionID uint64, roles []string, facultyID *int64, userID int64) ([]*models.ActivitySessionParticipant, error) {
	session, err := s.getWorkspaceSession(ctx, sessionID, roles, facultyID, userID, "read")
	if err != nil {
		return nil, err
	}
	participants, err := s.WorkspaceRepo.GetParticipants(ctx, sessionID, session.FacultyID)
	if err != nil {
		return nil, err
	}
	return applyScoringEligibility(participants, session), nil
}

func (s *ActivitySessionWorkspaceService) SearchWalkInCandidates(ctx context.Context, sessionID uint64, query string, roles []string, facultyID *int64, userID int64) ([]*models.WalkInCandidate, error) {
	session, err := s.getWorkspaceSession(ctx, sessionID, roles, facultyID, userID, "attendance")
	if err != nil {
		return nil, err
	}
	return s.WorkspaceRepo.SearchWalkInCandidates(ctx, session.FacultyID, query)
}

func (s *ActivitySessionWorkspaceService) AddWalkIn(ctx context.Context, sessionID uint64, payload models.AddSessionWalkInPayload, roles []string, facultyID *int64, userID int64) error {
	session, err := s.getWorkspaceSession(ctx, sessionID, roles, facultyID, userID, "attendance")
	if err != nil {
		return err
	}
	if payload.PersonID == 0 {
		return ActivitySessionValidationError{Message: "person_id is required"}
	}
	active, err := s.WorkspaceRepo.IsActiveStudentInFaculty(ctx, payload.PersonID, session.FacultyID)
	if err != nil {
		return err
	}
	if !active {
		return ActivitySessionConflictError{Code: "WALK_IN_OUT_OF_SCOPE", Message: "walk-in student must be active in the activity faculty"}
	}
	checkinAt, err := parseOptionalWorkspaceTime(payload.CheckinAt, time.Now())
	if err != nil {
		return ActivitySessionValidationError{Message: "checkin_at is invalid"}
	}
	status, err := attendanceStatusForCheckin(session, checkinAt, payload.OverrideStatus, "")
	if err != nil {
		return err
	}
	return s.WorkspaceRepo.AddWalkIn(ctx, sessionID, payload.PersonID, status, checkinAt, trimWorkspaceNote(payload.Notes), userID)
}

func (s *ActivitySessionWorkspaceService) UpsertAttendance(ctx context.Context, sessionID, personID uint64, payload models.UpsertSessionAttendancePayload, roles []string, facultyID *int64, userID int64) error {
	session, err := s.getWorkspaceSession(ctx, sessionID, roles, facultyID, userID, "attendance")
	if err != nil {
		return err
	}
	if personID == 0 {
		return ActivitySessionValidationError{Message: "person_id is required"}
	}
	participants, err := s.WorkspaceRepo.GetParticipants(ctx, sessionID, session.FacultyID)
	if err != nil {
		return err
	}
	if !participantExists(participants, personID) {
		return ActivitySessionConflictError{Code: "PARTICIPANT_NOT_FOUND", Message: "participant is not in this session roster"}
	}

	status := strings.ToLower(strings.TrimSpace(payload.Status))
	if !validAttendanceStatus(status) {
		return ActivitySessionValidationError{Message: "attendance status is invalid"}
	}
	notes := trimWorkspaceNote(payload.Notes)
	if payload.OverrideStatus && notes == nil {
		return ActivitySessionValidationError{Message: "notes are required when attendance status is overridden"}
	}
	if status == "absent" || status == "excused" {
		return s.WorkspaceRepo.UpsertAttendance(ctx, sessionID, personID, status, nil, nil, notes, userID)
	}
	checkinAt, err := parseOptionalWorkspaceTime(payload.CheckinAt, time.Now())
	if err != nil {
		return ActivitySessionValidationError{Message: "checkin_at is invalid"}
	}
	computedStatus, err := attendanceStatusForCheckin(session, checkinAt, payload.OverrideStatus, status)
	if err != nil {
		return err
	}
	var checkoutAt *time.Time
	if strings.TrimSpace(payload.CheckoutAt) != "" {
		parsed, err := parseSessionTime(payload.CheckoutAt)
		if err != nil {
			return ActivitySessionValidationError{Message: "checkout_at is invalid"}
		}
		if parsed.Before(checkinAt) {
			return ActivitySessionValidationError{Message: "checkout_at must be after checkin_at"}
		}
		checkoutAt = &parsed
	}
	return s.WorkspaceRepo.UpsertAttendance(ctx, sessionID, personID, computedStatus, &checkinAt, checkoutAt, notes, userID)
}

func (s *ActivitySessionWorkspaceService) MarkUnrecordedAbsent(ctx context.Context, sessionID uint64, roles []string, facultyID *int64, userID int64) (int64, error) {
	session, err := s.getWorkspaceSession(ctx, sessionID, roles, facultyID, userID, "attendance")
	if err != nil {
		return 0, err
	}
	if session.Status != "completed" {
		return 0, ActivitySessionConflictError{Code: "SESSION_NOT_COMPLETED", Message: "unrecorded participants can be marked absent only after the session is completed"}
	}
	return s.WorkspaceRepo.MarkUnrecordedAbsent(ctx, sessionID, userID)
}

func (s *ActivitySessionWorkspaceService) GetScores(ctx context.Context, sessionID uint64, roles []string, facultyID *int64, userID int64) ([]*models.ActivitySessionScoreParticipant, error) {
	session, err := s.getWorkspaceSession(ctx, sessionID, roles, facultyID, userID, "score_read")
	if err != nil {
		return nil, err
	}
	participants, err := s.WorkspaceRepo.GetParticipants(ctx, sessionID, session.FacultyID)
	if err != nil {
		return nil, err
	}
	participants = applyScoringEligibility(participants, session)
	stored, err := s.WorkspaceRepo.GetStoredScores(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	byPair := make(map[string]repositories.StoredSessionScore, len(stored))
	for _, score := range stored {
		byPair[scoreKey(score.PersonID, score.SessionCompetencyID)] = score
	}

	response := make([]*models.ActivitySessionScoreParticipant, 0, len(participants))
	for _, participant := range participants {
		item := &models.ActivitySessionScoreParticipant{ActivitySessionParticipant: *participant, Scores: make([]models.SessionScoreEntry, 0, len(session.Competencies))}
		for _, competency := range session.Competencies {
			entry := models.SessionScoreEntry{SessionCompetencyID: competency.SessionCompetencyID, PersonID: participant.PersonID, CompetencyID: competency.CompetencyID, CompetencyCode: competency.CompetencyCode, CompetencyNameTH: competency.CompetencyNameTH, MaxPercent: competency.MaxPercent}
			if score, ok := byPair[scoreKey(participant.PersonID, competency.SessionCompetencyID)]; ok {
				entry.RawScore, entry.FinalScore, entry.Notes, entry.GradingSource = score.RawScore, score.FinalScore, score.Notes, score.GradingSource
			}
			item.Scores = append(item.Scores, entry)
		}
		response = append(response, item)
	}
	return response, nil
}

func (s *ActivitySessionWorkspaceService) SaveScores(ctx context.Context, sessionID uint64, payload models.ReplaceSessionScoresPayload, roles []string, facultyID *int64, userID int64) error {
	session, err := s.getWorkspaceSession(ctx, sessionID, roles, facultyID, userID, "grade")
	if err != nil {
		return err
	}
	if session.GradingMode == "attendance_only" {
		return ActivitySessionConflictError{Code: "ATTENDANCE_ONLY_SCORE", Message: "attendance-only scores are calculated automatically"}
	}
	participants, err := s.WorkspaceRepo.GetParticipants(ctx, sessionID, session.FacultyID)
	if err != nil {
		return err
	}
	participants = applyScoringEligibility(participants, session)
	participantByID := make(map[uint64]*models.ActivitySessionParticipant, len(participants))
	attendance := make(map[uint64]string, len(participants))
	for _, participant := range participants {
		participantByID[participant.PersonID] = participant
		if participant.AttendanceStatus != nil {
			attendance[participant.PersonID] = *participant.AttendanceStatus
		}
	}
	competencies := make(map[uint64]struct{}, len(session.Competencies))
	for _, competency := range session.Competencies {
		competencies[competency.SessionCompetencyID] = struct{}{}
	}
	for _, entry := range payload.Scores {
		participant := participantByID[entry.PersonID]
		if participant == nil || !participant.EligibleForScoring {
			return ActivitySessionConflictError{Code: "SCORE_NOT_ELIGIBLE", Message: "score can only be recorded for eligible participants"}
		}
		if _, ok := competencies[entry.SessionCompetencyID]; !ok {
			return ActivitySessionValidationError{Message: "session_competency_id is invalid"}
		}
		if entry.RawScore == nil || *entry.RawScore < 0 || *entry.RawScore > session.MaxRawScore {
			return ActivitySessionValidationError{Message: "raw_score must be between 0 and max_raw_score"}
		}
	}
	return s.WorkspaceRepo.SaveScores(ctx, sessionID, payload.Scores, session.MaxRawScore, session.LatePenaltyFactor, attendance, gradingSourceForMode(session.GradingMode), userID)
}

func (s *ActivitySessionWorkspaceService) FinalizeScores(ctx context.Context, sessionID uint64, roles []string, facultyID *int64, userID int64) error {
	session, err := s.getWorkspaceSession(ctx, sessionID, roles, facultyID, userID, "finalize")
	if err != nil {
		return err
	}
	if !session.IsSetupFinalized {
		return ActivitySessionConflictError{Code: "SESSION_SETUP_REQUIRED", Message: "session setup must be finalized before scores can be finalized"}
	}
	if session.Status != "completed" {
		return ActivitySessionConflictError{Code: "SESSION_NOT_COMPLETED", Message: "session must be completed before scores can be finalized"}
	}
	if session.ScoresFinalizedAt != nil && !session.ScoresRecalculationRequired {
		return ActivitySessionConflictError{Code: "SCORES_FINALIZED", Message: "scores are already finalized; open a correction first"}
	}
	participants, err := s.WorkspaceRepo.GetParticipants(ctx, sessionID, session.FacultyID)
	if err != nil {
		return err
	}
	for _, participant := range participants {
		if participant.RegistrationStatus != nil && *participant.RegistrationStatus == "approved" && !participant.AttendanceRecorded {
			return ActivitySessionConflictError{Code: "ATTENDANCE_INCOMPLETE", Message: "all approved participants must have attendance recorded"}
		}
	}
	participants = applyScoringEligibility(participants, session)
	if session.GradingMode == "attendance_only" {
		if err := s.WorkspaceRepo.UpsertAttendanceOnlyScores(ctx, session, participants, userID); err != nil {
			return err
		}
	}
	stored, err := s.WorkspaceRepo.GetStoredScores(ctx, sessionID)
	if err != nil {
		return err
	}
	completed := make(map[string]bool, len(stored))
	for _, score := range stored {
		if score.RawScore != nil {
			completed[scoreKey(score.PersonID, score.SessionCompetencyID)] = true
		}
	}
	enrollmentIDs := make(map[uint64]uint64)
	for _, participant := range participants {
		enrollmentID, err := s.WorkspaceRepo.GetExactActiveEnrollmentID(ctx, participant.PersonID, session.FacultyID)
		if err != nil {
			return err
		}
		if participant.EligibleForScoring && enrollmentID == nil {
			return ActivitySessionConflictError{Code: "ACTIVE_ENROLLMENT_REQUIRED", Message: "each scored participant must have exactly one active enrollment in the activity faculty"}
		}
		if enrollmentID != nil {
			enrollmentIDs[participant.PersonID] = *enrollmentID
		}
		if !participant.EligibleForScoring {
			continue
		}
		for _, competency := range session.Competencies {
			if !completed[scoreKey(participant.PersonID, competency.SessionCompetencyID)] {
				return ActivitySessionConflictError{Code: "SCORES_INCOMPLETE", Message: "all eligible participants need a score for every competency"}
			}
		}
	}
	return s.WorkspaceRepo.FinalizeScores(ctx, session, participants, enrollmentIDs, userID)
}

func (s *ActivitySessionWorkspaceService) OpenCorrection(ctx context.Context, sessionID uint64, payload models.OpenSessionScoreCorrectionPayload, roles []string, facultyID *int64, userID int64) error {
	session, err := s.getWorkspaceSession(ctx, sessionID, roles, facultyID, userID, "finalize")
	if err != nil {
		return err
	}
	if session.ScoresFinalizedAt == nil || session.ScoresRecalculationRequired {
		return ActivitySessionConflictError{Code: "CORRECTION_UNAVAILABLE", Message: "scores must be finalized before a correction can be opened"}
	}
	reason := strings.TrimSpace(payload.Reason)
	if reason == "" {
		return ActivitySessionValidationError{Message: "correction reason is required"}
	}
	return s.WorkspaceRepo.OpenCorrection(ctx, sessionID, reason, userID)
}

func (s *ActivitySessionWorkspaceService) GetMySessions(ctx context.Context, userID int64) ([]*models.ActivitySession, error) {
	ids, err := s.WorkspaceRepo.GetMyAssignedSessionIDs(ctx, userID)
	if err != nil {
		return nil, err
	}
	items := make([]*models.ActivitySession, 0, len(ids))
	for _, id := range ids {
		session, err := s.SessionRepo.GetSessionByID(ctx, id)
		if errors.Is(err, context.Canceled) {
			return nil, err
		}
		if err != nil {
			return nil, err
		}
		items = append(items, session)
	}
	return items, nil
}

func (s *ActivitySessionWorkspaceService) getWorkspaceSession(ctx context.Context, sessionID uint64, roles []string, facultyID *int64, userID int64, action string) (*models.ActivitySession, error) {
	session, err := s.SessionRepo.GetSessionByID(ctx, sessionID)
	if err != nil {
		return nil, mapSessionWorkspaceNotFound(err)
	}
	isStaffManager := hasRole(roles, "admin") || hasRole(roles, "officer")
	if isStaffManager {
		if err := ensureActivityFacultyScope(session.FacultyID, roles, facultyID); err != nil {
			return nil, ErrActivitySessionForbidden
		}
	} else {
		permission, err := s.WorkspaceRepo.GetAssignmentPermission(ctx, sessionID, userID)
		if err != nil {
			return nil, err
		}
		if permission == nil {
			return nil, ErrActivitySessionForbidden
		}
		switch action {
		case "attendance":
			if !permission.CanRecordAttendance {
				return nil, ErrActivitySessionForbidden
			}
		case "grade", "score_read":
			if !permission.CanGrade {
				return nil, ErrActivitySessionForbidden
			}
		case "finalize":
			if !permission.CanFinalize {
				return nil, ErrActivitySessionForbidden
			}
		}
	}
	if action == "attendance" || action == "grade" {
		if !session.IsSetupFinalized {
			return nil, ActivitySessionConflictError{Code: "SESSION_SETUP_REQUIRED", Message: "session setup must be finalized first"}
		}
		if session.Status == "cancelled" {
			return nil, ActivitySessionConflictError{Code: "SESSION_CANCELLED", Message: "cancelled session cannot be changed"}
		}
		if session.ScoresFinalizedAt != nil && !session.ScoresRecalculationRequired {
			return nil, ActivitySessionConflictError{Code: "SCORES_FINALIZED", Message: "open a score correction before editing attendance or scores"}
		}
	}
	return session, nil
}

func mapSessionWorkspaceNotFound(err error) error {
	if errors.Is(err, context.Canceled) {
		return err
	}
	return ErrActivitySessionNotFound
}

func applyScoringEligibility(participants []*models.ActivitySessionParticipant, session *models.ActivitySession) []*models.ActivitySessionParticipant {
	for _, participant := range participants {
		participant.EligibleForScoring = false
		participant.ScoringIneligibilityReason = ""
		if participant.AttendanceStatus == nil || (*participant.AttendanceStatus != "present" && *participant.AttendanceStatus != "late") {
			participant.ScoringIneligibilityReason = "attendance must be present or late"
			continue
		}
		if session.RequireCheckout && participant.CheckoutAt == nil {
			participant.ScoringIneligibilityReason = "checkout is required"
			continue
		}
		if session.MinAttendanceMinutes != nil {
			if participant.CheckinAt == nil || participant.CheckoutAt == nil || participant.CheckoutAt.Sub(*participant.CheckinAt).Minutes() < float64(*session.MinAttendanceMinutes) {
				participant.ScoringIneligibilityReason = "minimum attendance duration is not met"
				continue
			}
		}
		participant.EligibleForScoring = true
	}
	return participants
}

func attendanceStatusForCheckin(session *models.ActivitySession, checkinAt time.Time, override bool, requested string) (string, error) {
	if override {
		if requested != "present" && requested != "late" {
			return "", ActivitySessionValidationError{Message: "overridden attendance status must be present or late"}
		}
		return requested, nil
	}
	if checkinAt.After(session.StartAt.Add(time.Duration(session.LateGraceMinutes) * time.Minute)) {
		return "late", nil
	}
	return "present", nil
}

func parseOptionalWorkspaceTime(value string, fallback time.Time) (time.Time, error) {
	if strings.TrimSpace(value) == "" {
		return fallback, nil
	}
	return parseSessionTime(value)
}

func participantExists(participants []*models.ActivitySessionParticipant, personID uint64) bool {
	for _, participant := range participants {
		if participant.PersonID == personID {
			return true
		}
	}
	return false
}

func validAttendanceStatus(value string) bool {
	return value == "present" || value == "late" || value == "absent" || value == "excused"
}
func trimWorkspaceNote(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}
func scoreKey(personID, sessionCompetencyID uint64) string {
	return fmt.Sprintf("%d:%d", personID, sessionCompetencyID)
}
func gradingSourceForMode(mode string) string {
	if mode == "attendance_only" {
		return "attendance"
	}
	if mode == "manual_score" {
		return "manual"
	}
	return mode
}
func approximatelyEqual(a, b float64) bool { return math.Abs(a-b) < 0.0001 }
