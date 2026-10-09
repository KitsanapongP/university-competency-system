package main

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/spw32767/university-competency-system-backend/config"
	"github.com/spw32767/university-competency-system-backend/repositories"
	"github.com/spw32767/university-competency-system-backend/services"
	"golang.org/x/crypto/bcrypt"
)

type tableData struct {
	columns, primary []string
	rows             map[string]map[string]any
	ddl              string
}

type foreignKey struct {
	child, parent       string
	columns, references []string
}

type sliceLoader struct {
	ctx    context.Context
	tx     *sql.Tx
	tables map[string]*tableData
	keys   []foreignKey
}

func setup(ctx context.Context, source *sql.DB, cfg config.Config, target, email, envPath string) error {
	if err := validatePrivatePath(envPath); err != nil {
		return err
	}
	var exists int
	if err := source.QueryRowContext(ctx, `SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?`, target).Scan(&exists); err != nil {
		return fmt.Errorf("destination preflight failed")
	}
	if exists != 0 {
		return fmt.Errorf("destination already exists; refusing to overwrite it")
	}
	if _, err := os.Stat(envPath); !os.IsNotExist(err) {
		return fmt.Errorf("private environment file already exists or is inaccessible")
	}

	tx, err := source.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return fmt.Errorf("source read-only snapshot failed")
	}
	defer tx.Rollback()
	loader := &sliceLoader{ctx: ctx, tx: tx, tables: map[string]*tableData{}}
	if err := loader.readSchema(cfg.DBName); err != nil {
		return err
	}
	var userID, personID uint64
	if err := tx.QueryRowContext(ctx, `SELECT user_id,person_id FROM auth_users WHERE email=? AND deleted_at IS NULL AND is_active=1`, email).Scan(&userID, &personID); err != nil {
		return fmt.Errorf("active test account not found")
	}
	if err := loader.seed(userID, personID); err != nil {
		return err
	}
	if err := loader.expand(); err != nil {
		return err
	}
	var enrollments int
	for _, row := range loader.tables["kku_enrollments"].rows {
		if valueString(row["person_id"]) != fmt.Sprint(personID) {
			return fmt.Errorf("copy would include another learner; stopped")
		}
		enrollments++
	}
	if enrollments == 0 {
		return fmt.Errorf("test learner has no enrollment")
	}
	testPassword, err := randomSecret()
	if err != nil {
		return err
	}
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(testPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("test password generation failed")
	}
	redactReferenceIdentities(loader.tables, userID, personID, string(passwordHash))

	conn, err := source.Conn(ctx)
	if err != nil {
		return fmt.Errorf("destination admin connection failed")
	}
	defer conn.Close()
	if _, err := conn.ExecContext(ctx, "CREATE DATABASE "+quote(target)+" CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"); err != nil {
		return fmt.Errorf("create isolated database failed")
	}
	if _, err := conn.ExecContext(ctx, "USE "+quote(target)); err != nil {
		return fmt.Errorf("select isolated database failed")
	}
	if _, err := conn.ExecContext(ctx, "SET FOREIGN_KEY_CHECKS=0"); err != nil {
		return fmt.Errorf("schema setup failed")
	}
	defer conn.ExecContext(context.Background(), "SET FOREIGN_KEY_CHECKS=1")
	names := make([]string, 0, len(loader.tables))
	for name := range loader.tables {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		ddl := strings.ReplaceAll(loader.tables[name].ddl, quote(cfg.DBName)+".", quote(target)+".")
		if _, err := conn.ExecContext(ctx, ddl); err != nil {
			return fmt.Errorf("create test schema table %s failed; partial database retained", name)
		}
	}
	for _, name := range names {
		table := loader.tables[name]
		cols := make([]string, len(table.columns))
		placeholders := make([]string, len(cols))
		for i, col := range table.columns {
			cols[i] = quote(col)
			placeholders[i] = "?"
		}
		query := "INSERT INTO " + quote(name) + " (" + strings.Join(cols, ",") + ") VALUES (" + strings.Join(placeholders, ",") + ")"
		for _, row := range table.rows {
			values := make([]any, len(table.columns))
			for i, col := range table.columns {
				values[i] = row[col]
			}
			if _, err := conn.ExecContext(ctx, query, values...); err != nil {
				return fmt.Errorf("copy selected rows for %s failed; partial database retained", name)
			}
		}
		if len(table.rows) > 0 {
			fmt.Printf("COPIED table=%s rows=%d\n", name, len(table.rows))
		}
	}
	for _, key := range loader.keys {
		conditions := []string{}
		nonnull := []string{}
		for i, col := range key.columns {
			conditions = append(conditions, "c."+quote(col)+"=p."+quote(key.references[i]))
			nonnull = append(nonnull, "c."+quote(col)+" IS NOT NULL")
		}
		query := "SELECT COUNT(*) FROM " + quote(key.child) + " c WHERE " + strings.Join(nonnull, " AND ") + " AND NOT EXISTS (SELECT 1 FROM " + quote(key.parent) + " p WHERE " + strings.Join(conditions, " AND ") + ")"
		var missing int
		if err := conn.QueryRowContext(ctx, query).Scan(&missing); err != nil || missing != 0 {
			return fmt.Errorf("foreign key postflight failed for %s", key.child)
		}
	}
	if _, err := conn.ExecContext(ctx, "SET FOREIGN_KEY_CHECKS=1"); err != nil {
		return fmt.Errorf("restore foreign key checks failed")
	}
	dbPass, err := randomSecret()
	if err != nil {
		return err
	}
	jwt, err := randomSecret()
	if err != nil {
		return err
	}
	dbUser := "assessment_test_" + dbPass[:8]
	// Identifiers and hex-only generated credentials never contain SQL delimiters.
	if _, err := conn.ExecContext(ctx, "CREATE USER '"+dbUser+"'@'localhost' IDENTIFIED BY '"+dbPass+"'"); err != nil {
		return fmt.Errorf("create restricted database user failed")
	}
	if _, err := conn.ExecContext(ctx, "GRANT SELECT, INSERT, UPDATE, DELETE ON "+quote(target)+".* TO '"+dbUser+"'@'localhost'"); err != nil {
		return fmt.Errorf("grant isolated database privileges failed")
	}
	testCfg := cfg
	testCfg.DBName = target
	testCfg.DBUser = dbUser
	testCfg.DBPass = dbPass
	dest, err := connect(testCfg)
	if err != nil {
		return err
	}
	defer dest.Close()
	if err := compareSnapshots(ctx, source, dest, userID); err != nil {
		return err
	}
	env := map[string]string{
		"DB_HOST": cfg.DBHost, "DB_PORT": cfg.DBPort, "DB_NAME": target, "DB_USER": dbUser, "DB_PASS": dbPass,
		"JWT_SECRET": jwt, "JWT_ISSUER": "ucs-assessment-test", "JWT_EXPIRE_MINUTES": "120",
		"HTTP_ADDR": "127.0.0.1:8081", "COOKIE_NAME": "ucs_assessment_test_token", "COOKIE_SECURE": "false",
		"LEARNER_ASSESSMENT_CONTEXT_TOKENS": "12288", "LEARNER_ASSESSMENT_OUTPUT_RESERVE_TOKENS": "3072", "LEARNER_ASSESSMENT_TOKEN_SAFETY_MARGIN": "128",
		"LEARNER_ASSESSMENT_OLLAMA_URL": cfg.AssessmentOllamaURL, "LEARNER_ASSESSMENT_OLLAMA_MODEL_DIGEST": cfg.AssessmentOllamaModelDigest,
		"LEARNER_ASSESSMENT_OLLAMA_THINK": "false", "LEARNER_ASSESSMENT_OLLAMA_TIMEOUT_SECONDS": "240", "LEARNER_ASSESSMENT_WORKER_LEASE_SECONDS": "900",
		"ASSESSMENT_TEST_EMAIL": email, "ASSESSMENT_TEST_PASSWORD": testPassword,
	}
	encoded, err := json.Marshal(env)
	if err != nil {
		return err
	}
	file, err := os.OpenFile(envPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		return fmt.Errorf("private config creation failed")
	}
	_, writeErr := file.Write(encoded)
	closeErr := file.Close()
	if writeErr != nil || closeErr != nil {
		return fmt.Errorf("private config write failed")
	}
	fmt.Println("READY isolated database; foreign keys valid; both source snapshots match; private configuration saved outside repository")
	return tx.Commit()
}

