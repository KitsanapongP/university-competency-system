package services

import (
	"context"
	"errors"
	"log/slog"

	"github.com/spw32767/university-competency-system-backend/models"
)

type assessmentLogContextKey struct{}

// LogAssessmentOutputRejection shares allowlisted diagnostics with synthetic evaluators.
func LogAssessmentOutputRejection(ctx context.Context, err error, outputBytes int) {
	logAssessmentOutputRejection(ctx, err, outputBytes)
}

func withAssessmentJobLogContext(ctx context.Context, job models.AssessmentJob) context.Context {
	logger := slog.Default().With("job_id", job.JobID, "attempt_count", job.AttemptCount)
	return context.WithValue(ctx, assessmentLogContextKey{}, logger)
}

func assessmentLogger(ctx context.Context) *slog.Logger {
	if logger, ok := ctx.Value(assessmentLogContextKey{}).(*slog.Logger); ok {
		return logger
	}
	return slog.Default()
}

func logAssessmentOutputRejection(ctx context.Context, err error, outputBytes int) {
	errorCode := "invalid_output"
	if errors.Is(err, ErrAssessmentOutputMalformed) {
		errorCode = "malformed_output"
	}
	reason := assessmentReasonUnknown
	var diagnostic *AssessmentOutputValidationError
	if errors.As(err, &diagnostic) && diagnostic != nil {
		reason = safeAssessmentValidationReason(diagnostic.Reason)
	}
	attributes := []slog.Attr{
		slog.String("error_code", errorCode),
		slog.String("validation_reason", reason),
		slog.Int("output_bytes", max(0, outputBytes)),
		slog.String("schema_version", assessmentNarrativeSchemaVersion),
	}
	if diagnostic != nil {
		if diagnostic.Rule != "" {
			attributes = append(attributes, slog.String("validation_rule", safeAssessmentValidationRule(diagnostic.Rule)))
		}
		if diagnostic.Section != "" {
			attributes = append(attributes, slog.String("section", safeAssessmentSection(diagnostic.Section)))
		}
		if diagnostic.ParagraphIndex > 0 {
			attributes = append(attributes, slog.Int("paragraph_index", diagnostic.ParagraphIndex))
		}
		if diagnostic.SentenceIndex > 0 {
			attributes = append(attributes, slog.Int("sentence_index", diagnostic.SentenceIndex))
		}
		if diagnostic.Language != "" {
			attributes = append(attributes, slog.String("language", safeAssessmentLanguage(diagnostic.Language)))
		}
		if diagnostic.Field != "" {
			attributes = append(attributes, slog.String("field", safeAssessmentField(diagnostic.Field)))
		}
	}
	assessmentLogger(ctx).LogAttrs(ctx, slog.LevelWarn, "assessment output rejected", attributes...)
}
