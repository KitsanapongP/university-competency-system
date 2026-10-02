package config

import (
	"testing"
	"time"
)

func TestLoadAssessmentOllamaDefaults(t *testing.T) {
	t.Setenv("LEARNER_ASSESSMENT_OLLAMA_TIMEOUT_SECONDS", "")
	t.Setenv("LEARNER_ASSESSMENT_OLLAMA_THINK", "")

	cfg := Load()
	if cfg.AssessmentOllamaTimeout != 120*time.Second {
		t.Fatalf("expected 120 second timeout, got %s", cfg.AssessmentOllamaTimeout)
	}
	if cfg.AssessmentOllamaThink {
		t.Fatal("think should be disabled by default")
	}
}

func TestLoadAssessmentOllamaThinkSetting(t *testing.T) {
	t.Setenv("LEARNER_ASSESSMENT_OLLAMA_THINK", "true")
	if !Load().AssessmentOllamaThink {
		t.Fatal("expected think to be enabled from configuration")
	}

	t.Setenv("LEARNER_ASSESSMENT_OLLAMA_THINK", "invalid")
	if Load().AssessmentOllamaThink {
		t.Fatal("invalid boolean should use the false fallback")
	}
}
