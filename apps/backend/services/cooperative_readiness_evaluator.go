package services

import (
	"math"
	"strings"

	"github.com/spw32767/university-competency-system-backend/academicgrading"
	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
)

const (
	CooperativeReadinessNotConfigured = "not_configured"
	CooperativeReadinessReady         = "ready"
	CooperativeReadinessNotReady      = "not_ready"
	CooperativeCriterionMet           = "met"
	CooperativeCriterionNotMet        = "not_met"
	CooperativeCriterionMissing       = "missing"
)

type cooperativeCourseIdentity struct {
	source   string
	courseID uint64
}

func evaluateCooperativeReadiness(
	set *models.CooperativeRequirementSet,
	curriculumCategories []*models.CourseCategoryNode,
	learner repositories.CooperativeLearnerContext,
	semester uint,
	records []repositories.CooperativeAcademicRecord,
) models.CooperativeReadinessResult {
	targetYear := learner.EntryYearBE + 3
	result := models.CooperativeReadinessResult{
		CurriculumID:   learner.CurriculumID,
		EntryYearBE:    learner.EntryYearBE,
		TargetYearBE:   targetYear,
		TargetSemester: semester,
		Results:        make([]models.CooperativeRequirementResult, 0),
		Status:         CooperativeReadinessNotConfigured,
	}
	if set == nil || len(set.Requirements) == 0 {
		return result
	}

	result.RequirementSetID = set.RequirementSetID
	result.Revision = set.Revision
	result.RequirementCount = len(set.Requirements)
	cutoffRecords := recordsBeforeTarget(records, targetYear, semester)
	categoryScope := buildCooperativeCurriculumScope(curriculumCategories)
	categorySubtrees := buildCategorySubtrees(curriculumCategories)
	for _, requirement := range set.Requirements {
		item := evaluateCooperativeRequirement(requirement, cutoffRecords, categoryScope, categorySubtrees)
		result.Results = append(result.Results, item)
		if item.Status == CooperativeCriterionMet {
			result.PassedCount++
		}
	}
	result.Status = CooperativeReadinessReady
	if result.PassedCount != result.RequirementCount {
		result.Status = CooperativeReadinessNotReady
	}
	return result
}

func recordsBeforeTarget(records []repositories.CooperativeAcademicRecord, targetYear uint64, targetSemester uint) []repositories.CooperativeAcademicRecord {
	filtered := make([]repositories.CooperativeAcademicRecord, 0, len(records))
	for _, record := range records {
		if record.AcademicYear < targetYear || (record.AcademicYear == targetYear && record.Semester < uint64(targetSemester)) {
			filtered = append(filtered, record)
		}
	}
	return filtered
}

func evaluateCooperativeRequirement(
	requirement models.CooperativeRequirement,
	records []repositories.CooperativeAcademicRecord,
	scope cooperativeCurriculumScope,
	categorySubtrees map[uint64]map[uint64]struct{},
) models.CooperativeRequirementResult {
	result := models.CooperativeRequirementResult{
		RequirementID: requirement.RequirementID,
		CriterionType: requirement.CriterionType,
		NameTH:        requirement.NameTH,
		NameEN:        requirement.NameEN,
		Status:        CooperativeCriterionMissing,
		RequiredValue: requirement.MinimumValue,
		RequiredGrade: requirement.MinimumGrade,
	}

	switch requirement.CriterionType {
	case models.CoopCriterionOverallGPA:
		value, ok := calculateCooperativeGPA(records, nil)
		setNumericCriterionResult(&result, value, ok, requirement.MinimumValue)
	case models.CoopCriterionCategoryGPA:
		categoryIDs := categorySubtrees[valueOrZeroUint(requirement.CategoryID)]
		setCategoryName(&result, scope.categories[valueOrZeroUint(requirement.CategoryID)])
		value, ok := calculateCooperativeGPA(records, categoryIDs)
		setNumericCriterionResult(&result, value, ok, requirement.MinimumValue)
	case models.CoopCriterionCourseGrade:
		course := scope.courses[valueOrZeroUint(requirement.CourseID)]
		result.CourseNameTH = cooperativeStringPointer(course.NameTH)
		result.CourseNameEN = cooperativeCloneStringPointer(course.NameEN)
		best, ok := bestCooperativeCourseRecords(records, func(record repositories.CooperativeAcademicRecord) bool {
			return record.Source == "curriculum" && record.CourseID == valueOrZeroUint(requirement.CourseID)
		})
		if !ok {
			return result
		}
		grade := strings.ToUpper(strings.TrimSpace(best.Grade))
		result.CurrentGrade = &grade
		result.Status = CooperativeCriterionNotMet
		if cooperativeGradeRank(best.GradeScheme, grade) >= cooperativeGradeRank(best.GradeScheme, cooperativeStringValue(requirement.MinimumGrade)) {
			result.Status = CooperativeCriterionMet
		}
	case models.CoopCriterionCategoryCredits:
		categoryID := valueOrZeroUint(requirement.CategoryID)
		setCategoryName(&result, scope.categories[categoryID])
		credits := calculatePassedCredits(records, categorySubtrees[categoryID])
		setNumericCriterionResult(&result, float64(credits), true, requirement.MinimumValue)
	case models.CoopCriterionFreeElectiveCredit:
		credits := calculatePassedCredits(records, nil, "free_elective")
		setNumericCriterionResult(&result, float64(credits), true, requirement.MinimumValue)
	}
	return result
}

