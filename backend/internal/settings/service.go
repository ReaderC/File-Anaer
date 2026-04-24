package settings

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"fileanaer/backend/internal/domain"
)

type Service struct {
	mu        sync.RWMutex
	stateFile string
	settings  domain.AppSettings
}

func New(stateFile string) (*Service, error) {
	service := &Service{
		stateFile: stateFile,
		settings:  defaultSettings(),
	}

	loaded, err := load(stateFile)
	if err != nil {
		return nil, err
	}
	if loaded != nil {
		service.settings = normalize(*loaded)
	}

	return service, nil
}

func (s *Service) Get() domain.AppSettings {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return clone(s.settings)
}

func (s *Service) Save(next domain.AppSettings) (domain.AppSettings, error) {
	normalized := normalize(next)
	if err := save(s.stateFile, normalized); err != nil {
		return domain.AppSettings{}, err
	}

	s.mu.Lock()
	s.settings = normalized
	s.mu.Unlock()

	return clone(normalized), nil
}

func defaultSettings() domain.AppSettings {
	return domain.AppSettings{
		Locale:               "zh",
		Theme:                "system",
		TreemapFileColorMode: "size",
		TreemapDetailLevel:   "medium",
		CopyHostPath:         true,
		SearchPageSize:       50,
	}
}

func normalize(input domain.AppSettings) domain.AppSettings {
	defaults := defaultSettings()

	locale := strings.TrimSpace(input.Locale)
	if locale != "en" && locale != "zh" {
		locale = defaults.Locale
	}

	theme := strings.TrimSpace(input.Theme)
	if theme != "system" && theme != "light" && theme != "dark" {
		theme = defaults.Theme
	}

	colorMode := strings.TrimSpace(input.TreemapFileColorMode)
	if colorMode != "size" && colorMode != "type" {
		colorMode = defaults.TreemapFileColorMode
	}

	detailLevel := strings.TrimSpace(input.TreemapDetailLevel)
	if detailLevel != "simple" && detailLevel != "medium" && detailLevel != "detailed" {
		detailLevel = defaults.TreemapDetailLevel
	}

	pageSize := input.SearchPageSize
	if pageSize < 10 || pageSize > 500 {
		pageSize = defaults.SearchPageSize
	}

	return domain.AppSettings{
		Locale:                      locale,
		Theme:                       theme,
		TreemapFileColorMode:        colorMode,
		TreemapDetailLevel:          detailLevel,
		CopyHostPath:                input.CopyHostPath,
		DuplicateAllowFullSelection: input.DuplicateAllowFullSelection,
		ScanIgnore:                  normalizeList(input.ScanIgnore),
		DuplicateIgnore:             normalizeList(input.DuplicateIgnore),
		SearchIgnore:                normalizeList(input.SearchIgnore),
		SearchHidden:                input.SearchHidden,
		SearchPageSize:              pageSize,
	}
}

func normalizeList(values []string) []string {
	if len(values) == 0 {
		return nil
	}

	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		item := strings.TrimSpace(value)
		if item == "" {
			continue
		}
		if _, ok := seen[item]; ok {
			continue
		}
		seen[item] = struct{}{}
		result = append(result, item)
	}
	if len(result) == 0 {
		return nil
	}
	return result
}

func clone(input domain.AppSettings) domain.AppSettings {
	return domain.AppSettings{
		Locale:                      input.Locale,
		Theme:                       input.Theme,
		TreemapFileColorMode:        input.TreemapFileColorMode,
		TreemapDetailLevel:          input.TreemapDetailLevel,
		CopyHostPath:                input.CopyHostPath,
		DuplicateAllowFullSelection: input.DuplicateAllowFullSelection,
		ScanIgnore:                  append([]string(nil), input.ScanIgnore...),
		DuplicateIgnore:             append([]string(nil), input.DuplicateIgnore...),
		SearchIgnore:                append([]string(nil), input.SearchIgnore...),
		SearchHidden:                input.SearchHidden,
		SearchPageSize:              input.SearchPageSize,
	}
}

func load(stateFile string) (*domain.AppSettings, error) {
	data, err := os.ReadFile(stateFile)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	var settings domain.AppSettings
	if err := json.Unmarshal(data, &settings); err != nil {
		return nil, err
	}
	return &settings, nil
}

func save(stateFile string, settings domain.AppSettings) error {
	if err := os.MkdirAll(filepath.Dir(stateFile), 0o755); err != nil {
		return err
	}

	data, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(stateFile, data, 0o644)
}