func validatePrivatePath(path string) error {
	if path == "" {
		return fmt.Errorf("env-out must be an absolute file path in the OS temporary directory")
	}
	absolute, err := filepath.Abs(path)
	if err != nil || !filepath.IsAbs(path) {
		return fmt.Errorf("invalid private output path")
	}
	rel, err := filepath.Rel(os.TempDir(), absolute)
	if err != nil || rel == "." || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return fmt.Errorf("private config must be outside repository, inside OS temporary directory")
	}
	return nil
}

func randomSecret() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("random credentials failed")
	}
	return hex.EncodeToString(b), nil
}

func valueString(value any) string {
	if b, ok := value.([]byte); ok {
		return string(b)
	}
	return fmt.Sprint(value)
}

func (l *sliceLoader) readSchema(schema string) error {
	rows, err := l.tx.QueryContext(l.ctx, `SELECT c.TABLE_NAME,c.COLUMN_NAME,c.COLUMN_KEY,c.EXTRA FROM information_schema.COLUMNS c JOIN information_schema.TABLES t ON t.TABLE_SCHEMA=c.TABLE_SCHEMA AND t.TABLE_NAME=c.TABLE_NAME WHERE c.TABLE_SCHEMA=? AND t.TABLE_TYPE='BASE TABLE' ORDER BY c.TABLE_NAME,c.ORDINAL_POSITION`, schema)
	if err != nil {
		return fmt.Errorf("schema columns query failed")
	}
	for rows.Next() {
		var name, col, key, extra string
		if err := rows.Scan(&name, &col, &key, &extra); err != nil {
			rows.Close()
			return err
		}
		if !identifier.MatchString(name) || !identifier.MatchString(col) {
			rows.Close()
			return fmt.Errorf("unsupported identifier")
		}
		table := l.tables[name]
		if table == nil {
			table = &tableData{rows: map[string]map[string]any{}}
			l.tables[name] = table
		}
		if !strings.Contains(extra, "STORED GENERATED") && !strings.Contains(extra, "VIRTUAL GENERATED") {
			table.columns = append(table.columns, col)
		}
		if key == "PRI" {
			table.primary = append(table.primary, col)
		}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()
	for name, table := range l.tables {
		var returned string
		if err := l.tx.QueryRowContext(l.ctx, "SHOW CREATE TABLE "+quote(name)).Scan(&returned, &table.ddl); err != nil {
			return fmt.Errorf("table definition query failed for %s", name)
		}
	}
	rows, err = l.tx.QueryContext(l.ctx, `SELECT TABLE_NAME,CONSTRAINT_NAME,COLUMN_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=? AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY TABLE_NAME,CONSTRAINT_NAME,ORDINAL_POSITION`, schema)
	if err != nil {
		return fmt.Errorf("foreign key metadata query failed")
	}
	defer rows.Close()
	last := ""
	for rows.Next() {
		var child, name, col, parent, ref string
		if err := rows.Scan(&child, &name, &col, &parent, &ref); err != nil {
			return err
		}
		id := child + ":" + name
		if id != last {
			l.keys = append(l.keys, foreignKey{child: child, parent: parent})
			last = id
		}
		key := &l.keys[len(l.keys)-1]
		key.columns = append(key.columns, col)
		key.references = append(key.references, ref)
	}
	return rows.Err()
}

func (l *sliceLoader) fetch(tableName, where string, args ...any) error {
	table := l.tables[tableName]
	if table == nil {
		return fmt.Errorf("required table %s is missing", tableName)
	}
	if len(table.primary) == 0 {
		return fmt.Errorf("selected table %s has no primary key", tableName)
	}
	cols := make([]string, len(table.columns))
	for i, col := range table.columns {
		cols[i] = quote(col)
	}
	rows, err := l.tx.QueryContext(l.ctx, "SELECT "+strings.Join(cols, ",")+" FROM "+quote(tableName)+" WHERE "+where, args...)
	if err != nil {
		return fmt.Errorf("selected data query failed for %s", tableName)
	}
	defer rows.Close()
	for rows.Next() {
		values := make([]any, len(cols))
		pointers := make([]any, len(cols))
		for i := range values {
			pointers[i] = &values[i]
		}
		if err := rows.Scan(pointers...); err != nil {
			return fmt.Errorf("selected data scan failed")
		}
		row := map[string]any{}
		for i, col := range table.columns {
			if b, ok := values[i].([]byte); ok {
				row[col] = string(b)
			} else {
				row[col] = values[i]
			}
		}
		pk := make([]string, len(table.primary))
		for i, col := range table.primary {
			pk[i] = valueString(row[col])
		}
		encoded, _ := json.Marshal(pk)
		table.rows[string(encoded)] = row
	}
	return rows.Err()
}

func (l *sliceLoader) seed(userID, personID uint64) error {
	for _, seed := range []struct {
		table, column string
		value         uint64
	}{
		{"auth_users", "user_id", userID}, {"auth_user_roles", "user_id", userID}, {"persons", "person_id", personID}, {"kku_enrollments", "person_id", personID},
		{"att_session_attendances", "person_id", personID}, {"act_session_registrations", "person_id", personID}, {"score_session_competency_scores", "person_id", personID},
	} {
		if err := l.fetch(seed.table, quote(seed.column)+"=?", seed.value); err != nil {
			return err
		}
	}
	return nil
}

// Only these downward edges may include related children. All other expansion follows parents.
var childEdges = []struct{ child, column, parent, reference string }{
	{"kku_enrollment_curricula", "enrollment_id", "kku_enrollments", "enrollment_id"},
	{"crs_course_enrollment", "enrollment_id", "kku_enrollments", "enrollment_id"},
	{"score_competency_result", "enrollment_id", "kku_enrollments", "enrollment_id"},
	{"ele_course_enrollments", "enrollment_id", "kku_enrollments", "enrollment_id"},
	{"crs_coop_requirement_sets", "curriculum_id", "edu_curricula", "curriculum_id"},
	{"crs_coop_requirements", "requirement_set_id", "crs_coop_requirement_sets", "requirement_set_id"},
	{"crs_course_categories", "curriculum_id", "edu_curricula", "curriculum_id"},
	{"crs_curriculum_courses", "category_id", "crs_course_categories", "category_id"},
	{"curri_template_assignments", "cohort_id", "edu_student_cohorts", "cohort_id"},
	{"comp_template_items", "template_id", "comp_templates", "template_id"},
	{"comp_template_categories", "template_id", "comp_templates", "template_id"},
	{"comp_template_courses", "template_id", "comp_templates", "template_id"},
	{"ele_course_grades", "round_course_enrollment_id", "ele_course_enrollments", "round_course_enrollment_id"},
	{"ele_round_course_competencies", "round_course_id", "ele_round_courses", "round_course_id"},
	{"score_course_competency_scores", "course_student_id", "crs_course_enrollment", "course_student_id"},
	{"ele_course_scores", "grade_record_id", "ele_course_grades", "grade_record_id"},
	{"act_session_competencies", "session_id", "act_sessions", "session_id"},
	{"score_session_competency_results", "score_id", "score_session_competency_scores", "session_competency_score_id"},
}

func (l *sliceLoader) count() int {
	n := 0
	for _, table := range l.tables {
		n += len(table.rows)
	}
	return n
}

func (l *sliceLoader) expand() error {
	queried := map[string]bool{}
	for pass := 0; pass < 100; pass++ {
		before := l.count()
		for _, edge := range childEdges {
			parent := l.tables[edge.parent]
			if parent == nil || l.tables[edge.child] == nil {
				continue
			}
			for _, row := range parent.rows {
				value := row[edge.reference]
				if value == nil {
					continue
				}
				key := edge.child + ":" + edge.column + ":" + valueString(value)
				if queried[key] {
					continue
				}
				queried[key] = true
				if err := l.fetch(edge.child, quote(edge.column)+"=?", value); err != nil {
					return err
				}
			}
		}
		for _, key := range l.keys {
			child := l.tables[key.child]
			if child == nil {
				continue
			}
			for _, row := range child.rows {
				args := []any{}
				conditions := []string{}
				for i, col := range key.columns {
					if row[col] == nil {
						args = nil
						break
					}
					args = append(args, row[col])
					conditions = append(conditions, quote(key.references[i])+"=?")
				}
				if len(args) == 0 {
					continue
				}
				encoded, _ := json.Marshal(args)
				id := key.parent + ":" + strings.Join(key.references, ",") + ":" + string(encoded)
				if queried[id] {
					continue
				}
				queried[id] = true
				if err := l.fetch(key.parent, strings.Join(conditions, " AND "), args...); err != nil {
					return err
				}
			}
		}
		if l.count() == before {
			return nil
		}
		if l.count() > 25000 {
			return fmt.Errorf("selected data exceeds safety limit")
		}
	}
	return fmt.Errorf("foreign key expansion did not converge")
}

func redactReferenceIdentities(tables map[string]*tableData, userID, personID uint64, hash string) {
	for _, row := range tables["auth_users"].rows {
		row["password_hash"] = hash
		if valueString(row["user_id"]) != fmt.Sprint(userID) {
			id := valueString(row["user_id"])
			row["username"] = "test_reference_" + id
			row["email"] = "reference_" + id + "@invalid.test"
			row["display_name"] = "Test reference"
			row["is_active"] = 0
			row["last_login_at"] = nil
		}
	}
	for _, row := range tables["persons"].rows {
		row["national_id"] = nil
		row["passport_no"] = nil
		row["phone"] = nil
		if valueString(row["person_id"]) != fmt.Sprint(personID) {
			for _, col := range []string{"prefix_th", "prefix_en", "first_name_th", "last_name_th", "first_name_en", "last_name_en"} {
				if _, ok := row[col]; ok {
					row[col] = "Test reference"
				}
			}
			row["email"] = nil
		}
	}
}

func compareSnapshots(ctx context.Context, source, target *sql.DB, userID uint64) error {
	builder := func(db *sql.DB) *services.AssessmentSourceBuilder {
		return services.NewAssessmentSourceBuilder(db, repositories.NewAssessmentSourceRepository(db), repositories.NewCooperativeReadinessRepository(db), repositories.NewCurriculumRepository(db))
	}
	for _, semester := range []uint{1, 2} {
		a, err := builder(source).Build(ctx, userID, semester)
		if err != nil {
			return fmt.Errorf("source snapshot failed for semester %d", semester)
		}
		b, err := builder(target).Build(ctx, userID, semester)
		if err != nil {
			return fmt.Errorf("test snapshot failed for semester %d", semester)
		}
		if a.Metadata.SourceHash != b.Metadata.SourceHash {
			return fmt.Errorf("source snapshot mismatch for semester %d", semester)
		}
		fmt.Printf("VERIFIED semester=%d academic_records=%d competencies=%d activities=%d\n", semester, len(b.AcademicEvidence), len(b.CourseScores), len(b.ActivityEvidence))
	}
	return nil
}
