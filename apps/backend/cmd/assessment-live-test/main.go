package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/spw32767/university-competency-system-backend/config"
	appdb "github.com/spw32767/university-competency-system-backend/db"
	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/services"
)

const baseURL = "http://127.0.0.1:8081/api/v1"

type apiEnvelope struct {
	Success bool            `json:"success"`
	Data    json.RawMessage `json:"data"`
	Error   struct {
		Code       string `json:"code"`
		RetryAfter int    `json:"retry_after_seconds"`
	} `json:"error"`
}

type liveRun struct {
	Semester       uint    `json:"semester"`
	Round          int     `json:"round"`
	JobID          uint64  `json:"job_id"`
	AttemptCount   uint    `json:"attempt_count"`
	Status         string  `json:"status"`
	ErrorCode      string  `json:"error_code,omitempty"`
	ElapsedSeconds float64 `json:"elapsed_seconds"`
	PromptVersion  string  `json:"prompt_version,omitempty"`
	ParagraphCount int     `json:"paragraph_count"`
}

func main() {
	privatePath := flag.String("private-config", "", "setup-generated private JSON file in OS temporary directory")
	repeat := flag.Int("repeat", 1, "fresh generations per semester (1-3)")
	minutes := flag.Int("minutes", 90, "total deadline, including compilation and cooldown (1-90)")
	keepServing := flag.Bool("keep-serving", false, "keep owned servers available for UI review until deadline or interrupt")
	integrationOnly := flag.Bool("integration-only", false, "run repository integration tests with a temporary unused test scope, without Ollama")
	stopFile := flag.String("stop-file", "", "optional new OS temporary marker path for graceful Windows shutdown")
	flag.Parse()
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	ctx, cancel := context.WithTimeout(ctx, time.Duration(*minutes)*time.Minute)
	defer cancel()
	if *stopFile != "" {
		rel, err := filepath.Rel(os.TempDir(), *stopFile)
		if !filepath.IsAbs(*stopFile) || err != nil || rel == "." || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
			fmt.Fprintln(os.Stderr, "stop-file must be in OS temporary directory")
			os.Exit(1)
		}
		if _, err := os.Stat(*stopFile); !os.IsNotExist(err) {
			fmt.Fprintln(os.Stderr, "stop-file already exists or is inaccessible")
			os.Exit(1)
		}
		go func() {
			ticker := time.NewTicker(time.Second)
			defer ticker.Stop()
			for {
				select {
				case <-ctx.Done():
					return
				case <-ticker.C:
					if _, err := os.Stat(*stopFile); err == nil {
						cancel()
						return
					}
				}
			}
		}()
	}
	if *repeat < 1 || *repeat > 3 || *minutes < 1 || *minutes > 90 {
		fmt.Fprintln(os.Stderr, "invalid bounded test settings")
		os.Exit(1)
	}
	var err error
	if *integrationOnly {
		err = integration(ctx, *privatePath)
	} else {
		err = run(ctx, *privatePath, *repeat, *keepServing)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func privateConfig(path string) (map[string]string, error) {
	if !filepath.IsAbs(path) {
		return nil, fmt.Errorf("private config must be an absolute OS temporary path")
	}
	rel, err := filepath.Rel(os.TempDir(), path)
	if err != nil || rel == "." || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return nil, fmt.Errorf("private config must be outside repository")
	}
	raw, err := os.ReadFile(path)
	if err != nil || len(raw) > 65536 {
		return nil, fmt.Errorf("private config unavailable")
	}
	var values map[string]string
	if json.Unmarshal(raw, &values) != nil {
		return nil, fmt.Errorf("invalid private config")
	}
	if !strings.HasSuffix(values["DB_NAME"], "_test") || values["DB_USER"] == "" || values["DB_PASS"] == "" || values["ASSESSMENT_TEST_PASSWORD"] == "" {
		return nil, fmt.Errorf("isolated test credentials required")
	}
	if !localURL(values["LEARNER_ASSESSMENT_OLLAMA_URL"]) {
		return nil, fmt.Errorf("refusing to send learner data to a non-loopback provider")
	}
	values["HTTP_ADDR"] = "127.0.0.1:8081"
	values["FRONTEND_ORIGIN"] = "http://127.0.0.1:3101"
	return values, nil
}

