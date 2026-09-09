package grading

import "errors"

const (
	SchemeLetter       = "letter"
	SchemeSatisfactory = "satisfactory"
)

var ErrInvalidScheme = errors.New("invalid course grade scheme")

func NormalizeScheme(value string) string {
	if value == SchemeSatisfactory {
		return SchemeSatisfactory
	}
	return value
}

func IsValidScheme(value string) bool {
	return value == SchemeLetter || value == SchemeSatisfactory
}
