package repositories

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"github.com/spw32767/university-competency-system-backend/models"
	"io"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

type apiSQLStep struct {
	contains string
	rows     [][]driver.Value
	changed  int64
	err      error
}
type apiSQLDriver struct {
	steps              []apiSQLStep
	commits, rollbacks int
	index              int
}
type apiSQLConn struct{ state *apiSQLDriver }
type apiSQLTx struct{ state *apiSQLDriver }
type apiSQLRows struct {
	values [][]driver.Value
	index  int
	count  int
}
type apiSQLResult int64

var apiSQLSequence atomic.Uint64

func (d *apiSQLDriver) Open(string) (driver.Conn, error)  { return &apiSQLConn{d}, nil }
func (c *apiSQLConn) Prepare(string) (driver.Stmt, error) { return nil, errors.New("unsupported") }
func (c *apiSQLConn) Close() error                        { return nil }
func (c *apiSQLConn) Begin() (driver.Tx, error)           { return &apiSQLTx{c.state}, nil }
func (c *apiSQLConn) next(q string) (apiSQLStep, error) {
	s := c.state
	if s.index >= len(s.steps) {
		return apiSQLStep{}, fmt.Errorf("unexpected SQL %s", q)
	}
	step := s.steps[s.index]
	s.index++
	if !strings.Contains(q, step.contains) {
		return step, fmt.Errorf("missing SQL guard %s", step.contains)
	}
	return step, step.err
}
func (c *apiSQLConn) ExecContext(_ context.Context, q string, _ []driver.NamedValue) (driver.Result, error) {
	s, err := c.next(q)
	return apiSQLResult(s.changed), err
}
func (c *apiSQLConn) QueryContext(_ context.Context, q string, _ []driver.NamedValue) (driver.Rows, error) {
	s, err := c.next(q)
	if err != nil {
		return nil, err
	}
	n := 1
	if len(s.rows) > 0 {
		n = len(s.rows[0])
	}
	return &apiSQLRows{values: s.rows, count: n}, nil
}
func (t *apiSQLTx) Commit() error                   { t.state.commits++; return nil }
func (t *apiSQLTx) Rollback() error                 { t.state.rollbacks++; return nil }
func (r apiSQLResult) LastInsertId() (int64, error) { return 123, nil }
func (r apiSQLResult) RowsAffected() (int64, error) { return int64(r), nil }
func (r *apiSQLRows) Columns() []string {
	names := make([]string, r.count)
	for i := range names {
		names[i] = fmt.Sprint(i)
	}
	return names
}
func (r *apiSQLRows) Close() error { return nil }
func (r *apiSQLRows) Next(dest []driver.Value) error {
	if r.index >= len(r.values) {
		return io.EOF
	}
	copy(dest, r.values[r.index])
	r.index++
	return nil
}
func apiSQLDB(t *testing.T, steps []apiSQLStep) (*sql.DB, *apiSQLDriver) {
	t.Helper()
	state := &apiSQLDriver{steps: steps}
	name := fmt.Sprintf("assessment_api_%d", apiSQLSequence.Add(1))
	sql.Register(name, state)
	db, err := sql.Open(name, "")
	if err != nil {
		t.Fatal(err)
	}
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { db.Close() })
	return db, state
}

func TestAPICallReservationIsAtomicAndBounded(t *testing.T) {
	base := []apiSQLStep{
		{contains: "gate_id = 1 FOR UPDATE", rows: [][]driver.Value{{nil, false}}},
		{contains: "lease_expires_at > UTC_TIMESTAMP()", rows: [][]driver.Value{{int64(1)}}},
		{contains: "attempt_count = ?", rows: [][]driver.Value{{int64(0)}}},
		{contains: "INSERT IGNORE INTO ai_api_daily_usage", changed: 1},
		{contains: "usage_date = UTC_DATE() FOR UPDATE", rows: [][]driver.Value{{int64(19)}}},
		{contains: "INSERT INTO ai_api_calls", changed: 1},
		{contains: "call_count = call_count + 1", changed: 1},
		{contains: "active_until = DATE_ADD(UTC_TIMESTAMP()", changed: 1},
	}
	for _, test := range []struct {
		name  string
		alter func([]apiSQLStep) []apiSQLStep
		want  error
	}{
		{"allowed", func(s []apiSQLStep) []apiSQLStep { return s }, nil},
		{"busy", func(s []apiSQLStep) []apiSQLStep { s[0].rows = [][]driver.Value{{int64(123), true}}; return s[:1] }, ErrAssessmentAPIBusy},
		{"duplicate attempt", func(s []apiSQLStep) []apiSQLStep { s[2].rows = [][]driver.Value{{int64(1)}}; return s[:3] }, ErrAssessmentAPIAttemptReserved},
		{"quota", func(s []apiSQLStep) []apiSQLStep { s[4].rows = [][]driver.Value{{int64(20)}}; return s[:5] }, ErrAssessmentAPIQuota},
		{"lost lease", func(s []apiSQLStep) []apiSQLStep { s[1].rows = [][]driver.Value{{int64(0)}}; return s[:2] }, ErrAssessmentLeaseLost},
	} {
		t.Run(test.name, func(t *testing.T) {
			steps := test.alter(append([]apiSQLStep(nil), base...))
			db, state := apiSQLDB(t, steps)
			r := &AssessmentAPIRepository{DB: db}
			id, err := r.Reserve(context.Background(), models.AssessmentJob{JobID: 7, LeaseToken: "lease", AttemptCount: 1}, "deepseek", "test", 20, time.Minute)
			if !errors.Is(err, test.want) || state.index != len(steps) {
				t.Fatalf("err=%v steps=%d", err, state.index)
			}
			if test.want == nil {
				if id != 123 || state.commits != 1 {
					t.Fatal("reservation not committed")
				}
			} else if state.commits != 0 || state.rollbacks != 1 {
				t.Fatal("failed reservation not rolled back")
			}
		})
	}
}

