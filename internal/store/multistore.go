package store

import (
	"context"
	"fmt"
	"sync"

	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"github.com/google/uuid"
)

// MultiStore wraps a primary EntStore and routes operations to
// platform-specific stores based on collection ID. Task, comment, and
// graph operations are dispatched to the store registered for their
// collection. Collection, user, and token operations always go to the
// primary store.
type MultiStore struct {
	primary   Store
	mu        sync.RWMutex
	platforms map[uuid.UUID]Store
}

// NewMultiStore creates a MultiStore backed by the given primary store.
func NewMultiStore(primary Store) *MultiStore {
	return &MultiStore{
		primary:   primary,
		platforms: make(map[uuid.UUID]Store),
	}
}

// RegisterPlatform associates a collection ID with a platform-specific
// store. Subsequent task/comment/graph operations for that collection
// will be routed to the registered store.
func (m *MultiStore) RegisterPlatform(collectionID uuid.UUID, s Store) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.platforms[collectionID] = s
}

// storeFor returns the platform store for the given collection ID, or
// the primary store if no platform is registered.
func (m *MultiStore) storeFor(collectionID uuid.UUID) Store {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if s, ok := m.platforms[collectionID]; ok {
		return s
	}
	return m.primary
}

// storeForTask resolves the store for a task ID by looking up the
// task's collection in the primary store first.
func (m *MultiStore) storeForTask(ctx context.Context, taskID uuid.UUID) (Store, error) {
	// Try primary first to find the task's collection ID.
	t, err := m.primary.GetTask(ctx, taskID)
	if err == nil {
		return m.storeFor(t.CollectionID), nil
	}

	// If not found in primary, scan platform stores.
	m.mu.RLock()
	stores := make(map[uuid.UUID]Store, len(m.platforms))
	for id, s := range m.platforms {
		stores[id] = s
	}
	m.mu.RUnlock()

	for collID, s := range stores {
		_, lookErr := s.GetTask(ctx, taskID)
		if lookErr == nil {
			return m.storeFor(collID), nil
		}
	}
	return nil, fmt.Errorf("resolving store for task %s: %w", taskID, ErrNotFound)
}

// ── Task Operations (routed by collection) ──

func (m *MultiStore) CreateTask(ctx context.Context, p CreateTaskParams) (*ent.Task, error) {
	return m.storeFor(p.CollectionID).CreateTask(ctx, p)
}

func (m *MultiStore) InsertTasksAfter(ctx context.Context, p InsertTasksAfterParams) (*InsertTasksAfterResult, error) {
	return m.storeFor(p.CollectionID).InsertTasksAfter(ctx, p)
}

func (m *MultiStore) GetTask(ctx context.Context, id uuid.UUID) (*ent.Task, error) {
	s, err := m.storeForTask(ctx, id)
	if err != nil {
		return nil, err
	}
	return s.GetTask(ctx, id)
}

func (m *MultiStore) ListTasks(ctx context.Context, p ListTasksParams) ([]*ent.Task, int, error) {
	if p.CollectionID != nil {
		return m.storeFor(*p.CollectionID).ListTasks(ctx, p)
	}
	return m.primary.ListTasks(ctx, p)
}

func (m *MultiStore) ListAllTasksForCollection(ctx context.Context, p ListAllTasksForCollectionParams) ([]*ent.Task, error) {
	return m.storeFor(p.CollectionID).ListAllTasksForCollection(ctx, p)
}

func (m *MultiStore) UpdateTask(ctx context.Context, id uuid.UUID, p UpdateTaskParams, actorID uuid.UUID) (*ent.Task, error) {
	s, err := m.storeForTask(ctx, id)
	if err != nil {
		return nil, err
	}
	return s.UpdateTask(ctx, id, p, actorID)
}

func (m *MultiStore) ClaimTask(ctx context.Context, id uuid.UUID, assigneeID uuid.UUID, version string) (*ent.Task, error) {
	s, err := m.storeForTask(ctx, id)
	if err != nil {
		return nil, err
	}
	return s.ClaimTask(ctx, id, assigneeID, version)
}

