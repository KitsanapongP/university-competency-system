package services

import (
	"context"
	"database/sql"
	"fmt"
	"sort"
	"time"

	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
)

type AssessmentSourceBuilder struct {
	DB               *sql.DB
	ScopeRepo        *repositories.AssessmentSourceRepository
	ReadinessRepo    *repositories.CooperativeReadinessRepository
	CurriculumRepo   *repositories.CurriculumRepository
	ContextBudget    AssessmentContextBudget
	GenerationConfig AssessmentGenerationConfig
	Now              func() time.Time
}

func NewAssessmentSourceBuilder(
	db *sql.DB,
	scopeRepo *repositories.AssessmentSourceRepository,
	readinessRepo *repositories.CooperativeReadinessRepository,
	curriculumRepo *repositories.CurriculumRepository,
) *AssessmentSourceBuilder {
	return &AssessmentSourceBuilder{
		DB:             db,
		ScopeRepo:      scopeRepo,
		ReadinessRepo:  readinessRepo,
		CurriculumRepo: curriculumRepo,
		ContextBudget:  DefaultAssessmentContextBudget(),
		Now:            time.Now,
	}
}

func (b *AssessmentSourceBuilder) Build(ctx context.Context, userID uint64, semester uint) (*models.LearnerAssessmentSnapshot, error) {
	return b.build(ctx, semester, func(ctx context.Context, queryer repositories.AssessmentQueryer) (models.LearnerAssessmentScope, error) {
		return b.ScopeRepo.GetLearnerScopeWith(ctx, queryer, userID)
	})
}

func (b *AssessmentSourceBuilder) BuildForEnrollmentCurriculum(
	ctx context.Context,
	enrollmentCurriculumID uint64,
	semester uint,
) (*models.LearnerAssessmentSnapshot, error) {
	return b.build(ctx, semester, func(ctx context.Context, queryer repositories.AssessmentQueryer) (models.LearnerAssessmentScope, error) {
		return b.ScopeRepo.GetLearnerScopeByEnrollmentCurriculumWith(ctx, queryer, enrollmentCurriculumID)
	})
}

