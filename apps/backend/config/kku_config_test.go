package config

import (
	"testing"

	"github.com/joho/godotenv"
)

func TestKKUConfigurationReadsSelectedProviderCredentials(t *testing.T) {
	t.Setenv("LEARNER_ASSESSMENT_PROVIDER", "kku")
	t.Setenv("LEARNER_ASSESSMENT_KKU_API_KEY", "university-key")
	t.Setenv("LEARNER_ASSESSMENT_KKU_MODEL", "deepseek-v4-flash")
	t.Setenv("LEARNER_ASSESSMENT_DEEPSEEK_API_KEY", "direct-key")
	cfg := Load()
	if cfg.AssessmentAPIKey != "university-key" || cfg.AssessmentAPIModel != "deepseek-v4-flash" || cfg.AssessmentProvider != "kku" {
		t.Fatal("selected provider credentials were not loaded")
	}
}

func TestKKUEnvironmentKeyAliasExpandsWithoutDuplicatingSecret(t *testing.T) {
	values, err := godotenv.Unmarshal("LEARNER_ASSESSMENT_DEEPSEEK_API_KEY=university-key\nLEARNER_ASSESSMENT_KKU_API_KEY=${LEARNER_ASSESSMENT_DEEPSEEK_API_KEY}\n")
	if err != nil || values["LEARNER_ASSESSMENT_KKU_API_KEY"] != "university-key" {
		t.Fatal("environment key reference did not expand")
	}
}
