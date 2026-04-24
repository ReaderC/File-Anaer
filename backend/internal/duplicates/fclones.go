package duplicates

import (
	"context"
	"fmt"
	"log"
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
	Binary string
	Runner system.Runner
}

func (s Service) Find(req domain.DuplicateFindRequest, targetPath string) (*domain.DuplicateFindResponse, error) {
	return s.FindWithProgressContext(context.Background(), req, targetPath, nil)
}

func (s Service) FindWithProgress(req domain.DuplicateFindRequest, targetPath string, onProgress func(text string, percent int, step int, total int)) (*domain.DuplicateFindResponse, error) {
	return s.FindWithProgressContext(context.Background(), req, targetPath, onProgress)
}

func (s Service) FindWithProgressContext(ctx context.Context, req domain.DuplicateFindRequest, targetPath string, onProgress func(text string, percent int, step int, total int)) (*domain.DuplicateFindResponse, error) {
	args := buildArgs(req, targetPath)
	output, err := s.Runner.RunStreamingContext(ctx, s.Binary, func(line string) {
		if onProgress == nil {
			return
		}
		text, percent, step, total, ok := parseProgressLine(line)
		if ok {
			onProgress(text, percent, step, total)
		}
	}, args...)
	if err != nil {
		return nil, err
	}

	groups, err := parseGroups(output)
	if err != nil {
		return nil, err
	}
	groups = filterDuplicateGroups(req, groups)

	totalFiles := 0
	var totalWastedBytes int64
	for i := range groups {
		sort.Slice(groups[i].Files, func(a, b int) bool {
			return naturalsort.CompareFold(groups[i].Files[a].Path, groups[i].Files[b].Path) < 0
		})
		totalFiles += len(groups[i].Files)
		totalWastedBytes += groups[i].WastedBytes
	}
	sort.Slice(groups, func(i, j int) bool {
		if groups[i].WastedBytes == groups[j].WastedBytes {
			return groups[i].Hash < groups[j].Hash
		}
		return groups[i].WastedBytes > groups[j].WastedBytes
	})

	return &domain.DuplicateFindResponse{
		Mode:             req.Mode,
		Root:             req.Root,
		Path:             targetPath,
		ComparePath:      req.ComparePath,
		Groups:           groups,
		TotalGroups:      len(groups),
		TotalFiles:       totalFiles,
		TotalWastedBytes: totalWastedBytes,
		UpdatedAt:        time.Now().UTC(),
	}, nil
}

func (s Service) Execute(ctx context.Context, req domain.DuplicateActionRequest, root string) (*domain.DuplicateActionResponse, error) {
	if len(req.Groups) == 0 {
		return nil, fmt.Errorf("no duplicate groups selected")
	}
	if req.Mode == domain.DuplicateActionDelete {
		return s.executeDelete(req, root)
	}
	if req.Mode == domain.DuplicateActionRename {
		return s.executeRename(req, root)
	}

	report, fileCount, reclaimedBytes, affectedPaths, err := s.buildActionReport(req, root)
	if err != nil {
		return nil, err
	}
	if fileCount == 0 {
		return nil, fmt.Errorf("duplicate rename has no changes")
	}

	args, needsRescan, unchangedMessage, err := buildActionArgs(req.Mode, req.DryRun)
	if err != nil {
		return nil, err
	}
	log.Printf("duplicates action mode=%s dryRun=%t groups=%d files=%d args=%q", req.Mode, req.DryRun, len(req.Groups), fileCount, args)
	log.Printf("duplicates action report summary groups=%d files=%d bytes=%d", len(req.Groups), fileCount, len(report))
	logActionSnapshots("before", req.Groups)

	if _, err := s.Runner.RunContextWithInput(ctx, report, s.Binary, args...); err != nil {
		log.Printf("duplicates action failed mode=%s err=%v", req.Mode, err)
		return nil, err
	}
	logActionSnapshots("after", req.Groups)

	return &domain.DuplicateActionResponse{
		Mode:             req.Mode,
		DryRun:           req.DryRun,
		GroupCount:       len(req.Groups),
		FileCount:        fileCount,
		ReclaimedBytes:   reclaimedBytes,
		NeedsRescan:      needsRescan,
		AffectedPaths:    affectedPaths,
		UnchangedMessage: unchangedMessage,
	}, nil
}

