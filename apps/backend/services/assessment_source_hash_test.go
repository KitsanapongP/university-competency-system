package services

import (
	"testing"
	"time"

	"github.com/spw32767/university-competency-system-backend/models"
)

func TestAssessmentSourceHashGolden(t *testing.T) {
	snapshot := sampleAssessmentSnapshot()
	hash, err := calculateAssessmentSourceHash(&snapshot)
	if err != nil {
		t.Fatal(err)
	}
	const want = "22a54faf7e3d5e3b1f8d16c0253e851e232d5cf103388595608362e90d7fb2b6"
	if hash != want {
		t.Fatalf("golden source hash = %s, want %s", hash, want)
	}
}

func TestAssessmentSourceHashIgnoresCaptureTimeAndSliceOrder(t *testing.T) {
	first := sampleAssessmentSnapshot()
	second := sampleAssessmentSnapshot()
	second.CapturedAt = time.Date(2030, 1, 1, 0, 0, 0, 0, time.UTC)
	second.AcademicEvidence[0], second.AcademicEvidence[1] = second.AcademicEvidence[1], second.AcademicEvidence[0]
	second.CourseScores[0].CourseScores[0], second.CourseScores[0].CourseScores[1] = second.CourseScores[0].CourseScores[1], second.CourseScores[0].CourseScores[0]
	second.ActivityEvidence[0], second.ActivityEvidence[1] = second.ActivityEvidence[1], second.ActivityEvidence[0]
	second.Availability[0], second.Availability[1] = second.Availability[1], second.Availability[0]

	firstHash := mustAssessmentSourceHash(t, first)
	secondHash := mustAssessmentSourceHash(t, second)
	if firstHash != secondHash {
		t.Fatalf("reordered equivalent snapshots should hash equally: %s != %s", firstHash, secondHash)
	}
}

func TestAssessmentSourceHashChangesForRelevantSourcesAndVersions(t *testing.T) {
	base := sampleAssessmentSnapshot()
	baseHash := mustAssessmentSourceHash(t, base)
	tests := []struct {
		name   string
		change func(*models.LearnerAssessmentSnapshot)
	}{
		{name: "new academic grade", change: func(value *models.LearnerAssessmentSnapshot) { value.AcademicEvidence[0].Grade = "A" }},
		{name: "readiness result", change: func(value *models.LearnerAssessmentSnapshot) { *value.Readiness.Results[0].CurrentValue = 3.1 }},
		{name: "activity attendance", change: func(value *models.LearnerAssessmentSnapshot) { value.ActivityEvidence[0].AttendanceStatus = "late" }},
		{name: "target semester", change: func(value *models.LearnerAssessmentSnapshot) { value.Semester = 1 }},
		{name: "prompt version", change: func(value *models.LearnerAssessmentSnapshot) { value.Metadata.PromptVersion += "-next" }},
		{name: "think mode", change: func(value *models.LearnerAssessmentSnapshot) { value.Metadata.ThinkEnabled = true }},
		{name: "model digest", change: func(value *models.LearnerAssessmentSnapshot) { value.Metadata.ModelDigest = "sha256:new-model" }},
		{name: "provider config fingerprint", change: func(value *models.LearnerAssessmentSnapshot) {
			value.Metadata.ProviderConfigFingerprint = "different-config"
		}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			changed := sampleAssessmentSnapshot()
			test.change(&changed)
			if hash := mustAssessmentSourceHash(t, changed); hash == baseHash {
				t.Fatal("relevant source change did not change hash")
			}
		})
	}
}

func TestAssessmentSourceHashIgnoresLegacyCareerAvailability(t *testing.T) {
	first := sampleAssessmentSnapshot()
	second := sampleAssessmentSnapshot()
	second.Availability = append(second.Availability, models.AssessmentSourceAvailability{
		Source: "career_paths", Available: false, Reason: "no_published_career_paths",
	})

	if mustAssessmentSourceHash(t, first) != mustAssessmentSourceHash(t, second) {
		t.Fatal("career catalogue changes must not invalidate version 1.0 reports")
	}
}

func TestAssessmentSourceMetadataFingerprintsGenerationConfig(t *testing.T) {
	budget := DefaultAssessmentContextBudget()
	first := assessmentSourceMetadata(budget, AssessmentGenerationConfig{
		ModelDigest: "sha256:model-a", KeepAlive: "5m",
	})
	second := assessmentSourceMetadata(budget, AssessmentGenerationConfig{
		ModelDigest: "sha256:model-a", KeepAlive: "5m", ThinkEnabled: true,
	})
	third := assessmentSourceMetadata(budget, AssessmentGenerationConfig{
		ModelDigest: "sha256:model-b", KeepAlive: "5m",
	})
	if len(first.ProviderConfigFingerprint) != 64 {
		t.Fatalf("config fingerprint length = %d, want 64", len(first.ProviderConfigFingerprint))
	}
	if first.ProviderConfigFingerprint == second.ProviderConfigFingerprint || first.ProviderConfigFingerprint == third.ProviderConfigFingerprint {
		t.Fatal("think mode and model digest changes must alter the provider config fingerprint")
	}
}

