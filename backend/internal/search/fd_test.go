package search

import (
	"strings"
	"testing"
	"time"

	"fileanaer/backend/internal/domain"
)

func TestMatchesFiltersBySizeAndDate(t *testing.T) {
	item := domain.SearchResult{
		SizeBytes:  4096,
		ModifiedAt: time.Date(2026, 4, 12, 10, 0, 0, 0, time.UTC),
	}

	req := domain.SearchRequest{
		SizeMin:        1024,
		SizeMax:        8192,
		ModifiedAfter:  "2026-04-12T09:00:00Z",
		ModifiedBefore: "2026-04-12T11:00:00Z",
	}

	if !matchesFilters(item, req) {
		t.Fatal("expected item to satisfy search filters")
	}
}

func TestMatchesFiltersRejectsOutOfRange(t *testing.T) {
	item := domain.SearchResult{
		SizeBytes:  128,
		ModifiedAt: time.Date(2026, 4, 12, 8, 0, 0, 0, time.UTC),
	}

	req := domain.SearchRequest{
		SizeMin:       1024,
		ModifiedAfter: "2026-04-12T09:00:00Z",
	}

	if matchesFilters(item, req) {
		t.Fatal("expected item to be rejected by search filters")
	}
}

func TestBuildArgsUsesFixedStringsByDefault(t *testing.T) {
	req := domain.SearchRequest{Query: "report.pdf"}

	args := buildArgs(req, "/data")

	found := false
	for index := 0; index < len(args)-1; index++ {
		if args[index] == "--fixed-strings" && args[index+1] == "report.pdf" {
			found = true
			break
		}
	}

	if !found {
		t.Fatalf("expected fixed string query args, got %v", args)
	}
}

func TestBuildArgsUsesGlobForWildcardQuery(t *testing.T) {
	req := domain.SearchRequest{Query: "*.pdf"}

	args := buildArgs(req, "/data")

	found := false
	for index := 0; index < len(args)-1; index++ {
		if args[index] == "--glob" && args[index+1] == "*.pdf" {
			found = true
			break
		}
	}

	if !found {
		t.Fatalf("expected glob query args, got %v", args)
	}
}

func TestBuildArgsIncludesExcludePatterns(t *testing.T) {
	req := domain.SearchRequest{Ignore: []string{"*.log", "/data/cache"}}

	args := buildArgs(req, "/data")
	joined := strings.Join(args, " ")

	if !strings.Contains(joined, "--exclude *.log") || !strings.Contains(joined, "--exclude data/cache") {
		t.Fatalf("expected exclude args, got %v", args)
	}
}

func TestBuildArgsConvertsAbsoluteDirectoryIgnoreToRelativePatterns(t *testing.T) {
	req := domain.SearchRequest{Ignore: []string{"/data/cache"}}

	args := buildArgs(req, "/data")
	joined := strings.Join(args, " ")

	if !strings.Contains(joined, "--exclude data/cache") || !strings.Contains(joined, "--exclude data/cache/**") {
		t.Fatalf("expected relative exclude args, got %v", args)
	}
}

func TestBuildArgsIncludesHiddenFlagWhenRequested(t *testing.T) {
	req := domain.SearchRequest{IncludeHidden: true}

	args := buildArgs(req, "/data")
	joined := strings.Join(args, " ")

	if !strings.Contains(joined, "--hidden") {
		t.Fatalf("expected hidden flag, got %v", args)
	}
}

func TestBuildArgsDoesNotAutoIncludeHiddenForDotGlob(t *testing.T) {
	req := domain.SearchRequest{Query: ".*"}

	args := buildArgs(req, "/data")
	joined := strings.Join(args, " ")

	if strings.Contains(joined, "--hidden") {
		t.Fatalf("did not expect hidden flag, got %v", args)
	}
}

func TestResolveEffectiveLimitPrefersRequestLimitWhenLower(t *testing.T) {
	limit, truncatedBy := resolveEffectiveLimit(50000, 10000)
	if limit != 10000 || truncatedBy != "REQUEST_LIMIT" {
		t.Fatalf("expected request limit to win, got limit=%d truncatedBy=%s", limit, truncatedBy)
	}
}

