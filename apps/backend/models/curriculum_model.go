package models

import "time"

// Core DB Models
type Curriculum struct {
	CurriculumID     uint64     `json:"curriculum_id"`
	MajorID          uint64     `json:"major_id"`
	CurriculumNameTH string     `json:"curriculum_name_th"`
	CurriculumNameEN *string    `json:"curriculum_name_en"`
	CurriculumCode   string     `json:"curriculum_code"`
	EffectiveYearBE  uint64     `json:"effective_year_be"`
	Status           string     `json:"status"`
	IsActive         bool       `json:"is_active"`
	TotalCredits     int        `json:"total_credits"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
	DeletedAt        *time.Time `json:"deleted_at"`
}

type CourseCategory struct {
	CategoryID      uint64     `json:"category_id"`
	CurriculumID    uint64     `json:"curriculum_id"`
	ParentID        *uint64    `json:"parent_id"`
	Code            *string    `json:"code"`
	NameTH          string     `json:"name_th"`
	NameEN          *string    `json:"name_en"`
	RequiredCredits int        `json:"required_credits"`
	DisplayOrder    int        `json:"display_order"`
	IsActive        bool       `json:"is_active"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	DeletedAt        *time.Time `json:"deleted_at"`
}

type CurriculumCourse struct {
	CurriculumCourseID uint64     `json:"curriculum_course_id"`
	CategoryID         uint64     `json:"category_id"`
	CourseID           uint64     `json:"course_id"`
	IsRequired         bool       `json:"is_required"`
	IsLocked           bool       `json:"is_locked"`
	DisplayOrder       int        `json:"display_order"`
	IsActive           bool       `json:"is_active"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
	DeletedAt          *time.Time `json:"deleted_at"`
}

// Request Payloads

type CreateCurriculumPayload struct {
	MajorID          uint64                   `json:"major_id"`
	CurriculumNameTH string                   `json:"curriculum_name_th"`
	CurriculumNameEN *string                  `json:"curriculum_name_en"`
	CurriculumCode   string                   `json:"curriculum_code"`
	EffectiveYearBE  uint64                   `json:"effective_year_be"`
	TotalCredits     int                      `json:"total_credits"`
	Categories       []CreateCategoryPayload  `json:"categories"`
}

type CreateCategoryPayload struct {
	Code            *string                 `json:"code"`
	NameTH          string                  `json:"name_th"`
	NameEN          *string                 `json:"name_en"`
	RequiredCredits int                     `json:"required_credits"`
	DisplayOrder    int                     `json:"display_order"`
	Courses         []CreateCourseInCatPayload `json:"courses"`
}

type CreateCourseInCatPayload struct {
	CourseID     uint64 `json:"course_id"`
	IsRequired   bool   `json:"is_required"`
	DisplayOrder int    `json:"display_order"`
}