func (b *AssessmentSourceBuilder) build(
	ctx context.Context,
	semester uint,
	resolveScope func(context.Context, repositories.AssessmentQueryer) (models.LearnerAssessmentScope, error),
) (*models.LearnerAssessmentSnapshot, error) {
	if semester != 1 && semester != 2 {
		return nil, AssessmentSourceValidationError{Message: "semester must be 1 or 2"}
	}
	contextBudget := normalizeAssessmentContextBudget(b.ContextBudget)
	if err := validateAssessmentContextBudget(contextBudget); err != nil {
		return nil, err
	}

	tx, err := b.DB.BeginTx(ctx, &sql.TxOptions{
		Isolation: sql.LevelRepeatableRead,
		ReadOnly:  true,
	})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	scope, err := resolveScope(ctx, tx)
	if err != nil {
		return nil, err
	}
	sets, err := b.ReadinessRepo.GetRequirementSetsWith(ctx, tx, scope.CurriculumID, semester)
	if err != nil {
		return nil, err
	}
	categories, err := b.CurriculumRepo.GetCurriculumCategoryTreeWith(ctx, tx, scope.CurriculumID)
	if err != nil {
		return nil, err
	}
	records, err := b.ReadinessRepo.GetAcademicRecordsWith(ctx, tx, scope.EnrollmentID, scope.CurriculumID)
	if err != nil {
		return nil, err
	}
	cutoffEvidence := buildAssessmentAcademicEvidence(records, scope.TargetYearBE, semester)
	courseSetup, setupReason, err := assessmentCourseScoringSetup(ctx, tx, b.ScopeRepo, scope.CohortID)
	if err != nil {
		return nil, err
	}
	electiveAttempts, err := b.ScopeRepo.GetElectiveAttemptsWith(ctx, tx, scope.EnrollmentID, scope.EnrollmentCurriculumID)
	if err != nil {
		return nil, err
	}
	activityEvidence, err := b.ScopeRepo.GetActivityEvidenceWith(ctx, tx, scope.PersonID)
	if err != nil {
		return nil, err
	}

	learner := repositories.CooperativeLearnerContext{
		EnrollmentID: scope.EnrollmentID,
		CurriculumID: scope.CurriculumID,
		EntryYearBE:  scope.EntryYearBE,
	}
	readiness := evaluateCooperativeReadiness(sets.Published, categories, learner, semester, records)
	courseScores, scoringAvailable, scoringReason := calculateAssessmentCourseScores(cutoffEvidence, courseSetup, setupReason)
	electiveScores, electiveAvailable, electiveReason := calculateAssessmentElectiveScores(
		electiveAttempts,
		scope.TargetYearBE,
		semester,
		courseSetup.CohortFound,
		courseSetup.FreeElectiveRecalculationRequired,
	)
	activityScores, activityScoresAvailable, activityScoresReason := buildAssessmentActivityScores(activityEvidence)
	competencyScores := mergeAssessmentCompetencyScores(courseScores, electiveScores, activityScores)
	availability := buildAssessmentBaseAvailability(readiness, cutoffEvidence, scoringAvailable, scoringReason, electiveAvailable, electiveReason)
	availability = append(availability, buildAssessmentActivityAvailability(activityEvidence, activityScoresAvailable, activityScoresReason)...)
	snapshot := &models.LearnerAssessmentSnapshot{
		Scope:            scope,
		Semester:         semester,
		TargetYearBE:     scope.TargetYearBE,
		CapturedAt:       b.now().UTC(),
		Completeness:     assessmentSnapshotCompleteness(cutoffEvidence, competencyScores, activityEvidence, availability),
		Readiness:        readiness,
		AcademicEvidence: cutoffEvidence,
		CourseScores:     competencyScores,
		ActivityEvidence: activityEvidence,
		Availability:     availability,
	}
	snapshot.Metadata = assessmentSourceMetadata(contextBudget, b.GenerationConfig)
	if snapshot.Metadata.Provider != "ollama" {
		var names models.AssessmentBilingualText
		if err := tx.QueryRowContext(ctx, `SELECT curriculum_name_th, COALESCE(curriculum_name_en, '') FROM edu_curricula WHERE curriculum_id = ? AND deleted_at IS NULL`, scope.CurriculumID).Scan(&names.TH, &names.EN); err != nil {
			return nil, err
		}
		names.TH = sanitizeAssessmentText(names.TH)
		names.EN = assessmentTextWithFallback(names.EN, names.TH)
		snapshot.Curriculum = &names
	}
	snapshot.Metadata.SourceHash, err = calculateAssessmentSourceHash(snapshot)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return snapshot, nil
}

func assessmentSnapshotCompleteness(
	academicEvidence []models.AssessmentAcademicEvidence,
	competencyScores []models.AssessmentCompetencyScore,
	activityEvidence []models.AssessmentActivityEvidence,
	availability []models.AssessmentSourceAvailability,
) string {
	hasEvidence := false
	for _, item := range academicEvidence {
		if item.Grade != "" {
			hasEvidence = true
			break
		}
	}
	if !hasEvidence {
		for _, item := range competencyScores {
			if item.HasEvidence {
				hasEvidence = true
				break
			}
		}
	}
	if !hasEvidence {
		hasEvidence = len(activityEvidence) > 0
	}
	if !hasEvidence {
		return "none"
	}
	for _, source := range availability {
		if !source.Available {
			return "partial"
		}
	}
	return "full"
}

func (b *AssessmentSourceBuilder) now() time.Time {
	if b.Now == nil {
		return time.Now()
	}
	return b.Now()
}

