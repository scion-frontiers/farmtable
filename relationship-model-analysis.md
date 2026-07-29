# Relationship Data Model Analysis: Single Edge vs Duplicated Entities

**Date:** 2026-07-22  
**Investigator:** Scion investigator (relationship-model workstream)  
**Question from:** ptone@google.com  

---

## Summary

**The current data model is already a single-edge model** — each relationship is stored as exactly ONE row in the `relationships` table. The reciprocal view (e.g., "Blocked by" from the target task's perspective) is synthesized at read time by querying both directions and inverting the relationship type. This is precisely the graph-edge-with-perspective model ptone@google.com described.

However, there is a **minor design wart**: the schema's `type` enum includes both directional forms (`blocks` + `blocked_by`, `duplicates` + `duplicated_by`), meaning the SAME conceptual relationship can be stored in two different representations depending on which API call created it. In practice this doesn't cause bugs today because all current UI codepaths consistently use `addBlocks` (creating `type=blocks` rows), but it's a latent source of confusion and fragility. A clean single-edge model would normalize to one canonical form per relationship pair.

**The Feature 49 bug (reciprocal not displaying immediately) is entirely a frontend caching/event-sync issue, not a data model problem.**

---

## How the Data Model Works Today

### Storage: One Row Per Relationship

**Schema:** `internal/store/schema/relationship.go`

The `relationships` table has four columns:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `source_task_id` | UUID | FK → tasks |
| `target_task_id` | UUID | FK → tasks |
| `type` | Enum | `blocks`, `blocked_by`, `relates_to`, `duplicates`, `duplicated_by` |

Unique index: `(source_task_id, target_task_id, type)`

### Write Path: One Row Created

**File:** `internal/store/entstore.go`

When `UpdateTask(taskA, {addBlocks: [taskB]})` is called (line 653-673):
```
→ Creates ONE row: (source=A, target=B, type=blocks)
→ Does NOT create a reciprocal (source=B, target=A, type=blocked_by) row
```

When `UpdateTask(taskA, {addBlockedBy: [taskB]})` is called (line 674-694):
```
→ Creates ONE row: (source=A, target=B, type=blocked_by)
→ Does NOT create a reciprocal row
```

The `CreateTask` path (lines 160-201) follows the same pattern — one row per relationship.

### Read Path: Perspective-Dependent Synthesis

**File:** `internal/server/convert.go:280-295`

`taskToProto()` loads both edge directions and synthesizes the reciprocal:

```go
// Lines 280-286: SourceRelationships (where this task is the source)
// → Rendered as-is (e.g., type=BLOCKS, target=B)

// Lines 288-294: TargetRelationships (where this task is the target)
// → Type is INVERTED via invertRelationshipType()
// → The OTHER task's ID (source) becomes the "target" in the proto
```

**Example walkthrough:**

One DB row: `(source=A, target=B, type=blocks)`

- **From A's perspective:** Loaded as a `SourceRelationship` → rendered as `{type: BLOCKS, targetTaskId: B}` ✅
- **From B's perspective:** Loaded as a `TargetRelationship` → inverted to `{type: BLOCKED_BY, targetTaskId: A}` ✅

This is exactly the single-edge-with-perspective model. One edge, two views.

### Graph Queries: Also Handle Both Directions

The graph query functions (`GetReadyTasks`, `GetBlockedTasks`, `GetDependencyTree`) all correctly handle both directions:

**`GetReadyTasks`** (entstore.go:1923-1954) — checks for unresolved blockers:
1. `SourceRelationships` where `type=blocked_by` → "I declared I'm blocked by X"
2. `TargetRelationships` where `type=blocks` → "X declared it blocks me"

**`buildDependencyNode`** (server.go:1390-1438) — tree traversal:
- DOWN: follows `source.blocks` targets + `target.blocked_by` sources
- UP: follows `source.blocked_by` targets + `target.blocks` sources

Both directions are checked to catch the relationship regardless of which form it was stored in.

---

## The Design Wart: Dual Enum Values

The schema allows storing the SAME conceptual relationship in two different representations:

| API Call | Stored Row | Semantic Meaning |
|----------|-----------|------------------|
| `UpdateTask(A, {addBlocks: [B]})` | `(src=A, tgt=B, type=blocks)` | A blocks B |
| `UpdateTask(B, {addBlockedBy: [A]})` | `(src=B, tgt=A, type=blocked_by)` | A blocks B |

These are semantically identical ("A blocks B") but stored differently. The read path and graph queries handle both forms correctly, but:

1. **The unique index wouldn't prevent both from existing.** `(A, B, blocks)` and `(B, A, blocked_by)` are different tuples, so the system could end up with TWO rows representing one relationship. In practice this doesn't happen because the UI consistently uses `addBlocks`.

2. **`RemoveRelationships` only cleans one direction.** (entstore.go:695-705) It deletes where `source_task_id = self AND target_task_id = target`. If both forms existed, removing from one task wouldn't clean up the other.

3. **The proto enum also has both.** `farmtable.proto:83-89` defines `RELATIONSHIP_TYPE_BLOCKS` (1) and `RELATIONSHIP_TYPE_BLOCKED_BY` (2) as separate enum values.

---

## Answer to ptone's Question

> "My understanding is that in a graph structure, it's a single edge that connects two nodes, and the relationship type depends on the perspective of which node you're looking at. We shouldn't need to create a fully reciprocal relationship entity in the data model."

**You're correct, and the current implementation already follows this model.** Each `addBlocks` call from the UI creates exactly one DB row. When task B queries its relationships, `convert.go` reads that single row (as a `TargetRelationship`) and inverts the type to present `BLOCKED_BY` from B's perspective. No duplicate entity is created.

The Feature 49 bug is purely a **frontend caching issue**: the optimistic update and the WatchTasks event stream only update the source task's in-memory state, not the target task's. The data model and backend read path are correct — it's just that the frontend doesn't immediately re-derive B's view from the server.

---

## What a Cleaner Model Would Look Like (Optional Improvement)

**Current state:** The system works correctly but stores directional relationship types on both sides of the enum (`blocks`/`blocked_by`, `duplicates`/`duplicated_by`), creating ambiguity about which form to use.

**Clean model:**

1. **Schema change:** Remove `blocked_by` and `duplicated_by` from the `type` enum. Keep only canonical/forward forms: `blocks`, `relates_to`, `duplicates`.

2. **Write-path change:** The `addBlockedBy` API field would translate to creating a `blocks` row with swapped source/target:
   - `UpdateTask(B, {addBlockedBy: [A]})` → stores `(source=A, target=B, type=blocks)` instead of `(source=B, target=A, type=blocked_by)`

3. **Read-path simplification:** `taskToProto()` already handles inversion correctly and wouldn't need significant changes. The graph queries would simplify slightly since they'd only need to check one type per direction instead of two.

4. **Migration:** A one-time data migration to convert any existing `blocked_by` rows to canonical `blocks` rows with swapped source/target. Given the system is young and relationships were just introduced (Feature 46, July 22), this should be a tiny migration.

**Effort estimate:** Small (a few hours). The changes are well-scoped:
- `schema/relationship.go`: Remove enum values
- `entstore.go`: Modify `AddBlockedBy` to swap source/target and use `blocks` type
- `server.go` graph queries: Simplify direction checks
- One-time migration script
- Regenerate Ent code

**Risk:** Low. The system is new and the relationship feature was just introduced. No external integrations depend on the stored `blocked_by` type.

**Recommendation:** This is a nice cleanup but NOT urgent. The current model is functionally correct. If you're going to do it, do it now while the system is young and before more code accumulates assumptions about the dual-form storage.

---

## Files Referenced

| File | Lines | Role |
|------|-------|------|
| `internal/store/schema/relationship.go` | 1-47 | Ent schema: `type` enum with `blocks`+`blocked_by` |
| `internal/store/schema/task.go` | 60-77 | Task edges: `source_relationships`, `target_relationships` |
| `internal/store/entstore.go` | 160-201 | CreateTask write path (one row) |
| `internal/store/entstore.go` | 653-705 | UpdateTask write path (one row) + RemoveRelationships |
| `internal/store/entstore.go` | 1920-1955 | GetReadyTasks: checks both directions |
| `internal/store/entstore.go` | 2004-2035 | GetBlockedTasks: checks both directions |
| `internal/server/convert.go` | 280-295 | `taskToProto`: perspective-dependent synthesis |
| `internal/server/convert.go` | 371-384 | `invertRelationshipType` |
| `internal/server/server.go` | 1375-1438 | `buildDependencyNode`: tree traversal both directions |
| `internal/store/ent/migrate/schema.go` | — | Generated: confirms DB table structure |
| `proto/farmtable.proto` | 83-89 | Proto enum with both BLOCKS and BLOCKED_BY |

---

## Open Questions

1. **Are there any `blocked_by`-typed rows in the production DB?** If the UI always uses `addBlocks`, there may be zero `blocked_by` rows, making the cleanup migration trivial. Worth checking with `SELECT type, count(*) FROM relationships GROUP BY type`.

2. **Should the proto API keep `BLOCKED_BY` as a value?** Even if removed from storage, the proto enum could retain `BLOCKED_BY` as a display-only value that the server synthesizes on read. Or it could be removed from the proto too, with the frontend deriving "blocked by" labels from the perspective (am I the source or target of a `BLOCKS` relationship?). The former is simpler for frontend consumers.
