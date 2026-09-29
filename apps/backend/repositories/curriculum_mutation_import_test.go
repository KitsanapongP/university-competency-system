package repositories

import "testing"

func TestImportedCourseActionFor(t *testing.T) {
	tests := []struct {
		name                 string
		masterFound          bool
		activePlacementCount int
		want                 importedCourseAction
	}{
		{
			name:        "creates a new master when the code is not found",
			masterFound: false,
			want:        importedCourseCreate,
		},
		{
			name:                 "reuses a master without an active placement",
			masterFound:          true,
			activePlacementCount: 0,
			want:                 importedCourseReuse,
		},
		{
			name:                 "blocks a master with an active placement",
			masterFound:          true,
			activePlacementCount: 1,
			want:                 importedCourseConflict,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := importedCourseActionFor(tt.masterFound, tt.activePlacementCount); got != tt.want {
				t.Fatalf("importedCourseActionFor(%t, %d) = %d, want %d", tt.masterFound, tt.activePlacementCount, got, tt.want)
			}
		})
	}
}