func setNumericCriterionResult(result *models.CooperativeRequirementResult, value float64, available bool, minimum *float64) {
	if !available {
		result.Status = CooperativeCriterionMissing
		return
	}
	if result.CriterionType == models.CoopCriterionOverallGPA || result.CriterionType == models.CoopCriterionCategoryGPA {
		value = roundCooperativeGPA(value)
	}
	result.CurrentValue = &value
	result.Status = CooperativeCriterionNotMet
	if minimum != nil && value >= *minimum {
		result.Status = CooperativeCriterionMet
	}
}

func calculateCooperativeGPA(records []repositories.CooperativeAcademicRecord, categoryIDs map[uint64]struct{}) (float64, bool) {
	best := make(map[cooperativeCourseIdentity]repositories.CooperativeAcademicRecord)
	for _, record := range records {
		if categoryIDs != nil && !recordInCategoryScope(record, categoryIDs) {
			continue
		}
		if _, counts := academicgrading.GradePoint(record.GradeScheme, record.Grade); !counts {
			continue
		}
		identity := cooperativeIdentity(record)
		previous, exists := best[identity]
		if !exists || gradePointFor(record) > gradePointFor(previous) || (gradePointFor(record) == gradePointFor(previous) && laterAcademicAttempt(record, previous)) {
			best[identity] = record
		}
	}

	gradePoints := 0.0
	gpaCredits := 0
	for _, record := range best {
		points, _ := academicgrading.GradePoint(record.GradeScheme, record.Grade)
		credits := max(record.Credits, 0)
		gradePoints += points * float64(credits)
		gpaCredits += credits
	}
	if gpaCredits == 0 {
		return 0, false
	}
	return gradePoints / float64(gpaCredits), true
}

func calculatePassedCredits(records []repositories.CooperativeAcademicRecord, categoryIDs map[uint64]struct{}, sources ...string) int {
	best := bestCooperativeCourseRecordsBySource(records, categoryIDs, sources...)
	credits := 0
	for _, record := range best {
		if academicgrading.IsPassed(record.GradeScheme, record.Grade) {
			credits += max(record.Credits, 0)
		}
	}
	return credits
}

func bestCooperativeCourseRecordsBySource(records []repositories.CooperativeAcademicRecord, categoryIDs map[uint64]struct{}, sources ...string) map[cooperativeCourseIdentity]repositories.CooperativeAcademicRecord {
	allowedSources := make(map[string]struct{}, len(sources))
	for _, source := range sources {
		allowedSources[source] = struct{}{}
	}
	best := make(map[cooperativeCourseIdentity]repositories.CooperativeAcademicRecord)
	for _, record := range records {
		if strings.TrimSpace(record.Grade) == "" || (categoryIDs != nil && !recordInCategoryScope(record, categoryIDs)) {
			continue
		}
		if len(allowedSources) > 0 {
			if _, allowed := allowedSources[record.Source]; !allowed {
				continue
			}
		}
		identity := cooperativeIdentity(record)
		previous, exists := best[identity]
		if !exists || cooperativeGradeRank(record.GradeScheme, record.Grade) > cooperativeGradeRank(previous.GradeScheme, previous.Grade) ||
			(cooperativeGradeRank(record.GradeScheme, record.Grade) == cooperativeGradeRank(previous.GradeScheme, previous.Grade) && laterAcademicAttempt(record, previous)) {
			best[identity] = record
		}
	}
	return best
}

