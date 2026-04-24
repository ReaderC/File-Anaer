package treemap

import (
	"context"
	"encoding/json"
	"fmt"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"fileanaer/backend/internal/domain"
	"fileanaer/backend/internal/system"
)

type Analyzer struct {
	Binary string
	Runner system.Runner
}

func (a Analyzer) Analyze(path string, maxDepth, topN int, ignore []string) (*domain.AnalyzeResponse, error) {
	return a.AnalyzeContext(context.Background(), path, maxDepth, topN, ignore)
}

func (a Analyzer) AnalyzeContext(ctx context.Context, path string, maxDepth, topN int, ignore []string) (*domain.AnalyzeResponse, error) {
	args := []string{"--non-interactive", "--no-progress", "--output-file", "-"}
	for _, item := range ignore {
		value := strings.TrimSpace(item)
		if value == "" {
			continue
		}
		args = append(args, "--ignore-dirs", value)
	}
	args = append(args, path)

	data, err := a.Runner.RunContext(ctx, a.Binary, args...)
	if err != nil {
		return nil, err
	}
	node, err := parseTreeLegacy(data)
	if err != nil {
		return nil, err
	}
	if maxDepth > 0 {
		node = trimTree(node, 0, maxDepth)
	}
	stats, topFiles := summarize(node, topN)
	return &domain.AnalyzeResponse{
		Root:      path,
		Path:      path,
		Tree:      node,
		TypeStats: stats,
		TopFiles:  topFiles,
		UpdatedAt: time.Now().UTC(),
	}, nil
}

func parseTree(data []byte) (domain.TreeNode, error) {
	return parseTreeLegacy(data)
}

func parseTreeLegacy(data []byte) (domain.TreeNode, error) {
	var payload any
	if err := json.Unmarshal(data, &payload); err != nil {
		return domain.TreeNode{}, fmt.Errorf("parse gdu json: %w", err)
	}

	switch value := payload.(type) {
	case map[string]any:
		if _, ok := value["children"]; ok {
			return mapNode(value), nil
		}
		for _, key := range []string{"root", "data", "tree"} {
			if nested, ok := value[key].(map[string]any); ok {
				return mapNode(nested), nil
			}
		}
	case []any:
		if root, ok := parseArrayPayload(value); ok {
			return root, nil
		}
	}

	return domain.TreeNode{}, fmt.Errorf("unsupported gdu json payload")
}

func parseArrayPayload(value []any) (domain.TreeNode, bool) {
	for index := len(value) - 1; index >= 0; index-- {
		node, ok := parseExportNode(value[index], "")
		if ok {
			return node, true
		}
	}
	return domain.TreeNode{}, false
}

func parseExportNode(raw any, parentPath string) (domain.TreeNode, bool) {
	switch value := raw.(type) {
	case map[string]any:
		name := getString(value, "name", "Name", "path", "Path")
		if name == "" {
			return domain.TreeNode{}, false
		}
		nodePath := name
		if parentPath != "" && !strings.HasPrefix(name, "/") {
			nodePath = path.Join(parentPath, name)
		}
		modifiedAt := time.Unix(getInt(value, "mtime", "Mtime"), 0).UTC()
		return domain.TreeNode{
			ID:         nodePath,
			Name:       filepath.Base(name),
			Path:       nodePath,
			SizeBytes:  max(getInt(value, "dsize", "Dsize", "size", "Size"), getInt(value, "asize", "Asize")),
			ModifiedAt: modifiedAt,
			Type:       "file",
			FileCount:  1,
		}, true
	case []any:
		if len(value) == 0 {
			return domain.TreeNode{}, false
		}

		meta, ok := value[0].(map[string]any)
		if !ok {
			return domain.TreeNode{}, false
		}

		name := getString(meta, "name", "Name", "path", "Path")
		if name == "" {
			return domain.TreeNode{}, false
		}
		nodePath := name
		if parentPath != "" && !strings.HasPrefix(name, "/") {
			nodePath = path.Join(parentPath, name)
		}

		node := domain.TreeNode{
			ID:         nodePath,
			Name:       filepath.Base(name),
			Path:       nodePath,
			ModifiedAt: time.Unix(getInt(meta, "mtime", "Mtime"), 0).UTC(),
			Type:       "directory",
		}

		for _, childRaw := range value[1:] {
			child, childOK := parseExportNode(childRaw, nodePath)
			if !childOK {
				continue
			}
			node.Children = append(node.Children, child)
			node.SizeBytes += child.SizeBytes
			node.FileCount += child.FileCount
		}

		if node.Name == "." || node.Name == "" {
			node.Name = nodePath
		}
		return node, true
	default:
		return domain.TreeNode{}, false
	}
}

