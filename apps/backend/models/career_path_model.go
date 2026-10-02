package models

import "time"

type CareerPathFilters struct {
	FacultyID *uint64
	Status    string
	Search    string
	Page      int
	PageSize  int
}

type CareerPath struct {
	CareerPathID     uint64             `json:"career_path_id"`
	FacultyID        uint64             `json:"faculty_id"`
	Code             string             `json:"code"`
	Status           string             `json:"status"`
	DraftVersion     *CareerPathVersion `json:"draft,omitempty"`
	PublishedVersion *CareerPathVersion `json:"published,omitempty"`
	CreatedAt        time.Time          `json:"created_at"`
	UpdatedAt        time.Time          `json:"updated_at"`
}

type CareerPathSummary struct {
	CareerPathID       uint64    `json:"career_path_id"`
	FacultyID          uint64    `json:"faculty_id"`
	Code               string    `json:"code"`
	Status             string    `json:"status"`
	DraftVersionID     *uint64   `json:"draft_version_id,omitempty"`
	DraftNameTH        *string   `json:"draft_name_th,omitempty"`
	DraftRevision      *uint64   `json:"draft_revision,omitempty"`
	PublishedVersionID *uint64   `json:"published_version_id,omitempty"`
	PublishedNameTH    *string   `json:"published_name_th,omitempty"`
	PublishedNameEN    *string   `json:"published_name_en,omitempty"`
	PublishedRevision  *uint64   `json:"published_revision,omitempty"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

type CareerPathVersion struct {
	CareerVersionID uint64             `json:"career_version_id"`
	Revision        uint64             `json:"revision"`
	Status          string             `json:"status"`
	NameTH          string             `json:"name_th"`
	NameEN          *string            `json:"name_en,omitempty"`
	DescriptionTH   *string            `json:"description_th,omitempty"`
	DescriptionEN   *string            `json:"description_en,omitempty"`
	SkillsTH        *string            `json:"skills_description_th,omitempty"`
	SkillsEN        *string            `json:"skills_description_en,omitempty"`
	SourceReference *string            `json:"source_reference,omitempty"`
	Curricula       []CareerPathOption `json:"curricula"`
	Competencies    []CareerPathOption `json:"competencies"`
	CreatedAt       time.Time          `json:"created_at"`
	UpdatedAt       time.Time          `json:"updated_at"`
	PublishedAt     *time.Time         `json:"published_at,omitempty"`
}

type CareerPathOption struct {
	ID     uint64 `json:"id"`
	Code   string `json:"code"`
	NameTH string `json:"name_th"`
	NameEN string `json:"name_en,omitempty"`
}

type CareerPathDraftPayload struct {
	FacultyID       *uint64  `json:"faculty_id,omitempty"`
	Code            string   `json:"code"`
	NameTH          string   `json:"name_th"`
	NameEN          *string  `json:"name_en,omitempty"`
	DescriptionTH   *string  `json:"description_th,omitempty"`
	DescriptionEN   *string  `json:"description_en,omitempty"`
	SkillsTH        *string  `json:"skills_description_th,omitempty"`
	SkillsEN        *string  `json:"skills_description_en,omitempty"`
	SourceReference *string  `json:"source_reference,omitempty"`
	CurriculumIDs   []uint64 `json:"curriculum_ids"`
	CompetencyIDs   []uint64 `json:"competency_ids"`
}

type CareerPathDraftUpdate struct {
	ExpectedVersionID uint64 `json:"expected_version_id"`
	CareerPathDraftPayload
}

type CareerPathListResponse struct {
	Items    []CareerPathSummary `json:"items"`
	Total    int                 `json:"total"`
	Page     int                 `json:"page"`
	PageSize int                 `json:"page_size"`
}
