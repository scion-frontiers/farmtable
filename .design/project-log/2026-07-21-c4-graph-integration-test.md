# C4: Graph Query Integration Tests

**Date:** 2026-07-21
**Branch:** `feat/extstore-c4-graph-test`
**Status:** Complete

## Summary

Added integration tests that verify graph queries (GetCriticalPath,
GetBottlenecks, GetReadyTasks, GetBlockedTasks) work correctly through the
ephemeral SQLite path for external (GitHub) collections. These tests exercise
the full gRPC round-trip, confirming that C3's ephemeral routing works
end-to-end.

## Changes

### `internal/testutil/testserver.go`
- Added `NewTestServerWithEphemeralPool()` helper that creates a gRPC test
  server with a configured `EphemeralStorePool` (pool size 2). This enables
  integration tests to exercise the ephemeral graph routing path through gRPC.

### `internal/server/graph_integration_test.go` (new)
Eight integration tests covering all four graph query types:

| Test | Graph Query | Scenario | Verifies |
|---|---|---|---|
| `TestGraphIntegration_GetCriticalPath_SimpleChain` | GetCriticalPath | A→B→C chain | Path depth=3, correct node order |
| `TestGraphIntegration_GetCriticalPath_Diamond` | GetCriticalPath | A→B,C→D diamond | Path depth=3, A first, D last |
| `TestGraphIntegration_GetReadyTasks_SimpleChain` | GetReadyTasks | A blocks B,C | Only A is ready |
| `TestGraphIntegration_GetReadyTasks_IndependentTasks` | GetReadyTasks | No relationships | All 3 tasks ready |
| `TestGraphIntegration_GetBlockedTasks_SimpleChain` | GetBlockedTasks | A→B→C chain | B,C blocked, A not |
| `TestGraphIntegration_GetBlockedTasks_NoneBlocked` | GetBlockedTasks | No relationships | 0 blocked tasks |
| `TestGraphIntegration_GetBottlenecks_Diamond` | GetBottlenecks | A→B,C→D diamond | A is top bottleneck (2 direct, 3 downstream) |
| `TestGraphIntegration_GetBottlenecks_SimpleChain` | GetBottlenecks | A→B→C chain | A is top bottleneck (1 direct, 2 downstream) |

## Test Strategy

Tests use the `server_test` package (external test) and exercise the full path:
1. Create a GitHub-platform collection via gRPC (triggers ephemeral routing)
2. Create tasks with blocking relationships via gRPC
3. Call graph query RPCs via gRPC client
4. Server detects external collection, loads tasks into ephemeral SQLite
5. Graph query runs on ephemeral store and returns results
6. Tests verify correctness of the response

No mock GitHub API is needed because the ephemeral path loads tasks from
whatever store backs the server. In the test setup, tasks are created directly
in the primary in-memory SQLite store, which the ephemeral loader reads from.

## Test Results

All 8 tests pass. Full `go test ./...` and `go build ./...` pass clean.
