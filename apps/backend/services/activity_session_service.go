package services

import (
	"context"
	"database/sql"
	"errors"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
)

var (
	ErrActivitySessionNotFound  = errors.New("activity session not found")
	ErrActivitySessionForbidden = errors.New("insufficient activity session scope")
)

type ActivitySessionService struct {
	Repo         *repositories.ActivitySessionRepository
	ActivityRepo *repositories.ActivityRepository
}

func NewActivitySessionService(repo *repositories.ActivitySessionRepository, activityRepo *repositories.ActivityRepository) *ActivitySessionService {
	return &ActivitySessionService{
		Repo:         repo,
		ActivityRepo: activityRepo,
	}
}

type ActivitySessionValidationError struct {
	Message string
}

func (e ActivitySessionValidationError) Error() string {
	return e.Message
}

type ActivitySessionConflictError struct {
	Code    string
	Message string
}

func (e ActivitySessionConflictError) Error() string {
	return e.Message
}

func (s *ActivitySessionService) GetSessionsByActivity(ctx context.Context, activityID uint64, roles []string, facultyID *int64) ([]*models.ActivitySession, error) {
	if _, err := s.getActivityForSessionRead(ctx, activityID, roles, facultyID); err != nil {
		return nil, err
	}
	return s.Repo.GetSessionsByActivity(ctx, activityID)
}

func (s *ActivitySessionService) CreateSession(ctx context.Context, activityID uint64, payload models.UpsertActivitySessionPayload, roles []string, facultyID *int64) (*models.ActivitySession, error) {
	activity, err := s.getActivityForSessionWrite(ctx, activityID, roles, facultyID)
	if err != nil {
		return nil, err
	}
	defaults := defaultSessionDataFromActivity(activity)
	data, err := sessionDataFromPayload(payload, defaults, true)
	if err != nil {
		return nil, err
	}
	return s.Repo.CreateSession(ctx, activityID, data)
}

func (s *ActivitySessionService) GetSessionByID(ctx context.Context, sessionID uint64, roles []string, facultyID *int64) (*models.ActivitySession, error) {
	session, err := s.getSessionForRead(ctx, sessionID, roles, facultyID)
	if err != nil {
		return nil, err
	}
	return session, nil
}

func (s *ActivitySessionService) UpdateSession(ctx context.Context, sessionID uint64, payload models.UpsertActivitySessionPayload, roles []string, facultyID *int64) (*models.ActivitySession, error) {
	session, err := s.getSessionForWrite(ctx, sessionID, roles, facultyID)
	if err != nil {
		return nil, err
	}
	data, err := sessionDataFromPayload(payload, defaultSessionDataFromSession(session), false)
	if err != nil {
		return nil, err
	}
	updated, err := s.Repo.UpdateSession(ctx, sessionID, data)
	return mapSessionNoRows(updated, err)
}

func (s *ActivitySessionService) UpdateSessionStatus(ctx context.Context, sessionID uint64, payload models.UpdateActivitySessionStatusPayload, roles []string, facultyID *int64) (*models.ActivitySession, error) {
	session, err := s.getSessionForRead(ctx, sessionID, roles, facultyID)
	if err != nil {
		return nil, err
	}
	if err := ensureActivityStatusAllowsSessionWrite(session.ActivityStatus); err != nil {
		return nil, err
	}
	if session.IsFinalized {
		return nil, ActivitySessionConflictError{
			Code:    "SESSION_FINALIZED",
			Message: "finalized session cannot be changed",
		}
	}
	if session.Status != "scheduled" {
		return nil, ActivitySessionConflictError{
			Code:    "INVALID_SESSION_STATUS_TRANSITION",
			Message: "session status can only change from scheduled",
		}
	}

	nextStatus := strings.ToLower(strings.TrimSpace(payload.Status))
	if nextStatus != "completed" && nextStatus != "cancelled" {
		if nextStatus == "" {
			return nil, ActivitySessionValidationError{Message: "status is required"}
		}
		return nil, ActivitySessionConflictError{
			Code:    "INVALID_SESSION_STATUS_TRANSITION",
			Message: "invalid session status transition",
		}
	}

	updated, err := s.Repo.UpdateSessionStatus(ctx, sessionID, nextStatus)
	return mapSessionNoRows(updated, err)
}

