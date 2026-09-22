package models

import "time"

type FreeElectiveCourse struct {
	FreeElectiveCourseID uint64    `json:"free_elective_course_id"`
	FacultyID            uint64    `json:"faculty_id"`
	FacultyNameTH        string    `json:"faculty_name_th"`
	FacultyNameEN        string    `json:"faculty_name_en,omitempty"`
	Code                 string    `json:"code"`
	NameTH               string    `json:"name_th"`
	NameEN               string    `json:"name_en,omitempty"`
	Description          string    `json:"description,omitempty"`
	Credits              int       `json:"credits"`
	GradeScheme          string    `json:"grade_scheme"`
	IsActive             bool      `json:"is_active"`
	RoundCount           int       `json:"round_count"`
	ActiveRoundCount     int       `json:"active_round_count"`
	FinalizedRoundCount  int       `json:"finalized_round_count"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
}

type FreeElectiveStudentGroup struct {
	CohortID         uint64 `json:"cohort_id"`
	FacultyID        uint64 `json:"faculty_id"`
	FacultyNameTH    string `json:"faculty_name_th"`
	FacultyNameEN    string `json:"faculty_name_en,omitempty"`
	MajorID          uint64 `json:"major_id"`
	MajorNameTH      string `json:"major_name_th"`
	MajorNameEN      string `json:"major_name_en,omitempty"`
	CurriculumID     uint64 `json:"curriculum_id"`
	CurriculumNameTH string `json:"curriculum_name_th"`
	CurriculumNameEN string `json:"curriculum_name_en,omitempty"`
	EntryYearBE      uint64 `json:"entry_year_be"`
	StudentCount     int    `json:"student_count"`
	SelectedCount    int    `json:"selected_count"`
}

type FreeElectiveStudent struct {
	EnrollmentID           uint64 `json:"enrollment_id"`
	EnrollmentCurriculumID uint64 `json:"enrollment_curriculum_id"`
	FacultyID              uint64 `json:"faculty_id,omitempty"`
	FacultyNameTH          string `json:"faculty_name_th"`
	FacultyNameEN          string `json:"faculty_name_en,omitempty"`
	MajorID                uint64 `json:"major_id"`
	MajorNameTH            string `json:"major_name_th"`
	MajorNameEN            string `json:"major_name_en,omitempty"`
	StudentCode            string `json:"student_code"`
	StudentNameTH          string `json:"student_name_th"`
	StudentNameEN          string `json:"student_name_en,omitempty"`
	CurriculumID           uint64 `json:"curriculum_id"`
	CurriculumNameTH       string `json:"curriculum_name_th"`
	CurriculumNameEN       string `json:"curriculum_name_en,omitempty"`
	EntryYearBE            uint64 `json:"entry_year_be"`
}

type FreeElectiveStudentCourse struct {
	RoundCourseEnrollmentID uint64 `json:"round_course_enrollment_id"`
	RoundCourseID           uint64 `json:"round_course_id"`
	RoundID                 uint64 `json:"round_id,omitempty"`
	CourseCode              string `json:"course_code"`
	CourseNameTH            string `json:"course_name_th"`
	CourseNameEN            string `json:"course_name_en,omitempty"`
	AcademicYearBE          uint64 `json:"academic_year_be"`
	Semester                uint64 `json:"semester"`
	SectionNo               string `json:"section_no,omitempty"`
	RoundStatus             string `json:"round_status"`
	GradeScheme             string `json:"grade_scheme"`
	Grade                   string `json:"grade,omitempty"`
	GradeSource             string `json:"grade_source,omitempty"`
	IsBestGrade             bool   `json:"is_best_grade"`
	Status                  string `json:"status"`
}

type FreeElectiveStudentDetail struct {
	Student FreeElectiveStudent         `json:"student"`
	Courses []FreeElectiveStudentCourse `json:"courses"`
}

type FreeElectiveCourseFilters struct {
	FacultyID *uint64
}

type FreeElectiveStudentGroupFilters struct {
	FacultyID    *uint64
	MajorID      *uint64
	CurriculumID *uint64
	EntryYearBE  *uint64
}

type UpsertFreeElectiveCoursePayload struct {
	FacultyID     uint64  `json:"faculty_id"`
	Code          string  `json:"code"`
	NameTH        string  `json:"name_th"`
	NameEN        *string `json:"name_en"`
	Description   *string `json:"description"`
	Credits       int     `json:"credits"`
	GradeScheme   string  `json:"grade_scheme"`
	IsActive      *bool   `json:"is_active"`
	ConfirmImpact bool    `json:"confirm_impact"`
}

type FreeElectiveRoundEnrollmentInput struct {
	EnrollmentID           uint64 `json:"enrollment_id"`
	EnrollmentCurriculumID uint64 `json:"enrollment_curriculum_id"`
}

type FreeElectiveImpact struct {
	GradeRecordCount    int    `json:"grade_record_count"`
	LearnerCount        int    `json:"learner_count"`
	RoundCount          int    `json:"round_count"`
	FinalizedRoundCount int    `json:"finalized_round_count"`
	CohortCount         int    `json:"cohort_count"`
	PreviousScheme      string `json:"previous_scheme"`
	NextScheme          string `json:"next_scheme"`
}
