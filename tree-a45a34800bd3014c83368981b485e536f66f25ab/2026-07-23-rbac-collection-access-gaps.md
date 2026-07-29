# Fix: Complete Collection Access Enforcement Across All RPC Handlers

**Date:** 2026-07-23
**Branch:** auth/stage4-scoped-tokens-rbac

## Summary

Closed RBAC collection access control gaps found during code review. Tokens
restricted to specific collections could previously access resources in other
collections through several unguarded RPC handlers.

## Changes

### WatchTasks (watch.go)
- Added `RequireCollectionAccess` when `collection_id` is provided.
- Reject collection-scoped tokens that omit `collection_id` with
  `PermissionDenied`.

### Task-by-ID handlers (server.go)
Added post-fetch `RequireCollectionAccess(ctx, task.CollectionID)` to:
- `GetTask`, `UpdateTask`, `ClaimTask`, `CloseTask`
- `AddComment`, `ListComments`
- `GetDependencyTree`

### GetLinkedAccount / DeleteLinkedAccount (server.go)
- Added `RequireCollectionAccess(ctx, la.CollectionID)` after fetching the
  linked account.

### ListLinkedAccounts (server.go)
- When `collection_id` is provided: added `RequireCollectionAccess` check.
- When `collection_id` is nil and token is collection-scoped: post-fetch filter
  results to only include linked accounts for allowed collections.

### GetReadyTasks / GetBlockedTasks (server.go)
- Reject with `InvalidArgument` when token is collection-scoped but no
  `collection_id` is specified.

### ListCollections pagination fix (server.go)
- Fixed `has_more` and `total` calculation when post-fetch filtering is active.
- When the store returns a full page, `has_more` is set to true since later
  pages may contain matching collections.
- `total` is now an approximation (count of filtered results on the current
  page) with a comment noting this limitation.

## Verification

- `go build ./...` passes
- `go test ./internal/server/ -count=1` passes
- `go test ./... -count=1` passes (full suite)
