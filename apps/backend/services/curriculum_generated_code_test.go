package services

import "testing"

func TestNextCurriculumCodeSequence(t *testing.T) {
	prefix := "CP-Faculty-CS-2569"
	cases := []struct {
		name     string
		codes    []string
		expected int
	}{
		{name: "starts at one", expected: 1},
		{name: "increments matching codes", codes: []string{prefix + "-01", prefix + "-02"}, expected: 3},
		{name: "keeps the highest sequence", codes: []string{prefix + "-01", prefix + "-12", prefix + "-03"}, expected: 13},
		{name: "ignores other years and malformed suffixes", codes: []string{"CP-Faculty-CS-2568-99", prefix + "-draft", prefix + "-02"}, expected: 3},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			if actual := nextCurriculumCodeSequence(prefix, tt.codes); actual != tt.expected {
				t.Fatalf("nextCurriculumCodeSequence() = %d, want %d", actual, tt.expected)
			}
		})
	}
}
