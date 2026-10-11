package repositories

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/spw32767/university-competency-system-backend/models"
)

func TestKKUReportAllowsEmptyModelDigestAndClearsDraft(t *testing.T) {
	db, state := apiSQLDB(t, []apiSQLStep{{contains: "AND input_hash = ?", changed: 1}, {contains: "INSERT INTO ai_learner_reports", changed: 1}, {contains: "AND job_id <= ?", changed: 1}})
	report := models.AssessmentReportRecord{EnrollmentCurriculumID: 1, Semester: 1, SourceHash: "hash", GeneratedAt: time.Now(), ProviderName: "kku", ModelName: "deepseek-v4-flash", Completeness: "partial", ProviderConfigFingerprint: strings.Repeat("a", 64), SourceSnapshot: []byte(`{}`), Content: []byte(`{}`)}
	err := NewAssessmentJobRepository(db).CompleteAPIReport(context.Background(), models.AssessmentJob{JobID: 1, LeaseToken: "lease", EnrollmentCurriculumID: 1, Semester: 1}, report, NewAssessmentReportRepository(db))
	if err != nil || state.commits != 1 || state.index != 3 {
		t.Fatalf("KKU report persistence failed: %v", err)
	}
}
