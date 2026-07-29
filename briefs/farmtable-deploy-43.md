# Brief: Deploy latest `main` to Cloud Run (deploy-43) — Feature 64 (DnD FLIP Animation)

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-43 -b deploy-43-snapshot origin/main`
  (standing policy).
- **LOW-RISK DEPLOY** — UI-only animation change to the Dependency View's drag-and-drop
  handling. Code-level correctness was already confirmed (stroke-dasharray progressive
  edge draw-in, FLIP node animation, verified via real telemetry showing
  edgeProgress 0.3→0.94→complete). ptone has explicitly said they'll do the final
  subjective "does this feel right" verification live themselves post-deploy — your job
  is the mechanical deploy + basic automated sanity checks, NOT trying to perfectly
  capture the animation's look via screenshots (that's been tried and is inherently hard
  to fully verify that way).
- Do not merge/modify any code. This is a build+deploy+verify task only.
- GitHub GraphQL API may still be rate-limited — prefer REST (`gh api repos/...`).

## Context
Last deploy was deploy-42, revision `farmtable-00049-4rl` (commit `eef367b`). Since then,
PR #147 merged to `main` (squash commit `b67ac9de7e79a02ece8bc5f95355e2e50320666e`) —
Feature 64: choreographed animation for Dependency View drag-and-drop. When a DnD creates
a new BLOCKS relationship: the drop-target (blocking) node stays fixed, the dragged
(blocked) node animates to its new layout position (~500ms FLIP), then the new edge draws
in progressively (~300ms stroke-dasharray reveal) rather than the whole graph
redrawing/rescaling as before.

## Task
1. Confirm exactly what's new: `git log --oneline origin/main` since `eef367b`.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same pattern as deploy-42.
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Basic sanity checks** (not exhaustive animation-timing verification — that's covered
   by code review + ptone's own live testing):
   a. Perform a drag-and-drop in the Dependency View on the live instance, confirm no
      console errors and no crash.
   b. Confirm the view does NOT do the old full-rescale/zoom-out behavior (a single
      before/after screenshot showing the viewport scale is unchanged is sufficient here).
   c. Confirm Feature 60 (poll-tick stability) and Feature 61/61v2 (Solo mode) still work
      normally in the Dependency View — quick regression check, not exhaustive.
5. Report pass/fail on the above. If anything crashes or looks badly broken, flag it
   immediately — but don't block the deploy on subjective "does the animation look smooth"
   judgment calls, that's ptone's call to make live.

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Pass/fail on the basic sanity checks above. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-24-deploy-43/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-24-deploy-43.md`.
4. A message to the coordinator with revision ID, commit SHA, and pass/fail on each check.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` — message immediately if anything
  looks broken.
- Do not message ptone@google.com directly — the coordinator will let ptone know it's
  ready for live testing.

## Termination
You MUST deploy, run the basic sanity checks above, produce the log, and message the
coordinator with a clear pass/fail. Then signal task_completed.
