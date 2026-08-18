package repositories

import (
	"reflect"
	"testing"
)

func TestDuplicateCourseKeyNormalizesCourseCode(t *testing.T) {
	tests := []struct {
		name string
		code string
		want string
	}{
		{name: "trims surrounding whitespace", code: "  CP101001  ", want: "cp101001"},
		{name: "matches case insensitively", code: "Cp101001", want: "cp101001"},
		{name: "keeps meaningful separators", code: "CP-101.001", want: "cp-101.001"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := duplicateCourseKey(tt.code); got != tt.want {
				t.Fatalf("duplicateCourseKey(%q) = %q, want %q", tt.code, got, tt.want)
			}
		})
	}
}

func TestUniqueIDsKeepsSelectionOrderAndDropsEmptyOrDuplicateIDs(t *testing.T) {
	input := []uint64{0, 12, 7, 12, 0, 19, 7}
	want := []uint64{12, 7, 19}

	if got := uniqueIDs(input); !reflect.DeepEqual(got, want) {
		t.Fatalf("uniqueIDs(%v) = %v, want %v", input, got, want)
	}
}
