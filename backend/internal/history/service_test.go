package history

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestServiceSaveListGetDeleteClear(t *testing.T) {
	stateFile := filepath.Join(t.TempDir(), "history.json")
	svc, err := New(stateFile)
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}

	fullEntry := Entry{
		"id":        "a",
		"savedAt":   "2026-04-22T10:00:00Z",
		"path":      "/data/a",
		"maxDepth":  3,
		"sizeBytes": 123,
		"result": Entry{
			"path": "/data/a",
			"tree": Entry{
				"path":      "/data/a",
				"sizeBytes": 123,
			},
		},
	}

	entries, err := svc.Save("analysis-history", fullEntry, 10)
	if err != nil {
		t.Fatalf("Save() error = %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("saved entry count = %d, want 1", len(entries))
	}
	if _, hasResult := entries[0]["result"]; hasResult {
		t.Fatal("List() summary should not include full result")
	}

	got, err := svc.Get("analysis-history", "a")
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}
	if got["result"] == nil {
		t.Fatal("Get() should include full result")
	}

	listed, err := svc.Delete("analysis-history", "a", 10)
	if err != nil {
		t.Fatalf("Delete() error = %v", err)
	}
	if len(listed) != 0 {
		t.Fatalf("Delete() = %#v, want empty", listed)
	}

	if _, err := svc.Get("analysis-history", "a"); err == nil {
		t.Fatal("expected missing detail after delete")
	}

	if _, err := svc.Save("duplicate-action-log", Entry{
		"id":      "log-1",
		"savedAt": "2026-04-22T10:00:00Z",
		"title":   "done",
		"result":  Entry{"fileCount": 2},
	}, 10); err != nil {
		t.Fatalf("Save(action-log) error = %v", err)
	}

	logEntry, err := svc.Get("duplicate-action-log", "log-1")
	if err != nil {
		t.Fatalf("Get(action-log) error = %v", err)
	}
	if logEntry["result"] == nil {
		t.Fatal("action log should remain inline")
	}

	cleared, err := svc.Clear("duplicate-action-log")
	if err != nil {
		t.Fatalf("Clear() error = %v", err)
	}
	if len(cleared) != 0 {
		t.Fatalf("Clear() = %#v, want empty", cleared)
	}
}

func TestServicePersistsAllEntriesAndReturnsLimitedView(t *testing.T) {
	stateFile := filepath.Join(t.TempDir(), "history.json")
	svc, err := New(stateFile)
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}

	for _, item := range []struct {
		id      string
		savedAt string
	}{
		{id: "a", savedAt: "2026-04-22T10:00:00Z"},
		{id: "b", savedAt: "2026-04-22T11:00:00Z"},
		{id: "c", savedAt: "2026-04-22T12:00:00Z"},
	} {
		if _, err := svc.Save("analysis-history", Entry{
			"id":        item.id,
			"savedAt":   item.savedAt,
			"path":      "/data/" + item.id,
			"sizeBytes": 1,
			"result": Entry{
				"path": "/data/" + item.id,
				"tree": Entry{
					"path":      "/data/" + item.id,
					"sizeBytes": 1,
				},
			},
		}, 2); err != nil {
			t.Fatalf("Save(%q) error = %v", item.id, err)
		}
	}

	listed, err := svc.List("analysis-history", 2)
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if len(listed) != 2 || listed[0]["id"] != "c" || listed[1]["id"] != "b" {
		t.Fatalf("List() = %#v, want limited ordered summaries", listed)
	}

	data, err := os.ReadFile(stateFile)
	if err != nil {
		t.Fatalf("ReadFile() error = %v", err)
	}
	var persisted struct {
		Stores map[string][]Entry `json:"stores"`
	}
	if err := json.Unmarshal(data, &persisted); err != nil {
		t.Fatalf("Unmarshal() error = %v", err)
	}
	if got := len(persisted.Stores["analysis-history"]); got != 3 {
		t.Fatalf("persisted analysis-history length = %d, want 3", got)
	}
	if _, hasResult := persisted.Stores["analysis-history"][0]["result"]; hasResult {
		t.Fatal("index should not persist full result for analysis history")
	}
}

func TestServiceIgnoresLegacyInlineHistoryFiles(t *testing.T) {
	tempDir := t.TempDir()
	stateFile := filepath.Join(tempDir, "history.json")
	legacy := map[string]any{
		"stores": map[string]any{
			"analysis-history": []any{
				map[string]any{
					"id":      "legacy-analysis",
					"savedAt": "2026-04-22T10:00:00Z",
					"path":    "/data/a",
					"result": map[string]any{
						"path": "/data/a",
						"tree": map[string]any{
							"path":      "/data/a",
							"sizeBytes": 42,
						},
					},
				},
			},
			"duplicate-history": []any{
				map[string]any{
					"id":      "legacy-duplicate",
					"savedAt": "2026-04-22T11:00:00Z",
					"path":    "/data/b",
					"result": map[string]any{
						"path":             "/data/b",
						"totalGroups":      3,
						"totalFiles":       9,
						"totalWastedBytes": 99,
						"groups":           []any{},
					},
				},
			},
		},
	}
	data, err := json.Marshal(legacy)
	if err != nil {
		t.Fatalf("Marshal() error = %v", err)
	}
	if err := os.WriteFile(stateFile, data, 0o644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	svc, err := New(stateFile)
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}

	listed, err := svc.List("analysis-history", 10)
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if len(listed) != 0 {
		t.Fatalf("List() = %#v, want empty because legacy files are ignored", listed)
	}

	if _, err := svc.Get("analysis-history", "legacy-analysis"); err == nil {
		t.Fatal("legacy entries should not be loaded")
	}
}

func TestServiceIgnoresMalformedCurrentIndexFile(t *testing.T) {
	tempDir := t.TempDir()
	stateFile := filepath.Join(tempDir, "history.json")
	malformed := map[string]any{
		"version": 2,
		"stores": map[string]any{
			"analysis-history": map[string]any{
				"id": "broken",
			},
		},
	}
	data, err := json.Marshal(malformed)
	if err != nil {
		t.Fatalf("Marshal() error = %v", err)
	}
	if err := os.WriteFile(stateFile, data, 0o644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	svc, err := New(stateFile)
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}

	listed, err := svc.List("analysis-history", 10)
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if len(listed) != 0 {
		t.Fatalf("List() = %#v, want empty because malformed index files are ignored", listed)
	}
}

func TestServiceRejectsInvalidStore(t *testing.T) {
	svc, err := New(filepath.Join(t.TempDir(), "history.json"))
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	if _, err := svc.List("unknown", 10); err == nil {
		t.Fatal("expected invalid store error")
	}
}
