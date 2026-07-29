# PR Review: fix/f49-reciprocal-relationship-sync (Round 2)

## Review Summary

**Verdict:** APPROVE

**Overview:** This PR fixes a cache invalidation bug where adding "A blocks B" didn't immediately show "Blocked by A" on task B. The fix is clean and well-scoped: frontend optimistic reciprocal updates with rollback, plus server-side event bus fanout for multi-client sync. All three Round 1 findings (type-aware reciprocal removal, snapshot dedup, server event dedup) have been correctly addressed in the second commit.

---

## Executive Summary

Low-risk change touching two files with a focused scope. The logic is correct, the rollback mechanism is sound, and the Round 1 fixes improve both correctness and efficiency. No blocking issues found.

---

## Round 1 Fix Verification

### Fix 1: Type-aware reciprocal removal filter
**Status: Correctly applied.**

Before (commit 1): `removeRelationships` removed ALL relationships from the target where `targetTaskId === taskId`, regardless of type. This meant if task A had both BLOCKS and RELATED relationships to B, removing only the BLOCKS relationship would incorrectly also strip the unrelated RELATED reciprocal from B.

After (commit 2): The code now looks up the specific relationship types being removed from the source task, maps them to their reciprocal types (BLOCKS<->BLOCKED_BY, RELATED->RELATED, DUPLICATE->DUPLICATE), and only removes matching reciprocal types from the target. The use of `task.relationships` (the pre-update snapshot captured at line 548) is correct — it reflects the original relationships before `applyTaskUpdateFields` stripped them.

### Fix 2: Dedup rollback snapshots
**Status: Correctly applied.**

The `!reciprocalSnapshots.some(s => s.id === targetId)` guard ensures only the first (pre-modification) snapshot is stored per target. This is essential because if a targetId appears in both `addBlocks` and `addBlockedBy`, the second encounter fetches the already-modified task from the store — saving that as a snapshot would cause rollback to restore an intermediate state, not the original. Correctly implemented in all three blocks (addBlocks, addBlockedBy, removeRelationships).

### Fix 3: Server event dedup via seen-map
**Status: Correctly applied.**

Three separate loops over `p.AddBlocks`, `p.AddBlockedBy`, and `p.RemoveRelationships` collapsed into a single loop with a `seen` map. This prevents duplicate event publishes when the same target task ID appears in multiple lists (e.g., simultaneously adding and removing relationships to the same target). Cleaner code, same O(n) complexity, fewer redundant DB reads and event bus publishes.

---

## Critical Issues

None.

---

## Important Issues

None.

---

## Suggestions

### 1. [web/src/components/ft-app.ts] Target tasks not marked dirty for poll protection

The source task is marked dirty via `pollManager?.markDirty(taskId)` (line 553) to prevent poll sweeps from overwriting its optimistic update. However, the reciprocal target tasks are NOT marked dirty. If a poll refresh fires between the optimistic reciprocal update and the server's event bus notification (a narrow but real window), the poll could overwrite the reciprocal changes with stale data, causing a brief UI flicker before the event corrects it.

This is a minor UX concern, not a correctness bug — the event bus fanout ensures eventual consistency within milliseconds. The risk is proportional to poll frequency (default 30s) and network latency.

**Suggested fix (optional):**
```typescript
// After reciprocal updates, mark targets dirty too:
for (const snap of reciprocalSnapshots) {
  this.pollManager?.markDirty(snap.id);
}

// In the finally block, clear them:
for (const snap of reciprocalSnapshots) {
  this.pollManager?.clearDirty(snap.id);
}
```

### 2. [web/src/components/ft-app.ts] Minor: O(n) snapshot dedup via linear scan

`reciprocalSnapshots.some(s => s.id === targetId)` is O(n) per check. With typical relationship counts (1-5 targets), this is negligible. If relationship counts ever scale up, a `Set<string>` for seen IDs would be O(1). Not worth changing now.

### 3. No automated tests for the new behavior

Neither the frontend optimistic reciprocal logic nor the server event bus fanout have dedicated tests. The server tests exercise relationship CRUD but don't assert on event bus publish calls. The frontend has no test infrastructure for `applyTaskUpdate`. This is existing test infrastructure debt rather than a gap introduced by this PR — noting it for visibility.

---

## What's Done Well

- **Clean separation of concerns**: Frontend handles optimistic UI, server handles authoritative event fanout — neither duplicates the other's job.
- **Correct use of pre-update snapshot**: The `removeRelationships` block correctly references `task.relationships` (line 600) — the original task captured before `applyTaskUpdateFields` — rather than the store's current state. This ensures the reciprocal type lookup reflects what was actually removed.
- **Rollback completeness**: The catch block restores both the source task and all reciprocal targets to their pre-modification state. The snapshot dedup ensures rollback always restores the true original, even when a target appears in multiple relationship lists.
- **Idempotent reciprocal adds**: The `!target.relationships.some(...)` guard (lines 565, 581) prevents duplicate reciprocal entries if the relationship already exists.
- **Server-side dedup is idiomatic Go**: The `seen` map pattern with a range over a slice of slices is clean, readable, and avoids the repetition of three nearly-identical loops.
- **Silent error handling for missing targets**: Server-side `if err == nil` on `GetTask` gracefully handles targets that may have been deleted between the relationship mutation and the event fanout — no error propagation for what is effectively a best-effort notification.

---

## Verification Story

- Tests reviewed: Yes — confirmed all existing tests pass. No new tests added (noted as suggestion).
- Build verified: Yes — `go build ./...` succeeds.
- Test suite: Yes — `go test ./...` all pass.
- Lint/static analysis: Not run (no lint config observed in CLAUDE.md).
- Security checked: Yes — no new user input vectors, no credential exposure, no unsanitized data paths. Server-side event fanout reuses existing authenticated store access.
