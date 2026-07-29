# Issue #76 Validation: `ft task bottlenecks` Misses `--blocked-by` Edges

**Status:** Bug CONFIRMED — reporter's analysis is accurate and the suggested fix is correct.
**Scope:** XS (single function, ~10 lines changed + regression test)
**Recommendation:** GO for fix dispatch.

## Summary

The bug exists exactly as described in issue #76. `ft task bottlenecks` returns
`{"items": null}` when the dependency graph uses `--blocked-by` edges, while
`ft task critical-path` on the same data correctly identifies the bottleneck.
The reporter's root-cause analysis is precise and their suggested fix is the
correct approach. PR #126 (reciprocal relationship sync, F49) is entirely
unrelated — it addressed frontend event-bus and optimistic-update caching, not
backend graph seeding.

## Reproduction

**Environment:** Prebuilt `ft` v0.2.0 against `origin/main` (commit `f1a86dc`),
embedded/SQLite mode.

### Bug case (`--blocked-by` edges)

```
$ export FARMTABLE_DB_PATH=/tmp/issue76-test.db
$ A=$(ft task create "Task A" -o json | jq -r .id)
$ ft task create "Task B" --blocked-by "$A" >/dev/null
$ ft task create "Task C" --blocked-by "$A" >/dev/null

$ ft task bottlenecks -o json
{"items": null}                          # WRONG — should list Task A

$ ft task critical-path -o table
DEPTH  ID        NAME    STAGE
0      2d0980e2  Task A  triage
1      0aca5c3b  Task B  triage
Total depth: 2
Bottleneck: Task A — blocks 2 tasks directly   # CORRECT
```

### Control case (`--add-blocks` edges)

```
$ A=$(ft task create "Task A" -o json | jq -r .id)
$ B=$(ft task create "Task B" -o json | jq -r .id)
$ C=$(ft task create "Task C" -o json | jq -r .id)
$ ft task update "$A" --add-blocks "$B"
$ ft task update "$A" --add-blocks "$C"

$ ft task bottlenecks -o json
{"items":[{"direct_dependents":2,"downstream_count":2,
           "id":"81f574ef","name":"Task A","stage":"triage"}]}   # CORRECT
```

**Conclusion:** Bug reproduces 100%. The direction of edge creation determines
whether `GetBottlenecks` finds the blocker.

## Root Cause — Confirmed

The reporter's analysis is accurate. The bug is in the **candidate seeding loop**
of `GetBottlenecks`, NOT in the traversal functions.

### The seeding loop (`server.go:1686-1701`)

```go
// GetBottlenecks — candidate seeding (BUGGY)
for _, t := range tasks {
    var blocksTargets []uuid.UUID
    for _, rel := range t.Edges.SourceRelationships {
        if rel.Type == "blocks" {
            blocksTargets = append(blocksTargets, rel.TargetTaskID)
        }
    }
    if len(blocksTargets) > 0 {
        allTasks = append(allTasks, ...)
    }
}
```

This ONLY checks `t.Edges.SourceRelationships` for `type == "blocks"`. When
Task B says `--blocked-by TaskA`, the store creates a relationship with:
- `source_task_id = TaskB`
- `target_task_id = TaskA`
- `type = "blocked_by"`

So Task A is the **target** of a `blocked_by` relationship, not the **source**
of a `blocks` relationship. The seeding loop never considers Task A as a
candidate, so it's never passed to `countDownstream`.

### The traversal function (`server.go:1756-1779`) — already fixed

```go
// countDownstream — traverses BOTH directions (CORRECT)
for _, rel := range t.Edges.SourceRelationships {
    if rel.Type == "blocks" && !visited[rel.TargetTaskID] { ... }
}
for _, rel := range t.Edges.TargetRelationships {
    if rel.Type == "blocked_by" && !visited[rel.SourceTaskID] { ... }
}
```

Commit `4dd4fa9` ("Fix graph RPCs to traverse both relationship edge
directions") correctly fixed `countDownstream`, `findLongestBlocksChain`, and
`buildDependencyNode` — but missed the seeding loop in `GetBottlenecks`. The
commit message even says it fixed `GetBottlenecks`, but the seeding was
overlooked.

### Why `critical-path` works but `bottlenecks` doesn't

`GetCriticalPath` (`server.go:1460`) seeds from **ALL tasks** in the collection
(lines 1531-1537), not just those with specific edge types. Then
`findLongestBlocksChain` (already dual-direction) correctly traverses. No
seeding filter → no seeding bug.

## PR #126 Overlap Check — None

PR #126 (commit `6814944`, "sync reciprocal relationships immediately, F49")
modified:
- Frontend `TaskStore` optimistic updates for reciprocal relationship display
- Server `UpdateTask` to publish events for relationship target tasks

It did NOT touch `GetBottlenecks`, `countDownstream`, or any graph-analysis
RPCs. No overlap or conflict with the suggested fix.

## Suggested Fix Evaluation — Correct and Sufficient

The reporter's fix — mirror `countDownstream`'s dual-direction traversal in the
seeding loop — is the correct approach:

```go
// After existing SourceRelationships loop, add:
for _, rel := range t.Edges.TargetRelationships {
    if rel.Type == "blocked_by" {
        blocksTargets = append(blocksTargets, rel.SourceTaskID)
    }
}
```

This ensures a task that blocks others via incoming `blocked_by` edges is
recognized as a candidate. The `countDownstream` traversal (already
dual-direction) will then correctly count its dependents.

**Deduplication note:** If the same blocker–dependent pair exists via BOTH a
`blocks` AND a `blocked_by` edge (unusual but possible via mixed CLI usage),
`blocksTargets` would contain duplicates. This affects `directCount` but NOT
`downstreamCount` (which uses a `visited` map). The fix should de-duplicate
`blocksTargets` or use a set to be safe.

## Other RPCs With Same Pattern — None Found

| RPC | Seeding approach | Status |
|-----|-----------------|--------|
| `GetCriticalPath` | Seeds from ALL tasks | OK |
| `GetDependencyTree` | Starts from a specific root task | OK |
| `GetReadyTasks` | Delegates to store-layer query | OK |
| `GetBlockedTasks` | Delegates to store-layer query | OK |
| `GetBottlenecks` | Filters by `SourceRelationships` only | **BUG** |

`GetBottlenecks` is the only RPC with single-direction candidate seeding.

## Test Gap — Confirmed

`TestRPC_GetBottlenecks` (`server_test.go:1536`) builds its DAG using
`AddBlocks` exclusively (line 1564: `AddBlocks: []string{dep.GetId()}`). No
test exercises the `AddBlockedBy` / `--blocked-by` path for bottleneck
detection.

**Regression test needed:** Create the same graph using `AddBlockedBy` instead
of `AddBlocks` and assert the blocker appears in `GetBottlenecks` results.

## Scope Recommendation

**XS** — The fix is:
1. Add ~4 lines to the seeding loop in `GetBottlenecks` (mirror
   `countDownstream`'s `TargetRelationships` check).
2. Optionally de-duplicate `blocksTargets` (1-2 lines).
3. Add one regression test (~40 lines) using `AddBlockedBy`.

Single file (`internal/server/server.go`) + test file. No schema changes, no
proto changes, no frontend impact.

## Open Questions

None — the root cause, fix, and scope are clear.