func buildAssessmentAcademicEvidence(
	records []repositories.CooperativeAcademicRecord,
	targetYearBE uint64,
	semester uint,
) []models.AssessmentAcademicEvidence {
	cutoffRecords := recordsBeforeTarget(records, targetYearBE, semester)
	evidence := make([]models.AssessmentAcademicEvidence, 0, len(cutoffRecords))
	for _, record := range cutoffRecords {
		evidence = append(evidence, models.AssessmentAcademicEvidence{
			EvidenceRef:  assessmentCourseEvidenceRef(record.Source, record.RecordID),
			RecordID:     record.RecordID,
			CourseID:     record.CourseID,
			Source:       record.Source,
			AcademicYear: record.AcademicYear,
			Semester:     record.Semester,
			CourseCode:   record.CourseCode,
			CourseNameTH: record.CourseNameTH,
			CourseNameEN: record.CourseNameEN,
			Credits:      record.Credits,
			GradeScheme:  record.GradeScheme,
			Grade:        record.Grade,
			CategoryIDs:  append([]uint64(nil), record.CategoryIDs...),
		})
	}
	return evidence
}

func assessmentCourseEvidenceRef(source string, recordID uint64) string {
	return fmt.Sprintf("course:%s:%d", source, recordID)
}

func buildAssessmentBaseAvailability(
	readiness models.CooperativeReadinessResult,
	evidence []models.AssessmentAcademicEvidence,
	scoringAvailable bool,
	scoringReason string,
	electiveAvailable bool,
	electiveReason string,
) []models.AssessmentSourceAvailability {
	readinessAvailable := readiness.Status != CooperativeReadinessNotConfigured
	readinessReason := ""
	if !readinessAvailable {
		readinessReason = "criteria_not_published"
	}
	academicAvailable := false
	for _, item := range evidence {
		if item.Grade != "" {
			academicAvailable = true
			break
		}
	}
	academicReason := ""
	if !academicAvailable {
		academicReason = "no_graded_courses_before_target"
	}
	return []models.AssessmentSourceAvailability{
		{Source: "cooperative_readiness", Available: readinessAvailable, Reason: readinessReason},
		{Source: "academic_grades", Available: academicAvailable, Reason: academicReason},
		{Source: "course_competency_scores", Available: scoringAvailable, Reason: scoringReason},
		{Source: "free_elective_competency_scores", Available: electiveAvailable, Reason: electiveReason},
	}
}

func mergeAssessmentCompetencyScores(sources ...[]models.AssessmentCompetencyScore) []models.AssessmentCompetencyScore {
	byID := make(map[uint64]models.AssessmentCompetencyScore)
	for _, source := range sources {
		for _, item := range source {
			merged, exists := byID[item.CompetencyID]
			if !exists {
				merged = models.AssessmentCompetencyScore{
					CompetencyID:   item.CompetencyID,
					CourseScores:   make([]models.AssessmentCourseScore, 0),
					ElectiveScores: make([]models.AssessmentCourseScore, 0),
					ActivityScores: make([]models.AssessmentActivityScore, 0),
				}
			}
			if merged.CompetencyCode == "" {
				merged.CompetencyCode = item.CompetencyCode
			}
			if merged.CompetencyNameTH == "" {
				merged.CompetencyNameTH = item.CompetencyNameTH
			}
			if merged.CompetencyNameEN == "" {
				merged.CompetencyNameEN = item.CompetencyNameEN
			}
			merged.CoreScore = roundAssessmentScore(merged.CoreScore + item.CoreScore)
			merged.BonusScore = roundAssessmentScore(merged.BonusScore + item.BonusScore)
			merged.FreeElectiveScore = roundAssessmentScore(merged.FreeElectiveScore + item.FreeElectiveScore)
			merged.HasEvidence = merged.HasEvidence || item.HasEvidence
			merged.CourseScores = append(merged.CourseScores, item.CourseScores...)
			merged.ElectiveScores = append(merged.ElectiveScores, item.ElectiveScores...)
			merged.ActivityScore = roundAssessmentScore(merged.ActivityScore + item.ActivityScore)
			merged.ActivityScores = append(merged.ActivityScores, item.ActivityScores...)
			byID[item.CompetencyID] = merged
		}
	}
	result := make([]models.AssessmentCompetencyScore, 0, len(byID))
	for _, item := range byID {
		result = append(result, item)
	}
	sort.Slice(result, func(i, j int) bool { return result[i].CompetencyID < result[j].CompetencyID })
	return result
}

type AssessmentSourceValidationError struct {
	Message string
}

func (e AssessmentSourceValidationError) Error() string {
	return e.Message
}
