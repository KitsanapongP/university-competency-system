package services

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/spw32767/university-competency-system-backend/models"
)

func captureAssessmentLog(t *testing.T) *bytes.Buffer {
	t.Helper()
	var buffer bytes.Buffer
	previous := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&buffer, nil)))
	t.Cleanup(func() { slog.SetDefault(previous) })
	return &buffer
}

func readAssessmentLog(t *testing.T, buffer *bytes.Buffer) []map[string]any {
	t.Helper()
	var entries []map[string]any
	decoder := json.NewDecoder(bytes.NewReader(buffer.Bytes()))
	for {
		var entry map[string]any
		err := decoder.Decode(&entry)
		if errors.Is(err, io.EOF) {
			return entries
		}
		if err != nil {
			t.Fatal(err)
		}
		entries = append(entries, entry)
	}
}

func assertAssessmentLogAllowedFields(t *testing.T, entry map[string]any) {
	t.Helper()
	allowed := map[string]bool{}
	for _, key := range []string{"time", "level", "msg", "job_id", "attempt_count", "error_code", "validation_reason", "output_bytes", "schema_version", "section", "paragraph_index", "sentence_index", "language", "field", "done_reason", "prompt_eval_count", "eval_count"} {
		allowed[key] = true
	}
	for key := range entry {
		if !allowed[key] {
			t.Fatalf("unexpected logged field %q", key)
		}
	}
}

func TestAssessmentRejectionLogSanitizesMetadataAndUnknownErrors(t *testing.T) {
	for _, test := range []struct {
		name string
		err  error
	}{
		{"untyped", errors.New("PRIVATE_ERROR_CONTENT")},
		{"typed", &AssessmentOutputValidationError{Reason: "PRIVATE_REASON", Section: "PRIVATE_SECTION", ParagraphIndex: 2, SentenceIndex: 3, Language: "PRIVATE_LANGUAGE", Field: "PRIVATE_FIELD"}},
	} {
		t.Run(test.name, func(t *testing.T) {
			buffer := captureAssessmentLog(t)
			ctx := withAssessmentJobLogContext(context.Background(), models.AssessmentJob{JobID: 501, AttemptCount: 2, LeaseToken: "PRIVATE_LEASE"})
			logAssessmentOutputRejection(ctx, test.err, -1)
			entries := readAssessmentLog(t, buffer)
			if len(entries) != 1 {
				t.Fatalf("expected one log entry, got %d", len(entries))
			}
			entry := entries[0]
			assertAssessmentLogAllowedFields(t, entry)
			if strings.Contains(buffer.String(), "PRIVATE_") {
				t.Fatal("untrusted metadata exposed in log")
			}
			if entry["validation_reason"] != "validation_unknown" || entry["output_bytes"] != float64(0) || entry["error_code"] != "invalid_output" {
				t.Fatalf("unexpected fallback log: %#v", entry)
			}
			if test.name == "typed" {
				for _, key := range []string{"section", "language", "field"} {
					if entry[key] != "unknown" {
						t.Fatalf("%s not sanitized", key)
					}
				}
			} else {
				for _, key := range []string{"section", "paragraph_index", "sentence_index", "language", "field"} {
					if _, ok := entry[key]; ok {
						t.Fatalf("invented location %s", key)
					}
				}
			}
		})
	}
}

