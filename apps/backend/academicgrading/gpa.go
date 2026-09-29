package academicgrading

import "strings"

func GradePoint(gradeScheme, grade string) (float64, bool) {
	if strings.ToLower(strings.TrimSpace(gradeScheme)) != "letter" {
		return 0, false
	}

	switch strings.ToUpper(strings.TrimSpace(grade)) {
	case "A":
		return 4, true
	case "B+":
		return 3.5, true
	case "B":
		return 3, true
	case "C+":
		return 2.5, true
	case "C":
		return 2, true
	case "D+":
		return 1.5, true
	case "D":
		return 1, true
	case "F":
		return 0, true
	default:
		return 0, false
	}
}

func IsPassed(gradeScheme, grade string) bool {
	scheme := strings.ToLower(strings.TrimSpace(gradeScheme))
	normalizedGrade := strings.ToUpper(strings.TrimSpace(grade))

	if scheme == "satisfactory" {
		return normalizedGrade == "S"
	}
	if scheme != "letter" {
		return false
	}

	switch normalizedGrade {
	case "A", "B+", "B", "C+", "C", "D+", "D":
		return true
	default:
		return false
	}
}