func TestDraftFailureTransactionFencesLeaseAndRollsBack(t *testing.T) {
	for _, test := range []struct {
		name      string
		changed   int64
		insertErr error
		want      error
	}{
		{"success", 1, nil, nil}, {"lost lease", 0, nil, ErrAssessmentLeaseLost}, {"insert failure", 1, errors.New("simulated insert failure"), nil},
	} {
		t.Run(test.name, func(t *testing.T) {
			steps := []apiSQLStep{{contains: "AND input_hash = ?", changed: test.changed}}
			if test.changed == 1 {
				steps = append(steps, apiSQLStep{contains: "job_id = GREATEST(job_id, VALUES(job_id))", changed: 1, err: test.insertErr})
			}
			db, state := apiSQLDB(t, steps)
			r := NewAssessmentJobRepository(db)
			err := r.MarkFailedWithDraft(context.Background(), models.AssessmentJob{JobID: 7, LeaseToken: "lease"}, "invalid_output", time.Minute, models.AssessmentRejectedDraft{EnrollmentCurriculumID: 1, Semester: 1, SourceHash: "hash"})
			if test.insertErr != nil {
				if !errors.Is(err, test.insertErr) {
					t.Fatal(err)
				}
			} else if !errors.Is(err, test.want) {
				t.Fatal(err)
			}
			if err == nil {
				if state.commits != 1 {
					t.Fatal("not atomic")
				}
			} else if state.rollbacks != 1 || state.commits != 0 {
				t.Fatal("partial draft save")
			}
		})
	}
}

func TestCallFinishReleasesOnlyItsReservation(t *testing.T) {
	db, state := apiSQLDB(t, []apiSQLStep{{contains: "AND active_call_id = ?", changed: 1}, {contains: "AND finished_at IS NULL", changed: 1}})
	if err := (&AssessmentAPIRepository{DB: db}).Finish(context.Background(), 123, nil, nil); err != nil {
		t.Fatal(err)
	}
	if state.commits != 1 {
		t.Fatal("finish not committed")
	}
}

func TestAPIReportSaveAllowsEmptyDigestAndClearsDraftAtomically(t *testing.T) {
	for _, failedWrite := range []bool{false, true} {
		steps := []apiSQLStep{{contains: "AND input_hash = ?", changed: 1}, {contains: "INSERT INTO ai_learner_reports", changed: 1}}
		if failedWrite {
			steps[1].err = errors.New("simulated write failure")
		} else {
			steps = append(steps, apiSQLStep{contains: "AND job_id <= ?", changed: 1})
		}
		db, state := apiSQLDB(t, steps)
		report := models.AssessmentReportRecord{EnrollmentCurriculumID: 1, Semester: 1, SourceHash: "hash", GeneratedAt: time.Now(), ProviderName: "deepseek", ModelName: "test", Completeness: "partial", ProviderConfigFingerprint: strings.Repeat("a", 64), SourceSnapshot: []byte(`{}`), Content: []byte(`{}`)}
		err := NewAssessmentJobRepository(db).CompleteAPIReport(context.Background(), models.AssessmentJob{JobID: 1, LeaseToken: "lease", EnrollmentCurriculumID: 1, Semester: 1}, report, NewAssessmentReportRepository(db))
		if failedWrite {
			if err == nil || state.commits != 0 || state.rollbacks != 1 {
				t.Fatal("failed report saved partially")
			}
		} else if err != nil || state.commits != 1 || state.index != 3 {
			t.Fatalf("API save failed: %v", err)
		}
	}
}

func TestSyntheticEvaluationUsesSameQuotaGate(t *testing.T) {
	db, state := apiSQLDB(t, []apiSQLStep{
		{contains: "gate_id = 1 FOR UPDATE", rows: [][]driver.Value{{nil, false}}},
		{contains: "evaluation_ref = ?", rows: [][]driver.Value{{int64(0)}}},
		{contains: "INSERT IGNORE INTO ai_api_daily_usage", changed: 1},
		{contains: "usage_date = UTC_DATE() FOR UPDATE", rows: [][]driver.Value{{int64(19)}}},
		{contains: "INSERT INTO ai_api_calls", changed: 1},
		{contains: "call_count = call_count + 1", changed: 1},
		{contains: "active_until = DATE_ADD(UTC_TIMESTAMP()", changed: 1},
	})
	id, err := (&AssessmentAPIRepository{DB: db}).ReserveEvaluation(context.Background(), strings.Repeat("a", 32), "deepseek", "test", 20, time.Minute)
	if err != nil || id != 123 || state.commits != 1 {
		t.Fatalf("evaluation quota was bypassed or failed: %v", err)
	}
}
