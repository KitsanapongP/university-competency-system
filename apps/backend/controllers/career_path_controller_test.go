package controllers

import (
	"net/http/httptest"
	"testing"
)

func TestParseCareerPathFilters(t *testing.T) {
	tests := []struct {
		name    string
		query   string
		wantErr bool
	}{
		{name: "curriculum and sort options", query: "?curriculum_id=12&sort_by=faculty&sort_order=desc&language=en"},
		{name: "no curriculum", query: "?without_curriculum=true"},
		{name: "rejects mutually exclusive curriculum options", query: "?curriculum_id=12&without_curriculum=true", wantErr: true},
		{name: "rejects malformed curriculum id", query: "?curriculum_id=0", wantErr: true},
		{name: "rejects malformed no curriculum flag", query: "?without_curriculum=yes", wantErr: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest("GET", "/api/v1/career-paths/"+test.query, nil)
			filters, err := parseCareerPathFilters(request)
			if (err != nil) != test.wantErr {
				t.Fatalf("parseCareerPathFilters() error = %v, want error %v", err, test.wantErr)
			}
			if err != nil {
				return
			}
			if test.query == "?curriculum_id=12&sort_by=faculty&sort_order=desc&language=en" {
				if filters.CurriculumID == nil || *filters.CurriculumID != 12 || filters.SortBy != "faculty" || filters.SortOrder != "desc" || filters.Language != "en" {
					t.Fatalf("parsed filters = %#v, want curriculum 12, faculty desc, English", filters)
				}
			}
			if test.query == "?without_curriculum=true" && !filters.WithoutCurriculum {
				t.Fatalf("parsed filters = %#v, want without-curriculum enabled", filters)
			}
		})
	}
}
