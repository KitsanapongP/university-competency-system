package repositories

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"testing"
)

func TestAssessmentCurriculumNamesUseExistingSchema(t *testing.T) {
	for _, english := range []string{"Computer Science", ""} {
		t.Run("english="+english, func(t *testing.T) {
			db, state := apiSQLDB(t, []apiSQLStep{{
				contains: "SELECT name_th, COALESCE(name_en, '') FROM edu_curricula WHERE curriculum_id = ? AND deleted_at IS NULL",
				rows:     [][]driver.Value{{"Thai curriculum name", english}},
			}})
			tx, err := db.Begin()
			if err != nil {
				t.Fatal(err)
			}
			defer tx.Rollback()
			repo := NewAssessmentSourceRepository(db)
			names, err := repo.GetCurriculumNamesWith(context.Background(), tx, 1)
			if err != nil || names.TH != "Thai curriculum name" || names.EN != english || state.index != 1 {
				t.Fatalf("unexpected names: %+v, error: %v", names, err)
			}
		})
	}
}

func TestAssessmentCurriculumNamesPropagateQueryErrors(t *testing.T) {
	want := errors.New("database unavailable")
	for _, test := range []struct {
		name string
		step apiSQLStep
		err  error
	}{
		{"missing", apiSQLStep{contains: "deleted_at IS NULL"}, sql.ErrNoRows},
		{"query failure", apiSQLStep{contains: "deleted_at IS NULL", err: want}, want},
	} {
		t.Run(test.name, func(t *testing.T) {
			db, _ := apiSQLDB(t, []apiSQLStep{test.step})
			_, err := NewAssessmentSourceRepository(db).GetCurriculumNamesWith(context.Background(), db, 1)
			if !errors.Is(err, test.err) {
				t.Fatalf("expected %v, got %v", test.err, err)
			}
		})
	}
}
