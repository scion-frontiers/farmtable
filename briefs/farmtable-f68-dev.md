# Brief: Feature 68 — Kanban View Auto-Scroll During Drag-Near-Edge

## Critical Constraints (read first)
- Dedicated git worktree: `git worktree add /workspace/farmtable-f68-dev -b feature-68-kanban-autoscroll origin/main`
- No existing auto-scroll-on-drag pattern exists anywhere in this codebase (checked
  Kanban, Tree, and Dependency views) — you're implementing a new, standard UX pattern,
  not adapting an existing one. Keep the implementation simple and use standard technique
  (see Task section below) rather than pulling in a new dependency/library for this.

## User Request (verbatim, from ptone@google.com)
"in the kanban view - when columns are not visible off screen, dragging an item to the
edge of the visible area does not scroll the view over"

## Key Locations (from codebase scouting)
1. **Scroll container**: `web/src/components/kanban/ft-kanban-view.ts` — `.board`
   container (~lines 60-65): `display: flex; gap: 0.75rem; overflow: auto;` — this is
   what needs to auto-scroll horizontally. There's also a second scrollable region,
   `.on-hold-columns` (~lines 92-97), also `overflow: auto` — check whether it needs the
   same treatment (likely yes, for consistency, if it can also have more columns than fit).
2. **Existing drag handlers** (native HTML5 DnD API, no library):
   - `ft-task-card.ts`: `onDragStart` (~line 185), `onDragEnd` (~line 195)
   - `ft-kanban-column.ts`: `onDragEnter` (~191), `onDragOver` (~197), `onDragLeave`
     (~203), `onDrop` (~209) — dispatches a `stage-change` CustomEvent up to the parent
     view on drop.

## Task
1. Implement edge-proximity auto-scroll on the Kanban board's horizontal scroll
   container (`.board`, and likely `.on-hold-columns` too for consistency) using the
   standard technique:
   - Listen for `dragover` on the scroll container (or a document-level listener while a
     drag is active, tracked via `dragstart`/`dragend` on cards).
   - On each `dragover`, compute the pointer's X position relative to the container's
     bounding rect. If within an edge threshold (e.g. 40-60px) of the left or right edge,
     start scrolling in that direction; if outside the threshold, stop.
   - Use `requestAnimationFrame` (not `setInterval`) for the scroll loop so it's smooth
     and automatically pauses when the tab isn't visible. Scroll speed can scale with how
     close the pointer is to the edge (closer = faster), or a fixed reasonable speed is
     fine — use your judgment, this doesn't need to be fancy.
   - Stop the auto-scroll loop on `dragend`/`drop`/`dragleave` from the container (don't
     leave it running after the drag ends).
2. Verify manually with a collection that has enough columns to overflow horizontally
   (check phase/column count — may need to add columns or find/create a collection with
   many phases). Confirm:
   - Dragging a card near the right edge scrolls the board right, revealing more columns.
   - Dragging near the left edge scrolls left.
   - Scrolling stops when the drag moves away from the edge or ends.
   - Dropping a card still works correctly (stage-change event still fires, no
     regression to the drop behavior itself).
3. Regression check: normal (non-edge) drag-and-drop between visible columns still works
   exactly as before.
4. Run `npx tsc --noEmit`.

## Deliverables
1. A PR against `main`.
2. Evidence of the auto-scroll working — screen recording is ideal if you have that
   capability, otherwise a sequence of screenshots showing the board position shifting
   during a drag near the edge, saved to
   `/scion-volumes/scratchpad/projects/farmtable/reports/f68-autoscroll-evidence/`.
3. A message to the coordinator with the PR link and what you verified.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for questions or completion.
- Do not contact ptone@google.com directly.

## Termination
You MUST implement edge-proximity auto-scroll for the Kanban board during drag, verify it
works with real evidence (a collection with enough columns to overflow), confirm normal
drag-and-drop still works, open the PR, and message the coordinator with the PR link.
Then signal task_completed.