func TestAssessmentSourceHashNormalizesNumericPrecisionAndPreservesNull(t *testing.T) {
	first := sampleAssessmentSnapshot()
	second := sampleAssessmentSnapshot()
	first.CourseScores[0].ActivityScores[0].EarnedPercent = 5.123456
	second.CourseScores[0].ActivityScores[0].EarnedPercent = 5.123451
	if mustAssessmentSourceHash(t, first) != mustAssessmentSourceHash(t, second) {
		t.Fatal("values below canonical score precision should not change hash")
	}

	first = sampleAssessmentSnapshot()
	second = sampleAssessmentSnapshot()
	first.Readiness.Results[0].CurrentValue = nil
	*second.Readiness.Results[0].CurrentValue = 0
	if mustAssessmentSourceHash(t, first) == mustAssessmentSourceHash(t, second) {
		t.Fatal("null and numeric zero are semantically different source values")
	}
}

func TestAssessmentSnapshotCompletenessDistinguishesNonePartialAndFull(t *testing.T) {
	if got := assessmentSnapshotCompleteness(nil, nil, nil, nil); got != "none" {
		t.Fatalf("no evidence completeness = %q, want none", got)
	}

	academic := []models.AssessmentAcademicEvidence{{Grade: "B"}}
	partialAvailability := []models.AssessmentSourceAvailability{{Source: "academic_grades", Available: true}, {Source: "activity_participation", Available: false}}
	if got := assessmentSnapshotCompleteness(academic, nil, nil, partialAvailability); got != "partial" {
		t.Fatalf("partial evidence completeness = %q, want partial", got)
	}

	fullAvailability := []models.AssessmentSourceAvailability{{Source: "academic_grades", Available: true}, {Source: "activity_participation", Available: true}}
	if got := assessmentSnapshotCompleteness(academic, nil, nil, fullAvailability); got != "full" {
		t.Fatalf("full evidence completeness = %q, want full", got)
	}
}

func TestAssessmentSnapshotWithNoLearnerEvidenceIsInsufficient(t *testing.T) {
	if got := assessmentSnapshotCompleteness(nil, nil, nil, nil); got != "none" {
		t.Fatalf("empty learner evidence completeness = %q, want none", got)
	}
}

func mustAssessmentSourceHash(t *testing.T, snapshot models.LearnerAssessmentSnapshot) string {
	t.Helper()
	hash, err := calculateAssessmentSourceHash(&snapshot)
	if err != nil {
		t.Fatal(err)
	}
	return hash
}

func sampleAssessmentSnapshot() models.LearnerAssessmentSnapshot {
	currentValue := 3.00
	earned := 12.345678
	return models.LearnerAssessmentSnapshot{
		Scope: models.LearnerAssessmentScope{
			PersonID: 10, EnrollmentID: 20, EnrollmentCurriculumID: 30,
			CohortID: 40, CurriculumID: 50, FacultyID: 60, EntryYearBE: 2565, TargetYearBE: 2568,
		},
		Semester: 2, TargetYearBE: 2568, CapturedAt: time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC),
		Completeness: "partial", Metadata: assessmentSourceMetadata(DefaultAssessmentContextBudget()),
		Readiness: models.CooperativeReadinessResult{
			CurriculumID: 50, EntryYearBE: 2565, TargetYearBE: 2568, TargetSemester: 2,
			RequirementSetID: 5, Revision: 2, Status: "not_ready", PassedCount: 0, RequirementCount: 1,
			Results: []models.CooperativeRequirementResult{{RequirementID: 6, CriterionType: models.CoopCriterionOverallGPA, Status: "passed", CurrentValue: &currentValue}},
		},
		AcademicEvidence: []models.AssessmentAcademicEvidence{
			{EvidenceRef: "course:curriculum:2", RecordID: 2, CourseID: 8, Source: "curriculum", AcademicYear: 2567, Semester: 1, CourseCode: "CS02", Grade: "B", CategoryIDs: []uint64{4, 2}},
			{EvidenceRef: "course:curriculum:1", RecordID: 1, CourseID: 7, Source: "curriculum", AcademicYear: 2566, Semester: 2, CourseCode: "CS01", Grade: "A", CategoryIDs: []uint64{3}},
		},
		CourseScores: []models.AssessmentCompetencyScore{{
			CompetencyID: 12, CompetencyCode: "C12", CompetencyNameTH: "วิเคราะห์", CoreScore: 1.23456, HasEvidence: true,
			CourseScores: []models.AssessmentCourseScore{
				{EvidenceRef: "score:2", CourseEvidenceRef: "course:curriculum:2", RawScore: 78.123456, Weight: 20, WeightedScore: 15.624691},
				{EvidenceRef: "score:1", CourseEvidenceRef: "course:curriculum:1", RawScore: 90, Weight: 10, WeightedScore: 9},
			},
			ActivityScores: []models.AssessmentActivityScore{{EvidenceRef: "activity-score:1", EarnedPercent: earned}},
		}},
		ActivityEvidence: []models.AssessmentActivityEvidence{
			{EvidenceRef: "activity:2", AttendanceID: 2, AttendanceStatus: "present", StartAt: time.Date(2026, 1, 2, 0, 0, 0, 0, time.Local)},
			{EvidenceRef: "activity:1", AttendanceID: 1, AttendanceStatus: "present", StartAt: time.Date(2025, 1, 2, 0, 0, 0, 0, time.Local)},
		},
		Availability: []models.AssessmentSourceAvailability{{Source: "activity_participation", Available: true}, {Source: "academic_grades", Available: true}},
	}
}