func localURL(value string) bool {
	parsed, err := url.Parse(value)
	if err != nil || parsed.Scheme != "http" || parsed.User != nil {
		return false
	}
	host := parsed.Hostname()
	return host == "localhost" || host == "127.0.0.1" || host == "::1"
}

func run(ctx context.Context, path string, repeats int, keepServing bool) error {
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
	db, err := appdb.NewMySQL(cfg)
	if err != nil {
		return fmt.Errorf("isolated test database connection failed")
	}
	defer db.Close()
	var actual string
	if err := db.QueryRowContext(ctx, "SELECT DATABASE()").Scan(&actual); err != nil || actual != values["DB_NAME"] {
		return fmt.Errorf("isolated database verification failed")
	}
	var grantUser string
	if err := db.QueryRowContext(ctx, "SELECT CURRENT_USER()").Scan(&grantUser); err != nil || !strings.HasPrefix(grantUser, "assessment_test_") {
		return fmt.Errorf("restricted test database user required")
	}
	digest, err := services.ResolveOllamaModelDigest(ctx, cfg.AssessmentOllamaURL, services.DefaultAssessmentModel())
	if err != nil {
		return fmt.Errorf("local Ollama model preflight failed")
	}
	if cfg.AssessmentOllamaModelDigest != "" && cfg.AssessmentOllamaModelDigest != digest {
		return fmt.Errorf("model digest differs from pinned setup configuration")
	}
	values["LEARNER_ASSESSMENT_OLLAMA_MODEL_DIGEST"] = digest
	_ = os.Setenv("LEARNER_ASSESSMENT_OLLAMA_MODEL_DIGEST", digest)
	listener, err := net.Listen("tcp", "127.0.0.1:8081")
	if err != nil {
		return fmt.Errorf("test port 8081 is occupied; no existing process was stopped")
	}
	listener.Close()
	artifacts, err := os.MkdirTemp(os.TempDir(), "ucs-assessment-live-")
	if err != nil {
		return fmt.Errorf("private artifacts directory creation failed")
	}
	fmt.Printf("PREFLIGHT model=%s digest=%s context=%d output=%d safety=%d think=%t\n", services.DefaultAssessmentModel(), digest, cfg.AssessmentContextTokens, cfg.AssessmentOutputReserveTokens, cfg.AssessmentTokenSafetyMargin, cfg.AssessmentOllamaThink)
	fmt.Printf("PRIVATE_ARTIFACTS %s\n", artifacts)
	for _, name := range []string{"api", "assessment-worker"} {
		build := exec.CommandContext(ctx, "go", "build", "-o", filepath.Join(artifacts, name+".exe"), "./cmd/"+name)
		if err := build.Run(); err != nil {
			return fmt.Errorf("test %s compilation failed", name)
		}
	}
	serverCtx, stopServers := context.WithCancel(ctx)
	defer stopServers()
	start := func(name string) (func(), error) {
		logFile, err := os.OpenFile(filepath.Join(artifacts, name+".log"), os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
		if err != nil {
			return nil, fmt.Errorf("test log setup failed")
		}
		cmd := exec.CommandContext(serverCtx, filepath.Join(artifacts, name+".exe"))
		cmd.Stdout, cmd.Stderr = logFile, logFile
		if err := cmd.Start(); err != nil {
			logFile.Close()
			return nil, fmt.Errorf("test process start failed")
		}
		return func() {
			if cmd.Process != nil {
				_ = cmd.Process.Kill()
			}
			_ = cmd.Wait()
			_ = logFile.Close()
		}, nil
	}
	stopAPI, err := start("api")
	if err != nil {
		return err
	}
	defer stopAPI()
	stopWorker, err := start("assessment-worker")
	if err != nil {
		return err
	}
	defer stopWorker()
	jar, _ := cookiejar.New(nil)
	client := &http.Client{Jar: jar, Timeout: 20 * time.Second}
	ready := false
	for i := 0; i < 60; i++ {
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+"/auth/me", nil)
		response, err := client.Do(req)
		if err == nil {
			response.Body.Close()
			ready = true
			break
		}
		if err := pause(ctx, time.Second); err != nil {
			return err
		}
	}
	if !ready {
		return fmt.Errorf("test API did not become available; inspect private API log")
	}
	if _, _, err := request(ctx, client, http.MethodPost, "/auth/login", map[string]string{"email": values["ASSESSMENT_TEST_EMAIL"], "password": values["ASSESSMENT_TEST_PASSWORD"]}); err != nil {
		return fmt.Errorf("test account login failed")
	}
	fmt.Println("AUTHENTICATED isolated learner session; API and worker owned by harness")
	var runs []liveRun
	failed := false
	for round := 1; round <= repeats; round++ {
		for _, semester := range []uint{1, 2} {
			result, err := generate(ctx, client, db, artifacts, semester, round)
			runs = append(runs, result)
			if saveErr := savePrivate(filepath.Join(artifacts, "summary.json"), runs); saveErr != nil {
				return saveErr
			}
			fmt.Printf("RESULT semester=%d round=%d job_id=%d attempts=%d status=%s error_code=%s elapsed=%.1fs paragraphs=%d prompt=%s\n", result.Semester, result.Round, result.JobID, result.AttemptCount, result.Status, result.ErrorCode, result.ElapsedSeconds, result.ParagraphCount, result.PromptVersion)
			if err != nil {
				return err
			}
			if result.Status != "succeeded" || result.AttemptCount != 1 {
				failed = true
			}
		}
		if failed {
			break
		}
	}
	fmt.Printf("SUMMARY generated=%d first_attempt_gate=%t semantic_review=pending\n", len(runs), !failed && len(runs) == repeats*2)
	if keepServing {
		fmt.Println("UI_REVIEW API remains on 8081 until interrupt/deadline; do not print private report artifacts")
		<-ctx.Done()
	}
	if failed {
		return fmt.Errorf("live validation gate failed; no rejected output was saved or repaired")
	}
	return nil
}

