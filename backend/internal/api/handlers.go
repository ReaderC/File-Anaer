package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"runtime/debug"
	"sort"
	"strconv"
	"strings"
	"time"

	"fileanaer/backend/internal/auth"
	"fileanaer/backend/internal/config"
	"fileanaer/backend/internal/domain"
	"fileanaer/backend/internal/duplicates"
	"fileanaer/backend/internal/fsutil"
	"fileanaer/backend/internal/history"
	"fileanaer/backend/internal/jobs"
	"fileanaer/backend/internal/search"
	"fileanaer/backend/internal/settings"
	"fileanaer/backend/internal/system"
	"fileanaer/backend/internal/treemap"
)

type Handler struct {
	Config        config.Config
	Jobs          *jobs.Manager
	DuplicateJobs *jobs.DuplicateManager
	Analyzer      treemap.Analyzer
	DuplicateSvc  duplicates.Service
	SearchSvc     search.Service
	Settings      *settings.Service
	History       *history.Service
	Auth          *auth.Service
}

func (h Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("/api/health", h.handleHealth)
	h.registerAuthRoutes(mux)
	mux.HandleFunc("/api/history", h.handleHistory)
	mux.HandleFunc("/api/runtime/release", h.handleRuntimeRelease)
	mux.HandleFunc("/api/settings", h.handleSettings)
	mux.HandleFunc("/api/roots", h.handleRoots)
	mux.HandleFunc("/api/analyze", h.handleAnalyze)
	mux.HandleFunc("/api/analyze/tree", h.handleAnalyzeTree)
	mux.HandleFunc("/api/analyze/", h.handleAnalyzeJob)
	mux.HandleFunc("/api/duplicates", h.handleDuplicates)
	mux.HandleFunc("/api/duplicates/actions", h.handleDuplicateActions)
	mux.HandleFunc("/api/duplicates/actions/undo-rename", h.handleDuplicateUndoRename)
	mux.HandleFunc("/api/duplicates/refresh", h.handleDuplicateRefresh)
	mux.HandleFunc("/api/duplicates/", h.handleDuplicateJob)
	mux.HandleFunc("/api/preview", h.handlePreview)
	mux.HandleFunc("/api/directories", h.handleDirectories)
	mux.HandleFunc("/api/search", h.handleSearch)
}

type runtimeReleaseRequest struct {
	AnalyzeJobID   string `json:"analyzeJobId"`
	DuplicateJobID string `json:"duplicateJobId"`
	ClearAll       bool   `json:"clearAll"`
}

func (h Handler) handleRuntimeRelease(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req runtimeReleaseRequest
	if r.Body != nil {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil && !errors.Is(err, io.EOF) {
			writeError(w, http.StatusBadRequest, "invalid runtime release request")
			return
		}
	}

	if req.ClearAll || (strings.TrimSpace(req.AnalyzeJobID) == "" && strings.TrimSpace(req.DuplicateJobID) == "") {
		if h.Jobs != nil {
			h.Jobs.Clear()
		}
		if h.DuplicateJobs != nil {
			h.DuplicateJobs.Clear()
		}
		releaseProcessMemory()
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
		return
	}

	if h.Jobs != nil && strings.TrimSpace(req.AnalyzeJobID) != "" {
		h.Jobs.Delete(strings.TrimSpace(req.AnalyzeJobID))
	}
	if h.DuplicateJobs != nil && strings.TrimSpace(req.DuplicateJobID) != "" {
		h.DuplicateJobs.Delete(strings.TrimSpace(req.DuplicateJobID))
	}

	releaseProcessMemory()
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func releaseProcessMemory() {
	runtime.GC()
	debug.FreeOSMemory()
}

func (h Handler) handleHistory(w http.ResponseWriter, r *http.Request) {
	if h.History == nil {
		writeError(w, http.StatusServiceUnavailable, "history service unavailable")
		return
	}

	store := r.URL.Query().Get("store")
	limit := 10
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	switch r.Method {
	case http.MethodGet:
		id := strings.TrimSpace(r.URL.Query().Get("id"))
		if id != "" {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			err := h.History.StreamDetailJSON(store, id, w)
			if err != nil {
				if strings.Contains(err.Error(), "not found") {
					writeError(w, http.StatusNotFound, err.Error())
					return
				}
				writeError(w, http.StatusBadRequest, err.Error())
				return
			}
			return
		}
		entries, err := h.History.List(store, limit)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": entries})
	case http.MethodPost:
		var entry history.Entry
		if err := json.NewDecoder(r.Body).Decode(&entry); err != nil {
			writeError(w, http.StatusBadRequest, "invalid history entry")
			return
		}
		entries, err := h.History.Save(store, entry, limit)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": entries})
	case http.MethodDelete:
		id := strings.TrimSpace(r.URL.Query().Get("id"))
		var (
			entries []history.Entry
			err     error
		)
		if id == "" {
			entries, err = h.History.Clear(store)
		} else {
			entries, err = h.History.Delete(store, id, limit)
		}
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": entries})
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h Handler) handleSettings(w http.ResponseWriter, r *http.Request) {
	if h.Settings == nil {
		writeError(w, http.StatusServiceUnavailable, "settings service unavailable")
		return
	}

	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, h.Settings.Get())
	case http.MethodPut:
		var req domain.AppSettings
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid settings request")
			return
		}
		saved, err := h.Settings.Save(req)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to persist settings")
			return
		}
		writeJSON(w, http.StatusOK, saved)
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h Handler) handleHealth(w http.ResponseWriter, _ *http.Request) {
	authEnabled := false
	if h.Auth != nil {
		authEnabled = h.Auth.Enabled()
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":          true,
		"gdu":         system.HasBinary(h.Config.GduBinary),
		"fd":          system.HasBinary(h.Config.FdBinary),
		"fclones":     system.HasBinary(h.Config.FclonesBinary),
		"authEnabled": authEnabled,
	})
}

