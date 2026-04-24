package duplicates

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"fileanaer/backend/internal/domain"
	"fileanaer/backend/internal/naturalsort"
)

func TestParseGroupsFdupesStyleOutput(t *testing.T) {
	tmpDir := t.TempDir()
	fileA := filepath.Join(tmpDir, "a.txt")
	fileB := filepath.Join(tmpDir, "b.txt")
	for _, path := range []string{fileA, fileB} {
		if err := os.WriteFile(path, []byte("duplicate"), 0o644); err != nil {
			t.Fatal(err)
		}
	}

	output := []byte("# Report by fclones 0.34.0\n" +
		"# Total: 18 B (18 B) in 2 files in 1 groups\n" +
		"abc123, 9 B (9 B) * 2:\n" +
		"    " + fileA + "\n" +
		"    " + fileB + "\n")
	groups, err := parseGroups(output)
	if err != nil {
		t.Fatalf("parseGroups returned error: %v", err)
	}
	if len(groups) != 1 {
		t.Fatalf("expected 1 group, got %d", len(groups))
	}
	if groups[0].FileCount != 2 {
		t.Fatalf("expected 2 files in group, got %d", groups[0].FileCount)
	}
	if groups[0].Hash != "abc123" {
		t.Fatalf("expected hash abc123, got %s", groups[0].Hash)
	}
	if groups[0].SizeBytes != 9 {
		t.Fatalf("expected size 9, got %d", groups[0].SizeBytes)
	}
	if groups[0].WastedBytes <= 0 {
		t.Fatalf("expected positive wasted bytes, got %d", groups[0].WastedBytes)
	}
}

func TestExpandExcludePatterns(t *testing.T) {
	target := "/data/dev"
	patterns := expandExcludePatterns(target, "/data/dev/cache")
	expected := map[string]bool{
		"/data/dev/cache":    true,
		"/data/dev/cache/**": true,
		"cache":              true,
		"cache/**":           true,
		"**/cache":           true,
		"**/cache/**":        true,
	}
	if len(patterns) != len(expected) {
		t.Fatalf("expected %d patterns, got %d: %#v", len(expected), len(patterns), patterns)
	}
	for _, pattern := range patterns {
		if !expected[pattern] {
			t.Fatalf("unexpected pattern: %s", pattern)
		}
	}
}

func TestBuildActionArgs(t *testing.T) {
	args, needsRescan, _, err := buildActionArgs(domain.DuplicateActionSymlink, false)
	if err != nil {
		t.Fatalf("buildActionArgs returned error: %v", err)
	}
	if strings.Join(args, " ") != "link -s" {
		t.Fatalf("unexpected args: %v", args)
	}
	if needsRescan {
		t.Fatalf("symlink should not require rescan")
	}
}

func TestParseProgressLine(t *testing.T) {
	text, percent, step, total, ok := parseProgressLine("6/6: Grouping by contents [======> ] 1.1 GB / 7.1 GB")
	if !ok {
		t.Fatalf("expected progress line to parse")
	}
	if text != "Grouping by contents [======> ] 1.1 GB / 7.1 GB" {
		t.Fatalf("unexpected text: %s", text)
	}
	if percent != 100 || step != 6 || total != 6 {
		t.Fatalf("unexpected progress fields: percent=%d step=%d total=%d", percent, step, total)
	}
}

func TestBuildActionReport(t *testing.T) {
	tmpDir := t.TempDir()
	keep := filepath.Join(tmpDir, "keep.txt")
	copyA := filepath.Join(tmpDir, "copy-a.txt")
	copyB := filepath.Join(tmpDir, "copy-b.txt")
	for _, path := range []string{keep, copyA, copyB} {
		if err := os.WriteFile(path, []byte("duplicate"), 0o644); err != nil {
			t.Fatal(err)
		}
	}

	svc := Service{}
	report, fileCount, reclaimedBytes, affected, err := svc.buildActionReport(domain.DuplicateActionRequest{
		Root: tmpDir,
		Groups: []domain.DuplicateActionGroup{{
			Hash:          "abc123",
			KeepPath:      keep,
			SelectedPaths: []string{copyA, copyB},
		}},
	}, tmpDir)
	if err != nil {
		t.Fatalf("buildActionReport returned error: %v", err)
	}
	text := string(report)
	if !strings.Contains(text, "# Report by fclones 0.34.0") || !strings.Contains(text, "# Total: 36 B (36 B) in 4 files in 2 groups") {
		t.Fatalf("unexpected report header: %s", text)
	}
	if strings.Count(text, "abc123, 9 B (9 B) * 2:") != 2 {
		t.Fatalf("unexpected group section: %s", text)
	}
	if strings.Contains(text, "\n\nabc123, 9 B (9 B) * 2:") {
		t.Fatalf("report should not contain blank lines between groups: %s", text)
	}
	if fileCount != 2 {
		t.Fatalf("expected 2 selected files, got %d", fileCount)
	}
	if reclaimedBytes != 18 {
		t.Fatalf("expected reclaimed size 18, got %d", reclaimedBytes)
	}
	if len(affected) != 2 {
		t.Fatalf("expected 2 affected paths, got %d", len(affected))
	}
}