func (s Service) executeDelete(req domain.DuplicateActionRequest, root string) (*domain.DuplicateActionResponse, error) {
	affectedPaths := make([]string, 0)
	issues := make([]string, 0)
	fileCount := 0
	groupCount := 0
	var reclaimedBytes int64

	for _, group := range req.Groups {
		selectedPaths := dedupeStrings(group.SelectedPaths)
		if len(selectedPaths) == 0 {
			continue
		}

		groupDeleted := 0
		for _, path := range selectedPaths {
			info, err := os.Stat(path)
			if err != nil || info.IsDir() {
				issues = append(issues, fmt.Sprintf("副本文件不存在或已变化: %s", path))
				continue
			}
			if !pathWithinRoot(root, path) {
				issues = append(issues, fmt.Sprintf("副本文件超出扫描范围: %s", path))
				continue
			}
			if req.DryRun {
				affectedPaths = append(affectedPaths, path)
				fileCount++
				groupDeleted++
				reclaimedBytes += info.Size()
				continue
			}
			if err := os.Remove(path); err != nil {
				issues = append(issues, fmt.Sprintf("删除失败: %s", path))
				continue
			}
			affectedPaths = append(affectedPaths, path)
			fileCount++
			groupDeleted++
			reclaimedBytes += info.Size()
		}
		if groupDeleted > 0 {
			groupCount++
		}
	}

	if len(issues) > 0 {
		return nil, fmt.Errorf("以下文件已被移动、重命名或修改，请重新扫描后再操作：%s", summarizeValidationIssues(issues))
	}
	if fileCount == 0 {
		return nil, fmt.Errorf("duplicate rename has no changes")
	}

	return &domain.DuplicateActionResponse{
		Mode:           req.Mode,
		DryRun:         req.DryRun,
		GroupCount:     groupCount,
		FileCount:      fileCount,
		ReclaimedBytes: reclaimedBytes,
		NeedsRescan:    false,
		AffectedPaths:  affectedPaths,
	}, nil
}

func (s Service) executeRename(req domain.DuplicateActionRequest, root string) (*domain.DuplicateActionResponse, error) {
	renamedFiles := make([]domain.DuplicateRenamedFile, 0)
	affectedPaths := make([]string, 0)
	fileCount := 0
	groupCount := 0
	issues := make([]string, 0)

	for _, group := range req.Groups {
		keepPath := strings.TrimSpace(group.KeepPath)
		if keepPath == "" {
			return nil, fmt.Errorf("keep path is required")
		}
		if !pathWithinRoot(root, keepPath) {
			issues = append(issues, fmt.Sprintf("保留文件超出扫描范围: %s", keepPath))
			continue
		}
		keepInfo, err := os.Stat(keepPath)
		if err != nil || keepInfo.IsDir() {
			issues = append(issues, fmt.Sprintf("保留文件不可用: %s", keepPath))
			continue
		}

		selectedPaths := dedupeStrings(group.SelectedPaths)
		targetPaths := make([]string, 0, len(selectedPaths)+1)
		scope := req.RenameScope
		if scope == "" {
			scope = domain.DuplicateRenameScopeCopies
		}
		if scope == domain.DuplicateRenameScopeGroup {
			targetPaths = append(targetPaths, keepPath)
		}
		targetPaths = append(targetPaths, selectedPaths...)
		targetPaths = dedupeStrings(targetPaths)
		if len(targetPaths) == 0 {
			continue
		}

		reservedTargets := make(map[string]struct{}, len(targetPaths))
		groupRenamed := 0
		for _, path := range targetPaths {
			info, err := os.Stat(path)
			if err != nil || info.IsDir() {
				issues = append(issues, fmt.Sprintf("待重命名文件不存在或已变化: %s", path))
				continue
			}
			if !pathWithinRoot(root, path) {
				issues = append(issues, fmt.Sprintf("待重命名文件超出扫描范围: %s", path))
				continue
			}

			targetName, err := buildRenameTargetName(req, keepPath, path)
			if err != nil {
				return nil, err
			}
			targetPath, err := uniqueRenameTarget(filepath.Dir(path), path, targetName, reservedTargets)
			if err != nil {
				issues = append(issues, err.Error())
				continue
			}
			if filepath.Clean(targetPath) == filepath.Clean(path) {
				reservedTargets[filepath.Clean(targetPath)] = struct{}{}
				continue
			}
			if statErr := os.Rename(path, targetPath); statErr != nil {
				issues = append(issues, fmt.Sprintf("重命名失败: %s -> %s", path, targetPath))
				continue
			}

			affectedPaths = append(affectedPaths, targetPath)
			reservedTargets[filepath.Clean(targetPath)] = struct{}{}
			renamedFiles = append(renamedFiles, domain.DuplicateRenamedFile{
				OldPath: path,
				NewPath: targetPath,
			})
			fileCount++
			groupRenamed++
		}
		if groupRenamed > 0 {
			groupCount++
		}
	}
	if len(issues) > 0 {
		return nil, fmt.Errorf("以下文件已被移动、重命名或修改，请重新扫描后再操作：%s", summarizeValidationIssues(issues))
	}

	if fileCount == 0 {
		return nil, fmt.Errorf("duplicate rename has no changes")
	}

	return &domain.DuplicateActionResponse{
		Mode:          req.Mode,
		DryRun:        req.DryRun,
		GroupCount:    groupCount,
		FileCount:     fileCount,
		NeedsRescan:   false,
		AffectedPaths: affectedPaths,
		RenamedFiles:  renamedFiles,
	}, nil
}