func (h Handler) registerAuthRoutes(mux *http.ServeMux) {
	if h.Auth == nil {
		return
	}
	mux.HandleFunc("/api/login", h.Auth.HandleLogin)
	mux.HandleFunc("/api/logout", h.Auth.HandleLogout)
	mux.HandleFunc("/api/me", h.Auth.HandleMe)
	mux.HandleFunc("/api/setup", h.Auth.HandleSetup)
	mux.HandleFunc("/api/account/credentials", h.Auth.HandleUpdateCredentials)
}

func (h Handler) handleRoots(w http.ResponseWriter, _ *http.Request) {
	roots := make([]domain.Root, 0, len(h.Config.ScanRoots))
	for index, root := range h.Config.ScanRoots {
		roots = append(roots, domain.Root{
			ID:       "root-" + strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(root, "/", "_"), "\\", "_")) + "-" + string(rune('a'+index)),
			Path:     root,
			HostPath: h.toHostPath(root),
			Writable: fsutil.CanWriteDir(root),
			Warning:  h.Config.HostPathWarning(root),
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": roots})
}

func (h Handler) handleAnalyze(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req domain.AnalyzeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid analyze request")
		return
	}

	targetRoot, targetPath, err := h.resolve(req.Root, req.Path)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	req.Ignore = h.normalizeIgnorePaths(req.Ignore)
	if pathExcluded(targetPath, req.Ignore) {
		writeError(w, http.StatusBadRequest, "requested path is excluded")
		return
	}

	job := h.Jobs.Create()
	h.Jobs.Update(job.ID, func(job *domain.AnalyzeJob) {
		job.Status = "running"
	})
	log.Printf("analysis job created jobId=%s root=%q path=%q maxDepth=%d topN=%d ignoreCount=%d", job.ID, targetRoot, targetPath, req.MaxDepth, req.TopN, len(req.Ignore))

	go func(jobID string) {
		startedAt := time.Now()
		ctx, cancel := context.WithCancel(context.Background())
		h.Jobs.SetCancel(jobID, cancel)
		defer h.Jobs.SetCancel(jobID, nil)
		log.Printf("analysis job started jobId=%s path=%q", jobID, targetPath)

		result, analyzeErr := h.Analyzer.AnalyzeContext(ctx, targetPath, req.MaxDepth, req.TopN, req.Ignore)
		h.Jobs.Update(jobID, func(job *domain.AnalyzeJob) {
			if analyzeErr != nil {
				if errors.Is(analyzeErr, context.Canceled) || strings.Contains(strings.ToLower(analyzeErr.Error()), "context canceled") {
					log.Printf("analysis job canceled jobId=%s path=%q duration=%s", jobID, targetPath, time.Since(startedAt).Round(time.Millisecond))
					job.Status = "canceled"
					job.Error = ""
					return
				}
				log.Printf("analysis job failed jobId=%s path=%q duration=%s error=%q", jobID, targetPath, time.Since(startedAt).Round(time.Millisecond), analyzeErr.Error())
				job.Status = "error"
				job.Error = analyzeErr.Error()
				return
			}
			if result == nil {
				log.Printf("analysis job produced nil result jobId=%s path=%q duration=%s", jobID, targetPath, time.Since(startedAt).Round(time.Millisecond))
				job.Status = "error"
				job.Error = "analysis returned nil result"
				return
			}
			result.Root = targetRoot
			result.Path = targetPath
			h.applyHostPaths(result)
			if result.Tree.Path == "" {
				log.Printf("analysis job completed without tree path jobId=%s path=%q duration=%s topFiles=%d typeStats=%d", jobID, targetPath, time.Since(startedAt).Round(time.Millisecond), len(result.TopFiles), len(result.TypeStats))
			} else {
				log.Printf(
					"analysis job completed jobId=%s path=%q duration=%s treePath=%q childCount=%d sizeBytes=%d topFiles=%d typeStats=%d",
					jobID,
					targetPath,
					time.Since(startedAt).Round(time.Millisecond),
					result.Tree.Path,
					len(result.Tree.Children),
					result.Tree.SizeBytes,
					len(result.TopFiles),
					len(result.TypeStats),
				)
			}
			job.Status = "done"
			job.Result = result
		})
	}(job.ID)

	writeJSON(w, http.StatusAccepted, job)
}

