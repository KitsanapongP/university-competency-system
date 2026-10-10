package services

import (
	"github.com/spw32767/university-competency-system-backend/models"
	"strings"
	"testing"
)

func TestRejectedDraftRedactsBeforeTruncation(t *testing.T) {
	job := models.AssessmentJob{JobID: 5, EnrollmentCurriculumID: 10, Semester: 1, InputHash: "hash"}
	d := BuildAssessmentRejectedDraft([]byte("person@example.test Bearer secret-value "+strings.Repeat("a", 9000)), assessmentValidationFailure(assessmentReasonMalformedJSON, "output", ""), job)
	if strings.Contains(d.Preview, "person@example.test") || strings.Contains(d.Preview, "secret-value") || len([]rune(d.Preview)) != 8000 || !d.Truncated {
		t.Fatal("unsafe or unbounded preview")
	}
	if d.JobID != 5 || d.SourceHash != "hash" || d.Violation.Reason != "malformed_json" {
		t.Fatal("lost attribution")
	}
	d = BuildAssessmentRejectedDraft([]byte(`{"strengths":[{"sentences":[{"text":{"th":"Safe Thai","en":"Safe English"},"secret":"do not expose"}]}],"password":"do not expose"}`), assessmentValidationFailure(assessmentReasonUnknownField, "output", ""), job)
	if strings.Contains(d.Preview, "do not expose") || !strings.Contains(d.Preview, "Safe English") {
		t.Fatal("unknown fields exposed")
	}
	d = BuildAssessmentRejectedDraft([]byte("invented learner name"), assessmentValidationFailure(assessmentReasonPIIDetected, "sentence.text", "th"), job)
	if d.Preview != "" {
		t.Fatal("PII output must be suppressed")
	}
}
