package models

import (
	"encoding/json"
	"time"
)

type AssessmentBilingualText struct {
	TH string `json:"th"`
	EN string `json:"en"`
}

type AssessmentProviderInput struct {
	Curriculum       *AssessmentBilingualText       `json:"curriculum,omitempty"`
	Semester         uint                           `json:"semester"`
	TargetYearBE     uint64                         `json:"target_year_be"`
	Completeness     string                         `json:"completeness"`
	Readiness        AssessmentProviderReadiness    `json:"readiness"`
	Availability     []AssessmentSourceAvailability `json:"availability"`
	AcademicEvidence []AssessmentProviderCourse     `json:"academic_evidence"`
	CompetencyScores []AssessmentProviderCompetency `json:"competency_scores"`
	ActivityEvidence []AssessmentProviderActivity   `json:"activity_evidence"`
}

type AssessmentProviderReadiness struct {
	Status           string                              `json:"status"`
	PassedCount      int                                 `json:"passed_count"`
	RequirementCount int                                 `json:"requirement_count"`
	Results          []AssessmentProviderReadinessResult `json:"results"`
}

type AssessmentProviderReadinessResult struct {
	RequirementID uint64   `json:"requirement_id"`
	CriterionType string   `json:"criterion_type"`
	NameTH        string   `json:"name_th"`
	NameEN        string   `json:"name_en,omitempty"`
	Status        string   `json:"status"`
	CurrentValue  *float64 `json:"current_value,omitempty"`
	RequiredValue *float64 `json:"required_value,omitempty"`
	CurrentGrade  *string  `json:"current_grade,omitempty"`
	RequiredGrade *string  `json:"required_grade,omitempty"`
	CourseNameTH  *string  `json:"course_name_th,omitempty"`
	CourseNameEN  *string  `json:"course_name_en,omitempty"`
	CategoryTH    *string  `json:"category_name_th,omitempty"`
	CategoryEN    *string  `json:"category_name_en,omitempty"`
	Explanation   string   `json:"explanation"`
}

type AssessmentProviderCourse struct {
	Source          string   `json:"source,omitempty"`
	EvidenceRef     string   `json:"evidence_ref"`
	OccurrenceCount int      `json:"occurrence_count"`
	CourseCode      string   `json:"course_code"`
	CourseNameTH    string   `json:"course_name_th"`
	CourseNameEN    string   `json:"course_name_en,omitempty"`
	AcademicYear    uint64   `json:"academic_year_be"`
	Semester        uint64   `json:"semester"`
	Credits         int      `json:"credits"`
	GradeScheme     string   `json:"grade_scheme"`
	Grade           string   `json:"grade,omitempty"`
	CategoriesTH    []string `json:"categories_th,omitempty"`
}

type AssessmentProviderCompetency struct {
	CompetencyRef     string                            `json:"competency_ref"`
	NameTH            string                            `json:"name_th"`
	NameEN            string                            `json:"name_en,omitempty"`
	CoreScore         float64                           `json:"core_score"`
	BonusScore        float64                           `json:"bonus_score"`
	FreeElectiveScore float64                           `json:"free_elective_score"`
	ActivityScore     float64                           `json:"activity_score"`
	HasEvidence       bool                              `json:"has_evidence"`
	CourseScores      []AssessmentProviderCourseScore   `json:"course_scores"`
	ActivityScores    []AssessmentProviderActivityScore `json:"activity_scores"`
}

type AssessmentProviderCourseScore struct {
	EvidenceRef     string  `json:"evidence_ref"`
	OccurrenceCount int     `json:"occurrence_count"`
	CourseRef       string  `json:"course_evidence_ref"`
	Source          string  `json:"source"`
	RawScore        float64 `json:"raw_score"`
	Weight          float64 `json:"weight"`
	Weighted        float64 `json:"weighted_score"`
	ScoreType       string  `json:"score_type"`
}

type AssessmentProviderActivityScore struct {
	EvidenceRef         string `json:"evidence_ref"`
	ActivityEvidenceRef string `json:"activity_evidence_ref"`
}

type AssessmentProviderActivity struct {
	EvidenceRef         string   `json:"evidence_ref"`
	ScoreEvidenceRef    string   `json:"score_evidence_ref,omitempty"`
	ActivityEvidenceRef string   `json:"activity_evidence_ref,omitempty"`
	OccurrenceCount     int      `json:"occurrence_count"`
	ActivityNameTH      string   `json:"activity_name_th"`
	ActivityNameEN      string   `json:"activity_name_en,omitempty"`
	ActivityCategory    string   `json:"activity_category,omitempty"`
	ActivityType        string   `json:"activity_type,omitempty"`
	StartAt             string   `json:"start_at"`
	AttendanceStatus    string   `json:"attendance_status"`
	Score               *float64 `json:"earned_percent,omitempty"`
	ScoreUnavailable    string   `json:"score_unavailable_reason,omitempty"`
}

