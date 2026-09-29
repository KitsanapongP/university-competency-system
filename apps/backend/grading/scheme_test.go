package grading

import "testing"

func TestAllowedGradesFollowCourseScheme(t *testing.T) {
	if !IsRecognizedForScheme(SchemeLetter, "A") {
		t.Fatal("letter scheme should allow A")
	}
	if IsRecognizedForScheme(SchemeLetter, "S") {
		t.Fatal("letter scheme should reject S")
	}
	if !IsRecognizedForScheme(SchemeSatisfactory, "S") {
		t.Fatal("satisfactory scheme should allow S")
	}
	if IsRecognizedForScheme(SchemeSatisfactory, "A") {
		t.Fatal("satisfactory scheme should reject A")
	}
}

func TestValidateGradeRejectsTheWrongScheme(t *testing.T) {
	if err := ValidateGrade(SchemeLetter, "S"); err != ErrGradeNotAllowed {
		t.Fatalf("ValidateGrade(letter, S) = %v, want ErrGradeNotAllowed", err)
	}
	if err := ValidateGrade(SchemeSatisfactory, "A"); err != ErrGradeNotAllowed {
		t.Fatalf("ValidateGrade(satisfactory, A) = %v, want ErrGradeNotAllowed", err)
	}
	if err := ValidateGrade(SchemeSatisfactory, " s "); err != nil {
		t.Fatalf("ValidateGrade(satisfactory, s) = %v, want nil", err)
	}
}

func TestGradeOptionsAreIndependentCopies(t *testing.T) {
	options := GradeOptions(SchemeSatisfactory)
	options[0] = "changed"
	if GradeOptions(SchemeSatisfactory)[0] != "S" {
		t.Fatal("GradeOptions should return an independent copy")
	}
}

func TestEvaluateCourseGradeScheme(t *testing.T) {
	tests := []struct {
		name      string
		scheme    string
		grade     string
		wantScore float64
		hasScore  bool
	}{
		{name: "letter grade", scheme: SchemeLetter, grade: " b+ ", wantScore: 85, hasScore: true},
		{name: "letter fail", scheme: SchemeLetter, grade: "F", wantScore: 0, hasScore: true},
		{name: "satisfactory pass", scheme: SchemeSatisfactory, grade: "S", wantScore: 100, hasScore: true},
		{name: "satisfactory fail", scheme: SchemeSatisfactory, grade: "U", hasScore: false},
		{name: "letter withdrawal", scheme: SchemeLetter, grade: "W", hasScore: false},
		{name: "satisfactory incomplete", scheme: SchemeSatisfactory, grade: "I", hasScore: false},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got := Evaluate(test.scheme, test.grade)
			if !got.Recognized || got.HasScore != test.hasScore || got.Score != test.wantScore {
				t.Fatalf("Evaluate(%q, %q) = %#v, want recognized with score=%v and value=%v", test.scheme, test.grade, got, test.hasScore, test.wantScore)
			}
		})
	}
}

func TestIsBetterAttemptSelectsRetakeAccordingToScheme(t *testing.T) {
	newAttempt := func(scheme, grade string, year, semester uint64) GradeAttempt {
		return GradeAttempt{
			Evaluation:     Evaluate(scheme, grade),
			AcademicYearBE: year,
			Semester:       semester,
		}
	}

	tests := []struct {
		name      string
		candidate GradeAttempt
		current   GradeAttempt
		want      bool
	}{
		{
			name:      "S wins over later U",
			candidate: newAttempt(SchemeSatisfactory, "S", 2565, 1),
			current:   newAttempt(SchemeSatisfactory, "U", 2566, 1),
			want:      true,
		},
		{
			name:      "latest non scoring attempt wins when no S exists",
			candidate: newAttempt(SchemeSatisfactory, "I", 2566, 2),
			current:   newAttempt(SchemeSatisfactory, "U", 2566, 1),
			want:      true,
		},
		{
			name:      "higher letter score wins",
			candidate: newAttempt(SchemeLetter, "B", 2566, 1),
			current:   newAttempt(SchemeLetter, "C", 2567, 1),
			want:      true,
		},
		{
			name:      "latest equal score wins",
			candidate: newAttempt(SchemeLetter, "B", 2566, 1),
			current:   newAttempt(SchemeLetter, "B", 2565, 2),
			want:      true,
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := IsBetterAttempt(test.candidate, test.current); got != test.want {
				t.Fatalf("IsBetterAttempt() = %v, want %v", got, test.want)
			}
		})
	}
}
