# A6: MultiStore for Platform-Based Store Routing

**Date:** 2026-07-21
**Branch:** `feat/extstore-a6-multistore`
**Commit:** `705b8c2`

## Summary

Implemented `MultiStore` in `internal/store/multistore.go` — a routing layer
that wraps a primary `EntStore` and dispatches operations to platform-specific
stores based on collection ID.

## Design

### Struct

```go
type MultiStore struct {
    primary   Store
    mu        sync.RWMutex
    platforms map[uuid.UUID]Store
}
```

### Routing Rules

| Operation Category | Routing |
|---|---|
| Task ops (Create, Get, Update, Claim, Close, Delete, List, InsertAfter) | By `collectionID` → platform store if registered, otherwise primary |
| Comment ops (Add, Get, List) | By task's `collectionID` (looked up via `storeForTask`) |
| Change/Relationship ops | By task or collection ID → platform or primary |
| Graph queries (GetReadyTasks, GetBlockedTasks) | By `collectionID` pointer if set, otherwise primary |
| Collection ops (CRUD) | Always primary |
| User ops (CRUD) | Always primary |
| Token ops (CRUD) | Always primary |
| ImportCollection | Always primary |
| Close | Closes all platform stores then primary; returns first error |

### Key Methods

- `NewMultiStore(primary Store)` — constructor
- `RegisterPlatform(collectionID, store)` — runtime registration with write lock
- `storeFor(collectionID)` — fast read-lock lookup, falls back to primary
- `storeForTask(ctx, taskID)` — resolves task's collection by trying primary first, then scanning platform stores

### Thread Safety

Uses `sync.RWMutex` — `RegisterPlatform` takes a write lock; all routing
lookups use read locks. Safe for concurrent access from multiple goroutines.

## Tests

25 tests in `internal/store/multistore_test.go`:

- Interface satisfaction compile check
- Task CRUD routing to platform vs primary
- Comment routing via task lookup
- Collection/User/Token ops always use primary
- Graph queries route by collection
- Unregistered collections fall through to primary
- Close propagates to all stores

All tests use in-memory SQLite via `testutil.NewTestStore`.

## Files Changed

- `internal/store/multistore.go` — new (283 lines)
- `internal/store/multistore_test.go` — new (590 lines)
