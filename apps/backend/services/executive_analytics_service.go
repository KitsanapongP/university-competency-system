package services

import (
	"context"
	"errors"
	"sort"

	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
	"github.com/spw32767/university-competency-system-backend/utils"
)

var ErrExecutiveForbidden = errors.New("insufficient executive analytics scope")
var ErrExecutiveComparisonCohortsMustDiffer = errors.New("comparison cohorts must be different")
var ErrExecutiveComparisonCohortNotFound = errors.New("comparison cohort not found in executive scope")

type ExecutiveAnalyticsService struct {
	Repo *repositories.ExecutiveAnalyticsRepository
}

func NewExecutiveAnalyticsService(repo *repositories.ExecutiveAnalyticsRepository) *ExecutiveAnalyticsService {
	return &ExecutiveAnalyticsService{Repo: repo}
}

func executiveHasRole(claims *utils.Claims, role string) bool {
	for _, item := range claims.Roles {
		if item == role {
			return true
		}
	}
	return false
}

func executiveScopeOptionFilters(f models.ExecutiveAnalyticsFilters) models.ExecutiveAnalyticsFilters {
	f.CohortID = nil
	return f
}

func (s *ExecutiveAnalyticsService) scopedFilters(claims *utils.Claims, f models.ExecutiveAnalyticsFilters) (models.ExecutiveAnalyticsFilters, error) {
	if executiveHasRole(claims, "admin") {
		return f, nil
	}
	if !executiveHasRole(claims, "dean") || claims.FacultyID == nil || *claims.FacultyID <= 0 {
		return f, ErrExecutiveForbidden
	}
	scoped := uint64(*claims.FacultyID)
	if f.FacultyID != nil && *f.FacultyID != scoped {
		return f, ErrExecutiveForbidden
	}
	f.FacultyID = &scoped
	return f, nil
}

func (s *ExecutiveAnalyticsService) Scope(ctx context.Context, claims *utils.Claims, f models.ExecutiveAnalyticsFilters) (*models.ExecutiveScopeResponse, error) {
	f, err := s.scopedFilters(claims, f)
	if err != nil {
		return nil, err
	}
	faculties, err := s.Repo.GetFaculties(ctx, f.FacultyID)
	if err != nil {
		return nil, err
	}
	majors, err := s.Repo.GetMajors(ctx, f.FacultyID)
	if err != nil {
		return nil, err
	}
	curricula, err := s.Repo.GetCurricula(ctx, f)
	if err != nil {
		return nil, err
	}
	cohortSummaries, err := s.Repo.GetCohortSummaries(ctx, executiveScopeOptionFilters(f))
	if err != nil {
		return nil, err
	}
	cohorts := make([]models.ExecutiveCohortOption, 0, len(cohortSummaries))
	years := make([]uint64, 0, len(cohortSummaries))
	seen := map[uint64]bool{}
	for _, item := range cohortSummaries {
		cohorts = append(cohorts, models.ExecutiveCohortOption{
			CohortID:           item.CohortID,
			CurriculumID:       item.CurriculumID,
			Code:               item.CurriculumCode,
			NameTH:             item.CurriculumNameTH,
			NameEN:             item.CurriculumNameEN,
			EntryYearBE:        item.EntryYearBE,
			FacultyID:          item.FacultyID,
			MajorID:            item.MajorID,
			MajorNameTH:        item.MajorNameTH,
			Ready:              item.Ready,
			ReadinessCode:      item.ReadinessCode,
			ReadinessMessageTH: item.ReadinessMessageTH,
			ReadinessMessageEN: item.ReadinessMessageEN,
		})
		if !seen[item.EntryYearBE] {
			seen[item.EntryYearBE] = true
			years = append(years, item.EntryYearBE)
		}
	}
	sort.Slice(years, func(i, j int) bool { return years[i] > years[j] })
	return &models.ExecutiveScopeResponse{Faculties: faculties, Majors: majors, Curricula: curricula, Cohorts: cohorts, EntryYears: years}, nil
}

