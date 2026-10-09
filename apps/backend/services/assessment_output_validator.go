package services

import (
	"bytes"
	"encoding/json"
	"errors"
	"github.com/spw32767/university-competency-system-backend/models"
	"io"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"
)

const (
	assessmentMaxOutputBytes = 64 * 1024
	assessmentMaxTextBytes   = 4000
)

var ErrAssessmentOutputInvalid = errors.New("assessment provider output is invalid")
var ErrAssessmentOutputMalformed = errors.New("assessment provider output is malformed JSON")

var assessmentNumericAssertion = regexp.MustCompile(`[0-9]+(?:\.[0-9]+)?`)
var assessmentGradeAssertion = regexp.MustCompile(`\b(?:A|B|C|D|F|S|U|W|I)\b\+?`)

func ValidateAssessmentProviderOutput(raw []byte, input models.AssessmentProviderInput) (models.AssessmentProseReport, error) {
	if len(raw) == 0 {
		return models.AssessmentProseReport{}, assessmentValidationFailure(assessmentReasonOutputEmpty, "output", "")
	}
	if len(raw) > assessmentMaxOutputBytes {
		return models.AssessmentProseReport{}, assessmentValidationFailure(assessmentReasonOutputTooLarge, "output", "")
	}
	if !json.Valid(raw) {
		return models.AssessmentProseReport{}, assessmentValidationFailure(assessmentReasonMalformedJSON, "output", "")
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	var output models.AssessmentProseOutput
	if err := decoder.Decode(&output); err != nil {
		reason := assessmentReasonInvalidJSONStructure
		if strings.HasPrefix(err.Error(), "json: unknown field ") {
			reason = assessmentReasonUnknownField
		}
		return models.AssessmentProseReport{}, assessmentValidationFailure(reason, "output", "")
	}
	var trailing any
	if err := decoder.Decode(&trailing); err != io.EOF {
		return models.AssessmentProseReport{}, assessmentValidationFailure(assessmentReasonInvalidJSONStructure, "output", "")
	}
	return assembleAssessmentOutput(output, input)
}

func assembleAssessmentOutput(output models.AssessmentProseOutput, input models.AssessmentProviderInput) (models.AssessmentProseReport, error) {
	observations := make(map[string]models.AssessmentObservation)
	for _, observation := range BuildAssessmentObservations(input) {
		observations[observation.ObservationID] = observation
	}
	validated := newAssessmentProseReport(input)
	if output.Paragraphs == nil {
		return models.AssessmentProseReport{}, assessmentValidationFailure(assessmentReasonParagraphsMissing, "paragraphs", "")
	}
	if len(output.Paragraphs) > 4 {
		return models.AssessmentProseReport{}, assessmentValidationFailure(assessmentReasonParagraphCountExceeded, "paragraphs", "")
	}
	counts := make(map[string]int)
	seenTH, seenEN := make(map[string]bool), make(map[string]bool)
	for paragraphIndex, paragraph := range output.Paragraphs {
		limit := 1
		if paragraph.Section == "strengths" {
			limit = 2
		}
		counts[paragraph.Section]++
		if counts[paragraph.Section] > limit {
			return models.AssessmentProseReport{}, assessmentValidationFailure(assessmentReasonParagraphCountExceeded, "paragraphs", "").at(paragraph.Section, paragraphIndex+1, 0)
		}
		if len(paragraph.Sentences) == 0 || len(paragraph.Sentences) > 4 {
			return models.AssessmentProseReport{}, assessmentValidationFailure(assessmentReasonSentenceCountInvalid, "sentences", "").at(paragraph.Section, paragraphIndex+1, 0)
		}
		refs, seenRefs := []string{}, make(map[string]bool)
		hasAdvice := false
		for sentenceIndex, sentence := range paragraph.Sentences {
			observation, exists := observations[sentence.ObservationID]
			if !exists {
				return models.AssessmentProseReport{}, assessmentValidationFailure(assessmentReasonObservationUnknown, "observation_id", "").at(paragraph.Section, paragraphIndex+1, sentenceIndex+1)
			}
			if !assessmentNarrativePermits(paragraph.Section, sentence.Intent, observation.Kind) {
				reason, field := assessmentReasonObservationSectionMismatch, "observation_id"
				if paragraph.Section != "strengths" && paragraph.Section != "development" && paragraph.Section != "observations" {
					reason, field = assessmentReasonUnknownSection, "section"
				} else if sentence.Intent != "explanation" && sentence.Intent != "advice" {
					reason, field = assessmentReasonInvalidIntent, "intent"
				}
				return models.AssessmentProseReport{}, assessmentValidationFailure(reason, field, "").at(paragraph.Section, paragraphIndex+1, sentenceIndex+1)
			}
			if err := validateAssessmentNarrative(sentence.Text, "text"); err != nil {
				var diagnostic *AssessmentOutputValidationError
				if errors.As(err, &diagnostic) {
					diagnostic = diagnostic.at(paragraph.Section, paragraphIndex+1, sentenceIndex+1)
					diagnostic.Field = "sentence.text"
					return models.AssessmentProseReport{}, diagnostic
				}
				return models.AssessmentProseReport{}, err
			}
			thai, english := strings.TrimSpace(sentence.Text.TH), strings.TrimSpace(sentence.Text.EN)
			if seenTH[thai] || seenEN[english] {
				language := "en"
				if seenTH[thai] {
					language = "th"
				}
				return models.AssessmentProseReport{}, assessmentValidationFailure(assessmentReasonDuplicateSentence, "sentence.text", language).at(paragraph.Section, paragraphIndex+1, sentenceIndex+1)
			}
			seenTH[thai], seenEN[english] = true, true
			for languageIndex, text := range []string{thai, english} {
				language := []string{"th", "en"}[languageIndex]
				if rule := assessmentUnsupportedProseRule(text); rule != "" {
					diagnostic := assessmentValidationFailure(assessmentReasonUnsupportedClaim, "sentence.text", language).at(paragraph.Section, paragraphIndex+1, sentenceIndex+1)
					diagnostic.Rule = rule
					return models.AssessmentProseReport{}, diagnostic
				}
				negativeStatus := assessmentProseNotMet.MatchString(text)
				positiveStatus := assessmentProseMet.MatchString(assessmentProseNotMet.ReplaceAllString(text, ""))
				if (observation.Kind == "strength" && negativeStatus) || (observation.Kind == "limitation" && positiveStatus) {
					return models.AssessmentProseReport{}, assessmentValidationFailure(assessmentReasonReadinessContradiction, "sentence.text", language).at(paragraph.Section, paragraphIndex+1, sentenceIndex+1)
				}
			}
			if sentence.Intent == "advice" {
				if !assessmentAdviceTH.MatchString(thai) || !assessmentAdviceEN.MatchString(english) {
					language := "en"
					if !assessmentAdviceTH.MatchString(thai) {
						language = "th"
					}
					return models.AssessmentProseReport{}, assessmentValidationFailure(assessmentReasonAdviceNotSuggestion, "sentence.text", language).at(paragraph.Section, paragraphIndex+1, sentenceIndex+1)
				}
				hasAdvice = true
			}
			for _, ref := range observation.EvidenceRefs {
				if !seenRefs[ref] {
					refs = append(refs, ref)
					seenRefs[ref] = true
				}
			}
		}
		text := joinAssessmentSentences(paragraph.Sentences)
		if utf8.RuneCountInString(text.TH) > 700 || utf8.RuneCountInString(text.EN) > 700 {
			language := "en"
			if utf8.RuneCountInString(text.TH) > 700 {
				language = "th"
			}
			return models.AssessmentProseReport{}, assessmentValidationFailure(assessmentReasonTextTooLong, "paragraph.text", language).at(paragraph.Section, paragraphIndex+1, 0)
		}
		if paragraph.Section == "development" && !hasAdvice {
			return models.AssessmentProseReport{}, assessmentValidationFailure(assessmentReasonAdviceMissing, "paragraphs", "").at(paragraph.Section, paragraphIndex+1, 0)
		}
		item := models.AssessmentReportParagraph{Text: text, Sentences: paragraph.Sentences, EvidenceRefs: refs}
		switch paragraph.Section {
		case "strengths":
			validated.Narrative.Strengths = append(validated.Narrative.Strengths, item)
		case "development":
			validated.Narrative.Development = append(validated.Narrative.Development, item)
		case "observations":
			validated.Narrative.Observations = append(validated.Narrative.Observations, item)
		default:
			return models.AssessmentProseReport{}, assessmentValidationFailure(assessmentReasonUnknownSection, "section", "").at(paragraph.Section, paragraphIndex+1, 0)
		}
	}
	return validated, nil
}

func assessmentNarrativePermits(section, intent, kind string) bool {
	if section == "development" && intent == "advice" {
		return kind == "strength" || kind == "limitation" || kind == "neutral"
	}
	if intent != "explanation" {
		return false
	}
	return (section == "strengths" && kind == "strength") || (section == "development" && kind == "limitation") || (section == "observations" && kind == "neutral")
}

var (
	assessmentProseNumber   = regexp.MustCompile(`[0-9๐-๙]`)
	assessmentProseGrade    = regexp.MustCompile(`(?i)(?:grade|เกรด)\s*(?:is|of|เป็น|คือ|[:=])?\s*[ABCDFSUWI]\b`)
	assessmentProseApproval = regexp.MustCompile(`(?i)(?:approved for|authorized to|eligible to start|ได้รับอนุมัติ|อนุมัติให้)`)
	assessmentProseCareer   = regexp.MustCompile(`(?i)(?:career as|software developer|data scientist|อาชีพ)`)
	assessmentProseMarkup   = regexp.MustCompile("(?i)(?:<[^>]+>|\\*\\*|`)")
	assessmentProseNotMet   = regexp.MustCompile(`(?i)(?:does not (?:yet )?meet|not yet met|below the requirement|ยังไม่ผ่าน|ยังไม่ถึงเกณฑ์|ไม่ถึงเกณฑ์|ต่ำกว่าเกณฑ์)`)
	assessmentProseMet      = regexp.MustCompile(`(?i)(?:meets? the (?:curriculum )?(?:criterion|requirement)|criterion is met|requirement is met|ถึงเกณฑ์แล้ว|ผ่านเกณฑ์แล้ว)`)
	assessmentAdviceTH      = regexp.MustCompile(`(?:แนะนำ|อาจ|ควร|ลอง)`)
	assessmentAdviceEN      = regexp.MustCompile(`(?i)\b(?:consider|recommend|suggest|could|may)\b`)
)

// Return only a static rule identifier, never the matching learner text.
func assessmentUnsupportedProseRule(text string) string {
	for _, rule := range []struct {
		name    string
		pattern *regexp.Regexp
	}{
		{"numeric_literal", assessmentProseNumber},
		{"grade_literal", assessmentProseGrade},
		{"placement_approval", assessmentProseApproval},
		{"career_content", assessmentProseCareer},
		{"prose_markup", assessmentProseMarkup},
	} {
		if rule.pattern.MatchString(text) {
			return rule.name
		}
	}
	return ""
}

// This rejects obvious cross-observation values, not arbitrary semantic hallucinations.
func validateObservationAssertions(text models.AssessmentBilingualText, observation models.AssessmentObservation) error {
	numbers := make(map[float64]bool)
	grades := make(map[string]bool)
	values := observation.Values
	for _, value := range []*float64{values.CurrentValue, values.RequiredValue, values.CoreScore, values.CourseBonusScore, values.FreeElectiveScore, values.ActivityScore} {
		if value != nil {
			numbers[*value] = true
		}
	}
	for _, value := range []*uint64{values.AcademicYear, values.Semester} {
		if value != nil {
			numbers[float64(*value)] = true
		}
	}
	for _, value := range []*int{values.RecordCount, values.MissingGradeCount} {
		if value != nil {
			numbers[float64(*value)] = true
		}
	}
	for _, value := range []*string{values.CurrentGrade, values.RequiredGrade} {
		if value != nil {
			grades[*value] = true
		}
	}
	if values.Grade != "" {
		grades[values.Grade] = true
	}
	for _, bin := range values.GradeCounts {
		grades[bin.Grade] = true
		numbers[float64(bin.Count)] = true
	}
	for languageIndex, language := range []string{text.TH, text.EN} {
		languageName := []string{"th", "en"}[languageIndex]
		for _, token := range assessmentNumericAssertion.FindAllString(language, -1) {
			value, _ := strconv.ParseFloat(token, 64)
			if !numbers[value] {
				return assessmentValidationFailure(assessmentReasonUnsupportedClaim, "text", languageName)
			}
		}
		for _, token := range assessmentGradeAssertion.FindAllString(language, -1) {
			if !grades[token] {
				return assessmentValidationFailure(assessmentReasonUnsupportedClaim, "text", languageName)
			}
		}
	}
	return nil
}

func validateAssessmentNarrative(text models.AssessmentBilingualText, field string) error {
	if err := validateBilingualText(text, field); err != nil {
		return err
	}
	if utf8.RuneCountInString(text.TH) > 240 || utf8.RuneCountInString(text.EN) > 240 {
		language := "en"
		if utf8.RuneCountInString(text.TH) > 240 {
			language = "th"
		}
		return assessmentValidationFailure(assessmentReasonTextTooLong, safeAssessmentField(field), language)
	}
	return nil
}

func validateBilingualText(value models.AssessmentBilingualText, field string) error {
	for _, language := range []struct{ name, text string }{{"th", value.TH}, {"en", value.EN}} {
		trimmed := strings.TrimSpace(language.text)
		if trimmed == "" {
			return assessmentValidationFailure(assessmentReasonBilingualTextMissing, safeAssessmentField(field), language.name)
		}
		if len(trimmed) > assessmentMaxTextBytes {
			return assessmentValidationFailure(assessmentReasonTextTooLong, safeAssessmentField(field), language.name)
		}
		if containsAssessmentPII(trimmed) {
			return assessmentValidationFailure(assessmentReasonPIIDetected, safeAssessmentField(field), language.name)
		}
	}
	return nil
}

func containsAssessmentPII(value string) bool {
	return assessmentEmailPattern.MatchString(value) || assessmentPhonePattern.MatchString(value) || assessmentNationalIDPattern.MatchString(value) || assessmentStudentIDPattern.MatchString(value)
}
