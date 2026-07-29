# Investigation: Periodic Background Refresh Causes Full Graph View Redraw + Re-Zoom

**Status**: Root cause confirmed and reproduced  
**Date**: 2026-07-23  
**Worktree**: `/workspace/farmtable-inv-graph-redraw` (branch `explore/graph-redraw`)

---

## Summary

The graph views (Dependency view primarily, Tree view secondarily) redraw and reset viewport position on every poll cycle for external/polling collections. The root cause is a two-part defect:

1. **`snapshotComplete()` fires unconditionally** on every poll cycle, triggering re-renders of all components with `TaskStoreController` — even when no data has changed.
2. **The dependency view's `structureKey()` does not sort relationships**, making it sensitive to relationship array ordering. When an external platform (e.g., GitHub) returns relationships in a different order between API calls, the structure key changes, triggering a full re-layout and viewport reset (`centerGraph()`) on every poll tick.

---

## Reproduction

Reproduced locally using a seed database with blocking relationships and Playwright automation. The test simulates what happens when a poll returns tasks with relationships in a different array order (a realistic scenario for GitHub-backed collections where API response ordering is not guaranteed).

### Steps
1. Start dashboard with seed DB containing tasks with multiple BLOCKED_BY relationships
2. Open Dependency view, select a task, wait for zoom animation to complete
3. Re-upsert the same tasks with reversed relationship order + call `snapshotComplete()`
4. Observe viewport resets

### Observed
```
Before: panX=-400.00, panY=-233.67, scale=1.2800
After:  panX=-78.54,  panY=0.00,    scale=1.2547
```
**Viewport changes dramatically.** The `updated()` lifecycle confirms `needsCenter: true` and `changedProps.has('selectedTaskId') === false`, meaning `centerGraph()` (full viewport reset) fires — not `centerOnNode()`.

