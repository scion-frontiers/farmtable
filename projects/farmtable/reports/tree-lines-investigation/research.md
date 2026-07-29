# Investigation: Extra Lines in the Tree View

## Summary

The non-parent-child lines drawn in the Tree view are **BLOCKS dependency relationships**. The tree view's `runLayout()` method iterates every visible task's `relationships` array and draws a dashed edge for each relationship of type `RelationshipType.BLOCKS`. These are the blocking/blocked-by relationships introduced in Feature 25's Relationships tab. Only `BLOCKS` edges are drawn — `BLOCKED_BY`, `RELATED`, and `DUPLICATE` relationship types are not rendered as lines.

## Root Cause / Code Surface

**File:** `web/src/components/tree/ft-tree-view.ts`

The `runLayout()` method (lines 310–371) builds a dagre directed graph with two kinds of edges:

1. **Hierarchy edges** (lines 335–338) — parent-child via `task.parentTaskId`:
   ```typescript
   if (task.parentTaskId && taskSet.has(task.parentTaskId)) {
     g.setEdge(task.parentTaskId, task.id, { type: 'hierarchy' }, 'h');
   }
   ```
   Rendered as: **solid gray lines** (`stroke: neutral-400`, width 2).

2. **Dependency edges** (lines 339–343) — `BLOCKS` relationships from `task.relationships`:
   ```typescript
   for (const rel of task.relationships) {
     if (rel.type === RelationshipType.BLOCKS && taskSet.has(rel.targetTaskId)) {
       g.setEdge(task.id, rel.targetTaskId, { type: 'dependency' }, 'd');
     }
   }
   ```
   Rendered as: **dashed indigo/primary lines** (`stroke: primary-500`, width 1.5, `stroke-dasharray: 6 3`).

The edge type (`'h'` vs `'d'`) is used as dagre's multigraph edge name to allow both a hierarchy edge and a dependency edge between the same pair of nodes.

## Data Model Cross-Reference

- **Proto** (`proto/farmtable.proto:83–89`): `RelationshipType` enum defines `BLOCKS=1`, `BLOCKED_BY=2`, `RELATED=3`, `DUPLICATE=4`.
- **Generated TS** (`web/src/gen/types.ts:53–59`): Mirrors the proto exactly.
- **Ent schema** (`internal/store/schema/relationship.go`): stores relationships with types `blocks`, `blocked_by`, `relates_to`, `duplicates`, `duplicated_by`.
- **Tree view only filters for `BLOCKS`** — the complementary `BLOCKED_BY` direction and other types (`RELATED`, `DUPLICATE`) are ignored and produce no visual lines.

## Why the Code Drew Them

The dependency edges were included in the dagre layout so the tree view would visually show blocking relationships between tasks. This causes dagre to factor these edges into its layout algorithm (affecting node positioning/ranking), and renders them as dashed lines on the canvas. The intent was to give users a visual indication of which tasks block others, in addition to the parent-child hierarchy.

## Scope

N/A — investigation only. Feature 43 is already removing these lines in a parallel worktree.
