package services

import (
	"context"
	"errors"
	"math"
	"sort"
	"strconv"
	"strings"

	"github.com/spw32767/university-competency-system-backend/grading"
	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
)

func assessmentCourseScoringSetup(
	ctx context.Context,
	queryer repositories.AssessmentQueryer,
	repo *repositories.AssessmentSourceRepository,
	cohortID uint64,
) (repositories.AssessmentCourseScoringSetup, string, error) {
	if cohortID == 0 {
		return repositories.AssessmentCourseScoringSetup{}, "cohort_not_found", nil
	}
	setup, err := repo.GetCourseScoringSetupWith(ctx, queryer, cohortID)
	if errors.Is(err, repositories.ErrAssessmentCohortNotFound) {
		return repositories.AssessmentCourseScoringSetup{}, "cohort_not_found", nil
	}
	if err != nil {
		return repositories.AssessmentCourseScoringSetup{}, "", err
	}
	switch {
	case !setup.HasAssignment:
		return setup, "template_assignment_missing", nil
	case !setup.HasActiveTemplate:
		return setup, "active_template_missing", nil
	case setup.RecalculationRequired:
		return setup, "course_scores_recalculation_required", nil
	case len(setup.Mappings) == 0:
		return setup, "competency_mapping_missing", nil
	default:
		return setup, "", nil
	}
}

func calculateAssessmentCourseScores(
	evidence []models.AssessmentAcademicEvidence,
	setup repositories.AssessmentCourseScoringSetup,
	unavailableReason string,
) ([]models.AssessmentCompetencyScore, bool, string) {
	if unavailableReason != "" {
		return []models.AssessmentCompetencyScore{}, false, unavailableReason
	}
	if !setup.HasAssignment || !setup.HasActiveTemplate || setup.RecalculationRequired || len(setup.Mappings) == 0 {
		return []models.AssessmentCompetencyScore{}, false, "course_scoring_unavailable"
	}

	bestByCourse := bestAssessmentCourseAttempts(evidence)
	competencies := make(map[uint64]*models.AssessmentCompetencyScore)
	for _, mapping := range setup.Mappings {
		if _, exists := competencies[mapping.CompetencyID]; !exists {
			competencies[mapping.CompetencyID] = &models.AssessmentCompetencyScore{
				CompetencyID:     mapping.CompetencyID,
				CompetencyCode:   mapping.CompetencyCode,
				CompetencyNameTH: mapping.CompetencyNameTH,
				CompetencyNameEN: mapping.CompetencyNameEN,
				CourseScores:     make([]models.AssessmentCourseScore, 0),
			}
		}
	}

	for _, mapping := range setup.Mappings {
		attempt, hasAttempt := bestByCourse[mapping.CourseID]
		if !hasAttempt {
			continue
		}
		evaluation := grading.Evaluate(attempt.GradeScheme, attempt.Grade)
		if !evaluation.Recognized || !evaluation.HasScore {
			continue
		}
		weightedScore := roundAssessmentScore(evaluation.Score * mapping.Weight / 100)
		competency := competencies[mapping.CompetencyID]
		competency.HasEvidence = true
		if mapping.ScoreType == "core" {
			competency.CoreScore = roundAssessmentScore(competency.CoreScore + weightedScore)
		} else {
			competency.BonusScore = roundAssessmentScore(competency.BonusScore + weightedScore)
		}
		competency.CourseScores = append(competency.CourseScores, models.AssessmentCourseScore{
			EvidenceRef:       "score:" + assessmentCourseEvidenceRef(attempt.Source, attempt.RecordID) + ":competency:" + assessmentUintString(mapping.CompetencyID),
			CourseEvidenceRef: assessmentCourseEvidenceRef(attempt.Source, attempt.RecordID),
			Source:            attempt.Source,
			CourseID:          attempt.CourseID,
			CourseCode:        attempt.CourseCode,
			CourseNameTH:      attempt.CourseNameTH,
			CourseNameEN:      attempt.CourseNameEN,
			AcademicYearBE:    attempt.AcademicYear,
			Semester:          attempt.Semester,
			Grade:             strings.ToUpper(strings.TrimSpace(attempt.Grade)),
			RawScore:          evaluation.Score,
			Weight:            mapping.Weight,
			WeightedScore:     weightedScore,
			ScoreType:         mapping.ScoreType,
		})
	}

	result := make([]models.AssessmentCompetencyScore, 0, len(competencies))
	for _, competency := range competencies {
		sort.Slice(competency.CourseScores, func(i, j int) bool {
			left, right := competency.CourseScores[i], competency.CourseScores[j]
			if left.AcademicYearBE != right.AcademicYearBE {
				return left.AcademicYearBE < right.AcademicYearBE
			}
			if left.Semester != right.Semester {
				return left.Semester < right.Semester
			}
			if left.CourseID != right.CourseID {
				return left.CourseID < right.CourseID
			}
			return left.EvidenceRef < right.EvidenceRef
		})
		result = append(result, *competency)
	}
	sort.Slice(result, func(i, j int) bool { return result[i].CompetencyID < result[j].CompetencyID })
	for _, competency := range result {
		if competency.HasEvidence {
			return result, true, ""
		}
	}
	return result, false, "no_mapped_course_grades_before_target"
}

func bestAssessmentCourseAttempts(evidence []models.AssessmentAcademicEvidence) map[uint64]models.AssessmentAcademicEvidence {
	best := make(map[uint64]models.AssessmentAcademicEvidence)
	for _, candidate := range evidence {
		if candidate.Source != "curriculum" || candidate.CourseID == 0 {
			continue
		}
		current, exists := best[candidate.CourseID]
		if !exists || isBetterAssessmentCourseAttempt(candidate, current) {
			best[candidate.CourseID] = candidate
		}
	}
	return best
}

func isBetterAssessmentCourseAttempt(candidate, current models.AssessmentAcademicEvidence) bool {
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
	if candidate.AcademicYear != current.AcademicYear {
		return candidate.AcademicYear > current.AcademicYear
	}
	if candidate.Semester != current.Semester {
		return candidate.Semester > current.Semester
	}
	return candidate.RecordID > current.RecordID
}

func roundAssessmentScore(value float64) float64 {
	return math.Round(value*100) / 100
}

func assessmentUintString(value uint64) string {
	return strconv.FormatUint(value, 10)
}
