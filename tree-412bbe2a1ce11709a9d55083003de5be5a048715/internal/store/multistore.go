package store

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"

	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/collection"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"github.com/google/uuid"
)

// PlatformResolver constructs a platform-specific Store for a
// collection on demand. It is called by MultiStore during lazy
// registration when a request targets an external collection that has
// no registered store yet.
//
// The resolver receives the collection's platform type, the
// LinkedAccount's auth token, and the collection's RemoteID (e.g.
// "owner/repo" for GitHub). collectionID should be threaded through to
// the constructed store so IDs stay stable.
//
// Returning (nil, nil) signals that the platform is unsupported; the
// caller falls through to the primary store.
type PlatformResolver func(platform collection.Platform, token string, remoteID string, collectionID uuid.UUID) (Store, error)

// MultiStore wraps a primary EntStore and routes operations to
// platform-specific stores based on collection ID. Task, comment, and
// graph operations are dispatched to the store registered for their
// collection. Collection, user, and token operations always go to the
// primary store.
type MultiStore struct {
	primary   Store
	resolver  PlatformResolver
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

// SetResolver configures a PlatformResolver for lazy on-demand
// registration of platform stores. When a request targets a collection
// with no registered store, the MultiStore looks up the collection's
// LinkedAccount in the primary store and calls the resolver to
// construct the appropriate platform store. The resulting store is
// cached for subsequent requests.
func (m *MultiStore) SetResolver(r PlatformResolver) {
	m.resolver = r
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
// the primary store if no platform is registered. It does not perform
// lazy resolution (use storeForCtx when a context is available).
func (m *MultiStore) storeFor(collectionID uuid.UUID) Store {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if s, ok := m.platforms[collectionID]; ok {
		return s
	}
	return m.primary
}

// storeForCtx returns the platform store for the given collection ID.
// If no store is registered it attempts lazy resolution via
// LinkedAccounts in the primary store. On success the constructed store
// is cached for subsequent requests.
func (m *MultiStore) storeForCtx(ctx context.Context, collectionID uuid.UUID) Store {
	// Fast path: check under read lock.
	m.mu.RLock()
	if s, ok := m.platforms[collectionID]; ok {
		m.mu.RUnlock()
		return s
	}
	m.mu.RUnlock()

	// Attempt lazy resolution (no-op when resolver is nil).
	if s := m.lazyResolve(ctx, collectionID); s != nil {
		return s
	}
	return m.primary
}

// lazyResolve checks the primary store for a LinkedAccount associated
// with the given collection, and if found, uses the PlatformResolver to
// construct and cache the appropriate platform store. Returns nil if no
// resolver is configured, no linked account exists, or the platform is
// unsupported.
func (m *MultiStore) lazyResolve(ctx context.Context, collectionID uuid.UUID) Store {
	if m.resolver == nil {
		return nil
	}

	// Look up the collection to determine its platform and remote ID.
	coll, err := m.primary.GetCollection(ctx, collectionID)
	if err != nil {
		return nil
	}
	if coll.Platform == collection.PlatformFarmtable {
		return nil // native collections don't need lazy resolution
	}

	// Look up linked accounts for this collection.
	accounts, _, err := m.primary.ListLinkedAccounts(ctx, ListLinkedAccountsParams{
		CollectionID: &collectionID,
	})
	if err != nil || len(accounts) == 0 {
		return nil
	}

	account := accounts[0] // use the first linked account

	s, err := m.resolver(coll.Platform, account.AuthToken, coll.RemoteID, collectionID)
	if err != nil {
		log.Printf("multistore: lazy resolve failed for collection %s (platform=%s): %v",
			collectionID, coll.Platform, err)
		return nil
	}
	if s == nil {
		// Resolver signalled unsupported platform.
		return nil
	}

	// Cache under write lock (double-check to avoid overwriting a
	// concurrent registration).
	m.mu.Lock()
	defer m.mu.Unlock()
	if existing, ok := m.platforms[collectionID]; ok {
		// Another goroutine registered first; close ours and use theirs.
		_ = s.Close()
		return existing
	}
	m.platforms[collectionID] = s
	return s
}

// ParseOwnerRepo splits a "owner/repo" string into its two components.
// Exported so that PlatformResolver implementations can use it.
func ParseOwnerRepo(remoteID string) (owner, repo string, ok bool) {
	parts := strings.SplitN(remoteID, "/", 2)
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return "", "", false
	}
	return parts[0], parts[1], true
}

// storeForTask resolves the store for a task ID by looking up the
// task's collection in the primary store first.
func (m *MultiStore) storeForTask(ctx context.Context, taskID uuid.UUID) (Store, error) {
	// Try primary first to find the task's collection ID.
	t, err := m.primary.GetTask(ctx, taskID)
	if err == nil {
		return m.storeForCtx(ctx, t.CollectionID), nil
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
			return m.storeForCtx(ctx, collID), nil
		}
	}
	return nil, fmt.Errorf("resolving store for task %s: %w", taskID, ErrNotFound)
}

// ── Task Operations (routed by collection) ──

func (m *MultiStore) CreateTask(ctx context.Context, p CreateTaskParams) (*ent.Task, error) {
	return m.storeForCtx(ctx, p.CollectionID).CreateTask(ctx, p)
}

func (m *MultiStore) InsertTasksAfter(ctx context.Context, p InsertTasksAfterParams) (*InsertTasksAfterResult, error) {
	return m.storeForCtx(ctx, p.CollectionID).InsertTasksAfter(ctx, p)
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
		return m.storeForCtx(ctx, *p.CollectionID).ListTasks(ctx, p)
	}
	return m.primary.ListTasks(ctx, p)
}

func (m *MultiStore) ListAllTasksForCollection(ctx context.Context, p ListAllTasksForCollectionParams) ([]*ent.Task, error) {
	return m.storeForCtx(ctx, p.CollectionID).ListAllTasksForCollection(ctx, p)
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
	return m.storeForCtx(ctx, p.CollectionID).ListAllCommentsForCollection(ctx, p)
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
	return m.storeForCtx(ctx, p.CollectionID).ListAllChangesForCollection(ctx, p)
}

// ── Relationship Operations (routed by collection) ──

func (m *MultiStore) ListAllRelationshipsForCollection(ctx context.Context, p ListAllRelationshipsForCollectionParams) ([]*ent.Relationship, error) {
	return m.storeForCtx(ctx, p.CollectionID).ListAllRelationshipsForCollection(ctx, p)
}

// ── Graph Query Operations (routed by collection when available) ──

func (m *MultiStore) GetReadyTasks(ctx context.Context, p GetReadyTasksParams) ([]*ReadyTaskResult, int, error) {
	if p.CollectionID != nil {
		return m.storeForCtx(ctx, *p.CollectionID).GetReadyTasks(ctx, p)
	}
	return m.primary.GetReadyTasks(ctx, p)
}

func (m *MultiStore) GetBlockedTasks(ctx context.Context, p GetBlockedTasksParams) ([]*BlockedTaskResult, int, error) {
	if p.CollectionID != nil {
		return m.storeForCtx(ctx, *p.CollectionID).GetBlockedTasks(ctx, p)
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

func (m *MultiStore) UpdateLinkedAccount(ctx context.Context, id uuid.UUID, p UpdateLinkedAccountParams) (*ent.LinkedAccount, error) {
	return m.primary.UpdateLinkedAccount(ctx, id, p)
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
