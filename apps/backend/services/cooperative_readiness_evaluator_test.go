package services

import (
	"testing"

	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
)

func TestReadinessUsesOnlyRecordsBeforeTargetAndBestRetake(t *testing.T) {
	minimum := 1.5
	set := &models.CooperativeRequirementSet{
		RequirementSetID: 4,
		Revision:         2,
		Requirements: []models.CooperativeRequirement{{
			RequirementID: 7,
			CriterionType: models.CoopCriterionOverallGPA,
			NameTH:        "GPA รวม",
			MinimumValue:  &minimum,
		}},
	}
	learner := repositories.CooperativeLearnerContext{CurriculumID: 20, EntryYearBE: 2566}
	records := []repositories.CooperativeAcademicRecord{
		{RecordID: 1, CourseID: 30, Source: "curriculum", AcademicYear: 2568, Semester: 1, Credits: 3, GradeScheme: "letter", Grade: "D+"},
		{RecordID: 2, CourseID: 30, Source: "curriculum", AcademicYear: 2569, Semester: 2, Credits: 3, GradeScheme: "letter", Grade: "A"},
		{RecordID: 3, CourseID: 31, Source: "curriculum", AcademicYear: 2568, Semester: 2, Credits: 3, GradeScheme: "letter", Grade: "B"},
	}

	result := evaluateCooperativeReadiness(set, nil, learner, 2, records)
	if result.TargetYearBE != 2569 || result.Status != CooperativeReadinessReady {
		t.Fatalf("assessment target/status = %d/%s, want 2569/ready", result.TargetYearBE, result.Status)
	}
	if got := *result.Results[0].CurrentValue; got != 2.25 {
		t.Fatalf("overall GPA = %.2f, want 2.25 (exclude target term and use D+ before cutoff)", got)
	}
}

func TestReadinessIncludesSummerBeforeFirstTargetSemester(t *testing.T) {
	minimum := 3.0
	set := &models.CooperativeRequirementSet{Requirements: []models.CooperativeRequirement{{
		CriterionType: models.CoopCriterionOverallGPA,
		NameTH:        "GPA รวม",
		MinimumValue:  &minimum,
	}}}
	learner := repositories.CooperativeLearnerContext{CurriculumID: 20, EntryYearBE: 2566}
	records := []repositories.CooperativeAcademicRecord{
		{RecordID: 1, CourseID: 30, Source: "curriculum", AcademicYear: 2568, Semester: 3, Credits: 3, GradeScheme: "letter", Grade: "B"},
	}

	result := evaluateCooperativeReadiness(set, nil, learner, 1, records)
	if result.Status != CooperativeReadinessReady || result.Results[0].Status != CooperativeCriterionMet {
		t.Fatalf("Summer before semester 1 was not included: %#v", result)
	}
}

func TestCategoryGPAIncludesEveryDescendant(t *testing.T) {
	minimum := 2.5
	rootID := uint64(1)
	set := &models.CooperativeRequirementSet{Requirements: []models.CooperativeRequirement{{
		CriterionType: models.CoopCriterionCategoryGPA,
		NameTH:        "GPA หมวดแม่",
		MinimumValue:  &minimum,
		CategoryID:    &rootID,
	}}}
	categories := []*models.CourseCategoryNode{{
		CategoryID: 1,
		NameTH:     "หมวดแม่",
		IsActive:   true,
		Children: []*models.CourseCategoryNode{{
			CategoryID: 2,
			NameTH:     "หมวดย่อย",
			IsActive:   true,
		}},
	}}
	learner := repositories.CooperativeLearnerContext{CurriculumID: 20, EntryYearBE: 2566}
	records := []repositories.CooperativeAcademicRecord{
		{RecordID: 1, CourseID: 30, Source: "curriculum", AcademicYear: 2568, Semester: 1, Credits: 3, GradeScheme: "letter", Grade: "B", CategoryIDs: []uint64{2}},
		{RecordID: 2, CourseID: 31, Source: "curriculum", AcademicYear: 2568, Semester: 2, Credits: 3, GradeScheme: "letter", Grade: "C", CategoryIDs: []uint64{1}},
	}

	result := evaluateCooperativeReadiness(set, categories, learner, 1, records)
	if got := *result.Results[0].CurrentValue; got != 2.5 {
		t.Fatalf("category GPA = %.2f, want 2.50 including child course", got)
	}
}

