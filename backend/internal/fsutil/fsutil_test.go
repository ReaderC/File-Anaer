package fsutil

import (
	"path/filepath"
	"testing"
)

func TestResolveWithinRootAllowsNestedPath(t *testing.T) {
	resolved, err := ResolveWithinRoot("/data", "documents/report.pdf")
	if err != nil {
		t.Fatalf("expected nested path to resolve, got error: %v", err)
	}
	if resolved != filepath.Clean("/data/documents/report.pdf") {
		t.Fatalf("unexpected resolved path: %s", resolved)
	}
}

func TestResolveWithinRootRejectsEscape(t *testing.T) {
	_, err := ResolveWithinRoot("/data", "../etc/passwd")
	if err == nil {
		t.Fatal("expected escape path to be rejected")
	}
}