func TestResolveEffectiveLimitFallsBackToServerLimit(t *testing.T) {
	limit, truncatedBy := resolveEffectiveLimit(50000, 0)
	if limit != 50000 || truncatedBy != "MAX_RESULTS" {
		t.Fatalf("expected server limit fallback, got limit=%d truncatedBy=%s", limit, truncatedBy)
	}
}

func TestSortSearchItemsUsesRequestedSort(t *testing.T) {
	items := []domain.SearchResult{
		{Name: "b.txt", Extension: "txt", SizeBytes: 10, ModifiedAt: time.Unix(20, 0)},
		{Name: "a.txt", Extension: "txt", SizeBytes: 50, ModifiedAt: time.Unix(10, 0)},
	}

	sortSearchItems(items, "name", "asc")

	if items[0].Name != "a.txt" {
		t.Fatalf("expected items to be sorted by name asc, got %#v", items)
	}
}

func TestSortSearchItemsUsesNaturalNameOrder(t *testing.T) {
	items := []domain.SearchResult{
		{Name: "10.txt", Path: "/data/10.txt"},
		{Name: "2.txt", Path: "/data/2.txt"},
		{Name: "1.txt", Path: "/data/1.txt"},
		{Name: "11.txt", Path: "/data/11.txt"},
	}

	sortSearchItems(items, "name", "asc")

	got := []string{items[0].Name, items[1].Name, items[2].Name, items[3].Name}
	want := []string{"1.txt", "2.txt", "10.txt", "11.txt"}
	for index := range want {
		if got[index] != want[index] {
			t.Fatalf("natural name order = %#v, want %#v", got, want)
		}
	}
}

func TestCompareSearchOrderUsesNaturalPathTieBreak(t *testing.T) {
	left := domain.SearchResult{Name: "report.txt", Path: "/data/set2/report.txt"}
	right := domain.SearchResult{Name: "report.txt", Path: "/data/set10/report.txt"}

	if got := compareSearchOrder(left, right, "name", "asc"); got >= 0 {
		t.Fatalf("compareSearchOrder() = %d, want left before right", got)
	}
}

func TestSearchCollectorKeepsTopItemsByRequestedSort(t *testing.T) {
	collector := newSearchCollector("size", "desc", 2)

	collector.add(domain.SearchResult{Name: "small.txt", Path: "/data/small.txt", SizeBytes: 10})
	collector.add(domain.SearchResult{Name: "large.txt", Path: "/data/large.txt", SizeBytes: 100})
	collector.add(domain.SearchResult{Name: "medium.txt", Path: "/data/medium.txt", SizeBytes: 50})

	items := collector.snapshot()
	sortSearchItems(items, "size", "desc")

	if collector.matchedTotal != 3 {
		t.Fatalf("matchedTotal = %d, want 3", collector.matchedTotal)
	}
	if len(items) != 2 {
		t.Fatalf("len(items) = %d, want 2", len(items))
	}
	if items[0].Name != "large.txt" || items[1].Name != "medium.txt" {
		t.Fatalf("unexpected retained items: %#v", items)
	}
}

func TestSearchCollectorKeepsTopItemsForAscendingSort(t *testing.T) {
	collector := newSearchCollector("name", "asc", 2)

	collector.add(domain.SearchResult{Name: "zeta.txt", Path: "/data/zeta.txt"})
	collector.add(domain.SearchResult{Name: "beta.txt", Path: "/data/beta.txt"})
	collector.add(domain.SearchResult{Name: "alpha.txt", Path: "/data/alpha.txt"})

	items := collector.snapshot()
	sortSearchItems(items, "name", "asc")

	if len(items) != 2 {
		t.Fatalf("len(items) = %d, want 2", len(items))
	}
	if items[0].Name != "alpha.txt" || items[1].Name != "beta.txt" {
		t.Fatalf("unexpected retained items: %#v", items)
	}
}
