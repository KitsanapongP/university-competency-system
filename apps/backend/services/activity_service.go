package services

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
)

var (
	ErrActivityNotFound  = errors.New("activity not found")
	ErrActivityForbidden = errors.New("insufficient activity scope")
)

type ActivityService struct {
	Repo *repositories.ActivityRepository
}

func NewActivityService(repo *repositories.ActivityRepository) *ActivityService {
	return &ActivityService{Repo: repo}
}

type ActivityValidationError struct {
	Message string
}

func (e ActivityValidationError) Error() string {
	return e.Message
}

type ActivityConflictError struct {
	Code    string
	Message string
}

func (e ActivityConflictError) Error() string {
	return e.Message
}

func (s *ActivityService) GetActivities(ctx context.Context, filters models.ActivityFilters, roles []string, facultyID *int64) ([]*models.Activity, error) {
	scopedFilters, err := s.applyActivityFiltersScope(filters, roles, facultyID)
	if err != nil {
		return nil, err
	}
	return s.Repo.GetActivities(ctx, scopedFilters)
}

func (s *ActivityService) GetActivityByID(ctx context.Context, activityID uint64, roles []string, facultyID *int64) (*models.Activity, error) {
	activity, err := s.getActivityForRead(ctx, activityID, roles, facultyID)
	if err != nil {
		return nil, err
	}
	return activity, nil
}

func (s *ActivityService) GetActivityOptions(ctx context.Context, filters models.ActivityFilters, roles []string, facultyID *int64) (*models.ActivityOptions, error) {
	scopedFilters, err := s.applyActivityFiltersScope(filters, roles, facultyID)
	if err != nil {
		return nil, err
	}
	return s.Repo.GetActivityOptions(ctx, scopedFilters)
}

func (s *ActivityService) CreateActivity(ctx context.Context, payload models.UpsertActivityPayload, userID int64, roles []string, facultyID *int64) (*models.Activity, error) {
	normalized, err := s.normalizeActivityPayloadForCreate(payload, roles, facultyID)
	if err != nil {
		return nil, err
	}
	if err := validateActivityPayload(normalized); err != nil {
		return nil, err
	}
	return s.Repo.CreateActivity(ctx, normalized, userID)
}

func (s *ActivityService) UpdateActivity(ctx context.Context, activityID uint64, payload models.UpsertActivityPayload, roles []string, facultyID *int64) (*models.Activity, error) {
	existing, err := s.getActivityForRead(ctx, activityID, roles, facultyID)
	if err != nil {
		return nil, err
	}

	switch existing.Status {
	case "draft":
		normalized, err := s.normalizeActivityPayloadForUpdate(payload, existing, roles, facultyID)
		if err != nil {
			return nil, err
		}
		if err := validateActivityPayload(normalized); err != nil {
			return nil, err
		}
		activity, err := s.Repo.UpdateActivityDraft(ctx, activityID, normalized)
		return mapActivityNoRows(activity, err)
	case "published":
		normalized := normalizeActivityPayload(payload)
		normalized.FacultyID = existing.FacultyID
		normalized.Code = existing.Code
		normalized.NameTH = existing.NameTH
		normalized.NameEN = existing.NameEN
		if payloadChangesActivityIdentity(payload, existing) {
			return nil, ActivityConflictError{
				Code:    "ACTIVITY_IDENTITY_LOCKED",
				Message: "published activity identity cannot be changed",
			}
		}
		activity, err := s.Repo.UpdateActivityPublished(ctx, activityID, normalized)
		return mapActivityNoRows(activity, err)
	case "closed", "cancelled":
		return nil, ActivityConflictError{
			Code:    "ACTIVITY_READ_ONLY",
			Message: "closed or cancelled activity cannot be edited",
		}
	default:
		return nil, ActivityValidationError{Message: "invalid activity status"}
	}
}

func (s *ActivityService) UpdateActivityStatus(ctx context.Context, activityID uint64, payload models.UpdateActivityStatusPayload, roles []string, facultyID *int64) (*models.Activity, error) {
	activity, err := s.getActivityForRead(ctx, activityID, roles, facultyID)
	if err != nil {
		return nil, err
	}

	nextStatus := strings.ToLower(strings.TrimSpace(payload.Status))
	switch {
	case activity.Status == "draft" && nextStatus == "published":
		updated, err := s.Repo.PublishActivity(ctx, activityID)
		return mapActivityNoRows(updated, err)
	case activity.Status == "published" && nextStatus == "closed":
		updated, err := s.Repo.CloseActivity(ctx, activityID)
		return mapActivityNoRows(updated, err)
	case nextStatus == "":
		return nil, ActivityValidationError{Message: "status is required"}
	default:
		return nil, ActivityConflictError{
			Code:    "INVALID_STATUS_TRANSITION",
			Message: "invalid activity status transition",
		}
	}
}

