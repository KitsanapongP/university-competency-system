package services

import (
	"sort"

	"github.com/spw32767/university-competency-system-backend/models"
)

func buildAssessmentActivityScores(
	evidence []models.AssessmentActivityEvidence,
) ([]models.AssessmentCompetencyScore, bool, string) {
	competencies := make(map[uint64]*models.AssessmentCompetencyScore)
	participationCount := 0
	unscoredCount := 0
	scoredCount := 0
	partialReason := ""

	for _, item := range evidence {
		participationCount++
		if item.EarnedPercent == nil {
			unscoredCount++
			partialReason = firstReason(partialReason, item.ScoreUnavailableReason)
			continue
		}
		if item.CompetencyID == 0 {
			unscoredCount++
			partialReason = firstReason(partialReason, "activity_competency_not_configured")
			continue
		}
		competency := competencies[item.CompetencyID]
		if competency == nil {
			competency = &models.AssessmentCompetencyScore{
				CompetencyID:     item.CompetencyID,
				CompetencyCode:   item.CompetencyCode,
				CompetencyNameTH: item.CompetencyNameTH,
				CompetencyNameEN: item.CompetencyNameEN,
				CourseScores:     make([]models.AssessmentCourseScore, 0),
				ElectiveScores:   make([]models.AssessmentCourseScore, 0),
				ActivityScores:   make([]models.AssessmentActivityScore, 0),
			}
			competencies[item.CompetencyID] = competency
		}
		value := roundAssessmentScore(*item.EarnedPercent)
		competency.ActivityScore = roundAssessmentScore(competency.ActivityScore + value)
		competency.HasEvidence = true
		competency.ActivityScores = append(competency.ActivityScores, models.AssessmentActivityScore{
			EvidenceRef:         item.ScoreEvidenceRef,
			ActivityEvidenceRef: item.EvidenceRef,
			ActivityID:          item.ActivityID,
			ActivityNameTH:      item.ActivityNameTH,
			ActivityNameEN:      item.ActivityNameEN,
			StartAt:             item.StartAt,
			AttendanceStatus:    item.AttendanceStatus,
			MaxPercent:          item.MaxPercent,
			EarnedPercent:       value,
		})
		scoredCount++
	}

	result := make([]models.AssessmentCompetencyScore, 0, len(competencies))
	for _, competency := range competencies {
		sort.Slice(competency.ActivityScores, func(i, j int) bool {
			left, right := competency.ActivityScores[i], competency.ActivityScores[j]
			if !left.StartAt.Equal(right.StartAt) {
				return left.StartAt.Before(right.StartAt)
			}
			return left.EvidenceRef < right.EvidenceRef
		})
		result = append(result, *competency)
	}
	sort.Slice(result, func(i, j int) bool { return result[i].CompetencyID < result[j].CompetencyID })

	if participationCount == 0 {
		return result, false, "no_confirmed_activity_participation"
	}
	if scoredCount == 0 {
		return result, false, firstReason(partialReason, "no_finalized_activity_scores")
	}
	if unscoredCount > 0 {
		return result, true, "some_activity_scores_unavailable"
	}
	return result, true, ""
}

func buildAssessmentActivityAvailability(
	evidence []models.AssessmentActivityEvidence,
	scoresAvailable bool,
	scoreReason string,
) []models.AssessmentSourceAvailability {
	participationAvailable := len(evidence) > 0
	participationReason := ""
	if !participationAvailable {
		participationReason = "no_confirmed_activity_participation"
	}
	return []models.AssessmentSourceAvailability{
		{Source: "activity_participation", Available: participationAvailable, Reason: participationReason},
		{Source: "activity_competency_scores", Available: scoresAvailable, Reason: scoreReason},
	}
}
