package models

import "time"

const (
	CoopCriterionOverallGPA         = "overall_gpa"
	CoopCriterionCategoryGPA        = "category_gpa"
	CoopCriterionCourseGrade        = "course_grade"
	CoopCriterionCategoryCredits    = "category_credits"
	CoopCriterionFreeElectiveCredit = "free_elective_credits"
)

type CooperativeRequirementSet struct {
	RequirementSetID uint64                   `json:"requirement_set_id"`
	CurriculumID     uint64                   `json:"curriculum_id"`
	Semester         uint                     `json:"semester"`
	Revision         uint64                   `json:"revision"`
	Status           string                   `json:"status"`
	CreatedAt        time.Time                `json:"created_at"`
	UpdatedAt        time.Time                `json:"updated_at"`
	PublishedAt      *time.Time               `json:"published_at,omitempty"`
	Requirements     []CooperativeRequirement `json:"requirements"`
}

type CooperativeRequirement struct {
	RequirementID uint64   `json:"requirement_id,omitempty"`
	CriterionType string   `json:"criterion_type"`
	NameTH        string   `json:"name_th"`
	NameEN        *string  `json:"name_en,omitempty"`
	MinimumValue  *float64 `json:"minimum_value,omitempty"`
	MinimumGrade  *string  `json:"minimum_grade,omitempty"`
	CategoryID    *uint64  `json:"category_id,omitempty"`
	CourseID      *uint64  `json:"course_id,omitempty"`
	DisplayOrder  uint     `json:"display_order"`
}

type CooperativeRequirementsResponse struct {
	CurriculumID uint64                     `json:"curriculum_id"`
	Draft        *CooperativeRequirementSet `json:"draft,omitempty"`
	Published    *CooperativeRequirementSet `json:"published,omitempty"`
}

type ReplaceCooperativeRequirementsPayload struct {
	Requirements []CooperativeRequirement `json:"requirements"`
}

type CooperativeReadinessResult struct {
	CurriculumID     uint64                         `json:"curriculum_id"`
	EntryYearBE      uint64                         `json:"entry_year_be"`
	TargetYearBE     uint64                         `json:"target_year_be"`
	TargetSemester   uint                           `json:"target_semester"`
	RequirementSetID uint64                         `json:"requirement_set_id"`
	Revision         uint64                         `json:"revision"`
	Status           string                         `json:"status"`
	PassedCount      int                            `json:"passed_count"`
	RequirementCount int                            `json:"requirement_count"`
	Results          []CooperativeRequirementResult `json:"results"`
}

type CooperativeRequirementResult struct {
	RequirementID  uint64   `json:"requirement_id"`
	CriterionType  string   `json:"criterion_type"`
	NameTH         string   `json:"name_th"`
	NameEN         *string  `json:"name_en,omitempty"`
	Status         string   `json:"status"`
	CurrentValue   *float64 `json:"current_value,omitempty"`
	RequiredValue  *float64 `json:"required_value,omitempty"`
	CurrentGrade   *string  `json:"current_grade,omitempty"`
	RequiredGrade  *string  `json:"required_grade,omitempty"`
	CourseNameTH   *string  `json:"course_name_th,omitempty"`
	CourseNameEN   *string  `json:"course_name_en,omitempty"`
	CategoryNameTH *string  `json:"category_name_th,omitempty"`
	CategoryNameEN *string  `json:"category_name_en,omitempty"`
	Explanation    string   `json:"explanation"`
}
