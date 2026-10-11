package services

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
)

func testAssessmentStream(t *testing.T, body string, logs *bytes.Buffer) ([]byte, error) {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = fmt.Fprint(w, body)
	}))
	t.Cleanup(server.Close)
	provider := NewAPIAssessmentProvider("kku", "test-model", "private-key", 5*time.Second, 5*time.Second, 4096)
	provider.endpoint = server.URL
	ctx := context.WithValue(context.Background(), assessmentLogContextKey{}, slog.New(slog.NewJSONHandler(logs, nil)))
	return provider.Generate(ctx, "private-system", "private-user", json.RawMessage(`{}`))
}

func assessmentChatFrame(content string) string {
	event, _ := json.Marshal(map[string]any{"choices": []any{map[string]any{"delta": map[string]string{"content": content}, "finish_reason": "stop"}}})
	return "data: " + string(event) + "\n\n"
}

func TestAssessmentStreamAcceptsLargeOverheadWithSmallAnswer(t *testing.T) {
	reasoning := "private-reasoning " + strings.Repeat("r", 150)
	event, _ := json.Marshal(map[string]any{"choices": []any{map[string]any{"delta": map[string]string{"reasoning": reasoning}}}})
	body := strings.Repeat("data: "+string(event)+"\n\n", 2000) + assessmentChatFrame("{}") + "data: [DONE]\n\n"
	if len(body) <= assessmentAPIOutputLimit || len(body) >= assessmentAPIStreamLimit {
		t.Fatal("fixture does not exercise separate stream and answer limits")
	}
	var logs bytes.Buffer
	output, err := testAssessmentStream(t, body, &logs)
	if err != nil || string(output) != "{}" {
		t.Fatalf("SSE overhead was incorrectly treated as answer size: %v", err)
	}
	for _, private := range []string{"private-reasoning", "private-key", "private-system", "private-user"} {
		if strings.Contains(logs.String(), private) {
			t.Fatal("response diagnostics leaked private content")
		}
	}
	if !strings.Contains(logs.String(), `"answer_bytes":2`) {
		t.Fatal("successful response is missing size diagnostics")
	}
}

func TestAssessmentStreamRawByteBoundaries(t *testing.T) {
	for _, newline := range []string{"\n", "\r\n"} {
		for _, extra := range []int{0, 1} {
			t.Run(fmt.Sprintf("newline=%q extra=%d", newline, extra), func(t *testing.T) {
				final := strings.ReplaceAll(assessmentChatFrame("{}"), "\n", newline)
				padding := assessmentAPIStreamLimit + extra - len(final) - 1 - len(newline)
				body := ":" + strings.Repeat(" ", padding) + newline + final
				var logs bytes.Buffer
				output, err := testAssessmentStream(t, body, &logs)
				if extra == 0 {
					if err != nil || string(output) != "{}" {
						t.Fatalf("exact raw-byte limit should pass: %v", err)
					}
					return
				}
				assertAssessmentStreamLimit(t, output, err, &logs, "stream")
			})
		}
	}
}

func TestAssessmentStreamRejectsOversizedLineAndUnterminatedEOF(t *testing.T) {
	for _, suffix := range []string{"\n\n", ""} {
		t.Run(fmt.Sprintf("suffix=%q", suffix), func(t *testing.T) {
			var logs bytes.Buffer
			output, err := testAssessmentStream(t, ":"+strings.Repeat(" ", assessmentAPIStreamLimit)+suffix, &logs)
			assertAssessmentStreamLimit(t, output, err, &logs, "stream")
		})
	}
}

func TestAssessmentStreamAnswerByteBoundaries(t *testing.T) {
	for _, extra := range []int{0, 1} {
		t.Run(fmt.Sprint(extra), func(t *testing.T) {
			var logs bytes.Buffer
			answer := strings.Repeat("x", assessmentAPIOutputLimit+extra)
			output, err := testAssessmentStream(t, assessmentChatFrame(answer), &logs)
			if extra == 0 {
				if err != nil || string(output) != answer {
					t.Fatalf("exact answer limit should pass: %v", err)
				}
				return
			}
			assertAssessmentStreamLimit(t, output, err, &logs, "answer")
		})
	}
}

func TestAssessmentStreamChecksCumulativeAnswerBeforeAppend(t *testing.T) {
	first := assessmentChatFrame(strings.Repeat("x", assessmentAPIOutputLimit))
	var logs bytes.Buffer
	output, err := testAssessmentStream(t, first+assessmentChatFrame("private-overflow"), &logs)
	assertAssessmentStreamLimit(t, output, err, &logs, "answer")
	if len(output) != assessmentAPIOutputLimit || strings.Contains(logs.String(), "private-overflow") {
		t.Fatal("overflow delta was retained or logged")
	}
}

func assertAssessmentStreamLimit(t *testing.T, output []byte, err error, logs *bytes.Buffer, kind string) {
	t.Helper()
	var failure AssessmentProviderError
	if !errors.As(err, &failure) || failure.Code != "output_too_large" || failure.HTTPStatus != 200 || failure.Retryable {
		t.Fatalf("unexpected limit failure: %v", err)
	}
	if len(output) > assessmentAPIOutputLimit {
		t.Fatalf("returned answer exceeds limit: %d", len(output))
	}
	var entry map[string]any
	if err := json.Unmarshal(logs.Bytes(), &entry); err != nil {
		t.Fatal(err)
	}
	if entry["limit_kind"] != kind || entry["observed_bytes"].(float64) <= entry["limit_bytes"].(float64) {
		t.Fatalf("missing or incorrect limit diagnostic: %v", entry)
	}
	if entry["stream_bytes"] == nil || entry["answer_bytes"] == nil {
		t.Fatal("missing response byte counts")
	}
}
