package repositories

import (
	"context"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"

	"github.com/spw32767/university-competency-system-backend/models"
)

var ErrAssessmentReportNotFound = errors.New("assessment report not found")

type assessmentReportExecer interface {
	ExecContext(context.Context, string, ...any) (sql.Result, error)
}

type AssessmentReportRepository struct {
	DB *sql.DB
}

func NewAssessmentReportRepository(db *sql.DB) *AssessmentReportRepository {
	return &AssessmentReportRepository{DB: db}
}

func (r *AssessmentReportRepository) GetLatest(
	ctx context.Context,
	enrollmentCurriculumID uint64,
	semester uint,
) (models.AssessmentReportRecord, error) {
	var report models.AssessmentReportRecord
	err := r.DB.QueryRowContext(ctx, `
		SELECT report_id, enrollment_curriculum_id, semester, target_year_be,
			source_hash, source_snapshot, report_content, data_completeness,
			provider_name, model_name, model_digest, provider_config_fingerprint,
			pipeline_version, prompt_version,
			output_schema_version, generated_at
		FROM ai_learner_reports
		WHERE enrollment_curriculum_id = ? AND semester = ?`, enrollmentCurriculumID, semester).Scan(
		&report.ReportID, &report.EnrollmentCurriculumID, &report.Semester, &report.TargetYearBE,
		&report.SourceHash, &report.SourceSnapshot, &report.Content, &report.Completeness,
		&report.ProviderName, &report.ModelName, &report.ModelDigest, &report.ProviderConfigFingerprint,
		&report.PipelineVersion, &report.PromptVersion,
		&report.SchemaVersion, &report.GeneratedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return models.AssessmentReportRecord{}, ErrAssessmentReportNotFound
	}
	return report, err
}

func (r *AssessmentReportRepository) upsertLatestWith(ctx context.Context, execer assessmentReportExecer, report models.AssessmentReportRecord) error {
	_, fingerprintErr := hex.DecodeString(report.ProviderConfigFingerprint)
	apiProvider := report.ProviderName == "kku" || report.ProviderName == "deepseek" || report.ProviderName == "openai" || report.ProviderName == "gemini"
	if report.EnrollmentCurriculumID == 0 || (report.Semester != 1 && report.Semester != 2) ||
		(report.Completeness != "full" && report.Completeness != "partial") ||
		(!apiProvider && report.ModelDigest == "") || len(report.ProviderConfigFingerprint) != 64 || fingerprintErr != nil ||
		!json.Valid(report.SourceSnapshot) || !json.Valid(report.Content) {
		return errors.New("invalid assessment report record")
	}
	_, err := execer.ExecContext(ctx, `
		INSERT INTO ai_learner_reports (
			enrollment_curriculum_id, semester, target_year_be, source_hash,
			source_snapshot, report_content, data_completeness, provider_name,
			model_name, model_digest, provider_config_fingerprint, pipeline_version,
			prompt_version, output_schema_version, generated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			target_year_be = VALUES(target_year_be),
			source_hash = VALUES(source_hash),
			source_snapshot = VALUES(source_snapshot),
			report_content = VALUES(report_content),
			data_completeness = VALUES(data_completeness),
			provider_name = VALUES(provider_name),
			model_name = VALUES(model_name),
			model_digest = VALUES(model_digest),
			provider_config_fingerprint = VALUES(provider_config_fingerprint),
			pipeline_version = VALUES(pipeline_version),
			prompt_version = VALUES(prompt_version),
			output_schema_version = VALUES(output_schema_version),
			generated_at = VALUES(generated_at)`,
		report.EnrollmentCurriculumID, report.Semester, report.TargetYearBE, report.SourceHash,
		string(report.SourceSnapshot), string(report.Content), report.Completeness, report.ProviderName,
		report.ModelName, report.ModelDigest, report.ProviderConfigFingerprint,
		report.PipelineVersion, report.PromptVersion, report.SchemaVersion,
		report.GeneratedAt,
	)
	return err
}