func request(ctx context.Context, client *http.Client, method, path string, payload any) (apiEnvelope, int, error) {
	var body io.Reader
	if payload != nil {
		encoded, err := json.Marshal(payload)
		if err != nil {
			return apiEnvelope{}, 0, fmt.Errorf("request encoding failed")
		}
		body = bytes.NewReader(encoded)
	}
	req, err := http.NewRequestWithContext(ctx, method, baseURL+path, body)
	if err != nil {
		return apiEnvelope{}, 0, fmt.Errorf("request setup failed")
	}
	req.Header.Set("Content-Type", "application/json")
	response, err := client.Do(req)
	if err != nil {
		return apiEnvelope{}, 0, fmt.Errorf("test API request unavailable")
	}
	defer response.Body.Close()
	var envelope apiEnvelope
	if err := json.NewDecoder(io.LimitReader(response.Body, 8<<20)).Decode(&envelope); err != nil {
		return envelope, response.StatusCode, fmt.Errorf("invalid test API response")
	}
	if response.StatusCode == 429 {
		if envelope.Error.RetryAfter == 0 {
			envelope.Error.RetryAfter, _ = strconv.Atoi(response.Header.Get("Retry-After"))
		}
		return envelope, 429, nil
	}
	if response.StatusCode >= 400 || !envelope.Success {
		return envelope, response.StatusCode, fmt.Errorf("test API rejected request (HTTP %d)", response.StatusCode)
	}
	return envelope, response.StatusCode, nil
}