func (s Service) UndoRename(req domain.DuplicateUndoRenameRequest, root string) (*domain.DuplicateUndoRenameResponse, error) {
	restoredFiles := make([]domain.DuplicateRenamedFile, 0, len(req.RenamedFiles))
	issues := make([]string, 0)

	for _, file := range req.RenamedFiles {
		oldPath := strings.TrimSpace(file.OldPath)
		newPath := strings.TrimSpace(file.NewPath)
		if oldPath == "" || newPath == "" {
			continue
		}
		if !pathWithinRoot(root, oldPath) || !pathWithinRoot(root, newPath) {
			issues = append(issues, fmt.Sprintf("回滚路径超出扫描范围: %s <- %s", oldPath, newPath))
			continue
		}
		if _, err := os.Stat(oldPath); err == nil {
			issues = append(issues, fmt.Sprintf("回滚目标已存在: %s", oldPath))
			continue
		}
		info, err := os.Stat(newPath)
		if err != nil || info.IsDir() {
			issues = append(issues, fmt.Sprintf("待回滚文件不存在或已变化: %s", newPath))
			continue
		}
		if err := os.Rename(newPath, oldPath); err != nil {
			issues = append(issues, fmt.Sprintf("回滚失败: %s -> %s", newPath, oldPath))
			continue
		}
		restoredFiles = append(restoredFiles, domain.DuplicateRenamedFile{
			OldPath: oldPath,
			NewPath: newPath,
		})
	}

	if len(issues) > 0 {
		return nil, fmt.Errorf("以下文件无法回滚，请刷新后重试：%s", summarizeValidationIssues(issues))
	}
	if len(restoredFiles) == 0 {
		return nil, fmt.Errorf("no renamed files selected")
	}

	return &domain.DuplicateUndoRenameResponse{
		FileCount:     len(restoredFiles),
		RestoredFiles: restoredFiles,
	}, nil
}

func buildArgs(req domain.DuplicateFindRequest, targetPath string) []string {
	args := []string{"group"}
	if req.MinSizeBytes > 0 {
		args = append(args, "--min", strconv.FormatInt(req.MinSizeBytes, 10))
	}
	if req.IncludeHidden {
		args = append(args, "--no-ignore", "--hidden")
	}
	for _, item := range req.Ignore {
		for _, pattern := range expandExcludePatterns(targetPath, item) {
			args = append(args, "--exclude", pattern)
		}
	}
	paths := []string{targetPath}
	if strings.TrimSpace(req.ComparePath) != "" && !containsPath(paths, req.ComparePath) {
		paths = append(paths, req.ComparePath)
	}
	return append(args, paths...)
}

func buildActionArgs(mode domain.DuplicateActionMode, dryRun bool) ([]string, bool, string, error) {
	args := make([]string, 0, 4)
	needsRescan := false
	unchangedMessage := ""
	switch mode {
	case domain.DuplicateActionDelete:
		args = append(args, "remove")
		needsRescan = false
	case domain.DuplicateActionHardlink:
		args = append(args, "link")
		needsRescan = false
	case domain.DuplicateActionSymlink:
		args = append(args, "link", "-s")
		needsRescan = false
	case domain.DuplicateActionReflink:
		args = append(args, "dedupe")
		needsRescan = true
		unchangedMessage = "reflink preserves duplicate file entries; rescan to refresh space usage"
	case domain.DuplicateActionRename:
		return nil, false, "", fmt.Errorf("rename does not use fclones action args")
	default:
		return nil, false, "", fmt.Errorf("unsupported duplicate action")
	}
	if dryRun {
		args = append(args, "--dry-run")
	}
	return args, needsRescan, unchangedMessage, nil
}

