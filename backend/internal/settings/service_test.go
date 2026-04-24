package settings

import (
	"path/filepath"
	"reflect"
	"testing"

	"fileanaer/backend/internal/domain"
)

func TestNewUsesDefaultsWhenStateFileMissing(t *testing.T) {
	service, err := New(filepath.Join(t.TempDir(), "settings.json"))
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}

	got := service.Get()
	if got.Locale != "zh" || got.Theme != "system" || got.SearchPageSize != 50 || !got.CopyHostPath {
		t.Fatalf("unexpected defaults: %#v", got)
	}
}

func TestSavePersistsNormalizedSettings(t *testing.T) {
	stateFile := filepath.Join(t.TempDir(), "settings.json")
	service, err := New(stateFile)
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}

	saved, err := service.Save(domain.AppSettings{
		Locale:               "en",
		Theme:                "dark",
		TreemapFileColorMode: "type",
		TreemapDetailLevel:   "detailed",
		CopyHostPath:         true,
		ScanIgnore:           []string{" /data/cache ", "/data/cache", "/data/tmp"},
		SearchPageSize:       9999,
	})
	if err != nil {
		t.Fatalf("Save() error = %v", err)
	}

	reloaded, err := New(stateFile)
	if err != nil {
		t.Fatalf("reload New() error = %v", err)
	}

	want := domain.AppSettings{
		Locale:               "en",
		Theme:                "dark",
		TreemapFileColorMode: "type",
		TreemapDetailLevel:   "detailed",
		CopyHostPath:         true,
		ScanIgnore:           []string{"/data/cache", "/data/tmp"},
		SearchPageSize:       50,
	}

	if !reflect.DeepEqual(saved, want) {
		t.Fatalf("saved settings = %#v, want %#v", saved, want)
	}
	if got := reloaded.Get(); !reflect.DeepEqual(got, want) {
		t.Fatalf("reloaded settings = %#v, want %#v", got, want)
	}
}