func generate(ctx context.Context, client *http.Client, db *sql.DB, artifacts string, semester uint, round int) (result liveRun, err error) {
	result = liveRun{Semester: semester, Round: round, Status: "incomplete"}
	started := time.Now()
	defer func() { result.ElapsedSeconds = time.Since(started).Seconds() }()
	var state models.AssessmentReportState
	for {
		envelope, status, err := request(ctx, client, http.MethodPost, "/learner/assessment-report/generate", map[string]any{"semester": semester, "force": true})
		if err != nil {
			return result, err
		}
		if status == 429 {
			wait := envelope.Error.RetryAfter
			if wait < 1 || wait > 300 {
				return result, fmt.Errorf("invalid cooldown from API")
			}
			fmt.Printf("COOLDOWN semester=%d seconds=%d\n", semester, wait)
			if err := pause(ctx, time.Duration(wait)*time.Second); err != nil {
				return result, err
			}
			continue
		}
		if err := json.Unmarshal(envelope.Data, &state); err != nil {
			return result, fmt.Errorf("invalid report state")
		}
		break
	}
	if state.Job == nil {
		return result, fmt.Errorf("generation did not enqueue a fresh job (state=%s)", state.GenerationState)
	}
	result.JobID = state.Job.JobID
	lastPhase := ""
	for {
		envelope, _, err := request(ctx, client, http.MethodGet, fmt.Sprintf("/learner/assessment-report/jobs/%d", result.JobID), nil)
		if err != nil {
			return result, err
		}
		var job models.AssessmentJob
		if json.Unmarshal(envelope.Data, &job) != nil {
			return result, fmt.Errorf("invalid job response")
		}
		if job.ProgressPhase != lastPhase {
			fmt.Printf("PROGRESS job_id=%d phase=%s attempts=%d\n", job.JobID, job.ProgressPhase, job.AttemptCount)
			lastPhase = job.ProgressPhase
		}
		result.AttemptCount = job.AttemptCount
		if job.Status == "succeeded" || job.Status == "failed" || job.Status == "superseded" {
			result.Status = job.Status
			result.ErrorCode = job.ErrorCode
			break
		}
		if err := pause(ctx, 3*time.Second); err != nil {
			return result, err
		}
	}
	result.ElapsedSeconds = time.Since(started).Seconds()
	if result.Status != "succeeded" {
		return result, nil
	}
	envelope, _, err := request(ctx, client, http.MethodGet, fmt.Sprintf("/learner/assessment-report?semester=%d", semester), nil)
	if err != nil {
		return result, err
	}
	if json.Unmarshal(envelope.Data, &state) != nil || state.Report == nil || state.GenerationState != "current" {
		return result, fmt.Errorf("completed report is not current")
	}
	var stored string
	if err := db.QueryRowContext(ctx, `SELECT report_content FROM ai_learner_reports WHERE enrollment_curriculum_id=(SELECT enrollment_curriculum_id FROM ai_report_jobs WHERE job_id=?) AND semester=?`, result.JobID, semester).Scan(&stored); err != nil {
		return result, fmt.Errorf("saved report verification failed")
	}
	var report models.AssessmentProseReport
	if json.Unmarshal([]byte(stored), &report) != nil {
		return result, fmt.Errorf("saved report invalid")
	}
	var returned models.AssessmentProseReport
	if json.Unmarshal(state.Report.Content, &returned) != nil || !reflect.DeepEqual(report, returned) {
		return result, fmt.Errorf("API report differs from saved report")
	}
	result.ParagraphCount = len(report.Narrative.Strengths) + len(report.Narrative.Development) + len(report.Narrative.Observations)
	if result.ParagraphCount == 0 {
		return result, fmt.Errorf("empty model narrative does not pass live quality gate")
	}
	result.PromptVersion = state.Report.PromptVersion
	if err := savePrivate(filepath.Join(artifacts, fmt.Sprintf("report-%d-%d.json", semester, round)), state); err != nil {
		return result, err
	}
	return result, nil
}

func pause(ctx context.Context, duration time.Duration) error {
	timer := time.NewTimer(duration)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return fmt.Errorf("bounded live test interrupted or deadline reached")
	case <-timer.C:
		return nil
	}
}

func savePrivate(path string, value any) error {
	encoded, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return fmt.Errorf("private artifact encoding failed")
	}
	if err := os.WriteFile(path, encoded, 0600); err != nil {
		return fmt.Errorf("private artifact save failed")
	}
	return nil
}
