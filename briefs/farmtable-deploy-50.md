# Brief: Deploy latest `main` to Cloud Run (deploy-50) — Feature 67 Tweak

## Critical Constraints (read first)
- Dedicated git worktree: `git worktree add /workspace/farmtable-deploy-50 -b deploy-50-snapshot origin/main`
- Check `scion list` yourself before starting — stop and message the coordinator if
  another `farmtable-deploy-*` agent is already running.
- Do not merge/modify any code. Build+deploy+verify only.

## Context
Last deploy was deploy-49, revision `farmtable-00056-4tl` (commit `cdfa1bf`). Since then,
PR #157 merged to `main` (merge commit `b06528a48fcaac29886e894131c3ba8857670988`) — a
small tweak to Feature 67 (Tree View layout orientation toggle): left-to-right (LR) is
now the DEFAULT orientation (was top-to-bottom/TB), and the rotate-toggle button no
longer changes color/highlight when active — only the icon direction (CW/CCW) signals
state now, matching how the fix was independently code-reviewed and screenshot-verified
by the coordinator already.

## Task
1. Confirm what's new: `git log --oneline origin/main` since `cdfa1bf`.
2. Build and deploy to the `farmtable` Cloud Run service, project `deploy-demo-test`,
   region `us-central1`.
3. Verify live and serving 100% traffic (`gcloud run services describe` + `curl`).
4. **Verify the tweak on the live instance**:
   a. Open a collection in Tree View with NO `layoutdir` URL param — confirm it defaults
      to LEFT-TO-RIGHT layout now (not top-to-bottom).
   b. Confirm the rotate-toggle button has NO color/background highlight regardless of
      state — only the arrow icon direction changes (CW when LR, CCW when TB).
   c. Toggle to TB — confirm URL now shows `?layoutdir=TB`, layout reflows to
      top-to-bottom, button still has no color highlight.
   d. Toggle back to LR — confirm URL param is removed (LR is default, omitted).
   e. Confirm the Solo button's own highlight styling is UNCHANGED (still highlights
      when active) — this tweak should only affect the orientation button.
5. Regression check: Dependency View (Perf Phase 2 viewport culling from deploy-49),
   Dashboard, other recent features still work normally.
6. Report every check's pass/fail explicitly.

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified.
2. Explicit pass/fail evidence with real screenshots, saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-24-deploy-50/`
3. A deploy log at `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-24-deploy-50.md`.
4. A message to the coordinator with revision ID, commit SHA, and pass/fail per check.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` if anything looks broken.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify the LR-default + no-highlight tweak live with real evidence,
produce the log, and message the coordinator with a clear per-check pass/fail. Then
signal task_completed.
