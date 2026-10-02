package services

import (
	"testing"

	"github.com/spw32767/university-competency-system-backend/models"
)

func TestCareerPathFacultyScope(t *testing.T) {
	facultyID := int64(12)
	tests := []struct {
		name    string
		roles   []string
		faculty *int64
		want    bool
	}{
		{name: "admin can access selected faculty", roles: []string{"admin"}, faculty: nil, want: true},
		{name: "officer can access own faculty", roles: []string{"officer"}, faculty: &facultyID, want: true},
		{name: "officer without faculty is denied", roles: []string{"officer"}, faculty: nil, want: false},
		{name: "learner is denied", roles: []string{"learner"}, faculty: &facultyID, want: false},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := careerPathInFaculty(12, test.roles, test.faculty); got != test.want {
				t.Fatalf("careerPathInFaculty() = %v, want %v", got, test.want)
			}
		})
	}
}

func TestNormalizeCareerPathFiltersDefaultsAndValidation(t *testing.T) {
	filters := models.CareerPathFilters{}
	if err := normalizeCareerPathFilters(&filters); err != nil {
		t.Fatalf("normalizeCareerPathFilters() error = %v", err)
	}
	if filters.SortBy != "name" || filters.SortOrder != "asc" || filters.Language != "th" {
		t.Fatalf("normalized sort = (%q, %q, %q), want name/asc/th", filters.SortBy, filters.SortOrder, filters.Language)
	}

	curriculumID := uint64(5)
	tests := []struct {
		name    string
		filters models.CareerPathFilters
	}{
		{name: "rejects conflicting curriculum filters", filters: models.CareerPathFilters{CurriculumID: &curriculumID, WithoutCurriculum: true}},
		{name: "rejects unsupported sort key", filters: models.CareerPathFilters{SortBy: "status"}},
		{name: "rejects unsupported sort order", filters: models.CareerPathFilters{SortOrder: "sideways"}},
		{name: "rejects unsupported language", filters: models.CareerPathFilters{Language: "fr"}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if err := normalizeCareerPathFilters(&test.filters); err == nil {
				t.Fatal("normalizeCareerPathFilters() error = nil, want invalid-filter error")
			}
		})
	}
}

func TestResolveCareerPathFaculty(t *testing.T) {
	facultyID := int64(12)
	otherFaculty := uint64(13)
	tests := []struct {
		name      string
		requested *uint64
		roles     []string
		faculty   *int64
		want      uint64
		wantErr   bool
	}{
		{name: "admin selects faculty", requested: &otherFaculty, roles: []string{"admin"}, want: otherFaculty},
		{name: "officer uses account faculty", roles: []string{"officer"}, faculty: &facultyID, want: 12},
		{name: "officer cannot switch faculty", requested: &otherFaculty, roles: []string{"officer"}, faculty: &facultyID, wantErr: true},
		{name: "admin must choose faculty", roles: []string{"admin"}, wantErr: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := resolveCareerPathFaculty(test.requested, test.roles, test.faculty)
			if (err != nil) != test.wantErr || got != test.want {
				t.Fatalf("resolveCareerPathFaculty() = (%d, %v), want (%d, error=%v)", got, err, test.want, test.wantErr)
			}
		})
	}
}

func TestValidateCareerPathDraft(t *testing.T) {
	facultyID := uint64(2)
	tests := []struct {
		name    string
		payload models.CareerPathDraftPayload
		wantErr bool
	}{
		{name: "draft minimum fields", payload: models.CareerPathDraftPayload{FacultyID: &facultyID, Code: " SWE ", NameTH: " นักพัฒนาซอฟต์แวร์ "}},
		{name: "missing Thai name", payload: models.CareerPathDraftPayload{FacultyID: &facultyID, Code: "SWE"}, wantErr: true},
		{name: "duplicate curriculum", payload: models.CareerPathDraftPayload{FacultyID: &facultyID, Code: "SWE", NameTH: "นักพัฒนา", CurriculumIDs: []uint64{1, 1}}, wantErr: true},
		{name: "zero competency ID", payload: models.CareerPathDraftPayload{FacultyID: &facultyID, Code: "SWE", NameTH: "นักพัฒนา", CompetencyIDs: []uint64{0}}, wantErr: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if err := validateCareerPathDraft(test.payload); (err != nil) != test.wantErr {
				t.Fatalf("validateCareerPathDraft() error = %v, want error %v", err, test.wantErr)
			}
		})
	}
}

func TestCareerPathPublishableRequiresMinimumContent(t *testing.T) {
	description := "พัฒนาระบบซอฟต์แวร์"
	skills := "เขียนโปรแกรมและทดสอบ"
	version := models.CareerPathVersion{
		NameTH:        "นักพัฒนาซอฟต์แวร์",
		DescriptionTH: &description,
		SkillsTH:      &skills,
		Curricula:     []models.CareerPathOption{{ID: 1}},
	}
	if !careerPathPublishable(version) {
		t.Fatal("expected complete career draft to be publishable")
	}
	version.Curricula = nil
	if careerPathPublishable(version) {
		t.Fatal("expected draft without curriculum scope to be rejected")
	}
	version.Curricula = []models.CareerPathOption{{ID: 1}}
	version.SkillsTH = nil
	version.Competencies = []models.CareerPathOption{{ID: 4}}
	if !careerPathPublishable(version) {
		t.Fatal("expected linked competency to satisfy the skill requirement")
	}
}

func TestNormalizeCareerPathIDs(t *testing.T) {
	if _, err := normalizeCareerPathIDs([]uint64{4, 4}); err == nil {
		t.Fatal("expected duplicate IDs to fail")
	}
	if _, err := normalizeCareerPathIDs([]uint64{0}); err == nil {
		t.Fatal("expected zero ID to fail")
	}
	if got, err := normalizeCareerPathIDs([]uint64{4, 5}); err != nil || len(got) != 2 {
		t.Fatalf("normalizeCareerPathIDs() = %v, %v; want two IDs", got, err)
	}
}
