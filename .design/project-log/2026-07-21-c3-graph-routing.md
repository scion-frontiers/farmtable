# C3: Graph Query Routing for External Collections

**Date:** 2026-07-21
**Branch:** feat/extstore-c3-graph-routing
**Task:** Route graph queries for external collections through ephemeral SQLite

## Summary

Modified the 4 graph query handlers (GetCriticalPath, GetBlockedTasks,
GetReadyTasks, GetBottlenecks) to detect external collections and route
through an ephemeral in-memory SQLite path when the passthrough store has
no SQL database for graph queries.

The routing logic works as follows:
1. **Farmtable collections** (or no collection_id): proceed via the direct
   store path (existing behavior, unchanged).
2. **External collections with graph support** (github, linear, jira by
   default): load tasks from the passthrough store into an ephemeral SQLite
   store from `EphemeralStorePool`, run the graph query against it, then
   release the store back to the pool.
3. **External collections without graph support** (asana, beads by default):
   return `codes.Unimplemented` with descriptive message.

## Design Decisions

- **Ephemeral store reuses pool from C1**: `EphemeralStorePool` is injected
  into `FarmTableService` via `WithEphemeralPool` service option, following
  the existing options pattern.
- **ID remapping**: tasks loaded into the ephemeral store get new IDs; a
  mirror collection is created so collection-scoped queries work. An ID map
  tracks original-to-ephemeral task IDs for relationship recreation.
- **Bidirectional relationship creation**: when loading relationships into
  the ephemeral store, both `blocks` and `blocked_by` complements are
  created. This ensures graph handlers that look for only one direction
  (e.g., `SourceRelationships` with type `blocks`) work correctly.
- **Helper function**: `loadEphemeralStore` encapsulates the full
  load-and-query pattern, avoiding duplication across the 4 handlers.
- **Root task ID clearing**: for GetCriticalPath on external collections,
  `root_task_id` is cleared since original IDs don't exist in the ephemeral
  store.

## Files Changed

- `internal/server/server.go` — Added `ephemeralPool` field to
  `FarmTableService` struct, `WithEphemeralPool` service option, and
  routing logic at the top of all 4 graph handlers.
- `internal/server/graph_routing.go` — New file containing:
  - `resolveGraphRoute` — determines routing path for a collection
  - `loadEphemeralStore` — acquires ephemeral store, loads tasks and
    relationships, returns a temporary `FarmTableService`
  - `taskToCreateParams` — converts `ent.Task` to `CreateTaskParams`
  - `extractRelationships` — extracts relationships from task edges
  - `createRelationshipViaUpdate` — creates relationships via UpdateTask
    with bidirectional complement
  - `ephemeralCollectionID` — resolves the ephemeral collection ID
- `internal/server/graph_routing_test.go` — 14 tests covering:
  - Route resolution for farmtable, supported external, unsupported
    external, and nonexistent collections
  - End-to-end ephemeral path for all 4 graph handlers
  - Unimplemented error for unsupported platforms
  - Direct path for farmtable collections
  - Nil pool error handling
  - Relationship extraction

## Dependencies

- **C1** (`internal/store/ephemeral.go`): EphemeralStorePool for acquiring
  and returning in-memory SQLite stores
- **C2** (`internal/server/graph_support.go`): `collectionSupportsGraph`
  for platform support detection

## Test Results

All 14 new tests pass. All existing server tests continue to pass.
```
go build ./...           # clean
go test ./internal/server/  # 0.27s, all PASS
```
