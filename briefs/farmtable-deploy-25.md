# Brief: Deploy latest `main` to Cloud Run (deploy-25)

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-25 -b deploy-25-snapshot origin/main`
  (standing policy).
- Do not merge/modify any code. This is a build+deploy+verify task only.
- The coordinator will NOT independently re-read your diff or re-open your screenshots —
  your own verification is what stands.

## Context
Last deploy was rev `farmtable-00030-9zg` (commit `277ae61`, Feature 50). Since then, PR
#128 (commit `71dfe88`) merged Feature 51: dependency view layout fixes — all unblocked
tasks now render in the same leftmost column (layer 0), and edges anchor to left/right
node edges instead of top/bottom so lines don't route under task boxes.

## Task
1. Confirm `git log --oneline origin/main` shows only PR #128 as new since `277ae61`.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same pattern as prior deploys (check
   `deploy/2026-07-22-deploy-24.md` for exact commands/flags).
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Specifically verify Feature 51 on the LIVE site**: open the Dependency view with data
   that has multiple unblocked tasks and a multi-layer dependency chain, confirm all
   unblocked tasks align to the same leftmost column and edges anchor left/right (not
   crossing under boxes). Also confirm Feature 48's drag-and-drop still works in this view
   (quick spot-check). Real screenshots.

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Real screenshots proving Feature 51's layout fixes work on the LIVE deployed site.
   Saved under `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-25/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-25.md`.
4. A message to the coordinator with revision ID, commit SHA, and pass/fail.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify Feature 51 live with real screenshots, produce the log, and
message the coordinator. Then signal task_completed.
