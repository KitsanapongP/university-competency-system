package services

import (
	"context"
	"database/sql"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
)

var (
	ErrCompetencyNotFound = errors.New("competency not found")
)

type CompetencyService struct {
	Repo *repositories.CompetencyRepository
}

func NewCompetencyService(repo *repositories.CompetencyRepository) *CompetencyService {
	return &CompetencyService{Repo: repo}
}

type CompetencyValidationError struct {
	Message string
}

func (e CompetencyValidationError) Error() string {
	return e.Message
}

type CompetencyConflictError struct {
	Code    string
	Message string
}

func (e CompetencyConflictError) Error() string {
	return e.Message
}

type Competency struct {
	ID     int64   `json:"id"`
	Code   string  `json:"code"`
	NameTH string  `json:"name_th"`
	NameEN *string `json:"name_en,omitempty"`
}

type Activity struct {
	ID           int64   `json:"id"`
	Title        string  `json:"title"`
	Date         string  `json:"date"`
	Year         string  `json:"year"`
	Month        int     `json:"month"`
	Score        float64 `json:"score"`
	MaxScore     float64 `json:"max_score"`
	Type         string  `json:"type"`
	Status       string  `json:"status"`
	CompetencyID int64   `json:"competency_id"`
}

type DashboardData struct {
	Competencies  []Competency                        `json:"competencies"`
	Requirements  map[int64]float64                   `json:"requirements"`
	Activities    map[int64][]Activity                `json:"activities"`
	AvailableYear []string                            `json:"available_years"`
	Progress      map[int64]LearnerCompetencyProgress `json:"progress"`
}

type LearnerCompetencyProgress struct {
	CoreScore        float64 `json:"core_score"`
	CourseBonusScore float64 `json:"course_bonus_score"`
	CourseTotalScore float64 `json:"course_total_score"`
	ActivityScore    float64 `json:"activity_score"`
	AccumulatedScore float64 `json:"accumulated_score"`
	TargetScore      float64 `json:"target_score"`
	Passed           bool    `json:"passed"`
}

// GetAllCompetencies ดึง competencies ทั้งหมดในระบบ
func (s *CompetencyService) GetAllCompetencies(ctx context.Context) ([]Competency, error) {
	records, err := s.Repo.GetCompetencies(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]Competency, 0, len(records))
	for _, rec := range records {
		result = append(result, Competency{
			ID:     rec.ID,
			Code:   rec.Code,
			NameTH: rec.NameTH,
			NameEN: rec.NameEN,
		})
	}
	return result, nil
}

// BuildDashboard สร้าง dashboard data แบ่งตาม category
func (s *CompetencyService) GetCompetencyOptions(ctx context.Context) ([]*models.CompetencyOption, error) {
	return s.Repo.GetCompetencyOptions(ctx)
}

func (s *CompetencyService) CreateCompetency(ctx context.Context, payload models.UpsertCompetencyPayload) (*models.CompetencyOption, error) {
	normalized := normalizeCompetencyPayload(payload)
	if err := validateCompetencyPayload(normalized); err != nil {
		return nil, err
	}
	return s.Repo.CreateCompetency(ctx, normalized)
}

func (s *CompetencyService) UpdateCompetency(ctx context.Context, competencyID uint64, payload models.UpsertCompetencyPayload) (*models.CompetencyOption, error) {
	if _, err := s.Repo.GetCompetencyByID(ctx, competencyID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrCompetencyNotFound
		}
		return nil, err
	}
	normalized := normalizeCompetencyPayload(payload)
	if err := validateCompetencyPayload(normalized); err != nil {
		return nil, err
	}

	competency, err := s.Repo.UpdateCompetency(ctx, competencyID, normalized)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrCompetencyNotFound
	}
	return competency, err
}

func (s *CompetencyService) DeleteCompetency(ctx context.Context, competencyID uint64) error {
	if _, err := s.Repo.GetCompetencyByID(ctx, competencyID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrCompetencyNotFound
		}
		return err
	}
	if err := s.ensureCompetencyEditable(ctx, competencyID); err != nil {
		return err
	}
	if err := s.Repo.SoftDeleteCompetency(ctx, competencyID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrCompetencyNotFound
		}
		return err
	}
	return nil
}

