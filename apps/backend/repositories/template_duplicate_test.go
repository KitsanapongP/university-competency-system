package repositories

import (
	"reflect"
	"testing"

	"github.com/spw32767/university-competency-system-backend/models"
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

func TestFilterDuplicableTemplateItemsSkipsOrphanedAndInactiveCourses(t *testing.T) {
	activeCourseID := uint64(101)
	orphanedCourseID := uint64(102)
	inactiveCourseID := uint64(103)
	activeAdditionalID := uint64(201)
	inactiveAdditionalID := uint64(202)

	items := []models.TemplateItem{
		{TemplateItemID: 1, CompetencyID: 1, IsActive: true},
		{TemplateItemID: 2, CourseID: &activeCourseID, CompetencyID: 1, IsActive: true},
		{TemplateItemID: 3, CourseID: &orphanedCourseID, CompetencyID: 1, IsActive: true},
		{TemplateItemID: 4, CourseID: &inactiveCourseID, CompetencyID: 1, IsActive: false},
		{TemplateItemID: 5, CourseID: &activeAdditionalID, CompetencyID: 1, IsActive: true, IsCustomCourse: true},
		{TemplateItemID: 6, CourseID: &inactiveAdditionalID, CompetencyID: 1, IsActive: true, IsCustomCourse: true},
	}
	customCourses := map[uint64]models.TemplateCourse{
		activeAdditionalID:   {TemplateCourseID: activeAdditionalID, IsActive: true},
		inactiveAdditionalID: {TemplateCourseID: inactiveAdditionalID, IsActive: false},
	}

	got := filterDuplicableTemplateItems(items, map[uint64]struct{}{activeCourseID: {}}, customCourses)
	gotIDs := make([]uint64, 0, len(got))
	for _, item := range got {
		gotIDs = append(gotIDs, item.TemplateItemID)
	}

	want := []uint64{1, 2, 5}
	if !reflect.DeepEqual(gotIDs, want) {
		t.Fatalf("filterDuplicableTemplateItems() kept item IDs %v, want %v", gotIDs, want)
	}
}