func (h Handler) handleAnalyzeTree(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req domain.AnalyzeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid analyze request")
		return
	}

	targetRoot, targetPath, err := h.resolve(req.Root, req.Path)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	req.Ignore = h.normalizeIgnorePaths(req.Ignore)
	if pathExcluded(targetPath, req.Ignore) {
		writeError(w, http.StatusBadRequest, "requested path is excluded")
		return
	}
	log.Printf("analysis subtree request root=%q path=%q maxDepth=%d topN=%d ignoreCount=%d", targetRoot, targetPath, req.MaxDepth, req.TopN, len(req.Ignore))

	startedAt := time.Now()
	result, analyzeErr := h.Analyzer.AnalyzeContext(r.Context(), targetPath, req.MaxDepth, req.TopN, req.Ignore)
	if analyzeErr != nil {
		if errors.Is(analyzeErr, context.Canceled) {
			log.Printf("analysis subtree canceled path=%q duration=%s", targetPath, time.Since(startedAt).Round(time.Millisecond))
			writeError(w, http.StatusRequestTimeout, "analyze request canceled")
			return
		}
		log.Printf("analysis subtree failed path=%q duration=%s error=%q", targetPath, time.Since(startedAt).Round(time.Millisecond), analyzeErr.Error())
		writeError(w, http.StatusInternalServerError, analyzeErr.Error())
		return
	}
	if result == nil {
		log.Printf("analysis subtree produced nil result path=%q duration=%s", targetPath, time.Since(startedAt).Round(time.Millisecond))
		writeError(w, http.StatusInternalServerError, "analysis returned nil result")
		return
	}
	result.Root = targetRoot
	result.Path = targetPath
	h.applyHostPaths(result)
	log.Printf(
		"analysis subtree completed path=%q duration=%s treePath=%q childCount=%d sizeBytes=%d topFiles=%d typeStats=%d",
		targetPath,
		time.Since(startedAt).Round(time.Millisecond),
		result.Tree.Path,
		len(result.Tree.Children),
		result.Tree.SizeBytes,
		len(result.TopFiles),
		len(result.TypeStats),
	)
	writeJSON(w, http.StatusOK, result)
}

func (h Handler) handleAnalyzeJob(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/analyze/")
	job, ok := h.Jobs.Get(id)
	if !ok {
		writeError(w, http.StatusNotFound, "job not found")
		return
	}
	writeJSON(w, http.StatusOK, job)
}

func (h Handler) handleSearch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req domain.SearchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid search request")
		return
	}

	req.Ignore = h.normalizeIgnorePaths(req.Ignore)
	targetRoot, _, targetPaths, err := h.resolveSearchTargets(req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	req.Root = targetRoot
	result, err := h.SearchSvc.Search(req, targetPaths)
	if err != nil {
		writeError(w, http.StatusInternalServerError, friendlySearchError(err))
		return
	}
	h.applySearchHostPaths(result)

	writeJSON(w, http.StatusOK, result)
}

func (h Handler) handleDuplicates(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req domain.DuplicateFindRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid duplicate request")
		return
	}
	targetRoot, targetPath, comparePath, err := h.resolveDuplicateTargets(req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	req.Ignore = h.normalizeIgnorePaths(req.Ignore)
	if pathExcluded(targetPath, req.Ignore) {
		writeError(w, http.StatusBadRequest, "requested path is excluded")
		return
	}

	if comparePath != "" && pathExcluded(comparePath, req.Ignore) {
		writeError(w, http.StatusBadRequest, "requested compare path is excluded")
		return
	}
	if err := validateDuplicateModePaths(req.Mode, targetPath, comparePath); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	req.Root = targetRoot
	req.Path = targetPath
	req.ComparePath = comparePath
	scanPath := duplicateScanPath(req, targetPath, comparePath)

	job := h.DuplicateJobs.Create()
	h.DuplicateJobs.Update(job.ID, func(job *domain.DuplicateJob) {
		job.Status = "running"
	})

	go func(jobID string) {
		ctx, cancel := context.WithCancel(context.Background())
		h.DuplicateJobs.SetCancel(jobID, cancel)
		defer h.DuplicateJobs.SetCancel(jobID, nil)

		result, findErr := h.DuplicateSvc.FindWithProgressContext(ctx, req, scanPath, func(text string, percent int, step int, total int) {
			h.DuplicateJobs.Update(jobID, func(job *domain.DuplicateJob) {
				job.ProgressText = text
				if percent > 0 {
					job.ProgressPercent = percent
				}
				if step > 0 {
					job.ProgressStep = step
				}
				if total > 0 {
					job.ProgressTotal = total
				}
			})
		})
		h.DuplicateJobs.Update(jobID, func(job *domain.DuplicateJob) {
			if findErr != nil {
				if errors.Is(findErr, context.Canceled) {
					job.Status = "canceled"
					job.Error = ""
					job.ProgressText = ""
					job.ProgressPercent = 0
					job.ProgressStep = 0
					job.ProgressTotal = 0
					return
				}
				job.Status = "error"
				job.Error = findErr.Error()
				return
			}
			result.Root = targetRoot
			result.Path = targetPath
			result.ComparePath = comparePath
			h.applyDuplicateHostPaths(result)
			job.Status = "done"
			job.ProgressText = ""
			job.ProgressPercent = 100
			job.ProgressStep = 0
			job.ProgressTotal = 0
			job.Result = result
		})
	}(job.ID)

	writeJSON(w, http.StatusAccepted, job)
}

