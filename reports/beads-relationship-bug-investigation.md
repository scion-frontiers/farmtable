# Investigation: Beads-Import Relationships Missing in Dependency View

**Date:** 2026-07-24
**Investigator:** Scion agent (farmtable-inv-beads-relbug)
**Reporter:** ptone@google.com (via Discord)

---

## Summary

The reported bug is **NOT a Beads importer data issue**. The Beads importer creates structurally correct, properly-directioned relationship records identical to natively-created ones. The root cause is that the **Dependency View unconditionally excludes CLOSED tasks** from the dependency graph, including when a user explicitly selects and solos a closed task. The Tree View inspector, which doesn't filter by phase, shows the relationships correctly — creating the discrepancy the user observed.

---

## Raw Relationship Data

### Selected Task (9f7731a8-a23d-493d-86eb-2ac5d39f5e7a)

Retrieved via `ft-iap get-task` against the live production instance:

| Field | Value |
|-------|-------|
| Name | "Task: Review mitmedialab/jibo-workshop-mcp..." |
| **Phase** | **4 (CLOSED)** |
| **Stage** | **12 (COMPLETED)** |
| native_status | "closed" |

**Relationships on this task (SourceRelationships):**

| Type | Value | Target Task ID |
|------|-------|----------------|
| BLOCKS | 1 | 3ddc1f98-440f-40e7-a762-fc07a7b914df |
| BLOCKS | 1 | 7b0fa2c2-366d-4a64-b39c-d897f55c9d83 |
| BLOCKS | 1 | d04b594d-530d-4e5f-8a4b-772e16360dca |

### Blocked Tasks (reciprocal view via TargetRelationships)

| Task ID | Phase | Stage | Has BLOCKED_BY→selected? |
|---------|-------|-------|--------------------------|
| 3ddc1f98... "Gap analysis..." | 1 (OPEN) | 3 (READY) | YES: `{type:2, target:9f7731a8...}` |
| 7b0fa2c2... "Agent harness..." | 4 (CLOSED) | 12 (COMPLETED) | YES: `{type:2, target:9f7731a8...}` |
| d04b594d... "Exercise HTTP..." | 1 (OPEN) | 3 (READY) | YES: `{type:2, target:9f7731a8...}` |

**Key observation:** All three blocked tasks correctly have `type: 2` (BLOCKED_BY) relationships pointing back to the selected task. The single-edge-with-perspective model is working correctly. The data is structurally identical to natively-created relationships.

### Structural Comparison: Beads-Imported vs Native

The Beads importer stores: `{source_task_id: blocker, target_task_id: blocked, type: "blocks"}`

The native `UpdateTask(A, {addBlocks: [B]})` stores: `{source_task_id: A, target_task_id: B, type: "blocks"}`

These are **identical formats**. The `taskToProto()` function in `convert.go:280-295` correctly synthesizes both perspectives:
- Source task sees: `{type: BLOCKS, targetTaskId: blocked_task}`
- Target task sees: `{type: BLOCKED_BY, targetTaskId: blocker_task}` (via `invertRelationshipType`)

No structural difference exists between Beads-imported and natively-created relationships.

---

## Root Cause Analysis

### The Dependency View Excludes CLOSED Tasks Unconditionally

**File:** `web/src/components/dependency/ft-dependency-view.ts`

**`getVisibleTasks()` (line 624-673):**
```typescript
for (const task of this.store.allTasks) {
  if (task.phase === TaskPhase.CLOSED) continue;  // ← SKIPS CLOSED TASKS
  // ... checks for BLOCKS/BLOCKED_BY relationships ...
}
```

The selected task (9f7731a8) has `phase: 4` (CLOSED). It is skipped in this loop. Its 3 BLOCKS relationships are never examined. Neither the selected task nor its blocked targets are added to `involvedIds`.

**`getDirectedReachableIds()` (line 100-138) — Solo mode BFS:**
```typescript
const bfs = (startId: string, relType: RelationshipType) => {
  // ...
  if (!taskSet.has(id)) continue;                    // ← Not in involvedIds
  if (!task || task.phase === TaskPhase.CLOSED) continue;  // ← Skips CLOSED
  // ...
};
```

Even if `taskSet` didn't filter it out, the BFS explicitly skips CLOSED tasks. The BFS starting from the selected task immediately terminates without traversing any relationships.

**Result chain:**
1. Selected task is CLOSED → skipped in `getVisibleTasks()` loop
2. Its BLOCKS relationships never populate `involvedIds`
3. Solo mode BFS can't start from a CLOSED task → returns empty set
4. `tasks.filter()` returns empty array
5. `layoutNodes.length === 0`
6. Render shows: "No dependency relationships"

### Why Tree View / Inspector Shows Them Correctly

