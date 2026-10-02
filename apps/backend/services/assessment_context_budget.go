package services

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"unicode"
	"unicode/utf8"

	"github.com/spw32767/university-competency-system-backend/models"
)

var ErrAssessmentContextExceeded = errors.New("assessment context exceeds configured budget")
var ErrAssessmentContextConfigurationMismatch = errors.New("assessment context settings differ from source hash")

type AssessmentContextBudget struct {
	ContextTokens       int
	OutputReserveTokens int
	SafetyMarginTokens  int
}

type PreparedAssessmentContext struct {
	Input           models.AssessmentProviderInput
	SystemPrompt    string
	UserPrompt      string
	Provenance      map[string][]string
	EstimatedTokens int
	Diagnostics     models.AssessmentContextDiagnostics
}

type AssessmentContextExceededError struct {
	EstimatedTokens int
	ContextTokens   int
	Diagnostics     models.AssessmentContextDiagnostics
}

func (e AssessmentContextExceededError) Error() string {
	return fmt.Sprintf("%v: estimated=%d input_budget=%d context=%d output_reserve=%d safety_margin=%d readiness_bytes=%d availability_bytes=%d academic_bytes=%d competency_bytes=%d activity_bytes=%d",
		ErrAssessmentContextExceeded,
		e.EstimatedTokens,
		e.Diagnostics.InputBudgetTokens,
		e.ContextTokens,
		e.Diagnostics.OutputReserveTokens,
		e.Diagnostics.SafetyMarginTokens,
		e.Diagnostics.ReadinessBytes,
		e.Diagnostics.AvailabilityBytes,
		e.Diagnostics.AcademicEvidenceBytes,
		e.Diagnostics.CompetencyScoresBytes,
		e.Diagnostics.ActivityEvidenceBytes,
	)
}

func (e AssessmentContextExceededError) Unwrap() error {
	return ErrAssessmentContextExceeded
}

func DefaultAssessmentContextBudget() AssessmentContextBudget {
	return AssessmentContextBudget{ContextTokens: 4096, OutputReserveTokens: 1024, SafetyMarginTokens: 128}
}

func normalizeAssessmentContextBudget(budget AssessmentContextBudget) AssessmentContextBudget {
	if budget.ContextTokens == 0 && budget.OutputReserveTokens == 0 && budget.SafetyMarginTokens == 0 {
		return DefaultAssessmentContextBudget()
	}
	return budget
}

func validateAssessmentContextBudget(budget AssessmentContextBudget) error {
	if budget.ContextTokens <= 0 || budget.OutputReserveTokens < 0 || budget.SafetyMarginTokens < 0 ||
		budget.OutputReserveTokens+budget.SafetyMarginTokens >= budget.ContextTokens {
		return fmt.Errorf("invalid assessment context budget")
	}
	return nil
}

func PrepareAssessmentContext(snapshot *models.LearnerAssessmentSnapshot, budget AssessmentContextBudget) (PreparedAssessmentContext, error) {
	if snapshot == nil {
		return PreparedAssessmentContext{}, fmt.Errorf("assessment snapshot is required")
	}
	budget = normalizeAssessmentContextBudget(budget)
	if err := validateAssessmentContextBudget(budget); err != nil {
		return PreparedAssessmentContext{}, err
	}
	if snapshot.Metadata.CompactionVersion != assessmentCompactionVersion ||
		snapshot.Metadata.ContextTokenLimit != budget.ContextTokens ||
		snapshot.Metadata.OutputTokenReserve != budget.OutputReserveTokens ||
		snapshot.Metadata.TokenSafetyMargin != budget.SafetyMarginTokens {
		return PreparedAssessmentContext{}, ErrAssessmentContextConfigurationMismatch
	}
	input, err := BuildAssessmentProviderInput(snapshot)
	if err != nil {
		return PreparedAssessmentContext{}, err
	}
	provenance := make(map[string][]string)
	var courseRefs map[string]string
	input.AcademicEvidence, courseRefs = aggregateProviderCourses(input.AcademicEvidence, provenance)
	for competencyIndex := range input.CompetencyScores {
		competency := &input.CompetencyScores[competencyIndex]
		for scoreIndex := range competency.CourseScores {
			if reference := courseRefs[competency.CourseScores[scoreIndex].CourseRef]; reference != "" {
				competency.CourseScores[scoreIndex].CourseRef = reference
			}
		}
		competency.CourseScores = aggregateProviderCourseScores(competency.CourseScores, provenance)
	}
	var activityRefs map[string]string
	input.ActivityEvidence, activityRefs = aggregateProviderActivities(input.ActivityEvidence, provenance)
	for competencyIndex := range input.CompetencyScores {
		for scoreIndex := range input.CompetencyScores[competencyIndex].ActivityScores {
			score := &input.CompetencyScores[competencyIndex].ActivityScores[scoreIndex]
			if reference := activityRefs[score.ActivityEvidenceRef]; reference != "" {
				score.ActivityEvidenceRef = reference
			}
			if reference := activityRefs[score.EvidenceRef]; reference != "" {
				score.EvidenceRef = reference
			}
		}
	}
	canonicalizeAssessmentProviderInput(&input)
	systemPrompt, userPrompt, err := BuildAssessmentPrompt(input)
	if err != nil {
		return PreparedAssessmentContext{}, err
	}
	prepared := PreparedAssessmentContext{
		Input:        input,
		SystemPrompt: systemPrompt,
		UserPrompt:   userPrompt,
		Provenance:   provenance,
	}
	prepared.EstimatedTokens = EstimateAssessmentPromptTokens(systemPrompt, userPrompt)
	prepared.Diagnostics = EstimateAssessmentContextDiagnostics(input, systemPrompt, userPrompt, budget, prepared.EstimatedTokens)
	if prepared.EstimatedTokens+budget.OutputReserveTokens+budget.SafetyMarginTokens > budget.ContextTokens {
		return prepared, AssessmentContextExceededError{
			EstimatedTokens: prepared.EstimatedTokens + budget.OutputReserveTokens + budget.SafetyMarginTokens,
			ContextTokens:   budget.ContextTokens,
			Diagnostics:     prepared.Diagnostics,
		}
	}
	return prepared, nil
}

