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

var letterGrades = []string{"A", "B+", "B", "C+", "C", "D+", "D", "F", "W", "I"}
var satisfactoryGrades = []string{"S", "U", "W", "I"}

func NormalizeScheme(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func IsValidScheme(value string) bool {
	scheme := NormalizeScheme(value)
	return scheme == SchemeLetter || scheme == SchemeSatisfactory
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
