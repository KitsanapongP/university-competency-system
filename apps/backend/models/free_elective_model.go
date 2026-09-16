package models

import "time"

type FreeElectiveCourse struct {
	FreeElectiveCourseID   uint64    `json:"free_elective_course_id"`
	FacultyID              uint64    `json:"faculty_id"`
	FacultyNameTH          string    `json:"faculty_name_th"`
	FacultyNameEN          string    `json:"faculty_name_en,omitempty"`
	Code                   string    `json:"code"`
	NameTH                 string    `json:"name_th"`
	NameEN                 string    `json:"name_en,omitempty"`
	Description            string    `json:"description,omitempty"`
	Credits                int       `json:"credits"`
	GradeScheme            string    `json:"grade_scheme"`
	IsActive               bool      `json:"is_active"`
	OfferingCount          int       `json:"offering_count"`
	ActiveOfferingCount    int       `json:"active_offering_count"`
	FinalizedOfferingCount int       `json:"finalized_offering_count"`
	CreatedAt              time.Time `json:"created_at"`
	UpdatedAt              time.Time `json:"updated_at"`
}

type FreeElectiveOffering struct {
	OfferingID                  uint64     `json:"offering_id"`
	FreeElectiveCourseID        uint64     `json:"free_elective_course_id"`
	CourseCode                  string     `json:"course_code"`
	CourseNameTH                string     `json:"course_name_th"`
	CourseNameEN                string     `json:"course_name_en,omitempty"`
	GradeScheme                 string     `json:"grade_scheme"`
	AcademicYearBE              uint64     `json:"academic_year_be"`
	Semester                    uint64     `json:"semester"`
	SectionNo                   string     `json:"section_no"`
	Capacity                    *int       `json:"capacity"`
	Status                      string     `json:"status"`
	ScoresRecalculationRequired bool       `json:"scores_recalculation_required"`
	FinalizedAt                 *time.Time `json:"finalized_at,omitempty"`
	StudentCount                int        `json:"student_count"`
	GradedStudentCount          int        `json:"graded_student_count"`
	CompetencyCount             int        `json:"competency_count"`
	WeightTotal                 float64    `json:"weight_total"`
	CreatedAt                   time.Time  `json:"created_at"`
	UpdatedAt                   time.Time  `json:"updated_at"`
}

type FreeElectiveReadiness struct {
	Ready            bool     `json:"ready"`
	CompetencyMapped bool     `json:"competency_mapped"`
	WeightsValid     bool     `json:"weights_valid"`
	StudentsAdded    bool     `json:"students_added"`
	GradesComplete   bool     `json:"grades_complete"`
	Codes            []string `json:"codes"`
	MessagesTH       []string `json:"messages_th"`
	MessagesEN       []string `json:"messages_en"`
}

type FreeElectiveCompetency struct {
	OfferingCompetencyID uint64  `json:"offering_competency_id"`
	OfferingID           uint64  `json:"offering_id"`
	CompetencyID         uint64  `json:"competency_id"`
	Code                 string  `json:"code"`
	NameTH               string  `json:"name_th"`
	NameEN               string  `json:"name_en,omitempty"`
	WeightPercent        float64 `json:"weight_percent"`
	DisplayOrder         int     `json:"display_order"`
}

type FreeElectiveEnrollment struct {
	OfferingEnrollmentID   uint64     `json:"offering_enrollment_id"`
	OfferingID             uint64     `json:"offering_id"`
	EnrollmentID           uint64     `json:"enrollment_id"`
	EnrollmentCurriculumID uint64     `json:"enrollment_curriculum_id"`
	StudentCode            string     `json:"student_code"`
	StudentNameTH          string     `json:"student_name_th"`
	StudentNameEN          string     `json:"student_name_en,omitempty"`
	CurriculumID           uint64     `json:"curriculum_id"`
	CurriculumNameTH       string     `json:"curriculum_name_th"`
	CurriculumNameEN       string     `json:"curriculum_name_en,omitempty"`
	CohortID               uint64     `json:"cohort_id"`
	EntryYearBE            uint64     `json:"entry_year_be"`
	EnrollmentStatus       string     `json:"enrollment_status"`
	Status                 string     `json:"status"`
	Grade                  string     `json:"grade,omitempty"`
	GradeSource            string     `json:"grade_source,omitempty"`
	IsBestGrade            bool       `json:"is_best_grade"`
	GradeRecordID          *uint64    `json:"grade_record_id,omitempty"`
	UpdatedAt              *time.Time `json:"updated_at,omitempty"`
}

