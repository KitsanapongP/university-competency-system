package services

import (
    "context"
    "strconv"
    "time"

    "github.com/spw32767/university-competency-system-backend/repositories"
)

type CompetencyService struct {
    Repo *repositories.CompetencyRepository
}

func NewCompetencyService(repo *repositories.CompetencyRepository) *CompetencyService {
    return &CompetencyService{Repo: repo}
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
    Competencies  []Competency         `json:"competencies"`
    Requirements  map[int64]float64    `json:"requirements"`
    Activities    map[int64][]Activity `json:"activities"`
    AvailableYear []string             `json:"available_years"`
}

// BuildDashboard สร้าง dashboard data แบ่งตาม category
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