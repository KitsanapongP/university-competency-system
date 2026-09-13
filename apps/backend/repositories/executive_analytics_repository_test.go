package repositories

import (
	"testing"

	"github.com/spw32767/university-competency-system-backend/models"
)

func TestCohortReadinessReportsMissingCalculatedScores(t *testing.T) {
	item := models.ExecutiveCohortSummary{
		HasTemplate:     true,
		HasRequirements: true,
		HasScores:       false,
	}

	code, messageTH, messageEN := cohortReadiness(item)
	if code != "NO_SCORES" {
		t.Fatalf("expected NO_SCORES, got %q", code)
	}
	if messageTH == "" || messageEN == "" {
		t.Fatal("readiness should include Thai and English explanations")
	}
}
