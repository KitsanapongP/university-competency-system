package config

import (
	"strings"
	"testing"
	"time"
)

func TestValidateAPIRequiresExplicitCredentials(t *testing.T) {
	t.Setenv("DB_USER", "")
	t.Setenv("JWT_SECRET", "")
	if err := Load().ValidateAPI(); err == nil || !strings.Contains(err.Error(), "DB_USER") {
		t.Fatalf("missing DB_USER should fail: %v", err)
	}

	t.Setenv("DB_USER", "officer_app")
	for _, secret := range []string{"", "dev-secret-change-me", "short-secret"} {
		t.Setenv("JWT_SECRET", secret)
		if err := Load().ValidateAPI(); err == nil || !strings.Contains(err.Error(), "JWT_SECRET") {
			t.Fatalf("invalid JWT_SECRET should fail without exposing it: %v", err)
		}
	}

	t.Setenv("JWT_SECRET", strings.Repeat("x", 32))
	if err := Load().ValidateAPI(); err != nil {
		t.Fatalf("explicit configuration should pass: %v", err)
	}
}

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