func TestCreditCriteriaCountBestPassedCourseOnceAndKeepSourcesSeparate(t *testing.T) {
	minimumCategoryCredits := 3.0
	minimumFreeCredits := 3.0
	categoryID := uint64(1)
	set := &models.CooperativeRequirementSet{Requirements: []models.CooperativeRequirement{
		{CriterionType: models.CoopCriterionCategoryCredits, NameTH: "หน่วยกิตหมวด", MinimumValue: &minimumCategoryCredits, CategoryID: &categoryID},
		{CriterionType: models.CoopCriterionFreeElectiveCredit, NameTH: "หน่วยกิตวิชาเสรี", MinimumValue: &minimumFreeCredits},
	}}
	categories := []*models.CourseCategoryNode{{CategoryID: 1, NameTH: "หมวด", IsActive: true}}
	learner := repositories.CooperativeLearnerContext{CurriculumID: 20, EntryYearBE: 2566}
	records := []repositories.CooperativeAcademicRecord{
		{RecordID: 1, CourseID: 30, Source: "curriculum", AcademicYear: 2568, Semester: 1, Credits: 3, GradeScheme: "letter", Grade: "D", CategoryIDs: []uint64{1}},
		{RecordID: 2, CourseID: 30, Source: "curriculum", AcademicYear: 2568, Semester: 2, Credits: 3, GradeScheme: "letter", Grade: "B", CategoryIDs: []uint64{1}},
		{RecordID: 3, CourseID: 40, Source: "free_elective", AcademicYear: 2568, Semester: 1, Credits: 3, GradeScheme: "satisfactory", Grade: "S"},
		{RecordID: 4, CourseID: 41, Source: "free_elective", AcademicYear: 2568, Semester: 2, Credits: 3, GradeScheme: "satisfactory", Grade: "U"},
	}

	result := evaluateCooperativeReadiness(set, categories, learner, 1, records)
	if got := *result.Results[0].CurrentValue; got != 3 {
		t.Fatalf("category credits = %.0f, want 3 without counting the retake twice", got)
	}
	if got := *result.Results[1].CurrentValue; got != 3 {
		t.Fatalf("free elective credits = %.0f, want only the passed S course", got)
	}
}

func TestReadinessKeepsNoGradeSeparateFromBelowThreshold(t *testing.T) {
	minimum := "B"
	courseID := uint64(30)
	set := &models.CooperativeRequirementSet{Requirements: []models.CooperativeRequirement{{
		RequirementID: 1,
		CriterionType: models.CoopCriterionCourseGrade,
		NameTH:        "สัมมนา",
		CourseID:      &courseID,
		MinimumGrade:  &minimum,
	}}}
	category := []*models.CourseCategoryNode{{
		CategoryID: 1,
		IsActive:   true,
		Courses:    []*models.CurriculumCourseRow{{CourseID: courseID, NameTH: "สัมมนา", IsActive: true, GradeScheme: "letter"}},
	}}
	learner := repositories.CooperativeLearnerContext{CurriculumID: 20, EntryYearBE: 2566}

	missing := evaluateCooperativeReadiness(set, category, learner, 1, nil)
	if missing.Results[0].Status != CooperativeCriterionMissing {
		t.Fatalf("empty course history status = %s, want missing", missing.Results[0].Status)
	}
	failed := evaluateCooperativeReadiness(set, category, learner, 1, []repositories.CooperativeAcademicRecord{{
		RecordID: 1, CourseID: courseID, Source: "curriculum", AcademicYear: 2568, Semester: 1, Credits: 3, GradeScheme: "letter", Grade: "C",
	}})
	if failed.Results[0].Status != CooperativeCriterionNotMet {
		t.Fatalf("grade C status = %s, want not_met", failed.Results[0].Status)
	}
}

func TestCooperativeGPARoundsBeforeComparingThreshold(t *testing.T) {
	if got := roundCooperativeGPA(2.996); got != 3.00 {
		t.Fatalf("roundCooperativeGPA(2.996) = %.2f, want 3.00", got)
	}
	minimum := 3.0
	result := models.CooperativeRequirementResult{CriterionType: models.CoopCriterionOverallGPA}
	setNumericCriterionResult(&result, 2.996, true, &minimum)
	if result.Status != CooperativeCriterionMet {
		t.Fatalf("GPA 2.996 status = %s, want met after rounding", result.Status)
	}
}