// EstimateAssessmentContextDiagnostics returns token budgets and byte counts without source text.
func EstimateAssessmentContextDiagnostics(
	input models.AssessmentProviderInput,
	systemPrompt, userPrompt string,
	budget AssessmentContextBudget,
	estimatedInputTokens int,
) models.AssessmentContextDiagnostics {
	return models.AssessmentContextDiagnostics{
		ContextTokens:         budget.ContextTokens,
		InputBudgetTokens:     budget.ContextTokens - budget.OutputReserveTokens - budget.SafetyMarginTokens,
		EstimatedInputTokens:  estimatedInputTokens,
		EstimatedTotalTokens:  estimatedInputTokens + budget.OutputReserveTokens + budget.SafetyMarginTokens,
		OutputReserveTokens:   budget.OutputReserveTokens,
		SafetyMarginTokens:    budget.SafetyMarginTokens,
		SystemPromptBytes:     len(systemPrompt),
		UserPromptBytes:       len(userPrompt),
		SourceDataBytes:       assessmentJSONSize(input),
		ReadinessBytes:        assessmentJSONSize(input.Readiness),
		AvailabilityBytes:     assessmentJSONSize(input.Availability),
		AcademicEvidenceBytes: assessmentJSONSize(input.AcademicEvidence),
		CompetencyScoresBytes: assessmentJSONSize(input.CompetencyScores),
		ActivityEvidenceBytes: assessmentJSONSize(input.ActivityEvidence),
	}
}

func assessmentJSONSize(value any) int {
	encoded, err := json.Marshal(value)
	if err != nil {
		return 0
	}
	return len(encoded)
}

func EstimateAssessmentPromptTokens(systemPrompt, userPrompt string) int {
	// This is a conservative estimate, not the Ollama model's exact tokenizer.
	var estimated, asciiRunes int
	flushASCII := func() {
		if asciiRunes > 0 {
			estimated += (asciiRunes + 2) / 3
			asciiRunes = 0
		}
	}
	for _, text := range []string{systemPrompt, userPrompt} {
		for _, current := range text {
			if current < utf8.RuneSelf && (unicode.IsLetter(current) || unicode.IsNumber(current)) {
				asciiRunes++
				continue
			}
			flushASCII()
			if !unicode.IsSpace(current) {
				estimated++
			}
		}
		flushASCII()
	}
	return (estimated*5 + 3) / 4
}

func aggregateProviderCourses(
	items []models.AssessmentProviderCourse,
	provenance map[string][]string,
) ([]models.AssessmentProviderCourse, map[string]string) {
	groups := make(map[string][]models.AssessmentProviderCourse)
	for _, item := range items {
		keyItem := item
		keyItem.EvidenceRef = ""
		keyItem.OccurrenceCount = 0
		groups[assessmentCanonicalKey(keyItem)] = append(groups[assessmentCanonicalKey(keyItem)], item)
	}
	keys := sortedKeys(groups)
	result := make([]models.AssessmentProviderCourse, 0, len(keys))
	refMap := make(map[string]string)
	for _, key := range keys {
		group := groups[key]
		sort.Slice(group, func(i, j int) bool { return group[i].EvidenceRef < group[j].EvidenceRef })
		item := group[0]
		item.OccurrenceCount = len(group)
		targetRef := item.EvidenceRef
		sourceRefs := make([]string, 0, len(group))
		if len(group) > 1 {
			targetRef = assessmentAggregateReference("course", key)
			item.EvidenceRef = targetRef
		}
		for _, source := range group {
			sourceRefs = append(sourceRefs, source.EvidenceRef)
			refMap[source.EvidenceRef] = targetRef
		}
		provenance[targetRef] = sourceRefs
		result = append(result, item)
	}
	return result, refMap
}