type FreeElectiveOfferingDetail struct {
	Offering      FreeElectiveOffering     `json:"offering"`
	Course        FreeElectiveCourse       `json:"course"`
	Readiness     FreeElectiveReadiness    `json:"readiness"`
	AllowedGrades []string                 `json:"allowed_grades"`
	Competencies  []FreeElectiveCompetency `json:"competencies"`
	Enrollments   []FreeElectiveEnrollment `json:"enrollments"`
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
	StudentCode            string `json:"student_code"`
	StudentNameTH          string `json:"student_name_th"`
	StudentNameEN          string `json:"student_name_en,omitempty"`
	CurriculumID           uint64 `json:"curriculum_id"`
	CurriculumNameTH       string `json:"curriculum_name_th"`
	CurriculumNameEN       string `json:"curriculum_name_en,omitempty"`
	EntryYearBE            uint64 `json:"entry_year_be"`
}

type FreeElectiveStudentCourse struct {
	OfferingID     uint64 `json:"offering_id"`
	CourseCode     string `json:"course_code"`
	CourseNameTH   string `json:"course_name_th"`
	CourseNameEN   string `json:"course_name_en,omitempty"`
	AcademicYearBE uint64 `json:"academic_year_be"`
	Semester       uint64 `json:"semester"`
	SectionNo      string `json:"section_no"`
	GradeScheme    string `json:"grade_scheme"`
	Grade          string `json:"grade,omitempty"`
	GradeSource    string `json:"grade_source,omitempty"`
	IsBestGrade    bool   `json:"is_best_grade"`
	Status         string `json:"status"`
}

type FreeElectiveStudentDetail struct {
	Student FreeElectiveStudent         `json:"student"`
	Courses []FreeElectiveStudentCourse `json:"courses"`
}

type FreeElectiveCourseFilters struct {
	FacultyID *uint64
	YearBE    *uint64
	Semester  *uint64
	Status    string
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

type UpsertFreeElectiveOfferingPayload struct {
	FreeElectiveCourseID uint64 `json:"free_elective_course_id"`
	AcademicYearBE       uint64 `json:"academic_year_be"`
	Semester             uint64 `json:"semester"`
	SectionNo            string `json:"section_no"`
	Capacity             *int   `json:"capacity"`
}

type UpdateFreeElectiveOfferingStatusPayload struct {
	Status string `json:"status"`
}

type ReplaceFreeElectiveCompetenciesPayload struct {
	Competencies []FreeElectiveCompetencyInput `json:"competencies"`
}

type FreeElectiveCompetencyInput struct {
	CompetencyID  uint64  `json:"competency_id"`
	WeightPercent float64 `json:"weight_percent"`
}

type AddFreeElectiveEnrollmentsPayload struct {
	Enrollments []FreeElectiveEnrollmentInput `json:"enrollments"`
}

type FreeElectiveEnrollmentInput struct {
	EnrollmentID           uint64 `json:"enrollment_id"`
	EnrollmentCurriculumID uint64 `json:"enrollment_curriculum_id"`
}

type UpdateFreeElectiveEnrollmentStatusPayload struct {
	Status string `json:"status"`
}

type UpsertFreeElectiveGradePayload struct {
	Grade           string  `json:"grade"`
	GradeSource     string  `json:"grade_source"`
	SourceReference *string `json:"source_reference"`
}

type FreeElectiveGradeImportRow struct {
	RowNumber   int    `json:"row_number"`
	StudentCode string `json:"student_code"`
	Grade       string `json:"grade"`
}

type FreeElectiveGradeImportPayload struct {
	Rows            []FreeElectiveGradeImportRow `json:"rows"`
	ReplaceExisting bool                         `json:"replace_existing"`
}

type FreeElectiveGradeImportIssue struct {
	RowNumber   int    `json:"row_number"`
	StudentCode string `json:"student_code"`
	Message     string `json:"message"`
}

type FreeElectiveGradeWrite struct {
	OfferingEnrollmentID uint64
	Grade                string
	GradeSource          string
	SourceReference      *string
}

type FreeElectiveGradeImportPreview struct {
	ValidRows     []FreeElectiveGradeImportRow   `json:"valid_rows"`
	ExistingRows  []FreeElectiveGradeImportRow   `json:"existing_rows"`
	InvalidRows   []FreeElectiveGradeImportIssue `json:"invalid_rows"`
	DuplicateRows []FreeElectiveGradeImportIssue `json:"duplicate_rows"`
}

type FreeElectiveImpact struct {
	GradeRecordCount       int    `json:"grade_record_count"`
	LearnerCount           int    `json:"learner_count"`
	OfferingCount          int    `json:"offering_count"`
	FinalizedOfferingCount int    `json:"finalized_offering_count"`
	CohortCount            int    `json:"cohort_count"`
	PreviousScheme         string `json:"previous_scheme"`
	NextScheme             string `json:"next_scheme"`
}
