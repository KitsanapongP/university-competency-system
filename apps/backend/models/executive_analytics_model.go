package models

type ExecutiveAnalyticsFilters struct {
	FacultyID    *uint64
	MajorID      *uint64
	CurriculumID *uint64
	CohortID     *uint64
	EntryYearBE  *uint64
	CompetencyID *uint64
	EnrollmentID *uint64
}

type ExecutiveFacultyOption struct {
	FacultyID uint64 `json:"faculty_id"`
	NameTH    string `json:"name_th"`
	NameEN    string `json:"name_en,omitempty"`
}

type ExecutiveMajorOption struct {
	MajorID   uint64 `json:"major_id"`
	FacultyID uint64 `json:"faculty_id"`
	NameTH    string `json:"name_th"`
	NameEN    string `json:"name_en,omitempty"`
}

type ExecutiveCurriculumOption struct {
	CurriculumID uint64 `json:"curriculum_id"`
	MajorID      uint64 `json:"major_id"`
	FacultyID    uint64 `json:"faculty_id"`
	Code         string `json:"code"`
	NameTH       string `json:"name_th"`
	NameEN       string `json:"name_en,omitempty"`
	Year         uint64 `json:"effective_year_be"`
}

type ExecutiveCohortOption struct {
	CohortID     uint64 `json:"cohort_id"`
	CurriculumID uint64 `json:"curriculum_id"`
	Code         string `json:"curriculum_code"`
	NameTH       string `json:"curriculum_name_th"`
	NameEN       string `json:"curriculum_name_en,omitempty"`
	EntryYearBE  uint64 `json:"entry_year_be"`
}

type ExecutiveScopeResponse struct {
	Faculties  []ExecutiveFacultyOption    `json:"faculties"`
	Majors     []ExecutiveMajorOption      `json:"majors"`
	Curricula  []ExecutiveCurriculumOption `json:"curricula"`
	Cohorts    []ExecutiveCohortOption     `json:"cohorts"`
	EntryYears []uint64                    `json:"entry_years"`
}

type ExecutiveCohortSummary struct {
	CohortID              uint64 `json:"cohort_id"`
	CurriculumID          uint64 `json:"curriculum_id"`
	CurriculumCode        string `json:"curriculum_code"`
	CurriculumNameTH      string `json:"curriculum_name_th"`
	CurriculumNameEN      string `json:"curriculum_name_en,omitempty"`
	MajorID               uint64 `json:"major_id"`
	MajorNameTH           string `json:"major_name_th"`
	FacultyID             uint64 `json:"faculty_id"`
	FacultyNameTH         string `json:"faculty_name_th"`
	EntryYearBE           uint64 `json:"entry_year_be"`
	StudentCount          int    `json:"student_count"`
	HasTemplate           bool   `json:"has_template"`
	HasRequirements       bool   `json:"has_requirements"`
	HasScores             bool   `json:"has_scores"`
	RecalculationRequired bool   `json:"recalculation_required"`
	Ready                 bool   `json:"ready"`
	ReadinessCode         string `json:"readiness_code"`
	ReadinessMessageTH    string `json:"readiness_message_th"`
	ReadinessMessageEN    string `json:"readiness_message_en"`
}

type ExecutiveCompetencyAggregate struct {
	CohortID       uint64  `json:"cohort_id"`
	EntryYearBE    uint64  `json:"entry_year_be"`
	CompetencyID   uint64  `json:"competency_id"`
	Code           string  `json:"code"`
	NameTH         string  `json:"name_th"`
	NameEN         string  `json:"name_en,omitempty"`
	TargetScore    float64 `json:"target_score"`
	IsRequired     bool    `json:"is_required"`
	AverageScore   float64 `json:"average_score"`
	EvaluatedCount int     `json:"evaluated_count"`
	PassedCount    int     `json:"passed_count"`
	PassRate       float64 `json:"pass_rate"`
}

