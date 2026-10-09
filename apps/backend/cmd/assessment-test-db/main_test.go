package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDestinationGuard(t *testing.T) {
	for _, target := range []string{"production", "source_test", "SOURCE_TEST", "bad_test;DROP", "../other_test"} {
		if validateDestination("source_test", target) == nil {
			t.Fatalf("unsafe destination accepted: %s", target)
		}
	}
	if err := validateDestination("source", "ucs_assessment_llm_test"); err != nil {
		t.Fatal(err)
	}
}

func TestPrivateOutputGuard(t *testing.T) {
	for _, path := range []string{"", ".env", filepath.Join(os.TempDir(), "..", "secret.json")} {
		if validatePrivatePath(path) == nil {
			t.Fatal("unsafe private path accepted")
		}
	}
	if err := validatePrivatePath(filepath.Join(os.TempDir(), "assessment-private.json")); err != nil {
		t.Fatal(err)
	}
}

func TestReferenceAccountsAreDisabledAndRedacted(t *testing.T) {
	selected := map[string]any{"user_id": int64(1), "email": "learner@example.test", "password_hash": "SOURCE_SECRET", "is_active": int64(1)}
	other := map[string]any{"user_id": int64(2), "email": "PRIVATE_EMAIL", "password_hash": "SOURCE_SECRET", "is_active": int64(1)}
	person := map[string]any{"person_id": int64(2), "email": "PRIVATE_EMAIL", "first_name_th": "PRIVATE_NAME", "national_id": "PRIVATE_ID"}
	tables := map[string]*tableData{"auth_users": {rows: map[string]map[string]any{"1": selected, "2": other}}, "persons": {rows: map[string]map[string]any{"2": person}}}
	redactReferenceIdentities(tables, 1, 1, "TEST_HASH")
	if selected["email"] != "learner@example.test" || selected["password_hash"] != "TEST_HASH" || other["email"] == "PRIVATE_EMAIL" || other["is_active"] != 0 || person["first_name_th"] == "PRIVATE_NAME" || person["national_id"] != nil {
		t.Fatal("identity redaction failed")
	}
}