func (s *ActivitySessionService) FinalizeSession(ctx context.Context, sessionID uint64, roles []string, facultyID *int64, userID int64) (*models.ActivitySession, error) {
	session, err := s.getSessionForRead(ctx, sessionID, roles, facultyID)
	if err != nil {
		return nil, err
	}
	if err := ensureActivityStatusAllowsSessionWrite(session.ActivityStatus); err != nil {
		return nil, err
	}
	if session.IsFinalized {
		return nil, ActivitySessionConflictError{
			Code:    "SESSION_FINALIZED",
			Message: "session is already finalized",
		}
	}
	if session.Status == "cancelled" {
		return nil, ActivitySessionConflictError{
			Code:    "SESSION_CANCELLED",
			Message: "cancelled session cannot be finalized",
		}
	}
	if !session.StartAt.Before(session.EndAt) {
		return nil, ActivitySessionValidationError{Message: "start_at must be before end_at"}
	}
	if session.AssignmentCount == 0 {
		return nil, ActivitySessionConflictError{
			Code:    "SESSION_ASSIGNMENT_REQUIRED",
			Message: "session needs at least one assignee before finalize",
		}
	}
	if session.CompetencyCount == 0 {
		return nil, ActivitySessionConflictError{
			Code:    "SESSION_COMPETENCY_REQUIRED",
			Message: "session needs at least one competency before finalize",
		}
	}
	if math.Abs(session.CompetencyPercentTotal-100) > 0.0001 {
		return nil, ActivitySessionConflictError{
			Code:    "SESSION_COMPETENCY_PERCENT_INVALID",
			Message: "session competency percent total must equal 100",
		}
	}

	finalized, err := s.Repo.FinalizeSession(ctx, sessionID, userID)
	return mapSessionNoRows(finalized, err)
}

func (s *ActivitySessionService) DeleteSession(ctx context.Context, sessionID uint64, roles []string, facultyID *int64) error {
	session, err := s.getSessionForRead(ctx, sessionID, roles, facultyID)
	if err != nil {
		return err
	}
	if err := ensureActivityStatusAllowsSessionWrite(session.ActivityStatus); err != nil {
		return err
	}
	if session.IsFinalized {
		return ActivitySessionConflictError{
			Code:    "SESSION_FINALIZED",
			Message: "finalized session cannot be deleted",
		}
	}
	registrations, err := s.Repo.CountRegistrationsForSession(ctx, sessionID)
	if err != nil {
		return err
	}
	attendances, err := s.Repo.CountAttendancesForSession(ctx, sessionID)
	if err != nil {
		return err
	}
	if registrations > 0 || attendances > 0 {
		return ActivitySessionConflictError{
			Code:    "SESSION_HAS_REAL_USAGE",
			Message: "session cannot be deleted because registration or attendance exists",
		}
	}
	if err := s.Repo.SoftDeleteSession(ctx, sessionID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrActivitySessionNotFound
		}
		return err
	}
	return nil
}

func (s *ActivitySessionService) ReplaceAssignments(ctx context.Context, sessionID uint64, payload models.ReplaceSessionAssignmentsPayload, roles []string, facultyID *int64, userID int64) ([]*models.ActivitySessionAssignment, error) {
	session, err := s.getSessionForWrite(ctx, sessionID, roles, facultyID)
	if err != nil {
		return nil, err
	}
	normalized, err := s.normalizeAssignments(ctx, payload.Assignments, session.FacultyID)
	if err != nil {
		return nil, err
	}
	return s.Repo.ReplaceAssignments(ctx, sessionID, normalized, userID)
}

func (s *ActivitySessionService) ReplaceCompetencies(ctx context.Context, sessionID uint64, payload models.ReplaceSessionCompetenciesPayload, roles []string, facultyID *int64) ([]*models.ActivitySessionCompetency, error) {
	if _, err := s.getSessionForWrite(ctx, sessionID, roles, facultyID); err != nil {
		return nil, err
	}
	normalized, err := s.normalizeCompetencies(ctx, payload.Competencies)
	if err != nil {
		return nil, err
	}
	return s.Repo.ReplaceCompetencies(ctx, sessionID, normalized)
}

