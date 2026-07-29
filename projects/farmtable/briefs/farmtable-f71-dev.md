# Brief: Feature 71 — Minimap Viewport-Frame Drag Sensitivity Dampening

## Critical Constraints (read first)
- Dedicated git worktree: `git worktree add /workspace/farmtable-f71-dev -b feature-71-minimap-damping origin/main`
- Do NOT change how the minimap frame is drawn/sized, or how clicking-to-jump (if that
  exists separately from dragging) works — this is scoped ONLY to the drag sensitivity.
- Don't add a new dependency or config system for this — a simple named constant is
  sufficient, matching the codebase's existing style (see `PAN_DURATION_MS` in
  `ft-dependency-view.ts` for a similar plain-constant pattern).

## User Request (verbatim, from ptone@google.com)
"we want To adjust the behavior in the way. The mouse click and drag of the frame in the
minimap works because it is extremely sensitive and Twitchy. We want to add some sort of
gear down ratio, so that The movement of the mouse is translated into finer movements of
the frame."

## Root Cause (verified via code scouting)
File: `web/src/components/minimap/ft-minimap.ts`
- `onFrameMouseDown()` (~lines 221-234): captures drag start state (graph coords +
  current panX/panY).
- `onMouseMove()` (~lines 236-256): computes drag delta in **unscaled graph-coordinate
  space**:
  ```
  dgx = graphCoords.gx - this.dragStartGraphX
  dgy = graphCoords.gy - this.dragStartGraphY
  newPanX = this.dragStartPanX + dgx
  newPanY = this.dragStartPanY + dgy
  ```
- `mouseToGraph()` (~lines 202-217) converts CSS pixel movement into graph-space
  coordinates using the minimap's SVG viewBox, which spans the FULL graph's bounding box
  crammed into a small 180×180px container (minus 8px padding, `fitScale` at ~line 347).

**Why it's twitchy:** the minimap maps mouse pixels to graph-space 1:1 through the
viewBox scale, so on a large graph, 1px of mouse movement in the minimap corresponds to
many pixels of actual pan movement in the main view (amplification = graph_size /
minimap_size, which can be a large ratio for big collections).

## Task
1. Add a named damping constant (e.g. `const DRAG_DAMPING = 0.35;` — pick a value that
   genuinely feels controllable; ptone described the current behavior as "extremely"
   sensitive, so don't be shy about dampening it meaningfully. Make it easy to find/tune
   as a single named constant, not a magic number inline).
2. Apply the damping factor to the graph-space delta BEFORE adding it to the drag-start
   pan position:
   ```
   newPanX = this.dragStartPanX + dgx * DRAG_DAMPING
   newPanY = this.dragStartPanY + dgy * DRAG_DAMPING
   ```
3. Verify this doesn't break anything else that depends on `onMouseMove`'s pan
   calculation (check if there's a separate click-to-jump-to-position behavior on the
   minimap background, distinct from frame dragging — if so, confirm it's unaffected,
   since a "jump to where I clicked" interaction should probably stay 1:1, only the DRAG
   should be dampened).
4. Verify manually: drag the minimap frame around on a collection with enough
   spread/nodes to make the twitchiness noticeable pre-fix, confirm the frame now moves
   proportionally less than the mouse and feels controllable. Compare mouse-movement
   distance vs resulting pan distance with real measurements if you can instrument it
   (e.g. log panX before/after a fixed simulated mouse delta), not just a visual
   impression.
5. Run `npx tsc --noEmit`.

## Deliverables
1. A PR against `main`.
2. Evidence — ideally a real before/after measurement (fixed mouse delta -> resulting
   pan delta, showing the ratio actually decreased by the damping factor), plus
   screenshots, saved to
   `/scion-volumes/scratchpad/projects/farmtable/reports/f71-minimap-damping-evidence/`.
3. A message to the coordinator with the PR link, the chosen damping value and reasoning,
   and what you verified.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for questions or completion.
- Do not contact ptone@google.com directly.

## Termination
You MUST add the damping factor to the minimap frame-drag calculation only (not other
minimap interactions), verify with real measurements that sensitivity actually decreased,
open the PR, and message the coordinator with the PR link. Then signal task_completed.