**Tree View (`ft-tree-view.ts`):** Shows ALL tasks in the collection hierarchy regardless of phase. CLOSED tasks are visible and selectable.

**Inspector (`ft-inspector-relationships.ts`):** Iterates `task.relationships` directly with no phase filtering:
```typescript
for (const r of task.relationships) {
  const target = this.store.getTask(r.targetTaskId);
  if (!target) continue;
  // Groups by type — no phase filter
}
```

The inspector shows all relationship types (BLOCKS, BLOCKED_BY, RELATED, DUPLICATE) for any selected task, CLOSED or not.

### Why This Surfaces with Beads Imports

The Beads import is a red herring for the data model but a real trigger for the UX bug. Beads imports bring in entire project histories including completed/closed tasks with established blocking chains. Users naturally explore these imported tasks in the tree view, see their relationships in the inspector, and expect the dependency view to show the same information. With natively-created farmtable tasks, users rarely select a closed task and try to solo it in dependency view.

---

## Beads Importer Code Verification

**File:** `internal/server/beads_import.go` (lines 333-367)

The importer correctly maps Beads dependency semantics to farmtable:

```go
case "blocks":
    // In beads: dep.DependsOnID blocks dep.IssueID.
    // In farmtable: source blocks target.
    relType = relationship.TypeBlocks
    // Swap: source = blocker (DependsOnID), target = blocked (IssueID)
    sourceUUID, targetUUID = targetUUID, sourceUUID
```

**Beads semantics verified** (from `beads/internal/storage/issueops/blocked.go` and `dependency_queries.go`):
- `{IssueID: A, DependsOnID: B, Type: "blocks"}` means "B blocks A" (B is the blocker)
- The `loadBlockingDepsForIssueIDsInTx` function queries `WHERE issue_id = ? AND type = 'blocks'` and treats `depends_on_id` values as the blockers

The farmtable importer's swap correctly maps this to `{source: B, target: A, type: "blocks"}` (B blocks A in farmtable's "source blocks target" model).

**Note:** The Beads test suite has a misleading comment — `// A blocks B` paired with `{IssueID: "cy-a", DependsOnID: "cy-b", Type: DepBlocks}` — which actually means "cy-b blocks cy-a". The farmtable importer's comment is correct; the Beads test comment is wrong. This doesn't affect functionality.

---

## Recommended Fix

### Location: `web/src/components/dependency/ft-dependency-view.ts`

### Approach: Allow CLOSED selected task in solo mode

When `this.isolateMode && this.selectedTaskId`, the view should make an exception for the selected task and its directly-connected tasks, even if the selected task is CLOSED. This preserves the existing behavior of hiding closed tasks in the full graph view while fixing the solo-mode discrepancy.

**Specific changes:**

1. **`getVisibleTasks()` (~line 630):** After the main loop that builds `involvedIds`, add a solo-mode bypass: if isolate mode is active and the selected task exists but is CLOSED, manually add it and its relationship targets to `involvedIds`.

2. **`getDirectedReachableIds()` (~line 100):** When the starting task is CLOSED and it's the explicitly-selected task (not a traversed node), allow it as the BFS start node. Keep the CLOSED filter for other nodes in the traversal to avoid pulling in unrelated closed tasks.

3. **`computeLayers()` and edge building:** These already handle any task passed to them. If the selected CLOSED task appears in the tasks list, layers and edges will compute correctly because the blocked tasks have `BLOCKED_BY` relationships pointing back.

**Alternative approach (simpler but less surgical):** In solo mode only, remove the CLOSED phase filter entirely from both `getVisibleTasks()` and `getDirectedReachableIds()`. This would show all connected tasks regardless of phase when solo is active. This is simpler to implement but may show more closed nodes than the user expects in the graph.

**Estimated effort:** Small (< 1 hour). The changes are well-scoped to the solo-mode code path in one file.

---

## Files Referenced

| File | Lines | Role |
|------|-------|------|
| `web/src/components/dependency/ft-dependency-view.ts` | 624-673, 100-138 | **BUG LOCATION** — CLOSED filter in getVisibleTasks + BFS |
| `web/src/components/inspector/ft-inspector-relationships.ts` | 201-252 | Inspector render — no phase filter (shows correctly) |
| `internal/server/convert.go` | 280-295, 371-384 | taskToProto + invertRelationshipType (correct) |
| `internal/server/beads_import.go` | 333-367 | Beads importer relationship mapping (correct) |
| `internal/store/ent/relationship/relationship.go` | 73-79 | Ent relationship type enum |
| `internal/store/entstore.go` | 380-393, 489 | Task loading with relationship edge eager-loading |
| `web/src/gen/types.ts` | 53-59 | Client RelationshipType enum |
| `web/src/components/inspector/inspector-stage-utils.ts` | 41-46 | REL_GROUP_ORDER for inspector display |
