package grading

import "testing"

func TestScoreUsesFixedCourseGradeMap(t *testing.T) {
	tests := []struct {
		grade string
		want  float64
	}{
		{grade: "A", want: 100},
		{grade: " b+ ", want: 85},
		{grade: "C", want: 70},
		{grade: "F", want: 0},
	}
	for _, test := range tests {
		t.Run(test.grade, func(t *testing.T) {
			got, ok := Score(test.grade)
			if !ok || got != test.want {
				t.Fatalf("Score(%q) = (%v, %v), want (%v, true)", test.grade, got, ok, test.want)
			}
		})
	}
}

func TestIsRecognizedIncludesNonScoringGrades(t *testing.T) {
	for _, grade := range []string{"S", "U", "W", "I"} {
		if !IsRecognized(grade) {
			t.Fatalf("IsRecognized(%q) = false, want true", grade)
		}
	}
	if IsRecognized("E") {
		t.Fatal("IsRecognized(E) = true, want false")
	}
}
