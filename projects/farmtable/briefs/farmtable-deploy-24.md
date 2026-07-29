# Brief: Deploy latest `main` to Cloud Run (deploy-24)

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-24 -b deploy-24-snapshot origin/main`
  (standing policy).
- Do not merge/modify any code. This is a build+deploy+verify task only.
- The coordinator will NOT independently re-read your diff or re-open your screenshots —
  your own verification is what stands.

## Context
Last deploy was rev `farmtable-00029-w2d` (commit `6814944`, Feature 49). Since then, PR
#127 (commit `277ae61`) merged Feature 50: the root collection-list landing page now
scrolls (via a `.landing` flex/overflow container) and has a "New Project" button wired to
the existing create-collection dialog.

## Task
1. Confirm `git log --oneline origin/main` shows only PR #127 as new since `6814944`.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same pattern as prior deploys (check
   `deploy/2026-07-22-deploy-23.md` for exact commands/flags).
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Specifically verify Feature 50 on the LIVE site**: load the root landing page (no
   `?collection=` in URL), confirm the collection list is scrollable (there should be
   enough real collections on the live service to overflow, or verify the scroll mechanism
   works regardless), confirm the "New Project" button is present and opens the
   create-collection dialog, confirm creating a project navigates to its board. Real
   screenshots.

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Real screenshots proving Feature 50 works on the LIVE deployed site. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-24/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-24.md`.
4. A message to the coordinator with revision ID, commit SHA, and pass/fail.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify Feature 50 live with real screenshots, produce the log, and
message the coordinator. Then signal task_completed.
