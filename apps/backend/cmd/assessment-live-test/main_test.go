package main

import (
	"context"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestProviderMustBeLoopback(t *testing.T) {
	for _, value := range []string{"https://example.com", "http://127.0.0.1.evil.test", "http://user:secret@127.0.0.1:11434", "file:///tmp/model"} {
		if localURL(value) {
			t.Fatal("non-local provider accepted")
		}
	}
	for _, value := range []string{"http://localhost:11434", "http://127.0.0.1:11434", "http://[::1]:11434"} {
		if !localURL(value) {
			t.Fatal("loopback rejected")
		}
	}
}

func TestPrivateConfigGuard(t *testing.T) {
	if _, err := privateConfig(".env"); err == nil {
		t.Fatal("repository config accepted")
	}
	path := filepath.Join(t.TempDir(), "config.json")
	for _, raw := range []string{`{"DB_NAME":"production"}`, `{"DB_NAME":"isolated_test","DB_USER":"test","DB_PASS":"secret","ASSESSMENT_TEST_PASSWORD":"secret","LEARNER_ASSESSMENT_OLLAMA_URL":"http://external.example"}`} {
		if err := os.WriteFile(path, []byte(raw), 0600); err != nil {
			t.Fatal(err)
		}
		if _, err := privateConfig(path); err == nil {
			t.Fatal("unsafe config accepted")
		}
	}
}

type transportFunc func(*http.Request) (*http.Response, error)

func (f transportFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestLiveRequestHonorsCooldownAndDoesNotExposeBodies(t *testing.T) {
	client := &http.Client{Transport: transportFunc(func(r *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 429, Header: http.Header{"Retry-After": []string{"42"}}, Body: io.NopCloser(strings.NewReader(`{"success":false,"error":{"code":"ASSESSMENT_COOLDOWN"}}`))}, nil
	})}
	envelope, status, err := request(context.Background(), client, http.MethodPost, "/generate", nil)
	if err != nil || status != 429 || envelope.Error.RetryAfter != 42 {
		t.Fatal("cooldown not preserved")
	}
	client.Transport = transportFunc(func(r *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 500, Body: io.NopCloser(strings.NewReader(`{"success":false,"error":{"message":"PRIVATE_OUTPUT"}}`))}, nil
	})
	_, _, err = request(context.Background(), client, http.MethodGet, "/report", nil)
	if err == nil || strings.Contains(err.Error(), "PRIVATE_OUTPUT") {
		t.Fatal("private failure message escaped")
	}
}

func TestLiveWaitStopsOnDeadline(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if pause(ctx, time.Hour) == nil {
		t.Fatal("cancelled wait continued")
	}
}