type AssessmentReportFinding struct {
	ObservationID     string                   `json:"observation_id"`
	Title             AssessmentBilingualText  `json:"title"`
	Reason            AssessmentBilingualText  `json:"reason"`
	Explanation       *AssessmentBilingualText `json:"explanation,omitempty"`
	DevelopmentAdvice *AssessmentBilingualText `json:"development_advice,omitempty"`
	EvidenceRefs      []string                 `json:"evidence_refs"`
}

type AssessmentObservation struct {
	ObservationID string                  `json:"observation_id"`
	Kind          string                  `json:"kind"`
	FactType      string                  `json:"fact_type"`
	Values        AssessmentFactValues    `json:"values"`
	Title         AssessmentBilingualText `json:"title"`
	Fact          AssessmentBilingualText `json:"fact"`
	EvidenceRefs  []string                `json:"evidence_refs"`
}

// These fields describe facts, not thresholds inferred by the language model.
type AssessmentFactValues struct {
	CriterionType     string                 `json:"criterion_type,omitempty"`
	Status            string                 `json:"status,omitempty"`
	CurrentValue      *float64               `json:"current_value,omitempty"`
	RequiredValue     *float64               `json:"required_value,omitempty"`
	CurrentGrade      *string                `json:"current_grade,omitempty"`
	RequiredGrade     *string                `json:"required_grade,omitempty"`
	AcademicYear      *uint64                `json:"academic_year_be,omitempty"`
	Semester          *uint64                `json:"semester,omitempty"`
	Grade             string                 `json:"grade,omitempty"`
	RecordCount       *int                   `json:"record_count,omitempty"`
	MissingGradeCount *int                   `json:"missing_grade_count,omitempty"`
	GradeCounts       []AssessmentGradeCount `json:"grade_counts,omitempty"`
	CoreScore         *float64               `json:"core_score,omitempty"`
	CourseBonusScore  *float64               `json:"course_bonus_score,omitempty"`
	FreeElectiveScore *float64               `json:"free_elective_score,omitempty"`
	ActivityScore     *float64               `json:"activity_score,omitempty"`
	AttendanceStatus  string                 `json:"attendance_status,omitempty"`
}

type AssessmentGradeCount struct {
	GradeScheme string `json:"grade_scheme"`
	Grade       string `json:"grade"`
	Count       int    `json:"count"`
}

type AssessmentNarrativeFinding struct {
	ObservationID     string                   `json:"observation_id"`
	Explanation       AssessmentBilingualText  `json:"explanation"`
	DevelopmentAdvice *AssessmentBilingualText `json:"development_advice,omitempty"`
}

type AssessmentNarrativeOutput struct {
	Strengths    []AssessmentNarrativeFinding `json:"strengths"`
	Limitations  []AssessmentNarrativeFinding `json:"limitations"`
	Observations []AssessmentNarrativeFinding `json:"observations"`
}

type AssessmentValidatedOutput struct {
	ReadinessExplanation AssessmentBilingualText   `json:"readiness_explanation"`
	Strengths            []AssessmentReportFinding `json:"strengths"`
	Limitations          []AssessmentReportFinding `json:"limitations"`
	Observations         []AssessmentReportFinding `json:"observations"`
}

type AssessmentNarrativeSentence struct {
	ObservationID string                  `json:"observation_id"`
	Intent        string                  `json:"intent"`
	Text          AssessmentBilingualText `json:"text"`
}

type AssessmentNarrativeParagraph struct {
	Section   string                        `json:"section"`
	Sentences []AssessmentNarrativeSentence `json:"sentences"`
}

type AssessmentProseOutput struct {
	Paragraphs []AssessmentNarrativeParagraph `json:"paragraphs"`
}

type AssessmentReportParagraph struct {
	Text         AssessmentBilingualText       `json:"text"`
	Sentences    []AssessmentNarrativeSentence `json:"sentences,omitempty"`
	EvidenceRefs []string                      `json:"evidence_refs"`
}

type AssessmentReportNarrative struct {
	Readiness    []AssessmentReportParagraph `json:"readiness"`
	Strengths    []AssessmentReportParagraph `json:"strengths"`
	Development  []AssessmentReportParagraph `json:"development"`
	Observations []AssessmentReportParagraph `json:"observations"`
	DataScope    []AssessmentReportParagraph `json:"data_scope"`
}

type AssessmentProseReport struct {
	SchemaVersion string                    `json:"schema_version"`
	Narrative     AssessmentReportNarrative `json:"narrative"`
}