func TestCompareNaturalFoldSortsNumericPathsNaturally(t *testing.T) {
	paths := []string{
		"/data/10.txt",
		"/data/2.txt",
		"/data/1.txt",
		"/data/11.txt",
	}

	sort.Slice(paths, func(i, j int) bool {
		return naturalsort.CompareFold(paths[i], paths[j]) < 0
	})

	want := []string{
		"/data/1.txt",
		"/data/2.txt",
		"/data/10.txt",
		"/data/11.txt",
	}
	for index := range want {
		if paths[index] != want[index] {
			t.Fatalf("natural duplicate path order = %#v, want %#v", paths, want)
		}
	}
}

func TestExecuteRenameReturnsNoChangesErrorWhenNamesAlreadyMatch(t *testing.T) {
	tmpDir := t.TempDir()
	keep := filepath.Join(tmpDir, "DESIGN.md")
	copyPath := filepath.Join(tmpDir, "nested", "DESIGN.md")
	if err := os.MkdirAll(filepath.Dir(copyPath), 0o755); err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{keep, copyPath} {
		if err := os.WriteFile(path, []byte("duplicate"), 0o644); err != nil {
			t.Fatal(err)
		}
	}

	svc := Service{}
	_, err := svc.executeRename(domain.DuplicateActionRequest{
		Mode:       domain.DuplicateActionRename,
		Root:       tmpDir,
		RenameMode: domain.DuplicateRenameModeKeeper,
		Groups: []domain.DuplicateActionGroup{{
			Hash:          "same-name",
			KeepPath:      keep,
			SelectedPaths: []string{copyPath},
		}},
	}, tmpDir)
	if err == nil {
		t.Fatal("expected executeRename to return a no-changes error")
	}
	if !strings.Contains(err.Error(), "duplicate rename has no changes") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestExecuteRenameDryRunDoesNotRenameFiles(t *testing.T) {
	tmpDir := t.TempDir()
	keep := filepath.Join(tmpDir, "39 (2).cc")
	copyPath := filepath.Join(tmpDir, "39.cc")
	for _, path := range []string{keep, copyPath} {
		if err := os.WriteFile(path, []byte("duplicate"), 0o644); err != nil {
			t.Fatal(err)
		}
	}

	svc := Service{}
	result, err := svc.executeRename(domain.DuplicateActionRequest{
		Mode:        domain.DuplicateActionRename,
		Root:        tmpDir,
		DryRun:      true,
		RenameMode:  domain.DuplicateRenameModeKeeper,
		RenameScope: domain.DuplicateRenameScopeCopies,
		Groups: []domain.DuplicateActionGroup{{
			Hash:          "preview",
			KeepPath:      keep,
			SelectedPaths: []string{copyPath},
		}},
	}, tmpDir)
	if err != nil {
		t.Fatalf("executeRename dry run returned error: %v", err)
	}
	if result == nil || result.FileCount != 1 {
		t.Fatalf("expected one previewed rename, got %#v", result)
	}
	if _, err := os.Stat(copyPath); err != nil {
		t.Fatalf("expected original file to remain after dry run, stat error: %v", err)
	}
	if _, err := os.Stat(filepath.Join(tmpDir, "39 (3).cc")); err == nil {
		t.Fatal("expected dry run to avoid creating renamed target")
	}
}

func TestFilterDuplicateGroupsFoldersNestedDirectories(t *testing.T) {
	parent := filepath.Clean("/data/dev/B")
	child := filepath.Join(parent, "A")

	makeFile := func(path string) domain.DuplicateFile {
		return domain.DuplicateFile{
			Path:       filepath.Clean(path),
			Name:       filepath.Base(path),
			ParentPath: filepath.Dir(path),
			SizeBytes:  10,
		}
	}

	groups := []domain.DuplicateGroup{
		{
			Hash:      "child-only",
			SizeBytes: 10,
			Files: []domain.DuplicateFile{
				makeFile(filepath.Join(child, "one.txt")),
				makeFile(filepath.Join(child, "copy", "one.txt")),
			},
		},
		{
			Hash:      "cross-side",
			SizeBytes: 10,
			Files: []domain.DuplicateFile{
				makeFile(filepath.Join(parent, "root.txt")),
				makeFile(filepath.Join(child, "root.txt")),
			},
		},
		{
			Hash:      "parent-only",
			SizeBytes: 10,
			Files: []domain.DuplicateFile{
				makeFile(filepath.Join(parent, "x.txt")),
				makeFile(filepath.Join(parent, "other", "x.txt")),
			},
		},
	}

	filtered := filterDuplicateGroups(domain.DuplicateFindRequest{
		Mode:        "folders",
		Path:        parent,
		ComparePath: child,
	}, groups)

	if len(filtered) != 1 {
		t.Fatalf("expected 1 cross-side group, got %d", len(filtered))
	}
	if filtered[0].Hash != "cross-side" {
		t.Fatalf("expected cross-side group to remain, got %s", filtered[0].Hash)
	}
	if filtered[0].FileCount != 2 {
		t.Fatalf("expected filtered file count 2, got %d", filtered[0].FileCount)
	}
}
