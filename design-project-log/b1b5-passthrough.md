# B1+B5: Enhance Passthrough Store

**Date:** 2026-07-21
**Commit:** 777da7f
**Branch:** feat/extstore-b1b5-passthrough

## Summary

Two enhancements to `GitHubPassThroughStore` in
`internal/platform/github/passthrough.go`.

### B1: Optional collectionID in Constructor

`NewPassThroughStore` now accepts a `collectionID *uuid.UUID` parameter. When
nil, the existing deterministic UUID derived from `github:<owner>/<repo>` is
used. When non-nil, the provided value is used directly. This allows callers
(e.g. the linked-account layer) to supply a pre-existing collection ID when
wiring a passthrough store to a known collection row.

The sole caller in `internal/cli/connect.go` was updated to pass `nil`,
preserving existing behavior.

### B5: Consistent ErrNotImplemented Guards

Audited all Store interface methods on `GitHubPassThroughStore`. Two methods
silently returned empty results instead of signaling they are unimplemented:

| Method          | Before            | After                                     |
|-----------------|-------------------|--------------------------------------------|
| `ListUsers`     | `nil, 0, nil`     | `nil, 0, fmt.Errorf("list users: %w", ErrNotImplemented)` |
| `ListAPITokens` | `nil, 0, nil`     | `nil, 0, fmt.Errorf("list API tokens: %w", ErrNotImplemented)` |

All other unimplemented methods already returned `ErrNotImplemented`. Functional
methods (ListTasks, GetTask, CreateTask, UpdateTask, ClaimTask, CloseTask,
AddComment, ListComments, GetReadyTasks, GetBlockedTasks, etc.) and synthetic
return methods (CreateUser, GetUser, GetUserByName, CreateCollection,
GetCollection, ListCollections, CreateAPIToken, LookupToken,
UpdateTokenLastUsed, Close) were left unchanged.

## Verification

- `go build ./...` — passed
- `go test ./...` — all packages passed
