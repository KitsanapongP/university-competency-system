package main

import (
	"path/filepath"
	"testing"
)

func TestSyntheticFixtureContainment(t *testing.T) {
	root := filepath.Join(t.TempDir(), "fixtures")
	if !inside(root, filepath.Join(root, "api", "example.json")) {
		t.Fatal("valid fixture rejected")
	}
	if inside(root, filepath.Join(root, "..", "private.json")) || inside(root, root+"-private") {
		t.Fatal("outside file allowed")
	}
}