func buildRenameTargetName(req domain.DuplicateActionRequest, keepPath string, selectedPath string) (string, error) {
	switch req.RenameMode {
	case domain.DuplicateRenameModeKeeper:
		return filepath.Base(keepPath), nil
	case domain.DuplicateRenameModeManual:
		name := strings.TrimSpace(req.RenameName)
		if name == "" {
			return "", fmt.Errorf("rename name is required")
		}
		name = filepath.Base(name)
		if name == "." || name == string(filepath.Separator) || name == "" {
			return "", fmt.Errorf("rename name is invalid")
		}
		if filepath.Ext(name) == "" {
			name += filepath.Ext(selectedPath)
		}
		return name, nil
	default:
		return "", fmt.Errorf("rename mode is required")
	}
}

func uniqueRenameTarget(dir string, currentPath string, targetName string, reserved map[string]struct{}) (string, error) {
	base := strings.TrimSuffix(targetName, filepath.Ext(targetName))
	ext := filepath.Ext(targetName)
	candidate := filepath.Join(dir, targetName)
	cleanCandidate := filepath.Clean(candidate)
	if filepath.Clean(currentPath) == cleanCandidate {
		return candidate, nil
	}
	if _, ok := reserved[cleanCandidate]; !ok {
		if existing, err := os.Stat(candidate); err == nil && !existing.IsDir() {
			// fall through to suffixed candidates
		} else if err == nil && existing.IsDir() {
			return "", fmt.Errorf("rename target already exists as a directory: %s", candidate)
		} else if os.IsNotExist(err) {
			return candidate, nil
		} else if err != nil && !os.IsNotExist(err) {
			return "", fmt.Errorf("failed to inspect rename target: %s", candidate)
		}
	}

	for index := 2; index <= 9999; index++ {
		nextName := fmt.Sprintf("%s (%d)%s", base, index, ext)
		nextPath := filepath.Join(dir, nextName)
		cleanNextPath := filepath.Clean(nextPath)
		if _, ok := reserved[cleanNextPath]; ok {
			continue
		}
		existing, err := os.Stat(nextPath)
		if os.IsNotExist(err) {
			return nextPath, nil
		}
		if err != nil {
			return "", fmt.Errorf("failed to inspect rename target: %s", nextPath)
		}
		if existing.IsDir() {
			return "", fmt.Errorf("rename target already exists as a directory: %s", nextPath)
		}
	}

	return "", fmt.Errorf("failed to allocate unique rename target for %s", targetName)
}

func summarizeValidationIssues(issues []string) string {
	if len(issues) == 0 {
		return ""
	}
	limit := len(issues)
	if limit > 6 {
		limit = 6
	}
	summary := strings.Join(issues[:limit], "；")
	if len(issues) > limit {
		summary += fmt.Sprintf("；以及另外 %d 项", len(issues)-limit)
	}
	return summary
}

