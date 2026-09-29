package services

import (
	"reflect"
	"testing"
)

func TestUniqueCompetencyIDsKeepsSelectionOrder(t *testing.T) {
	input := []uint64{0, 4, 9, 4, 2, 0, 9}
	want := []uint64{4, 9, 2}

	if got := uniqueCompetencyIDs(input); !reflect.DeepEqual(got, want) {
		t.Fatalf("uniqueCompetencyIDs(%v) = %v, want %v", input, got, want)
	}
}