func (s *ActivitySessionService) GetAssigneeOptions(ctx context.Context, activityID uint64, roles []string, facultyID *int64) ([]*models.SessionAssigneeOption, error) {
	activity, err := s.getActivityForSessionRead(ctx, activityID, roles, facultyID)
	if err != nil {
		return nil, err
	}
	return s.Repo.GetAssigneeOptions(ctx, activity.FacultyID)
}

func (s *ActivitySessionService) getActivityForSessionRead(ctx context.Context, activityID uint64, roles []string, facultyID *int64) (*models.Activity, error) {
	activity, err := s.ActivityRepo.GetActivityByID(ctx, activityID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrActivityNotFound
	}
	if err != nil {
		return nil, err
	}
	if err := ensureActivityFacultyScope(activity.FacultyID, roles, facultyID); err != nil {
		return nil, ErrActivitySessionForbidden
	}
	return activity, nil
}

func (s *ActivitySessionService) getActivityForSessionWrite(ctx context.Context, activityID uint64, roles []string, facultyID *int64) (*models.Activity, error) {
	activity, err := s.getActivityForSessionRead(ctx, activityID, roles, facultyID)
	if err != nil {
		return nil, err
	}
	if err := ensureActivityStatusAllowsSessionWrite(activity.Status); err != nil {
		return nil, err
	}
	return activity, nil
}

func (s *ActivitySessionService) getSessionForRead(ctx context.Context, sessionID uint64, roles []string, facultyID *int64) (*models.ActivitySession, error) {
	session, err := s.Repo.GetSessionByID(ctx, sessionID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrActivitySessionNotFound
	}
	if err != nil {
		return nil, err
	}
	if err := ensureActivityFacultyScope(session.FacultyID, roles, facultyID); err != nil {
		return nil, ErrActivitySessionForbidden
	}
	return session, nil
}

func (s *ActivitySessionService) getSessionForWrite(ctx context.Context, sessionID uint64, roles []string, facultyID *int64) (*models.ActivitySession, error) {
	session, err := s.getSessionForRead(ctx, sessionID, roles, facultyID)
	if err != nil {
		return nil, err
	}
	if err := ensureActivityStatusAllowsSessionWrite(session.ActivityStatus); err != nil {
		return nil, err
	}
	if session.IsFinalized {
		return nil, ActivitySessionConflictError{
			Code:    "SESSION_FINALIZED",
			Message: "finalized session cannot be changed",
		}
	}
	if session.Status == "cancelled" {
		return nil, ActivitySessionConflictError{
			Code:    "SESSION_CANCELLED",
			Message: "cancelled session cannot be changed",
		}
	}
	return session, nil
}

func ensureActivityStatusAllowsSessionWrite(status string) error {
	if status == "draft" || status == "published" {
		return nil
	}
	return ActivitySessionConflictError{
		Code:    "ACTIVITY_READ_ONLY",
		Message: "closed or cancelled activity sessions are read-only",
	}
}

func defaultSessionDataFromActivity(activity *models.Activity) models.ActivitySessionData {
	return models.ActivitySessionData{
		Timezone:             "Asia/Bangkok",
		RegistrationRequired: activity.RegistrationRequired,
		GradingMode:          "attendance_only",
		MaxRawScore:          100,
		LatePenaltyFactor:    1,
	}
}

func defaultSessionDataFromSession(session *models.ActivitySession) models.ActivitySessionData {
	return models.ActivitySessionData{
		StartAt:              session.StartAt,
		EndAt:                session.EndAt,
		Timezone:             session.Timezone,
		LocationName:         session.LocationName,
		LocationDetail:       session.LocationDetail,
		Latitude:             session.Latitude,
		Longitude:            session.Longitude,
		Capacity:             session.Capacity,
		RegistrationRequired: session.RegistrationRequired,
		GradingMode:          session.GradingMode,
		MaxRawScore:          session.MaxRawScore,
		PassThreshold:        session.PassThreshold,
		LateGraceMinutes:     session.LateGraceMinutes,
		LatePenaltyFactor:    session.LatePenaltyFactor,
		RequireCheckout:      session.RequireCheckout,
		MinAttendanceMinutes: session.MinAttendanceMinutes,
	}
}