func (s Service) buildActionReport(req domain.DuplicateActionRequest, root string) ([]byte, int, int64, []string, error) {
	var builder strings.Builder
	fileCount := 0
	var reclaimedBytes int64
	var totalBytes int64
	affectedPaths := make([]string, 0)
	groupCount := 0
	issues := make([]string, 0)

	for _, group := range req.Groups {
		keepPath := strings.TrimSpace(group.KeepPath)
		var keepInfo os.FileInfo
		if req.Mode != domain.DuplicateActionDelete && keepPath == "" {
			return nil, 0, 0, nil, fmt.Errorf("keep path is required")
		}
		selectedPaths := dedupeStrings(group.SelectedPaths)
		if len(selectedPaths) == 0 {
			continue
		}
		if req.Mode != domain.DuplicateActionDelete && containsPath(selectedPaths, keepPath) {
			return nil, 0, 0, nil, fmt.Errorf("keep path cannot also be selected")
		}

		if req.Mode != domain.DuplicateActionDelete {
			var err error
			keepInfo, err = os.Stat(keepPath)
			if err != nil || keepInfo.IsDir() {
				issues = append(issues, fmt.Sprintf("保留文件不可用: %s", keepPath))
				continue
			}
			if !pathWithinRoot(root, keepPath) {
				issues = append(issues, fmt.Sprintf("保留文件超出扫描范围: %s", keepPath))
				continue
			}
		}

		validPaths := make([]string, 0, len(selectedPaths))
		for _, path := range selectedPaths {
			info, err := os.Stat(path)
			if err != nil || info.IsDir() {
				issues = append(issues, fmt.Sprintf("副本文件不存在或已变化: %s", path))
				continue
			}
			if !pathWithinRoot(root, path) {
				issues = append(issues, fmt.Sprintf("副本文件超出扫描范围: %s", path))
				continue
			}
			if info.Size() != keepInfo.Size() {
				issues = append(issues, fmt.Sprintf("副本文件大小已变化: %s", path))
				continue
			}
			validPaths = append(validPaths, path)
			affectedPaths = append(affectedPaths, path)
			fileCount++
			reclaimedBytes += info.Size()
		}
		if len(validPaths) == 0 {
			continue
		}
		hash := strings.TrimSpace(group.Hash)
		if hash == "" {
			hash = filepath.Base(keepPath)
		}

		// Emit one two-file group per selected duplicate. This keeps the
		// "keep first, operate on the later entry" contract explicit for fclones
		// and avoids multi-selection actions only affecting the first duplicate.
		for _, path := range validPaths {
			groupCount++
			totalBytes += keepInfo.Size() * 2
			builder.WriteString(fmt.Sprintf("%s, %d B (%s) * 2:\n", hash, keepInfo.Size(), reportByteLabel(keepInfo.Size())))
			builder.WriteString("    ")
			builder.WriteString(filepath.ToSlash(keepPath))
			builder.WriteByte('\n')
			builder.WriteString("    ")
			builder.WriteString(filepath.ToSlash(path))
			builder.WriteByte('\n')
		}
	}
	if len(issues) > 0 {
		return nil, 0, 0, nil, fmt.Errorf("以下文件已被移动、重命名或修改，请重新扫描后再操作：%s", summarizeValidationIssues(issues))
	}

	content := builder.String()
	builder.Reset()
	builder.WriteString("# Report by fclones 0.34.0\n")
	builder.WriteString(fmt.Sprintf("# Timestamp: %s\n", time.Now().UTC().Format("2006-01-02 15:04:05.000 -0700")))
	builder.WriteString("# Command: fclones group .\n")
	builder.WriteString(fmt.Sprintf("# Base dir: %s\n", filepath.ToSlash(root)))
	builder.WriteString(fmt.Sprintf("# Total: %d B (%s) in %d files in %d groups\n", totalBytes, reportByteLabel(totalBytes), fileCount+groupCount, groupCount))
	builder.WriteString(fmt.Sprintf("# Redundant: %d B (%s) in %d files\n", reclaimedBytes, reportByteLabel(reclaimedBytes), fileCount))
	builder.WriteString("# Missing: 0 B (0 B) in 0 files\n")
	builder.WriteString(content)

	return []byte(builder.String()), fileCount, reclaimedBytes, affectedPaths, nil
}