func (s *ExecutiveAnalyticsService) Overview(ctx context.Context, claims *utils.Claims, f models.ExecutiveAnalyticsFilters) (*models.ExecutiveOverviewResponse, error) {
	f, err := s.scopedFilters(claims, f)
	if err != nil {
		return nil, err
	}
	cohorts, err := s.Repo.GetCohortSummaries(ctx, f)
	if err != nil {
		return nil, err
	}
	readyIDs := readyCohortIDs(cohorts)
	aggregates, err := s.Repo.GetAggregates(ctx, readyIDs)
	if err != nil {
		return nil, err
	}
	competencies := summarizeCompetencies(aggregates)
	attention := make([]models.ExecutiveCompetencySummary, 0)
	for _, item := range competencies {
		if item.IsRequired && item.EvaluatedCount > 0 {
			attention = append(attention, item)
		}
	}
	sort.SliceStable(attention, func(i, j int) bool {
		if attention[i].PassRate == attention[j].PassRate {
			return attention[i].NameTH < attention[j].NameTH
		}
		return attention[i].PassRate < attention[j].PassRate
	})
	if len(attention) > 5 {
		attention = attention[:5]
	}

	facts, err := s.Repo.GetStudentFacts(ctx, f)
	if err != nil {
		return nil, err
	}
	students := aggregateStudents(facts)
	evaluated, atTarget := 0, 0
	for _, item := range students {
		if item.EvaluatedCount > 0 {
			evaluated++
		}
		if item.Passed {
			atTarget++
		}
	}
	metrics := map[string]any{
		"students":           len(students),
		"cohorts":            len(cohorts),
		"ready_cohorts":      len(readyIDs),
		"not_ready_cohorts":  len(cohorts) - len(readyIDs),
		"students_evaluated": evaluated,
		"students_at_target": atTarget,
	}
	return &models.ExecutiveOverviewResponse{Metrics: metrics, Cohorts: cohorts, Competencies: competencies, Attention: attention}, nil
}

func summarizeCompetencies(items []models.ExecutiveCompetencyAggregate) []models.ExecutiveCompetencySummary {
	type total struct {
		item        models.ExecutiveCompetencySummary
		score       float64
		evaluated   int
		passed      int
		target      float64
		targetCount int
		required    bool
	}
	by := map[uint64]*total{}
	for _, row := range items {
		current := by[row.CompetencyID]
		if current == nil {
			current = &total{item: models.ExecutiveCompetencySummary{
				CompetencyID: row.CompetencyID,
				Code:         row.Code,
				NameTH:       row.NameTH,
				NameEN:       row.NameEN,
			}}
			by[row.CompetencyID] = current
		}
		current.score += row.AverageScore * float64(row.EvaluatedCount)
		current.evaluated += row.EvaluatedCount
		current.passed += row.PassedCount
		current.target += row.TargetScore
		current.targetCount++
		current.required = current.required || row.IsRequired
	}
	result := make([]models.ExecutiveCompetencySummary, 0, len(by))
	for _, current := range by {
		current.item.IsRequired = current.required
		current.item.EvaluatedCount = current.evaluated
		current.item.PassedCount = current.passed
		if current.evaluated > 0 {
			current.item.AverageScore = current.score / float64(current.evaluated)
			current.item.PassRate = float64(current.passed) * 100 / float64(current.evaluated)
		}
		if current.targetCount > 0 {
			current.item.TargetScore = current.target / float64(current.targetCount)
		}
		result = append(result, current.item)
	}
	sort.Slice(result, func(i, j int) bool { return result[i].NameTH < result[j].NameTH })
	return result
}

