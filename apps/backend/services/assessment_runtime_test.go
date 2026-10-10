package services

import (
	"github.com/spw32767/university-competency-system-backend/config"
	"testing"
	"time"
)

func TestAPIRuntimeRequiresExplicitConfiguration(t *testing.T) {
	c := config.Config{AssessmentProvider: "deepseek", AssessmentContextTokens: 12288, AssessmentOutputReserveTokens: 3072, AssessmentTokenSafetyMargin: 128, AssessmentAPITimeout: 240 * time.Second, AssessmentAPIIdleTimeout: 60 * time.Second, AssessmentAPIDailyLimit: 20}
	if _, _, err := AssessmentRuntime(c); err == nil {
		t.Fatal("unconfigured API enabled")
	}
	c.AssessmentAPIEnabled = true
	c.AssessmentAPIKey = "test-key"
	c.AssessmentAPIModel = "test-model"
	b, g, err := AssessmentRuntime(c)
	if err != nil {
		t.Fatal(err)
	}
	m := assessmentSourceMetadata(b, g)
	if m.Provider != "deepseek" || m.Model != "test-model" || m.ModelDigest != "" {
		t.Fatal("incorrect API metadata")
	}
	c.AssessmentAPIKey = "another-secret"
	_, other, _ := AssessmentRuntime(c)
	if assessmentSourceMetadata(b, other).ProviderConfigFingerprint != m.ProviderConfigFingerprint {
		t.Fatal("secret used in fingerprint")
	}
	other.Model = "another-model"
	if assessmentSourceMetadata(b, other).ProviderConfigFingerprint == m.ProviderConfigFingerprint {
		t.Fatal("model not hashed")
	}
}
