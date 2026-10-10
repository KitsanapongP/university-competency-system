package services

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"math"
	"sort"

	"github.com/spw32767/university-competency-system-backend/models"
)

const (
	assessmentPipelineVersion   = "learner-assessment-v1.1.0"
	assessmentProvider          = "ollama"
	assessmentModel             = "qwen3:4b"
	assessmentPromptVersion     = "learner-assessment-prompt-v1.1.7"
	assessmentSchemaVersion     = assessmentNarrativeSchemaVersion
	assessmentCompactionVersion = "learner-assessment-compaction-v3"
)

type assessmentHashScope struct {
	PersonID               uint64 `json:"person_id"`
	EnrollmentID           uint64 `json:"enrollment_id"`
	EnrollmentCurriculumID uint64 `json:"enrollment_curriculum_id"`
	CohortID               uint64 `json:"cohort_id"`
	CurriculumID           uint64 `json:"curriculum_id"`
	FacultyID              uint64 `json:"faculty_id"`
	EntryYearBE            uint64 `json:"entry_year_be"`
	TargetYearBE           uint64 `json:"target_year_be"`
}

type assessmentHashVersions struct {
	PipelineVersion           string `json:"pipeline_version"`
	Provider                  string `json:"provider"`
	Model                     string `json:"model"`
	ModelDigest               string `json:"model_digest"`
	ProviderConfigFingerprint string `json:"provider_config_fingerprint"`
	ThinkEnabled              bool   `json:"think_enabled"`
	PromptVersion             string `json:"prompt_version"`
	SchemaVersion             string `json:"schema_version"`
	CompactionVersion         string `json:"compaction_version"`
	ContextTokenLimit         int    `json:"context_token_limit"`
	OutputTokenReserve        int    `json:"output_token_reserve"`
	TokenSafetyMargin         int    `json:"token_safety_margin"`
}

type assessmentHashPayload struct {
	Curriculum   *models.AssessmentBilingualText       `json:"curriculum,omitempty"`
	HashVersion  string                                `json:"hash_version"`
	Scope        assessmentHashScope                   `json:"scope"`
	Semester     uint                                  `json:"semester"`
	TargetYearBE uint64                                `json:"target_year_be"`
	Completeness string                                `json:"completeness"`
	Versions     assessmentHashVersions                `json:"versions"`
	Readiness    models.CooperativeReadinessResult     `json:"readiness"`
	Academic     []models.AssessmentAcademicEvidence   `json:"academic_evidence"`
	Competency   []models.AssessmentCompetencyScore    `json:"course_competency_scores"`
	Activities   []models.AssessmentActivityEvidence   `json:"activity_evidence"`
	Availability []models.AssessmentSourceAvailability `json:"availability"`
}

type AssessmentGenerationConfig struct {
	Provider     string
	Model        string
	ModelDigest  string
	ThinkEnabled bool
	KeepAlive    string
}

func assessmentSourceMetadata(budget AssessmentContextBudget, configs ...AssessmentGenerationConfig) models.AssessmentSourceMetadata {
	config := AssessmentGenerationConfig{KeepAlive: "5m"}
	if len(configs) > 0 {
		config = configs[0]
		if config.KeepAlive == "" {
			config.KeepAlive = "5m"
		}
	}
	metadata := models.AssessmentSourceMetadata{
		PipelineVersion:    assessmentPipelineVersion,
		Provider:           assessmentProvider,
		Model:              assessmentModel,
		ModelDigest:        config.ModelDigest,
		ThinkEnabled:       config.ThinkEnabled,
		PromptVersion:      assessmentPromptVersion,
		SchemaVersion:      assessmentSchemaVersion,
		CompactionVersion:  assessmentCompactionVersion,
		ContextTokenLimit:  budget.ContextTokens,
		OutputTokenReserve: budget.OutputReserveTokens,
		TokenSafetyMargin:  budget.SafetyMarginTokens,
	}
	if config.Provider != "" && config.Provider != "ollama" {
		metadata.Provider = config.Provider
		metadata.Model = config.Model
		metadata.ModelDigest = ""
		metadata.ThinkEnabled = false
		metadata.PromptVersion = "learner-assessment-api-prompt-v1"
		metadata.SchemaVersion = "learner-assessment-api-output-v1"
		config.KeepAlive = ""
	}
	metadata.ProviderConfigFingerprint = assessmentProviderConfigFingerprint(metadata, config.KeepAlive)
	return metadata
}

