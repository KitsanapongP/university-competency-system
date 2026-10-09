package services

const (
	assessmentReasonOutputEmpty                = "output_empty"
	assessmentReasonOutputTooLarge             = "output_too_large"
	assessmentReasonMalformedJSON              = "malformed_json"
	assessmentReasonInvalidJSONStructure       = "invalid_json_structure"
	assessmentReasonUnknownField               = "unknown_field"
	assessmentReasonParagraphsMissing          = "paragraphs_missing"
	assessmentReasonParagraphCountExceeded     = "paragraph_count_exceeded"
	assessmentReasonSentenceCountInvalid       = "sentence_count_invalid"
	assessmentReasonUnknownSection             = "unknown_section"
	assessmentReasonInvalidIntent              = "invalid_intent"
	assessmentReasonObservationUnknown         = "observation_unknown"
	assessmentReasonObservationSectionMismatch = "observation_section_mismatch"
	assessmentReasonBilingualTextMissing       = "bilingual_text_missing"
	assessmentReasonTextTooLong                = "text_too_long"
	assessmentReasonPIIDetected                = "pii_detected"
	assessmentReasonDuplicateSentence          = "duplicate_sentence"
	assessmentReasonUnsupportedClaim           = "unsupported_claim"
	assessmentReasonReadinessContradiction     = "readiness_contradiction"
	assessmentReasonAdviceNotSuggestion        = "advice_not_suggestion"
	assessmentReasonAdviceMissing              = "advice_missing"
	assessmentReasonUnknown                    = "validation_unknown"
)

// Positions are one-based; zero means that no position is available.
type AssessmentOutputValidationError struct {
	Reason         string
	Section        string
	ParagraphIndex int
	SentenceIndex  int
	Language       string
	Field          string
}

func (e *AssessmentOutputValidationError) Error() string {
	return "assessment output validation failed: " + safeAssessmentValidationReason(e.Reason)
}

func (e *AssessmentOutputValidationError) Unwrap() error {
	if e.Reason == assessmentReasonMalformedJSON {
		return ErrAssessmentOutputMalformed
	}
	return ErrAssessmentOutputInvalid
}

func assessmentValidationFailure(reason, field, language string) *AssessmentOutputValidationError {
	return &AssessmentOutputValidationError{Reason: reason, Field: field, Language: language}
}

func (e *AssessmentOutputValidationError) at(section string, paragraph, sentence int) *AssessmentOutputValidationError {
	located := *e
	located.Section = safeAssessmentSection(section)
	located.ParagraphIndex = paragraph
	located.SentenceIndex = sentence
	return &located
}

func safeAssessmentValidationReason(value string) string {
	switch value {
	case assessmentReasonOutputEmpty, assessmentReasonOutputTooLarge, assessmentReasonMalformedJSON,
		assessmentReasonInvalidJSONStructure, assessmentReasonUnknownField, assessmentReasonParagraphsMissing,
		assessmentReasonParagraphCountExceeded, assessmentReasonSentenceCountInvalid, assessmentReasonUnknownSection,
		assessmentReasonInvalidIntent, assessmentReasonObservationUnknown, assessmentReasonObservationSectionMismatch,
		assessmentReasonBilingualTextMissing, assessmentReasonTextTooLong, assessmentReasonPIIDetected,
		assessmentReasonDuplicateSentence, assessmentReasonUnsupportedClaim, assessmentReasonReadinessContradiction,
		assessmentReasonAdviceNotSuggestion, assessmentReasonAdviceMissing:
		return value
	default:
		return assessmentReasonUnknown
	}
}

func safeAssessmentSection(value string) string {
	switch value {
	case "", "strengths", "development", "observations":
		return value
	default:
		return "unknown"
	}
}

func safeAssessmentField(value string) string {
	switch value {
	case "", "output", "paragraphs", "sentences", "section", "intent", "observation_id", "text", "sentence.text", "paragraph.text":
		return value
	default:
		return "unknown"
	}
}

func safeAssessmentLanguage(value string) string {
	switch value {
	case "", "th", "en":
		return value
	default:
		return "unknown"
	}
}
