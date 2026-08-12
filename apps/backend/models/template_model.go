package models

import (
	"time"
)

// Template represents the template header joined with curriculum information
type Template struct {
	TemplateID        uint64    `json:"template_id"`
	FacultyID         uint64    `json:"faculty_id"`
	CurriculumID      uint64    `json:"curriculum_id"`
	CurriculumNameTH  string    `json:"curriculum_name_th"`
	CurriculumNameEN  *string   `json:"curriculum_name_en"`
	CurriculumCode    string    `json:"curriculum_code"`
	Code              string    `json:"code"`
	Name              string    `json:"name"`
	Description       *string   `json:"description"`
	CohortYearBE      uint64    `json:"cohort_year_be"`
	Status            string    `json:"status"` // "Draft", "Active", "Inactive"
	IsActive          bool      `json:"is_active"`
	CompetencyCount   int       `json:"competency_count"`
	MappedCourseCount int       `json:"mapped_course_count"`
	TotalCourseCount  int       `json:"total_course_count"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

// TemplateAssignment is the current or historical relationship between one
// Template and one Student Cohort.
type TemplateAssignment struct {
	TemplateAssignmentID uint64     `json:"template_assignment_id"`
	TemplateID           uint64     `json:"template_id"`
	TemplateName         string     `json:"template_name"`
	TemplateCode         string     `json:"template_code"`
	TemplateIsActive     bool       `json:"template_is_active"`
	CurriculumID         uint64     `json:"curriculum_id"`
	CurriculumCode       string     `json:"curriculum_code"`
	CurriculumNameTH     string     `json:"curriculum_name_th"`
	CohortID             uint64     `json:"cohort_id"`
	EntryYearBE          uint64     `json:"entry_year_be"`
	CohortStatus         string     `json:"cohort_status"`
	RosterCount          int        `json:"roster_count"`
	ScoreLocked          bool       `json:"score_locked"`
	AssignedBy           *uint64    `json:"assigned_by,omitempty"`
	AssignedAt           time.Time  `json:"assigned_at"`
	EndedBy              *uint64    `json:"ended_by,omitempty"`
	EndedAt              *time.Time `json:"ended_at,omitempty"`
	EndReason            *string    `json:"end_reason,omitempty"`
	DeletedAt            *time.Time `json:"deleted_at,omitempty"`
}

// TemplateAssignmentCandidate is a Template or Cohort returned to the
// assignment workspace before an Assignment is created.
type TemplateAssignmentCandidate struct {
	TemplateID       uint64 `json:"template_id,omitempty"`
	TemplateCode     string `json:"template_code,omitempty"`
	TemplateName     string `json:"template_name,omitempty"`
	CurriculumID     uint64 `json:"curriculum_id"`
	CurriculumCode   string `json:"curriculum_code"`
	CurriculumNameTH string `json:"curriculum_name_th"`
	CohortID         uint64 `json:"cohort_id,omitempty"`
	EntryYearBE      uint64 `json:"entry_year_be,omitempty"`
	RosterCount      int    `json:"roster_count,omitempty"`
}

type CreateTemplateAssignmentRequest struct {
	TemplateID uint64 `json:"template_id"`
	CohortID   uint64 `json:"cohort_id"`
	Confirm    bool   `json:"confirm"`
}

type ReplaceTemplateAssignmentRequest struct {
	TemplateID uint64 `json:"template_id"`
	Reason     string `json:"reason"`
	Confirm    bool   `json:"confirm"`
}

type RemoveTemplateAssignmentRequest struct {
	Reason  string `json:"reason"`
	Confirm bool   `json:"confirm"`
}

// TemplateItem represents a mapping between template, course, and competency with weight
type TemplateItem struct {
	TemplateItemID uint64   `json:"template_item_id"`
	TemplateID     uint64   `json:"template_id"`
	CourseID       *uint64  `json:"course_id"`
	CourseCode     string   `json:"course_code,omitempty"`
	CourseNameTH   string   `json:"course_name_th,omitempty"`
	CourseNameEN   *string  `json:"course_name_en,omitempty"`
	CompetencyID   uint64   `json:"competency_id"`
	CompetencyCode string   `json:"competency_code,omitempty"`
	CompetencyName string   `json:"competency_name,omitempty"`
	Weight         *float64 `json:"weight"`
	DisplayOrder   int      `json:"display_order"`
	IsActive       bool     `json:"is_active"`
	IsCustomCourse bool     `json:"is_custom_course"`
}

// TemplateCategory represents a custom category created specifically inside a template
type TemplateCategory struct {
	TemplateCategoryID uint64  `json:"template_category_id,omitempty"`
	TemplateID         uint64  `json:"template_id,omitempty"`
	CurriculumParentID *uint64 `json:"curriculum_parent_id,omitempty"`
	ParentID           *uint64 `json:"parent_id,omitempty"`
	Code               *string `json:"code,omitempty"`
	Name               string  `json:"name"`
	DisplayOrder       int     `json:"display_order"`
	IsActive           bool    `json:"is_active"`
}

// TemplateCourse represents a custom course (Template Additional Course) created inside a template
type TemplateCourse struct {
	TemplateCourseID     uint64  `json:"template_course_id,omitempty"`
	TemplateID           uint64  `json:"template_id,omitempty"`
	CurriculumCategoryID *uint64 `json:"curriculum_category_id,omitempty"`
	TemplateCategoryID   *uint64 `json:"template_category_id,omitempty"`
	Code                 string  `json:"code"`
	NameTH               string  `json:"name_th"`
	NameEN               *string `json:"name_en,omitempty"`
	Credits              int     `json:"credits"`
	Description          *string `json:"description,omitempty"`
	DisplayOrder         int     `json:"display_order"`
	IsActive             bool    `json:"is_active"`
}

// CreateCompetencyInput represents a new competency created inside the template wizard
type CreateCompetencyInput struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}

// CreateTemplateRequest payload for POST /api/v1/templates
type CreateTemplateRequest struct {
	Name            string                  `json:"name"`
	CurriculumID    uint64                  `json:"curriculum_id"`
	CompetencyIDs   []uint64                `json:"competency_ids"`
	NewCompetencies []CreateCompetencyInput `json:"new_competencies"`
}

// TemplateItemInput payload for mapping weights
type TemplateItemInput struct {
	CourseID       uint64  `json:"course_id"`
	CompetencyID   uint64  `json:"competency_id"`
	Weight         float64 `json:"weight"`
	IsCustomCourse bool    `json:"is_custom_course"`
}

// TemplateCompetency represents a competency explicitly mapped or assigned to a template
type TemplateCompetency struct {
	CompetencyID uint64 `json:"id"`
	Code         string `json:"code"`
	NameTH       string `json:"name_th"`
	NameEN       string `json:"name_en,omitempty"`
	IsActive     bool   `json:"is_active"`
}

// TemplateCompetencyManagementResponse describes the competency selection state for one template.
type TemplateCompetencyManagementResponse struct {
	TemplateID             uint64               `json:"template_id"`
	Competencies           []TemplateCompetency `json:"competencies"`
	CanManage              bool                 `json:"can_manage"`
	LockReason             string               `json:"lock_reason,omitempty"`
	HasLearnerCourseScores bool                 `json:"has_learner_course_scores"`
}

// TemplateCompetencyImpact describes the course mappings removed with a competency selection.
type TemplateCompetencyImpact struct {
	CompetencyID uint64 `json:"competency_id"`
	Code         string `json:"code"`
	NameTH       string `json:"name_th"`
	MappingCount int    `json:"mapping_count"`
}

// UpdateTemplateCompetenciesRequest replaces the selected competency masters for a template.
type UpdateTemplateCompetenciesRequest struct {
	CompetencyIDs  []uint64 `json:"competency_ids"`
	ConfirmRemoval bool     `json:"confirm_removal"`
}

// UpdateTemplateItemsRequest payload for PUT /api/v1/templates/{id}/items
type UpdateTemplateItemsRequest struct {
	Items            []TemplateItemInput `json:"items"`
	CustomCategories []TemplateCategory  `json:"custom_categories,omitempty"`
	CustomCourses    []TemplateCourse    `json:"custom_courses,omitempty"`
}

// TemplateStructureResponse represents the complete template structure including custom items
type TemplateStructureResponse struct {
	Items            []TemplateItem       `json:"items"`
	CustomCategories []TemplateCategory   `json:"custom_categories"`
	CustomCourses    []TemplateCourse     `json:"custom_courses"`
	Competencies     []TemplateCompetency `json:"competencies"`
}

// UpdateTemplateStatusRequest payload for PATCH /api/v1/templates/{id}/status
type UpdateTemplateStatusRequest struct {
	Status string `json:"status"` // "Active", "Inactive", "Draft"
}

// UpdateTemplateNameRequest payload for PATCH /api/v1/templates/{id}
type UpdateTemplateNameRequest struct {
	Name string `json:"name"`
}
