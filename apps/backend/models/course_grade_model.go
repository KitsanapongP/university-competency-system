package models

import "time"

type CourseGradeFilters struct {
	Search         string
	AcademicYearBE *uint64
	Semester       *uint64
	CourseID       *uint64
	Status         string
}

type CourseGrade struct {
	CourseStudentID        uint64    `json:"course_student_id"`
	EnrollmentID           uint64    `json:"enrollment_id"`
	EnrollmentCurriculumID uint64    `json:"student_curricula_id"`
	StudentCode            string    `json:"student_code"`
	StudentNameTH          string    `json:"student_name_th"`
	CourseID               uint64    `json:"course_id"`
	CourseCode             string    `json:"course_code"`
	CourseNameTH           string    `json:"course_name_th"`
	CourseNameEN           string    `json:"course_name_en"`
	CourseType             string    `json:"course_type"`
	Credits                int       `json:"credits"`
	AcademicYearBE         uint64    `json:"academic_year_be"`
	Semester               uint64    `json:"semester"`
	Grade                  string    `json:"grade"`
	GradeSource            string    `json:"grade_source"`
	SourceReference        *string   `json:"source_reference"`
	IsBestGrade            bool      `json:"is_best_grade"`
	UpdatedAt              time.Time `json:"updated_at"`
}

type CourseGradeCourseSummary struct {
	CourseID         uint64 `json:"course_id"`
	CourseCode       string `json:"course_code"`
	CourseNameTH     string `json:"course_name_th"`
	CourseNameEN     string `json:"course_name_en"`
	CourseType       string `json:"course_type"`
	Credits          int    `json:"credits"`
	TotalStudents    int    `json:"total_students"`
	RecordedStudents int    `json:"recorded_students"`
}

type CourseGradeStudentSummary struct {
	EnrollmentID    uint64 `json:"enrollment_id"`
	StudentCode     string `json:"student_code"`
	StudentNameTH   string `json:"student_name_th"`
	TotalCourses    int    `json:"total_courses"`
	RecordedCourses int    `json:"recorded_courses"`
}

type CourseGradeOverview struct {
	CohortID                          uint64                      `json:"cohort_id"`
	CourseScoresRecalculationRequired bool                        `json:"course_scores_recalculation_required"`
	CourseScoresRecalculatedAt        *time.Time                  `json:"course_scores_recalculated_at"`
	TotalStudents                     int                         `json:"total_students"`
	TotalCourses                      int                         `json:"total_courses"`
	RecordedGrades                    int                         `json:"recorded_grades"`
	Courses                           []CourseGradeCourseSummary  `json:"courses"`
	Students                          []CourseGradeStudentSummary `json:"students"`
}

type CourseGradeStudentDetail struct {
	EnrollmentID                      uint64        `json:"enrollment_id"`
	StudentCode                       string        `json:"student_code"`
	StudentNameTH                     string        `json:"student_name_th"`
	Grades                            []CourseGrade `json:"grades"`
	CourseScoresRecalculationRequired bool          `json:"course_scores_recalculation_required"`
}

type CourseGradeCourseRosterStudent struct {
	EnrollmentID  uint64        `json:"enrollment_id"`
	StudentCode   string        `json:"student_code"`
	StudentNameTH string        `json:"student_name_th"`
	SelectedGrade *CourseGrade  `json:"selected_grade"`
	OtherGrades   []CourseGrade `json:"other_grades"`
}

type CourseGradeCourseDetail struct {
	Course                            CourseGradeCourseSummary         `json:"course"`
	Students                          []CourseGradeCourseRosterStudent `json:"students"`
	CourseScoresRecalculationRequired bool                             `json:"course_scores_recalculation_required"`
}

type UpsertCourseGradeRow struct {
	RowNumber       int     `json:"row_number"`
	CourseStudentID uint64  `json:"course_student_id"`
	EnrollmentID    uint64  `json:"enrollment_id"`
	StudentCode     string  `json:"student_code"`
	CourseID        uint64  `json:"course_id"`
	CourseCode      string  `json:"course_code"`
	AcademicYearBE  uint64  `json:"academic_year_be"`
	Semester        uint64  `json:"semester"`
	Grade           string  `json:"grade"`
	SourceReference *string `json:"source_reference"`
	Replace         bool    `json:"replace"`
}

type PutCourseGradesRequest struct {
	Rows []UpsertCourseGradeRow `json:"rows"`
}

type CourseGradeImportIssue struct {
	RowNumber   int    `json:"row_number"`
	StudentCode string `json:"student_code"`
	CourseCode  string `json:"course_code"`
	Message     string `json:"message"`
}

type CourseGradeImportConflict struct {
	RowNumber       int    `json:"row_number"`
	StudentCode     string `json:"student_code"`
	CourseCode      string `json:"course_code"`
	AcademicYearBE  uint64 `json:"academic_year_be"`
	Semester        uint64 `json:"semester"`
	ExistingGrade   string `json:"existing_grade"`
	IncomingGrade   string `json:"incoming_grade"`
	CourseStudentID uint64 `json:"course_student_id"`
	Replace         bool   `json:"replace"`
}

type CourseGradeImportPreview struct {
	ValidRows []UpsertCourseGradeRow      `json:"valid_rows"`
	Conflicts []CourseGradeImportConflict `json:"conflicts"`
	Errors    []CourseGradeImportIssue    `json:"errors"`
}

type CourseGradeImportCommitResult struct {
	ImportedRows                      int  `json:"imported_rows"`
	SkippedConflicts                  int  `json:"skipped_conflicts"`
	ReplacedRows                      int  `json:"replaced_rows"`
	CourseScoresRecalculationRequired bool `json:"course_scores_recalculation_required"`
}
