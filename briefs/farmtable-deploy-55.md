# Brief: Deploy latest `main` to Cloud Run (deploy-55) — Minimap Drag Damping

## Critical Constraints (read first)
- Dedicated git worktree: `git worktree add /workspace/farmtable-deploy-55 -b deploy-55-snapshot origin/main`
- Check `scion list` yourself before starting — stop and message the coordinator if
  another `farmtable-deploy-*` agent is already running.
- Do not merge/modify any code. Build+deploy+verify only.

## Context
Last deploy was deploy-54, revision `farmtable-00061-hpj` (commit `0697a71`). Since then,
PR #163 merged to `main` (merge commit `5c0e5cf281b261f50dc5e7499bc3a4f0a2bfdd30`) —
Feature 71: the minimap's viewport-frame drag was "extremely sensitive and twitchy"
because mouse movement was mapped 1:1 into graph-space pan, which gets amplified by
however much bigger the graph is than the small 180px minimap. Added a
`MINIMAP_DRAG_DAMPING = 0.35` constant, reducing sensitivity by ~65%. Only the drag
interaction is dampened — clicking the minimap background to jump to a position is a
separate, unaffected code path.

## Task
1. Confirm what's new: `git log --oneline origin/main` since `0697a71`.
2. Build and deploy to the `farmtable` Cloud Run service, project `deploy-demo-test`,
   region `us-central1`.
3. Verify live and serving 100% traffic.
4. **Verify the fix on the live instance**:
   a. Open a Tree View with a large-enough/spread-out collection to make the minimap
      meaningful. Drag the viewport frame — confirm it moves noticeably less than the
      mouse cursor now (a small drag produces a small, controllable frame movement,
      not a huge jump). If you can instrument this (e.g. simulate a fixed mouse delta
      and measure the resulting pan change), do so for a real measurement rather than
      just visual impression.
   b. Click on the minimap background (not the frame itself) to jump to a position —
      confirm this still works normally (1:1, unaffected by the damping).
5. Regression check: other recent features (Kanban auto-scroll, Dependency View fixes,
   Feature 67 layout toggle, Inspector external link, favicon) still work — quick spot
   checks, not exhaustive.
6. Report every check's pass/fail explicitly.

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified.
2. Explicit pass/fail evidence with real screenshots/measurements, saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-25-deploy-55/`
3. A deploy log at `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-25-deploy-55.md`.
4. A message to the coordinator with revision ID, commit SHA, and pass/fail per check.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` if anything looks broken.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify the minimap drag damping live with real evidence, confirm
click-to-jump is unaffected, confirm no regressions, produce the log, and message the
coordinator with a clear per-check pass/fail. Then signal task_completed.