func assessmentProviderConfigFingerprint(metadata models.AssessmentSourceMetadata, keepAlive string) string {
	settings := struct {
		Provider           string `json:"provider"`
		Model              string `json:"model"`
		ModelDigest        string `json:"model_digest"`
		ThinkEnabled       bool   `json:"think_enabled"`
		Temperature        int    `json:"temperature"`
		OutputTokenReserve int    `json:"output_token_reserve"`
		ContextTokenLimit  int    `json:"context_token_limit"`
		TokenSafetyMargin  int    `json:"token_safety_margin"`
		KeepAlive          string `json:"keep_alive"`
		PromptVersion      string `json:"prompt_version"`
		SchemaVersion      string `json:"schema_version"`
		CompactionVersion  string `json:"compaction_version"`
	}{
		Provider: metadata.Provider, Model: metadata.Model, ModelDigest: metadata.ModelDigest,
		ThinkEnabled: metadata.ThinkEnabled, Temperature: 0,
		OutputTokenReserve: metadata.OutputTokenReserve, ContextTokenLimit: metadata.ContextTokenLimit,
		TokenSafetyMargin: metadata.TokenSafetyMargin, KeepAlive: keepAlive,
		PromptVersion: metadata.PromptVersion, SchemaVersion: metadata.SchemaVersion,
		CompactionVersion: metadata.CompactionVersion,
	}
	encoded, _ := json.Marshal(settings)
	digest := sha256.Sum256(encoded)
	return hex.EncodeToString(digest[:])
}

