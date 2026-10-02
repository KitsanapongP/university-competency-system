package services

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/spw32767/university-competency-system-backend/models"
)

const (
	assessmentMaxOutputBytes = 64 * 1024
	assessmentMaxTextBytes   = 4000
)

var ErrAssessmentOutputInvalid = errors.New("assessment provider output is invalid")

func ValidateAssessmentProviderOutput(raw []byte, input models.AssessmentProviderInput) (models.AssessmentValidatedOutput, error) {
	if len(raw) == 0 || len(raw) > assessmentMaxOutputBytes {
		return models.AssessmentValidatedOutput{}, ErrAssessmentOutputInvalid
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	var output models.AssessmentProviderOutput
	if err := decoder.Decode(&output); err != nil {
		return models.AssessmentValidatedOutput{}, fmt.Errorf("%w: invalid JSON structure", ErrAssessmentOutputInvalid)
	}
	var trailing any
	if err := decoder.Decode(&trailing); err != io.EOF {
		return models.AssessmentValidatedOutput{}, fmt.Errorf("%w: trailing content", ErrAssessmentOutputInvalid)
	}
	if err := validateAssessmentOutput(output, input); err != nil {
		return models.AssessmentValidatedOutput{}, err
	}
	if output.Strengths == nil {
		output.Strengths = make([]models.AssessmentReportFinding, 0)
	}
	if output.Limitations == nil {
		output.Limitations = make([]models.AssessmentReportFinding, 0)
	}
	if output.CareerRecommendations == nil {
		output.CareerRecommendations = make([]models.AssessmentCareerRecommendation, 0)
	}
	validated := models.AssessmentValidatedOutput{AssessmentProviderOutput: output}
	if len(output.CareerRecommendations) == 0 {
		if len(input.EligibleCareers) == 0 {
			validated.CareerRecommendationReason = "no_published_career_paths"
		} else {
			validated.CareerRecommendationReason = "no_evidence_supported_career_path"
		}
	}
	return validated, nil
}

func validateAssessmentOutput(output models.AssessmentProviderOutput, input models.AssessmentProviderInput) error {
	if err := validateBilingualText(output.ReadinessExplanation, "readiness_explanation"); err != nil {
		return err
	}
	if len(output.Strengths) > 5 || len(output.Limitations) > 5 || len(output.CareerRecommendations) > 3 {
		return fmt.Errorf("%w: output item limit exceeded", ErrAssessmentOutputInvalid)
	}
	validReferences := assessmentProviderEvidenceReferences(input)
	for index, finding := range output.Strengths {
		if err := validateFinding(finding, validReferences, false, fmt.Sprintf("strengths[%d]", index)); err != nil {
			return err
		}
	}
	for index, finding := range output.Limitations {
		if err := validateFinding(finding, validReferences, true, fmt.Sprintf("limitations[%d]", index)); err != nil {
			return err
		}
	}
	eligibleCareers := make(map[uint64]struct{}, len(input.EligibleCareers))
	for _, career := range input.EligibleCareers {
		eligibleCareers[career.CareerPathID] = struct{}{}
	}
	seenCareerIDs := make(map[uint64]struct{}, len(output.CareerRecommendations))
	for index, recommendation := range output.CareerRecommendations {
		if _, ok := eligibleCareers[recommendation.CareerPathID]; !ok || recommendation.CareerPathID == 0 {
			return fmt.Errorf("%w: career recommendation is not eligible", ErrAssessmentOutputInvalid)
		}
		if _, exists := seenCareerIDs[recommendation.CareerPathID]; exists {
			return fmt.Errorf("%w: duplicate career recommendation", ErrAssessmentOutputInvalid)
		}
		seenCareerIDs[recommendation.CareerPathID] = struct{}{}
		if err := validateBilingualText(recommendation.Reason, fmt.Sprintf("career_recommendations[%d].reason", index)); err != nil {
			return err
		}
		if err := validateBilingualText(recommendation.Advice, fmt.Sprintf("career_recommendations[%d].advice", index)); err != nil {
			return err
		}
		if err := validateEvidenceRefs(recommendation.EvidenceRefs, validReferences); err != nil {
			return err
		}
	}
	return nil
}

func validateFinding(
	finding models.AssessmentReportFinding,
	validReferences map[string]struct{},
	requireAdvice bool,
	field string,
) error {
	if err := validateBilingualText(finding.Title, field+".title"); err != nil {
		return err
	}
	if err := validateBilingualText(finding.Reason, field+".reason"); err != nil {
		return err
	}
	if requireAdvice {
		if finding.DevelopmentAdvice == nil {
			return fmt.Errorf("%w: limitation advice is required", ErrAssessmentOutputInvalid)
		}
		if err := validateBilingualText(*finding.DevelopmentAdvice, field+".development_advice"); err != nil {
			return err
		}
	}
	return validateEvidenceRefs(finding.EvidenceRefs, validReferences)
}

func validateBilingualText(value models.AssessmentBilingualText, field string) error {
	for _, language := range []struct {
		name string
		text string
	}{{name: "th", text: value.TH}, {name: "en", text: value.EN}} {
		trimmed := strings.TrimSpace(language.text)
		if trimmed == "" || len(trimmed) > assessmentMaxTextBytes || containsAssessmentPII(trimmed) {
			return fmt.Errorf("%w: invalid %s text for %s", ErrAssessmentOutputInvalid, language.name, field)
		}
	}
	return nil
}

func validateEvidenceRefs(references []string, valid map[string]struct{}) error {
	if len(references) == 0 || len(references) > 10 {
		return fmt.Errorf("%w: evidence references are required and bounded", ErrAssessmentOutputInvalid)
	}
	seen := make(map[string]struct{}, len(references))
	for _, reference := range references {
		if _, ok := valid[reference]; !ok {
			return fmt.Errorf("%w: unknown evidence reference", ErrAssessmentOutputInvalid)
		}
		if _, exists := seen[reference]; exists {
			return fmt.Errorf("%w: duplicate evidence reference", ErrAssessmentOutputInvalid)
		}
		seen[reference] = struct{}{}
	}
	return nil
}

func assessmentProviderEvidenceReferences(input models.AssessmentProviderInput) map[string]struct{} {
	references := make(map[string]struct{})
	add := func(reference string) {
		if reference != "" {
			references[reference] = struct{}{}
		}
	}
	for _, item := range input.AcademicEvidence {
		add(item.EvidenceRef)
	}
	for _, competency := range input.CompetencyScores {
		add(competency.CompetencyRef)
		for _, score := range competency.CourseScores {
			add(score.EvidenceRef)
			add(score.CourseRef)
		}
		for _, score := range competency.ActivityScores {
			add(score.EvidenceRef)
			add(score.ScoreEvidenceRef)
			add(score.ActivityEvidenceRef)
		}
	}
	for _, activity := range input.ActivityEvidence {
		add(activity.EvidenceRef)
		add(activity.ScoreEvidenceRef)
	}
	return references
}

func containsAssessmentPII(value string) bool {
	return assessmentEmailPattern.MatchString(value) ||
		assessmentPhonePattern.MatchString(value) ||
		assessmentNationalIDPattern.MatchString(value) ||
		assessmentStudentIDPattern.MatchString(value)
}
