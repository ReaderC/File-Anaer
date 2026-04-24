package search

import (
	"container/heap"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"fileanaer/backend/internal/domain"
	"fileanaer/backend/internal/naturalsort"
	"fileanaer/backend/internal/system"
)

type Service struct {
	Binary     string
	Runner     system.Runner
	MaxResults int
}

func (s Service) Search(req domain.SearchRequest, targetPaths []string) (*domain.SearchResponse, error) {
	effectiveLimit, truncatedBy := resolveEffectiveLimit(s.MaxResults, req.RequestLimit)
	collector := newSearchCollector(req.SortBy, req.SortDir, effectiveLimit)
	for _, targetPath := range targetPaths {
		args := buildArgs(req, targetPath)
		for _, ext := range req.Extensions {
			ext = strings.TrimPrefix(strings.TrimSpace(ext), ".")
			if ext != "" {
				args = append(args, "--extension", ext)
			}
		}

		err := s.Runner.RunLineStreamingContext(context.Background(), s.Binary, func(line string) error {
			line = strings.TrimSpace(line)
			if line == "" {
				return nil
			}
			item, ok := buildResult(line)
			if !ok {
				return nil
			}
			if len(req.Roots) > 0 {
				item.Root = targetPath
			} else {
				item.Root = req.Root
			}
			if !matchesFilters(item, req) {
				return nil
			}
			collector.add(item)
			return nil
		}, nil, args...)
		if err != nil {
			return nil, err
		}
	}

	items := collector.snapshot()
	sortSearchItems(items, req.SortBy, req.SortDir)

	responsePath := req.Path
	if len(targetPaths) == 1 {
		responsePath = targetPaths[0]
	}
	total := len(items)
	offset := clamp(req.Offset, 0, total)
	limit := req.Limit
	if limit <= 0 {
		limit = 100
	}
	end := clamp(offset+limit, 0, total)

	return &domain.SearchResponse{
		Root:           req.Root,
		Roots:          append([]string(nil), targetPaths...),
		Path:           responsePath,
		Items:          items[offset:end],
		Total:          total,
		Limit:          limit,
		Offset:         offset,
		UpdatedAt:      time.Now().UTC(),
		MatchedTotal:   collector.matchedTotal,
		Truncated:      effectiveLimit > 0 && collector.matchedTotal > len(items),
		TruncatedCount: maxInt(collector.matchedTotal-len(items), 0),
		ResultLimit:    effectiveLimit,
		TruncatedBy:    truncatedBy,
	}, nil
}

type searchCollector struct {
	items        []domain.SearchResult
	matchedTotal int
	limit        int
	sortBy       string
	sortDir      string
}

func newSearchCollector(sortBy, sortDir string, limit int) *searchCollector {
	return &searchCollector{
		items:   make([]domain.SearchResult, 0, minPositive(limit, 256)),
		limit:   limit,
		sortBy:  normalizeSortBy(sortBy),
		sortDir: normalizeSortDir(sortDir),
	}
}

func (c *searchCollector) add(item domain.SearchResult) {
	c.matchedTotal += 1
	if c.limit <= 0 {
		c.items = append(c.items, item)
		return
	}
	if len(c.items) < c.limit {
		heap.Push(c, item)
		return
	}
	if compareSearchOrder(item, c.items[0], c.sortBy, c.sortDir) < 0 {
		c.items[0] = item
		heap.Fix(c, 0)
	}
}

func (c *searchCollector) snapshot() []domain.SearchResult {
	return append([]domain.SearchResult(nil), c.items...)
}

func (c *searchCollector) Len() int {
	return len(c.items)
}

func (c *searchCollector) Less(i, j int) bool {
	return compareSearchOrder(c.items[i], c.items[j], c.sortBy, c.sortDir) > 0
}

func (c *searchCollector) Swap(i, j int) {
	c.items[i], c.items[j] = c.items[j], c.items[i]
}

func (c *searchCollector) Push(value any) {
	c.items = append(c.items, value.(domain.SearchResult))
}

func (c *searchCollector) Pop() any {
	lastIndex := len(c.items) - 1
	item := c.items[lastIndex]
	c.items = c.items[:lastIndex]
	return item
}

func resolveEffectiveLimit(serverLimit, requestLimit int) (int, string) {
	switch {
	case serverLimit > 0 && requestLimit > 0:
		if requestLimit < serverLimit {
			return requestLimit, "REQUEST_LIMIT"
		}
		return serverLimit, "MAX_RESULTS"
	case requestLimit > 0:
		return requestLimit, "REQUEST_LIMIT"
	case serverLimit > 0:
		return serverLimit, "MAX_RESULTS"
	default:
		return 0, ""
	}
}

func sortSearchItems(items []domain.SearchResult, sortBy, sortDir string) {
	if len(items) < 2 {
		return
	}
	sortBy = normalizeSortBy(sortBy)
	sortDir = normalizeSortDir(sortDir)
	sort.Slice(items, func(i, j int) bool {
		return compareSearchOrder(items[i], items[j], sortBy, sortDir) < 0
	})
}

func compareSearchOrder(left, right domain.SearchResult, sortBy, sortDir string) int {
	result := compareSearchItems(left, right, sortBy)
	if result == 0 {
		result = compareSearchItems(left, right, "name")
	}
	if result == 0 {
		result = naturalsort.CompareFold(left.Path, right.Path)
	}
	if sortDir == "asc" {
		return result
	}
	return -result
}

