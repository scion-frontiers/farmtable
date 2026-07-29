# Passthrough Write-Through — Phase 1 (Core MVP)

**Date:** 2026-07-22
**Branch:** `feat/passthrough-write-p1`
**Design doc:** `.design/design-passthrough-write.md`

## Summary

Implemented Phase 1 of the write-through feature for GitHub passthrough
collections. Users can now edit tasks in writable GitHub collections directly
from the Farmtable dashboard — edits are written through to the GitHub API via
the existing `PassThroughStore` and `MultiStore` infrastructure.

## Changes

### Frontend (`web/src/components/ft-app.ts`)

- **`isReadOnly` getter**: Changed from a blanket platform check to consult
  `collection.remoteData.writable`. External collections with
  `writable === true` are no longer read-only.
- **`isCollectionWritable` helper**: Checks `coll.remoteData` for an explicit
  `writable: true` flag. Defaults to read-only for safety.
- **`isExternalWritable` getter**: Signals writable external state to child
  components (toolbar badge).
- **`applyTaskUpdate` coordination**: Calls `pollManager.markDirty(taskId)`
  before the async write and `pollManager.clearDirty(taskId)` in the `finally`
  block, preventing the background sweep from overwriting in-flight optimistic
  updates.
- **Poll interval**: Writable external collections poll at 15s (vs. 30s default
  for read-only external).

### Frontend (`web/src/store/poll-manager.ts`)

- **Merge-based refresh**: Replaced `store.clear()` + upsert loop with a
  merge strategy that skips dirty tasks and only deletes tasks that are gone
  from the remote (but not dirty). This eliminates both the flicker problem
  (stale data overwriting optimistic updates) and the "empty board" flash.
- **`dirtyTasks` set** + `markDirty` / `clearDirty` public API for coordination
  with `applyTaskUpdate`.

### Frontend (`web/src/components/ft-toolbar.ts`)

- **Badge**: Shows `↔ GitHub` for writable external collections instead of
  `🔒 Read-only`. Read-only external collections still show the lock badge.

### Backend (`internal/platform/github/passthrough.go`)

- **Assignee reverse-lookup**: Fixed the `UpdateTask` assignee handling. Instead
  of clearing all assignees, the code now builds a UUID → GitHub node ID reverse
  lookup from already-fetched issue data and calls `updateIssueAssignees` with
  the resolved node ID. Falls back to clearing assignees if the UUID is not
  found.

### Backend (`internal/platform/github/graphql_queries.go`)

- **Assignee node ID**: Added `ID` field to the assignee node struct in the
  `issueNode` GraphQL query to support the reverse-lookup.

## Verification

- `cd web && npm ci --prefer-offline && npm run build` — passes (TypeScript + Vite)
- `go build -o ft ./cmd/ft` — passes
- `go test ./internal/platform/github/...` — passes

## Acceptance Criteria Status

| # | Criterion | Status |
|---|-----------|--------|
| 1 | `isReadOnly` returns false for writable GitHub collections | Done |
| 2 | `isReadOnly` still returns true for non-writable GitHub collections | Done |
| 3 | Farmtable-platform collections unaffected | Done |
| 4 | PollManager uses merge-based refresh | Done |
| 5 | Dirty tasks skipped during sweep | Done |
| 6 | `applyTaskUpdate` coordinates with markDirty/clearDirty | Done |
| 7 | Poll interval 15s writable / 30s read-only | Done |
| 8 | Toolbar badge: "↔ GitHub" vs "🔒 Read-only" | Done |
| 9 | Assignee reverse lookup in passthrough.go | Done |
| 10 | Go tests pass | Done |
| 11 | Web builds cleanly | Done |
| 12 | Go builds cleanly | Done |

## Limitations / Follow-up

- Assignee reverse-lookup only finds users who appear on existing issues in the
  repo. Users who have never been assigned to any issue cannot be set from
  Farmtable (they can be assigned directly on GitHub).
- Phase 2 (capability-based UI gating) will disable unmappable operations
  (dates, acceptance criteria, relationships) with tooltips.
- Phase 3 (polish) will add write error toasts and rate-limit awareness.
