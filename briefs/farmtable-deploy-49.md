# Brief: Deploy latest `main` to Cloud Run (deploy-49) — Perf Phase 2 (Viewport Culling)

## Critical Constraints (read first)
- Dedicated git worktree: `git worktree add /workspace/farmtable-deploy-49 -b deploy-49-snapshot origin/main`
- Check `scion list` yourself before starting — stop and message the coordinator if
  another `farmtable-deploy-*` agent is already running.
- Do not merge/modify any code. Build+deploy+verify only.
- There is a KNOWN, non-blocking follow-up limitation already tracked as GitHub issue
  #156 (SVG edge-rendering cost at high edge density can still cause slow panning on
  very dense collections) — this is expected, do not treat it as a deploy blocker if you
  happen to reproduce it; just note it if you do.

## Context
Last deploy was deploy-48, revision `farmtable-00055-kxv` (commit `0533f0a`). Since then,
PR #155 merged to `main` (merge commit `cdfa1bf076aefe36a6038e8007dff6345f75663f`) — Perf
Phase 2: Dependency View viewport culling. DOM is now only created for nodes/edges
intersecting the current viewport (with a 220px margin to prevent pop-in), cutting DOM
element count by ~95-99% on large collections. A `willUpdate()` guard also skips
re-running layout/structureKey computation on pan/zoom-only changes, fixing janky panning
on large graphs. Independently reviewed (APPROVE) with particular scrutiny on the pan/zoom
guard's correctness and interaction with Solo mode, DnD FLIP animation (Feature 64), and
the minimap (Feature 54) - all confirmed compositionally safe.

## Task
1. Confirm what's new: `git log --oneline origin/main` since `0533f0a`.
2. Build and deploy to the `farmtable` Cloud Run service, project `deploy-demo-test`,
   region `us-central1`.
3. Verify live and serving 100% traffic (`gcloud run services describe` + `curl`).
4. **Verify Perf Phase 2 on the live instance**:
   a. Open the Dependency View on a collection with a meaningful number of tasks/
      relationships (check for large collections used in prior perf testing/deploys).
   b. Pan and zoom around — confirm nodes appear/disappear seamlessly with no visible
      pop-in or flicker.
   c. Confirm the minimap still shows the FULL graph, not just the currently-visible
      subset.
   d. Toggle Solo mode on a task with real relationships — confirm it still filters
      correctly and composes with culling (no missing/duplicate nodes).
   e. Perform a drag-and-drop relationship change (Feature 64) — confirm the FLIP
      animation still plays correctly.
5. Regression check: Tree View (including Feature 67's TB/LR toggle from deploy-48),
   Dashboard, and other recent features still work normally.
6. Report every check's pass/fail explicitly.

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified.
2. Explicit pass/fail evidence with real screenshots, saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-24-deploy-49/`
3. A deploy log at `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-24-deploy-49.md`.
4. A message to the coordinator with revision ID, commit SHA, and pass/fail per check.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` if anything looks broken.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify Perf Phase 2 live with real evidence, produce the log, and
message the coordinator with a clear per-check pass/fail. Then signal task_completed.
