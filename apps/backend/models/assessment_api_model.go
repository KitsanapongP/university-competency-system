package models

import "time"

type AssessmentDraftViolation struct {
	Reason         string `json:"reason"`
	Rule           string `json:"rule,omitempty"`
	Section        string `json:"section,omitempty"`
	ParagraphIndex int    `json:"paragraph_index,omitempty"`
	SentenceIndex  int    `json:"sentence_index,omitempty"`
	Language       string `json:"language,omitempty"`
	Field          string `json:"field,omitempty"`
}

type AssessmentRejectedDraft struct {
	EnrollmentCurriculumID uint64                   `json:"-"`
	Semester               uint                     `json:"semester"`
	JobID                  uint64                   `json:"job_id"`
	SourceHash             string                   `json:"-"`
	Preview                string                   `json:"preview"`
	Truncated              bool                     `json:"truncated"`
	Violation              AssessmentDraftViolation `json:"violation"`
	CreatedAt              time.Time                `json:"created_at"`
	PreviousAttempt        bool                     `json:"previous_attempt"`
	IsStale                bool                     `json:"is_stale"`
}
