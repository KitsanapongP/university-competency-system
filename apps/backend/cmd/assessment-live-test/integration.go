package main

import (
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/spw32767/university-competency-system-backend/config"
	appdb "github.com/spw32767/university-competency-system-backend/db"
)

func integration(ctx context.Context, path string) error {
	if connection, err := net.DialTimeout("tcp", "127.0.0.1:8081", time.Second); err == nil {
		connection.Close()
		return fmt.Errorf("stop owned test API and worker before repository integration tests")
	}
	values, err := privateConfig(path)
	if err != nil {
		return err
	}
	for key, value := range values {
		if err := os.Setenv(key, value); err != nil {
			return fmt.Errorf("test configuration failed")
		}
	}
	cfg := config.Load()
	if !strings.HasPrefix(cfg.DBUser, "assessment_test_") {
		return fmt.Errorf("restricted test database user required")
	}
	db, err := appdb.NewMySQL(cfg)
	if err != nil {
		return fmt.Errorf("test database unavailable")
	}
	defer db.Close()
	// The repository test needs a scope with no existing jobs; leave the real test learner's scope intact.
	created, err := db.ExecContext(ctx, `INSERT INTO kku_enrollment_curricula
		(enrollment_id,curriculum_id,cohort_id,start_academic_year_be,start_semester,is_current,change_reason,note)
		SELECT enrollment.enrollment_id,roster.curriculum_id,roster.cohort_id,roster.start_academic_year_be,roster.start_semester,0,roster.change_reason,'Isolated repository test fixture'
		FROM auth_users account JOIN kku_enrollments enrollment ON enrollment.person_id=account.person_id
		JOIN kku_enrollment_curricula roster ON roster.enrollment_id=enrollment.enrollment_id AND roster.is_current=1
		WHERE account.email=? AND roster.deleted_at IS NULL LIMIT 1`, values["ASSESSMENT_TEST_EMAIL"])
	if err != nil {
		var databaseError *mysql.MySQLError
		if errors.As(err, &databaseError) {
			return fmt.Errorf("isolated integration fixture creation failed (MySQL code %d)", databaseError.Number)
		}
		return fmt.Errorf("isolated integration fixture creation failed")
	}
	id, err := created.LastInsertId()
	if err != nil || id == 0 {
		return fmt.Errorf("integration fixture identifier unavailable")
	}
	defer func() {
		cleanupCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		for _, query := range []string{"DELETE FROM ai_report_jobs WHERE enrollment_curriculum_id=?", "DELETE FROM ai_learner_reports WHERE enrollment_curriculum_id=?", "DELETE FROM kku_enrollment_curricula WHERE enrollment_curriculum_id=? AND is_current=0"} {
			if _, err := db.ExecContext(cleanupCtx, query, id); err != nil {
				fmt.Fprintln(os.Stderr, "isolated integration fixture cleanup failed; inspect test database only")
			}
		}
	}()
	dsn := mysql.NewConfig()
	dsn.User, dsn.Passwd, dsn.DBName = cfg.DBUser, cfg.DBPass, cfg.DBName
	dsn.Net, dsn.Addr = "tcp", cfg.DBHost+":"+cfg.DBPort
	dsn.ParseTime = true
	dsn.Loc = time.Local
	dsn.Params = map[string]string{"charset": "utf8mb4"}
	command := exec.CommandContext(ctx, "go", "test", "./repositories", "-run", "^TestAssessmentJobRepositoryMySQLConcurrencyAndFencing$", "-count=1", "-v")
	command.Env = append(os.Environ(), "LEARNER_ASSESSMENT_TEST_DSN="+dsn.FormatDSN())
	output, err := command.CombinedOutput()
	// Never print raw driver errors: duplicate-value errors can include learner data.
	if err != nil || strings.Contains(string(output), "--- SKIP:") || !strings.Contains(string(output), "--- PASS: TestAssessmentJobRepositoryMySQLConcurrencyAndFencing") {
		privateLog, logErr := os.CreateTemp(os.TempDir(), "ucs-assessment-integration-*.log")
		if logErr == nil {
			_ = privateLog.Chmod(0600)
			_, _ = privateLog.Write(output)
			_ = privateLog.Close()
			return fmt.Errorf("isolated repository integration gate did not pass; private synthetic-test log: %s", filepath.Base(privateLog.Name()))
		}
		return fmt.Errorf("isolated repository integration gate did not pass")
	}
	fmt.Println("PASS isolated repository concurrency, lease fencing, progress timestamps, and ownership integration test; temporary scope removed on exit")
	return nil
}
