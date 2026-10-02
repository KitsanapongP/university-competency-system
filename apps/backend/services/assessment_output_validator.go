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

func ValidateAssessmentProviderOutput(raw []byte, input models.AssessmentProviderInput) (models.AssessmentValidatedOutput, error) {
	if len(raw) == 0 || len(raw) > assessmentMaxOutputBytes {
		return models.AssessmentValidatedOutput{}, ErrAssessmentOutputInvalid
	}
	if !json.Valid(raw) {
		return models.AssessmentValidatedOutput{}, ErrAssessmentOutputMalformed
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	var output models.AssessmentNarrativeOutput
	if err := decoder.Decode(&output); err != nil {
		return models.AssessmentValidatedOutput{}, fmt.Errorf("%w: invalid JSON structure", ErrAssessmentOutputInvalid)
	}
	var trailing any
	if err := decoder.Decode(&trailing); err != io.EOF {
		return models.AssessmentValidatedOutput{}, fmt.Errorf("%w: trailing content", ErrAssessmentOutputInvalid)
	}
	return assembleAssessmentOutput(output, input)
}

func assembleAssessmentOutput(output models.AssessmentNarrativeOutput, input models.AssessmentProviderInput) (models.AssessmentValidatedOutput, error) {
	observations := make(map[string]models.AssessmentObservation)
	for _, observation := range BuildAssessmentObservations(input) {
		observations[observation.ObservationID] = observation
	}
	seen := make(map[string]bool)
	assemble := func(items []models.AssessmentNarrativeFinding, kind string) ([]models.AssessmentReportFinding, error) {
		if items == nil || len(items) > 3 {
			return nil, fmt.Errorf("%w: all sections are required and bounded", ErrAssessmentOutputInvalid)
		}
		findings := make([]models.AssessmentReportFinding, 0, len(items))
		for _, item := range items {
			observation, exists := observations[item.ObservationID]
			if !exists || observation.Kind != kind || seen[item.ObservationID] {
				return nil, fmt.Errorf("%w: unknown, duplicate, or misplaced observation", ErrAssessmentOutputInvalid)
			}
			seen[item.ObservationID] = true
			if err := validateAssessmentNarrative(item.Explanation, "explanation"); err != nil {
				return nil, err
			}
			if err := validateObservationAssertions(item.Explanation, observation); err != nil {
				return nil, err
			}
			if kind == "limitation" && item.DevelopmentAdvice == nil {
				return nil, fmt.Errorf("%w: limitation advice is required", ErrAssessmentOutputInvalid)
			}
			if kind != "limitation" && item.DevelopmentAdvice != nil {
				return nil, fmt.Errorf("%w: unexpected advice", ErrAssessmentOutputInvalid)
			}
			if item.DevelopmentAdvice != nil {
				if err := validateAssessmentNarrative(*item.DevelopmentAdvice, "development_advice"); err != nil {
					return nil, err
				}
				if err := validateObservationAssertions(*item.DevelopmentAdvice, observation); err != nil {
					return nil, err
				}
			}
			explanation := item.Explanation
			findings = append(findings, models.AssessmentReportFinding{ObservationID: observation.ObservationID, Title: observation.Title, Reason: observation.Fact, Explanation: &explanation, EvidenceRefs: observation.EvidenceRefs, DevelopmentAdvice: item.DevelopmentAdvice})
		}
		return findings, nil
	}
	validated := models.AssessmentValidatedOutput{ReadinessExplanation: assessmentReadinessExplanation(input)}
	var err error
	if validated.Strengths, err = assemble(output.Strengths, "strength"); err != nil {
		return models.AssessmentValidatedOutput{}, err
	}
	if validated.Limitations, err = assemble(output.Limitations, "limitation"); err != nil {
		return models.AssessmentValidatedOutput{}, err
	}
	if validated.Observations, err = assemble(output.Observations, "neutral"); err != nil {
		return models.AssessmentValidatedOutput{}, err
	}
	return validated, nil
}

// This rejects obvious cross-observation values, not arbitrary semantic hallucinations.
func validateObservationAssertions(text models.AssessmentBilingualText, observation models.AssessmentObservation) error {
	facts := observation.Fact.TH + " " + observation.Fact.EN
	numbers := make(map[float64]bool)
	for _, token := range assessmentNumericAssertion.FindAllString(facts, -1) {
		value, _ := strconv.ParseFloat(token, 64)
		numbers[value] = true
	}
	grades := make(map[string]bool)
	for _, token := range assessmentGradeAssertion.FindAllString(facts, -1) {
		grades[token] = true
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