func sessionDataFromPayload(payload models.UpsertActivitySessionPayload, defaults models.ActivitySessionData, requireTimes bool) (models.ActivitySessionData, error) {
	data := defaults

	if strings.TrimSpace(payload.StartAt) != "" {
		parsed, err := parseSessionTime(payload.StartAt)
		if err != nil {
			return data, ActivitySessionValidationError{Message: "start_at is invalid"}
		}
		data.StartAt = parsed
	}
	if strings.TrimSpace(payload.EndAt) != "" {
		parsed, err := parseSessionTime(payload.EndAt)
		if err != nil {
			return data, ActivitySessionValidationError{Message: "end_at is invalid"}
		}
		data.EndAt = parsed
	}
	if requireTimes && data.StartAt.IsZero() {
		return data, ActivitySessionValidationError{Message: "start_at is required"}
	}
	if requireTimes && data.EndAt.IsZero() {
		return data, ActivitySessionValidationError{Message: "end_at is required"}
	}

	data.Timezone = strings.TrimSpace(payload.Timezone)
	if data.Timezone == "" {
		data.Timezone = defaults.Timezone
	}
	if data.Timezone == "" {
		data.Timezone = "Asia/Bangkok"
	}
	data.LocationName = trimNullableString(payload.LocationName)
	data.LocationDetail = trimNullableString(payload.LocationDetail)
	data.Latitude = payload.Latitude
	data.Longitude = payload.Longitude
	data.Capacity = payload.Capacity
	if payload.RegistrationRequired != nil {
		data.RegistrationRequired = *payload.RegistrationRequired
	}
	data.GradingMode = strings.ToLower(strings.TrimSpace(payload.GradingMode))
	if data.GradingMode == "" {
		data.GradingMode = defaults.GradingMode
	}
	if data.GradingMode == "" {
		data.GradingMode = "attendance_only"
	}
	if payload.MaxRawScore != nil {
		data.MaxRawScore = *payload.MaxRawScore
	}
	if data.MaxRawScore == 0 {
		data.MaxRawScore = defaults.MaxRawScore
	}
	if data.MaxRawScore == 0 {
		data.MaxRawScore = 100
	}
	data.PassThreshold = payload.PassThreshold
	if payload.LateGraceMinutes != nil {
		data.LateGraceMinutes = *payload.LateGraceMinutes
	}
	if strings.TrimSpace(payload.LateAt) != "" {
		lateAt, err := parseSessionTime(payload.LateAt)
		if err != nil {
			return data, ActivitySessionValidationError{Message: "late_at is invalid"}
		}
		if lateAt.Before(data.StartAt) {
			return data, ActivitySessionValidationError{Message: "late_at must be after start_at"}
		}
		if lateAt.After(data.EndAt) {
			return data, ActivitySessionValidationError{Message: "late_at must be before end_at"}
		}
		data.LateGraceMinutes = uint(math.Round(lateAt.Sub(data.StartAt).Minutes()))
	}
	if payload.LatePenaltyFactor != nil {
		data.LatePenaltyFactor = *payload.LatePenaltyFactor
	}
	if data.LatePenaltyFactor == 0 {
		data.LatePenaltyFactor = defaults.LatePenaltyFactor
	}
	if data.LatePenaltyFactor == 0 {
		data.LatePenaltyFactor = 1
	}
	if payload.RequireCheckout != nil {
		data.RequireCheckout = *payload.RequireCheckout
	}
	data.MinAttendanceMinutes = payload.MinAttendanceMinutes

	if err := validateSessionData(data); err != nil {
		return data, err
	}
	return data, nil
}

func validateSessionData(data models.ActivitySessionData) error {
	if data.StartAt.IsZero() {
		return ActivitySessionValidationError{Message: "start_at is required"}
	}
	if data.EndAt.IsZero() {
		return ActivitySessionValidationError{Message: "end_at is required"}
	}
	if !data.StartAt.Before(data.EndAt) {
		return ActivitySessionValidationError{Message: "start_at must be before end_at"}
	}
	if !validGradingMode(data.GradingMode) {
		return ActivitySessionValidationError{Message: "grading_mode is invalid"}
	}
	if data.MaxRawScore <= 0 {
		return ActivitySessionValidationError{Message: "max_raw_score must be greater than 0"}
	}
	if data.PassThreshold != nil && (*data.PassThreshold < 0 || *data.PassThreshold > data.MaxRawScore) {
		return ActivitySessionValidationError{Message: "pass_threshold is invalid"}
	}
	if data.LatePenaltyFactor <= 0 || data.LatePenaltyFactor > 1 {
		return ActivitySessionValidationError{Message: "late_penalty_factor is invalid"}
	}
	return nil
}

