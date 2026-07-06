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
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

// TemplateItem represents a mapping between template, course, and competency with weight
type TemplateItem struct {
	TemplateItemID  uint64   `json:"template_item_id"`
	TemplateID      uint64   `json:"template_id"`
	CourseID        *uint64  `json:"course_id"`
	CourseCode      string   `json:"course_code,omitempty"`
	CourseNameTH    string   `json:"course_name_th,omitempty"`
	CourseNameEN    *string  `json:"course_name_en,omitempty"`
	CompetencyID    uint64   `json:"competency_id"`
	CompetencyCode  string   `json:"competency_code,omitempty"`
	CompetencyName  string   `json:"competency_name,omitempty"`
	Weight          *float64 `json:"weight"`
	DisplayOrder    int      `json:"display_order"`
	IsActive        bool     `json:"is_active"`
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
	CohortYearBE    uint64                  `json:"cohort_year_be"`
	CompetencyIDs   []uint64                `json:"competency_ids"`
	NewCompetencies []CreateCompetencyInput `json:"new_competencies"`
}

// TemplateItemInput payload for mapping weights
type TemplateItemInput struct {
	CourseID     uint64  `json:"course_id"`
	CompetencyID uint64  `json:"competency_id"`
	Weight       float64 `json:"weight"`
}

// UpdateTemplateItemsRequest payload for PUT /api/v1/templates/{id}/items
type UpdateTemplateItemsRequest struct {
	Items []TemplateItemInput `json:"items"`
}

// UpdateTemplateStatusRequest payload for PATCH /api/v1/templates/{id}/status
type UpdateTemplateStatusRequest struct {
	Status string `json:"status"` // "Active", "Inactive", "Draft"
}
