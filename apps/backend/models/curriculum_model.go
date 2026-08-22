package models

import (
	"bytes"
	"encoding/json"
	"time"
)

// Core DB Models
type Curriculum struct {
	CurriculumID        uint64     `json:"curriculum_id"`
	MajorID             uint64     `json:"major_id"`
	FacultyID           uint64     `json:"faculty_id"`
	MajorNameTH         string     `json:"major_name_th"`
	MajorNameEN         *string    `json:"major_name_en"`
	CurriculumNameTH    string     `json:"curriculum_name_th"`
	CurriculumNameEN    *string    `json:"curriculum_name_en"`
	CurriculumCode      string     `json:"curriculum_code"`
	EffectiveYearBE     uint64     `json:"effective_year_be"`
	Status              string     `json:"status"`
	IsActive            bool       `json:"is_active"`
	TotalCredits        int        `json:"total_credits"`
	CourseCount         int        `json:"course_count"`
	CategoryCount       int        `json:"category_count"`
	TemplateCount       int        `json:"template_count"`
	ActiveTemplateCount int        `json:"active_template_count"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
	DeletedAt           *time.Time `json:"deleted_at"`
}

type GeneratedCurriculumCode struct {
	CurriculumCode string `json:"curriculum_code"`
}

type MajorOption struct {
	MajorID          uint64    `json:"major_id"`
	DepartmentID     uint64    `json:"department_id"`
	FacultyID        uint64    `json:"faculty_id"`
	Code             string    `json:"code"`
	NameTH           string    `json:"name_th"`
	NameEN           *string   `json:"name_en"`
	DegreeLevel      *string   `json:"degree_level"`
	IsActive         bool      `json:"is_active"`
	CurriculumCount  int       `json:"curriculum_count"`
	DepartmentNameTH string    `json:"department_name_th"`
	DepartmentNameEN *string   `json:"department_name_en"`
	FacultyNameTH    string    `json:"faculty_name_th"`
	FacultyNameEN    *string   `json:"faculty_name_en"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type FacultyOption struct {
	FacultyID uint64  `json:"faculty_id"`
	Code      string  `json:"code"`
	NameTH    string  `json:"name_th"`
	NameEN    *string `json:"name_en"`
}

type DepartmentOption struct {
	DepartmentID uint64  `json:"department_id"`
	FacultyID    uint64  `json:"faculty_id"`
	Code         string  `json:"code"`
	NameTH       string  `json:"name_th"`
	NameEN       *string `json:"name_en"`
	IsActive     bool    `json:"is_active"`
}

type CompetencyOption struct {
	CompetencyID       uint64    `json:"competency_id"`
	Code               string    `json:"code"`
	NameTH             string    `json:"name_th"`
	NameEN             *string   `json:"name_en"`
	Description        *string   `json:"description"`
	IsActive           bool      `json:"is_active"`
	TemplateUsageCount int       `json:"template_usage_count"`
	CanEdit            bool      `json:"can_edit"`
	CanDelete          bool      `json:"can_delete"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
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
	DeletedAt       *time.Time `json:"deleted_at"`
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

type CurriculumDetail struct {
	Curriculum
	Categories []*CourseCategoryNode `json:"categories"`
}

type CourseCategoryNode struct {
	CategoryID      uint64                 `json:"category_id"`
	CurriculumID    uint64                 `json:"curriculum_id"`
	ParentID        *uint64                `json:"parent_id"`
	Code            *string                `json:"code"`
	NameTH          string                 `json:"name_th"`
	NameEN          *string                `json:"name_en"`
	RequiredCredits int                    `json:"required_credits"`
	DisplayOrder    int                    `json:"display_order"`
	IsActive        bool                   `json:"is_active"`
	CreatedAt       time.Time              `json:"created_at"`
	UpdatedAt       time.Time              `json:"updated_at"`
	DeletedAt       *time.Time             `json:"deleted_at"`
	Children        []*CourseCategoryNode  `json:"children"`
	Courses         []*CurriculumCourseRow `json:"courses"`
}

type CurriculumCourseRow struct {
	CurriculumCourseID uint64     `json:"curriculum_course_id"`
	CategoryID         uint64     `json:"category_id"`
	CourseID           uint64     `json:"course_id"`
	Code               string     `json:"code"`
	NameTH             string     `json:"name_th"`
	NameEN             *string    `json:"name_en"`
	Credits            int        `json:"credits"`
	Description        *string    `json:"description"`
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
	MajorID          uint64                  `json:"major_id"`
	CurriculumNameTH string                  `json:"curriculum_name_th"`
	CurriculumNameEN *string                 `json:"curriculum_name_en"`
	CurriculumCode   string                  `json:"curriculum_code"`
	EffectiveYearBE  uint64                  `json:"effective_year_be"`
	Categories       []CreateCategoryPayload `json:"categories"`
}

type DuplicateCurriculumPayload struct {
	MajorID          uint64  `json:"major_id"`
	CurriculumNameTH string  `json:"curriculum_name_th"`
	CurriculumNameEN *string `json:"curriculum_name_en"`
	CurriculumCode   string  `json:"curriculum_code"`
	EffectiveYearBE  uint64  `json:"effective_year_be"`
}

type MajorFilters struct {
	IncludeInactive bool
	FacultyID       *uint64
	DepartmentID    *uint64
}

type DepartmentFilters struct {
	FacultyID *uint64
}

type UpsertMajorPayload struct {
	DepartmentID uint64  `json:"department_id"`
	Code         string  `json:"code"`
	NameTH       string  `json:"name_th"`
	NameEN       *string `json:"name_en"`
	DegreeLevel  string  `json:"degree_level"`
	IsActive     *bool   `json:"is_active"`
}

type UpdateMajorStatusPayload struct {
	IsActive *bool `json:"is_active"`
}

type UpsertCompetencyPayload struct {
	Code        string  `json:"code"`
	NameTH      string  `json:"name_th"`
	NameEN      *string `json:"name_en"`
	Description *string `json:"description"`
}

type CreateCategoryPayload struct {
	Code            *string                    `json:"code"`
	NameTH          string                     `json:"name_th"`
	NameEN          *string                    `json:"name_en"`
	RequiredCredits int                        `json:"required_credits"`
	DisplayOrder    int                        `json:"display_order"`
	Children        []CreateCategoryPayload    `json:"children"`
	Courses         []CreateCourseInCatPayload `json:"courses"`
}

type CreateCourseInCatPayload struct {
	CourseID     uint64  `json:"course_id"`
	Code         string  `json:"code"`
	NameTH       string  `json:"name_th"`
	NameEN       *string `json:"name_en"`
	Credits      int     `json:"credits"`
	Description  *string `json:"description"`
	IsRequired   bool    `json:"is_required"`
	DisplayOrder int     `json:"display_order"`
}

type OptionalUint64 struct {
	Set   bool
	Valid bool
	Value uint64
}

func (o *OptionalUint64) UnmarshalJSON(data []byte) error {
	o.Set = true
	o.Valid = false
	o.Value = 0

	if bytes.Equal(data, []byte("null")) {
		return nil
	}

	var value uint64
	if err := json.Unmarshal(data, &value); err != nil {
		return err
	}

	o.Valid = true
	o.Value = value
	return nil
}

type UpdateCurriculumStatusPayload struct {
	Status        string `json:"status"`
	ConfirmImpact bool   `json:"confirm_impact"`
}

type UpdateCurriculumMetadataPayload struct {
	MajorID          uint64  `json:"major_id"`
	CurriculumNameTH string  `json:"curriculum_name_th"`
	CurriculumNameEN *string `json:"curriculum_name_en"`
	CurriculumCode   string  `json:"curriculum_code"`
	EffectiveYearBE  uint64  `json:"effective_year_be"`
	ConfirmImpact    bool    `json:"confirm_impact"`
}

type CreateCurriculumCategoryPayload struct {
	ParentID        *uint64 `json:"parent_id"`
	Code            *string `json:"code"`
	NameTH          string  `json:"name_th"`
	NameEN          *string `json:"name_en"`
	RequiredCredits int     `json:"required_credits"`
	DisplayOrder    int     `json:"display_order"`
	ConfirmImpact   bool    `json:"confirm_impact"`
}

type UpdateCurriculumCategoryPayload struct {
	ParentID        OptionalUint64 `json:"parent_id"`
	Code            *string        `json:"code"`
	NameTH          *string        `json:"name_th"`
	NameEN          *string        `json:"name_en"`
	RequiredCredits *int           `json:"required_credits"`
	DisplayOrder    *int           `json:"display_order"`
	ConfirmImpact   bool           `json:"confirm_impact"`
}

type UpdateCurriculumCourseDetailPayload struct {
	Code          *string `json:"code"`
	NameTH        *string `json:"name_th"`
	NameEN        *string `json:"name_en"`
	Credits       *int    `json:"credits"`
	Description   *string `json:"description"`
	IsRequired    *bool   `json:"is_required"`
	ConfirmImpact bool    `json:"confirm_impact"`
}

type CreateCurriculumCoursePayload struct {
	Code          string  `json:"code"`
	NameTH        string  `json:"name_th"`
	NameEN        *string `json:"name_en"`
	Credits       int     `json:"credits"`
	Description   *string `json:"description"`
	IsRequired    bool    `json:"is_required"`
	DisplayOrder  int     `json:"display_order"`
	ConfirmImpact bool    `json:"confirm_impact"`
}

type UpdateCurriculumCoursePlacementPayload struct {
	CategoryID    *uint64 `json:"category_id"`
	IsRequired    *bool   `json:"is_required"`
	IsLocked      *bool   `json:"is_locked"`
	DisplayOrder  *int    `json:"display_order"`
	ConfirmImpact bool    `json:"confirm_impact"`
}

type CurriculumStructureImportCategory struct {
	Code   string `json:"code"`
	NameTH string `json:"name_th"`
}

type CurriculumStructureImportRow struct {
	RowNumber    int                                 `json:"row_number"`
	Categories   []CurriculumStructureImportCategory `json:"categories"`
	CourseCode   string                              `json:"course_code"`
	CourseNameTH string                              `json:"course_name_th"`
	CourseNameEN *string                             `json:"course_name_en"`
	Credits      int                                 `json:"credits"`
	IsRequired   *bool                               `json:"is_required"`
}

type CurriculumStructureImportPayload struct {
	Rows          []CurriculumStructureImportRow `json:"rows"`
	ConfirmImpact bool                           `json:"confirm_impact"`
}

type CurriculumStructureImportIssue struct {
	RowNumber int    `json:"row_number"`
	Field     string `json:"field"`
	Message   string `json:"message"`
	Severity  string `json:"severity"`
}

type CurriculumStructureImportPreview struct {
	Valid                 bool                             `json:"valid"`
	CanImport             bool                             `json:"can_import"`
	ExistingCategoryCount int                              `json:"existing_category_count"`
	NewCategoryCount      int                              `json:"new_category_count"`
	CourseCount           int                              `json:"course_count"`
	SkippedCourseCount    int                              `json:"skipped_course_count"`
	Issues                []CurriculumStructureImportIssue `json:"issues"`
}

type CurriculumStructureImportCategoryPlan struct {
	Code       string
	NameTH     string
	ParentCode string
}

type CurriculumStructureImportCoursePlan struct {
	CategoryCode string
	Code         string
	NameTH       string
	NameEN       *string
	Credits      int
	IsRequired   bool
}

type CurriculumStructureImportPlan struct {
	Categories []CurriculumStructureImportCategoryPlan
	Courses    []CurriculumStructureImportCoursePlan
}

type AffectedTemplate struct {
	CurriculumTemplateID uint64 `json:"curriculum_template_id"`
	TemplateID           uint64 `json:"template_id"`
	Code                 string `json:"code"`
	Name                 string `json:"name"`
	CohortYearBE         uint64 `json:"cohort_year_be"`
	IsActive             bool   `json:"is_active"`
	Severity             string `json:"severity"`
}

type CurriculumImpact struct {
	AffectedTemplates []AffectedTemplate `json:"affected_templates"`
}

type DeleteCategoryPreview struct {
	CategoryID                     uint64             `json:"category_id"`
	CategoryNameTH                 string             `json:"category_name_th"`
	SubtreeCategoryIDs             []uint64           `json:"subtree_category_ids"`
	MoveTargetCategoryID           *uint64            `json:"move_target_category_id"`
	MoveTargetCategoryNameTH       *string            `json:"move_target_category_name_th"`
	AffectedCurriculumCourseIDs    []uint64           `json:"affected_curriculum_course_ids"`
	SoftRemovedCurriculumCourseIDs []uint64           `json:"soft_removed_curriculum_course_ids"`
	AffectedTemplates              []AffectedTemplate `json:"affected_templates"`
}
