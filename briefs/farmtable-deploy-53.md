# Brief: Deploy latest `main` to Cloud Run (deploy-53) — Kanban Auto-Scroll

## Critical Constraints (read first)
- Dedicated git worktree: `git worktree add /workspace/farmtable-deploy-53 -b deploy-53-snapshot origin/main`
- Check `scion list` yourself before starting — stop and message the coordinator if
  another `farmtable-deploy-*` agent is already running.
- Do not merge/modify any code. Build+deploy+verify only.
- Note: verifying this live requires REAL drag simulation in a real browser, which is
  trickier than most recent deploy verifications (native HTML5 DnD via CDP/Puppeteer can
  be finicky). If you can't get a fully automated drag simulation working against the
  live site, it's acceptable to verify via direct JS event dispatch on the board
  container (dispatch synthetic `dragover` events with `clientX` near the edge and read
  `scrollLeft` before/after) rather than a full drag gesture — this still proves the
  feature works in the actual deployed bundle, just via a more targeted test than a full
  drag simulation. Document whichever approach you use.

## Context
Last deploy was deploy-52, revision `farmtable-00059-xc2` (commit `758de9f`). Since then,
PR #160 merged to `main` (merge commit `773fb008b17f42ddf5157b882b1ad423accfd45c`) —
Kanban board now auto-scrolls horizontally when dragging a task card within 50px of the
left/right edge of the `.board` (and `.on-hold-columns`) scroll container, using
`requestAnimationFrame` with speed scaling by proximity to the edge (2-12px/frame).
Auto-scroll stops on drag end, drop, or the pointer moving away from the edge. This was
independently verified by the coordinator via a real measured Puppeteer test harness
(genuine scrollLeft telemetry showing monotonic movement) before merging, and the diff
was read directly and confirmed clean/correct.

## Task
1. Confirm what's new: `git log --oneline origin/main` since `758de9f`.
2. Build and deploy to the `farmtable` Cloud Run service, project `deploy-demo-test`,
   region `us-central1`.
3. Verify live and serving 100% traffic.
4. **Verify the auto-scroll on the live instance**:
   a. Find or use a collection with enough columns to overflow the Kanban board width
      (check the default collection or others — the app has 8 default board columns:
      Triage, Backlog, Ready, Working, In Review, In QA, Deploying, Completed, which
      overflow on most viewport widths).
   b. Simulate dragging a task card near the right edge of the board (via real drag
      gesture if you can get CDP simulation working, or via direct event dispatch per
      the note above) — confirm the board scrolls right, revealing previously off-screen
      columns, and measure `scrollLeft` changing over time.
   c. Do the same for the left edge — confirm it scrolls back left.
   d. Confirm scrolling stops on drop/dragend and when the pointer moves away from the
      edge.
   e. Confirm normal (non-edge) drag-and-drop between visible columns still works,
      including the actual card move (stage-change) — this must not regress.
5. Regression check: other recent features (Dependency View fixes, Feature 67 layout
   toggle) still work normally — quick spot check, not exhaustive re-verification.
6. Report every check's pass/fail explicitly, with real measured data (scrollLeft
   values, not just "it looked right").

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified.
2. Explicit pass/fail evidence with real screenshots AND measured scroll data, saved
   under `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-24-deploy-53/`
3. A deploy log at `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-24-deploy-53.md`.
4. A message to the coordinator with revision ID, commit SHA, and pass/fail per check.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` if anything looks broken or if
  drag simulation proves genuinely infeasible against the live site (explain why, don't
  just skip the check silently).
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify the auto-scroll live with real measured evidence (scrollLeft
data, not just visual impression), confirm no regressions, produce the log, and message
the coordinator with a clear per-check pass/fail. Then signal task_completed.
