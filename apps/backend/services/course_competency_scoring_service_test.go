package services

import "testing"

func TestFixedCourseGradeScore(t *testing.T) {
	tests := []struct {
		grade string
		want  float64
		ok    bool
	}{
		{grade: "A", want: 100, ok: true},
		{grade: "b+", want: 85, ok: true},
		{grade: "D", want: 60, ok: true},
		{grade: "F", want: 0, ok: true},
		{grade: "S", ok: false},
		{grade: "W", ok: false},
	}
	for _, test := range tests {
		got, ok := FixedCourseGradeScore(test.grade)
		if ok != test.ok || got != test.want {
			t.Fatalf("FixedCourseGradeScore(%q) = (%v, %v), want (%v, %v)", test.grade, got, ok, test.want, test.ok)
		}
	}
}