func TestReadinessEvaluatesAllFiveCriterionTypesTogether(t *testing.T) {
	minimumGPA := 3.25
	minimumCourseGrade := "D+"
	minimumCategoryCredits := 6.0
	minimumFreeElectiveCredits := 3.0
	categoryID := uint64(1)
	courseID := uint64(10)
	set := &models.CooperativeRequirementSet{
		Requirements: []models.CooperativeRequirement{
			{RequirementID: 1, CriterionType: models.CoopCriterionOverallGPA, NameTH: "GPA รวม", MinimumValue: &minimumGPA},
			{RequirementID: 2, CriterionType: models.CoopCriterionCategoryGPA, NameTH: "GPA หมวด", MinimumValue: &minimumGPA, CategoryID: &categoryID},
			{RequirementID: 3, CriterionType: models.CoopCriterionCourseGrade, NameTH: "สัมมนา", CourseID: &courseID, MinimumGrade: &minimumCourseGrade},
			{RequirementID: 4, CriterionType: models.CoopCriterionCategoryCredits, NameTH: "หน่วยกิตหมวด", MinimumValue: &minimumCategoryCredits, CategoryID: &categoryID},
			{RequirementID: 5, CriterionType: models.CoopCriterionFreeElectiveCredit, NameTH: "หน่วยกิตวิชาเสรี", MinimumValue: &minimumFreeElectiveCredits},
		},
	}
	categories := []*models.CourseCategoryNode{{
		CategoryID: 1,
		NameTH:     "หมวดวิชา",
		IsActive:   true,
		Courses: []*models.CurriculumCourseRow{
			{CourseID: 10, NameTH: "สัมมนา", Credits: 3, IsActive: true, GradeScheme: "letter"},
			{CourseID: 11, NameTH: "รายวิชา", Credits: 3, IsActive: true, GradeScheme: "letter"},
		},
	}}
	learner := repositories.CooperativeLearnerContext{CurriculumID: 20, EntryYearBE: 2566}
	records := []repositories.CooperativeAcademicRecord{
		{RecordID: 1, CourseID: 10, Source: "curriculum", AcademicYear: 2568, Semester: 1, Credits: 3, GradeScheme: "letter", Grade: "B", CategoryIDs: []uint64{1}},
		{RecordID: 2, CourseID: 11, Source: "curriculum", AcademicYear: 2568, Semester: 1, Credits: 3, GradeScheme: "letter", Grade: "A", CategoryIDs: []uint64{1}},
		{RecordID: 3, CourseID: 40, Source: "free_elective", AcademicYear: 2568, Semester: 1, Credits: 3, GradeScheme: "satisfactory", Grade: "S"},
	}

	result := evaluateCooperativeReadiness(set, categories, learner, 1, records)
	if result.Status != CooperativeReadinessReady || result.PassedCount != 5 || result.RequirementCount != 5 {
		t.Fatalf("all-five readiness = %s, passed %d/%d; want ready and 5/5", result.Status, result.PassedCount, result.RequirementCount)
	}
}

func TestSatisfactoryCourseGradeRequirementAcceptsOnlyS(t *testing.T) {
	minimumGrade := "S"
	courseID := uint64(30)
	set := &models.CooperativeRequirementSet{Requirements: []models.CooperativeRequirement{{
		RequirementID: 1,
		CriterionType: models.CoopCriterionCourseGrade,
		NameTH:        "วิชาแบบผ่าน/ไม่ผ่าน",
		CourseID:      &courseID,
		MinimumGrade:  &minimumGrade,
	}}}
	categories := []*models.CourseCategoryNode{{
		CategoryID: 1,
		IsActive:   true,
		Courses:    []*models.CurriculumCourseRow{{CourseID: courseID, NameTH: "วิชาเสรี", IsActive: true, GradeScheme: "satisfactory"}},
	}}
	learner := repositories.CooperativeLearnerContext{CurriculumID: 20, EntryYearBE: 2566}

	for _, testCase := range []struct {
		grade string
		want  string
	}{{grade: "U", want: CooperativeCriterionNotMet}, {grade: "S", want: CooperativeCriterionMet}} {
		result := evaluateCooperativeReadiness(set, categories, learner, 1, []repositories.CooperativeAcademicRecord{{
			RecordID: 1, CourseID: courseID, Source: "curriculum", AcademicYear: 2568, Semester: 1, Credits: 3, GradeScheme: "satisfactory", Grade: testCase.grade,
		}})
		if got := result.Results[0].Status; got != testCase.want {
			t.Errorf("grade %s status = %s, want %s", testCase.grade, got, testCase.want)
		}
	}
}

func TestOverallGPAIncludesLetterGradesFromFreeElectiveModule(t *testing.T) {
	minimum := 3.0
	set := &models.CooperativeRequirementSet{Requirements: []models.CooperativeRequirement{{
		CriterionType: models.CoopCriterionOverallGPA,
		NameTH:        "GPA รวม",
		MinimumValue:  &minimum,
	}}}
	learner := repositories.CooperativeLearnerContext{CurriculumID: 20, EntryYearBE: 2566}
	records := []repositories.CooperativeAcademicRecord{
		{RecordID: 1, CourseID: 10, Source: "curriculum", AcademicYear: 2568, Semester: 1, Credits: 3, GradeScheme: "letter", Grade: "C"},
		{RecordID: 2, CourseID: 40, Source: "free_elective", AcademicYear: 2568, Semester: 1, Credits: 3, GradeScheme: "letter", Grade: "A"},
	}

	result := evaluateCooperativeReadiness(set, nil, learner, 1, records)
	if got := *result.Results[0].CurrentValue; got != 3.0 {
		t.Fatalf("overall GPA = %.2f, want 3.00 including free-elective module", got)
	}
}

func TestOverallGPARemainsMissingWhenThereAreNoGradedRecords(t *testing.T) {
	minimum := 3.0
	set := &models.CooperativeRequirementSet{Requirements: []models.CooperativeRequirement{{
		CriterionType: models.CoopCriterionOverallGPA,
		NameTH:        "GPA รวม",
		MinimumValue:  &minimum,
	}}}
	learner := repositories.CooperativeLearnerContext{CurriculumID: 20, EntryYearBE: 2566}

	result := evaluateCooperativeReadiness(set, nil, learner, 1, nil)
	if result.Results[0].Status != CooperativeCriterionMissing || result.Results[0].CurrentValue != nil {
		t.Fatalf("empty GPA result = %#v, want missing with no value", result.Results[0])
	}
}
