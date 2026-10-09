package services

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/spw32767/university-competency-system-backend/models"
)

func TestAssessmentValidationDiagnostics(t *testing.T) {
	tests := []struct {
		name, reason, section, language, field string
		paragraph, sentence                    int
		raw                                    string
		mutate                                 func(*models.AssessmentProseOutput)
	}{
		{name: "empty", reason: assessmentReasonOutputEmpty, field: "output", raw: " "},
		{name: "oversized", reason: assessmentReasonOutputTooLarge, field: "output", raw: strings.Repeat("x", assessmentMaxOutputBytes+1)},
		{name: "malformed", reason: assessmentReasonMalformedJSON, field: "output", raw: `{"paragraphs":`},
		{name: "trailing", reason: assessmentReasonMalformedJSON, field: "output", raw: `{"paragraphs":[]} trailing`},
		{name: "wrong type", reason: assessmentReasonInvalidJSONStructure, field: "output", raw: `{"paragraphs":"private-data"}`},
		{name: "unknown field", reason: assessmentReasonUnknownField, field: "output", raw: `{"paragraphs":[],"PRIVATE_UNKNOWN_FIELD":"private-data"}`},
		{name: "missing paragraphs", reason: assessmentReasonParagraphsMissing, field: "paragraphs", raw: `{}`},
		{name: "null paragraphs", reason: assessmentReasonParagraphsMissing, field: "paragraphs", raw: `{"paragraphs":null}`},
		{name: "too many paragraphs", reason: assessmentReasonParagraphCountExceeded, field: "paragraphs", mutate: func(v *models.AssessmentProseOutput) { v.Paragraphs = make([]models.AssessmentNarrativeParagraph, 5) }},
		{name: "section count", reason: assessmentReasonParagraphCountExceeded, section: "development", field: "paragraphs", paragraph: 3, mutate: func(v *models.AssessmentProseOutput) { v.Paragraphs = append(v.Paragraphs, v.Paragraphs[1]) }},
		{name: "no sentences", reason: assessmentReasonSentenceCountInvalid, section: "strengths", field: "sentences", paragraph: 1, mutate: func(v *models.AssessmentProseOutput) { v.Paragraphs[0].Sentences = nil }},
		{name: "too many sentences", reason: assessmentReasonSentenceCountInvalid, section: "strengths", field: "sentences", paragraph: 1, mutate: func(v *models.AssessmentProseOutput) {
			v.Paragraphs[0].Sentences = make([]models.AssessmentNarrativeSentence, 5)
		}},
		{name: "unknown section", reason: assessmentReasonUnknownSection, section: "unknown", field: "section", paragraph: 1, sentence: 1, mutate: func(v *models.AssessmentProseOutput) { v.Paragraphs[0].Section = "PRIVATE_SECTION" }},
		{name: "invalid intent", reason: assessmentReasonInvalidIntent, section: "strengths", field: "intent", paragraph: 1, sentence: 1, mutate: func(v *models.AssessmentProseOutput) { v.Paragraphs[0].Sentences[0].Intent = "PRIVATE_INTENT" }},
		{name: "unknown observation", reason: assessmentReasonObservationUnknown, section: "strengths", field: "observation_id", paragraph: 1, sentence: 1, mutate: func(v *models.AssessmentProseOutput) {
			v.Paragraphs[0].Sentences[0].ObservationID = "PRIVATE_OBSERVATION"
		}},
		{name: "wrong observation section", reason: assessmentReasonObservationSectionMismatch, section: "strengths", field: "observation_id", paragraph: 1, sentence: 1, mutate: func(v *models.AssessmentProseOutput) { v.Paragraphs[0].Sentences[0].ObservationID = "readiness:8:1" }},
		{name: "second sentence location", reason: assessmentReasonObservationSectionMismatch, section: "development", field: "observation_id", paragraph: 2, sentence: 2, mutate: func(v *models.AssessmentProseOutput) {
			v.Paragraphs[1].Sentences = append(v.Paragraphs[1].Sentences, v.Paragraphs[0].Sentences[0])
		}},
		{name: "Thai missing", reason: assessmentReasonBilingualTextMissing, section: "strengths", field: "sentence.text", language: "th", paragraph: 1, sentence: 1, mutate: func(v *models.AssessmentProseOutput) { v.Paragraphs[0].Sentences[0].Text.TH = " " }},
		{name: "English missing", reason: assessmentReasonBilingualTextMissing, section: "strengths", field: "sentence.text", language: "en", paragraph: 1, sentence: 1, mutate: func(v *models.AssessmentProseOutput) { v.Paragraphs[0].Sentences[0].Text.EN = "" }},
		{name: "sentence length", reason: assessmentReasonTextTooLong, section: "strengths", field: "sentence.text", language: "en", paragraph: 1, sentence: 1, mutate: func(v *models.AssessmentProseOutput) { v.Paragraphs[0].Sentences[0].Text.EN = strings.Repeat("x", 241) }},
		{name: "text byte limit", reason: assessmentReasonTextTooLong, section: "strengths", field: "sentence.text", language: "th", paragraph: 1, sentence: 1, mutate: func(v *models.AssessmentProseOutput) {
			v.Paragraphs[0].Sentences[0].Text.TH = strings.Repeat("x", assessmentMaxTextBytes+1)
		}},
		{name: "PII", reason: assessmentReasonPIIDetected, section: "strengths", field: "sentence.text", language: "en", paragraph: 1, sentence: 1, mutate: func(v *models.AssessmentProseOutput) {
			v.Paragraphs[0].Sentences[0].Text.EN = "Contact private@example.test"
		}},
		{name: "duplicate", reason: assessmentReasonDuplicateSentence, section: "strengths", field: "sentence.text", language: "th", paragraph: 3, sentence: 1, mutate: func(v *models.AssessmentProseOutput) { v.Paragraphs = append(v.Paragraphs, v.Paragraphs[0]) }},
		{name: "number claim", reason: assessmentReasonUnsupportedClaim, section: "strengths", field: "sentence.text", language: "en", paragraph: 1, sentence: 1, mutate: func(v *models.AssessmentProseOutput) { v.Paragraphs[0].Sentences[0].Text.EN = "Your GPA is 3.00." }},
		{name: "grade claim", reason: assessmentReasonUnsupportedClaim, section: "strengths", field: "sentence.text", language: "en", paragraph: 1, sentence: 1, mutate: func(v *models.AssessmentProseOutput) { v.Paragraphs[0].Sentences[0].Text.EN = "Your grade is A." }},
		{name: "approval claim", reason: assessmentReasonUnsupportedClaim, section: "strengths", field: "sentence.text", language: "en", paragraph: 1, sentence: 1, mutate: func(v *models.AssessmentProseOutput) {
			v.Paragraphs[0].Sentences[0].Text.EN = "You are approved for internship."
		}},
		{name: "contradiction", reason: assessmentReasonReadinessContradiction, section: "strengths", field: "sentence.text", language: "en", paragraph: 1, sentence: 1, mutate: func(v *models.AssessmentProseOutput) {
			v.Paragraphs[0].Sentences[0].Text.EN = "This criterion is not yet met."
		}},
		{name: "advice not suggestion", reason: assessmentReasonAdviceNotSuggestion, section: "development", field: "sentence.text", language: "en", paragraph: 2, sentence: 1, mutate: func(v *models.AssessmentProseOutput) {
			v.Paragraphs[1].Sentences[0].Text.EN = "You have learning opportunities."
		}},
		{name: "missing advice", reason: assessmentReasonAdviceMissing, section: "development", field: "paragraphs", paragraph: 2, mutate: func(v *models.AssessmentProseOutput) { v.Paragraphs[1].Sentences[0].Intent = "explanation" }},
		{name: "paragraph length", reason: assessmentReasonTextTooLong, section: "strengths", field: "paragraph.text", language: "en", paragraph: 1, mutate: func(v *models.AssessmentProseOutput) {
			base := v.Paragraphs[0].Sentences[0]
			v.Paragraphs[0].Sentences = nil
			for _, suffix := range []string{"a", "b", "c", "d"} {
				sentence := base
				sentence.Text = models.AssessmentBilingualText{TH: "supported " + suffix, EN: strings.Repeat("x", 180) + suffix}
				v.Paragraphs[0].Sentences = append(v.Paragraphs[0].Sentences, sentence)
			}
		}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			output := validAssessmentProviderOutput()
			if test.mutate != nil {
				test.mutate(&output)
			}
			raw, err := json.Marshal(output)
			if err != nil {
				t.Fatal(err)
			}
			if test.raw != "" {
				raw = []byte(test.raw)
			}
			if test.name == "empty" {
				raw = nil
			}
			_, err = ValidateAssessmentProviderOutput(raw, validAssessmentProviderInput())
			var diagnostic *AssessmentOutputValidationError
			if !errors.As(err, &diagnostic) {
				t.Fatalf("expected diagnostic, got %v", err)
			}
			if diagnostic.Reason != test.reason || diagnostic.Section != test.section || diagnostic.ParagraphIndex != test.paragraph || diagnostic.SentenceIndex != test.sentence || diagnostic.Language != test.language || diagnostic.Field != test.field {
				t.Fatalf("unexpected diagnostic: %+v", diagnostic)
			}
			sentinel := ErrAssessmentOutputInvalid
			if test.reason == assessmentReasonMalformedJSON {
				sentinel = ErrAssessmentOutputMalformed
			}
			if !errors.Is(err, sentinel) {
				t.Fatalf("missing sentinel %v", sentinel)
			}
			if strings.Contains(err.Error(), "PRIVATE_") || strings.Contains(err.Error(), "private-data") || strings.Contains(err.Error(), "private@example.test") {
				t.Fatal("error text exposed model content")
			}
		})
	}
}

