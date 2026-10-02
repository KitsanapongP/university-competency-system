package services

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
)

var (
	ErrCareerPathForbidden = errors.New("career path access forbidden")
	ErrCareerPathInvalid   = errors.New("career path payload is invalid")
)

type CareerPathStore interface {
	List(context.Context, models.CareerPathFilters) ([]models.CareerPathSummary, int, error)
	Get(context.Context, uint64) (*models.CareerPath, error)
	CreateDraft(context.Context, models.CareerPathDraftPayload, uint64) (uint64, error)
	UpdateDraft(context.Context, uint64, uint64, uint64, models.CareerPathDraftPayload) error
	PublishMany(context.Context, []uint64, uint64) error
	DeactivateMany(context.Context, []uint64) error
	SoftDelete(context.Context, uint64) error
}

type CareerPathService struct {
	Repo CareerPathStore
}

func NewCareerPathService(repo CareerPathStore) *CareerPathService {
	return &CareerPathService{Repo: repo}
}

func (s *CareerPathService) List(ctx context.Context, roles []string, facultyID *int64, filters models.CareerPathFilters) (*models.CareerPathListResponse, error) {
	if !careerPathCanManage(roles) {
		return nil, ErrCareerPathForbidden
	}
	if err := normalizeCareerPathFilters(&filters); err != nil {
		return nil, err
	}
	if !hasRole(roles, "admin") {
		if !hasRole(roles, "officer") || facultyID == nil || *facultyID <= 0 {
			return nil, ErrCareerPathForbidden
		}
		faculty := uint64(*facultyID)
		if filters.FacultyID != nil && *filters.FacultyID != faculty {
			return nil, ErrCareerPathForbidden
		}
		filters.FacultyID = &faculty
	}
	items, total, err := s.Repo.List(ctx, filters)
	if err != nil {
		return nil, err
	}
	return &models.CareerPathListResponse{Items: items, Total: total, Page: filters.Page, PageSize: filters.PageSize}, nil
}

func (s *CareerPathService) Get(ctx context.Context, careerPathID uint64, roles []string, facultyID *int64) (*models.CareerPath, error) {
	if !careerPathCanManage(roles) {
		return nil, ErrCareerPathForbidden
	}
	path, err := s.Repo.Get(ctx, careerPathID)
	if err != nil {
		return nil, err
	}
	if !careerPathInFaculty(path.FacultyID, roles, facultyID) {
		return nil, ErrCareerPathForbidden
	}
	return path, nil
}

func (s *CareerPathService) CreateDraft(ctx context.Context, payload models.CareerPathDraftPayload, userID uint64, roles []string, facultyID *int64) (*models.CareerPath, error) {
	if !careerPathCanManage(roles) {
		return nil, ErrCareerPathForbidden
	}
	faculty, err := resolveCareerPathFaculty(payload.FacultyID, roles, facultyID)
	if err != nil {
		return nil, err
	}
	payload.FacultyID = &faculty
	if err := validateCareerPathDraft(payload); err != nil {
		return nil, err
	}
	careerPathID, err := s.Repo.CreateDraft(ctx, payload, userID)
	if err != nil {
		return nil, err
	}
	return s.Repo.Get(ctx, careerPathID)
}

func (s *CareerPathService) UpdateDraft(ctx context.Context, careerPathID uint64, payload models.CareerPathDraftUpdate, userID uint64, roles []string, facultyID *int64) (*models.CareerPath, error) {
	path, err := s.Get(ctx, careerPathID, roles, facultyID)
	if err != nil {
		return nil, err
	}
	if payload.FacultyID != nil && *payload.FacultyID != path.FacultyID {
		return nil, ErrCareerPathForbidden
	}
	draft := payload.CareerPathDraftPayload
	draft.FacultyID = &path.FacultyID
	if err := validateCareerPathDraft(draft); err != nil {
		return nil, err
	}
	if err := s.Repo.UpdateDraft(ctx, careerPathID, payload.ExpectedVersionID, userID, draft); err != nil {
		return nil, err
	}
	return s.Repo.Get(ctx, careerPathID)
}

func (s *CareerPathService) Publish(ctx context.Context, careerPathIDs []uint64, userID uint64, roles []string, facultyID *int64) error {
	ids, err := normalizeCareerPathIDs(careerPathIDs)
	if err != nil {
		return err
	}
	for _, id := range ids {
		path, err := s.Get(ctx, id, roles, facultyID)
		if err != nil {
			return err
		}
		if path.DraftVersion == nil || !careerPathPublishable(*path.DraftVersion) {
			return fmt.Errorf("%w: career path %d is missing required draft fields", ErrCareerPathInvalid, id)
		}
	}
	return s.Repo.PublishMany(ctx, ids, userID)
}

func (s *CareerPathService) Deactivate(ctx context.Context, careerPathIDs []uint64, roles []string, facultyID *int64) error {
	ids, err := normalizeCareerPathIDs(careerPathIDs)
	if err != nil {
		return err
	}
	for _, id := range ids {
		path, err := s.Get(ctx, id, roles, facultyID)
		if err != nil {
			return err
		}
		if path.PublishedVersion == nil || path.Status != "active" {
			return fmt.Errorf("%w: only active career paths can be deactivated", ErrCareerPathInvalid)
		}
	}
	return s.Repo.DeactivateMany(ctx, ids)
}