func (m *MultiStore) CloseTask(ctx context.Context, id uuid.UUID, stage task.Stage, version string, actorID uuid.UUID) (*ent.Task, error) {
	s, err := m.storeForTask(ctx, id)
	if err != nil {
		return nil, err
	}
	return s.CloseTask(ctx, id, stage, version, actorID)
}

func (m *MultiStore) DeleteTask(ctx context.Context, id uuid.UUID) error {
	s, err := m.storeForTask(ctx, id)
	if err != nil {
		return err
	}
	return s.DeleteTask(ctx, id)
}

// ── Comment Operations (routed by task → collection) ──

func (m *MultiStore) AddComment(ctx context.Context, p AddCommentParams) (*ent.Comment, error) {
	s, err := m.storeForTask(ctx, p.TaskID)
	if err != nil {
		return nil, err
	}
	return s.AddComment(ctx, p)
}

func (m *MultiStore) GetComment(ctx context.Context, id uuid.UUID) (*ent.Comment, error) {
	// Comments don't carry collectionID; try primary first, then platforms.
	c, err := m.primary.GetComment(ctx, id)
	if err == nil {
		return c, nil
	}

	m.mu.RLock()
	stores := make([]Store, 0, len(m.platforms))
	for _, s := range m.platforms {
		stores = append(stores, s)
	}
	m.mu.RUnlock()

	for _, s := range stores {
		c, err = s.GetComment(ctx, id)
		if err == nil {
			return c, nil
		}
	}
	return nil, ErrNotFound
}

func (m *MultiStore) ListComments(ctx context.Context, p ListCommentsParams) ([]*ent.Comment, int, error) {
	s, err := m.storeForTask(ctx, p.TaskID)
	if err != nil {
		return nil, 0, err
	}
	return s.ListComments(ctx, p)
}

func (m *MultiStore) ListAllCommentsForTask(ctx context.Context, p ListAllCommentsForTaskParams) ([]*ent.Comment, error) {
	s, err := m.storeForTask(ctx, p.TaskID)
	if err != nil {
		return nil, err
	}
	return s.ListAllCommentsForTask(ctx, p)
}

func (m *MultiStore) ListAllCommentsForCollection(ctx context.Context, p ListAllCommentsForCollectionParams) ([]*ent.Comment, error) {
	return m.storeFor(p.CollectionID).ListAllCommentsForCollection(ctx, p)
}

// ── Change Operations (routed by task → collection) ──

func (m *MultiStore) ListChanges(ctx context.Context, p ListChangesParams) ([]*ent.Change, int, error) {
	s, err := m.storeForTask(ctx, p.TaskID)
	if err != nil {
		return nil, 0, err
	}
	return s.ListChanges(ctx, p)
}

func (m *MultiStore) ListAllChangesForTask(ctx context.Context, p ListAllChangesForTaskParams) ([]*ent.Change, error) {
	s, err := m.storeForTask(ctx, p.TaskID)
	if err != nil {
		return nil, err
	}
	return s.ListAllChangesForTask(ctx, p)
}

func (m *MultiStore) ListAllChangesForCollection(ctx context.Context, p ListAllChangesForCollectionParams) ([]*ent.Change, error) {
	return m.storeFor(p.CollectionID).ListAllChangesForCollection(ctx, p)
}

// ── Relationship Operations (routed by collection) ──

func (m *MultiStore) ListAllRelationshipsForCollection(ctx context.Context, p ListAllRelationshipsForCollectionParams) ([]*ent.Relationship, error) {
	return m.storeFor(p.CollectionID).ListAllRelationshipsForCollection(ctx, p)
}

// ── Graph Query Operations (routed by collection when available) ──

func (m *MultiStore) GetReadyTasks(ctx context.Context, p GetReadyTasksParams) ([]*ReadyTaskResult, int, error) {
	if p.CollectionID != nil {
		return m.storeFor(*p.CollectionID).GetReadyTasks(ctx, p)
	}
	return m.primary.GetReadyTasks(ctx, p)
}

func (m *MultiStore) GetBlockedTasks(ctx context.Context, p GetBlockedTasksParams) ([]*BlockedTaskResult, int, error) {
	if p.CollectionID != nil {
		return m.storeFor(*p.CollectionID).GetBlockedTasks(ctx, p)
	}
	return m.primary.GetBlockedTasks(ctx, p)
}

// ── Import (routed by result collection) ──

