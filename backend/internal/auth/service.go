package auth

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"fileanaer/backend/internal/config"
	"fileanaer/backend/internal/domain"

	"github.com/alexedwards/scs/v2"
	"golang.org/x/crypto/bcrypt"
)

const (
	sessionKeyAuthenticated = "authenticated"
	sessionKeyUsername      = "username"
	dummyPasswordHash       = "$2a$12$z7I2NfM1mP5j7wE8lYfAH.2c9xQ2hVxR1QmQ1M6P2g7H6Y7sT6JqW"
)

type persistedCredentials struct {
	Username     string `json:"username"`
	PasswordHash string `json:"passwordHash"`
}

type Service struct {
	mu            sync.RWMutex
	sessions      *scs.SessionManager
	stateFile     string
	managedByEnv  bool
	enabled       bool
	setupRequired bool
	username      string
	passwordHash  []byte
}

func New(cfg config.Config) (*Service, error) {
	sessionManager := scs.New()
	sessionManager.Cookie.Name = "file_anaer_session"
	sessionManager.Cookie.HttpOnly = true
	sessionManager.Cookie.Path = "/"
	sessionManager.Cookie.Persist = false
	sessionManager.Cookie.SameSite = http.SameSiteLaxMode
	sessionManager.Cookie.Secure = cfg.SessionCookieSecure
	sessionManager.Lifetime = cfg.SessionLifetime
	sessionManager.IdleTimeout = cfg.SessionIdleTimeout

	service := &Service{
		sessions:  sessionManager,
		stateFile: cfg.AuthStateFile,
	}

	if strings.TrimSpace(cfg.AuthUsername) != "" || strings.TrimSpace(cfg.AuthPasswordHash) != "" {
		if strings.TrimSpace(cfg.AuthUsername) == "" || strings.TrimSpace(cfg.AuthPasswordHash) == "" {
			return nil, errors.New("authentication is enabled but AUTH_USERNAME or AUTH_PASSWORD_HASH is missing")
		}
		service.managedByEnv = true
		service.enabled = true
		service.username = strings.TrimSpace(cfg.AuthUsername)
		service.passwordHash = []byte(strings.TrimSpace(cfg.AuthPasswordHash))
		return service, nil
	}

	creds, err := loadPersistedCredentials(cfg.AuthStateFile)
	if err != nil {
		return nil, err
	}
	if creds == nil {
		service.enabled = true
		service.setupRequired = true
		return service, nil
	}

	service.enabled = true
	service.username = creds.Username
	service.passwordHash = []byte(creds.PasswordHash)
	return service, nil
}

func (s *Service) LoadAndSave(next http.Handler) http.Handler {
	return s.sessions.LoadAndSave(next)
}

func (s *Service) Enabled() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.enabled
}

func (s *Service) SetupRequired() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.setupRequired
}

func (s *Service) CanManageCredentials() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return !s.managedByEnv
}

func (s *Service) ProtectAPI(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/api/") || isPublicPath(r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}
		if s.SetupRequired() {
			writeJSON(w, http.StatusPreconditionFailed, map[string]string{"error": "initial setup required"})
			return
		}
		if !s.isAuthenticated(r.Context()) {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "authentication required"})
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Service) HandleSetup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if !s.SetupRequired() {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "authentication is already configured"})
		return
	}

	var req domain.SetupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid setup request"})
		return
	}

	username := strings.TrimSpace(req.Username)
	if len(username) < 3 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "username must be at least 3 characters"})
		return
	}
	if len(req.Password) < 8 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "password must be at least 8 characters"})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to hash password"})
		return
	}

	if err := savePersistedCredentials(s.stateFile, persistedCredentials{
		Username:     username,
		PasswordHash: string(hash),
	}); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to persist authentication config"})
		return
	}

	s.mu.Lock()
	s.enabled = true
	s.setupRequired = false
	s.username = username
	s.passwordHash = append([]byte(nil), hash...)
	s.mu.Unlock()

	if err := s.sessions.RenewToken(r.Context()); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to initialize session"})
		return
	}
	s.sessions.Put(r.Context(), sessionKeyAuthenticated, true)
	s.sessions.Put(r.Context(), sessionKeyUsername, username)

	writeJSON(w, http.StatusOK, domain.AuthStatusResponse{
		Enabled:              true,
		SetupRequired:        false,
		Authenticated:        true,
		CanManageCredentials: s.CanManageCredentials(),
		User:                 &domain.AuthUser{Username: username},
	})
}

