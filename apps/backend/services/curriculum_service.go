package services

import (
	"context"
	"errors"

	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
)

type CurriculumService struct {
	Repo *repositories.CurriculumRepository
}

func NewCurriculumService(repo *repositories.CurriculumRepository) *CurriculumService {
	return &CurriculumService{Repo: repo}
}

func (s *CurriculumService) GetActiveCurriculums(ctx context.Context) ([]*models.Curriculum, error) {
	return s.Repo.GetActiveCurriculums(ctx)
}

func (s *CurriculumService) GetCurriculumByID(ctx context.Context, id uint64) (*models.Curriculum, error) {
	return s.Repo.GetCurriculumByID(ctx, id)
}

func (s *CurriculumService) CreateCurriculum(ctx context.Context, payload models.CreateCurriculumPayload) (*models.Curriculum, error) {
	// Validation
	if payload.CurriculumCode == "" {
		return nil, errors.New("curriculum code is required")
	}
	if payload.CurriculumNameTH == "" {
		return nil, errors.New("curriculum name TH is required")
	}
	if payload.EffectiveYearBE == 0 {
		return nil, errors.New("effective year BE is required")
	}

	// Validate categories
	for _, cat := range payload.Categories {
		if cat.NameTH == "" {
			return nil, errors.New("category name TH is required")
		}
	}

	return s.Repo.CreateCurriculumTx(ctx, payload)
}
