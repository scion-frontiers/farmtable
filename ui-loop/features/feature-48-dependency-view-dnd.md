# Feature 48 — Drag-and-Drop Relationship Building in Dependency View

**Status:** Complete
**Branch:** `feat/f48-dependency-view-dnd`
**PR:** #124 (https://github.com/scion-frontiers/farmtable/pull/124)
**Date:** 2026-07-22

## Summary

Added drag-and-drop support to the Dependency Tree view (Feature 44) so users can create BLOCKED_BY relationships by dragging one task node onto another. The dragged task becomes blocked-by the drop target.

## Design Decisions

### Reuse of Feature 46 Backend Path
Rather than writing new relationship-creation logic, the drop handler dispatches a `dependency-drop` CustomEvent that ft-app.ts catches and routes through the existing `applyTaskUpdate(sourceTaskId, { addBlockedBy: [targetTaskId] })` path from Feature 46. This reuses optimistic update, server call, rollback-on-error, and error toast — zero duplicate code.

### DnD Event Architecture
The foreignObject elements in the SVG DAG serve as both drag sources and drop targets. The drag events are wired on the foreignObject, but the actual HTML5 drag initiation comes from the inner `ft-tree-node` component (which has its own `draggable="true"` div). The dependency view's `onNodeDragStart` overrides `effectAllowed` to `'link'` (vs ft-tree-node's `'move'` for reparenting) and sets the `application/ft-task-id` data key. A documentation comment explains this dual-handler coupling.

### Drag-Enter Counter Pattern
Adopted the same counter pattern used by ft-kanban-column.ts to prevent flicker when dragenter/dragleave fire for child elements. A `Map<string, number>` tracks enter/leave counts per node, only clearing `dragOverNodeId` when the counter reaches zero.

### Visual Feedback
- **Drop target highlight**: SVG `<rect>` with dashed indigo border (`var(--sl-color-primary-400)`) and translucent blue fill (`rgba(59, 130, 246, 0.08)`), rendered behind the foreignObject. Uses `pointer-events: none` to avoid intercepting drag events.
- **Source dim**: Dragged node fades to 40% opacity via inline style.
- **Transition**: CSS `transition: opacity 0.15s` on foreignObject for smooth visual changes.

### Edge Case Handling

| Edge Case | Handling |
|-----------|----------|
| **Self-drop** (drag onto itself) | Identity check: `sourceTaskId === targetTaskId` → return (no-op) |
| **Already exists** (relationship already present) | Array scan of source task's relationships for matching BLOCKED_BY → return (no-op) |
| **Cycle detection** (would create circular dependency) | DFS from source through BLOCKS relationships. If target is reachable, the drop is rejected with a warning toast |

Guards are ordered cheapest-to-most-expensive: identity check → array scan → DFS traversal.

### Cycle Detection Algorithm
- DFS from the source task following BLOCKS relationships
- If the target task is reachable, adding "source BLOCKED_BY target" would create: target → source → ... → target (cycle)
- Uses a visited Set to handle existing cycles in the data without infinite loops
- Consistent with the existing MAX_LAYER_DEPTH cycle protection in computeLayers()

### Toast Pattern
The cycle warning toast uses `sl-alert` with `variant='warning'`, `closable=true`, `duration=5000`, matching the existing `showWriteError()` pattern from Phase 3 of the write-through project. Warning variant (vs danger for errors) appropriately distinguishes user-preventable mistakes from system errors.

## Files Changed

| File | Change |
|------|--------|
| `web/src/components/dependency/ft-dependency-view.ts` | +175 lines: DnD handlers, state properties, cycle detection, visual feedback, toast |
| `web/src/components/ft-app.ts` | +16 lines: `dependency-drop` event handler, readOnly prop pass-through |

## Evidence

Screenshots saved to: `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-48-dependency-view-dnd/`

| File | Description |
|------|-------------|
| `00-kanban-view.png` | Kanban view before switching |
| `01-dependency-view-initial.png` | Dependency DAG with Task 1 → Task 3 blocking relationship |
| `02-before-drag.png` | Before drag-and-drop |
| `03-after-drag-drop.png` | After drag: Task 2 → Task 1 → Task 3 chain (3-layer DAG) |
| `05-self-drop-noop.png` | Self-drop test (no new relationships) |
| `06-cycle-detection-toast.png` | Warning toast: "Cannot add dependency: would create a circular dependency" |
| `07-dnd-task2-onto-task1.png` | Successful DnD with re-layered graph |
| `08-post-review-fix-verification.png` | Re-verification after MIME key standardization |

## Code Review

- **Round 1**: APPROVE — 4 low-severity findings, all addressed:
  1. ✅ Added documentation comment about dual dragstart coupling with ft-tree-node
  2. ✅ Removed inert `draggable` attribute from SVG foreignObject
  3. ✅ Standardized DnD data transfer key to `application/ft-task-id` MIME format
  4. ✅ Noted that graph re-render provides sufficient success feedback (no additional toast needed)

## Verification

- [x] TypeScript compiles (`tsc --noEmit` via `npm run build`)
- [x] Vite build succeeds
- [x] Go binary builds (`go build -o ft ./cmd/ft`)
- [x] Drag-and-drop creates BLOCKED_BY relationship (Playwright HTML5 DnD events + CLI verification)
- [x] Self-drop is a no-op (relationship count unchanged)
- [x] Cycle detection rejects and shows warning toast
- [x] Duplicate relationship detected as no-op
- [x] View re-layers correctly after new relationship (3-layer chain visible)
- [x] Re-verified after review fix (MIME key change) — DnD still works