func (s *Service) HandleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if s.SetupRequired() {
		writeJSON(w, http.StatusPreconditionFailed, map[string]string{"error": "initial setup required"})
		return
	}

	var req domain.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid login request"})
		return
	}

	s.mu.RLock()
	username := s.username
	passwordHash := append([]byte(nil), s.passwordHash...)
	s.mu.RUnlock()

	usernameMismatch := subtleUsernameMismatch(req.Username, username)
	hashToCheck := passwordHash
	if usernameMismatch {
		hashToCheck = []byte(dummyPasswordHash)
	}
	if bcrypt.CompareHashAndPassword(hashToCheck, []byte(req.Password)) != nil || usernameMismatch {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid username or password"})
		return
	}

	if err := s.sessions.RenewToken(r.Context()); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to initialize session"})
		return
	}

	s.sessions.Put(r.Context(), sessionKeyAuthenticated, true)
	s.sessions.Put(r.Context(), sessionKeyUsername, username)
	writeJSON(w, http.StatusOK, domain.AuthStatusResponse{
		Enabled:              true,
		SetupRequired:        false,
		Authenticated:        true,
		CanManageCredentials: s.CanManageCredentials(),
		User:                 &domain.AuthUser{Username: username},
	})
}

func (s *Service) HandleUpdateCredentials(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if s.SetupRequired() {
		writeJSON(w, http.StatusPreconditionFailed, map[string]string{"error": "initial setup required"})
		return
	}
	if !s.isAuthenticated(r.Context()) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "authentication required"})
		return
	}
	if !s.CanManageCredentials() {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "credentials are managed by environment variables"})
		return
	}

	var req domain.UpdateCredentialsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid credentials update request"})
		return
	}

	username := strings.TrimSpace(req.Username)
	if len(username) < 3 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "username must be at least 3 characters"})
		return
	}
	if len(req.NewPassword) < 8 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "new password must be at least 8 characters"})
		return
	}

	s.mu.RLock()
	currentHash := append([]byte(nil), s.passwordHash...)
	s.mu.RUnlock()
	if bcrypt.CompareHashAndPassword(currentHash, []byte(req.CurrentPassword)) != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "current password is incorrect"})
		return
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to hash password"})
		return
	}

	if err := savePersistedCredentials(s.stateFile, persistedCredentials{
		Username:     username,
		PasswordHash: string(newHash),
	}); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to persist authentication config"})
		return
	}

	s.mu.Lock()
	s.username = username
	s.passwordHash = append([]byte(nil), newHash...)
	s.mu.Unlock()
	s.sessions.Put(r.Context(), sessionKeyUsername, username)

	writeJSON(w, http.StatusOK, domain.AuthStatusResponse{
		Enabled:              true,
		SetupRequired:        false,
		Authenticated:        true,
		CanManageCredentials: true,
		User:                 &domain.AuthUser{Username: username},
	})
}

func (s *Service) HandleLogout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if err := s.sessions.Destroy(r.Context()); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to clear session"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Service) HandleMe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if s.SetupRequired() {
		writeJSON(w, http.StatusOK, domain.AuthStatusResponse{
			Enabled:              true,
			SetupRequired:        true,
			Authenticated:        false,
			CanManageCredentials: s.CanManageCredentials(),
		})
		return
	}
	if !s.isAuthenticated(r.Context()) {
		writeJSON(w, http.StatusUnauthorized, domain.AuthStatusResponse{
			Enabled:              true,
			SetupRequired:        false,
			Authenticated:        false,
			CanManageCredentials: s.CanManageCredentials(),
		})
		return
	}

	writeJSON(w, http.StatusOK, domain.AuthStatusResponse{
		Enabled:              true,
		SetupRequired:        false,
		Authenticated:        true,
		CanManageCredentials: s.CanManageCredentials(),
		User: &domain.AuthUser{
			Username: s.sessions.GetString(r.Context(), sessionKeyUsername),
		},
	})
}

func (s *Service) isAuthenticated(ctx context.Context) bool {
	if s.SetupRequired() {
		return false
	}
	return s.sessions.GetBool(ctx, sessionKeyAuthenticated)
}

func subtleUsernameMismatch(got, expected string) bool {
	gotTrimmed := strings.TrimSpace(got)
	if len(gotTrimmed) != len(expected) {
		return true
	}
	return subtle.ConstantTimeCompare([]byte(gotTrimmed), []byte(expected)) != 1
}

func isPublicPath(path string) bool {
	switch path {
	case "/api/health", "/api/login", "/api/logout", "/api/me", "/api/setup":
		return true
	default:
		return false
	}
}

func loadPersistedCredentials(path string) (*persistedCredentials, error) {
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	var creds persistedCredentials
	if err := json.Unmarshal(data, &creds); err != nil {
		return nil, err
	}
	creds.Username = strings.TrimSpace(creds.Username)
	creds.PasswordHash = strings.TrimSpace(creds.PasswordHash)
	if creds.Username == "" || creds.PasswordHash == "" {
		return nil, errors.New("stored authentication config is invalid")
	}
	return &creds, nil
}

func savePersistedCredentials(path string, creds persistedCredentials) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(creds, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, append(data, '\n'), 0o600)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
