package api

import (
	"path/filepath"
	"reflect"
	"testing"

	"fileanaer/backend/internal/config"
)

func TestToContainerPathUsesHostPathMaps(t *testing.T) {
	handler := Handler{
		Config: config.Config{
			HostPathMaps: map[string]string{
				"/data/main":  "/vol1/1000/main",
				"/data/media": "/mnt/media",
			},
		},
	}

	tests := []struct {
		name string
		in   string
		want string
	}{
		{
			name: "mapped root",
			in:   "/vol1/1000/main",
			want: filepath.Clean("/data/main"),
		},
		{
			name: "mapped child path",
			in:   "/vol1/1000/main/cache/thumbs",
			want: filepath.Clean("/data/main/cache/thumbs"),
		},
		{
			name: "unmapped path remains unchanged",
			in:   "/other/place/cache",
			want: filepath.Clean("/other/place/cache"),
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := handler.toContainerPath(tc.in); got != tc.want {
				t.Fatalf("toContainerPath(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}


func TestNormalizeIgnorePathsIncludesMappedContainerPaths(t *testing.T) {
	handler := Handler{
		Config: config.Config{
			HostPathMaps: map[string]string{
				"/data/main": "/vol1/1000/main",
			},
		},
	}

	got := handler.normalizeIgnorePaths([]string{
		"/vol1/1000/main/cache",
		"/data/main/tmp",
		"  ",
	})

	want := []string{
		filepath.Clean("/vol1/1000/main/cache"),
		filepath.Clean("/data/main/cache"),
		filepath.Clean("/data/main/tmp"),
	}

	if !reflect.DeepEqual(got, want) {
		t.Fatalf("normalizeIgnorePaths() = %#v, want %#v", got, want)
	}
}
