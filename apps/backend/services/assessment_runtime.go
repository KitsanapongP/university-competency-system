package services

import (
	"errors"
	"github.com/spw32767/university-competency-system-backend/config"
	"strings"
)

// API and worker must use the same effective settings when hashing evidence.
func AssessmentRuntime(c config.Config) (AssessmentContextBudget, AssessmentGenerationConfig, error) {
	b := AssessmentContextBudget{ContextTokens: c.AssessmentContextTokens, OutputReserveTokens: c.AssessmentOutputReserveTokens, SafetyMarginTokens: c.AssessmentTokenSafetyMargin}
	g := AssessmentGenerationConfig{Provider: c.AssessmentProvider, Model: c.AssessmentAPIModel}
	if g.Provider == "" || g.Provider == "ollama" {
		g.Provider = "ollama"
		g.Model = DefaultAssessmentModel()
		g.ModelDigest, g.ThinkEnabled, g.KeepAlive = c.AssessmentOllamaModelDigest, c.AssessmentOllamaThink, c.AssessmentOllamaKeepAlive
		if g.ModelDigest == "" {
			return b, g, errors.New("assessment configuration missing: LEARNER_ASSESSMENT_OLLAMA_MODEL_DIGEST")
		}
		return b, g, nil
	}
	switch g.Provider {
	case "deepseek", "openai", "gemini":
	default:
		return b, g, errors.New("unsupported assessment provider")
	}
	if !c.AssessmentAPIEnabled || strings.TrimSpace(c.AssessmentAPIKey) == "" || strings.TrimSpace(g.Model) == "" {
		return b, g, errors.New("assessment API disabled or selected provider key/model missing")
	}
	if c.AssessmentAPITimeout <= 0 || c.AssessmentAPIIdleTimeout <= 0 || c.AssessmentAPIDailyLimit <= 0 || b.ContextTokens <= b.OutputReserveTokens+b.SafetyMarginTokens || b.OutputReserveTokens <= 0 || b.SafetyMarginTokens < 0 {
		return b, g, errors.New("invalid assessment API limits")
	}
	return b, g, nil
}
