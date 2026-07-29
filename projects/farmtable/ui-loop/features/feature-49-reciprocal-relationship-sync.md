# Feature 49: Fix Missing Reciprocal Relationship Sync

## Summary

When a user adds "A blocks B", the UI immediately showed the BLOCKS relationship
on task A, but task B did NOT show "Blocked by A" until a page reload or the
30-second poll. The root cause was twofold: the frontend optimistic update only
modified the source task in the TaskStore, and the server event bus only published
a TaskEvent for the source task.

## Files Modified

- `web/src/components/ft-app.ts` — Frontend reciprocal optimistic update
- `internal/server/server.go` — Server event bus fanout for target tasks

## Fix 1: Frontend — Reciprocal Optimistic Update

In `applyTaskUpdate()`, after upserting the source task, we now also upsert
reciprocal relationships on target tasks in the TaskStore:

- **addBlocks**: For each target task, add a `BLOCKED_BY` relationship pointing
  back to the source task (if not already present).
- **addBlockedBy**: For each target task, add a `BLOCKS` relationship pointing
  back to the source task (if not already present).
- **removeRelationships**: For each target task, remove all relationships
  pointing back to the source task.

Snapshots of target tasks are saved before modification and rolled back on
server error, matching the existing optimistic update pattern for the source
task.

## Fix 2: Server — Event Bus Fanout for Target Tasks

In the `UpdateTask` handler, after publishing the `TaskEvent` for the mutated
task, we now also refetch and publish events for each relationship target task
(`AddBlocks`, `AddBlockedBy`, `RemoveRelationships`). This ensures all connected
clients (including other browser tabs) see the reciprocal update immediately
via the WatchTasks stream without waiting for the poll interval.

The `RemoveRelationships` field contains target task IDs (confirmed by the proto
comment and the store implementation), so we can iterate directly without
needing to look up relationship rows.

## Review Fixes (Round 1 → Round 2)

Three minor findings from Round 1 review, all addressed in commit e9207f1:

1. **Type-aware reciprocal removal**: `removeRelationships` now uses a type-aware
   filter — it looks up the relationship types being removed from the source task,
   inverts them (BLOCKS↔BLOCKED_BY), and only removes matching reciprocal types
   from the target. Previously it removed all relationships pointing to the source.

2. **Dedup rollback snapshots**: All three reciprocal blocks now check
   `!reciprocalSnapshots.some(s => s.id === targetId)` before pushing a snapshot,
   preventing stale snapshots if the same target appears in multiple relationship arrays.

3. **Server event dedup**: Three identical publish loops collapsed into one with a
   `seen` map to avoid duplicate events for the same target task.

Round 2 review: APPROVE with only nitpick-level suggestions (poll-race flicker,
O(n) dedup, no new tests).

## Build & Test Results

- Frontend: `npm ci && npm run build` — TypeScript check and Vite build pass
- TypeScript: `tsc --noEmit` — clean
- Go binary: `go build -o ft ./cmd/ft` — compiles successfully
- Go tests: `go test ./internal/server/ ./internal/store/` — all pass

## PR

- **PR:** https://github.com/scion-frontiers/farmtable/pull/126
- **Branch:** `fix/f49-reciprocal-relationship-sync`
- **Commits:** 7aa9bea (main fix), e9207f1 (review fixes)
- **Status:** OPEN, MERGEABLE