func TestAssessmentValidationPreservesAcceptanceAndFirstFailure(t *testing.T) {
	for _, raw := range []string{`{"paragraphs":[]}`, string(mustJSON(t, validAssessmentProviderOutput()))} {
		if _, err := ValidateAssessmentProviderOutput([]byte(raw), validAssessmentProviderInput()); err != nil {
			t.Fatal(err)
		}
	}
	output := validAssessmentProviderOutput()
	output.Paragraphs[0].Sentences[0].ObservationID = "PRIVATE_UNKNOWN"
	output.Paragraphs[0].Sentences[0].Text.EN = ""
	_, err := ValidateAssessmentProviderOutput(mustJSON(t, output), validAssessmentProviderInput())
	var diagnostic *AssessmentOutputValidationError
	if !errors.As(err, &diagnostic) || diagnostic.Reason != assessmentReasonObservationUnknown {
		t.Fatalf("unexpected first error: %v", err)
	}
}

func TestAssessmentValidationErrorDoesNotExposeUntrustedMetadata(t *testing.T) {
	err := &AssessmentOutputValidationError{Reason: "PRIVATE_REASON", Section: "PRIVATE_SECTION", Field: "PRIVATE_FIELD", Language: "PRIVATE_LANGUAGE"}
	if err.Error() != "assessment output validation failed: validation_unknown" || !errors.Is(err, ErrAssessmentOutputInvalid) {
		t.Fatalf("unsafe error: %s", err.Error())
	}
}
