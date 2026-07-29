# Feature 43: Tree View Shows Parent-Child Only

## Status: MERGED

## Branch: `feat/f43-tree-parent-child-only`

## Spec Summary
Remove rendering of all non-parent-child relationship lines from the Tree view.
The Tree view should show ONLY the top-down parent-child hierarchy. No additional
edges for blocked-by/blocking or other relationship types (BLOCKS, BLOCKED_BY, RELATED, DUPLICATE).

## Analysis

### Current State (ft-tree-view.ts)
The `runLayout()` method in `ft-tree-view.ts` currently creates TWO types of edges in the dagre graph:

1. **Hierarchy edges** (lines 336-338): Parent-child via `task.parentTaskId` - KEEP
2. **Dependency edges** (lines 339-343): `task.relationships` where `rel.type === RelationshipType.BLOCKS` - REMOVE

The CSS has two edge styles:
- `.edge-hierarchy` — solid neutral-colored lines (KEEP)
- `.edge-dependency` — dashed primary-colored lines (REMOVE)

The `LayoutEdge` interface has `type: 'hierarchy' | 'dependency'` — can simplify.

### Changes Required
1. Remove dependency edge creation in `runLayout()` (lines 339-343)
2. Remove `.edge-dependency` CSS class
3. Clean up `RelationshipType` import (no longer used in this file)
4. Simplify `structureKey()` to not include relationship data
5. Clean up `LayoutEdge` interface (remove 'dependency' type)

### Preservation Check
- Feature 41's animated centering (750ms ease-in-out pan) is in the same file but independent of edge types — NO RISK of regression.

## Implementation Log

### Changes Made (2026-07-22)

**File:** `web/src/components/tree/ft-tree-view.ts`
**Net change:** 4 insertions, 19 deletions

1. **Removed `RelationshipType` import** — deleted `import { RelationshipType } from '../../gen/types.js';`, kept `Task` type import
2. **Simplified `LayoutEdge` interface** — changed `type: 'hierarchy' | 'dependency'` to `type: 'hierarchy'`
3. **Removed `.edge-dependency` CSS class** — deleted dashed indigo line styling (`stroke-dasharray: 6 3`)
4. **Simplified `structureKey()` method** — removed relationship data from cache key, now only uses `id` and `parentTaskId`
5. **Removed dependency edge creation in `runLayout()`** — deleted `for (const rel of task.relationships) { ... BLOCKS ... }` loop
6. **Simplified edge type assignment** — changed conditional `name === 'd' ? 'dependency' : 'hierarchy'` to `'hierarchy' as const`
7. **Simplified render template** — changed conditional class to static `"edge-hierarchy"`

### What Was Preserved
- **Feature 41 (animated centering)** — All animation code untouched: `centerOnNode()`, `animatePanTo()`, `easeInOut()`, `PAN_DURATION_MS` (750ms), `cancelPanAnimation()`, `animationFrameId`
- All pan/zoom, drag-and-drop, collapse/expand, and hierarchy navigation
- Parent-child hierarchy edges (solid gray lines)

### Build Verification
- Web frontend builds clean (bundle reduced from 761.19 kB to 760.77 kB — 420 bytes smaller)
- Go binary builds clean
- Dashboard serves and renders tree view correctly

### Screenshot Analysis (Round 2 — with real BLOCKS relationship data)

Test data created: "Platform Launch" epic with 3 children ("Build API Backend", "Design Dashboard UI", "Write Integration Tests"). BLOCKS relationships added: "Build API Backend" BLOCKS "Design Dashboard UI" and "Build API Backend" BLOCKS "Write Integration Tests".

**Before (`before-tree.png`) — built from `origin/main` (pre-fix code):**
- Tree view with "Platform Launch" parent and 3 children
- Solid gray hierarchy lines connecting parent to children (KEPT)
- **Dashed cyan/blue BLOCKS dependency lines** clearly visible from "Build API Backend" down to "Design Dashboard UI" and "Write Integration Tests"
- Layout is distorted by dagre accommodating the extra dependency edges (children are not evenly spaced)

**After (`after-tree.png`) — built from `feat/f43-tree-parent-child-only` (fix applied):**
- Same tasks with same BLOCKS relationships in the database
- ONLY solid gray parent→child hierarchy lines remain
- **Dashed dependency lines are completely gone**
- Clean, evenly-spaced tree layout with all 3 children in a single row
- Demonstrates the fix genuinely removes dependency edge rendering while preserving hierarchy

### Commit
```
3542914 feat(web): show only parent-child edges in tree view
```

- [x] Code changes committed on branch
- [x] Before screenshot at `feature-43-tree-parent-child-only/before-tree.png`
- [x] After screenshot at `feature-43-tree-parent-child-only/after-tree.png`
- [x] Code review — APPROVE (round 1, no critical/important findings, 3 minor suggestions all "no action required")
- [x] PR #115 MERGED — https://github.com/scion-frontiers/farmtable/pull/115 (commit b2a8123 on main)
