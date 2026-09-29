package models

import "time"

type StudentCohort struct {
	CohortID                          uint64     `json:"cohort_id"`
	CurriculumID                      uint64     `json:"curriculum_id"`
	CurriculumCode                    string     `json:"curriculum_code"`
	CurriculumNameTH                  string     `json:"curriculum_name_th"`
	CurriculumNameEN                  *string    `json:"curriculum_name_en"`
	CurriculumEffectiveYear           uint64     `json:"curriculum_effective_year_be"`
	MajorID                           uint64     `json:"major_id"`
	MajorNameTH                       string     `json:"major_name_th"`
	FacultyID                         uint64     `json:"faculty_id"`
	FacultyNameTH                     string     `json:"faculty_name_th"`
	EntryYearBE                       uint64     `json:"entry_year_be"`
	Status                            string     `json:"status"`
	Note                              *string    `json:"note"`
	RosterCount                       int        `json:"roster_count"`
	StudentCount                      int        `json:"student_count"`
	SuspendedCount                    int        `json:"suspended_count"`
	TemplateCount                     int        `json:"template_count"`
	ActiveTemplateCount               int        `json:"active_template_count"`
	CourseScoresRecalculationRequired bool       `json:"course_scores_recalculation_required"`
	CourseScoresRecalculatedAt        *time.Time `json:"course_scores_recalculated_at"`
	LastReactivationReason            *string    `json:"last_reactivation_reason"`
	LastReactivatedAt                 *time.Time `json:"last_reactivated_at"`
	LastReactivatedBy                 *uint64    `json:"last_reactivated_by"`
	CreatedAt                         time.Time  `json:"created_at"`
	UpdatedAt                         time.Time  `json:"updated_at"`
}

type StudentCohortFilters struct {
	FacultyID    *uint64
	MajorID      *uint64
	CurriculumID *uint64
	EntryYearBE  *uint64
	Status       string
	Search       string
}

type UpsertStudentCohortPayload struct {
	CurriculumID uint64  `json:"curriculum_id"`
	EntryYearBE  uint64  `json:"entry_year_be"`
	Note         *string `json:"note"`
}

type UpdateStudentCohortPayload struct {
	CurriculumID            uint64  `json:"curriculum_id"`
	EntryYearBE             uint64  `json:"entry_year_be"`
	Note                    *string `json:"note"`
	ConfirmCurriculumChange bool    `json:"confirm_curriculum_change"`
}

type StudentCohortCurriculumChangeImpact struct {
	CohortID                   uint64 `json:"cohort_id"`
	FromCurriculumID           uint64 `json:"from_curriculum_id"`
	FromCurriculumCode         string `json:"from_curriculum_code"`
	ToCurriculumID             uint64 `json:"to_curriculum_id"`
	ToCurriculumCode           string `json:"to_curriculum_code"`
	RosterCount                int    `json:"roster_count"`
	TemplateAssignmentCount    int    `json:"template_assignment_count"`
	CourseEnrollmentCount      int    `json:"course_enrollment_count"`
	CourseScoreCount           int    `json:"course_score_count"`
	CompetencyRequirementCount int    `json:"competency_requirement_count"`
	CompetencyResultCount      int    `json:"competency_result_count"`
	ActivityAttendanceCount    int    `json:"activity_attendance_count"`
	ActivityScoreCount         int    `json:"activity_score_count"`
}

type UpdateStudentCohortStatusPayload struct {
	Status              string `json:"status"`
	ConfirmReactivation bool   `json:"confirm_reactivation"`
	ReactivationReason  string `json:"reactivation_reason"`
}

type CohortStudent struct {
	EnrollmentCurriculumID uint64    `json:"enrollment_curriculum_id"`
	EnrollmentID           uint64    `json:"enrollment_id"`
	PersonID               uint64    `json:"person_id"`
	StudentCode            string    `json:"student_code"`
	PrefixTH               *string   `json:"prefix_th"`
	FirstNameTH            string    `json:"first_name_th"`
	LastNameTH             string    `json:"last_name_th"`
	FirstNameEN            *string   `json:"first_name_en"`
	LastNameEN             *string   `json:"last_name_en"`
	Email                  *string   `json:"email"`
	Phone                  *string   `json:"phone"`
	EnrollmentStatus       string    `json:"enrollment_status"`
	IsKKUStudent           bool      `json:"is_kku_student"`
	CreatedAt              time.Time `json:"created_at"`
	UpdatedAt              time.Time `json:"updated_at"`
}

type StudentRosterFilters struct {
	Search string
	Status string
}

type UpsertCohortStudentPayload struct {
	StudentCode      string  `json:"student_code"`
	PrefixTH         *string `json:"prefix_th"`
	FirstNameTH      string  `json:"first_name_th"`
	LastNameTH       string  `json:"last_name_th"`
	FirstNameEN      *string `json:"first_name_en"`
	LastNameEN       *string `json:"last_name_en"`
	Email            *string `json:"email"`
	Phone            *string `json:"phone"`
	EnrollmentStatus string  `json:"enrollment_status"`
}

type ImportCohortStudentsPayload struct {
	Rows []ImportCohortStudentRow `json:"rows"`
}

type ImportCohortStudentRow struct {
	RowNumber        int     `json:"row_number"`
	StudentCode      string  `json:"student_code"`
	PrefixTH         *string `json:"prefix_th"`
	FirstNameTH      string  `json:"first_name_th"`
	LastNameTH       string  `json:"last_name_th"`
	FirstNameEN      *string `json:"first_name_en"`
	LastNameEN       *string `json:"last_name_en"`
	Email            *string `json:"email"`
	Phone            *string `json:"phone"`
	EnrollmentStatus string  `json:"enrollment_status"`
	ApplyUpdate      bool    `json:"apply_update"`
}

type CohortImportPreview struct {
	ValidRows        []ImportCohortStudentRow `json:"valid_rows"`
	UpdateCandidates []CohortStudent          `json:"update_candidates"`
	SkippedRows      []CohortImportIssue      `json:"skipped_rows"`
	Errors           []CohortImportIssue      `json:"errors"`
}

type CohortImportIssue struct {
	RowNumber   int    `json:"row_number"`
	StudentCode string `json:"student_code"`
	Message     string `json:"message"`
}
