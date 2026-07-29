# PR Review: fix(web,server): sync reciprocal relationships on optimistic update and event bus (F49)

**Commit:** 7aa9bea  
**Files Changed:** `internal/server/server.go`, `web/src/components/ft-app.ts`  
**Reviewer:** Code Review Agent  
**Date:** 2026-07-22

---

## Review Summary

**Verdict:** APPROVE

**Overview:** This is a clean, well-scoped fix that addresses the reciprocal relationship sync gap in both the frontend (optimistic updates) and backend (event bus propagation). The core BLOCKS/BLOCKED_BY mapping is correct, the rollback logic is sound for all realistic scenarios, and the change is minimal in blast radius. Two minor edge cases are noted as suggestions but are non-blocking.

---

## Critical Issues

None.

---

## Important Issues

None.

---

## Suggestions

### 1. `removeRelationships` over-removes reciprocal relationships on the frontend

**File:** `web/src/components/ft-app.ts:593`

The reciprocal filter for `removeRelationships` removes ALL of target task B's relationships pointing at source task A:

```typescript
relationships: target.relationships.filter(r => r.targetTaskId !== taskId),
```

This is broader than what the server does. On the server, `RemoveRelationships` deletes edges where `source=A AND target=B` (entstore.go:695-700), which removes e.g. `A BLOCKS B`. But if B independently has its own edge to A (e.g., `source=B, target=A, type=RELATED`), that row survives on the server. In B's proto, that would appear as `{type: RELATED, targetTaskId: A}` and would be incorrectly removed by the frontend filter.

This is **self-correcting** because the server immediately publishes a `TASK_UPDATED` event for B (server.go:598-605) carrying the canonical state from the database. The UI flash would be imperceptible. But for correctness, a tighter filter could match only the reciprocal type:

```typescript
// Suggested improvement (non-blocking):
if (fields.removeRelationships?.length) {
  // Build a set of (targetId, reciprocalType) pairs from the source task's
  // relationships that are being removed.
  const removed = new Set(
    task.relationships
      .filter(r => fields.removeRelationships!.includes(r.targetTaskId))
      .map(r => `${r.targetTaskId}:${reciprocal(r.type)}`)
  );
  for (const targetId of fields.removeRelationships) {
    const target = this.taskStore.getTask(targetId);
    if (target) {
      reciprocalSnapshots.push({ id: targetId, original: target });
      this.taskStore.upsert({
        ...target,
        relationships: target.relationships.filter(
          r => r.targetTaskId !== taskId || !removed.has(`${targetId}:${r.type}`)
        ),
      });
    }
  }
}
```

**Impact:** Very low. Only matters if the same pair of tasks have multiple relationship types simultaneously, which is unusual.

### 2. Duplicate targetId across relationship arrays causes stale rollback snapshot

**File:** `web/src/components/ft-app.ts:556-597`

If the same `targetId` appears in both `fields.addBlocks` and `fields.addBlockedBy` (or in one of those and `fields.removeRelationships`), the second pass reads the already-mutated task from the store and snapshots that modified version. On rollback, the first mutation would not be reverted.

```
// Scenario (theoretical):
// addBlocks = [B], addBlockedBy = [B]
// 1. Snapshot B_original, upsert B + BLOCKED_BY
// 2. getTask(B) returns B_modified, snapshot B_modified  <-- stale
// Rollback restores B_modified, not B_original
```

**Impact:** Extremely low. Sending both `addBlocks` and `addBlockedBy` targeting the same task in one update is not a realistic UI flow, and the server event would correct the state regardless.

**Suggested fix (optional):** Snapshot only if not already captured:

```typescript
if (!reciprocalSnapshots.some(s => s.id === targetId)) {
  reciprocalSnapshots.push({ id: targetId, original: target });
}
```

### 3. Server: duplicate events for same target task

**File:** `internal/server/server.go:580-606`

If the same target UUID appears in both `p.AddBlocks` and `p.AddBlockedBy` (or in an add array and `p.RemoveRelationships`), the server publishes duplicate `TASK_UPDATED` events for that target. Not harmful — clients handle idempotent upserts — but slightly wasteful.

**Suggested fix (optional):** Deduplicate target IDs before publishing:

```go
seen := make(map[uuid.UUID]bool)
for _, lists := range [][]uuid.UUID{p.AddBlocks, p.AddBlockedBy, p.RemoveRelationships} {
    for _, targetID := range lists {
        if seen[targetID] { continue }
        seen[targetID] = true
        if tt, err := s.store.GetTask(ctx, targetID); err == nil {
            s.eventBus.Publish(&pb.TaskEvent{
                EventType: pb.TaskEventType_TASK_EVENT_TYPE_UPDATED,
                Task:      taskToProto(tt),
                Timestamp: timestamppb.Now(),
            })
        }
    }
}
```

This would also reduce code duplication (three identical loops collapsed into one).

---

## What's Done Well

- **Correct reciprocal mapping.** The BLOCKS ↔ BLOCKED_BY inversion is accurate and matches the data model in `convert.go:375-384`. The frontend correctly adds `BLOCKED_BY` on target when source gets `BLOCKS`, and vice versa.

- **Idempotent upserts.** The `.some()` guard (lines 563, 577) prevents duplicate relationships from being added on repeated optimistic updates — this is important because Lit's reactive update cycle could re-trigger.

- **Clean rollback design.** Snapshot-before-mutate with full restore on error is the right pattern. Including reciprocal rollback (lines 605-608) prevents target tasks from being left in an inconsistent state after a failed server call.

- **Graceful handling of missing targets.** Both frontend (`if (target)`) and backend (`if err == nil`) silently skip target tasks that aren't loaded/found. This is correct — the target may be in a different collection or simply not loaded in the current view.

- **Minimal blast radius.** The change is tightly scoped to the existing `applyTaskUpdate` and `UpdateTask` methods with no structural changes, keeping the risk low.

- **Server-side refetch from DB.** The server re-fetches target tasks via `s.store.GetTask(ctx, targetID)` before publishing, ensuring the event carries the canonical post-mutation state (including the newly-created reciprocal edge via `TargetRelationships`), not a stale or hand-constructed version.

---

## Verification Story

- **Tests reviewed:** Yes — Go tests pass (`go test ./internal/server/` and `go test ./internal/store/`). No new test coverage for the event bus reciprocal publishing or the frontend optimistic reciprocal logic. Consider adding a server-side test that verifies target task events are published after relationship mutation, and a unit test for the frontend reciprocal snapshot/rollback logic.
- **Build verified:** Yes — `go build ./...` clean, `tsc --noEmit` clean.
- **Lint/static analysis clean:** Yes — no compiler or type errors introduced.
- **Security checked:** Yes — no new user inputs, no credential exposure, no unsafe concurrency. The `GetTask` calls in the server are read-only and occur after the transaction has committed, so they see consistent state.
