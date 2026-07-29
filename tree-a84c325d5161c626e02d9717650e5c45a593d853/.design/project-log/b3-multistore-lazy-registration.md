# B3: MultiStore Lazy Platform Registration

**Date:** 2026-07-21
**Branch:** `feat/extstore-b3-lazy-registration`
**Status:** Complete

## Summary

Added lazy/on-demand platform store registration to MultiStore. When a
request targets a collection backed by an external platform (e.g. GitHub),
the MultiStore now automatically constructs the appropriate passthrough
store on the fly using LinkedAccount credentials — no manual
`RegisterPlatform` call needed.

## Design Decisions

### PlatformResolver function type (avoids circular imports)

The `store` package cannot import `internal/platform/github` directly
because `github` already imports `store`. To break the cycle, we
introduced a `PlatformResolver` function type defined in the `store`
package:

```go
type PlatformResolver func(
    platform collection.Platform,
    token string,
    remoteID string,
    collectionID uuid.UUID,
) (Store, error)
```

The actual GitHub implementation lives in
`internal/platform/github/resolver.go` and is wired up via
`MultiStore.SetResolver()` by the calling code (e.g. server bootstrap).

### Lazy resolution flow

1. `storeForCtx(ctx, collectionID)` checks the cached platforms map (fast
   path under read lock).
2. On cache miss, calls `lazyResolve()` which:
   - Returns nil immediately if no resolver is configured.
   - Looks up the collection in the primary store to get Platform +
     RemoteID.
   - Skips farmtable-native collections (no resolution needed).
   - Queries LinkedAccounts for the collection.
   - Calls the resolver with the account's auth token and collection
     metadata.
   - Caches the result under a write lock with double-check to handle
     concurrent resolution.

### Thread safety

- Read-lock fast path for cache hits.
- Write lock with double-check-after-lock for cache population.
- Race-losing goroutines close their store and use the winner's.

## Files Changed

- `internal/store/multistore.go` — Added `PlatformResolver` type,
  `SetResolver()`, `storeForCtx()`, `lazyResolve()`, `ParseOwnerRepo()`.
  Updated all collection-routed methods to use `storeForCtx` for lazy
  resolution.
- `internal/platform/github/resolver.go` — New file providing
  `NewPlatformResolver()` that handles GitHub collections via
  `NewPassThroughStore`.
- `internal/store/multistore_test.go` — Added 7 new tests covering lazy
  registration, caching, fallback behaviors, and concurrent safety. Added
  `TestParseOwnerRepo` unit tests.

## Test Coverage

| Test | Scenario |
|------|----------|
| `LazyRegistration_CreatesStoreOnFirstRequest` | First request triggers resolver and routes to platform store |
| `LazyRegistration_CachesOnSecondRequest` | Second request uses cached store (resolver called once) |
| `LazyRegistration_NoLinkedAccountFallsToPrimary` | No linked account → falls to primary, resolver not called |
| `LazyRegistration_FarmtableSkipsResolver` | Farmtable-native collections skip resolution entirely |
| `LazyRegistration_UnsupportedPlatformFallsToPrimary` | Resolver returns nil → falls to primary |
| `LazyRegistration_NoResolverFallsToPrimary` | No resolver configured → falls to primary (backward compat) |
| `LazyRegistration_ConcurrentSafety` | 10 concurrent goroutines, no panics or data races |
| `ParseOwnerRepo` | Table-driven tests for "owner/repo" parsing |

All 33 multistore tests pass. Full `go test ./...` passes. `go build ./...` passes.
