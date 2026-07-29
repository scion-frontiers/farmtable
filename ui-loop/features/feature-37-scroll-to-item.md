# Feature 37: Scroll/Frame-to-Item on Navigation

## Summary

Implemented scroll-to-item behavior when a task is selected via the inspector,
command palette, or any other `task-select` event source. Each view now
automatically brings the selected task into the visible area.

## Changes

### 1. Kanban View — Scroll-to-Card (`ft-kanban-column.ts`)

- Modified `updated()` lifecycle to detect `selectedTaskId` changes.
- Added `scrollToSelectedCard()` which finds the matching card in the column's
  sorted task list and calls `scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })`.
- `scrollIntoView` cascades through scrollable ancestors, handling both the
  vertical scroll within the column's `.cards` container and the horizontal
  scroll within the parent `.board`.

### 2. Ready Queue — Scroll-to-Row (`ft-ready-queue-view.ts`)

- Added `updated()` lifecycle to detect `selectedTaskId` changes.
- Added `scrollToSelectedRow()` which queries the shadow DOM for the
  `.queue-row.selected` element and scrolls it into view.

### 3. Tree View — Center-on-Node (`ft-tree-view.ts`)

- Modified `updated()` to accept `PropertyValues<this>` parameter.
- When `selectedTaskId` changes, `centerOnNode()` is called instead of
  `centerGraph()`, keeping the current zoom level while panning to center the
  selected node.
- `centerOnNode()` mirrors `centerGraph()` logic but targets a single node's
  coordinates to compute `panX`/`panY`.

### 4. Dim Overlay on `.main` (`ft-app.ts`)

- Added `isTaskVisibleInCurrentView()` which checks:
  - Task exists in the store
  - Task passes current phase + assignee filters
  - For ready-queue: task phase is OPEN or IN_PROGRESS
  - Dashboard view always returns false (no individual task display)
- When a selected task is NOT visible, a semi-transparent overlay
  (`rgba(0, 0, 0, 0.5)`) is shown over `.main` with a fade-in animation.
- Overlay auto-dismisses after 2.5 seconds via `setTimeout`.
- Overlay also dismisses on any user interaction (click or keydown), with
  listener registration deferred via `requestAnimationFrame` to prevent the
  triggering event from immediately dismissing.
- Timer and listeners are cleaned up in `disconnectedCallback()`.

## Files Modified

| File | Change |
|------|--------|
| `web/src/components/ft-app.ts` | Dim overlay CSS, state, render, visibility check, show/hide/timer logic |
| `web/src/components/kanban/ft-kanban-column.ts` | `scrollToSelectedCard()`, restructured `updated()` |
| `web/src/components/ready-queue/ft-ready-queue-view.ts` | `scrollToSelectedRow()`, `updated()` |
| `web/src/components/tree/ft-tree-view.ts` | `centerOnNode()`, typed `updated()` |

## Build Verification

- `npm run build` passes (tsc + vite).

## Known Limitations

- Kanban on-hold section: if the on-hold section is collapsed, the task's card
  is not rendered and cannot be scrolled to. The overlay check only considers
  filter visibility, not the collapse state.
- Ready-queue blocked tasks: the overlay check uses a simplified heuristic
  (phase check only), not the full `isReady()` logic from the view. A task
  that is blocked by another open task would pass the overlay check but not
  appear in the ready queue.
