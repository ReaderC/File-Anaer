package api

import "testing"

func TestValidateComparableFolderPaths(t *testing.T) {
	t.Run("accepts sibling folders", func(t *testing.T) {
		if err := validateComparableFolderPaths("/data/left", "/data/right"); err != nil {
			t.Fatalf("expected sibling folders to be accepted, got %v", err)
		}
	})

	t.Run("rejects same folder", func(t *testing.T) {
		if err := validateComparableFolderPaths("/data/left", "/data/left"); err == nil {
			t.Fatal("expected identical folders to be rejected")
		}
	})

	t.Run("rejects nested child folder", func(t *testing.T) {
		if err := validateComparableFolderPaths("/data/left", "/data/left/child"); err == nil {
			t.Fatal("expected nested child folder to be rejected")
		}
	})

	t.Run("rejects nested grandchild folder", func(t *testing.T) {
		if err := validateComparableFolderPaths("/data/left", "/data/left/child/grandchild"); err == nil {
			t.Fatal("expected nested grandchild folder to be rejected")
		}
	})
}
