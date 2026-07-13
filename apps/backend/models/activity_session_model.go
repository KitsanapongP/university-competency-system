package models

import "time"

type ActivitySession struct {
	SessionID              uint64                       `json:"session_id"`
	ActivityID             uint64                       `json:"activity_id"`
	ActivityCode           string                       `json:"activity_code,omitempty"`
	ActivityNameTH         string                       `json:"activity_name_th,omitempty"`
	ActivityStatus         string                       `json:"activity_status,omitempty"`
	FacultyID              uint64                       `json:"faculty_id,omitempty"`
	SessionNo              uint                         `json:"session_no"`
	StartAt                time.Time                    `json:"start_at"`
	EndAt                  time.Time                    `json:"end_at"`
	Timezone               string                       `json:"timezone"`
	LocationName           *string                      `json:"location_name"`
	LocationDetail         *string                      `json:"location_detail"`
	Latitude               *float64                     `json:"latitude"`
	Longitude              *float64                     `json:"longitude"`
	Capacity               *uint                        `json:"capacity"`
	RegistrationRequired   bool                         `json:"registration_required"`
	GradingMode            string                       `json:"grading_mode"`
	MaxRawScore            float64                      `json:"max_raw_score"`
	PassThreshold          *float64                     `json:"pass_threshold"`
	LateGraceMinutes       uint                         `json:"late_grace_minutes"`
	LatePenaltyFactor      float64                      `json:"late_penalty_factor"`
	RequireCheckout        bool                         `json:"require_checkout"`
	MinAttendanceMinutes   *uint                        `json:"min_attendance_minutes"`
	Status                 string                       `json:"status"`
	IsFinalized            bool                         `json:"is_finalized"`
	FinalizedAt            *time.Time                   `json:"finalized_at"`
	FinalizedBy            *uint64                      `json:"finalized_by"`
	AssignmentCount        int                          `json:"assignment_count"`
	CompetencyCount        int                          `json:"competency_count"`
	CompetencyPercentTotal float64                      `json:"competency_percent_total"`
	RegistrationCount      int                          `json:"registration_count"`
	AttendanceCount        int                          `json:"attendance_count"`
	CanEdit                bool                         `json:"can_edit"`
	CanDelete              bool                         `json:"can_delete"`
	CanFinalize            bool                         `json:"can_finalize"`
	CanCancel              bool                         `json:"can_cancel"`
	CanComplete            bool                         `json:"can_complete"`
	CreatedAt              time.Time                    `json:"created_at"`
	UpdatedAt              time.Time                    `json:"updated_at"`
	DeletedAt              *time.Time                   `json:"deleted_at"`
	Assignments            []*ActivitySessionAssignment `json:"assignments,omitempty"`
	Competencies           []*ActivitySessionCompetency `json:"competencies,omitempty"`
}

type ActivitySessionAssignment struct {
	SessionAssignmentID uint64    `json:"session_assignment_id"`
	SessionID           uint64    `json:"session_id"`
	UserID              uint64    `json:"user_id"`
	DisplayName         string    `json:"display_name"`
	Email               *string   `json:"email"`
	UserType            string    `json:"user_type"`
	UserFacultyID       *uint64   `json:"user_faculty_id"`
	AssignmentRole      string    `json:"assignment_role"`
	CanRecordAttendance bool      `json:"can_record_attendance"`
	CanGrade            bool      `json:"can_grade"`
	CanFinalize         bool      `json:"can_finalize"`
	Note                *string   `json:"note"`
	CreatedBy           *uint64   `json:"created_by"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

type ActivitySessionCompetency struct {
	SessionCompetencyID uint64    `json:"session_competency_id"`
	SessionID           uint64    `json:"session_id"`
	CompetencyID        uint64    `json:"competency_id"`
	CompetencyCode      string    `json:"competency_code"`
	CompetencyNameTH    string    `json:"competency_name_th"`
	CompetencyNameEN    *string   `json:"competency_name_en"`
	MaxPercent          float64   `json:"max_percent"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

type SessionAssigneeOption struct {
	UserID      uint64  `json:"user_id"`
	DisplayName string  `json:"display_name"`
	Email       *string `json:"email"`
	UserType    string  `json:"user_type"`
	FacultyID   *uint64 `json:"faculty_id"`
}

type UpsertActivitySessionPayload struct {
	StartAt              string   `json:"start_at"`
	EndAt                string   `json:"end_at"`
	Timezone             string   `json:"timezone"`
	LocationName         *string  `json:"location_name"`
	LocationDetail       *string  `json:"location_detail"`
	Latitude             *float64 `json:"latitude"`
	Longitude            *float64 `json:"longitude"`
	Capacity             *uint    `json:"capacity"`
	RegistrationRequired *bool    `json:"registration_required"`
	GradingMode          string   `json:"grading_mode"`
	MaxRawScore          *float64 `json:"max_raw_score"`
	PassThreshold        *float64 `json:"pass_threshold"`
	LateAt               string   `json:"late_at"`
	LateGraceMinutes     *uint    `json:"late_grace_minutes"`
	LatePenaltyFactor    *float64 `json:"late_penalty_factor"`
	RequireCheckout      *bool    `json:"require_checkout"`
	MinAttendanceMinutes *uint    `json:"min_attendance_minutes"`
}

type ActivitySessionData struct {
	StartAt              time.Time
	EndAt                time.Time
	Timezone             string
	LocationName         *string
	LocationDetail       *string
	Latitude             *float64
	Longitude            *float64
	Capacity             *uint
	RegistrationRequired bool
	GradingMode          string
	MaxRawScore          float64
	PassThreshold        *float64
	LateGraceMinutes     uint
	LatePenaltyFactor    float64
	RequireCheckout      bool
	MinAttendanceMinutes *uint
}

type UpdateActivitySessionStatusPayload struct {
	Status string `json:"status"`
}

type UpsertSessionAssignmentPayload struct {
	UserID              uint64  `json:"user_id"`
	AssignmentRole      string  `json:"assignment_role"`
	CanRecordAttendance *bool   `json:"can_record_attendance"`
	CanGrade            *bool   `json:"can_grade"`
	CanFinalize         *bool   `json:"can_finalize"`
	Note                *string `json:"note"`
}

type ReplaceSessionAssignmentsPayload struct {
	Assignments []UpsertSessionAssignmentPayload `json:"assignments"`
}

type UpsertSessionCompetencyPayload struct {
	CompetencyID uint64  `json:"competency_id"`
	MaxPercent   float64 `json:"max_percent"`
}

type ReplaceSessionCompetenciesPayload struct {
	Competencies []UpsertSessionCompetencyPayload `json:"competencies"`
}
