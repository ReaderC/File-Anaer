package jobs

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"sync"
	"time"

	"fileanaer/backend/internal/domain"
)

type Manager struct {
	mu          sync.RWMutex
	jobs        map[string]*domain.AnalyzeJob
	cancelFuncs map[string]context.CancelFunc
}

type DuplicateManager struct {
	mu          sync.RWMutex
	jobs        map[string]*domain.DuplicateJob
	cancelFuncs map[string]context.CancelFunc
}

func NewManager() *Manager {
	return &Manager{
		jobs:        map[string]*domain.AnalyzeJob{},
		cancelFuncs: map[string]context.CancelFunc{},
	}
}

func NewDuplicateManager() *DuplicateManager {
	return &DuplicateManager{
		jobs:        map[string]*domain.DuplicateJob{},
		cancelFuncs: map[string]context.CancelFunc{},
	}
}

func (m *Manager) Create() *domain.AnalyzeJob {
	job := &domain.AnalyzeJob{
		ID:        randomID(),
		Status:    "pending",
		CreatedAt: time.Now().UTC(),
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.jobs[job.ID] = job
	return job
}

func (m *Manager) Update(id string, mutate func(job *domain.AnalyzeJob)) (*domain.AnalyzeJob, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	job, ok := m.jobs[id]
	if !ok {
		return nil, false
	}
	mutate(job)
	return job, true
}

func (m *Manager) Get(id string) (*domain.AnalyzeJob, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	job, ok := m.jobs[id]
	if !ok {
		return nil, false
	}
	copy := *job
	return &copy, true
}

func (m *Manager) SetCancel(id string, cancel context.CancelFunc) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if cancel == nil {
		delete(m.cancelFuncs, id)
		return
	}
	m.cancelFuncs[id] = cancel
}

func (m *Manager) Delete(id string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	if cancel, found := m.cancelFuncs[id]; found {
		cancel()
		delete(m.cancelFuncs, id)
	}
	if _, ok := m.jobs[id]; !ok {
		return false
	}
	delete(m.jobs, id)
	return true
}

func (m *Manager) Clear() {
	m.mu.Lock()
	defer m.mu.Unlock()
	for id, cancel := range m.cancelFuncs {
		cancel()
		delete(m.cancelFuncs, id)
	}
	m.jobs = map[string]*domain.AnalyzeJob{}
}

func (m *DuplicateManager) Create() *domain.DuplicateJob {
	job := &domain.DuplicateJob{
		ID:        randomID(),
		Status:    "pending",
		CreatedAt: time.Now().UTC(),
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.jobs[job.ID] = job
	return job
}

func (m *DuplicateManager) SetCancel(id string, cancel context.CancelFunc) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if cancel == nil {
		delete(m.cancelFuncs, id)
		return
	}
	m.cancelFuncs[id] = cancel
}

func (m *DuplicateManager) Update(id string, mutate func(job *domain.DuplicateJob)) (*domain.DuplicateJob, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	job, ok := m.jobs[id]
	if !ok {
		return nil, false
	}
	mutate(job)
	return job, true
}

func (m *DuplicateManager) Get(id string) (*domain.DuplicateJob, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	job, ok := m.jobs[id]
	if !ok {
		return nil, false
	}
	copy := *job
	return &copy, true
}

func (m *DuplicateManager) Cancel(id string) (*domain.DuplicateJob, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	job, ok := m.jobs[id]
	if !ok {
		return nil, false
	}
	if cancel, found := m.cancelFuncs[id]; found {
		cancel()
		delete(m.cancelFuncs, id)
	}
	if job.Status == "running" || job.Status == "pending" {
		job.Status = "canceled"
		job.ProgressText = ""
		job.ProgressPercent = 0
		job.ProgressStep = 0
		job.ProgressTotal = 0
		job.Error = ""
	}
	copy := *job
	return &copy, true
}

func (m *DuplicateManager) Delete(id string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	if cancel, found := m.cancelFuncs[id]; found {
		cancel()
		delete(m.cancelFuncs, id)
	}
	if _, ok := m.jobs[id]; !ok {
		return false
	}
	delete(m.jobs, id)
	return true
}

func (m *DuplicateManager) Clear() {
	m.mu.Lock()
	defer m.mu.Unlock()
	for id, cancel := range m.cancelFuncs {
		cancel()
		delete(m.cancelFuncs, id)
	}
	m.jobs = map[string]*domain.DuplicateJob{}
}

func randomID() string {
	buf := make([]byte, 12)
	_, _ = rand.Read(buf)
	return hex.EncodeToString(buf)
}