func TestWorkerValidationLogsAndFailureState(t *testing.T) {
	for _, test := range []struct {
		name, raw, reason, errorCode string
		mutate                       func(*models.AssessmentProseOutput)
	}{
		{name: "unknown observation", reason: assessmentReasonObservationUnknown, errorCode: "invalid_output", mutate: func(v *models.AssessmentProseOutput) {
			v.Paragraphs[0].Sentences[0].ObservationID = "PRIVATE_OBSERVATION"
			v.Paragraphs[0].Sentences[0].Text.EN = "PRIVATE_RESPONSE"
		}},
		{name: "unknown section", reason: assessmentReasonUnknownSection, errorCode: "invalid_output", mutate: func(v *models.AssessmentProseOutput) { v.Paragraphs[0].Section = "PRIVATE_SECTION" }},
		{name: "unknown field", raw: `{"paragraphs":[],"PRIVATE_FIELD":"PRIVATE_RESPONSE"}`, reason: assessmentReasonUnknownField, errorCode: "invalid_output"},
		{name: "malformed", raw: `{"paragraphs":"PRIVATE_RESPONSE`, reason: assessmentReasonMalformedJSON, errorCode: "malformed_output"},
		{name: "missing English", reason: assessmentReasonBilingualTextMissing, errorCode: "invalid_output", mutate: func(v *models.AssessmentProseOutput) { v.Paragraphs[0].Sentences[0].Text.EN = "" }},
		{name: "PII", reason: assessmentReasonPIIDetected, errorCode: "invalid_output", mutate: func(v *models.AssessmentProseOutput) {
			v.Paragraphs[0].Sentences[0].Text.EN = "PRIVATE_RESPONSE private@example.test"
		}},
	} {
		t.Run(test.name, func(t *testing.T) {
			buffer := captureAssessmentLog(t)
			payload, job := workerTestJob(t, DefaultAssessmentContextBudget())
			output := workerTestOutput(payload.ProviderInput)
			if test.mutate != nil {
				test.mutate(&output)
			}
			raw := []byte(mustJSON(t, output))
			if test.raw != "" {
				raw = []byte(test.raw)
			}
			provider := &fakeAssessmentProvider{output: raw}
			jobs := &fakeAssessmentWorkerJobs{job: job}
			worker := workerTestInstance(jobs, provider, &fakeAssessmentSourceRebuilder{snapshot: &payload.Source})
			processed, err := worker.ProcessOne(context.Background())
			if err != nil || !processed || jobs.completed != nil || jobs.failedCode != test.errorCode || jobs.retryDelay != 0 || jobs.failureWait != assessmentFailureWait {
				t.Fatalf("unexpected rejection state: processed=%v err=%v failed=%s", processed, err, jobs.failedCode)
			}
			entries := readAssessmentLog(t, buffer)
			if len(entries) != 1 {
				t.Fatalf("expected one rejection log, got %d", len(entries))
			}
			entry := entries[0]
			assertAssessmentLogAllowedFields(t, entry)
			if entry["level"] != "WARN" || entry["msg"] != "assessment output rejected" || entry["job_id"] != float64(job.JobID) || entry["attempt_count"] != float64(job.AttemptCount) || entry["error_code"] != test.errorCode || entry["validation_reason"] != test.reason || entry["output_bytes"] != float64(len(raw)) || entry["schema_version"] != assessmentNarrativeSchemaVersion {
				t.Fatalf("unexpected rejection log: %#v", entry)
			}
			for _, secret := range []string{"PRIVATE_", "private@example.test", job.LeaseToken, "input_snapshot", "enrollment_curriculum_id"} {
				if strings.Contains(buffer.String(), secret) {
					t.Fatalf("log exposed private field or value %q", secret)
				}
			}
			if test.mutate != nil {
				if entry["paragraph_index"] != float64(1) || entry["sentence_index"] != float64(1) {
					t.Fatalf("missing one-based location: %#v", entry)
				}
			} else {
				if _, ok := entry["paragraph_index"]; ok {
					t.Fatal("JSON errors must omit unknown locations")
				}
			}
		})
	}
}

func TestWorkerOllamaUsageAndValidationShareJobContext(t *testing.T) {
	for _, reject := range []bool{false, true} {
		name := "accepted"
		if reject {
			name = "rejected"
		}
		t.Run(name, func(t *testing.T) {
			buffer := captureAssessmentLog(t)
			payload, job := workerTestJob(t, DefaultAssessmentContextBudget())
			output := workerTestOutput(payload.ProviderInput)
			if reject {
				output.Paragraphs[0].Sentences[0].ObservationID = "PRIVATE_RESPONSE"
			}
			raw := mustJSON(t, output)
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				_ = json.NewEncoder(w).Encode(ollamaGenerateResponse{Model: "qwen3:4b", Response: string(raw), Done: true, DoneReason: "stop", PromptEvalCount: 1669, EvalCount: 518})
			}))
			defer server.Close()
			provider := NewOllamaAssessmentProvider(server.URL, "qwen3:4b", time.Second, "5m", false, 512)
			jobs := &fakeAssessmentWorkerJobs{job: job}
			worker := workerTestInstance(jobs, provider, &fakeAssessmentSourceRebuilder{snapshot: &payload.Source})
			if _, err := worker.ProcessOne(context.Background()); err != nil {
				t.Fatal(err)
			}
			entries := readAssessmentLog(t, buffer)
			want := 1
			if reject {
				want = 2
			}
			if len(entries) != want {
				t.Fatalf("expected %d entries, got %d", want, len(entries))
			}
			for _, entry := range entries {
				assertAssessmentLogAllowedFields(t, entry)
				if entry["job_id"] != float64(job.JobID) || entry["attempt_count"] != float64(job.AttemptCount) {
					t.Fatalf("missing shared job context: %#v", entry)
				}
			}
			usage := entries[0]
			if usage["msg"] != "assessment generation usage" || usage["done_reason"] != "stop" || usage["prompt_eval_count"] != float64(1669) || usage["eval_count"] != float64(518) {
				t.Fatalf("generation usage changed: %#v", usage)
			}
			if reject && (entries[1]["msg"] != "assessment output rejected" || jobs.completed != nil || jobs.failedCode != "invalid_output") {
				t.Fatal("rejection did not preserve failure state")
			}
			if !reject && (jobs.completed == nil || jobs.failedCode != "") {
				t.Fatal("accepted output was not saved")
			}
			if strings.Contains(buffer.String(), "PRIVATE_") {
				t.Fatal("model response exposed in correlated logs")
			}
		})
	}
}
