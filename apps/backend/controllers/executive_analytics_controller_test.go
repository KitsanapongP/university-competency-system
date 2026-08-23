package controllers

import (
	"net/http/httptest"
	"testing"
)

func TestExecutiveFiltersParseSupportedScopeValues(t *testing.T) {
	request := httptest.NewRequest(
		"GET",
		"/api/v1/executive-analytics/overview?faculty_id=7&major_id=11&curriculum_id=22&cohort_id=33&entry_year_be=2566&competency_id=4",
		nil,
	)
	recorder := httptest.NewRecorder()
	filters, ok := executiveFilters(recorder, request)
	if !ok {
		t.Fatal("expected valid executive filters")
	}
	if filters.FacultyID == nil || *filters.FacultyID != 7 {
		t.Fatalf("unexpected faculty filter: %#v", filters.FacultyID)
	}
	if filters.CohortID == nil || *filters.CohortID != 33 {
		t.Fatalf("unexpected cohort filter: %#v", filters.CohortID)
	}
	if filters.EntryYearBE == nil || *filters.EntryYearBE != 2566 {
		t.Fatalf("unexpected entry year filter: %#v", filters.EntryYearBE)
	}
}

func TestExecutiveFiltersRejectInvalidScopeValue(t *testing.T) {
	request := httptest.NewRequest("GET", "/api/v1/executive-analytics/overview?faculty_id=not-a-number", nil)
	recorder := httptest.NewRecorder()
	_, ok := executiveFilters(recorder, request)
	if ok {
		t.Fatal("expected invalid faculty filter to be rejected")
	}
	if recorder.Code != 400 {
		t.Fatalf("expected HTTP 400, got %d", recorder.Code)
	}
}