func aggregateStudents(facts []models.ExecutiveStudentFact) []models.ExecutiveStudentSummary {
	type state struct {
		item      models.ExecutiveStudentSummary
		required  map[uint64]bool
		evaluated map[uint64]bool
		passed    map[uint64]bool
		scores    []float64
		targets   []float64
	}
	by := map[uint64]*state{}
	for _, fact := range facts {
		current := by[fact.EnrollmentID]
		if current == nil {
			current = &state{
				item: models.ExecutiveStudentSummary{
					EnrollmentID: fact.EnrollmentID, StudentCode: fact.StudentCode,
					StudentNameTH: fact.StudentNameTH, StudentNameEN: fact.StudentNameEN,
					CohortID: fact.CohortID, CurriculumCode: fact.CurriculumCode,
					CurriculumNameTH: fact.CurriculumNameTH, EntryYearBE: fact.EntryYearBE,
				},
				required: map[uint64]bool{}, evaluated: map[uint64]bool{}, passed: map[uint64]bool{},
			}
			by[fact.EnrollmentID] = current
		}
		if fact.CompetencyID == 0 {
			continue
		}
		if fact.IsRequired {
			current.required[fact.CompetencyID] = true
		}
		if fact.HasScore {
			current.evaluated[fact.CompetencyID] = true
			current.scores = append(current.scores, fact.CourseTotal)
			if fact.IsRequired && fact.CourseTotal >= fact.TargetScore {
				current.passed[fact.CompetencyID] = true
			}
		}
		if fact.TargetScore > 0 {
			current.targets = append(current.targets, fact.TargetScore)
		}
	}
	result := make([]models.ExecutiveStudentSummary, 0, len(by))
	for _, current := range by {
		current.item.RequiredCount = len(current.required)
		current.item.EvaluatedCount = len(current.evaluated)
		current.item.PassedRequiredCount = len(current.passed)
		for _, score := range current.scores {
			current.item.CourseTotalScore += score
		}
		if len(current.scores) > 0 {
			current.item.CourseTotalScore /= float64(len(current.scores))
		}
		for _, target := range current.targets {
			current.item.TargetScore += target
		}
		if len(current.targets) > 0 {
			current.item.TargetScore /= float64(len(current.targets))
		}
		current.item.Ready = current.item.EvaluatedCount > 0
		current.item.Passed = current.item.RequiredCount > 0 && current.item.PassedRequiredCount == current.item.RequiredCount
		result = append(result, current.item)
	}
	sort.Slice(result, func(i, j int) bool { return result[i].StudentCode < result[j].StudentCode })
	return result
}

func readyCohortIDs(items []models.ExecutiveCohortSummary) []uint64 {
	result := make([]uint64, 0)
	for _, item := range items {
		if item.Ready {
			result = append(result, item.CohortID)
		}
	}
	return result
}

func (s *ExecutiveAnalyticsService) CompetencyDetail(ctx context.Context, claims *utils.Claims, f models.ExecutiveAnalyticsFilters, competencyID uint64) (*models.ExecutiveCompetencyDetailResponse, error) {
	f, err := s.scopedFilters(claims, f)
	if err != nil {
		return nil, err
	}
	cohorts, err := s.Repo.GetCohortSummaries(ctx, f)
	if err != nil {
		return nil, err
	}
	ids := readyCohortIDs(cohorts)
	aggregates, err := s.Repo.GetAggregates(ctx, ids)
	if err != nil {
		return nil, err
	}
	summaries := summarizeCompetencies(aggregates)
	var competency models.ExecutiveCompetencySummary
	for _, item := range summaries {
		if item.CompetencyID == competencyID {
			competency = item
			break
		}
	}
	sources, err := s.Repo.GetCourseSources(ctx, ids, competencyID, nil)
	if err != nil {
		return nil, err
	}
	filtered := make([]models.ExecutiveCompetencyAggregate, 0)
	for _, item := range aggregates {
		if item.CompetencyID == competencyID {
			filtered = append(filtered, item)
		}
	}
	return &models.ExecutiveCompetencyDetailResponse{Competency: competency, Cohorts: filtered, Sources: sources}, nil
}

func (s *ExecutiveAnalyticsService) Students(ctx context.Context, claims *utils.Claims, f models.ExecutiveAnalyticsFilters) ([]models.ExecutiveStudentSummary, error) {
	f, err := s.scopedFilters(claims, f)
	if err != nil {
		return nil, err
	}
	facts, err := s.Repo.GetStudentFacts(ctx, f)
	if err != nil {
		return nil, err
	}
	return aggregateStudents(facts), nil
}