func calculateAssessmentSourceHash(snapshot *models.LearnerAssessmentSnapshot) (string, error) {
	if snapshot == nil {
		return "", nil
	}
	readiness := snapshot.Readiness
	readiness.Results = append([]models.CooperativeRequirementResult(nil), snapshot.Readiness.Results...)
	for index := range readiness.Results {
		item := &readiness.Results[index]
		item.CurrentValue = normalizeFloatPointer(item.CurrentValue, 2)
		item.RequiredValue = normalizeFloatPointer(item.RequiredValue, 2)
	}
	sort.Slice(readiness.Results, func(i, j int) bool {
		if readiness.Results[i].RequirementID != readiness.Results[j].RequirementID {
			return readiness.Results[i].RequirementID < readiness.Results[j].RequirementID
		}
		return readiness.Results[i].CriterionType < readiness.Results[j].CriterionType
	})

	academic := append([]models.AssessmentAcademicEvidence(nil), snapshot.AcademicEvidence...)
	for index := range academic {
		academic[index].CategoryIDs = append([]uint64(nil), academic[index].CategoryIDs...)
		sort.Slice(academic[index].CategoryIDs, func(i, j int) bool { return academic[index].CategoryIDs[i] < academic[index].CategoryIDs[j] })
	}
	sort.Slice(academic, func(i, j int) bool { return academic[i].EvidenceRef < academic[j].EvidenceRef })

	competencies := append([]models.AssessmentCompetencyScore(nil), snapshot.CourseScores...)
	for index := range competencies {
		item := &competencies[index]
		item.CoreScore = normalizeFloat(item.CoreScore, 4)
		item.BonusScore = normalizeFloat(item.BonusScore, 4)
		item.FreeElectiveScore = normalizeFloat(item.FreeElectiveScore, 4)
		item.ActivityScore = normalizeFloat(item.ActivityScore, 4)
		item.CourseScores = canonicalCourseScores(item.CourseScores)
		item.ElectiveScores = canonicalCourseScores(item.ElectiveScores)
		item.ActivityScores = append([]models.AssessmentActivityScore(nil), item.ActivityScores...)
		for scoreIndex := range item.ActivityScores {
			score := &item.ActivityScores[scoreIndex]
			score.StartAt = score.StartAt.UTC()
			score.MaxPercent = normalizeFloat(score.MaxPercent, 4)
			score.EarnedPercent = normalizeFloat(score.EarnedPercent, 4)
		}
		sort.Slice(item.ActivityScores, func(i, j int) bool { return item.ActivityScores[i].EvidenceRef < item.ActivityScores[j].EvidenceRef })
	}
	sort.Slice(competencies, func(i, j int) bool { return competencies[i].CompetencyID < competencies[j].CompetencyID })

	activities := append([]models.AssessmentActivityEvidence(nil), snapshot.ActivityEvidence...)
	for index := range activities {
		activities[index].StartAt = activities[index].StartAt.UTC()
		activities[index].MaxPercent = normalizeFloat(activities[index].MaxPercent, 4)
		activities[index].EarnedPercent = normalizeFloatPointer(activities[index].EarnedPercent, 4)
	}
	sort.Slice(activities, func(i, j int) bool { return activities[i].EvidenceRef < activities[j].EvidenceRef })

	availability := make([]models.AssessmentSourceAvailability, 0, len(snapshot.Availability))
	for _, source := range snapshot.Availability {
		if source.Source != "career_paths" {
			availability = append(availability, source)
		}
	}
	sort.Slice(availability, func(i, j int) bool { return availability[i].Source < availability[j].Source })
	metadata := snapshot.Metadata
	payload := assessmentHashPayload{
		Curriculum:  snapshot.Curriculum,
		HashVersion: "sha256-json-v2",
		Scope: assessmentHashScope{
			PersonID:               snapshot.Scope.PersonID,
			EnrollmentID:           snapshot.Scope.EnrollmentID,
			EnrollmentCurriculumID: snapshot.Scope.EnrollmentCurriculumID,
			CohortID:               snapshot.Scope.CohortID,
			CurriculumID:           snapshot.Scope.CurriculumID,
			FacultyID:              snapshot.Scope.FacultyID,
			EntryYearBE:            snapshot.Scope.EntryYearBE,
			TargetYearBE:           snapshot.Scope.TargetYearBE,
		},
		Semester:     snapshot.Semester,
		TargetYearBE: snapshot.TargetYearBE,
		Completeness: snapshot.Completeness,
		Versions: assessmentHashVersions{
			PipelineVersion:           metadata.PipelineVersion,
			Provider:                  metadata.Provider,
			Model:                     metadata.Model,
			ModelDigest:               metadata.ModelDigest,
			ProviderConfigFingerprint: metadata.ProviderConfigFingerprint,
			ThinkEnabled:              metadata.ThinkEnabled,
			PromptVersion:             metadata.PromptVersion,
			SchemaVersion:             metadata.SchemaVersion,
			CompactionVersion:         metadata.CompactionVersion,
			ContextTokenLimit:         metadata.ContextTokenLimit,
			OutputTokenReserve:        metadata.OutputTokenReserve,
			TokenSafetyMargin:         metadata.TokenSafetyMargin,
		},
		Readiness:    readiness,
		Academic:     academic,
		Competency:   competencies,
		Activities:   activities,
		Availability: availability,
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	digest := sha256.Sum256(encoded)
	return hex.EncodeToString(digest[:]), nil
}

func canonicalCourseScores(scores []models.AssessmentCourseScore) []models.AssessmentCourseScore {
	canonical := append([]models.AssessmentCourseScore(nil), scores...)
	for index := range canonical {
		canonical[index].RawScore = normalizeFloat(canonical[index].RawScore, 4)
		canonical[index].Weight = normalizeFloat(canonical[index].Weight, 4)
		canonical[index].WeightedScore = normalizeFloat(canonical[index].WeightedScore, 4)
	}
	sort.Slice(canonical, func(i, j int) bool { return canonical[i].EvidenceRef < canonical[j].EvidenceRef })
	return canonical
}

func normalizeFloat(value float64, precision int) float64 {
	factor := 1.0
	for range precision {
		factor *= 10
	}
	return math.Round(value*factor) / factor
}

func normalizeFloatPointer(value *float64, precision int) *float64 {
	if value == nil {
		return nil
	}
	canonical := normalizeFloat(*value, precision)
	return &canonical
}