func (s *CareerPathService) Delete(ctx context.Context, careerPathID uint64, roles []string, facultyID *int64) error {
	if _, err := s.Get(ctx, careerPathID, roles, facultyID); err != nil {
		return err
	}
	return s.Repo.SoftDelete(ctx, careerPathID)
}

func careerPathCanManage(roles []string) bool {
	return hasRole(roles, "admin") || hasRole(roles, "officer")
}

func careerPathInFaculty(pathFacultyID uint64, roles []string, facultyID *int64) bool {
	if hasRole(roles, "admin") {
		return true
	}
	return hasRole(roles, "officer") && facultyID != nil && *facultyID > 0 && pathFacultyID == uint64(*facultyID)
}

func resolveCareerPathFaculty(requested *uint64, roles []string, facultyID *int64) (uint64, error) {
	if hasRole(roles, "admin") {
		if requested == nil || *requested == 0 {
			return 0, ErrCareerPathInvalid
		}
		return *requested, nil
	}
	if !hasRole(roles, "officer") || facultyID == nil || *facultyID <= 0 {
		return 0, ErrCareerPathForbidden
	}
	faculty := uint64(*facultyID)
	if requested != nil && *requested != faculty {
		return 0, ErrCareerPathForbidden
	}
	return faculty, nil
}

func normalizeCareerPathFilters(filters *models.CareerPathFilters) error {
	if filters.Status != "" && filters.Status != "draft" && filters.Status != "active" && filters.Status != "inactive" {
		return ErrCareerPathInvalid
	}
	if filters.CurriculumID != nil && (*filters.CurriculumID == 0 || filters.WithoutCurriculum) {
		return ErrCareerPathInvalid
	}
	if filters.SortBy == "" {
		filters.SortBy = "name"
	}
	if filters.SortOrder == "" {
		filters.SortOrder = "asc"
	}
	if filters.Language == "" {
		filters.Language = "th"
	}
	if (filters.SortBy != "name" && filters.SortBy != "faculty") ||
		(filters.SortOrder != "asc" && filters.SortOrder != "desc") ||
		(filters.Language != "th" && filters.Language != "en") {
		return ErrCareerPathInvalid
	}
	if filters.Page == 0 {
		filters.Page = 1
	}
	if filters.PageSize == 0 {
		filters.PageSize = 25
	}
	if filters.Page < 1 || filters.PageSize < 1 || filters.PageSize > 100 {
		return ErrCareerPathInvalid
	}
	filters.Search = strings.TrimSpace(filters.Search)
	return nil
}

func validateCareerPathDraft(payload models.CareerPathDraftPayload) error {
	if payload.FacultyID == nil || *payload.FacultyID == 0 || len(strings.TrimSpace(payload.Code)) == 0 || len(strings.TrimSpace(payload.Code)) > 80 || strings.TrimSpace(payload.NameTH) == "" {
		return ErrCareerPathInvalid
	}
	if hasDuplicateCareerPathIDs(payload.CurriculumIDs) || hasDuplicateCareerPathIDs(payload.CompetencyIDs) {
		return ErrCareerPathInvalid
	}
	for _, id := range append(append([]uint64{}, payload.CurriculumIDs...), payload.CompetencyIDs...) {
		if id == 0 {
			return ErrCareerPathInvalid
		}
	}
	payload.Code = strings.TrimSpace(payload.Code)
	payload.NameTH = strings.TrimSpace(payload.NameTH)
	return nil
}

func careerPathPublishable(version models.CareerPathVersion) bool {
	hasSkill := (version.SkillsTH != nil && strings.TrimSpace(*version.SkillsTH) != "") || len(version.Competencies) > 0
	return strings.TrimSpace(version.NameTH) != "" && version.DescriptionTH != nil &&
		strings.TrimSpace(*version.DescriptionTH) != "" && len(version.Curricula) > 0 && hasSkill
}

func normalizeCareerPathIDs(ids []uint64) ([]uint64, error) {
	if len(ids) == 0 || hasDuplicateCareerPathIDs(ids) {
		return nil, ErrCareerPathInvalid
	}
	for _, id := range ids {
		if id == 0 {
			return nil, ErrCareerPathInvalid
		}
	}
	return ids, nil
}

func hasDuplicateCareerPathIDs(ids []uint64) bool {
	seen := make(map[uint64]struct{}, len(ids))
	for _, id := range ids {
		if _, exists := seen[id]; exists {
			return true
		}
		seen[id] = struct{}{}
	}
	return false
}

func mapCareerPathRepositoryError(err error) error {
	if errors.Is(err, repositories.ErrCareerPathNotFound) || errors.Is(err, repositories.ErrCareerPathConflict) || errors.Is(err, repositories.ErrCareerPathInvalidScope) {
		return err
	}
	return err
}
