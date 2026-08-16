package models

import "time"

type CohortCompetencyRequirement struct {
	CompetencyID   uint64  `json:"competency_id"`
	CompetencyCode string  `json:"competency_code"`
	CompetencyName string  `json:"competency_name"`
	TargetScore    float64 `json:"target_score"`
	IsRequired     bool    `json:"is_required"`
	DisplayOrder   int     `json:"display_order"`
	CoreWeight     float64 `json:"core_weight"`
	BonusWeight    float64 `json:"bonus_weight"`
}

type ReplaceCohortCompetencyRequirementsRequest struct {
	Requirements []CohortCompetencyRequirementInput `json:"requirements"`
}

type CohortCompetencyRequirementInput struct {
	CompetencyID uint64  `json:"competency_id"`
	TargetScore  float64 `json:"target_score"`
	IsRequired   bool    `json:"is_required"`
}

type CourseCompetencyScoreWarning struct {
	Code        string `json:"code"`
	Message     string `json:"message"`
	StudentCode string `json:"student_code,omitempty"`
	CourseCode  string `json:"course_code,omitempty"`
}

type CourseCompetencyRecalculationResult struct {
	CohortID           uint64                         `json:"cohort_id"`
	CalculatedStudents int                            `json:"calculated_students"`
	CourseScores       int                            `json:"course_scores"`
	Warnings           []CourseCompetencyScoreWarning `json:"warnings"`
	CalculatedAt       time.Time                      `json:"calculated_at"`
}

type CohortLearnerCompetencySummary struct {
	EnrollmentID      uint64  `json:"enrollment_id"`
	StudentCode       string  `json:"student_code"`
	StudentNameTH     string  `json:"student_name_th"`
	CompetencyID      uint64  `json:"competency_id"`
	CompetencyCode    string  `json:"competency_code"`
	CompetencyName    string  `json:"competency_name"`
	TargetScore       float64 `json:"target_score"`
	CoreScore         float64 `json:"core_score"`
	CourseBonusScore  float64 `json:"course_bonus_score"`
	CourseTotalScore  float64 `json:"course_total_score"`
	ActivityScore     float64 `json:"activity_score"`
	AccumulatedScore  float64 `json:"accumulated_score"`
	PassedRequirement bool    `json:"passed_requirement"`
}
