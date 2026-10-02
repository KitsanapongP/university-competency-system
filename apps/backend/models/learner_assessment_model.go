package models

import "time"

type LearnerAssessmentScope struct {
	PersonID               uint64 `json:"-"`
	EnrollmentID           uint64 `json:"-"`
	EnrollmentCurriculumID uint64 `json:"-"`
	CohortID               uint64 `json:"-"`
	CurriculumID           uint64 `json:"-"`
	FacultyID              uint64 `json:"-"`
	EntryYearBE            uint64 `json:"-"`
	TargetYearBE           uint64 `json:"-"`
}

func (scope LearnerAssessmentScope) HasRequiredContext() bool {
	return scope.PersonID > 0 &&
		scope.EnrollmentID > 0 &&
		scope.EnrollmentCurriculumID > 0 &&
		scope.CurriculumID > 0 &&
		scope.FacultyID > 0 &&
		scope.EntryYearBE > 0 &&
		scope.TargetYearBE > 0
}

func (scope *LearnerAssessmentScope) SetTargetYear() bool {
	if scope == nil || scope.EntryYearBE == 0 {
		return false
	}
	scope.TargetYearBE = scope.EntryYearBE + 3
	return true
}

type AssessmentAcademicEvidence struct {
	EvidenceRef  string   `json:"evidence_ref"`
	RecordID     uint64   `json:"record_id"`
	CourseID     uint64   `json:"course_id"`
	Source       string   `json:"source"`
	AcademicYear uint64   `json:"academic_year_be"`
	Semester     uint64   `json:"semester"`
	CourseCode   string   `json:"course_code"`
	CourseNameTH string   `json:"course_name_th"`
	CourseNameEN string   `json:"course_name_en"`
	Credits      int      `json:"credits"`
	GradeScheme  string   `json:"grade_scheme"`
	Grade        string   `json:"grade"`
	CategoryIDs  []uint64 `json:"category_ids,omitempty"`
}

type AssessmentSourceAvailability struct {
	Source    string `json:"source"`
	Available bool   `json:"available"`
	Reason    string `json:"reason_code,omitempty"`
}

type AssessmentSourceMetadata struct {
	PipelineVersion           string `json:"pipeline_version"`
	Provider                  string `json:"provider"`
	Model                     string `json:"model"`
	ModelDigest               string `json:"model_digest"`
	ProviderConfigFingerprint string `json:"provider_config_fingerprint"`
	ThinkEnabled              bool   `json:"think_enabled"`
	PromptVersion             string `json:"prompt_version"`
	SchemaVersion             string `json:"schema_version"`
	CompactionVersion         string `json:"compaction_version"`
	ContextTokenLimit         int    `json:"context_token_limit"`
	OutputTokenReserve        int    `json:"output_token_reserve"`
	TokenSafetyMargin         int    `json:"token_safety_margin"`
	SourceHash                string `json:"source_hash"`
}

type AssessmentCourseScore struct {
	EvidenceRef       string  `json:"evidence_ref"`
	CourseEvidenceRef string  `json:"course_evidence_ref"`
	Source            string  `json:"source"`
	CourseID          uint64  `json:"course_id"`
	CourseCode        string  `json:"course_code"`
	CourseNameTH      string  `json:"course_name_th"`
	CourseNameEN      string  `json:"course_name_en"`
	AcademicYearBE    uint64  `json:"academic_year_be"`
	Semester          uint64  `json:"semester"`
	Grade             string  `json:"grade"`
	RawScore          float64 `json:"raw_score"`
	Weight            float64 `json:"weight"`
	WeightedScore     float64 `json:"weighted_score"`
	ScoreType         string  `json:"score_type"`
}

type AssessmentCompetencyScore struct {
	CompetencyID      uint64                    `json:"competency_id"`
	CompetencyCode    string                    `json:"competency_code"`
	CompetencyNameTH  string                    `json:"competency_name_th"`
	CompetencyNameEN  string                    `json:"competency_name_en"`
	CoreScore         float64                   `json:"core_score"`
	BonusScore        float64                   `json:"bonus_score"`
	FreeElectiveScore float64                   `json:"free_elective_score"`
	ActivityScore     float64                   `json:"activity_score"`
	HasEvidence       bool                      `json:"has_evidence"`
	CourseScores      []AssessmentCourseScore   `json:"course_scores"`
	ElectiveScores    []AssessmentCourseScore   `json:"free_elective_scores"`
	ActivityScores    []AssessmentActivityScore `json:"activity_scores"`
}

type AssessmentActivityEvidence struct {
	EvidenceRef            string    `json:"evidence_ref"`
	ScoreEvidenceRef       string    `json:"score_evidence_ref,omitempty"`
	AttendanceID           uint64    `json:"attendance_id"`
	SessionID              uint64    `json:"session_id"`
	ActivityID             uint64    `json:"activity_id"`
	SessionCompetencyID    uint64    `json:"session_competency_id,omitempty"`
	CompetencyID           uint64    `json:"competency_id,omitempty"`
	CompetencyCode         string    `json:"competency_code,omitempty"`
	CompetencyNameTH       string    `json:"competency_name_th,omitempty"`
	CompetencyNameEN       string    `json:"competency_name_en,omitempty"`
	ActivityNameTH         string    `json:"activity_name_th"`
	ActivityNameEN         string    `json:"activity_name_en"`
	ActivityCategory       string    `json:"activity_category,omitempty"`
	ActivityType           string    `json:"activity_type,omitempty"`
	StartAt                time.Time `json:"start_at"`
	AttendanceStatus       string    `json:"attendance_status"`
	SessionStatus          string    `json:"session_status"`
	MaxPercent             float64   `json:"max_percent,omitempty"`
	EarnedPercent          *float64  `json:"earned_percent,omitempty"`
	ScoreUnavailableReason string    `json:"score_unavailable_reason,omitempty"`
}

type AssessmentActivityScore struct {
	EvidenceRef         string    `json:"evidence_ref"`
	ActivityEvidenceRef string    `json:"activity_evidence_ref"`
	ActivityID          uint64    `json:"activity_id"`
	ActivityNameTH      string    `json:"activity_name_th"`
	ActivityNameEN      string    `json:"activity_name_en"`
	StartAt             time.Time `json:"start_at"`
	AttendanceStatus    string    `json:"attendance_status"`
	MaxPercent          float64   `json:"max_percent"`
	EarnedPercent       float64   `json:"earned_percent"`
}

type LearnerAssessmentSnapshot struct {
	Scope            LearnerAssessmentScope         `json:"-"`
	Semester         uint                           `json:"semester"`
	TargetYearBE     uint64                         `json:"target_year_be"`
	CapturedAt       time.Time                      `json:"captured_at"`
	Completeness     string                         `json:"completeness"`
	Metadata         AssessmentSourceMetadata       `json:"metadata"`
	Readiness        CooperativeReadinessResult     `json:"readiness"`
	AcademicEvidence []AssessmentAcademicEvidence   `json:"academic_evidence"`
	CourseScores     []AssessmentCompetencyScore    `json:"course_competency_scores"`
	ActivityEvidence []AssessmentActivityEvidence   `json:"activity_evidence"`
	Availability     []AssessmentSourceAvailability `json:"availability"`
}
