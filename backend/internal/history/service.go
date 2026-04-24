package history

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

type storeConfig struct {
	UsesDetailFiles bool
}

var allowedStores = map[string]storeConfig{
	"analysis-history":     {UsesDetailFiles: true},
	"duplicate-history":    {UsesDetailFiles: true},
	"duplicate-action-log": {UsesDetailFiles: false},
}

type Entry map[string]any

type state struct {
	Version int               `json:"version"`
	Stores   map[string][]Entry `json:"stores"`
}

type Service struct {
	mu             sync.RWMutex
	stateFile      string
	detailRootDir  string
	state          state
}

func New(stateFile string) (*Service, error) {
	svc := &Service{
		stateFile:     stateFile,
		detailRootDir: filepath.Join(filepath.Dir(stateFile), "history-details"),
		state:         state{Version: 2, Stores: make(map[string][]Entry)},
	}
	loaded, err := load(stateFile, svc.detailRootDir)
	if err != nil {
		if isIgnorableLoadError(err) {
			return svc, nil
		}
		return nil, err
	}
	if loaded != nil {
		svc.state = normalizeState(*loaded)
	}
	return svc, nil
}

func (s *Service) List(store string, limit int) ([]Entry, error) {
	store = normalizeStore(store)
	if err := validateStore(store); err != nil {
		return nil, err
	}
	if limit <= 0 {
		limit = 10
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	return cloneEntries(limitEntries(s.state.Stores[store], limit)), nil
}

func (s *Service) Get(store, id string) (Entry, error) {
	store = normalizeStore(store)
	if err := validateStore(store); err != nil {
		return nil, err
	}
	id = strings.TrimSpace(id)
	if id == "" {
		return nil, errors.New("history entry id is required")
	}

	s.mu.RLock()
	summary, ok := findEntryByID(s.state.Stores[store], id)
	s.mu.RUnlock()
	if !ok {
		return nil, errors.New("history entry not found")
	}

	if !allowedStores[store].UsesDetailFiles {
		return cloneEntry(summary), nil
	}

	entry, err := loadDetailEntry(detailFilePath(s.detailRootDir, store, id))
	if err != nil {
		if os.IsNotExist(err) {
			return nil, errors.New("history entry not found")
		}
		return nil, err
	}
	return entry, nil
}

func (s *Service) StreamDetailJSON(store, id string, writer io.Writer) error {
	store = normalizeStore(store)
	if err := validateStore(store); err != nil {
		return err
	}
	id = strings.TrimSpace(id)
	if id == "" {
		return errors.New("history entry id is required")
	}

	s.mu.RLock()
	_, ok := findEntryByID(s.state.Stores[store], id)
	s.mu.RUnlock()
	if !ok {
		return errors.New("history entry not found")
	}
	if !allowedStores[store].UsesDetailFiles {
		entry, err := s.Get(store, id)
		if err != nil {
			return err
		}
		return json.NewEncoder(writer).Encode(entry)
	}

	file, err := os.Open(detailFilePath(s.detailRootDir, store, id))
	if err != nil {
		if os.IsNotExist(err) {
			return errors.New("history entry not found")
		}
		return err
	}
	defer file.Close()

	_, err = io.Copy(writer, file)
	return err
}

func (s *Service) Save(store string, entry Entry, limit int) ([]Entry, error) {
	store = normalizeStore(store)
	if err := validateStore(store); err != nil {
		return nil, err
	}
	entry = normalizeEntry(entry)
	id := strings.TrimSpace(asString(entry["id"]))
	if id == "" {
		return nil, errors.New("history entry id is required")
	}
	if limit <= 0 {
		limit = 10
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if allowedStores[store].UsesDetailFiles {
		if err := saveDetailEntry(detailFilePath(s.detailRootDir, store, id), entry); err != nil {
			return nil, err
		}
	}

	summary := buildSummary(store, entry)
	entries := cloneEntries(s.state.Stores[store])
	replaced := false
	for index := range entries {
		if asString(entries[index]["id"]) == id {
			entries[index] = summary
			replaced = true
			break
		}
	}
	if !replaced {
		entries = append(entries, summary)
	}
	sortEntries(entries)
	s.state.Stores[store] = entries
	if err := saveIndex(s.stateFile, s.state); err != nil {
		return nil, err
	}
	return cloneEntries(limitEntries(entries, limit)), nil
}

func (s *Service) Delete(store, id string, limit int) ([]Entry, error) {
	store = normalizeStore(store)
	if err := validateStore(store); err != nil {
		return nil, err
	}
	id = strings.TrimSpace(id)
	if id == "" {
		return s.Clear(store)
	}
	if limit <= 0 {
		limit = 10
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	existing := s.state.Stores[store]
	filtered := make([]Entry, 0, len(existing))
	for _, entry := range existing {
		if asString(entry["id"]) == id {
			continue
		}
		filtered = append(filtered, cloneEntry(entry))
	}
	sortEntries(filtered)
	s.state.Stores[store] = filtered
	if allowedStores[store].UsesDetailFiles {
		_ = os.Remove(detailFilePath(s.detailRootDir, store, id))
	}
	if err := saveIndex(s.stateFile, s.state); err != nil {
		return nil, err
	}
	return cloneEntries(limitEntries(filtered, limit)), nil
}

func (s *Service) Clear(store string) ([]Entry, error) {
	store = normalizeStore(store)
	if err := validateStore(store); err != nil {
		return nil, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.state.Stores[store] = nil
	if allowedStores[store].UsesDetailFiles {
		_ = os.RemoveAll(filepath.Join(s.detailRootDir, store))
	}
	if err := saveIndex(s.stateFile, s.state); err != nil {
		return nil, err
	}
	return []Entry{}, nil
}

func validateStore(store string) error {
	if _, ok := allowedStores[store]; !ok {
		return errors.New("invalid history store")
	}
	return nil
}

func normalizeStore(store string) string {
	return strings.TrimSpace(store)
}

func normalizeState(input state) state {
	result := state{Version: 2, Stores: make(map[string][]Entry)}
	for store := range allowedStores {
		result.Stores[store] = cloneEntries(input.Stores[store])
		sortEntries(result.Stores[store])
	}
	return result
}

func normalizeEntry(input Entry) Entry {
	entry := cloneEntry(input)
	if _, ok := entry["savedAt"]; !ok || strings.TrimSpace(asString(entry["savedAt"])) == "" {
		entry["savedAt"] = time.Now().UTC().Format(time.RFC3339)
	}
	return entry
}

func buildSummary(store string, entry Entry) Entry {
	if !allowedStores[store].UsesDetailFiles {
		return cloneEntry(entry)
	}

	summary := cloneEntry(entry)
	delete(summary, "result")

	switch store {
	case "analysis-history":
		if result, ok := entry["result"].(map[string]any); ok {
			if tree, ok := result["tree"].(map[string]any); ok {
				summary["sizeBytes"] = asNumber(tree["sizeBytes"])
			}
		}
	case "duplicate-history":
		if result, ok := entry["result"].(map[string]any); ok {
			summary["totalGroups"] = asNumber(result["totalGroups"])
			summary["totalFiles"] = asNumber(result["totalFiles"])
			summary["totalWastedBytes"] = asNumber(result["totalWastedBytes"])
		}
	}

	return summary
}

func findEntryByID(entries []Entry, id string) (Entry, bool) {
	for _, entry := range entries {
		if asString(entry["id"]) == id {
			return cloneEntry(entry), true
		}
	}
	return nil, false
}

func sortEntries(entries []Entry) {
	sort.SliceStable(entries, func(i, j int) bool {
		return entryTime(entries[i]).After(entryTime(entries[j]))
	})
}

func entryTime(entry Entry) time.Time {
	for _, key := range []string{"savedAt", "createdAt", "updatedAt"} {
		if parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(asString(entry[key]))); err == nil {
			return parsed
		}
	}
	return time.Time{}
}

func limitEntries(entries []Entry, limit int) []Entry {
	if limit <= 0 || len(entries) <= limit {
		return entries
	}
	return entries[:limit]
}

func cloneEntries(entries []Entry) []Entry {
	if len(entries) == 0 {
		return []Entry{}
	}
	result := make([]Entry, 0, len(entries))
	for _, entry := range entries {
		result = append(result, cloneEntry(entry))
	}
	return result
}

func cloneEntry(entry Entry) Entry {
	if entry == nil {
		return Entry{}
	}
	data, err := json.Marshal(entry)
	if err != nil {
		return Entry{}
	}
	var cloned Entry
	if err := json.Unmarshal(data, &cloned); err != nil {
		return Entry{}
	}
	return cloned
}

func asString(value any) string {
	if text, ok := value.(string); ok {
		return text
	}
	return ""
}

func asNumber(value any) any {
	switch number := value.(type) {
	case float64, float32, int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		return number
	case json.Number:
		if integer, err := number.Int64(); err == nil {
			return integer
		}
		if floatValue, err := number.Float64(); err == nil {
			return floatValue
		}
	}
	return 0
}

func load(stateFile, detailRootDir string) (*state, error) {
	currentFormat, err := isCurrentIndexFile(stateFile)
	if err != nil {
		return nil, err
	}
	if !currentFormat {
		return nil, nil
	}

	file, err := os.Open(stateFile)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	defer file.Close()

	decoder := json.NewDecoder(file)
	decoder.UseNumber()

	loaded, err := decodeState(decoder, detailRootDir)
	if err != nil {
		return nil, err
	}
	return loaded, nil
}

func decodeState(decoder *json.Decoder, detailRootDir string) (*state, error) {
	token, err := decoder.Token()
	if err != nil {
		return nil, err
	}
	if delimiter, ok := token.(json.Delim); !ok || delimiter != '{' {
		return nil, errors.New("invalid history state")
	}

	result := &state{Version: 2, Stores: make(map[string][]Entry)}

	for decoder.More() {
		keyToken, err := decoder.Token()
		if err != nil {
			return nil, err
		}
		key, _ := keyToken.(string)
		switch key {
		case "version":
			if err := decoder.Decode(&result.Version); err != nil {
				return nil, err
			}
		case "stores":
			if err := decodeStoresObject(decoder, detailRootDir, result); err != nil {
				return nil, err
			}
		default:
			var discard any
			if err := decoder.Decode(&discard); err != nil {
				return nil, err
			}
		}
	}

	if _, err := decoder.Token(); err != nil {
		return nil, err
	}
	return result, nil
}

func decodeStoresObject(decoder *json.Decoder, detailRootDir string, result *state) error {
	token, err := decoder.Token()
	if err != nil {
		return err
	}
	if delimiter, ok := token.(json.Delim); !ok || delimiter != '{' {
		return errors.New("invalid history stores")
	}

	for decoder.More() {
		storeToken, err := decoder.Token()
		if err != nil {
			return err
		}
		store, _ := storeToken.(string)
		entries, err := decodeStoreEntries(decoder, detailRootDir, store)
		if err != nil {
			return err
		}
		if _, ok := allowedStores[store]; ok {
			result.Stores[store] = entries
		}
	}

	if _, err := decoder.Token(); err != nil {
		return err
	}
	return nil
}

func decodeStoreEntries(decoder *json.Decoder, detailRootDir, store string) ([]Entry, error) {
	token, err := decoder.Token()
	if err != nil {
		return nil, err
	}
	if delimiter, ok := token.(json.Delim); !ok || delimiter != '[' {
		return nil, errors.New("invalid history entry list")
	}

	entries := make([]Entry, 0)
	for decoder.More() {
		var entry Entry
		if err := decoder.Decode(&entry); err != nil {
			return nil, err
		}
		if _, ok := allowedStores[store]; !ok {
			continue
		}
		entry = normalizeEntry(entry)
		if allowedStores[store].UsesDetailFiles {
			entries = append(entries, buildSummary(store, entry))
			continue
		}
		entries = append(entries, cloneEntry(entry))
	}

	if _, err := decoder.Token(); err != nil {
		return nil, err
	}
	return entries, nil
}

func saveIndex(stateFile string, value state) error {
	if err := os.MkdirAll(filepath.Dir(stateFile), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(stateFile, data, 0o644)
}

func saveDetailEntry(path string, entry Entry) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(entry, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}

func loadDetailEntry(path string) (Entry, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var entry Entry
	if err := json.Unmarshal(data, &entry); err != nil {
		return nil, err
	}
	return cloneEntry(entry), nil
}

func detailFilePath(detailRootDir, store, id string) string {
	hash := sha256.Sum256([]byte(strings.TrimSpace(id)))
	return filepath.Join(detailRootDir, store, hex.EncodeToString(hash[:])+".json")
}

func isCurrentIndexFile(stateFile string) (bool, error) {
	file, err := os.Open(stateFile)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, err
	}
	defer file.Close()

	buffer := make([]byte, 256)
	count, readErr := file.Read(buffer)
	if readErr != nil && !errors.Is(readErr, io.EOF) && count == 0 {
		return false, readErr
	}
	prefix := buffer[:count]
	return bytes.Contains(prefix, []byte(`"version"`)), nil
}

func isIgnorableLoadError(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(strings.TrimSpace(err.Error()))
	return strings.Contains(message, "invalid history")
}
