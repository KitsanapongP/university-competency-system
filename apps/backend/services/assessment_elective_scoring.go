package services

import (
	"math"
	"sort"
	"strings"

	"github.com/spw32767/university-competency-system-backend/grading"
	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
)

func calculateAssessmentElectiveScores(
	attempts []repositories.AssessmentElectiveAttempt,
	targetYearBE uint64,
	semester uint,
	cohortFound bool,
	recalculationRequired bool,
) ([]models.AssessmentCompetencyScore, bool, string) {
	if !cohortFound {
		return []models.AssessmentCompetencyScore{}, false, "cohort_not_found"
	}
	if recalculationRequired {
		return []models.AssessmentCompetencyScore{}, false, "free_elective_scores_recalculation_required"
	}

	bestByCourse := make(map[uint64]repositories.AssessmentElectiveAttempt)
	for _, candidate := range attempts {
		if !candidate.HasGrade || candidate.GradeRecordID == 0 ||
			candidate.RoundStatus == "cancelled" ||
			!isBeforeAssessmentTarget(candidate.AcademicYearBE, candidate.Semester, targetYearBE, semester) {
			continue
		}
		key := candidate.FreeElectiveCourseID
		if key == 0 {
			key = candidate.EnrollmentRecordID
		}
		current, exists := bestByCourse[key]
		if !exists || isBetterAssessmentElectiveAttempt(candidate, current) {
			bestByCourse[key] = candidate
		}
	}

	competencies := make(map[uint64]*models.AssessmentCompetencyScore)
	partialReason := ""
	bestAttempts := make([]repositories.AssessmentElectiveAttempt, 0, len(bestByCourse))
	for _, attempt := range bestByCourse {
		bestAttempts = append(bestAttempts, attempt)
	}
	sort.Slice(bestAttempts, func(i, j int) bool {
		if bestAttempts[i].FreeElectiveCourseID != bestAttempts[j].FreeElectiveCourseID {
			return bestAttempts[i].FreeElectiveCourseID < bestAttempts[j].FreeElectiveCourseID
		}
		return bestAttempts[i].GradeRecordID < bestAttempts[j].GradeRecordID
	})

	for _, attempt := range bestAttempts {
		if attempt.RoundStatus != "finalized" {
			partialReason = firstReason(partialReason, "elective_offering_not_finalized")
			continue
		}
		evaluation := grading.Evaluate(attempt.GradeScheme, attempt.Grade)
		if !evaluation.Recognized || !evaluation.HasScore {
			partialReason = firstReason(partialReason, "elective_grade_has_no_competency_score")
			continue
		}
		if len(attempt.Mappings) == 0 {
			partialReason = firstReason(partialReason, "elective_competency_mapping_missing")
			continue
		}

		courseEvidenceRef := assessmentCourseEvidenceRef("free_elective", attempt.EnrollmentRecordID)
		for _, mapping := range attempt.Mappings {
			competency := competencies[mapping.CompetencyID]
			if competency == nil {
				competency = &models.AssessmentCompetencyScore{
					CompetencyID:     mapping.CompetencyID,
					CompetencyCode:   mapping.CompetencyCode,
					CompetencyNameTH: mapping.CompetencyNameTH,
					CompetencyNameEN: mapping.CompetencyNameEN,
					CourseScores:     make([]models.AssessmentCourseScore, 0),
					ElectiveScores:   make([]models.AssessmentCourseScore, 0),
				}
				competencies[mapping.CompetencyID] = competency
			}
			weightedScore := roundAssessmentScore4(evaluation.Score * mapping.Weight / 100)
			competency.FreeElectiveScore += weightedScore
			competency.HasEvidence = true
			competency.ElectiveScores = append(competency.ElectiveScores, models.AssessmentCourseScore{
				EvidenceRef:       "score:" + courseEvidenceRef + ":competency:" + assessmentUintString(mapping.CompetencyID),
				CourseEvidenceRef: courseEvidenceRef,
				Source:            "free_elective",
				CourseID:          attempt.FreeElectiveCourseID,
				CourseCode:        attempt.CourseCode,
				CourseNameTH:      attempt.CourseNameTH,
				CourseNameEN:      attempt.CourseNameEN,
				AcademicYearBE:    attempt.AcademicYearBE,
				Semester:          attempt.Semester,
				Grade:             grading.Normalize(attempt.Grade),
				RawScore:          evaluation.Score,
				Weight:            mapping.Weight,
				WeightedScore:     weightedScore,
				ScoreType:         "free_elective",
			})
		}
	}

	result := make([]models.AssessmentCompetencyScore, 0, len(competencies))
	for _, competency := range competencies {
		competency.FreeElectiveScore = roundAssessmentScore(competency.FreeElectiveScore)
		sort.Slice(competency.ElectiveScores, func(i, j int) bool {
			left, right := competency.ElectiveScores[i], competency.ElectiveScores[j]
			if left.AcademicYearBE != right.AcademicYearBE {
				return left.AcademicYearBE < right.AcademicYearBE
			}
			if left.Semester != right.Semester {
				return left.Semester < right.Semester
			}
			return left.EvidenceRef < right.EvidenceRef
		})
		result = append(result, *competency)
	}
	sort.Slice(result, func(i, j int) bool { return result[i].CompetencyID < result[j].CompetencyID })
	if len(result) == 0 {
		return result, false, firstReason(partialReason, "no_finalized_elective_score_evidence")
	}
	return result, true, partialReason
}

func isBeforeAssessmentTarget(year, recordSemester, targetYear uint64, targetSemester uint) bool {
	return year < targetYear || (year == targetYear && recordSemester < uint64(targetSemester))
}

func isBetterAssessmentElectiveAttempt(candidate, current repositories.AssessmentElectiveAttempt) bool {
	candidateGrade := grading.Evaluate(candidate.GradeScheme, candidate.Grade)
	currentGrade := grading.Evaluate(current.GradeScheme, current.Grade)
	if !candidateGrade.Recognized {
		return false
	}
	if !currentGrade.Recognized {
		return true
	}
	if candidateGrade.HasScore != currentGrade.HasScore {
		return candidateGrade.HasScore
	}
	if candidateGrade.HasScore && candidateGrade.Score != currentGrade.Score {
		return candidateGrade.Score > currentGrade.Score
	}
	if candidate.AcademicYearBE != current.AcademicYearBE {
		return candidate.AcademicYearBE > current.AcademicYearBE
	}
	if candidate.Semester != current.Semester {
		return candidate.Semester > current.Semester
	}
	if candidate.GradeRecordID != current.GradeRecordID {
		return candidate.GradeRecordID > current.GradeRecordID
	}
	return candidate.EnrollmentRecordID > current.EnrollmentRecordID
}

func firstReason(current, next string) string {
	if strings.TrimSpace(current) != "" {
		return current
	}
	return next
}

func roundAssessmentScore4(value float64) float64 {
	return math.Round(value*10000) / 10000
}
