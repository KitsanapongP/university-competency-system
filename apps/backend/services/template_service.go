package services

import (
	"context"
	"errors"
	"fmt"
	"math"

	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
)

type TemplateService struct {
	Repo *repositories.TemplateRepository
}

func NewTemplateService(repo *repositories.TemplateRepository) *TemplateService {
	return &TemplateService{Repo: repo}
}

func (s *TemplateService) GetTemplatesByFaculty(ctx context.Context, facultyID uint64) ([]models.Template, error) {
	return s.Repo.GetTemplatesByFaculty(ctx, facultyID)
}

func (s *TemplateService) GetTemplateByID(ctx context.Context, templateID uint64) (*models.Template, error) {
	return s.Repo.GetTemplateByID(ctx, templateID)
}

func (s *TemplateService) CreateTemplate(ctx context.Context, facultyID uint64, userID uint64, req models.CreateTemplateRequest) (*models.Template, error) {
	if req.Name == "" {
		return nil, errors.New("กรุณาระบุชื่อ Template")
	}
	if len(req.CompetencyIDs) == 0 && len(req.NewCompetencies) == 0 {
		return nil, errors.New("กรุณาเลือกหรือเพิ่ม Competency อย่างน้อย 1 ตัว")
	}

	return s.Repo.CreateTemplate(ctx, facultyID, userID, req)
}

func (s *TemplateService) UpdateTemplateStatus(ctx context.Context, templateID uint64, req models.UpdateTemplateStatusRequest) error {
	t, err := s.Repo.GetTemplateByID(ctx, templateID)
	if err != nil {
		return err
	}
	if t == nil {
		return errors.New("ไม่พบข้อมูล Template")
	}

	isActive := (req.Status == "Active")

	// ถ้าพยายามเปลี่ยนเป็น Active ต้องทำการตรวจสอบกฎ (Validation Guardrails)
	if isActive {
		items, err := s.Repo.GetTemplateItems(ctx, templateID)
		if err != nil {
			return err
		}

		if len(items) == 0 {
			return errors.New("ไม่สามารถเปิดใช้งานได้เนื่องจากยังไม่มีสมรรถนะใน Template")
		}

		// คำนวณน้ำหนักรวมของแต่ละสมรรถนะที่ผูกกับรายวิชา
		weightSums := make(map[uint64]float64)
		compNames := make(map[uint64]string)
		hasCourseMapping := false

		for _, item := range items {
			compNames[item.CompetencyID] = item.CompetencyName
			if item.CourseID != nil && item.Weight != nil {
				hasCourseMapping = true
				weightSums[item.CompetencyID] += *item.Weight
			}
		}

		if !hasCourseMapping {
			return errors.New("ไม่สามารถเปิดใช้งานได้: ยังไม่มีการกำหนดค่าน้ำหนักรายวิชา")
		}

		// ตรวจสอบว่าสมรรถนะแต่ละตัวมีน้ำหนักรวมครบ 100% พอดี
		for compID, sum := range weightSums {
			if math.Abs(sum-100.0) > 0.05 {
				name := compNames[compID]
				if name == "" {
					name = fmt.Sprintf("รหัส %d", compID)
				}
				return fmt.Errorf("ไม่สามารถเปิดใช้งานได้: สมรรถนะ '%s' มีผลรวมน้ำหนัก %.2f%% (ต้องครบ 100%% พอดี)", name, sum)
			}
		}
	}

	return s.Repo.UpdateTemplateStatus(ctx, templateID, isActive)
}

func (s *TemplateService) SaveTemplateItems(ctx context.Context, templateID uint64, req models.UpdateTemplateItemsRequest) error {
	t, err := s.Repo.GetTemplateByID(ctx, templateID)
	if err != nil {
		return err
	}
	if t == nil {
		return errors.New("ไม่พบข้อมูล Template")
	}

	// Business Rule: ห้ามแก้ไขค่าน้ำหนักขณะที่ Template เป็น Active
	if t.IsActive {
		return errors.New("ไม่สามารถบันทึกค่าน้ำหนักได้ในขณะที่ Template มีสถานะพร้อมใช้งาน (Active) กรุณาเปลี่ยนสถานะเป็นปิดใช้งานก่อนแก้ไข")
	}

	return s.Repo.SaveTemplateItems(ctx, templateID, req.Items)
}

func (s *TemplateService) GetTemplateItems(ctx context.Context, templateID uint64) ([]models.TemplateItem, error) {
	return s.Repo.GetTemplateItems(ctx, templateID)
}

func (s *TemplateService) DeleteTemplate(ctx context.Context, templateID uint64) error {
	t, err := s.Repo.GetTemplateByID(ctx, templateID)
	if err != nil {
		return err
	}
	if t == nil {
		return errors.New("ไม่พบข้อมูล Template")
	}

	if t.IsActive {
		return errors.New("ไม่สามารถลบ Template ที่เปิดใช้งานอยู่ได้ กรุณาปิดใช้งานก่อน")
	}

	return s.Repo.DeleteTemplate(ctx, templateID)
}
