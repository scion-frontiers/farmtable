# Fix: GetBottlenecks blocked_by edge seeding (Issue #76)

**Date:** 2026-07-22
**Commit:** `fix(server): seed GetBottlenecks candidates from both blocks and blocked_by edges (fixes #76)`

## What was fixed

`GetBottlenecks` in `internal/server/server.go` had a bug in its candidate
seeding loop. It only checked `t.Edges.SourceRelationships` for `blocks`-type
edges when building the list of tasks that block others. This meant a task whose
dependents were created via `blocked_by` edges (where the blocker is the TARGET
of the relationship) was never seeded as a candidate.

The downstream traversal function `countDownstream` already correctly handled
both directions — it checks both `SourceRelationships` (blocks) and
`TargetRelationships` (blocked_by). The seeding loop was never updated to match
when `countDownstream` was fixed in commit 4dd4fa9.

## What changed

### `internal/server/server.go`
- Added a second loop in the seeding section to check `t.Edges.TargetRelationships`
  for `blocked_by`-type edges, appending `rel.SourceTaskID` to `blocksTargets`.
- Added a `seen` map for deduplication, so the same dependent is not counted
  twice if both a `blocks` and a `blocked_by` edge exist for the same pair.

### `internal/server/server_test.go`
- Added `TestRPC_GetBottlenecks_BlockedBy` — creates Task A, then creates two
  dependents using `AddBlockedBy` (not `AddBlocks`), and asserts Task A appears
  as a bottleneck with `DirectDependents == 2`.

## Test results

```
=== RUN   TestRPC_GetBottlenecks
--- PASS: TestRPC_GetBottlenecks (0.01s)
=== RUN   TestRPC_GetBottlenecks_BlockedBy
--- PASS: TestRPC_GetBottlenecks_BlockedBy (0.01s)
PASS
```

Both the existing test (using `AddBlocks`) and the new test (using `AddBlockedBy`)
pass. The CLI `ft task bottlenecks` command now correctly returns results when
dependencies are created via `--blocked-by`.