type AssessmentJob struct {
	JobID                  uint64          `json:"job_id"`
	EnrollmentCurriculumID uint64          `json:"-"`
	Semester               uint            `json:"semester"`
	TargetYearBE           uint64          `json:"target_year_be"`
	InputHash              string          `json:"-"`
	InputSnapshot          json.RawMessage `json:"-"`
	Status                 string          `json:"status"`
	ProgressPhase          string          `json:"progress_phase,omitempty"`
	PhaseStartedAt         *time.Time      `json:"phase_started_at,omitempty"`
	LastProviderActivityAt *time.Time      `json:"last_provider_activity_at,omitempty"`
	AttemptCount           uint            `json:"attempt_count"`
	MaxAttempts            uint            `json:"max_attempts"`
	LeaseToken             string          `json:"-"`
	LeaseExpiresAt         *time.Time      `json:"-"`
	HeartbeatAt            *time.Time      `json:"heartbeat_at,omitempty"`
	NextAttemptAt          *time.Time      `json:"next_attempt_at,omitempty"`
	FailureWaitUntil       *time.Time      `json:"-"`
	RequestedAt            time.Time       `json:"requested_at"`
	StartedAt              *time.Time      `json:"started_at,omitempty"`
	FinishedAt             *time.Time      `json:"finished_at,omitempty"`
	ErrorCode              string          `json:"error_code,omitempty"`
	ServerTime             *time.Time      `json:"server_time,omitempty"`
}

type AssessmentReportRecord struct {
	ReportID                  uint64          `json:"report_id"`
	EnrollmentCurriculumID    uint64          `json:"-"`
	Semester                  uint            `json:"semester"`
	TargetYearBE              uint64          `json:"target_year_be"`
	SourceHash                string          `json:"source_hash"`
	SourceSnapshot            json.RawMessage `json:"source_snapshot"`
	Content                   json.RawMessage `json:"content"`
	Completeness              string          `json:"completeness"`
	ProviderName              string          `json:"provider_name"`
	ModelName                 string          `json:"model_name"`
	ModelDigest               string          `json:"model_digest"`
	ProviderConfigFingerprint string          `json:"provider_config_fingerprint"`
	PipelineVersion           string          `json:"pipeline_version"`
	PromptVersion             string          `json:"prompt_version"`
	SchemaVersion             string          `json:"output_schema_version"`
	GeneratedAt               time.Time       `json:"generated_at"`
}

type AssessmentReportState struct {
	GenerationAvailable *bool                          `json:"generation_available,omitempty"`
	RejectedDraft       *AssessmentRejectedDraft       `json:"rejected_draft,omitempty"`
	GenerationState     string                         `json:"generation_state"`
	Completeness        string                         `json:"completeness"`
	IsStale             bool                           `json:"is_stale,omitempty"`
	Semester            uint                           `json:"semester"`
	TargetYearBE        uint64                         `json:"target_year_be"`
	Readiness           CooperativeReadinessResult     `json:"readiness"`
	Availability        []AssessmentSourceAvailability `json:"availability"`
	ContextDiagnostics  *AssessmentContextDiagnostics  `json:"context_diagnostics,omitempty"`
	Job                 *AssessmentJob                 `json:"job,omitempty"`
	Report              *AssessmentReportRecord        `json:"report,omitempty"`
	RetryAfterSeconds   int                            `json:"retry_after_seconds,omitempty"`
}

type AssessmentContextDiagnostics struct {
	AcademicRecordCount      int `json:"academic_record_count"`
	AcademicGroupCount       int `json:"academic_group_count"`
	VerifiedObservationCount int `json:"verified_observation_count"`
	ContextTokens            int `json:"context_tokens"`
	InputBudgetTokens        int `json:"input_budget_tokens"`
	EstimatedInputTokens     int `json:"estimated_input_tokens"`
	EstimatedTotalTokens     int `json:"estimated_total_tokens"`
	OutputReserveTokens      int `json:"output_reserve_tokens"`
	SafetyMarginTokens       int `json:"safety_margin_tokens"`
	SystemPromptBytes        int `json:"system_prompt_bytes"`
	UserPromptBytes          int `json:"user_prompt_bytes"`
	SourceDataBytes          int `json:"source_data_bytes"`
	ReadinessBytes           int `json:"readiness_bytes"`
	AvailabilityBytes        int `json:"availability_bytes"`
	AcademicEvidenceBytes    int `json:"academic_evidence_bytes"`
	CompetencyScoresBytes    int `json:"competency_scores_bytes"`
	ActivityEvidenceBytes    int `json:"activity_evidence_bytes"`
}

type AssessmentReportSourceSnapshot struct {
	Source          LearnerAssessmentSnapshot    `json:"source"`
	ProviderInput   AssessmentProviderInput      `json:"provider_input"`
	Provenance      map[string][]string          `json:"provenance"`
	EstimatedTokens int                          `json:"estimated_tokens"`
	Diagnostics     AssessmentContextDiagnostics `json:"diagnostics"`
}