func normalizeSortBy(sortBy string) string {
	sortBy = strings.TrimSpace(strings.ToLower(sortBy))
	if sortBy == "" {
		return "size"
	}
	return sortBy
}

func normalizeSortDir(sortDir string) string {
	sortDir = strings.TrimSpace(strings.ToLower(sortDir))
	if sortDir != "asc" {
		return "desc"
	}
	return sortDir
}

func compareSearchItems(left, right domain.SearchResult, sortBy string) int {
	switch sortBy {
	case "name":
		return naturalsort.CompareFold(left.Name, right.Name)
	case "type":
		return naturalsort.CompareFold(left.Extension, right.Extension)
	case "date":
		return compareInt64(left.ModifiedAt.UnixNano(), right.ModifiedAt.UnixNano())
	case "size":
		fallthrough
	default:
		return compareInt64(left.SizeBytes, right.SizeBytes)
	}
}

func buildResult(fullPath string) (domain.SearchResult, bool) {
	info, err := os.Stat(fullPath)
	if err != nil {
		return domain.SearchResult{}, false
	}

	return domain.SearchResult{
		Path:       fullPath,
		Name:       filepath.Base(fullPath),
		Extension:  strings.TrimPrefix(strings.ToLower(filepath.Ext(fullPath)), "."),
		SizeBytes:  info.Size(),
		ModifiedAt: info.ModTime().UTC(),
		IsDir:      info.IsDir(),
		ParentPath: filepath.Dir(fullPath),
	}, true
}

func matchesFilters(item domain.SearchResult, req domain.SearchRequest) bool {
	if req.SizeMin > 0 && item.SizeBytes < req.SizeMin {
		return false
	}
	if req.SizeMax > 0 && item.SizeBytes > req.SizeMax {
		return false
	}

	if req.ModifiedAfter != "" {
		if after, err := time.Parse(time.RFC3339, req.ModifiedAfter); err == nil && item.ModifiedAt.Before(after) {
			return false
		}
	}
	if req.ModifiedBefore != "" {
		if before, err := time.Parse(time.RFC3339, req.ModifiedBefore); err == nil && item.ModifiedAt.After(before) {
			return false
		}
	}

	return true
}

func clamp(value, minValue, maxValue int) int {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}

func maxInt(left, right int) int {
	if left > right {
		return left
	}
	return right
}

func minPositive(left, right int) int {
	if left <= 0 {
		return right
	}
	if left < right {
		return left
	}
	return right
}

func compareInt64(left, right int64) int {
	switch {
	case left < right:
		return -1
	case left > right:
		return 1
	default:
		return 0
	}
}

func ExampleSearchResponse() string {
	sample := domain.SearchResponse{
		Root:   "/data",
		Path:   "/data",
		Total:  1,
		Limit:  100,
		Offset: 0,
		Items: []domain.SearchResult{{
			Path:       "/data/demo/report.pdf",
			Name:       "report.pdf",
			Extension:  "pdf",
			SizeBytes:  1024,
			ModifiedAt: time.Unix(0, 0).UTC(),
			IsDir:      false,
			ParentPath: "/data/demo",
		}},
		UpdatedAt: time.Unix(0, 0).UTC(),
	}
	data, _ := json.MarshalIndent(sample, "", "  ")
	return string(data)
}

func SearchArgsForDebug(req domain.SearchRequest, targetPath string) string {
	args := buildArgs(req, targetPath)
	return fmt.Sprintf("%v", args)
}

func ParseInt64(value string) int64 {
	parsed, _ := strconv.ParseInt(value, 10, 64)
	return parsed
}

func buildArgs(req domain.SearchRequest, targetPath string) []string {
	pattern := strings.TrimSpace(req.Query)
	args := []string{
		"--absolute-path",
		"--base-directory", targetPath,
		"--color", "never",
	}
	if req.IncludeHidden {
		args = append(args, "--hidden")
	}
	for _, item := range req.Ignore {
		for _, value := range expandExcludePatterns(targetPath, item) {
			args = append(args, "--exclude", value)
		}
	}

	if pattern == "" {
		return args
	}

	if strings.ContainsAny(pattern, "*?[]{}") {
		args = append(args, "--glob", pattern)
		return args
	}

	return append(args, "--fixed-strings", pattern)
}

func expandExcludePatterns(targetPath, value string) []string {
	pattern := strings.TrimSpace(value)
	if pattern == "" {
		return nil
	}
	if strings.ContainsAny(pattern, "*?[]{}") {
		return []string{pattern}
	}

	normalizedTarget := filepath.Clean(targetPath)
	normalizedPattern := filepath.Clean(pattern)
	relative := normalizedPattern
	if filepath.IsAbs(normalizedPattern) {
		if rel, err := filepath.Rel(normalizedTarget, normalizedPattern); err == nil && rel != "." && !strings.HasPrefix(rel, "..") {
			relative = rel
		}
	}
	relative = filepath.ToSlash(strings.TrimPrefix(relative, "."+string(filepath.Separator)))
	relative = strings.TrimPrefix(relative, "/")
	if relative == "" || relative == "." {
		return nil
	}
	return []string{relative, relative + "/**"}
}
