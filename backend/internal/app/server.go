package app

import (
	"bufio"
	"compress/gzip"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"fileanaer/backend/internal/api"
	"fileanaer/backend/internal/auth"
	"fileanaer/backend/internal/config"
	"fileanaer/backend/internal/duplicates"
	"fileanaer/backend/internal/fsutil"
	"fileanaer/backend/internal/history"
	"fileanaer/backend/internal/jobs"
	"fileanaer/backend/internal/search"
	"fileanaer/backend/internal/settings"
	"fileanaer/backend/internal/system"
	"fileanaer/backend/internal/treemap"
)

func NewServer(cfg config.Config) (*http.Server, error) {
	if len(cfg.ScanRoots) == 0 {
		return nil, errors.New("at least one scan root is required")
	}

	for _, root := range cfg.ScanRoots {
		if !fsutil.RootExists(root) {
			continue
		}
		if warning := cfg.HostPathWarning(root); warning != "" {
			log.Printf("host path mapping warning root=%q detail=%s", root, warning)
		}
	}

	authSvc, err := auth.New(cfg)
	if err != nil {
		return nil, err
	}
	settingsSvc, err := settings.New(cfg.SettingsStateFile)
	if err != nil {
		return nil, err
	}
	historySvc, err := history.New(cfg.HistoryStateFile)
	if err != nil {
		return nil, err
	}

	mux := http.NewServeMux()
	handler := api.Handler{
		Config:        cfg,
		Jobs:          jobs.NewManager(),
		DuplicateJobs: jobs.NewDuplicateManager(),
		Auth:          authSvc,
		History:       historySvc,
		Analyzer:      treemap.Analyzer{Binary: cfg.GduBinary, Runner: system.Runner{Timeout: cfg.CmdTimeout}},
		DuplicateSvc:  duplicates.Service{Binary: cfg.FclonesBinary, Runner: system.Runner{}},
		Settings:      settingsSvc,
		SearchSvc: search.Service{
			Binary:     cfg.FdBinary,
			Runner:     system.Runner{Timeout: cfg.CmdTimeout},
			MaxResults: cfg.MaxResults,
		},
	}
	handler.Register(mux)
	registerStatic(mux, cfg.StaticDir)

	return &http.Server{
		Addr:    cfg.Address(),
		Handler: withCORS(withCompression(authSvc.LoadAndSave(authSvc.ProtectAPI(mux)))),
	}, nil
}

func registerStatic(mux *http.ServeMux, staticDir string) {
	staticDir = filepath.Clean(staticDir)
	if _, err := os.Stat(staticDir); err != nil {
		mux.HandleFunc("/", func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			_, _ = w.Write([]byte("frontend assets not built"))
		})
		return
	}

	fileServer := http.FileServer(http.Dir(staticDir))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}

		requestPath := strings.TrimPrefix(filepath.Clean(r.URL.Path), string(filepath.Separator))
		candidate := filepath.Join(staticDir, requestPath)
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			fileServer.ServeHTTP(w, r)
			return
		}

		http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
	})
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := strings.TrimSpace(r.Header.Get("Origin"))
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Add("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
		} else {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func withCompression(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
			next.ServeHTTP(w, r)
			return
		}

		gzw := &gzipResponseWriter{ResponseWriter: w}
		defer gzw.Close()
		next.ServeHTTP(gzw, r)
	})
}

type gzipResponseWriter struct {
	http.ResponseWriter
	gzipWriter   *gzip.Writer
	headerWrote  bool
	compressBody bool
}

func (w *gzipResponseWriter) Write(data []byte) (int, error) {
	if !w.headerWrote {
		w.WriteHeader(http.StatusOK)
	}
	if !w.compressBody {
		return w.ResponseWriter.Write(data)
	}
	return w.gzipWriter.Write(data)
}

func (w *gzipResponseWriter) WriteHeader(statusCode int) {
	if w.headerWrote {
		return
	}
	w.headerWrote = true
	w.Header().Add("Vary", "Accept-Encoding")
	if shouldCompressStatus(statusCode) && w.Header().Get("Content-Encoding") == "" {
		w.compressBody = true
		w.Header().Set("Content-Encoding", "gzip")
		w.Header().Del("Content-Length")
		w.gzipWriter = gzip.NewWriter(w.ResponseWriter)
	}
	w.ResponseWriter.WriteHeader(statusCode)
}

func (w *gzipResponseWriter) Flush() {
	if !w.headerWrote {
		w.WriteHeader(http.StatusOK)
	}
	if w.compressBody && w.gzipWriter != nil {
		_ = w.gzipWriter.Flush()
	}
	if flusher, ok := w.ResponseWriter.(http.Flusher); ok {
		flusher.Flush()
	}
}

func (w *gzipResponseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	hijacker, ok := w.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, fmt.Errorf("response writer does not support hijacking")
	}
	return hijacker.Hijack()
}

func (w *gzipResponseWriter) Close() error {
	if w.compressBody && w.gzipWriter != nil {
		return w.gzipWriter.Close()
	}
	return nil
}

func shouldCompressStatus(statusCode int) bool {
	return statusCode >= http.StatusOK && statusCode != http.StatusNoContent && statusCode != http.StatusNotModified
}