func (m *MultiStore) ImportCollection(ctx context.Context, p ImportCollectionParams) (*ent.Collection, error) {
	// Import always goes to primary; the resulting collection can be
	// registered with RegisterPlatform afterward.
	return m.primary.ImportCollection(ctx, p)
}

// ── Collection Operations (always primary) ──

func (m *MultiStore) CreateCollection(ctx context.Context, p CreateCollectionParams) (*ent.Collection, error) {
	return m.primary.CreateCollection(ctx, p)
}

func (m *MultiStore) UpdateCollection(ctx context.Context, id uuid.UUID, p UpdateCollectionParams) (*ent.Collection, error) {
	return m.primary.UpdateCollection(ctx, id, p)
}

func (m *MultiStore) GetCollection(ctx context.Context, id uuid.UUID) (*ent.Collection, error) {
	return m.primary.GetCollection(ctx, id)
}

func (m *MultiStore) ListCollections(ctx context.Context, p ListCollectionsParams) ([]*ent.Collection, int, error) {
	return m.primary.ListCollections(ctx, p)
}

// ── User Operations (always primary) ──

func (m *MultiStore) CreateUser(ctx context.Context, p CreateUserParams) (*ent.User, error) {
	return m.primary.CreateUser(ctx, p)
}

func (m *MultiStore) GetUser(ctx context.Context, id uuid.UUID) (*ent.User, error) {
	return m.primary.GetUser(ctx, id)
}

func (m *MultiStore) GetUserByName(ctx context.Context, name string) (*ent.User, error) {
	return m.primary.GetUserByName(ctx, name)
}

func (m *MultiStore) GetUserByEmail(ctx context.Context, email string) ([]*ent.User, error) {
	return m.primary.GetUserByEmail(ctx, email)
}

func (m *MultiStore) GetUsersByIDs(ctx context.Context, ids []uuid.UUID) ([]*ent.User, error) {
	return m.primary.GetUsersByIDs(ctx, ids)
}

func (m *MultiStore) ListUsers(ctx context.Context, p ListUsersParams) ([]*ent.User, int, error) {
	return m.primary.ListUsers(ctx, p)
}

// ── API Token Operations (always primary) ──

func (m *MultiStore) CreateAPIToken(ctx context.Context, p CreateAPITokenParams) (*ent.ApiToken, string, error) {
	return m.primary.CreateAPIToken(ctx, p)
}

func (m *MultiStore) LookupToken(ctx context.Context, tokenHash string) (*ent.ApiToken, error) {
	return m.primary.LookupToken(ctx, tokenHash)
}

func (m *MultiStore) ListAPITokens(ctx context.Context, p ListAPITokensParams) ([]*ent.ApiToken, int, error) {
	return m.primary.ListAPITokens(ctx, p)
}

func (m *MultiStore) RevokeAPIToken(ctx context.Context, id uuid.UUID) error {
	return m.primary.RevokeAPIToken(ctx, id)
}

func (m *MultiStore) UpdateTokenLastUsed(ctx context.Context, id uuid.UUID) error {
	return m.primary.UpdateTokenLastUsed(ctx, id)
}

// ── LinkedAccount Operations (always primary) ──

func (m *MultiStore) CreateLinkedAccount(ctx context.Context, p CreateLinkedAccountParams) (*ent.LinkedAccount, error) {
	return m.primary.CreateLinkedAccount(ctx, p)
}

func (m *MultiStore) GetLinkedAccount(ctx context.Context, id uuid.UUID) (*ent.LinkedAccount, error) {
	return m.primary.GetLinkedAccount(ctx, id)
}

func (m *MultiStore) DeleteLinkedAccount(ctx context.Context, id uuid.UUID) error {
	return m.primary.DeleteLinkedAccount(ctx, id)
}

func (m *MultiStore) ListLinkedAccounts(ctx context.Context, p ListLinkedAccountsParams) ([]*ent.LinkedAccount, int, error) {
	return m.primary.ListLinkedAccounts(ctx, p)
}

// ── Lifecycle ──

func (m *MultiStore) Close() error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var firstErr error
	for _, s := range m.platforms {
		if err := s.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	if err := m.primary.Close(); err != nil && firstErr == nil {
		firstErr = err
	}
	return firstErr
}