func bestCooperativeCourseRecords(records []repositories.CooperativeAcademicRecord, include func(repositories.CooperativeAcademicRecord) bool) (repositories.CooperativeAcademicRecord, bool) {
	var best repositories.CooperativeAcademicRecord
	found := false
	for _, record := range records {
		if !include(record) || strings.TrimSpace(record.Grade) == "" {
			continue
		}
		if !found || cooperativeGradeRank(record.GradeScheme, record.Grade) > cooperativeGradeRank(best.GradeScheme, best.Grade) ||
			(cooperativeGradeRank(record.GradeScheme, record.Grade) == cooperativeGradeRank(best.GradeScheme, best.Grade) && laterAcademicAttempt(record, best)) {
			best = record
			found = true
		}
	}
	return best, found
}

func cooperativeIdentity(record repositories.CooperativeAcademicRecord) cooperativeCourseIdentity {
	courseID := record.CourseID
	if courseID == 0 {
		courseID = record.RecordID
	}
	return cooperativeCourseIdentity{source: record.Source, courseID: courseID}
}

func gradePointFor(record repositories.CooperativeAcademicRecord) float64 {
	value, _ := academicgrading.GradePoint(record.GradeScheme, record.Grade)
	return value
}

func cooperativeGradeRank(gradeScheme, grade string) float64 {
	normalized := strings.ToUpper(strings.TrimSpace(grade))
	if strings.EqualFold(strings.TrimSpace(gradeScheme), "satisfactory") {
		if normalized == "S" {
			return 1
		}
		return -1
	}
	if points, ok := academicgrading.GradePoint(gradeScheme, normalized); ok {
		return points
	}
	return -1
}

func laterAcademicAttempt(candidate, current repositories.CooperativeAcademicRecord) bool {
	if candidate.AcademicYear != current.AcademicYear {
		return candidate.AcademicYear > current.AcademicYear
	}
	if candidate.Semester != current.Semester {
		return candidate.Semester > current.Semester
	}
	return candidate.RecordID > current.RecordID
}

func recordInCategoryScope(record repositories.CooperativeAcademicRecord, categoryIDs map[uint64]struct{}) bool {
	for _, categoryID := range record.CategoryIDs {
		if _, matches := categoryIDs[categoryID]; matches {
			return true
		}
	}
	return false
}

func buildCategorySubtrees(nodes []*models.CourseCategoryNode) map[uint64]map[uint64]struct{} {
	result := make(map[uint64]map[uint64]struct{})
	var collect func(*models.CourseCategoryNode) map[uint64]struct{}
	collect = func(node *models.CourseCategoryNode) map[uint64]struct{} {
		ids := make(map[uint64]struct{})
		if node == nil || !node.IsActive || node.DeletedAt != nil {
			return ids
		}
		ids[node.CategoryID] = struct{}{}
		for _, child := range node.Children {
			for id := range collect(child) {
				ids[id] = struct{}{}
			}
		}
		result[node.CategoryID] = ids
		return ids
	}
	for _, node := range nodes {
		collect(node)
	}
	return result
}

func setCategoryName(result *models.CooperativeRequirementResult, category *models.CourseCategoryNode) {
	if category == nil {
		return
	}
	result.CategoryNameTH = cooperativeStringPointer(category.NameTH)
	result.CategoryNameEN = cooperativeCloneStringPointer(category.NameEN)
}

func cooperativeStringPointer(value string) *string {
	return &value
}

func cooperativeCloneStringPointer(value *string) *string {
	if value == nil {
		return nil
	}
	copy := *value
	return &copy
}

func cooperativeStringValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func roundCooperativeGPA(value float64) float64 {
	return math.Round(value*100) / 100
}
