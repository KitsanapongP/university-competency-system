package controllers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-sql-driver/mysql"
	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
	"github.com/spw32767/university-competency-system-backend/services"
	"github.com/spw32767/university-competency-system-backend/utils"
)

func TestLearnerAssessmentInternalErrorLogsOnlySafeCategories(t *testing.T) {
	var logs bytes.Buffer
	previous := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&logs, nil)))
	t.Cleanup(func() { slog.SetDefault(previous) })
	private := "private-student@example.local secret-api-key"
	for _, test := range []struct {
		name     string
		err      error
		category string
	}{
		{"database", fmt.Errorf("load assessment curriculum names: %w", &mysql.MySQLError{Number: 1054, Message: private}), "database"},
		{"internal", errors.New(private), "internal"},
	} {
		t.Run(test.name, func(t *testing.T) {
			logs.Reset()
			handler := &LearnerAssessmentController{Service: &learnerAssessmentReportServiceStub{getErr: test.err}}
			response := learnerAssessmentRequest(handler.GetReport, http.MethodGet, "/?semester=1", "", true)
			if response.Code != http.StatusInternalServerError {
				t.Fatalf("expected 500, got %d", response.Code)
			}
			var entry map[string]any
			if err := json.Unmarshal(logs.Bytes(), &entry); err != nil {
				t.Fatal(err)
			}
			if entry["error_type"] != test.category || entry["operation"] != "assessment_report" {
				t.Fatalf("unexpected diagnostic: %v", entry)
			}
			if test.category == "database" && entry["mysql_error_number"] != float64(1054) {
				t.Fatalf("missing MySQL error number: %v", entry)
			}
			for _, sensitive := range []string{private, "secret-api-key", "private-student", "load assessment curriculum names"} {
				if strings.Contains(logs.String(), sensitive) || strings.Contains(response.Body.String(), sensitive) {
					t.Fatal("diagnostic exposed private error details")
				}
			}
		})
	}
}

type learnerAssessmentReportServiceStub struct {
	getState         models.AssessmentReportState
	getErr           error
	generateState    models.AssessmentReportState
	generateErr      error
	getUserID        uint64
	getSemester      uint
	generateUserID   uint64
	generateSemester uint
	generateForce    bool
}

func (s *learnerAssessmentReportServiceStub) Get(_ context.Context, userID uint64, semester uint) (models.AssessmentReportState, error) {
	s.getUserID, s.getSemester = userID, semester
	return s.getState, s.getErr
}

func (s *learnerAssessmentReportServiceStub) Generate(_ context.Context, userID uint64, semester uint, force bool) (models.AssessmentReportState, error) {
	s.generateUserID, s.generateSemester, s.generateForce = userID, semester, force
	return s.generateState, s.generateErr
}

type learnerAssessmentJobReaderStub struct {
	job    models.AssessmentJob
	err    error
	userID uint64
	jobID  uint64
}

func (s *learnerAssessmentJobReaderStub) GetForUser(_ context.Context, userID, jobID uint64) (models.AssessmentJob, error) {
	s.userID, s.jobID = userID, jobID
	return s.job, s.err
}

func TestLearnerAssessmentGetValidatesSemesterAndUsesAuthenticatedOwner(t *testing.T) {
	service := &learnerAssessmentReportServiceStub{getState: models.AssessmentReportState{GenerationState: services.AssessmentReportCurrent}}
	handler := &LearnerAssessmentController{Service: service}

	invalid := learnerAssessmentRequest(handler.GetReport, http.MethodGet, "/?semester=3", "", true)
	if invalid.Code != http.StatusBadRequest {
		t.Fatalf("expected invalid semester 400, got %d", invalid.Code)
	}

	valid := learnerAssessmentRequest(handler.GetReport, http.MethodGet, "/?semester=2", "", true)
	if valid.Code != http.StatusOK || service.getUserID != 42 || service.getSemester != 2 {
		t.Fatalf("expected authenticated learner report 200, got status=%d user=%d semester=%d", valid.Code, service.getUserID, service.getSemester)
	}
}

func TestLearnerAssessmentGenerateAcceptsOnlySemesterAndForce(t *testing.T) {
	service := &learnerAssessmentReportServiceStub{generateState: models.AssessmentReportState{GenerationState: services.AssessmentReportQueued}}
	handler := &LearnerAssessmentController{Service: service}

	badBody := learnerAssessmentRequest(handler.GenerateReport, http.MethodPost, "/", `{"semester":1,"user_id":3}`, true)
	if badBody.Code != http.StatusBadRequest {
		t.Fatalf("expected unknown input field rejected, got %d", badBody.Code)
	}

	response := learnerAssessmentRequest(handler.GenerateReport, http.MethodPost, "/", `{"semester":1,"force":true}`, true)
	if response.Code != http.StatusAccepted || service.generateUserID != 42 || service.generateSemester != 1 || !service.generateForce {
		t.Fatalf("unexpected generate result: status=%d user=%d semester=%d force=%v", response.Code, service.generateUserID, service.generateSemester, service.generateForce)
	}
}