### Controls
- **snapshotComplete() alone (no data change)**: Viewport stable ✅
- **Re-upsert identical data (deep clone, same field order)**: Viewport stable ✅ (JSON.stringify equality check in `upsert()` correctly suppresses `tasks-changed`)
- **Re-upsert with changed `updatedAt` only**: Viewport stable ✅ for tree view (structure key doesn't include timestamps) — fires 7× `tasks-changed` but tree structure key is robust
- **Re-upsert with reversed relationship order**: **❌ Viewport changes** for dependency view

---

## Root Cause

### Problem 1: `snapshotComplete()` fires unconditionally on every poll

**Files**: `web/src/store/poll-manager.ts:137`, `web/src/store/task-store.ts:76-79`

```typescript
// poll-manager.ts — PollManager.refresh()
this.store.snapshotComplete();  // Line 137 — always fires, even when no data changed
```

```typescript
// task-store.ts
snapshotComplete(): void {
  this._isLoading = false;
  this.dispatchEvent(new CustomEvent('snapshot-complete'));  // Always dispatched
}
```

The `TaskStoreController` (used by all views) listens for both `tasks-changed` AND `snapshot-complete`:

```typescript
// task-store-controller.ts:17-18
this.store.addEventListener('tasks-changed', this.onChanged);
this.store.addEventListener('snapshot-complete', this.onSnapshot);
```

Both handlers call `this.host.requestUpdate()`. Feature 55's equality check in `upsert()` prevents unnecessary `tasks-changed` events, but `snapshotComplete()` bypasses that entirely — it fires unconditionally. Result: **every poll cycle triggers a re-render of every component with a `TaskStoreController`**, regardless of whether data changed.

### Problem 2: Dependency view's `structureKey()` is order-sensitive

**File**: `web/src/components/dependency/ft-dependency-view.ts:439-447`

```typescript
private structureKey(tasks: Task[]): string {
  return tasks
    .map(
      (t) =>
        `${t.id}:${t.phase}:${t.relationships.map((r) => `${r.type}-${r.targetTaskId}`).join(',')}`,
    )
    .sort()
    .join('|');
}
```

The outer `.sort()` normalizes task ordering, but the inner `t.relationships.map(...).join(',')` preserves the array order of relationships. If the server returns relationships in a different order between API calls (realistic for GitHub/external platforms that don't guarantee array ordering), the structure key changes even though the logical data is identical.

When the structure key changes:
1. `runLayout()` performs a full graph re-layout (`ft-dependency-view.ts:472-473`)
2. `needsCenter = true` is set (`ft-dependency-view.ts:473`)
3. In `updated()`, since `changedProps.has('selectedTaskId')` is false, the else-if branch fires (`ft-dependency-view.ts:272-283`):
   ```typescript
   } else if (this.needsCenter && this.layoutNodes.length > 0) {
     // ... centerGraph() resets viewport
   }
   ```
4. `centerGraph()` resets `panX`, `panY`, and `scale` — the user sees the view "redraw and re-zoom"

### Problem 3: `JSON.stringify` equality check is order-sensitive

**File**: `web/src/store/task-store.ts:63-65`

```typescript
if (existing && !_changes && JSON.stringify(existing) === JSON.stringify(task)) {
  return;
}
```

This equality check is byte-exact. If the server returns any arrays (relationships, assignees, labels, customFields) in a different order, the comparison fails and `tasks-changed` fires unnecessarily. This doesn't directly cause the viewport reset (that's Problem 2), but it contributes to unnecessary re-rendering and is the reason Problem 2's order-sensitivity is triggered — the new task objects with reordered relationships get stored.

---

## Event Chain (per poll tick, external collection)

```
PollManager.refresh()
  → listTasks()                           // Fetch tasks from external API
  → store.upsert(task) × N               // JSON.stringify may fail if arrays reordered
    → IF different: store new object, dispatch 'tasks-changed'
  → store.snapshotComplete()              // ALWAYS dispatches 'snapshot-complete'

TaskStoreController (on each view)
  → 'snapshot-complete' listener fires    // Always fires
  → host.requestUpdate()                  // Triggers Lit re-render

ft-dependency-view re-render
  → willUpdate() → runLayout()
    → structureKey() includes unsorted relationships
    → IF key changed (relationship order different): needsCenter = true
  → updated()
    → changedProps.has('selectedTaskId') → false
    → needsCenter && layoutNodes.length > 0 → true
    → centerGraph() → VIEWPORT RESETS
```

---

## Scope

| Dimension | Affected? | Notes |
|-----------|-----------|-------|
| Dependency view | **YES** | Structure key includes unsorted relationships |
| Tree view | **No** (viewport) | Structure key only uses `id:parentTaskId` — order-stable |
| Tree view | Partial (re-render) | `snapshotComplete()` triggers unnecessary re-renders but no viewport change |
| External/polling collections | **YES** | Poll interval 15s (writable) / 30s (read-only) |
| Native/streaming collections | **No** | `snapshotComplete()` only fires once (initial snapshot), then individual events |
| Kanban view | **No** (viewport) | No pan/zoom viewport to reset; Feature 55 addressed its flicker |

---

## Recommended Approach

### Fix 1 (Essential — XS): Sort relationships in dependency view `structureKey()`

**File**: `web/src/components/dependency/ft-dependency-view.ts:439-447`

Add `.sort()` after `relationships.map(...).join(',')` to normalize ordering:

```typescript
private structureKey(tasks: Task[]): string {
  return tasks
    .map(
      (t) =>
        `${t.id}:${t.phase}:${t.relationships
          .map((r) => `${r.type}-${r.targetTaskId}`)
          .sort()         // ← ADD THIS
          .join(',')}`,
    )
    .sort()
    .join('|');
}
```

This directly prevents the viewport reset by making the key order-insensitive.

### Fix 2 (Essential — XS): Guard `snapshotComplete()` in `PollManager.refresh()`

**File**: `web/src/store/poll-manager.ts:103-149`, `web/src/store/task-store.ts:59-68`

Track whether any data actually changed during the poll. Only call `snapshotComplete()` if data changed or the store is still loading:

1. Have `upsert()` return a boolean indicating whether data was changed:
   ```typescript
   upsert(task: Task, _changes?: Change[]): boolean {
     const existing = this.tasks.get(task.id);
     if (existing && !_changes && JSON.stringify(existing) === JSON.stringify(task)) {
       return false;
     }
     this.tasks.set(task.id, task);
     this.dispatchEvent(new CustomEvent('tasks-changed', { detail: { task } }));
     return true;
   }
   ```

2. In `PollManager.refresh()`, track changes:
   ```typescript
   let anyChanged = false;
   for (const task of tasks) {
     freshIds.add(task.id);
     if (!this.dirtyTasks.has(task.id)) {
       if (this.store.upsert(task)) anyChanged = true;
     }
   }
   // Delete removed tasks
   for (const existing of this.store.allTasks) {
     if (!freshIds.has(existing.id) && !this.dirtyTasks.has(existing.id)) {
       this.store.delete(existing.id);
       anyChanged = true;
     }
   }
   // Only fire snapshot-complete if data actually changed or initial load
   if (anyChanged || this.store.isLoading) {
     this.store.snapshotComplete();
   }
   ```

This prevents unnecessary re-renders of all `TaskStoreController`-connected components on every poll tick.

### Fix 3 (Robustness — Small): Consider order-insensitive equality in `upsert()`

The `JSON.stringify` comparison is byte-exact and fails for logically-identical data with different array ordering. A more robust approach would normalize arrays before comparison, but the cost/benefit may not justify the complexity. Fix 1 + Fix 2 resolve the user-facing symptoms without touching the equality check.

---

## Scope Estimate

**XS** — Fixes 1 and 2 are each a few lines, clearly scoped, and together resolve the reported symptoms. No architectural changes needed.

---

## Open Questions

1. **Which external platforms actually return relationships in varying order?** GitHub's API doesn't guarantee ordering of issue references. The server-side adapter's proto serialization preserves whatever order the API returns. Confirming this on a live GitHub collection would provide additional confidence.

2. **Should `TaskStoreController` listen to `snapshot-complete` at all?** Its purpose seems to be signaling that the initial load is done (`isLoading` → false). After the first snapshot, subsequent `snapshot-complete` events are redundant for views that already have data. A targeted fix could make the controller only respond to the first `snapshot-complete`, then unsubscribe.
