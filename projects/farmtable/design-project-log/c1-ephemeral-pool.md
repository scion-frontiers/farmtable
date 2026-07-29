# C1: EphemeralStorePool for In-Memory SQLite Graph Queries

**Date:** 2026-07-21
**Branch:** `feat/extstore-c1-ephemeral`
**Commit:** `feat: add EphemeralStorePool for in-memory SQLite graph queries`

## Summary

Created a pool of pre-migrated in-memory SQLite `EntStore` instances for
ephemeral graph queries. This avoids the overhead of running schema migrations
on every ephemeral query by recycling stores via truncation.

## Files Changed

- `internal/store/entstore.go` — Added `Truncate(ctx)` method that deletes all
  rows from all tables in FK-safe order (changes, comments, relationships,
  api_tokens, tasks, collections, users).
- `internal/store/ephemeral.go` — New file with `EphemeralStorePool` struct.
  - `NewEphemeralStorePool(maxSize)` — constructor
  - `Get(ctx)` — returns a pre-migrated store from pool or creates new one
  - `Return(s)` — truncates and recycles (or closes if pool is full)
  - `Close()` — closes all pooled stores
- `internal/store/ephemeral_test.go` — Tests covering:
  - `TestTruncate` — verifies all tables are emptied
  - `TestEphemeralStorePool_GetAndReturn` — basic get/return/recycle cycle
  - `TestEphemeralStorePool_ExceedsMaxSize` — excess stores are closed
  - `TestEphemeralStorePool_Close` — drains pool, subsequent Get still works

## Design Decisions

- **Truncation uses Ent client Delete (not raw SQL):** Keeps the implementation
  ORM-native and avoids coupling to SQLite-specific SQL. The FK-safe ordering
  is hardcoded based on the known schema dependency graph.
- **Pool uses sync.Mutex, not channel:** The pool is simple LIFO with a max
  size cap. A mutex is simpler and more appropriate than a buffered channel
  since we need to close excess stores.
- **Each in-memory SQLite store uses a unique connection:** The DSN
  `file::memory:?_fk=1` creates a private in-memory DB per connection,
  ensuring stores don't share state.
- **Truncation failure discards the store:** If truncation fails for any reason,
  the store is closed rather than returned to the pool in an unknown state.

## Verification

- `go build ./...` — passes
- `go test ./...` — all tests pass including new ephemeral pool tests