func dedupeStrings(items []string) []string {
	result := make([]string, 0, len(items))
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		value := strings.TrimSpace(item)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func containsPath(items []string, candidate string) bool {
	for _, item := range items {
		if filepath.Clean(item) == filepath.Clean(candidate) {
			return true
		}
	}
	return false
}

func pathWithinRoot(root, candidate string) bool {
	root = filepath.Clean(root)
	candidate = filepath.Clean(candidate)
	if root == candidate {
		return true
	}
	relative, err := filepath.Rel(root, candidate)
	if err != nil {
		return false
	}
	return relative != ".." && !strings.HasPrefix(relative, ".."+string(filepath.Separator))
}

func reportByteLabel(size int64) string {
	if size <= 0 {
		return "0 B"
	}
	return fmt.Sprintf("%d B", size)
}

func logActionSnapshots(stage string, groups []domain.DuplicateActionGroup) {
	for _, group := range groups {
		log.Printf("duplicates action snapshot stage=%s role=keep path=%q %s", stage, group.KeepPath, describeFileState(group.KeepPath))
		for _, path := range group.SelectedPaths {
			log.Printf("duplicates action snapshot stage=%s role=selected path=%q %s", stage, path, describeFileState(path))
		}
	}
}

func describeFileState(path string) string {
	info, err := os.Lstat(path)
	if err != nil {
		return fmt.Sprintf("error=%q", err.Error())
	}
	mode := info.Mode()
	isSymlink := mode&os.ModeSymlink != 0
	size := info.Size()
	platformMeta := describePlatformFileState(info)
	if platformMeta == "" {
		return fmt.Sprintf("mode=%q size=%d isSymlink=%t", mode.String(), size, isSymlink)
	}
	return fmt.Sprintf("mode=%q size=%d isSymlink=%t %s", mode.String(), size, isSymlink, platformMeta)
}

func parseGroups(output []byte) ([]domain.DuplicateGroup, error) {
	text := strings.ReplaceAll(string(output), "\r\n", "\n")
	lines := strings.Split(text, "\n")
	groups := make([]domain.DuplicateGroup, 0)

	var current *domain.DuplicateGroup
	for _, rawLine := range lines {
		line := strings.TrimRight(rawLine, " \t")
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") || strings.Contains(trimmed, "fclones:") || strings.HasPrefix(trimmed, "6/6:") {
			continue
		}

		if group, ok := parseGroupHeader(trimmed); ok {
			if current != nil && len(current.Files) >= 2 {
				current.WastedBytes = int64(len(current.Files)-1) * current.SizeBytes
				groups = append(groups, *current)
			}
			current = &group
			continue
		}

		if current == nil {
			continue
		}

		path := strings.TrimSpace(trimmed)
		if path == "" {
			continue
		}
		info, err := os.Stat(path)
		if err != nil || info.IsDir() {
			continue
		}
		current.Files = append(current.Files, domain.DuplicateFile{
			Path:       path,
			Name:       filepath.Base(path),
			ParentPath: filepath.Dir(path),
			SizeBytes:  info.Size(),
			ModifiedAt: info.ModTime().UTC(),
		})
	}

	if current != nil && len(current.Files) >= 2 {
		current.WastedBytes = int64(len(current.Files)-1) * current.SizeBytes
		groups = append(groups, *current)
	}

	return groups, nil
}

func parseGroupHeader(line string) (domain.DuplicateGroup, bool) {
	header, found := strings.CutSuffix(line, ":")
	if !found {
		return domain.DuplicateGroup{}, false
	}
	hashPart, rest, found := strings.Cut(header, ",")
	if !found {
		return domain.DuplicateGroup{}, false
	}
	hashPart = strings.TrimSpace(hashPart)
	sizePart, countPart, found := strings.Cut(strings.TrimSpace(rest), "*")
	if !found {
		return domain.DuplicateGroup{}, false
	}

	sizeToken := strings.TrimSpace(sizePart)
	sizeToken, _, found = strings.Cut(sizeToken, " ")
	if !found {
		return domain.DuplicateGroup{}, false
	}
	sizeBytes, err := strconv.ParseInt(strings.TrimSpace(sizeToken), 10, 64)
	if err != nil {
		return domain.DuplicateGroup{}, false
	}

	fileCount, err := strconv.Atoi(strings.TrimSpace(countPart))
	if err != nil {
		fileCount = 0
	}

	return domain.DuplicateGroup{
		Hash:      hashPart,
		FileCount: fileCount,
		SizeBytes: sizeBytes,
		Files:     make([]domain.DuplicateFile, 0, max(fileCount, 2)),
	}, true
}