func (s *ActivityService) DeleteActivity(ctx context.Context, activityID uint64, roles []string, facultyID *int64) error {
	activity, err := s.getActivityForRead(ctx, activityID, roles, facultyID)
	if err != nil {
		return err
	}
	if activity.Status != "draft" {
		return ActivityConflictError{
			Code:    "ACTIVITY_DELETE_NOT_ALLOWED",
			Message: "only draft activity can be deleted",
		}
	}
	sessionCount, err := s.Repo.CountSessionsForActivity(ctx, activityID)
	if err != nil {
		return err
	}
	if sessionCount > 0 {
		return ActivityConflictError{
			Code:    "ACTIVITY_HAS_SESSIONS",
			Message: "activity cannot be deleted while sessions are connected",
		}
	}
	if err := s.Repo.SoftDeleteActivity(ctx, activityID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrActivityNotFound
		}
		return err
	}
	return nil
}

func (s *ActivityService) getActivityForRead(ctx context.Context, activityID uint64, roles []string, facultyID *int64) (*models.Activity, error) {
	activity, err := s.Repo.GetActivityByID(ctx, activityID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrActivityNotFound
	}
	if err != nil {
		return nil, err
	}
	if err := ensureActivityFacultyScope(activity.FacultyID, roles, facultyID); err != nil {
		return nil, err
	}
	return activity, nil
}

func (s *ActivityService) normalizeActivityPayloadForCreate(payload models.UpsertActivityPayload, roles []string, facultyID *int64) (models.UpsertActivityPayload, error) {
	normalized := normalizeActivityPayload(payload)
	if hasRole(roles, "admin") {
		if normalized.FacultyID == 0 {
			return normalized, ActivityValidationError{Message: "faculty_id is required"}
		}
		return normalized, nil
	}
	if !hasRole(roles, "officer") || facultyID == nil || *facultyID <= 0 {
		return normalized, ErrActivityForbidden
	}
	if normalized.FacultyID != 0 && normalized.FacultyID != uint64(*facultyID) {
		return normalized, ErrActivityForbidden
	}
	normalized.FacultyID = uint64(*facultyID)
	return normalized, nil
}

func (s *ActivityService) normalizeActivityPayloadForUpdate(payload models.UpsertActivityPayload, existing *models.Activity, roles []string, facultyID *int64) (models.UpsertActivityPayload, error) {
	normalized := normalizeActivityPayload(payload)
	if hasRole(roles, "admin") {
		if normalized.FacultyID == 0 {
			normalized.FacultyID = existing.FacultyID
		}
		return normalized, nil
	}
	if !hasRole(roles, "officer") || facultyID == nil || *facultyID <= 0 {
		return normalized, ErrActivityForbidden
	}
	if normalized.FacultyID != 0 && normalized.FacultyID != existing.FacultyID {
		return normalized, ErrActivityForbidden
	}
	normalized.FacultyID = existing.FacultyID
	return normalized, nil
}

func (s *ActivityService) applyActivityFiltersScope(filters models.ActivityFilters, roles []string, facultyID *int64) (models.ActivityFilters, error) {
	if hasRole(roles, "admin") {
		return filters, nil
	}
	if !hasRole(roles, "officer") || facultyID == nil || *facultyID <= 0 {
		return filters, ErrActivityForbidden
	}
	scopedFacultyID := uint64(*facultyID)
	if filters.FacultyID != nil && *filters.FacultyID != scopedFacultyID {
		return filters, ErrActivityForbidden
	}
	filters.FacultyID = &scopedFacultyID
	return filters, nil
}

func ensureActivityFacultyScope(targetFacultyID uint64, roles []string, facultyID *int64) error {
	if hasRole(roles, "admin") {
		return nil
	}
	if !hasRole(roles, "officer") || facultyID == nil || *facultyID <= 0 {
		return ErrActivityForbidden
	}
	if targetFacultyID != uint64(*facultyID) {
		return ErrActivityForbidden
	}
	return nil
}

func normalizeActivityPayload(payload models.UpsertActivityPayload) models.UpsertActivityPayload {
	payload.Code = strings.TrimSpace(payload.Code)
	payload.NameTH = strings.TrimSpace(payload.NameTH)
	payload.NameEN = trimNullableString(payload.NameEN)
	payload.Description = trimNullableString(payload.Description)
	payload.Category = trimNullableString(payload.Category)
	payload.Type = trimNullableString(payload.Type)
	return payload
}

func validateActivityPayload(payload models.UpsertActivityPayload) error {
	if payload.FacultyID == 0 {
		return ActivityValidationError{Message: "faculty_id is required"}
	}
	if payload.Code == "" {
		return ActivityValidationError{Message: "code is required"}
	}
	if payload.NameTH == "" {
		return ActivityValidationError{Message: "name_th is required"}
	}
	return nil
}

func payloadChangesActivityIdentity(payload models.UpsertActivityPayload, existing *models.Activity) bool {
	normalized := normalizeActivityPayload(payload)
	if normalized.FacultyID != 0 && normalized.FacultyID != existing.FacultyID {
		return true
	}
	if normalized.Code != "" && normalized.Code != existing.Code {
		return true
	}
	if normalized.NameTH != "" && normalized.NameTH != existing.NameTH {
		return true
	}
	if payload.NameEN != nil && !nullableStringEqual(normalized.NameEN, existing.NameEN) {
		return true
	}
	return false
}

func nullableStringEqual(a *string, b *string) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}

func mapActivityNoRows(activity *models.Activity, err error) (*models.Activity, error) {
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrActivityNotFound
	}
	return activity, err
}