func (h Handler) handleDuplicateJob(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/duplicates/")
	if r.Method == http.MethodDelete {
		job, ok := h.DuplicateJobs.Cancel(id)
		if !ok {
			writeError(w, http.StatusNotFound, "job not found")
			return
		}
		writeJSON(w, http.StatusOK, job)
		return
	}
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	job, ok := h.DuplicateJobs.Get(id)
	if !ok {
		writeError(w, http.StatusNotFound, "job not found")
		return
	}
	writeJSON(w, http.StatusOK, job)
}

func (h Handler) handleDuplicateActions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req domain.DuplicateActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid duplicate action request")
		return
	}
	if strings.TrimSpace(req.Root) == "" {
		writeError(w, http.StatusBadRequest, "scan root is required")
		return
	}
	h.normalizeDuplicateActionPaths(&req)

	targetRoot, _, err := h.resolve(req.Root, req.Root)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	result, err := h.DuplicateSvc.Execute(r.Context(), req, targetRoot)
	if err != nil {
		writeError(w, http.StatusBadRequest, friendlyDuplicateActionError(err))
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h Handler) handleDuplicateUndoRename(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req domain.DuplicateUndoRenameRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid duplicate undo request")
		return
	}
	if strings.TrimSpace(req.Root) == "" {
		writeError(w, http.StatusBadRequest, "scan root is required")
		return
	}
	h.normalizeDuplicateUndoRenamePaths(&req)

	targetRoot, _, err := h.resolve(req.Root, req.Root)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	result, err := h.DuplicateSvc.UndoRename(req, targetRoot)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h Handler) handleDuplicateRefresh(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req domain.DuplicateRefreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid duplicate refresh request")
		return
	}
	if strings.TrimSpace(req.Root) == "" {
		writeError(w, http.StatusBadRequest, "scan root is required")
		return
	}

	targetRoot, _, err := h.resolve(req.Root, req.Root)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	existingPaths := make([]string, 0, len(req.Paths))
	retainedPaths := make([]string, 0, len(req.Paths))
	missingPaths := make([]string, 0)
	if len(req.Groups) > 0 {
		for _, group := range req.Groups {
			resolvedPaths := make([]string, 0, len(group.Paths))
			resolvedInfos := make([]os.FileInfo, 0, len(group.Paths))
			for _, rawPath := range dedupeStrings(group.Paths) {
				candidate := strings.TrimSpace(rawPath)
				if candidate == "" {
					continue
				}
				_, resolvedPath, err := h.resolveDuplicateComparePath(targetRoot, candidate)
				if err != nil {
					missingPaths = append(missingPaths, candidate)
					continue
				}
				info, statErr := os.Stat(resolvedPath)
				if statErr != nil {
					if errors.Is(statErr, os.ErrNotExist) {
						missingPaths = append(missingPaths, resolvedPath)
						continue
					}
					writeError(w, http.StatusInternalServerError, statErr.Error())
					return
				}
				if info.IsDir() {
					missingPaths = append(missingPaths, resolvedPath)
					continue
				}
				existingPaths = append(existingPaths, resolvedPath)
				resolvedPaths = append(resolvedPaths, resolvedPath)
				resolvedInfos = append(resolvedInfos, info)
			}
			groupRetained := collapseDuplicateRefreshGroup(resolvedPaths, resolvedInfos)
			if len(groupRetained) >= 2 {
				retainedPaths = append(retainedPaths, groupRetained...)
			}
		}
	} else {
		for _, rawPath := range dedupeStrings(req.Paths) {
			candidate := strings.TrimSpace(rawPath)
			if candidate == "" {
				continue
			}
			_, resolvedPath, err := h.resolveDuplicateComparePath(targetRoot, candidate)
			if err != nil {
				missingPaths = append(missingPaths, candidate)
				continue
			}
			if _, statErr := os.Stat(resolvedPath); statErr != nil {
				if errors.Is(statErr, os.ErrNotExist) {
					missingPaths = append(missingPaths, resolvedPath)
					continue
				}
				writeError(w, http.StatusInternalServerError, statErr.Error())
				return
			}
			existingPaths = append(existingPaths, resolvedPath)
		}
		retainedPaths = append(retainedPaths, existingPaths...)
	}

	writeJSON(w, http.StatusOK, domain.DuplicateRefreshResponse{
		ExistingPaths: existingPaths,
		RetainedPaths: retainedPaths,
		MissingPaths:  missingPaths,
	})
}