func (s *CompetencyService) ensureCompetencyEditable(ctx context.Context, competencyID uint64) error {
	usageCount, err := s.Repo.CountTemplateUsageForCompetency(ctx, competencyID)
	if err != nil {
		return err
	}
	if usageCount > 0 {
		return CompetencyConflictError{
			Code:    "COMPETENCY_IN_USE",
			Message: "competency is used by templates",
		}
	}
	return nil
}

func normalizeCompetencyPayload(payload models.UpsertCompetencyPayload) models.UpsertCompetencyPayload {
	payload.Code = strings.TrimSpace(payload.Code)
	payload.NameTH = strings.TrimSpace(payload.NameTH)
	payload.NameEN = trimNullableString(payload.NameEN)
	payload.Description = trimNullableString(payload.Description)
	return payload
}

func validateCompetencyPayload(payload models.UpsertCompetencyPayload) error {
	if payload.Code == "" {
		return CompetencyValidationError{Message: "code is required"}
	}
	if payload.NameTH == "" {
		return CompetencyValidationError{Message: "name_th is required"}
	}
	return nil
}

func trimNullableString(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func (s *CompetencyService) BuildDashboard(ctx context.Context, userID int64, category string) (*DashboardData, error) {
	personID, err := s.Repo.ResolvePersonID(ctx, userID)
	if err != nil {
		return nil, err
	}

	// ดึง competencies ทั้งหมด (ไม่ว่าจะเป็น activity หรือ course)
	competencies, err := s.Repo.GetCompetencies(ctx)
	if err != nil {
		return nil, err
	}

	// สร้าง empty dashboard data
	data := &DashboardData{
		Competencies:  make([]Competency, 0, len(competencies)),
		Requirements:  make(map[int64]float64),
		Activities:    make(map[int64][]Activity),
		AvailableYear: []string{},
		Progress:      make(map[int64]LearnerCompetencyProgress),
	}

	progressRows, err := s.Repo.GetLearnerCompetencyProgress(ctx, personID)
	if err != nil {
		return nil, err
	}
	for competencyID, progress := range progressRows {
		data.Progress[competencyID] = LearnerCompetencyProgress{
			CoreScore: progress.CoreScore, CourseBonusScore: progress.CourseBonusScore,
			CourseTotalScore: progress.CoreScore + progress.CourseBonusScore,
			ActivityScore:    progress.ActivityScore, AccumulatedScore: progress.AccumulatedScore,
			TargetScore: progress.TargetScore, Passed: progress.Passed,
		}
		data.Requirements[competencyID] = progress.TargetScore
	}

	// เติม competencies data
	for _, comp := range competencies {
		data.Competencies = append(data.Competencies, Competency{
			ID:     comp.ID,
			Code:   comp.Code,
			NameTH: comp.NameTH,
			NameEN: comp.NameEN,
		})
	}

	// แบ่งการจัดการตาม category
	if category == "activity" {
		// === ACTIVITY MODE ===
		// ดึง activities ของนิสิต
		activityRows, err := s.Repo.GetActivitiesByPerson(ctx, personID)
		if err != nil {
			return nil, err
		}

		// ประมวลผล activities เป็น map
		activitiesByCompetency := s.processActivities(activityRows)
		data.Activities = activitiesByCompetency

		// ดึง available years จาก activities
		yearsSet := s.extractYearsFromActivities(activityRows)
		for year := range yearsSet {
			data.AvailableYear = append(data.AvailableYear, year)
		}

		// Requirements ตามหลักสูตรปัจจุบัน
		curriculumID, err := s.Repo.GetCurrentCurriculumID(ctx, personID)
		if err != nil {
			return nil, err
		}
		if curriculumID != 0 {
			requirements, err := s.Repo.GetRequirementsByCurriculum(ctx, curriculumID)
			if err != nil {
				return nil, err
			}
			data.Requirements = requirements
		}

	} else if category == "course" {
		// === COURSE MODE ===
		// ดึง course/หลักสูตรของนิสิต
		courseRows, err := s.Repo.GetCoursesByPerson(ctx, personID)
		if err != nil {
			return nil, err
		}

		// ประมวลผล courses เป็น map activities
		activitiesByCompetency := s.processCourses(courseRows)
		data.Activities = activitiesByCompetency

		// ดึง available years จาก courses
		yearsSet := s.extractYearsFromCourses(courseRows)
		for year := range yearsSet {
			data.AvailableYear = append(data.AvailableYear, year)
		}

		// Requirements ตามหลักสูตรของนิสิต
		curriculumID, err := s.Repo.GetCurrentCurriculumID(ctx, personID)
		if err != nil {
			return nil, err
		}
		if curriculumID != 0 {
			requirements, err := s.Repo.GetRequirementsByCurriculum(ctx, curriculumID)
			if err != nil {
				return nil, err
			}
			data.Requirements = requirements
		}
	}

	return data, nil
}

// processActivities ประมวลผล activity rows เป็น map
func (s *CompetencyService) processActivities(activityRows []repositories.ActivityRecord) map[int64][]Activity {
	activitiesByCompetency := make(map[int64][]Activity)

	for _, row := range activityRows {
		date := ""
		year := ""
		month := 0
		if row.StartAt.Valid {
			t := row.StartAt.Time
			date = t.Format("02 Jan 2006")
			year = toAcademicYear(t)
			month = int(t.Month())
		}

		status := "available"
		score := 0.0
		if row.EarnedPercent.Valid {
			status = "completed"
			score = row.EarnedPercent.Float64
		}

		actType := "Activity"
		if row.ActivityType != nil && *row.ActivityType != "" {
			actType = *row.ActivityType
		} else if row.ActivityCategory != nil && *row.ActivityCategory != "" {
			actType = *row.ActivityCategory
		}

		activitiesByCompetency[row.CompetencyID] = append(activitiesByCompetency[row.CompetencyID], Activity{
			ID:           row.SessionCompetencyID,
			Title:        row.ActivityName,
			Date:         date,
			Year:         year,
			Month:        month,
			Score:        score,
			MaxScore:     row.MaxPercent,
			Type:         actType,
			Status:       status,
			CompetencyID: row.CompetencyID,
		})
	}

	return activitiesByCompetency
}

// processCourses ประมวลผล course rows เป็น map
func (s *CompetencyService) processCourses(courseRows []repositories.CourseRecord) map[int64][]Activity {
	activitiesByCompetency := make(map[int64][]Activity)

	for _, row := range courseRows {
		year := row.AcademicYear // ปีการศึกษา (Buddhist Era)
		date := year             // ใช้ปีเป็น date string
		month := 0               // ไม่ได้เดือนสำหรับหลักสูตร

		status := "completed"
		score := 0.0
		if row.Score.Valid {
			score = row.Score.Float64
		}

		actType := "Course" // ประเภทเป็น "Course"

		activitiesByCompetency[row.CompetencyID] = append(activitiesByCompetency[row.CompetencyID], Activity{
			ID:           row.CourseID,
			Title:        row.CourseName,
			Date:         date,
			Year:         year,
			Month:        month,
			Score:        score,
			MaxScore:     100.0, // หรือดึงจาก database ถ้ามี
			Type:         actType,
			Status:       status,
			CompetencyID: row.CompetencyID,
		})
	}

	return activitiesByCompetency
}

// extractYearsFromActivities ดึง years จาก activity rows
func (s *CompetencyService) extractYearsFromActivities(activityRows []repositories.ActivityRecord) map[string]struct{} {
	yearsSet := make(map[string]struct{})
	for _, row := range activityRows {
		if row.StartAt.Valid {
			year := toAcademicYear(row.StartAt.Time)
			yearsSet[year] = struct{}{}
		}
	}
	return yearsSet
}

// extractYearsFromCourses ดึง years จาก course rows
func (s *CompetencyService) extractYearsFromCourses(courseRows []repositories.CourseRecord) map[string]struct{} {
	yearsSet := make(map[string]struct{})
	for _, row := range courseRows {
		yearsSet[row.AcademicYear] = struct{}{}
	}
	return yearsSet
}

// helper function
func toAcademicYear(t time.Time) string {
	return strconv.Itoa(t.Year() + 543)
}