func mapNode(raw map[string]any) domain.TreeNode {
	name := getString(raw, "name", "n")
	path := getString(raw, "path", "p")
	if path == "" {
		path = name
	}

	nodeType := "file"
	if len(asSlice(raw, "children", "c")) > 0 || getBool(raw, "isDir", "dir") {
		nodeType = "directory"
	}

	node := domain.TreeNode{
		ID:         path,
		Name:       fallbackName(name, path),
		Path:       path,
		SizeBytes:  getInt(raw, "size", "dsize", "sizeBytes"),
		ModifiedAt: time.Unix(getInt(raw, "mtime", "modifiedAt"), 0).UTC(),
		Type:       nodeType,
		FileCount:  max(getInt(raw, "fileCount", "count", "files"), 1),
	}

	for _, childRaw := range asSlice(raw, "children", "c") {
		childMap, ok := childRaw.(map[string]any)
		if !ok {
			continue
		}
		child := mapNode(childMap)
		node.Children = append(node.Children, child)
	}

	if len(node.Children) > 0 {
		node.Type = "directory"
		if node.SizeBytes == 0 {
			for _, child := range node.Children {
				node.SizeBytes += child.SizeBytes
			}
		}
		if node.FileCount <= 1 {
			var count int64
			for _, child := range node.Children {
				count += child.FileCount
			}
			node.FileCount = count
		}
	}

	return node
}

func trimTree(node domain.TreeNode, depth, maxDepth int) domain.TreeNode {
	if depth >= maxDepth {
		if len(node.Children) > 0 {
			node.HasLazyChildren = true
		}
		node.Children = nil
		return node
	}

	trimmed := make([]domain.TreeNode, 0, len(node.Children))
	for _, child := range node.Children {
		trimmed = append(trimmed, trimTree(child, depth+1, maxDepth))
	}
	node.Children = trimmed
	return node
}

func summarize(root domain.TreeNode, topN int) ([]domain.TypeStat, []domain.TopFile) {
	typeSizes := map[string]int64{}
	topFiles := make([]domain.TopFile, 0)

	var walk func(node domain.TreeNode)
	walk = func(node domain.TreeNode) {
		if node.Type == "directory" {
			for _, child := range node.Children {
				walk(child)
			}
			return
		}

		ext := strings.TrimPrefix(strings.ToLower(filepath.Ext(node.Name)), ".")
		label := classify(ext)
		typeSizes[label] += node.SizeBytes
		topFiles = append(topFiles, domain.TopFile{
			Name:       node.Name,
			Path:       node.Path,
			ParentPath: filepath.Dir(node.Path),
			Extension:  ext,
			SizeBytes:  node.SizeBytes,
			ModifiedAt: node.ModifiedAt,
			IsDir:      false,
		})
	}

	walk(root)

	stats := make([]domain.TypeStat, 0, len(typeSizes))
	for label, size := range typeSizes {
		stats = append(stats, domain.TypeStat{Label: label, SizeBytes: size})
	}
	sort.Slice(stats, func(i, j int) bool {
		return stats[i].SizeBytes > stats[j].SizeBytes
	})
	for i := range stats {
		if root.SizeBytes > 0 {
			stats[i].Percentage = float64(stats[i].SizeBytes) / float64(root.SizeBytes) * 100
		}
	}

	sort.Slice(topFiles, func(i, j int) bool {
		return topFiles[i].SizeBytes > topFiles[j].SizeBytes
	})
	if topN > 0 && len(topFiles) > topN {
		topFiles = topFiles[:topN]
	}

	return stats, topFiles
}

func insertTopFile(items []domain.TopFile, nextItem domain.TopFile, limit int) []domain.TopFile {
	insertAt := -1
	for index := range items {
		if nextItem.SizeBytes > items[index].SizeBytes {
			insertAt = index
			break
		}
	}
	if insertAt == -1 {
		if len(items) >= limit {
			return items
		}
		insertAt = len(items)
	}
	items = append(items, domain.TopFile{})
	copy(items[insertAt+1:], items[insertAt:])
	items[insertAt] = nextItem
	if len(items) > limit {
		items = items[:limit]
	}
	return items
}

func classify(ext string) string {
	switch ext {
	case "mp4", "mov", "mkv", "avi", "webm":
		return "Videos"
	case "jpg", "jpeg", "png", "gif", "webp", "psd", "svg":
		return "Images"
	case "pdf", "doc", "docx", "txt", "md", "xlsx", "ppt", "pptx":
		return "Documents"
	case "zip", "rar", "7z", "tar", "gz", "bz2", "xz", "iso":
		return "Archives"
	default:
		return "Others"
	}
}

func getString(raw map[string]any, keys ...string) string {
	for _, key := range keys {
		if value, ok := raw[key].(string); ok {
			return value
		}
	}
	return ""
}

func getBool(raw map[string]any, keys ...string) bool {
	for _, key := range keys {
		if value, ok := raw[key].(bool); ok {
			return value
		}
	}
	return false
}

func asSlice(raw map[string]any, keys ...string) []any {
	for _, key := range keys {
		if value, ok := raw[key].([]any); ok {
			return value
		}
	}
	return nil
}

func getInt(raw map[string]any, keys ...string) int64 {
	for _, key := range keys {
		switch value := raw[key].(type) {
		case float64:
			return int64(value)
		case int64:
			return value
		case json.Number:
			parsed, _ := value.Int64()
			return parsed
		}
	}
	return 0
}

func fallbackName(name, path string) string {
	if name != "" {
		return name
	}
	base := filepath.Base(path)
	if base == "." || base == string(filepath.Separator) {
		return path
	}
	return base
}

func max(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}
