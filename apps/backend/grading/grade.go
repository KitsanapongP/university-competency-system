package grading

import "strings"

// FixedCourseGradeMap is the v1 grade scale used by both grade management and
// course competency recalculation.
var FixedCourseGradeMap = map[string]float64{
	"A":  100,
	"B+": 85,
	"B":  80,
	"C+": 75,
	"C":  70,
	"D+": 65,
	"D":  60,
	"F":  0,
}

func Normalize(value string) string {
	return strings.ToUpper(strings.TrimSpace(value))
}

func Score(value string) (float64, bool) {
	score, ok := FixedCourseGradeMap[Normalize(value)]
	return score, ok
}

func IsRecognized(value string) bool {
	normalized := Normalize(value)
	if _, ok := FixedCourseGradeMap[normalized]; ok {
		return true
	}
	switch normalized {
	case "S", "U", "W", "I":
		return true
	default:
		return false
	}
}