func validGradingMode(value string) bool {
	switch value {
	case "attendance_only", "manual_score", "submission", "exam", "hybrid":
		return true
	default:
		return false
	}
}

func parseSessionTime(value string) (time.Time, error) {
	raw := strings.TrimSpace(value)
	if raw == "" {
		return time.Time{}, errors.New("empty time")
	}
	if parsed, err := time.Parse(time.RFC3339, raw); err == nil {
		return parsed, nil
	}
	location, err := time.LoadLocation("Asia/Bangkok")
	if err != nil {
		location = time.Local
	}
	formats := []string{
		"2006-01-02T15:04:05",
		"2006-01-02T15:04",
		"2006-01-02 15:04:05",
		"2006-01-02 15:04",
	}
	var parseErr error
	for _, format := range formats {
		parsed, err := time.ParseInLocation(format, raw, location)
		if err == nil {
			return parsed, nil
		}
		parseErr = err
	}
	return time.Time{}, parseErr
}

func (s *ActivitySessionService) normalizeAssignments(ctx context.Context, assignments []models.UpsertSessionAssignmentPayload, facultyID uint64) ([]models.UpsertSessionAssignmentPayload, error) {
	normalized := make([]models.UpsertSessionAssignmentPayload, 0, len(assignments))
	seen := make(map[string]struct{}, len(assignments))
	for _, item := range assignments {
		item.AssignmentRole = strings.ToLower(strings.TrimSpace(item.AssignmentRole))
		item.Note = trimNullableString(item.Note)
		if item.UserID == 0 {
			return nil, ActivitySessionValidationError{Message: "assignment user_id is required"}
		}
		if !validAssignmentRole(item.AssignmentRole) {
			return nil, ActivitySessionValidationError{Message: "assignment_role is invalid"}
		}
		key := strings.Join([]string{strconv.FormatUint(item.UserID, 10), item.AssignmentRole}, ":")
		if _, ok := seen[key]; ok {
			return nil, ActivitySessionValidationError{Message: "duplicate assignee role in payload"}
		}
		seen[key] = struct{}{}
		ok, err := s.Repo.UserAssignableToFaculty(ctx, item.UserID, facultyID)
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, ActivitySessionValidationError{Message: "assignee must be active staff in activity faculty"}
		}
		normalized = append(normalized, item)
	}
	return normalized, nil
}

func validAssignmentRole(value string) bool {
	switch value {
	case "lecturer", "officer", "assistant", "supervisor":
		return true
	default:
		return false
	}
}

func (s *ActivitySessionService) normalizeCompetencies(ctx context.Context, competencies []models.UpsertSessionCompetencyPayload) ([]models.UpsertSessionCompetencyPayload, error) {
	normalized := make([]models.UpsertSessionCompetencyPayload, 0, len(competencies))
	seen := make(map[uint64]struct{}, len(competencies))
	for _, item := range competencies {
		if item.CompetencyID == 0 {
			return nil, ActivitySessionValidationError{Message: "competency_id is required"}
		}
		if item.MaxPercent <= 0 || item.MaxPercent > 100 {
			return nil, ActivitySessionValidationError{Message: "max_percent is invalid"}
		}
		if _, ok := seen[item.CompetencyID]; ok {
			return nil, ActivitySessionValidationError{Message: "duplicate competency in payload"}
		}
		seen[item.CompetencyID] = struct{}{}
		ok, err := s.Repo.CompetencyActiveExists(ctx, item.CompetencyID)
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, ActivitySessionValidationError{Message: "competency is not active"}
		}
		normalized = append(normalized, item)
	}
	return normalized, nil
}

func mapSessionNoRows(session *models.ActivitySession, err error) (*models.ActivitySession, error) {
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrActivitySessionNotFound
	}
	return session, err
}
