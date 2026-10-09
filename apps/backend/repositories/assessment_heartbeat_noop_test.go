package repositories

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"io"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

type heartbeatNoopDriver struct {
	changed int64
	owned   bool
	queried bool
}
type heartbeatNoopConn struct{ state *heartbeatNoopDriver }
type heartbeatNoopRows struct {
	owned bool
	read  bool
}

var heartbeatNoopSequence atomic.Uint64

func (d *heartbeatNoopDriver) Open(string) (driver.Conn, error) {
	return &heartbeatNoopConn{state: d}, nil
}
func (c *heartbeatNoopConn) Prepare(string) (driver.Stmt, error) {
	return nil, errors.New("unsupported")
}
func (c *heartbeatNoopConn) Close() error              { return nil }
func (c *heartbeatNoopConn) Begin() (driver.Tx, error) { return nil, errors.New("unsupported") }
func (c *heartbeatNoopConn) ExecContext(context.Context, string, []driver.NamedValue) (driver.Result, error) {
	return driver.RowsAffected(c.state.changed), nil
}
func (c *heartbeatNoopConn) QueryContext(_ context.Context, query string, args []driver.NamedValue) (driver.Rows, error) {
	for _, guard := range []string{"status = 'running'", "lease_token = ?", "lease_expires_at > UTC_TIMESTAMP()"} {
		if !strings.Contains(query, guard) {
			return nil, errors.New("ownership query lost fencing guard")
		}
	}
	if len(args) != 2 {
		return nil, errors.New("invalid ownership parameters")
	}
	c.state.queried = true
	return &heartbeatNoopRows{owned: c.state.owned}, nil
}
func (r *heartbeatNoopRows) Columns() []string { return []string{"job_id"} }
func (r *heartbeatNoopRows) Close() error      { return nil }
func (r *heartbeatNoopRows) Next(values []driver.Value) error {
	if !r.owned || r.read {
		return io.EOF
	}
	r.read = true
	values[0] = int64(42)
	return nil
}

func TestAssessmentHeartbeatNoopKeepsLeaseFencing(t *testing.T) {
	for index, test := range []struct {
		name               string
		changed            int64
		owned, query, lost bool
	}{
		{"changed", 1, true, false, false}, {"same-second owned", 0, true, true, false}, {"missing or expired lease", 0, false, true, true}, {"unexpected rows", 2, true, false, true},
	} {
		t.Run(test.name, func(t *testing.T) {
			state := &heartbeatNoopDriver{changed: test.changed, owned: test.owned}
			name := fmt.Sprintf("assessment_heartbeat_noop_%d_%d", index, heartbeatNoopSequence.Add(1))
			sql.Register(name, state)
			db, err := sql.Open(name, "")
			if err != nil {
				t.Fatal(err)
			}
			defer db.Close()
			repo := NewAssessmentJobRepository(db)
			err = repo.Heartbeat(context.Background(), 42, "lease", 30*time.Second)
			if errors.Is(err, ErrAssessmentLeaseLost) != test.lost || (!test.lost && err != nil) || state.queried != test.query {
				t.Fatalf("unexpected heartbeat outcome: err=%v queried=%v", err, state.queried)
			}
		})
	}
}
