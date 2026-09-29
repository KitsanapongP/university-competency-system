package services

import "testing"

func TestCanEditStudentCohortEntryYear(t *testing.T) {
	tests := []struct {
		name          string
		status        string
		rosterCount   int
		templateCount int
		want          bool
	}{
		{name: "empty draft", status: "draft", want: true},
		{name: "draft with roster", status: "draft", rosterCount: 1, want: false},
		{name: "draft with template", status: "draft", templateCount: 1, want: false},
		{name: "active empty", status: "active", want: false},
		{name: "archived empty", status: "archived", want: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := canEditStudentCohortEntryYear(test.status, test.rosterCount, test.templateCount); got != test.want {
				t.Fatalf("canEditStudentCohortEntryYear() = %v, want %v", got, test.want)
			}
		})
	}
}
