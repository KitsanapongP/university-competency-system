package grading

import (
	"errors"
	"strings"
)

const (
	SchemeLetter       = "letter"
	SchemeSatisfactory = "satisfactory"
)

var ErrInvalidScheme = errors.New("invalid course grade scheme")
var ErrGradeNotAllowed = errors.New("grade is not allowed for this grade scheme")

var letterGrades = []string{"A", "B+", "B", "C+", "C", "D+", "D", "F", "W", "I"}
var satisfactoryGrades = []string{"S", "U", "W", "I"}

func NormalizeScheme(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func IsValidScheme(value string) bool {
	scheme := NormalizeScheme(value)
	return scheme == SchemeLetter || scheme == SchemeSatisfactory
}

// ValidateGrade is the shared boundary for every feature that accepts a
// course grade. Keeping this check here prevents free-elective workflows from
// creating a second, subtly different grade vocabulary.
func ValidateGrade(scheme, value string) error {
	if !IsValidScheme(scheme) {
		return ErrInvalidScheme
	}
	if !IsRecognizedForScheme(scheme, value) {
		return ErrGradeNotAllowed
	}
	return nil
}

// GradeOptions returns a copy so callers can safely use it as UI/API data.
func GradeOptions(scheme string) []string {
	return AllowedGrades(scheme)
}

func AllowedGrades(scheme string) []string {
	var source []string
	switch NormalizeScheme(scheme) {
	case SchemeLetter:
		source = letterGrades
	case SchemeSatisfactory:
		source = satisfactoryGrades
	default:
		return []string{}
	}
	return append([]string(nil), source...)
}

func IsRecognizedForScheme(scheme, value string) bool {
	normalized := Normalize(value)
	for _, allowed := range AllowedGrades(scheme) {
		if normalized == allowed {
			return true
		}
	}
	return false
}

type Evaluation struct {
	Score      float64
	HasScore   bool
	Recognized bool
}

type GradeAttempt struct {
	Evaluation     Evaluation
	AcademicYearBE uint64
	Semester       uint64
}

// IsBetterAttempt applies the single best-grade rule used by grade history
// updates and competency-score recalculation.
func IsBetterAttempt(candidate, current GradeAttempt) bool {
	if !candidate.Evaluation.Recognized {
		return false
	}
	if !current.Evaluation.Recognized {
		return true
	}
	if candidate.Evaluation.HasScore != current.Evaluation.HasScore {
		return candidate.Evaluation.HasScore
	}
	if candidate.Evaluation.HasScore && candidate.Evaluation.Score != current.Evaluation.Score {
		return candidate.Evaluation.Score > current.Evaluation.Score
	}
	if candidate.AcademicYearBE != current.AcademicYearBE {
		return candidate.AcademicYearBE > current.AcademicYearBE
	}
	return candidate.Semester > current.Semester
}

func Evaluate(scheme, value string) Evaluation {
	normalizedScheme := NormalizeScheme(scheme)
	normalizedGrade := Normalize(value)
	if !IsRecognizedForScheme(normalizedScheme, normalizedGrade) {
		return Evaluation{}
	}
	if normalizedScheme == SchemeSatisfactory {
		if normalizedGrade == "S" {
			return Evaluation{Score: 100, HasScore: true, Recognized: true}
		}
		return Evaluation{Recognized: true}
	}
	if score, ok := Score(normalizedGrade); ok {
		return Evaluation{Score: score, HasScore: true, Recognized: true}
	}
	return Evaluation{Recognized: true}
}
