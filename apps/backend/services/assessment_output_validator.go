package services

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
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
	if len(raw) == 0 || len(raw) > assessmentMaxOutputBytes {
		return models.AssessmentProseReport{}, ErrAssessmentOutputInvalid
	}
	if !json.Valid(raw) {
		return models.AssessmentProseReport{}, ErrAssessmentOutputMalformed
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	var output models.AssessmentProseOutput
	if err := decoder.Decode(&output); err != nil {
		return models.AssessmentProseReport{}, fmt.Errorf("%w: invalid JSON structure", ErrAssessmentOutputInvalid)
	}
	var trailing any
	if err := decoder.Decode(&trailing); err != io.EOF {
		return models.AssessmentProseReport{}, fmt.Errorf("%w: trailing content", ErrAssessmentOutputInvalid)
	}
	return assembleAssessmentOutput(output, input)
}

func assembleAssessmentOutput(output models.AssessmentProseOutput, input models.AssessmentProviderInput) (models.AssessmentProseReport, error) {
	observations := make(map[string]models.AssessmentObservation)
	for _, observation := range BuildAssessmentObservations(input) {
		observations[observation.ObservationID] = observation
	}
	validated := newAssessmentProseReport(input)
	if output.Paragraphs == nil || len(output.Paragraphs) > 4 {
		return models.AssessmentProseReport{}, fmt.Errorf("%w: bounded paragraphs are required", ErrAssessmentOutputInvalid)
	}
	counts := make(map[string]int)
	seenTH, seenEN := make(map[string]bool), make(map[string]bool)
	for _, paragraph := range output.Paragraphs {
		limit := 1
		if paragraph.Section == "strengths" {
			limit = 2
		}
		counts[paragraph.Section]++
		if counts[paragraph.Section] > limit || len(paragraph.Sentences) == 0 || len(paragraph.Sentences) > 4 {
			return models.AssessmentProseReport{}, fmt.Errorf("%w: paragraph bounds", ErrAssessmentOutputInvalid)
		}
		refs, seenRefs := []string{}, make(map[string]bool)
		hasAdvice := false
		for _, sentence := range paragraph.Sentences {
			observation, exists := observations[sentence.ObservationID]
			if !exists || !assessmentNarrativePermits(paragraph.Section, sentence.Intent, observation.Kind) {
				return models.AssessmentProseReport{}, fmt.Errorf("%w: unknown or misplaced observation", ErrAssessmentOutputInvalid)
			}
			if err := validateAssessmentNarrative(sentence.Text, "text"); err != nil {
				return models.AssessmentProseReport{}, err
			}
			thai, english := strings.TrimSpace(sentence.Text.TH), strings.TrimSpace(sentence.Text.EN)
			if seenTH[thai] || seenEN[english] {
				return models.AssessmentProseReport{}, fmt.Errorf("%w: duplicate sentence", ErrAssessmentOutputInvalid)
			}
			seenTH[thai], seenEN[english] = true, true
			for _, text := range []string{thai, english} {
				if assessmentProseNumber.MatchString(text) || assessmentProseGrade.MatchString(text) || assessmentProseForbidden.MatchString(text) {
					return models.AssessmentProseReport{}, fmt.Errorf("%w: unsupported prose assertion", ErrAssessmentOutputInvalid)
				}
				if observation.Kind == "strength" && sentence.Intent == "explanation" && assessmentProseNotMet.MatchString(text) {
					return models.AssessmentProseReport{}, fmt.Errorf("%w: contradictory criterion status", ErrAssessmentOutputInvalid)
				}
			}
			if sentence.Intent == "advice" {
				if !assessmentAdviceTH.MatchString(thai) || !assessmentAdviceEN.MatchString(english) {
					return models.AssessmentProseReport{}, fmt.Errorf("%w: advice must be phrased as a suggestion", ErrAssessmentOutputInvalid)
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
		if utf8.RuneCountInString(text.TH) > 700 || utf8.RuneCountInString(text.EN) > 700 || (paragraph.Section == "development" && !hasAdvice) {
			return models.AssessmentProseReport{}, fmt.Errorf("%w: paragraph length or missing advice", ErrAssessmentOutputInvalid)
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
			return models.AssessmentProseReport{}, ErrAssessmentOutputInvalid
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
	assessmentProseNumber    = regexp.MustCompile(`[0-9๐-๙]`)
	assessmentProseGrade     = regexp.MustCompile(`(?i)(?:grade|เกรด)\s*(?:is|of|เป็น|คือ|[:=])?\s*[ABCDFSUWI]\b`)
	assessmentProseForbidden = regexp.MustCompile(`(?i)(?:approved for|authorized to|eligible to start|career as|software developer|data scientist|ได้รับอนุมัติ|อนุมัติให้|อาชีพ|<[^>]+>|\*\*|\x60)`)
	assessmentProseNotMet    = regexp.MustCompile(`(?i)(?:does not meet|not yet met|below the requirement|ยังไม่ผ่าน|ไม่ถึงเกณฑ์|ต่ำกว่าเกณฑ์)`)
	assessmentAdviceTH       = regexp.MustCompile(`(?:แนะนำ|อาจ|ควร|ลอง)`)
	assessmentAdviceEN       = regexp.MustCompile(`(?i)\b(?:consider|recommend|suggest|could|may)\b`)
)

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
	for _, language := range []string{text.TH, text.EN} {
		for _, token := range assessmentNumericAssertion.FindAllString(language, -1) {
			value, _ := strconv.ParseFloat(token, 64)
			if !numbers[value] {
				return fmt.Errorf("%w: unsupported numeric assertion", ErrAssessmentOutputInvalid)
			}
		}
		for _, token := range assessmentGradeAssertion.FindAllString(language, -1) {
			if !grades[token] {
				return fmt.Errorf("%w: unsupported grade assertion", ErrAssessmentOutputInvalid)
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
		return fmt.Errorf("%w: narrative too long", ErrAssessmentOutputInvalid)
	}
	return nil
}

func validateBilingualText(value models.AssessmentBilingualText, field string) error {
	for _, language := range []struct{ name, text string }{{"th", value.TH}, {"en", value.EN}} {
		trimmed := strings.TrimSpace(language.text)
		if trimmed == "" || len(trimmed) > assessmentMaxTextBytes || containsAssessmentPII(trimmed) {
			return fmt.Errorf("%w: invalid %s text for %s", ErrAssessmentOutputInvalid, language.name, field)
		}
	}
	return nil
}

func containsAssessmentPII(value string) bool {
	return assessmentEmailPattern.MatchString(value) || assessmentPhonePattern.MatchString(value) || assessmentNationalIDPattern.MatchString(value) || assessmentStudentIDPattern.MatchString(value)
}
