package models

import "time"

type Activity struct {
	ActivityID           uint64     `json:"activity_id"`
	FacultyID            uint64     `json:"faculty_id"`
	FacultyNameTH        string     `json:"faculty_name_th"`
	FacultyNameEN        *string    `json:"faculty_name_en"`
	Code                 string     `json:"code"`
	NameTH               string     `json:"name_th"`
	NameEN               *string    `json:"name_en"`
	Description          *string    `json:"description"`
	Category             *string    `json:"category"`
	Type                 *string    `json:"type"`
	CreatedBy            *uint64    `json:"created_by"`
	Status               string     `json:"status"`
	VisibilityScope      string     `json:"visibility_scope"`
	RegistrationRequired bool       `json:"registration_required"`
	PublishedAt          *time.Time `json:"published_at"`
	SessionCount         int        `json:"session_count"`
	NextSessionAt        *time.Time `json:"next_session_at"`
	LatestSessionAt      *time.Time `json:"latest_session_at"`
	CanEdit              bool       `json:"can_edit"`
	CanDelete            bool       `json:"can_delete"`
	CanPublish           bool       `json:"can_publish"`
	CanClose             bool       `json:"can_close"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
	DeletedAt            *time.Time `json:"deleted_at"`
}

type ActivityFilters struct {
	FacultyID *uint64
	Status    string
	Category  string
	Type      string
	Search    string
}

type UpsertActivityPayload struct {
	FacultyID            uint64  `json:"faculty_id"`
	Code                 string  `json:"code"`
	NameTH               string  `json:"name_th"`
	NameEN               *string `json:"name_en"`
	Description          *string `json:"description"`
	Category             *string `json:"category"`
	Type                 *string `json:"type"`
	RegistrationRequired *bool   `json:"registration_required"`
}

type UpdateActivityStatusPayload struct {
	Status string `json:"status"`
}

type ActivityOptions struct {
	Categories []string `json:"categories"`
	Types      []string `json:"types"`
}
