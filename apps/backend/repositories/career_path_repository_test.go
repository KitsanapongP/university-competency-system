package repositories

import (
	"strings"
	"testing"

	"github.com/spw32767/university-competency-system-backend/models"
)

func TestCareerPathListWhereAppliesFacultyStatusAndSearch(t *testing.T) {
	facultyID := uint64(4)
	curriculumID := uint64(22)
	query, args := careerPathListWhere(models.CareerPathFilters{
		FacultyID:    &facultyID,
		CurriculumID: &curriculumID,
		Status:       "active",
		Search:       "developer",
	})
	for _, fragment := range []string{
		"path.deleted_at IS NULL",
		"path.faculty_id = ?",
		"path.status = ?",
		"careerCurriculum.career_version_id = COALESCE(path.draft_version_id, path.published_version_id)",
		"careerCurriculum.curriculum_id = ?",
		"draft.name_th LIKE ?",
		"published.name_en LIKE ?",
	} {
		if !strings.Contains(query, fragment) {
			t.Fatalf("careerPathListWhere() does not contain %q", fragment)
		}
	}
	if len(args) != 8 || args[0] != uint64(4) || args[1] != "active" || args[2] != uint64(22) {
		t.Fatalf("careerPathListWhere() args = %#v, want faculty, status, curriculum, and five search patterns", args)
	}
}

func TestCareerPathListWhereFiltersPathsWithoutCurriculum(t *testing.T) {
	query, args := careerPathListWhere(models.CareerPathFilters{WithoutCurriculum: true})
	if !strings.Contains(query, "NOT EXISTS (") || !strings.Contains(query, "careerCurriculum.career_version_id = COALESCE(path.draft_version_id, path.published_version_id)") {
		t.Fatalf("careerPathListWhere() = %q, want no-curriculum filter using current version", query)
	}
	if len(args) != 0 {
		t.Fatalf("careerPathListWhere() args = %#v, want no arguments", args)
	}
}

func TestCareerPathListOrderByUsesAllowlistedLocalizedSort(t *testing.T) {
	tests := []struct {
		name    string
		filters models.CareerPathFilters
		want    string
	}{
		{
			name:    "Thai name ascending by default",
			filters: models.CareerPathFilters{},
			want:    "COALESCE(NULLIF(published.name_th, ''), NULLIF(draft.name_th, ''), path.code) ASC, path.career_path_id ASC",
		},
		{
			name:    "English name descending",
			filters: models.CareerPathFilters{Language: "en", SortOrder: "desc"},
			want:    "COALESCE(NULLIF(published.name_en, ''), NULLIF(published.name_th, ''), NULLIF(draft.name_th, ''), path.code) DESC, path.career_path_id ASC",
		},
		{
			name:    "faculty English fallback",
			filters: models.CareerPathFilters{SortBy: "faculty", Language: "en"},
			want:    "COALESCE(NULLIF(faculty.name_en, ''), NULLIF(faculty.name_th, ''), '') ASC, path.career_path_id ASC",
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := careerPathListOrderBy(test.filters); got != test.want {
				t.Fatalf("careerPathListOrderBy() = %q, want %q", got, test.want)
			}
		})
	}
}

func TestCareerPathListWhereOmitsUnselectedFilters(t *testing.T) {
	query, args := careerPathListWhere(models.CareerPathFilters{})
	if query != "path.deleted_at IS NULL" || len(args) != 0 {
		t.Fatalf("careerPathListWhere() = (%q, %#v), want only live-row predicate", query, args)
	}
}