func (s *ExecutiveAnalyticsService) StudentDetail(ctx context.Context, claims *utils.Claims, f models.ExecutiveAnalyticsFilters, enrollmentID uint64) (*models.ExecutiveStudentDetail, error) {
	f, err := s.scopedFilters(claims, f)
	if err != nil {
		return nil, err
	}
	f.EnrollmentID = &enrollmentID
	f.CompetencyID = nil
	facts, err := s.Repo.GetStudentFacts(ctx, f)
	if err != nil {
		return nil, err
	}
	students := aggregateStudents(facts)
	if len(students) == 0 {
		return nil, errors.New("student not found in executive scope")
	}
	seen := map[uint64]bool{}
	competencies := make([]models.ExecutiveStudentCompetency, 0)
	for _, fact := range facts {
		if fact.CompetencyID == 0 {
			continue
		}
		if !seen[fact.CompetencyID] {
			seen[fact.CompetencyID] = true
			competencies = append(competencies, models.ExecutiveStudentCompetency{
				CompetencyID: fact.CompetencyID, Code: fact.CompetencyCode,
				NameTH: fact.CompetencyNameTH, NameEN: fact.CompetencyNameEN,
				TargetScore: fact.TargetScore, IsRequired: fact.IsRequired,
				CourseTotal: fact.CourseTotal, Passed: fact.HasScore && fact.CourseTotal >= fact.TargetScore,
				HasScore: fact.HasScore,
			})
		}
	}
	courses, err := s.Repo.GetStudentCourses(ctx, facts[0].CohortID, enrollmentID)
	if err != nil {
		return nil, err
	}
	return &models.ExecutiveStudentDetail{Student: students[0], Competencies: competencies, Courses: courses}, nil
}

func (s *ExecutiveAnalyticsService) Comparison(ctx context.Context, claims *utils.Claims, leftCohortID, rightCohortID uint64) (*models.ExecutiveComparisonResponse, error) {
	if leftCohortID == rightCohortID {
		return nil, ErrExecutiveComparisonCohortsMustDiffer
	}

	left, err := s.comparisonCohort(ctx, claims, leftCohortID)
	if err != nil {
		return nil, err
	}
	right, err := s.comparisonCohort(ctx, claims, rightCohortID)
	if err != nil {
		return nil, err
	}

	response := buildComparisonResponse(*left, *right, nil)
	if !left.Ready || !right.Ready {
		return response, nil
	}

	aggregates, err := s.Repo.GetAggregates(ctx, []uint64{leftCohortID, rightCohortID})
	if err != nil {
		return nil, err
	}
	return buildComparisonResponse(*left, *right, aggregates), nil
}

func buildComparisonResponse(left, right models.ExecutiveCohortSummary, aggregates []models.ExecutiveCompetencyAggregate) *models.ExecutiveComparisonResponse {
	response := &models.ExecutiveComparisonResponse{
		Left: models.ExecutiveComparisonSide{
			Cohort:       left,
			Competencies: []models.ExecutiveCompetencyAggregate{},
		},
		Right: models.ExecutiveComparisonSide{
			Cohort:       right,
			Competencies: []models.ExecutiveCompetencyAggregate{},
		},
	}
	if !left.Ready || !right.Ready {
		return response
	}
	for _, item := range aggregates {
		switch item.CohortID {
		case left.CohortID:
			response.Left.Competencies = append(response.Left.Competencies, item)
		case right.CohortID:
			response.Right.Competencies = append(response.Right.Competencies, item)
		}
	}
	return response
}

func (s *ExecutiveAnalyticsService) comparisonCohort(ctx context.Context, claims *utils.Claims, cohortID uint64) (*models.ExecutiveCohortSummary, error) {
	filters := models.ExecutiveAnalyticsFilters{CohortID: &cohortID}
	filters, err := s.scopedFilters(claims, filters)
	if err != nil {
		return nil, err
	}
	cohorts, err := s.Repo.GetCohortSummaries(ctx, filters)
	if err != nil {
		return nil, err
	}
	if len(cohorts) != 1 {
		return nil, ErrExecutiveComparisonCohortNotFound
	}
	return &cohorts[0], nil
}