func collapseDuplicateRefreshGroup(paths []string, infos []os.FileInfo) []string {
	if len(paths) != len(infos) || len(paths) == 0 {
		return nil
	}
	retainedPaths := make([]string, 0, len(paths))
	retainedInfos := make([]os.FileInfo, 0, len(infos))
	for index, path := range paths {
		info := infos[index]
		duplicateIdentity := false
		for _, existingInfo := range retainedInfos {
			if os.SameFile(existingInfo, info) {
				duplicateIdentity = true
				break
			}
		}
		if duplicateIdentity {
			continue
		}
		retainedPaths = append(retainedPaths, path)
		retainedInfos = append(retainedInfos, info)
	}
	return retainedPaths
}

func (h Handler) handlePreview(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	root := r.URL.Query().Get("root")
	path := r.URL.Query().Get("path")
	_, targetPath, err := h.resolve(root, path)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	info, err := os.Stat(targetPath)
	if err != nil {
		writeError(w, http.StatusNotFound, "file not found")
		return
	}
	if info.IsDir() {
		writeError(w, http.StatusBadRequest, "directories cannot be previewed")
		return
	}

	if r.URL.Query().Get("mode") == "text" {
		h.handleTextPreview(w, r, targetPath, info)
		return
	}

	if isArchiveImagePreviewPath(info.Name()) {
		if h.handleArchiveImagePreview(w, r, targetPath, info) {
			return
		}
	}

	file, err := os.Open(targetPath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to open file")
		return
	}
	defer file.Close()

	contentType := previewContentType(info.Name())
	if contentType == "" {
		head := make([]byte, 512)
		n, _ := file.Read(head)
		contentType = http.DetectContentType(head[:n])
		_, _ = file.Seek(0, io.SeekStart)
	}

	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Encoding", "identity")
	if contentType != "" {
		w.Header().Set("Content-Type", contentType)
	}
	http.ServeContent(w, r, info.Name(), info.ModTime(), file)
}

func previewContentType(name string) string {
	switch strings.ToLower(filepath.Ext(strings.TrimSpace(name))) {
	case ".ogv":
		return "video/ogg"
	case ".mpeg", ".mpg":
		return "video/mpeg"
	case ".3gp":
		return "video/3gpp"
	case ".opus":
		return "audio/ogg"
	case ".mkv":
		return "video/x-matroska"
	case ".avi":
		return "video/x-msvideo"
	default:
		return mime.TypeByExtension(strings.ToLower(filepath.Ext(name)))
	}
}

func (h Handler) handleTextPreview(w http.ResponseWriter, r *http.Request, targetPath string, info os.FileInfo) {
	limit := previewQueryLimit(r.URL.Query().Get("limit"), targetPath)
	expanded := strings.EqualFold(strings.TrimSpace(r.URL.Query().Get("expanded")), "true")
	payload, err := buildTextPreviewPayload(targetPath, info, limit, expanded)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, payload)
}

func previewQueryLimit(rawLimit string, targetPath string) int {
	defaultLimit := 64 * 1024
	if detectArchivePreviewKind(targetPath) != "" {
		defaultLimit = 400
	}
	limit, err := strconv.Atoi(strings.TrimSpace(rawLimit))
	if err != nil || limit <= 0 {
		return defaultLimit
	}
	if detectArchivePreviewKind(targetPath) != "" {
		return clampPreviewLimit(limit, 1, 4000)
	}
	return clampPreviewLimit(limit, 1024, 512*1024)
}

func clampPreviewLimit(value, minValue, maxValue int) int {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}

func buildTextPreviewPayload(targetPath string, info os.FileInfo, limit int, expanded bool) (map[string]any, error) {
	if detectArchivePreviewKind(targetPath) != "" {
		entryLimit := 400
		if expanded && limit > 0 {
			entryLimit = limit
		}
		entries, truncated, err := extractArchivePreviewEntries(targetPath, entryLimit, expanded)
		if err != nil {
			return nil, errors.New("failed to read file")
		}
		return map[string]any{
			"path":      targetPath,
			"sizeBytes": info.Size(),
			"truncated": truncated,
			"kind":      "archive-list",
			"entries":   entries,
		}, nil
	}

	if content, truncated, ok, err := buildOfficeTextPreview(targetPath, limit); ok {
		if err != nil {
			return nil, errors.New("failed to read file")
		}
		return map[string]any{
			"path":      targetPath,
			"sizeBytes": info.Size(),
			"truncated": truncated,
			"kind":      "text",
			"content":   content,
		}, nil
	}

	if isOfficeTempPreviewPath(targetPath) || isAliasedOfficePreviewPath(targetPath) || isLegacyBinaryOfficePreviewPath(targetPath) {
		return map[string]any{
			"path":      targetPath,
			"sizeBytes": info.Size(),
			"truncated": false,
			"kind":      "unsupported",
		}, nil
	}

	file, err := os.Open(targetPath)
	if err != nil {
		return nil, errors.New("failed to open file")
	}
	defer file.Close()

	reader := io.LimitReader(file, int64(limit+1))
	data, err := io.ReadAll(reader)
	if err != nil {
		return nil, errors.New("failed to read file")
	}
	truncated := len(data) > limit
	if truncated {
		data = data[:limit]
	}

	return map[string]any{
		"path":      targetPath,
		"sizeBytes": info.Size(),
		"truncated": truncated,
		"kind":      "text",
		"content":   string(bytes.ToValidUTF8(data, []byte{})),
	}, nil
}

