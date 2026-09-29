package academicgrading

import "testing"

func TestGradePointUsesFourPointLetterScale(t *testing.T) {
	tests := []struct {
		grade string
		want  float64
	}{
		{grade: "A", want: 4},
		{grade: "B+", want: 3.5},
		{grade: "B", want: 3},
		{grade: "C+", want: 2.5},
		{grade: "C", want: 2},
		{grade: "D+", want: 1.5},
		{grade: "D", want: 1},
		{grade: "F", want: 0},
	}

	for _, test := range tests {
		t.Run(test.grade, func(t *testing.T) {
			got, ok := GradePoint("letter", test.grade)
			if !ok || got != test.want {
				t.Fatalf("GradePoint(letter, %q) = (%v, %v), want (%v, true)", test.grade, got, ok, test.want)
			}
		})
	}
}

func TestGradePointExcludesNonGPAGrades(t *testing.T) {
	for _, grade := range []string{"S", "U", "W", "I", ""} {
		if _, ok := GradePoint("satisfactory", grade); ok {
			t.Errorf("GradePoint(satisfactory, %q) unexpectedly contributes to GPA", grade)
		}
	}
	for _, grade := range []string{"S", "U", "W", "I", ""} {
		if _, ok := GradePoint("letter", grade); ok {
			t.Errorf("GradePoint(letter, %q) unexpectedly contributes to GPA", grade)
		}
	}
}

func TestIsPassedFollowsGradeScheme(t *testing.T) {
	tests := []struct {
		scheme string
		grade  string
		want   bool
	}{
		{scheme: "letter", grade: "D", want: true},
		{scheme: "letter", grade: "F", want: false},
		{scheme: "letter", grade: "W", want: false},
		{scheme: "letter", grade: "I", want: false},
		{scheme: "satisfactory", grade: "S", want: true},
		{scheme: "satisfactory", grade: "U", want: false},
	}
	for _, test := range tests {
		if got := IsPassed(test.scheme, test.grade); got != test.want {
			t.Errorf("IsPassed(%q, %q) = %v, want %v", test.scheme, test.grade, got, test.want)
		}
	}
}
