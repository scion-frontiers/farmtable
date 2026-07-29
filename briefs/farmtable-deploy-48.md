# Brief: Deploy latest `main` to Cloud Run (deploy-48) — Feature 67 (Tree Layout Orientation)

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-48 -b deploy-48-snapshot origin/main`
  (standing policy).
- Check `scion list` yourself before starting — if another `farmtable-deploy-*` agent is
  running, stop and message the coordinator instead of racing it against the same
  Cloud Run service.
- Do not merge/modify any code. This is a build+deploy+verify task only.

## Context
Last deploy was deploy-47, revision `farmtable-00054-jrj` (commit `d1a061c`). Since then,
PR #154 merged to `main` (merge commit `0533f0ab39fa2719cb27cc474a32c34a56cf5bd6`) —
Feature 67: Tree View (parent-child) now supports left-to-right layout in addition to the
existing top-to-bottom, via a rotate-toggle button next to the Solo button (CCW icon in TB
mode, CW icon in LR mode). Orientation persists to `?layoutdir=LR` URL param (omitted for
default TB). Includes a follow-up fix: the Tree-view icon in the view switcher no longer
rotates with orientation (an earlier version did, which made it visually identical to the
Dependencies view icon — now both icons stay visually distinct in all states).
Does NOT touch Dependency View.

## Task
1. Confirm exactly what's new: `git log --oneline origin/main` since `d1a061c`.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same pattern as recent deploys.
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Verify Feature 67 on the live instance**:
   a. Open a collection in Tree View, confirm default orientation is top-to-bottom (TB).
   b. Click the rotate-toggle button next to Solo — confirm the tree re-layouts to
      left-to-right, and the button icon changes to reflect the new state.
   c. Confirm the URL now has `?layoutdir=LR` (or equivalent) and reload the page — confirm
      orientation persists (still LR after reload).
   d. Toggle back to TB — confirm URL param is removed/reset to default and layout reflows
      back to top-to-bottom.
   e. Confirm the view-switcher icons for Tree and Dependencies views are visually
      DISTINCT in both TB and LR modes (this was the specific bug fixed in the follow-up
      round — verify it didn't regress).
   f. Confirm Solo mode still works correctly in both orientations (toggle Solo on a task
      with real children, confirm filtered subtree renders correctly in both TB and LR).
   g. Confirm the minimap and depth-limit badge (Perf Phase 1) still work normally in both
      orientations.
5. Regression check: Dependency View, Dashboard, other recent features (Perf Phase 1,
   periodic-redraw fix from deploy-47) still work normally.
6. Report every check's pass/fail explicitly.

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Explicit pass/fail evidence for the checks above, with real screenshots (not reused
   from prior evidence). Saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-24-deploy-48/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-24-deploy-48.md`.
4. A message to the coordinator with revision ID, commit SHA, and explicit pass/fail on
   each check.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` — message immediately if anything
  looks broken.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify Feature 67 live with real evidence (especially the orientation
toggle + URL persistence + icon-distinctness fix), produce the log, and message the
coordinator with a clear per-check pass/fail. Then signal task_completed.
