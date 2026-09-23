package models

type LearnerAcademicProfile struct {
	StudentCode      string `json:"student_code"`
	NameTH           string `json:"name_th"`
	NameEN           string `json:"name_en"`
	EntryYearBE      uint64 `json:"entry_year_be"`
	FacultyNameTH    string `json:"faculty_name_th"`
	FacultyNameEN    string `json:"faculty_name_en"`
	MajorNameTH      string `json:"major_name_th"`
	MajorNameEN      string `json:"major_name_en"`
	CurriculumNameTH string `json:"curriculum_name_th"`
	CurriculumNameEN string `json:"curriculum_name_en"`
}

type LearnerAcademicCourse struct {
	RecordID       uint64 `json:"record_id"`
	CourseID       uint64 `json:"course_id"`
	Source         string `json:"source"`
	AcademicYearBE uint64 `json:"academic_year_be"`
	StudyYear      uint64 `json:"study_year,omitempty"`
	Semester       uint64 `json:"semester"`
	CourseCode     string `json:"course_code"`
	CourseNameTH   string `json:"course_name_th"`
	CourseNameEN   string `json:"course_name_en"`
	Credits        int    `json:"credits"`
	GradeScheme    string `json:"grade_scheme"`
	Grade          string `json:"grade"`
}

type LearnerAcademicGradeSummary struct {
	CR  int      `json:"cr"`
	CP  int      `json:"cp"`
	CA  int      `json:"ca"`
	GP  float64  `json:"gp"`
	GPA *float64 `json:"gpa"`
}

type LearnerAcademicTermSummary struct {
	StudyYear      uint64                      `json:"study_year,omitempty"`
	AcademicYearBE uint64                      `json:"academic_year_be"`
	Semester       uint64                      `json:"semester"`
	Term           LearnerAcademicGradeSummary `json:"term"`
	Cumulative     LearnerAcademicGradeSummary `json:"cumulative"`
}

type LearnerAcademicProfileResponse struct {
	Profile       LearnerAcademicProfile       `json:"profile"`
	CourseHistory []LearnerAcademicCourse      `json:"course_history"`
	TermSummaries []LearnerAcademicTermSummary `json:"term_summaries"`
}
