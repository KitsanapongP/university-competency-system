package services

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"

	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
)

type TemplateService struct {
	Repo *repositories.TemplateRepository
}

// TemplateCompetencyError is a client-safe error returned by competency association APIs.
type TemplateCompetencyError struct {
	Code    string
	Message string
	Data    any
}

type TemplateDuplicateError struct {
	Code    string
	Message string
	Data    any
}

func (e *TemplateDuplicateError) Error() string {
	return e.Message
}

func (e *TemplateCompetencyError) Error() string {
	return e.Message
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

func (s *TemplateService) prepareTemplateDuplicate(ctx context.Context, sourceID, facultyID uint64, isAdmin bool, req models.DuplicateTemplateRequest) (*models.TemplateDuplicatePreview, error) {
	if strings.TrimSpace(req.Name) == "" {
		return nil, &TemplateDuplicateError{Code: "BAD_REQUEST", Message: "template name is required"}
	}
	if req.CurriculumID == 0 {
		return nil, &TemplateDuplicateError{Code: "BAD_REQUEST", Message: "target curriculum is required"}
	}
	if len(uniqueCompetencyIDs(req.CompetencyIDs)) == 0 {
		return nil, &TemplateDuplicateError{Code: "BAD_REQUEST", Message: "at least one competency is required"}
	}
	source, err := s.Repo.GetTemplateByID(ctx, sourceID)
	if err != nil {
		return nil, err
	}
	if source == nil {
		return nil, &TemplateDuplicateError{Code: "NOT_FOUND", Message: "source template not found"}
	}
	if !isAdmin && (facultyID == 0 || source.FacultyID != facultyID) {
		return nil, &TemplateDuplicateError{Code: "FORBIDDEN", Message: "you do not have access to this template"}
	}
	target, err := s.Repo.GetCurriculumDuplicateReference(ctx, req.CurriculumID)
	if err != nil {
		return nil, err
	}
	if target == nil {
		return nil, &TemplateDuplicateError{Code: "NOT_FOUND", Message: "target curriculum not found"}
	}
	if !isAdmin && target.FacultyID != facultyID {
		return nil, &TemplateDuplicateError{Code: "FORBIDDEN", Message: "target curriculum is outside your faculty scope"}
	}
	if target.Status != "active" {
		return nil, &TemplateDuplicateError{Code: "CURRICULUM_INACTIVE", Message: "target curriculum must be active"}
	}

	preview, err := s.Repo.PreviewTemplateDuplicate(ctx, sourceID, req)
	if err != nil {
		return nil, &TemplateDuplicateError{Code: "BAD_REQUEST", Message: err.Error()}
	}
	return preview, nil
}

func (s *TemplateService) PreviewTemplateDuplicate(ctx context.Context, sourceID, facultyID uint64, isAdmin bool, req models.DuplicateTemplateRequest) (*models.TemplateDuplicatePreview, error) {
	return s.prepareTemplateDuplicate(ctx, sourceID, facultyID, isAdmin, req)
}

func (s *TemplateService) DuplicateTemplate(ctx context.Context, sourceID, userID, facultyID uint64, isAdmin bool, req models.DuplicateTemplateRequest) (*models.Template, error) {
	if _, err := s.prepareTemplateDuplicate(ctx, sourceID, facultyID, isAdmin, req); err != nil {
		return nil, err
	}
	created, err := s.Repo.DuplicateTemplate(ctx, sourceID, userID, req)
	if err != nil {
		if strings.Contains(err.Error(), "uq_curri_tpl_cohort") {
			return nil, &TemplateDuplicateError{Code: "TARGET_LINK_EXISTS", Message: "a template already exists for this curriculum and cohort year"}
		}
		return nil, err
	}
	return created, nil
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

func (s *TemplateService) UpdateTemplateName(ctx context.Context, templateID uint64, req models.UpdateTemplateNameRequest) error {
	t, err := s.Repo.GetTemplateByID(ctx, templateID)
	if err != nil {
		return err
	}
	if t == nil {
		return errors.New("ไม่พบข้อมูล Template")
	}
	if req.Name == "" {
		return errors.New("กรุณาระบุชื่อ Template ให้ถูกต้อง")
	}
	return s.Repo.UpdateTemplateName(ctx, templateID, req.Name)
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

	// Business Rule: ห้ามแก้ไขค่าน้ำหนักหรือวิชาขณะที่ Template เป็น Active
	if t.IsActive {
		return errors.New("ไม่สามารถบันทึกค่าน้ำหนักได้ในขณะที่ Template มีสถานะพร้อมใช้งาน (Active) กรุณาเปลี่ยนสถานะเป็นปิดใช้งานก่อนแก้ไข")
	}

	// Business Rule: ตรวจสอบรหัสวิชาเพิ่มเติมไม่ให้ซ้ำกันเอง
	codeMap := make(map[string]bool)
	for _, c := range req.CustomCourses {
		if c.Code == "" {
			continue
		}
		if codeMap[c.Code] {
			return fmt.Errorf("รหัสวิชา '%s' ซ้ำกันเองในรายการวิชาเพิ่มเติม", c.Code)
		}
		codeMap[c.Code] = true
	}

	return s.Repo.SaveTemplateItems(ctx, templateID, req)
}

func (s *TemplateService) GetTemplateItems(ctx context.Context, templateID uint64) ([]models.TemplateItem, error) {
	return s.Repo.GetTemplateItems(ctx, templateID)
}

func (s *TemplateService) GetTemplateStructure(ctx context.Context, templateID uint64) (*models.TemplateStructureResponse, error) {
	return s.Repo.GetTemplateStructure(ctx, templateID)
}

func (s *TemplateService) getTemplateForCompetencyManager(ctx context.Context, templateID, facultyID uint64, isAdmin bool) (*models.Template, error) {
	template, err := s.Repo.GetTemplateByID(ctx, templateID)
	if err != nil {
		return nil, err
	}
	if template == nil {
		return nil, &TemplateCompetencyError{Code: "NOT_FOUND", Message: "template not found"}
	}
	if !isAdmin && (facultyID == 0 || template.FacultyID != facultyID) {
		return nil, &TemplateCompetencyError{Code: "FORBIDDEN", Message: "you do not have access to this template"}
	}
	return template, nil
}

func uniqueCompetencyIDs(ids []uint64) []uint64 {
	seen := make(map[uint64]struct{}, len(ids))
	unique := make([]uint64, 0, len(ids))
	for _, id := range ids {
		if id == 0 {
			continue
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		unique = append(unique, id)
	}
	return unique
}

func (s *TemplateService) GetTemplateCompetencies(ctx context.Context, templateID, facultyID uint64, isAdmin bool) (*models.TemplateCompetencyManagementResponse, error) {
	template, err := s.getTemplateForCompetencyManager(ctx, templateID, facultyID, isAdmin)
	if err != nil {
		return nil, err
	}

	competencies, err := s.Repo.GetTemplateCompetencies(ctx, templateID)
	if err != nil {
		return nil, err
	}
	hasScores, err := s.Repo.HasLearnerCourseScores(ctx, templateID)
	if err != nil {
		return nil, err
	}

	response := &models.TemplateCompetencyManagementResponse{
		TemplateID:             template.TemplateID,
		Competencies:           competencies,
		CanManage:              !template.IsActive && !hasScores,
		HasLearnerCourseScores: hasScores,
	}
	if template.IsActive {
		response.LockReason = "template_active"
	} else if hasScores {
		response.LockReason = "learner_course_scores"
	}
	return response, nil
}

func (s *TemplateService) UpdateTemplateCompetencies(ctx context.Context, templateID, facultyID uint64, isAdmin bool, req models.UpdateTemplateCompetenciesRequest) (*models.TemplateCompetencyManagementResponse, error) {
	template, err := s.getTemplateForCompetencyManager(ctx, templateID, facultyID, isAdmin)
	if err != nil {
		return nil, err
	}
	if template.IsActive {
		return nil, &TemplateCompetencyError{Code: "TEMPLATE_ACTIVE", Message: "template is active; deactivate it before managing competencies"}
	}

	hasScores, err := s.Repo.HasLearnerCourseScores(ctx, templateID)
	if err != nil {
		return nil, err
	}
	if hasScores {
		return nil, &TemplateCompetencyError{Code: "TEMPLATE_COMPETENCIES_LOCKED_BY_SCORES", Message: "template competencies cannot be changed because learner course scores exist"}
	}

	selectedIDs := uniqueCompetencyIDs(req.CompetencyIDs)
	if err := s.Repo.ValidateActiveCompetencyIDs(ctx, selectedIDs); err != nil {
		return nil, &TemplateCompetencyError{Code: "BAD_REQUEST", Message: "one or more selected competencies are unavailable"}
	}

	existing, err := s.Repo.GetTemplateCompetencies(ctx, templateID)
	if err != nil {
		return nil, err
	}
	selectedSet := make(map[uint64]struct{}, len(selectedIDs))
	for _, competencyID := range selectedIDs {
		selectedSet[competencyID] = struct{}{}
	}
	removedIDs := make([]uint64, 0)
	for _, competency := range existing {
		if _, kept := selectedSet[competency.CompetencyID]; !kept {
			removedIDs = append(removedIDs, competency.CompetencyID)
		}
	}

	impacts, err := s.Repo.GetTemplateCompetencyImpacts(ctx, templateID, removedIDs)
	if err != nil {
		return nil, err
	}
	if len(impacts) > 0 && !req.ConfirmRemoval {
		return nil, &TemplateCompetencyError{
			Code:    "CONFIRMATION_REQUIRED",
			Message: "removing selected competencies will also remove their course mappings",
			Data: map[string]any{
				"removed_competencies": impacts,
			},
		}
	}

	if err := s.Repo.ReplaceTemplateCompetencies(ctx, templateID, selectedIDs, removedIDs); err != nil {
		return nil, err
	}
	return s.GetTemplateCompetencies(ctx, templateID, facultyID, isAdmin)
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