type ExecutiveCompetencySummary struct {
	CompetencyID   uint64  `json:"competency_id"`
	Code           string  `json:"code"`
	NameTH         string  `json:"name_th"`
	NameEN         string  `json:"name_en,omitempty"`
	TargetScore    float64 `json:"target_score"`
	IsRequired     bool    `json:"is_required"`
	AverageScore   float64 `json:"average_score"`
	EvaluatedCount int     `json:"evaluated_count"`
	PassedCount    int     `json:"passed_count"`
	PassRate       float64 `json:"pass_rate"`
}

type ExecutiveCourseSource struct {
	CohortID     uint64  `json:"cohort_id"`
	CourseID     uint64  `json:"course_id"`
	CourseCode   string  `json:"course_code"`
	CourseNameTH string  `json:"course_name_th"`
	CourseNameEN string  `json:"course_name_en,omitempty"`
	TemplateID   uint64  `json:"template_id"`
	TemplateName string  `json:"template_name"`
	Contribution float64 `json:"contribution"`
	StudentCount int     `json:"student_count"`
}

type ExecutiveStudentSummary struct {
	EnrollmentID        uint64  `json:"enrollment_id"`
	StudentCode         string  `json:"student_code"`
	StudentNameTH       string  `json:"student_name_th"`
	StudentNameEN       string  `json:"student_name_en,omitempty"`
	CohortID            uint64  `json:"cohort_id"`
	CurriculumCode      string  `json:"curriculum_code"`
	CurriculumNameTH    string  `json:"curriculum_name_th"`
	EntryYearBE         uint64  `json:"entry_year_be"`
	CourseTotalScore    float64 `json:"course_total_score"`
	TargetScore         float64 `json:"target_score"`
	RequiredCount       int     `json:"required_count"`
	EvaluatedCount      int     `json:"evaluated_count"`
	PassedRequiredCount int     `json:"passed_required_count"`
	Passed              bool    `json:"passed"`
	Ready               bool    `json:"ready"`
}

type ExecutiveStudentCompetency struct {
	CompetencyID uint64  `json:"competency_id"`
	Code         string  `json:"code"`
	NameTH       string  `json:"name_th"`
	NameEN       string  `json:"name_en,omitempty"`
	TargetScore  float64 `json:"target_score"`
	IsRequired   bool    `json:"is_required"`
	CourseTotal  float64 `json:"course_total_score"`
	Passed       bool    `json:"passed"`
	HasScore     bool    `json:"has_score"`
}

type ExecutiveStudentDetail struct {
	Student      ExecutiveStudentSummary      `json:"student"`
	Competencies []ExecutiveStudentCompetency `json:"competencies"`
	Sources      []ExecutiveCourseSource      `json:"sources"`
}

type ExecutiveOverviewResponse struct {
	Metrics      map[string]any               `json:"metrics"`
	Cohorts      []ExecutiveCohortSummary     `json:"cohorts"`
	Competencies []ExecutiveCompetencySummary `json:"competencies"`
	Attention    []ExecutiveCompetencySummary `json:"attention"`
}

type ExecutiveCompetencyDetailResponse struct {
	Competency ExecutiveCompetencySummary     `json:"competency"`
	Cohorts    []ExecutiveCompetencyAggregate `json:"cohorts"`
	Sources    []ExecutiveCourseSource        `json:"sources"`
}

type ExecutiveComparisonRow struct {
	EntryYearBE    uint64  `json:"entry_year_be"`
	CohortCount    int     `json:"cohort_count"`
	CompetencyID   uint64  `json:"competency_id"`
	Code           string  `json:"code"`
	NameTH         string  `json:"name_th"`
	NameEN         string  `json:"name_en,omitempty"`
	AverageScore   float64 `json:"average_score"`
	PassRate       float64 `json:"pass_rate"`
	EvaluatedCount int     `json:"evaluated_count"`
}

type ExecutiveStudentFact struct {
	EnrollmentID     uint64
	StudentCode      string
	StudentNameTH    string
	StudentNameEN    string
	CohortID         uint64
	CurriculumCode   string
	CurriculumNameTH string
	EntryYearBE      uint64
	CompetencyID     uint64
	CompetencyCode   string
	CompetencyNameTH string
	CompetencyNameEN string
	TargetScore      float64
	IsRequired       bool
	CourseTotal      float64
	HasScore         bool
}
