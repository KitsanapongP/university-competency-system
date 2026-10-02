package repositories

import (
	"strings"
	"testing"

	"github.com/spw32767/university-competency-system-backend/models"
)

func TestCareerPathListWhereAppliesFacultyStatusAndSearch(t *testing.T) {
	facultyID := uint64(4)
	query, args := careerPathListWhere(models.CareerPathFilters{
		FacultyID: &facultyID,
		Status:    "active",
		Search:    "developer",
	})
	for _, fragment := range []string{
		"path.deleted_at IS NULL",
		"path.faculty_id = ?",
		"path.status = ?",
		"draft.name_th LIKE ?",
		"published.name_en LIKE ?",
	} {
		if !strings.Contains(query, fragment) {
			t.Fatalf("careerPathListWhere() does not contain %q", fragment)
		}
	}
	if len(args) != 7 || args[0] != uint64(4) || args[1] != "active" {
		t.Fatalf("careerPathListWhere() args = %#v, want faculty, status, and five search patterns", args)
	}
}

func TestCareerPathListWhereOmitsUnselectedFilters(t *testing.T) {
	query, args := careerPathListWhere(models.CareerPathFilters{})
	if query != "path.deleted_at IS NULL" || len(args) != 0 {
		t.Fatalf("careerPathListWhere() = (%q, %#v), want only live-row predicate", query, args)
	}
}
