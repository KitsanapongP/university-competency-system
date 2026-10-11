package repositories

import (
	"database/sql"
	"errors"
	"testing"
)

type assessmentJobTestScanner struct {
	status string
	phase  any
	err    error
}

func (s assessmentJobTestScanner) Scan(dest ...any) error {
	if s.err != nil {
		return s.err
	}
	*dest[0].(*uint64) = 42
	*dest[5].(*[]byte) = []byte(`{"version":1}`)
	*dest[6].(*string) = s.status
	return dest[7].(*sql.NullString).Scan(s.phase)
}

func TestScanAssessmentJobProgressPhase(t *testing.T) {
	tests := []struct {
		name   string
		status string
		phase  any
		want   string
	}{
		{"legacy queued", "queued", nil, "queued"},
		{"legacy running", "running", nil, "preparing"},
		{"legacy succeeded", "succeeded", nil, "completed"},
		{"legacy failed", "failed", nil, "failed"},
		{"recorded phase", "running", "validating", "validating"},
		{"empty phase", "failed", "", "failed"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			job, err := scanAssessmentJob(assessmentJobTestScanner{status: tt.status, phase: tt.phase})
			if err != nil {
				t.Fatal(err)
			}
			if job.ProgressPhase != tt.want {
				t.Fatalf("phase = %q, want %q", job.ProgressPhase, tt.want)
			}
			if job.JobID != 42 || job.Status != tt.status || string(job.InputSnapshot) != `{"version":1}` {
				t.Fatalf("job fields were not preserved: %+v", job)
			}
			if job.PhaseStartedAt != nil || job.LastProviderActivityAt != nil {
				t.Fatal("missing progress timestamps must remain nil")
			}
		})
	}
}

func TestScanAssessmentJobErrors(t *testing.T) {
	queryErr := errors.New("query failed")
	for _, tt := range []struct{ source, want error }{
		{sql.ErrNoRows, ErrAssessmentJobNotFound},
		{queryErr, queryErr},
	} {
		_, err := scanAssessmentJob(assessmentJobTestScanner{err: tt.source})
		if !errors.Is(err, tt.want) {
			t.Fatalf("error = %v, want %v", err, tt.want)
		}
	}
}
