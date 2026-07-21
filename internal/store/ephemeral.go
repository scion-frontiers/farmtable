package store

import (
	"context"
	"fmt"
	"sync"

	"entgo.io/ent/dialect"
)

// EphemeralStorePool manages a pool of pre-migrated in-memory SQLite
// EntStore instances for ephemeral graph queries.
type EphemeralStorePool struct {
	mu      sync.Mutex
	pool    []*EntStore
	maxSize int
}

// NewEphemeralStorePool creates a pool that holds up to maxSize recycled stores.
func NewEphemeralStorePool(maxSize int) *EphemeralStorePool {
	return &EphemeralStorePool{
		maxSize: maxSize,
	}
}

// Get returns a pre-migrated in-memory SQLite EntStore. It reuses a pooled
// instance when available, otherwise creates a new one.
func (p *EphemeralStorePool) Get(ctx context.Context) (*EntStore, error) {
	p.mu.Lock()
	if len(p.pool) > 0 {
		s := p.pool[len(p.pool)-1]
		p.pool = p.pool[:len(p.pool)-1]
		p.mu.Unlock()
		return s, nil
	}
	p.mu.Unlock()

	s, err := NewEntStore(ctx, StoreOptions{
		Dialect: dialect.SQLite,
		DSN:     "file::memory:?_fk=1",
		Migrate: true,
	})
	if err != nil {
		return nil, fmt.Errorf("creating ephemeral store: %w", err)
	}
	return s, nil
}

// Return truncates all data in the store and recycles it back into the pool.
// If the pool is already at capacity the store is closed instead.
func (p *EphemeralStorePool) Return(s *EntStore) {
	if err := s.Truncate(context.Background()); err != nil {
		// Truncation failed — discard the store.
		s.Close()
		return
	}

	p.mu.Lock()
	defer p.mu.Unlock()

	if len(p.pool) < p.maxSize {
		p.pool = append(p.pool, s)
	} else {
		s.Close()
	}
}

// Close closes all pooled stores and empties the pool.
func (p *EphemeralStorePool) Close() {
	p.mu.Lock()
	defer p.mu.Unlock()

	for _, s := range p.pool {
		s.Close()
	}
	p.pool = nil
}