func TestLearnerAssessmentCooldownIncludesRetryAfter(t *testing.T) {
	service := &learnerAssessmentReportServiceStub{
		generateErr: services.AssessmentReportCooldownError{RetryAfterSeconds: 27},
	}
	handler := &LearnerAssessmentController{Service: service}
	response := learnerAssessmentRequest(handler.GenerateReport, http.MethodPost, "/", `{"semester":2,"force":true}`, true)
	if response.Code != http.StatusTooManyRequests || response.Header().Get("Retry-After") != "27" {
		t.Fatalf("expected 429 with retry-after, got status=%d header=%q", response.Code, response.Header().Get("Retry-After"))
	}
	if strings.Contains(response.Body.String(), "provider") {
		t.Fatalf("cooldown response unexpectedly exposes provider details: %s", response.Body.String())
	}
}

func TestLearnerAssessmentJobLookupIsScopedToAuthenticatedUser(t *testing.T) {
	jobs := &learnerAssessmentJobReaderStub{err: repositories.ErrAssessmentJobNotFound}
	handler := &LearnerAssessmentController{Jobs: jobs}
	router := chi.NewRouter()
	router.Get("/jobs/{job_id}", handler.GetJob)
	request := httptest.NewRequest(http.MethodGet, "/jobs/91", nil)
	request = request.WithContext(utils.WithClaims(request.Context(), &utils.Claims{UserID: 42, Roles: []string{"learner"}}))
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusNotFound || jobs.userID != 42 || jobs.jobID != 91 {
		t.Fatalf("expected owner-scoped 404, got status=%d user=%d job=%d", response.Code, jobs.userID, jobs.jobID)
	}
}

func TestLearnerAssessmentJobResponseIncludesProgressAndServerClock(t *testing.T) {
	phaseStartedAt := time.Date(2026, time.October, 3, 9, 0, 0, 0, time.UTC)
	lastActivityAt := phaseStartedAt.Add(12 * time.Second)
	jobs := &learnerAssessmentJobReaderStub{
		job: models.AssessmentJob{
			JobID:                  91,
			Status:                 "running",
			ProgressPhase:          "generating",
			PhaseStartedAt:         &phaseStartedAt,
			LastProviderActivityAt: &lastActivityAt,
			AttemptCount:           2,
			MaxAttempts:            3,
			RequestedAt:            phaseStartedAt.Add(-time.Minute),
		},
	}
	handler := &LearnerAssessmentController{Jobs: jobs}
	router := chi.NewRouter()
	router.Get("/jobs/{job_id}", handler.GetJob)
	request := httptest.NewRequest(http.MethodGet, "/jobs/91", nil)
	request = request.WithContext(utils.WithClaims(request.Context(), &utils.Claims{UserID: 42, Roles: []string{"learner"}}))
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", response.Code, response.Body.String())
	}
	var payload struct {
		Data models.AssessmentJob `json:"data"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Data.ProgressPhase != "generating" || payload.Data.PhaseStartedAt == nil || payload.Data.LastProviderActivityAt == nil {
		t.Fatalf("progress metadata missing from response: %+v", payload.Data)
	}
	if payload.Data.AttemptCount != 2 || payload.Data.MaxAttempts != 3 || payload.Data.ServerTime == nil {
		t.Fatalf("retry or server clock metadata missing from response: %+v", payload.Data)
	}
}

func TestLearnerAssessmentRejectsMissingClaims(t *testing.T) {
	handler := &LearnerAssessmentController{}
	request := httptest.NewRequest(http.MethodGet, "/?semester=1", nil)
	response := httptest.NewRecorder()
	handler.GetReport(response, request)
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", response.Code)
	}
}

func learnerAssessmentRequest(
	handler http.HandlerFunc,
	method string,
	path string,
	body string,
	withClaims bool,
) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, path, strings.NewReader(body))
	if withClaims {
		request = request.WithContext(utils.WithClaims(request.Context(), &utils.Claims{UserID: 42, Roles: []string{"learner"}}))
	}
	response := httptest.NewRecorder()
	handler(response, request)
	return response
}