func aggregateProviderCourseScores(
	items []models.AssessmentProviderCourseScore,
	provenance map[string][]string,
) []models.AssessmentProviderCourseScore {
	groups := make(map[string][]models.AssessmentProviderCourseScore)
	for _, item := range items {
		keyItem := item
		keyItem.EvidenceRef = ""
		keyItem.OccurrenceCount = 0
		groups[assessmentCanonicalKey(keyItem)] = append(groups[assessmentCanonicalKey(keyItem)], item)
	}
	keys := sortedKeys(groups)
	result := make([]models.AssessmentProviderCourseScore, 0, len(keys))
	for _, key := range keys {
		group := groups[key]
		sort.Slice(group, func(i, j int) bool { return group[i].EvidenceRef < group[j].EvidenceRef })
		item := group[0]
		item.OccurrenceCount = len(group)
		if len(group) > 1 {
			item.EvidenceRef = assessmentAggregateReference("course-score", key)
		}
		sourceRefs := make([]string, 0, len(group))
		for _, source := range group {
			sourceRefs = append(sourceRefs, source.EvidenceRef)
		}
		provenance[item.EvidenceRef] = sourceRefs
		result = append(result, item)
	}
	return result
}

func aggregateProviderActivities(
	items []models.AssessmentProviderActivity,
	provenance map[string][]string,
) ([]models.AssessmentProviderActivity, map[string]string) {
	groups := make(map[string][]models.AssessmentProviderActivity)
	for _, item := range items {
		keyItem := item
		keyItem.EvidenceRef = ""
		keyItem.ScoreEvidenceRef = ""
		keyItem.OccurrenceCount = 0
		groups[assessmentCanonicalKey(keyItem)] = append(groups[assessmentCanonicalKey(keyItem)], item)
	}
	keys := sortedKeys(groups)
	result := make([]models.AssessmentProviderActivity, 0, len(keys))
	refMap := make(map[string]string)
	for _, key := range keys {
		group := groups[key]
		sort.Slice(group, func(i, j int) bool { return group[i].EvidenceRef < group[j].EvidenceRef })
		item := group[0]
		item.OccurrenceCount = len(group)
		activityRef := item.EvidenceRef
		scoreRef := item.ScoreEvidenceRef
		if len(group) > 1 {
			activityRef = assessmentAggregateReference("activity", key)
			if scoreRef != "" {
				scoreRef = assessmentAggregateReference("activity-score", key)
			}
		}
		activityRefs := make([]string, 0, len(group))
		scoreRefs := make([]string, 0, len(group))
		for _, source := range group {
			activityRefs = append(activityRefs, source.EvidenceRef)
			refMap[source.EvidenceRef] = activityRef
			if source.ScoreEvidenceRef != "" {
				scoreRefs = append(scoreRefs, source.ScoreEvidenceRef)
				refMap[source.ScoreEvidenceRef] = scoreRef
			}
		}
		item.EvidenceRef = activityRef
		item.ScoreEvidenceRef = scoreRef
		provenance[activityRef] = activityRefs
		if len(scoreRefs) > 0 {
			provenance[scoreRef] = scoreRefs
		}
		result = append(result, item)
	}
	return result, refMap
}

func canonicalizeAssessmentProviderInput(input *models.AssessmentProviderInput) {
	sort.Slice(input.AcademicEvidence, func(i, j int) bool {
		return input.AcademicEvidence[i].EvidenceRef < input.AcademicEvidence[j].EvidenceRef
	})
	sort.Slice(input.CompetencyScores, func(i, j int) bool {
		return input.CompetencyScores[i].CompetencyRef < input.CompetencyScores[j].CompetencyRef
	})
	for index := range input.CompetencyScores {
		item := &input.CompetencyScores[index]
		sort.Slice(item.CourseScores, func(i, j int) bool { return item.CourseScores[i].EvidenceRef < item.CourseScores[j].EvidenceRef })
		sort.Slice(item.ActivityScores, func(i, j int) bool { return item.ActivityScores[i].EvidenceRef < item.ActivityScores[j].EvidenceRef })
	}
	sort.Slice(input.ActivityEvidence, func(i, j int) bool {
		return input.ActivityEvidence[i].EvidenceRef < input.ActivityEvidence[j].EvidenceRef
	})
	sort.Slice(input.Availability, func(i, j int) bool { return input.Availability[i].Source < input.Availability[j].Source })
}

func assessmentCanonicalKey(value any) string {
	encoded, _ := json.Marshal(value)
	return string(encoded)
}

func assessmentAggregateReference(kind, key string) string {
	digest := sha256.Sum256([]byte(key))
	return "aggregate:" + kind + ":" + hex.EncodeToString(digest[:10])
}

func sortedKeys[V any](groups map[string]V) []string {
	keys := make([]string, 0, len(groups))
	for key := range groups {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func expandAssessmentProvenance(references []string, provenance map[string][]string) []string {
	expanded := make([]string, 0, len(references))
	seen := make(map[string]struct{})
	for _, reference := range references {
		values := provenance[reference]
		if len(values) == 0 {
			values = []string{reference}
		}
		for _, value := range values {
			if _, ok := seen[value]; ok {
				continue
			}
			seen[value] = struct{}{}
			expanded = append(expanded, value)
		}
	}
	sort.Strings(expanded)
	return expanded
}