func expandExcludePatterns(targetPath, value string) []string {
	pattern := strings.TrimSpace(value)
	if pattern == "" {
		return nil
	}
	pattern = filepath.ToSlash(filepath.Clean(pattern))
	targetPath = filepath.ToSlash(filepath.Clean(targetPath))

	if strings.ContainsAny(pattern, "*?[]{}") {
		return []string{pattern}
	}

	patterns := make([]string, 0, 6)
	addPattern := func(value string) {
		value = strings.TrimSpace(filepath.ToSlash(value))
		if value == "" {
			return
		}
		for _, existing := range patterns {
			if existing == value {
				return
			}
		}
		patterns = append(patterns, value)
	}

	addPattern(pattern)
	addPattern(pattern + "/**")

	if strings.HasPrefix(pattern, targetPath+"/") {
		relative := strings.TrimPrefix(pattern, targetPath+"/")
		addPattern(relative)
		addPattern(relative + "/**")
		addPattern("**/" + relative)
		addPattern("**/" + relative + "/**")
	}

	return patterns
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func parseProgressLine(line string) (string, int, int, int, bool) {
	trimmed := strings.TrimSpace(line)
	if trimmed == "" {
		return "", 0, 0, 0, false
	}
	if strings.Contains(trimmed, "fclones:") && strings.Contains(trimmed, "info:") {
		parts := strings.SplitN(trimmed, "info:", 2)
		if len(parts) == 2 {
			return strings.TrimSpace(parts[1]), 0, 0, 0, true
		}
	}
	if current, rest, ok := strings.Cut(trimmed, "/"); ok {
		currentValue, err := strconv.Atoi(strings.TrimSpace(current))
		if err != nil {
			return "", 0, 0, 0, false
		}
		totalText, phaseText, ok := strings.Cut(rest, ":")
		if !ok {
			return "", 0, 0, 0, false
		}
		totalValue, err := strconv.Atoi(strings.TrimSpace(totalText))
		if err != nil || totalValue <= 0 {
			return "", 0, 0, 0, false
		}
		percent := currentValue * 100 / totalValue
		return strings.TrimSpace(phaseText), percent, currentValue, totalValue, true
	}
	return "", 0, 0, 0, false
}

func filterDuplicateGroups(req domain.DuplicateFindRequest, groups []domain.DuplicateGroup) []domain.DuplicateGroup {
	mode := strings.TrimSpace(req.Mode)
	if mode == "" || mode == "scan" {
		return groups
	}

	filtered := make([]domain.DuplicateGroup, 0, len(groups))
	for _, group := range groups {
		files := group.Files
		switch mode {
		case "folders":
			files = filterFilesByComparedFolders(group.Files, req.Path, req.ComparePath)
			if !hasFilesOnBothComparedSides(files, req.Path, req.ComparePath) {
				continue
			}
		case "file":
			files = filterFilesByFileAndFolder(group.Files, req.Path, req.ComparePath)
			if !hasExactFile(files, req.Path) || !hasFileUnderPath(files, req.ComparePath) {
				continue
			}
		default:
			continue
		}
		if len(files) < 2 {
			continue
		}
		group.Files = files
		group.FileCount = len(files)
		group.WastedBytes = int64(max(len(files)-1, 0)) * group.SizeBytes
		filtered = append(filtered, group)
	}
	return filtered
}

func filterFilesByComparedFolders(files []domain.DuplicateFile, left string, right string) []domain.DuplicateFile {
	result := make([]domain.DuplicateFile, 0, len(files))
	for _, file := range files {
		inLeft, inRight := comparedFolderSides(file.Path, left, right)
		if inLeft || inRight {
			result = append(result, file)
		}
	}
	return result
}

func hasFilesOnBothComparedSides(files []domain.DuplicateFile, left string, right string) bool {
	hasLeft := false
	hasRight := false
	for _, file := range files {
		inLeft, inRight := comparedFolderSides(file.Path, left, right)
		hasLeft = hasLeft || inLeft
		hasRight = hasRight || inRight
		if hasLeft && hasRight {
			return true
		}
	}
	return false
}

func comparedFolderSides(candidate string, left string, right string) (bool, bool) {
	inLeft := pathWithinRoot(left, candidate)
	inRight := pathWithinRoot(right, candidate)
	if !inLeft && !inRight {
		return false, false
	}

	leftContainsRight := pathWithinRoot(left, right) && filepath.Clean(left) != filepath.Clean(right)
	rightContainsLeft := pathWithinRoot(right, left) && filepath.Clean(left) != filepath.Clean(right)

	if leftContainsRight && inRight {
		inLeft = false
	}
	if rightContainsLeft && inLeft {
		inRight = false
	}
	return inLeft, inRight
}

func filterFilesByFileAndFolder(files []domain.DuplicateFile, filePath string, folderPath string) []domain.DuplicateFile {
	result := make([]domain.DuplicateFile, 0, len(files))
	for _, file := range files {
		if filepath.Clean(file.Path) == filepath.Clean(filePath) || pathWithinRoot(folderPath, file.Path) {
			result = append(result, file)
		}
	}
	return result
}

func hasFileUnderPath(files []domain.DuplicateFile, path string) bool {
	for _, file := range files {
		if pathWithinRoot(path, file.Path) {
			return true
		}
	}
	return false
}

func hasExactFile(files []domain.DuplicateFile, path string) bool {
	for _, file := range files {
		if filepath.Clean(file.Path) == filepath.Clean(path) {
			return true
		}
	}
	return false
}
