# Investigation: Missing Reciprocal Relationship Display (BLOCKS ↔ BLOCKED_BY)

**Date:** 2026-07-22  
**Reporter:** ptone@google.com  
**Investigator:** Scion investigator agent

---

## Summary

When a user adds a "Blocks" relationship from task A to task B, task B does not immediately display "Blocked by A" in its Inspector Relationships tab. The root cause is a **frontend cache invalidation bug**: the optimistic update and the WatchTasks event stream both update only the source task (A), never the target task (B). The backend is correct — it synthesizes reciprocal relationships on read — but the frontend store holds stale data for B until a full poll refresh (30s default). This is a new bug introduced in Feature 46 (PR #123, merged 2026-07-22), which added the first write-path for relationships. **Scope: XS** — fixable in ~15–20 lines across two files.

---

## Reproduction

**Environment:** Local dashboard (`ft dashboard --port 9092`), fresh seed DB, Playwright automation.

**Steps:**
1. Start dashboard with a fresh DB (no relationships).
2. Load the "default" collection — 7 tasks, all with 0 relationships.
3. Call `applyTaskUpdate(task1.id, { addBlocks: [task3.id] })` — the same codepath as the command palette add-relationship flow and drag-and-drop.
4. Immediately check the in-memory TaskStore for both tasks.

**Observed:**
- Task 1 store data: `relationships: [{type: BLOCKS, targetTaskId: task3}]` ✅
- Task 3 store data: `relationships: []` ❌ — no BLOCKED_BY entry
- After 3 seconds (server sync via WatchTasks): Task 3 still shows `relationships: []` ❌

**Expected:**
- Task 3 should immediately show `relationships: [{type: BLOCKED_BY, targetTaskId: task1}]`

**Backend verification (CLI):**
- After adding the relationship, `ft task get <task3_id>` correctly returns `RELATIONSHIP_TYPE_BLOCKED_BY` pointing to task1. The backend's read path is correct.

---

## Root Cause

The bug is at two levels in the frontend + server event propagation:

### 1. Frontend Optimistic Update (primary cause)

**File:** `web/src/components/ft-app.ts:547–564` (applyTaskUpdate)  
**File:** `web/src/gen/service.ts:104–116` (applyTaskUpdateFields)

When `applyTaskUpdate(taskA, { addBlocks: [taskB] })` is called:
- `applyTaskUpdateFields(taskA, { addBlocks: [taskB] })` adds `{type: BLOCKS, targetTaskId: B}` to **task A's** relationships in the local TaskStore (line 551–552).
- Task B is **never touched**. The optimistic update function only modifies the source task. There is no code to add the reciprocal `{type: BLOCKED_BY, targetTaskId: A}` to task B's data in the store.
- The `client.updateTask()` return value is **discarded** (line 556) — the server's correct response (which includes the reciprocal for A) is not even used.

### 2. Server Event Bus (secondary cause)

**File:** `internal/server/server.go:573–579`

After UpdateTask processes a relationship addition, the event bus publishes a TaskEvent **only for the updated task** (A). The target task (B) is never refetched or published. Consequently, the WatchTasks stream delivers an event for A but not for B, leaving B's in-memory data stale in the frontend.

### Why the backend is correct

**File:** `internal/store/entstore.go:357–361` — `getTaskWithEdges()` loads both `WithSourceRelationships()` and `WithTargetRelationships()`.

**File:** `internal/server/convert.go:280–295` — `taskToProto()` serializes SourceRelationships as-is and TargetRelationships with inverted types via `invertRelationshipType()` (added in commit `fb76723`). When task B is fetched from the server, the single DB row `(source=A, target=B, type=blocks)` is correctly presented as `{type: BLOCKED_BY, targetTaskId: A}` on B's proto.

The data model stores relationships as **single directional rows** (one per relationship, not two). The reciprocal is synthesized on read by querying both directions. This design is correct but requires the frontend to either re-fetch the target or manually synthesize the reciprocal locally.

---

## Timeline / Regression Analysis

| Commit | Date | Feature | Impact |
|--------|------|---------|--------|
| `0f1c55b` / `55437f3` | 2026-07-19 | Feature 25 (PR #71): Inspector Relationships tab | Display only, no write path. No bug. |
| `fb76723` | 2026-07-21 | Fix: invert relationship type in convert.go | Fixed backend read path for target-side relationships. |
| `beaf627` / `09ef3c3` | 2026-07-22 | Feature 46 (PR #123): Command palette add-relationship | **Introduced this bug**: first write path for relationships with optimistic update that only updates the source task. |
| `85dff11` / `b8ee51f` | 2026-07-22 | Feature 48 (PR #124): Drag-and-drop relationships | Uses the same `applyTaskUpdate`, inherits the same bug. |

**Conclusion:** This is a new bug, introduced with Feature 46 (PR #123, 2026-07-22). It was never possible before because there was no UI to add relationships.

---

## Scope Recommendation

**XS** — The fix is small and well-scoped.

---

## Recommended Approach

Two complementary fixes, both small:

### Fix 1: Frontend optimistic update (required, ~10 lines)

**File:** `web/src/components/ft-app.ts`, method `applyTaskUpdate()` (around line 552)

After upserting the updated source task, also upsert the reciprocal on the target task(s):

```typescript
// After line 552: this.taskStore.upsert(updated);

// Synthesize reciprocal relationships on target tasks
if (fields.addBlocks?.length) {
  for (const targetId of fields.addBlocks) {
    const target = this.taskStore.getTask(targetId);
    if (target && !target.relationships.some(r => r.type === RelationshipType.BLOCKED_BY && r.targetTaskId === taskId)) {
      this.taskStore.upsert({
        ...target,
        relationships: [...target.relationships, { type: RelationshipType.BLOCKED_BY, targetTaskId: taskId }],
      });
    }
  }
}
if (fields.addBlockedBy?.length) {
  for (const targetId of fields.addBlockedBy) {
    const target = this.taskStore.getTask(targetId);
    if (target && !target.relationships.some(r => r.type === RelationshipType.BLOCKS && r.targetTaskId === taskId)) {
      this.taskStore.upsert({
        ...target,
        relationships: [...target.relationships, { type: RelationshipType.BLOCKS, targetTaskId: taskId }],
      });
    }
  }
}
```

Also handle `removeRelationships` — when a relationship is removed from A, remove the reciprocal from B:

```typescript
if (fields.removeRelationships?.length) {
  for (const targetId of fields.removeRelationships) {
    const target = this.taskStore.getTask(targetId);
    if (target) {
      this.taskStore.upsert({
        ...target,
        relationships: target.relationships.filter(r => r.targetTaskId !== taskId),
      });
    }
  }
}
```

### Fix 2: Server event bus (recommended, ~15 lines)

**File:** `internal/server/server.go`, in the UpdateTask handler (around line 573)

After publishing the event for the source task, also refetch and publish events for each relationship target. This ensures other connected clients also see the update:

```go
// After the existing Publish call for the source task:
// Also publish events for relationship targets so their cached state is refreshed.
for _, targetID := range p.AddBlocks {
    if tt, err := s.store.GetTask(ctx, targetID); err == nil {
        s.eventBus.Publish(&pb.TaskEvent{
            EventType: pb.TaskEventType_TASK_EVENT_TYPE_UPDATED,
            Task:      taskToProto(tt),
            Timestamp: timestamppb.Now(),
        })
    }
}
for _, targetID := range p.AddBlockedBy {
    // same pattern
}
```

### Priority

Fix 1 alone resolves the user-reported bug for single-client usage. Fix 2 ensures multi-client correctness. Both should be done, but Fix 1 is the minimum viable fix.

---

## Open Questions

1. **RemoveRelationships rollback**: The current optimistic rollback in `applyTaskUpdate` only rolls back the source task (`this.taskStore.upsert(task)` on line 559). If Fix 1 is applied, the rollback should also undo the reciprocal changes on target tasks. This adds ~5 lines to the catch block.

2. **ft-kanban-view.ts also has its own `applyTaskUpdate`** (line 182 in `ft-kanban-view.ts`) — verify whether relationships can be added from the kanban view directly, and if so, apply the same fix there.

---

## Files Referenced

| File | Lines | Role |
|------|-------|------|
| `web/src/components/ft-app.ts` | 547–564, 798–816, 823–829 | Frontend: applyTaskUpdate, onRelationshipAdd, onDependencyDrop |
| `web/src/gen/service.ts` | 55–135 | Frontend: applyTaskUpdateFields (optimistic update helper) |
| `web/src/store/task-store.ts` | 59–62 | Frontend: upsert method |
| `web/src/store/stream-manager.ts` | 78–82 | Frontend: WatchTasks event handler |
| `web/src/store/poll-manager.ts` | 103–150 | Frontend: periodic full refresh (30s fallback) |
| `internal/server/server.go` | 511–580 | Server: UpdateTask handler + event bus publish |
| `internal/store/entstore.go` | 653–705 | Store: AddBlocks/AddBlockedBy write path (single row) |
| `internal/server/convert.go` | 280–295, 371–384 | Server: taskToProto with invertRelationshipType |
| `internal/store/schema/relationship.go` | 1–47 | Ent schema: Relationship entity with source/target edges |
| `proto/farmtable.proto` | 83–88, 218–222, 593–597 | Proto: RelationshipType enum, Relationship message, update fields |
