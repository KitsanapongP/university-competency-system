package models

import "time"

// FreeElectiveRound is one faculty-owned opening period that can contain many
// free-elective courses.
type FreeElectiveRound struct {
	RoundID                     uint64     `json:"round_id"`
	FacultyID                   uint64     `json:"faculty_id"`
	FacultyNameTH               string     `json:"faculty_name_th"`
	FacultyNameEN               string     `json:"faculty_name_en,omitempty"`
	AcademicYearBE              uint64     `json:"academic_year_be"`
	Semester                    uint64     `json:"semester"`
	Status                      string     `json:"status"`
	ScoresRecalculationRequired bool       `json:"scores_recalculation_required"`
	FinalizedAt                 *time.Time `json:"finalized_at,omitempty"`
	CourseCount                 int        `json:"course_count"`
	LearnerCount                int        `json:"learner_count"`
	GradeCount                  int        `json:"grade_count"`
	CreatedAt                   time.Time  `json:"created_at"`
	UpdatedAt                   time.Time  `json:"updated_at"`
}

// FreeElectiveRoundCourse contains the metadata shown for a course in a
// particular round. The master course remains the stable course identity.
type FreeElectiveRoundCourse struct {
	RoundCourseID        uint64                              `json:"round_course_id"`
	RoundID              uint64                              `json:"round_id"`
	FreeElectiveCourseID uint64                              `json:"free_elective_course_id"`
	CourseCode           string                              `json:"course_code"`
	CourseNameTH         string                              `json:"course_name_th"`
	CourseNameEN         string                              `json:"course_name_en,omitempty"`
	Description          string                              `json:"description,omitempty"`
	Credits              int                                 `json:"credits"`
	GradeScheme          string                              `json:"grade_scheme"`
	DisplayOrder         int                                 `json:"display_order"`
	Competencies         []FreeElectiveRoundCourseCompetency `json:"competencies,omitempty"`
	StudentCount         int                                 `json:"student_count"`
	GradedStudentCount   int                                 `json:"graded_student_count"`
	CreatedAt            time.Time                           `json:"created_at"`
	UpdatedAt            time.Time                           `json:"updated_at"`
}

type FreeElectiveRoundCourseCompetency struct {
	RoundCourseCompetencyID uint64  `json:"round_course_competency_id"`
	RoundCourseID           uint64  `json:"round_course_id"`
	CompetencyID            uint64  `json:"competency_id"`
	Code                    string  `json:"code"`
	NameTH                  string  `json:"name_th"`
	NameEN                  string  `json:"name_en,omitempty"`
	WeightPercent           float64 `json:"weight_percent"`
	DisplayOrder            int     `json:"display_order"`
}

type FreeElectiveRoundEnrollment struct {
	RoundCourseEnrollmentID uint64     `json:"round_course_enrollment_id"`
	RoundCourseID           uint64     `json:"round_course_id"`
	EnrollmentID            uint64     `json:"enrollment_id"`
	EnrollmentCurriculumID  uint64     `json:"enrollment_curriculum_id"`
	StudentCode             string     `json:"student_code"`
	StudentNameTH           string     `json:"student_name_th"`
	StudentNameEN           string     `json:"student_name_en,omitempty"`
	CurriculumID            uint64     `json:"curriculum_id"`
	CurriculumNameTH        string     `json:"curriculum_name_th"`
	CurriculumNameEN        string     `json:"curriculum_name_en,omitempty"`
	CohortID                uint64     `json:"cohort_id"`
	EntryYearBE             uint64     `json:"entry_year_be"`
	EnrollmentStatus        string     `json:"enrollment_status"`
	Status                  string     `json:"status"`
	Grade                   string     `json:"grade,omitempty"`
	GradeSource             string     `json:"grade_source,omitempty"`
	IsBestGrade             bool       `json:"is_best_grade"`
	GradeRecordID           *uint64    `json:"grade_record_id,omitempty"`
	UpdatedAt               *time.Time `json:"updated_at,omitempty"`
}

type FreeElectiveRoundCourseDetail struct {
	Course        FreeElectiveRoundCourse       `json:"course"`
	AllowedGrades []string                      `json:"allowed_grades"`
	Enrollments   []FreeElectiveRoundEnrollment `json:"enrollments"`
}

type FreeElectiveRoundDetail struct {
	Round   FreeElectiveRound         `json:"round"`
	Courses []FreeElectiveRoundCourse `json:"courses"`
}

type FreeElectiveRoundFilters struct {
	FacultyID      *uint64
	AcademicYearBE *uint64
	Semester       *uint64
	Status         string
}

type FreeElectiveRoundCourseInput struct {
	RoundCourseID        uint64                             `json:"round_course_id"`
	FreeElectiveCourseID uint64                             `json:"free_elective_course_id"`
	CourseCode           string                             `json:"course_code"`
	CourseNameTH         string                             `json:"course_name_th"`
	CourseNameEN         *string                            `json:"course_name_en"`
	Description          *string                            `json:"description"`
	Credits              int                                `json:"credits"`
	GradeScheme          string                             `json:"grade_scheme"`
	Competencies         []FreeElectiveRoundCompetencyInput `json:"competencies"`
}

type FreeElectiveRoundCompetencyInput struct {
	CompetencyID  uint64  `json:"competency_id"`
	WeightPercent float64 `json:"weight_percent"`
}

type CreateFreeElectiveRoundPayload struct {
	FacultyID      uint64                         `json:"faculty_id"`
	AcademicYearBE uint64                         `json:"academic_year_be"`
	Semester       uint64                         `json:"semester"`
	Courses        []FreeElectiveRoundCourseInput `json:"courses"`
}

type PreviewFreeElectiveRoundPayload struct {
	FacultyID      uint64                         `json:"faculty_id"`
	AcademicYearBE uint64                         `json:"academic_year_be"`
	Semester       uint64                         `json:"semester"`
	Courses        []FreeElectiveRoundCourseInput `json:"courses"`
}

type FreeElectiveRoundPreview struct {
	Valid          bool                               `json:"valid"`
	FacultyID      uint64                             `json:"faculty_id"`
	AcademicYearBE uint64                             `json:"academic_year_be"`
	Semester       uint64                             `json:"semester"`
	Courses        []FreeElectiveRoundCourseInput     `json:"courses"`
	Errors         []FreeElectiveRoundValidationIssue `json:"errors"`
}

type FreeElectiveRoundValidationIssue struct {
	Path    string `json:"path"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

type DuplicateFreeElectiveRoundPayload struct {
	AcademicYearBE uint64 `json:"academic_year_be"`
	Semester       uint64 `json:"semester"`
}

type AddFreeElectiveRoundCoursePayload struct {
	FreeElectiveCourseID uint64                             `json:"free_elective_course_id"`
	Competencies         []FreeElectiveRoundCompetencyInput `json:"competencies"`
}

type ReplaceFreeElectiveRoundCourseCompetenciesPayload struct {
	Competencies []FreeElectiveRoundCompetencyInput `json:"competencies"`
}

type AddFreeElectiveRoundEnrollmentsPayload struct {
	Enrollments []FreeElectiveEnrollmentInput `json:"enrollments"`
}

type UpdateFreeElectiveRoundEnrollmentStatusPayload struct {
	Status string `json:"status"`
}

type UpsertFreeElectiveRoundGradePayload struct {
	Grade           string  `json:"grade"`
	GradeSource     string  `json:"grade_source"`
	SourceReference *string `json:"source_reference"`
}

type FreeElectiveRoundLearnerFilters struct {
	Search string
}
