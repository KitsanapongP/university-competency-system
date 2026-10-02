package services

import (
	"testing"
	"time"

	"github.com/spw32767/university-competency-system-backend/models"
)

func TestBuildAssessmentActivityScoresUsesOnlyFinalizedEarnedResults(t *testing.T) {
	startAt := time.Date(2026, 9, 1, 9, 0, 0, 0, time.UTC)
	evidence := []models.AssessmentActivityEvidence{
		{
			EvidenceRef:      "activity:1:10",
			ScoreEvidenceRef: "activity-score:3:4",
			ActivityID:       5,
			CompetencyID:     20,
			CompetencyNameTH: "การทำงานเป็นทีม",
			ActivityNameTH:   "กิจกรรมหนึ่ง",
			StartAt:          startAt,
			AttendanceStatus: "present",
			MaxPercent:       10,
			EarnedPercent:    floatPointer(7.25),
		},
		{
			EvidenceRef:            "activity:2:11",
			ActivityID:             6,
			CompetencyID:           20,
			CompetencyNameTH:       "การทำงานเป็นทีม",
			ActivityNameTH:         "กิจกรรมสอง",
			StartAt:                startAt.Add(time.Hour),
			AttendanceStatus:       "late",
			SessionStatus:          "completed",
			ScoreUnavailableReason: "scores_recalculation_required",
		},
	}

	results, available, reason := buildAssessmentActivityScores(evidence)
	if !available || reason != "some_activity_scores_unavailable" {
		t.Fatalf("expected partial finalized scores, got available=%v reason=%q", available, reason)
	}
	if len(results) != 1 || results[0].ActivityScore != 7.25 || len(results[0].ActivityScores) != 1 {
		t.Fatalf("expected only confirmed earned score, got %+v", results)
	}
	if results[0].ActivityScores[0].EvidenceRef != "activity-score:3:4" || results[0].ActivityScores[0].ActivityEvidenceRef != "activity:1:10" {
		t.Fatalf("expected score and participation references, got %+v", results[0].ActivityScores[0])
	}
}

func TestBuildAssessmentActivityScoresKeepsParticipationSeparateFromScoreAvailability(t *testing.T) {
	evidence := []models.AssessmentActivityEvidence{{
		EvidenceRef:            "activity:10:0",
		ActivityID:             4,
		ActivityNameTH:         "กิจกรรมที่เข้าร่วม",
		AttendanceStatus:       "present",
		ScoreUnavailableReason: "activity_competency_not_configured",
	}}

	results, available, reason := buildAssessmentActivityScores(evidence)
	availability := buildAssessmentActivityAvailability(evidence, available, reason)
	if len(results) != 0 || available || reason != "activity_competency_not_configured" {
		t.Fatalf("participation without competency score should remain unscored, got %+v %v %q", results, available, reason)
	}
	if !availability[0].Available || availability[1].Available {
		t.Fatalf("expected participation available but score unavailable, got %+v", availability)
	}
}

func TestBuildAssessmentActivityScoresDoesNotInventEvidenceWithoutAttendance(t *testing.T) {
	results, available, reason := buildAssessmentActivityScores(nil)
	if len(results) != 0 || available || reason != "no_confirmed_activity_participation" {
		t.Fatalf("unexpected empty activity result: %+v %v %q", results, available, reason)
	}
}

func floatPointer(value float64) *float64 {
	return &value
}