func (h Handler) handleArchiveImagePreview(w http.ResponseWriter, r *http.Request, targetPath string, info os.FileInfo) bool {
	data, fileName, contentType, ok, err := extractArchiveCoverImage(targetPath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to read archive preview")
		return true
	}
	if !ok {
		return false
	}

	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Encoding", "identity")
	w.Header().Set("Content-Type", contentType)
	http.ServeContent(w, r, fileName, info.ModTime(), bytes.NewReader(data))
	return true
}

func (h Handler) handleDirectories(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	root := r.URL.Query().Get("root")
	path := r.URL.Query().Get("path")
	includeFiles := strings.EqualFold(r.URL.Query().Get("includeFiles"), "true")
	targetRoot, targetPath, err := h.resolve(root, path)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	entries, err := os.ReadDir(targetPath)
	if err != nil {
		if os.IsNotExist(err) && targetPath != targetRoot {
			targetPath = targetRoot
			entries, err = os.ReadDir(targetPath)
		}
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	items := make([]domain.DirectoryEntry, 0, len(entries)+1)
	if targetPath != targetRoot {
		items = append(items, domain.DirectoryEntry{
			Name:     "..",
			Path:     filepath.Dir(targetPath),
			HostPath: h.toHostPath(filepath.Dir(targetPath)),
			IsDir:    true,
		})
	}

	for _, entry := range entries {
		if !entry.IsDir() && !includeFiles {
			continue
		}
		itemPath := filepath.Join(targetPath, entry.Name())
		items = append(items, domain.DirectoryEntry{
			Name:     entry.Name(),
			Path:     itemPath,
			HostPath: h.toHostPath(itemPath),
			IsDir:    entry.IsDir(),
		})
	}

	sort.Slice(items, func(i, j int) bool {
		return strings.ToLower(items[i].Name) < strings.ToLower(items[j].Name)
	})

	writeJSON(w, http.StatusOK, map[string]any{
		"root":  targetRoot,
		"path":  targetPath,
		"items": items,
	})
}

func (h Handler) resolve(rootValue, pathValue string) (string, string, error) {
	root := strings.TrimSpace(rootValue)
	if root == "" {
		root = h.Config.ScanRoots[0]
	}

	valid := false
	for _, item := range h.Config.ScanRoots {
		if item == root {
			valid = true
			break
		}
	}
	if !valid {
		return "", "", errors.New("unknown scan root")
	}

	resolved, err := fsutil.ResolveWithinRoot(root, pathValue)
	if err != nil {
		return "", "", err
	}
	return root, resolved, nil
}

func (h Handler) resolveDuplicateTargets(req domain.DuplicateFindRequest) (string, string, string, error) {
	root, primaryPath, err := h.resolve(req.Root, req.Path)
	if err != nil {
		return "", "", "", err
	}
	if strings.TrimSpace(req.ComparePath) == "" {
		return root, primaryPath, "", nil
	}
	_, comparePath, err := h.resolveDuplicateComparePath(root, req.ComparePath)
	if err != nil {
		return "", "", "", err
	}
	return root, primaryPath, comparePath, nil
}

func (h Handler) resolveDuplicateComparePath(preferredRoot string, pathValue string) (string, string, error) {
	preferredRoot = strings.TrimSpace(preferredRoot)
	if preferredRoot != "" {
		root, resolved, err := h.resolve(preferredRoot, pathValue)
		if err == nil {
			return root, resolved, nil
		}
		if !filepath.IsAbs(strings.TrimSpace(pathValue)) {
			return "", "", err
		}
	}

	var lastErr error
	for _, root := range h.Config.ScanRoots {
		if root == preferredRoot {
			continue
		}
		resolvedRoot, resolved, err := h.resolve(root, pathValue)
		if err == nil {
			return resolvedRoot, resolved, nil
		}
		lastErr = err
	}
	if lastErr != nil {
		return "", "", lastErr
	}
	return "", "", errors.New("unknown scan root")
}

func (h Handler) resolveSearchTargets(req domain.SearchRequest) (string, string, []string, error) {
	selectedRoots := make([]string, 0, len(req.Roots))
	if len(req.Roots) > 0 {
		for _, value := range req.Roots {
			root, targetPath, err := h.resolve(value, value)
			if err != nil {
				return "", "", nil, err
			}
			if pathExcluded(targetPath, req.Ignore) {
				return "", "", nil, errors.New("requested path is excluded")
			}
			selectedRoots = append(selectedRoots, root)
		}
		selectedRoots = dedupeStrings(selectedRoots)
		if len(selectedRoots) == 0 {
			return "", "", nil, errors.New("scan root is required")
		}
		return selectedRoots[0], selectedRoots[0], selectedRoots, nil
	}

	targetRoot, targetPath, err := h.resolve(req.Root, req.Path)
	if err != nil {
		return "", "", nil, err
	}
	if pathExcluded(targetPath, req.Ignore) {
		return "", "", nil, errors.New("requested path is excluded")
	}
	return targetRoot, targetPath, []string{targetPath}, nil
}

func dedupeStrings(values []string) []string {
	if len(values) < 2 {
		return values
	}
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
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

func duplicateScanPath(req domain.DuplicateFindRequest, primaryPath string, comparePath string) string {
	if comparePath == "" {
		return primaryPath
	}
	return commonAncestorPath(primaryPath, comparePath)
}

func commonAncestorPath(left string, right string) string {
	left = filepath.Clean(left)
	right = filepath.Clean(right)
	for {
		if left == right || strings.HasPrefix(right, left+string(filepath.Separator)) {
			return left
		}
		parent := filepath.Dir(left)
		if parent == left {
			return left
		}
		left = parent
	}
}

func validateDuplicateModePaths(mode string, primaryPath string, comparePath string) error {
	mode = strings.TrimSpace(mode)
	if mode == "" || mode == "scan" {
		return nil
	}
	if strings.TrimSpace(comparePath) == "" {
		return errors.New("compare path is required")
	}

	primaryInfo, err := os.Stat(primaryPath)
	if err != nil {
		return err
	}
	compareInfo, err := os.Stat(comparePath)
	if err != nil {
		return err
	}

	switch mode {
	case "folders":
		if !primaryInfo.IsDir() || !compareInfo.IsDir() {
			return errors.New("folder compare mode requires two folders")
		}
	case "file":
		if primaryInfo.IsDir() || !compareInfo.IsDir() {
			return errors.New("file compare mode requires one file and one target folder")
		}
	default:
		return errors.New("unsupported duplicate compare mode")
	}
	return nil
}

func validateComparableFolderPaths(leftPath string, rightPath string) error {
	leftPath = filepath.Clean(strings.TrimSpace(leftPath))
	rightPath = filepath.Clean(strings.TrimSpace(rightPath))
	if leftPath == "" || rightPath == "" {
		return errors.New("compare path is required")
	}
	if leftPath == rightPath {
		return errors.New("folder compare requires two different folders")
	}
	if isAncestorPath(leftPath, rightPath) || isAncestorPath(rightPath, leftPath) {
		return errors.New("folder compare does not support nested folders; choose two separate sibling folders instead")
	}
	return nil
}

func isAncestorPath(parentPath string, childPath string) bool {
	parentPath = filepath.Clean(strings.TrimSpace(parentPath))
	childPath = filepath.Clean(strings.TrimSpace(childPath))
	if parentPath == "" || childPath == "" || parentPath == childPath {
		return false
	}
	return strings.HasPrefix(childPath, parentPath+string(filepath.Separator))
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func pathExcluded(candidate string, ignores []string) bool {
	normalizedCandidate := filepath.Clean(candidate)
	for _, item := range ignores {
		pattern := strings.TrimSpace(item)
		if pattern == "" || strings.ContainsAny(pattern, "*?[]{}") {
			continue
		}
		normalizedIgnore := filepath.Clean(pattern)
		if normalizedCandidate == normalizedIgnore {
			return true
		}
		if strings.HasPrefix(normalizedCandidate, normalizedIgnore+string(filepath.Separator)) {
			return true
		}
	}
	return false
}

func friendlySearchError(err error) string {
	if err == nil {
		return ""
	}
	message := err.Error()
	if strings.Contains(message, "leading dot") && strings.Contains(message, "hidden files are filtered by default") {
		return "未启用搜索隐藏文件，当前搜索模式无法匹配隐藏文件"
	}
	return message
}

func friendlyDuplicateActionError(err error) string {
	if err == nil {
		return ""
	}
	message := strings.ToLower(strings.TrimSpace(err.Error()))
	switch {
	case strings.Contains(message, "read-only file system"):
		return "当前挂载为只读，不能执行删除或链接操作"
	case strings.Contains(message, "permission denied"), strings.Contains(message, "operation not permitted"), strings.Contains(message, "access is denied"):
		return "当前目录没有写入权限，不能执行删除或链接操作"
	case strings.Contains(message, "duplicate rename has no changes"):
		return "当前选中的文件名已经满足当前规则，无需执行重命名。"
	case strings.Contains(message, "no duplicate files selected"):
		return "请先勾选要处理的重复文件副本。"
	default:
		return strings.TrimSpace(err.Error())
	}
}

func (h Handler) toHostPath(containerPath string) string {
	cleaned := filepath.Clean(containerPath)
	bestRoot := ""
	bestHost := ""
	for root, hostRoot := range h.Config.HostPathMaps {
		root = filepath.Clean(root)
		hostRoot = filepath.Clean(hostRoot)
		if cleaned != root && !strings.HasPrefix(cleaned, root+string(filepath.Separator)) {
			continue
		}
		if len(root) > len(bestRoot) {
			bestRoot = root
			bestHost = hostRoot
		}
	}
	if bestRoot == "" {
		return ""
	}
	if cleaned == bestRoot {
		return bestHost
	}
	relative := strings.TrimPrefix(cleaned, bestRoot)
	relative = strings.TrimPrefix(relative, string(filepath.Separator))
	if relative == "" {
		return bestHost
	}
	return filepath.Join(bestHost, relative)
}

func (h Handler) toContainerPath(hostPath string) string {
	cleaned := filepath.Clean(hostPath)
	bestContainer := ""
	bestHost := ""
	for containerRoot, hostRoot := range h.Config.HostPathMaps {
		containerRoot = filepath.Clean(containerRoot)
		hostRoot = filepath.Clean(hostRoot)
		if cleaned != hostRoot && !strings.HasPrefix(cleaned, hostRoot+string(filepath.Separator)) {
			continue
		}
		if len(hostRoot) > len(bestHost) {
			bestContainer = containerRoot
			bestHost = hostRoot
		}
	}
	if bestHost == "" {
		return cleaned
	}
	if cleaned == bestHost {
		return bestContainer
	}
	relative := strings.TrimPrefix(cleaned, bestHost)
	relative = strings.TrimPrefix(relative, string(filepath.Separator))
	if relative == "" {
		return bestContainer
	}
	return filepath.Join(bestContainer, relative)
}

func (h Handler) normalizeIgnorePaths(ignores []string) []string {
	if len(ignores) == 0 {
		return nil
	}
	normalized := make([]string, 0, len(ignores)*2)
	seen := make(map[string]struct{}, len(ignores)*2)
	add := func(value string) {
		cleaned := strings.TrimSpace(value)
		if cleaned == "" {
			return
		}
		cleaned = filepath.Clean(cleaned)
		if _, ok := seen[cleaned]; ok {
			return
		}
		seen[cleaned] = struct{}{}
		normalized = append(normalized, cleaned)
	}

	for _, item := range ignores {
		add(item)
		add(h.toContainerPath(item))
	}

	return normalized
}

func (h Handler) normalizeDuplicateActionPaths(req *domain.DuplicateActionRequest) {
	if req == nil {
		return
	}
	req.Root = h.toContainerPath(req.Root)
	for index := range req.Groups {
		req.Groups[index].KeepPath = h.toContainerPath(req.Groups[index].KeepPath)
		selected := make([]string, 0, len(req.Groups[index].SelectedPaths))
		for _, item := range req.Groups[index].SelectedPaths {
			normalized := h.toContainerPath(item)
			if strings.TrimSpace(normalized) == "" {
				continue
			}
			selected = append(selected, normalized)
		}
		req.Groups[index].SelectedPaths = selected
	}
}

func (h Handler) normalizeDuplicateUndoRenamePaths(req *domain.DuplicateUndoRenameRequest) {
	if req == nil {
		return
	}
	req.Root = h.toContainerPath(req.Root)
	for index := range req.RenamedFiles {
		req.RenamedFiles[index].OldPath = h.toContainerPath(req.RenamedFiles[index].OldPath)
		req.RenamedFiles[index].NewPath = h.toContainerPath(req.RenamedFiles[index].NewPath)
	}
}

func (h Handler) applyHostPaths(result *domain.AnalyzeResponse) {
	if result == nil {
		return
	}
	result.Tree = h.mapTreeHostPaths(result.Tree)
	for index := range result.TopFiles {
		result.TopFiles[index].HostPath = h.toHostPath(result.TopFiles[index].Path)
		result.TopFiles[index].ParentHostPath = h.toHostPath(result.TopFiles[index].ParentPath)
	}
}

func (h Handler) mapTreeHostPaths(node domain.TreeNode) domain.TreeNode {
	node.HostPath = h.toHostPath(node.Path)
	if len(node.Children) == 0 {
		return node
	}
	children := make([]domain.TreeNode, 0, len(node.Children))
	for _, child := range node.Children {
		children = append(children, h.mapTreeHostPaths(child))
	}
	node.Children = children
	return node
}

func (h Handler) applySearchHostPaths(result *domain.SearchResponse) {
	if result == nil {
		return
	}
	for index := range result.Items {
		result.Items[index].HostPath = h.toHostPath(result.Items[index].Path)
		result.Items[index].ParentHostPath = h.toHostPath(result.Items[index].ParentPath)
	}
}

func (h Handler) applyDuplicateHostPaths(result *domain.DuplicateFindResponse) {
	if result == nil {
		return
	}
	for groupIndex := range result.Groups {
		for fileIndex := range result.Groups[groupIndex].Files {
			item := &result.Groups[groupIndex].Files[fileIndex]
			item.HostPath = h.toHostPath(item.Path)
			item.ParentHostPath = h.toHostPath(item.ParentPath)
		}
	}
}
