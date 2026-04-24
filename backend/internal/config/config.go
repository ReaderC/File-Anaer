package config

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Port                string
	ScanRoots           []string
	HostPathMaps        map[string]string
	CmdTimeout          time.Duration
	MaxResults          int
	StaticDir           string
	GduBinary           string
	FdBinary            string
	FclonesBinary       string
	ReadOnly            bool
	AuthUsername        string
	AuthPasswordHash    string
	AuthEnabled         bool
	AuthStateFile       string
	SettingsStateFile   string
	HistoryStateFile    string
	SessionLifetime     time.Duration
	SessionIdleTimeout  time.Duration
	SessionCookieSecure bool
}

func (c Config) HostPathWarning(root string) string {
	root = filepath.Clean(strings.TrimSpace(root))
	if root == "" {
		return ""
	}
	if _, ok := c.HostPathMaps[root]; ok {
		return ""
	}
	hasChildMapping := false
	for mappedRoot := range c.HostPathMaps {
		mappedRoot = filepath.Clean(strings.TrimSpace(mappedRoot))
		if mappedRoot == "" || mappedRoot == root {
			continue
		}
		if strings.HasPrefix(mappedRoot, root+string(filepath.Separator)) {
			hasChildMapping = true
			break
		}
	}
	if hasChildMapping {
		return "scan root is a parent directory, but host path mappings only cover child directories; prefer configuring SCAN_ROOTS and HOST_PATH_MAPS one-to-one"
	}
	return ""
}

func Load() Config {
	port := readEnv("PORT", "8080")
	roots := readEnv("SCAN_ROOTS", "/data")
	timeout, err := time.ParseDuration(readEnv("CMD_TIMEOUT", "2m"))
	if err != nil {
		timeout = 2 * time.Minute
	}
	maxResults, err := strconv.Atoi(readEnv("MAX_RESULTS", "50000"))
	if err != nil || maxResults < 1 {
		maxResults = 50000
	}

	staticDir := readEnv("STATIC_DIR", filepath.Clean(filepath.Join("frontend", "dist")))
	rootList := make([]string, 0)
	for _, root := range strings.Split(roots, ",") {
		root = strings.TrimSpace(root)
		if root == "" {
			continue
		}
		rootList = append(rootList, filepath.Clean(root))
	}

	if len(rootList) == 0 {
		rootList = []string{"/data"}
	}

	hostPathMaps := parseHostPathMaps(readEnv("HOST_PATH_MAPS", ""))
	sessionLifetime, err := time.ParseDuration(readEnv("SESSION_LIFETIME", "24h"))
	if err != nil || sessionLifetime <= 0 {
		sessionLifetime = 24 * time.Hour
	}
	sessionIdleTimeout, err := time.ParseDuration(readEnv("SESSION_IDLE_TIMEOUT", "8h"))
	if err != nil || sessionIdleTimeout <= 0 {
		sessionIdleTimeout = 8 * time.Hour
	}
	authUsername := strings.TrimSpace(readEnv("AUTH_USERNAME", ""))
	authPasswordHash := strings.TrimSpace(readEnv("AUTH_PASSWORD_HASH", ""))
	authStateFile := filepath.Clean(readEnv("AUTH_STATE_FILE", filepath.Join("data", "auth.json")))
	settingsStateFile := filepath.Clean(readEnv("SETTINGS_STATE_FILE", filepath.Join("data", "settings.json")))
	historyStateFile := filepath.Clean(readEnv("HISTORY_STATE_FILE", filepath.Join("data", "history.json")))

	return Config{
		Port:                port,
		ScanRoots:           rootList,
		HostPathMaps:        hostPathMaps,
		CmdTimeout:          timeout,
		MaxResults:          maxResults,
		StaticDir:           staticDir,
		GduBinary:           readEnv("GDU_BIN", "gdu"),
		FdBinary:            readEnv("FD_BIN", "fd"),
		FclonesBinary:       readEnv("FCLONES_BIN", "fclones"),
		ReadOnly:            true,
		AuthUsername:        authUsername,
		AuthPasswordHash:    authPasswordHash,
		AuthEnabled:         authUsername != "" || authPasswordHash != "",
		AuthStateFile:       authStateFile,
		SettingsStateFile:   settingsStateFile,
		HistoryStateFile:    historyStateFile,
		SessionLifetime:     sessionLifetime,
		SessionIdleTimeout:  sessionIdleTimeout,
		SessionCookieSecure: readBoolEnv("SESSION_COOKIE_SECURE", false),
	}
}

func (c Config) Address() string {
	return ":" + c.Port
}

func readEnv(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func readBoolEnv(key string, fallback bool) bool {
	value := strings.TrimSpace(strings.ToLower(os.Getenv(key)))
	if value == "" {
		return fallback
	}
	switch value {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return fallback
	}
}

func parseHostPathMaps(raw string) map[string]string {
	items := map[string]string{}
	for _, item := range strings.Split(raw, ",") {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		parts := strings.SplitN(item, "=", 2)
		if len(parts) != 2 {
			continue
		}
		containerPath := filepath.Clean(strings.TrimSpace(parts[0]))
		hostPath := filepath.Clean(strings.TrimSpace(parts[1]))
		if containerPath == "" || containerPath == "." || hostPath == "" || hostPath == "." {
			continue
		}
		items[containerPath] = hostPath
	}
	return items
}
