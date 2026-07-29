# Brief: Deploy latest `main` to Cloud Run (deploy-28)

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-28 -b deploy-28-snapshot origin/main`
  (standing policy).
- Do not merge/modify any code. This is a build+deploy+verify task only.
- Use real drag events (`page.dragAndDrop()` / `locator.dragTo()`) for the minimap frame
  interaction, not raw mouse-move sequences — see
  `/scion-volumes/scratchpad/projects/farmtable/reports/dnd-broken-investigation.md` for
  why that matters in this project.
- The coordinator will NOT independently re-read your diff or re-open your screenshots —
  your own verification is what stands.

## Context
Last deploy was rev `farmtable-00033-sbg` (commit `40f8d82`, Feature 53). Since then, PR
#131 (commit `5ca9037`) merged Feature 54: a shared minimap component (bottom-left corner,
180x180px) for both the Tree view and Dependency view, showing a scaled-down overview of
all graph nodes with a draggable viewport frame indicator.

## Task
1. Confirm `git log --oneline origin/main` shows only PR #131 as new since `40f8d82`.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same pattern as prior deploys (check
   `deploy/2026-07-22-deploy-27.md` for exact commands/flags).
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Specifically verify Feature 54 on the LIVE site**: open the Tree view, confirm the
   minimap renders in the bottom-left with a viewport frame; drag the frame to a new region
   and confirm the main view pans to match; repeat on the Dependency view. Real screenshots.

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Real screenshots proving Feature 54's minimap and drag-to-pan work on the LIVE deployed
   site, on both tree views. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-28/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-28.md`.
4. A message to the coordinator with revision ID, commit SHA, and pass/fail.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify Feature 54 live with real screenshots on both views, produce the
log, and message the coordinator. Then signal task_completed.
