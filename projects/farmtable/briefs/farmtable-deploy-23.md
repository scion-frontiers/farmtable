# Brief: Deploy latest `main` to Cloud Run (deploy-23)

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-23 -b deploy-23-snapshot origin/main`
  (standing policy — farmtable-em-f50 is actively working in its own separate worktree
  right now, this is safe).
- Do not merge/modify any code. This is a build+deploy+verify task only.
- The coordinator will NOT independently re-read your diff or re-open your screenshots —
  your own verification is what stands.

## Context
Last deploy was rev `farmtable-00028-gf6` (commit `b8ee51f`, Feature 48). Since then, PR
#126 (commit `6814944`) merged Feature 49: fixes the missing reciprocal relationship
immediate-sync bug — adding "A blocks B" now immediately shows "Blocked by A" on task B's
Inspector without requiring a reload.

## Task
1. Confirm `git log --oneline origin/main` shows only PR #126 as new since `b8ee51f`.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same pattern as prior deploys (check
   `deploy/2026-07-22-deploy-22.md` for exact commands/flags).
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Specifically verify Feature 49 on the LIVE site**: add a "blocks" relationship between
   two tasks (via command palette add or drag-and-drop in the dependency view), then
   WITHOUT reloading, open the other task's Inspector and confirm the reciprocal
   relationship shows immediately. Real screenshots proving the no-reload behavior.

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Real screenshots proving Feature 49's immediate reciprocal sync works on the LIVE
   deployed site (no reload). Saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-23/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-23.md`.
4. A message to the coordinator with revision ID, commit SHA, and pass/fail.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify Feature 49 live with real no-reload screenshots, produce the log,
and message the coordinator. Then signal task_completed.
