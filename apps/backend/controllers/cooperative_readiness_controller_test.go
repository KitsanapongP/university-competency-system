package controllers

import (
	"net/http/httptest"
	"testing"
)

func TestCooperativeSemester(t *testing.T) {
	tests := []struct {
		name       string
		query      string
		want       uint
		wantStatus int
	}{
		{name: "semester one", query: "?semester=1", want: 1, wantStatus: 200},
		{name: "semester two", query: "?semester=2", want: 2, wantStatus: 200},
		{name: "missing semester", query: "", wantStatus: 400},
		{name: "zero semester", query: "?semester=0", wantStatus: 400},
		{name: "unsupported semester", query: "?semester=3", wantStatus: 400},
		{name: "invalid semester", query: "?semester=summer", wantStatus: 400},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest("GET", "/"+test.query, nil)
			response := httptest.NewRecorder()

			semester, ok := cooperativeSemester(response, request)
			if response.Code != test.wantStatus {
				t.Fatalf("status = %d, want %d", response.Code, test.wantStatus)
			}
			if test.wantStatus == 200 && (!ok || semester != test.want) {
				t.Fatalf("semester = %d, ok = %v; want %d, true", semester, ok, test.want)
			}
			if test.wantStatus != 200 && ok {
				t.Fatalf("expected invalid semester, got %d", semester)
			}
		})
	}
}
