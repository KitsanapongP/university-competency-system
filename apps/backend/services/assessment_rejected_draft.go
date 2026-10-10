package services

import (
	"encoding/json"
	"errors"
	"github.com/spw32767/university-competency-system-backend/models"
	"regexp"
	"strings"
)

var assessmentCredentialPreviewPattern = regexp.MustCompile(`(?i)(?:bearer\s+[a-z0-9._-]+|(?:api[_ -]?key|authorization|password|secret)\s*[":=]+\s*[^\s,}]+)`)

func BuildAssessmentRejectedDraft(raw []byte, err error, job models.AssessmentJob) models.AssessmentRejectedDraft {
	d := models.AssessmentRejectedDraft{EnrollmentCurriculumID: job.EnrollmentCurriculumID, Semester: job.Semester, JobID: job.JobID, SourceHash: job.InputHash, Violation: models.AssessmentDraftViolation{Reason: assessmentReasonUnknown}}
	var e *AssessmentOutputValidationError
	if errors.As(err, &e) {
		d.Violation = models.AssessmentDraftViolation{Reason: safeAssessmentValidationReason(e.Reason), Rule: safeAssessmentValidationRule(e.Rule), Section: safeAssessmentSection(e.Section), ParagraphIndex: max(e.ParagraphIndex, 0), SentenceIndex: max(e.SentenceIndex, 0), Language: safeAssessmentLanguage(e.Language), Field: safeAssessmentField(e.Field)}
	}
	// If the validator detects personal data, suppress the entire preview, not just the matching token.
	if d.Violation.Reason == assessmentReasonPIIDetected {
		return d
	}
	preview := string(raw)
	var root map[string]json.RawMessage
	if json.Unmarshal(raw, &root) == nil {
		lines := []string{}
		for _, section := range []string{"strengths", "development", "observations"} {
			var paragraphs []struct {
				Sentences []struct {
					Text models.AssessmentBilingualText `json:"text"`
				} `json:"sentences"`
			}
			if json.Unmarshal(root[section], &paragraphs) != nil {
				continue
			}
			for _, p := range paragraphs {
				for _, s := range p.Sentences {
					lines = append(lines, s.Text.TH, s.Text.EN)
				}
			}
		}
		preview = strings.Join(lines, "\n\n")
	}
	for _, pattern := range []*regexp.Regexp{assessmentEmailPattern, assessmentPhonePattern, assessmentNationalIDPattern, assessmentStudentIDPattern, assessmentCredentialPreviewPattern} {
		preview = pattern.ReplaceAllString(preview, "[redacted]")
	}
	text := []rune(strings.TrimSpace(preview))
	d.Truncated = len(text) > 8000
	if d.Truncated {
		text = text[:8000]
	}
	d.Preview = string(text)
	return d
}
