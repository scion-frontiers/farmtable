# Feature 51 — Dependency View Layout Fixes (Layer 0 Alignment + Edge Anchoring)

**Status:** Complete — PR Open
**Branch:** `fix/f51-dependency-view-layout`
**PR:** #128 (https://github.com/scion-frontiers/farmtable/pull/128)
**Worktree:** `/workspace/farmtable-f51`
**Date:** 2026-07-22

## Root Cause Analysis

### Bug 1: Unblocked tasks not left-justified

**Root cause: RENDERING, not layer assignment.**

The `computeLayers()` function correctly assigns layer 0 to all unblocked tasks. However, the layout uses dagre (`@dagrejs/dagre`) which computes its OWN ranking via a simplex algorithm, ignoring the `rank: layer` property set on nodes (dagre doesn't support per-node rank constraints).

Dagre's optimization shifts nodes toward their neighbors to minimize edge lengths. This means unblocked tasks like Ready-03 and Ready-08 (which only have outgoing edges to layer-2 nodes) get placed at dagre-computed rank 1 instead of the correct rank 0.

### Bug 2: Edges anchored to top/bottom instead of left/right

Dagre computes edge paths using node center points as anchors. The `edgePath()` function renders whatever points dagre provides — no right-edge/left-edge anchoring logic exists.

## Fix Approach

Replace dagre-driven layout with manual layout using our own `computeLayers()`:

1. **X positioning**: Group by computed layer, `X = MARGIN + layer * (NODE_WIDTH + LAYER_GAP)`
2. **Y positioning**: Stack nodes vertically within each layer, `Y = MARGIN + index * (NODE_HEIGHT + NODE_GAP)`
3. **Edge paths**: Custom cubic bezier curves from right-center of source to left-center of target
4. Remove dagre import from this component (npm dependency retained for `ft-tree-view.ts`)
5. Promote `nodeMap` to instance field for O(1) edge lookups in render path

Layout constants: `LAYER_GAP=100`, `NODE_GAP=40`, `MARGIN_LEFT=40`, `MARGIN_TOP=40`

## Files Changed

| File | Change |
|------|--------|
| `web/src/components/dependency/ft-dependency-view.ts` | Replace dagre layout with manual layout, fix edge paths, promote nodeMap, remove vestigial points |

## Evidence

Screenshots saved to: `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-51-dependency-view-layout-fixes/`

All screenshots taken against the SAME test data (seed DB + 4 unblocked tasks + 2 mid-layer tasks with multiple blockers + 1 deep task with convergent edges). Before uses the original dagre-based layout; after uses the fixed manual layout.

| File | Description |
|------|-------------|
| `before-original-user-report.png` | User's original screenshot showing both bugs on live data — Ready-03/Ready-08 displaced from layer 0, edges anchored to top/bottom of nodes |
| `before-fix.png` | Before fix (dagre layout): edges route from bottom of source nodes to top of targets, curving UNDER mid-layer task boxes — Bug 2 clearly visible |
| `after-fix.png` | After fix (manual layout): all unblocked tasks left-aligned in column 0, edges emit from right edge → left edge with clean horizontal bezier curves — both bugs fixed |

### Bug 1 evidence (layer-0 alignment)
- **Before** (`before-original-user-report.png`): User's live data shows Ready-03 and Ready-08 displaced to column 1 despite being unblocked — dagre's simplex ranking shifted them rightward to minimize edge length to their blocked targets.
- **After** (`after-fix.png`): ALL unblocked tasks (Test task 1–7, Unblocked-Alpha/Beta/Gamma/Delta) share the same leftmost X position.

### Bug 2 evidence (edge anchoring)
- **Before** (`before-fix.png`): Edges from Unblocked-Alpha/Beta connect from the BOTTOM of those nodes to the TOP of Mid-Layer-1. Edges from Unblocked-Gamma/Delta curve underneath Mid-Layer-1 to reach Mid-Layer-2, crossing under task boxes.
- **After** (`after-fix.png`): All edges emit from the RIGHT edge of source nodes and attach to the LEFT edge of target nodes. Horizontal bezier curves flow cleanly left-to-right. No edges route through or under task boxes.

## Review Rounds

### Round 1 — APPROVE (2 suggestions)
1. **Medium**: O(N) `Array.find()` in render path — promoted `nodeMap` to instance field for O(1)
2. **Low**: Vestigial `LayoutEdge.points` field — removed dead data

### Round 2 — APPROVE (no new issues)
Both Round 1 fixes verified correct. Ready to merge.

## Commits

1. `e3f18ae` — Main fix: replace dagre layout with manual layout, fix edge anchoring
2. `93fec41` — Review fixes: promote nodeMap, remove vestigial points
