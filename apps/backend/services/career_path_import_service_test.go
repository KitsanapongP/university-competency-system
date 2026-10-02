package services

import (
	"context"
	"errors"
	"testing"

	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
)

type fakeCareerPathImportStore struct {
	byCode        map[string]*models.CareerPath
	invalidScopes map[uint64]bool
	committed     []models.CareerPathImportWrite
}

func (f *fakeCareerPathImportStore) FindByFacultyCode(_ context.Context, _ uint64, code string) (*models.CareerPath, error) {
	if item := f.byCode[normalizedCareerPathCode(code)]; item != nil {
		return item, nil
	}
	return nil, repositories.ErrCareerPathNotFound
}

func (f *fakeCareerPathImportStore) ValidateMappings(_ context.Context, _ uint64, curriculumIDs, competencyIDs []uint64) error {
	for _, id := range append(append([]uint64{}, curriculumIDs...), competencyIDs...) {
		if f.invalidScopes[id] {
			return repositories.ErrCareerPathInvalidScope
		}
	}
	return nil
}

func (f *fakeCareerPathImportStore) CommitImport(_ context.Context, writes []models.CareerPathImportWrite, _ uint64) error {
	f.committed = append([]models.CareerPathImportWrite{}, writes...)
	return nil
}

func TestCareerPathImportPreviewDefaultsDuplicateToSkipAndNewRowToCreate(t *testing.T) {
	store := &fakeCareerPathImportStore{byCode: map[string]*models.CareerPath{
		"existing": {CareerPathID: 7, FacultyID: 4, Code: "Existing"},
	}}
	service := NewCareerPathImportService(store)
	faculty := uint64(4)
	name := "สายงานใหม่"
	preview, err := service.Preview(context.Background(), models.CareerPathImportPayload{
		SchemaVersion: 1,
		FacultyID:     &faculty,
		Rows: []models.CareerPathImportRow{
			{RowNumber: 2, Code: "Existing"},
			{RowNumber: 3, Code: "new", NameTH: &name},
		},
	}, []string{"admin"}, nil)
	if err != nil {
		t.Fatalf("Preview returned an error: %v", err)
	}
	if preview.Rows[0].Action != "skip" || preview.Rows[0].Selected {
		t.Fatalf("existing code should default to skip: %#v", preview.Rows[0])
	}
	if preview.Rows[1].Action != "create" || !preview.Rows[1].Selected || !preview.Rows[1].Valid || !preview.CanCommit {
		t.Fatalf("new valid row should be selected for import: %#v", preview.Rows[1])
	}
}

func TestCareerPathImportBlankKeepsValueAndExplicitClearRemovesIt(t *testing.T) {
	faculty := uint64(4)
	oldDescription := "ข้อความเดิม"
	version := &models.CareerPathVersion{
		CareerVersionID: 13,
		Revision:        2,
		Status:          "draft",
		NameTH:          "สายงานเดิม",
		DescriptionTH:   &oldDescription,
		Curricula:       []models.CareerPathOption{{ID: 9}},
	}
	store := &fakeCareerPathImportStore{byCode: map[string]*models.CareerPath{
		"keep":  {CareerPathID: 2, FacultyID: faculty, Code: "keep", DraftVersion: version},
		"clear": {CareerPathID: 3, FacultyID: faculty, Code: "clear", DraftVersion: version},
	}}
	service := NewCareerPathImportService(store)
	blank := "   "
	preview, err := service.Preview(context.Background(), models.CareerPathImportPayload{
		SchemaVersion: 1,
		FacultyID:     &faculty,
		Rows: []models.CareerPathImportRow{
			{RowNumber: 1, Code: "keep", Action: "update", DescriptionTH: &blank},
			{RowNumber: 2, Code: "clear", Action: "update", ClearFields: []string{"description_th", "curriculum_ids"}},
		},
	}, []string{"admin"}, nil)
	if err != nil {
		t.Fatalf("Preview returned an error: %v", err)
	}
	if got := *preview.Rows[0].Payload.DescriptionTH; got != oldDescription {
		t.Fatalf("blank should preserve previous value, got %q", got)
	}
	if preview.Rows[1].Payload.DescriptionTH != nil || len(preview.Rows[1].Payload.CurriculumIDs) != 0 {
		t.Fatalf("explicit clear should remove optional fields: %#v", preview.Rows[1].Payload)
	}
}

func TestCareerPathImportCommitRevalidatesTokenAndOnlyWritesSelectedRows(t *testing.T) {
	faculty := uint64(4)
	name := "สายงานที่เลือก"
	store := &fakeCareerPathImportStore{byCode: map[string]*models.CareerPath{}}
	service := NewCareerPathImportService(store)
	payload := models.CareerPathImportPayload{
		SchemaVersion: 1,
		FacultyID:     &faculty,
		Rows: []models.CareerPathImportRow{
			{RowNumber: 1, Code: "first", NameTH: &name, Selected: true},
			{RowNumber: 2, Code: "second", NameTH: &name, Selected: false},
		},
	}
	preview, err := service.Preview(context.Background(), payload, []string{"admin"}, nil)
	if err != nil {
		t.Fatalf("Preview returned an error: %v", err)
	}
	payload.PreviewToken = preview.PreviewToken
	if err := service.Commit(context.Background(), payload, 5, []string{"admin"}, nil); err != nil {
		t.Fatalf("Commit returned an error: %v", err)
	}
	if len(store.committed) != 1 || store.committed[0].Payload.Code != "first" {
		t.Fatalf("only selected row should be committed: %#v", store.committed)
	}

	payload.Rows[0].NameTH = careerImportStringPointer("edited after preview")
	if err := service.Commit(context.Background(), payload, 5, []string{"admin"}, nil); !errors.Is(err, repositories.ErrCareerPathConflict) {
		t.Fatalf("edited preview should conflict, got %v", err)
	}
}

func TestCareerPathImportRejectsDuplicateCodesAndForeignReferences(t *testing.T) {
	faculty := uint64(4)
	name := "สายงาน"
	foreignID := uint64(99)
	store := &fakeCareerPathImportStore{byCode: map[string]*models.CareerPath{}, invalidScopes: map[uint64]bool{foreignID: true}}
	service := NewCareerPathImportService(store)
	preview, err := service.Preview(context.Background(), models.CareerPathImportPayload{
		SchemaVersion: 1,
		FacultyID:     &faculty,
		Rows: []models.CareerPathImportRow{
			{RowNumber: 1, Code: "duplicate", NameTH: &name},
			{RowNumber: 2, Code: "DUPLICATE", NameTH: &name},
			{RowNumber: 3, Code: "outside", NameTH: &name, CurriculumIDs: &[]uint64{foreignID}},
		},
	}, []string{"admin"}, nil)
	if err != nil {
		t.Fatalf("Preview returned an error: %v", err)
	}
	if preview.Rows[0].Valid || preview.Rows[1].Valid || preview.Rows[2].Valid {
		t.Fatalf("duplicate codes and foreign references must be invalid: %#v", preview.Rows)
	}
}

func careerImportStringPointer(value string) *string { return &value }
