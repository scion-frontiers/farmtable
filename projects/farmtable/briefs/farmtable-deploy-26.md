# Brief: Deploy latest `main` to Cloud Run (deploy-26)

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-26 -b deploy-26-snapshot origin/main`
  (standing policy — farmtable-em-f54 is actively working in its own worktree, this is
  safe).
- Do not merge/modify any code. This is a build+deploy+verify task only.
- The coordinator will NOT independently re-read your diff or re-open your screenshots —
  your own verification is what stands.

## Context
Last deploy was rev `farmtable-00031-vfh` (commit `71dfe88`, Feature 51). Since then, PR
#130 (commit `0596714`) merged Feature 52: the command palette search is now scoped to
title + labels only (was searching description/type/stage/assignees/ID), is
case-insensitive, and does fuzzy matching (fixed a latent bug that silently dropped valid
matches).

## Task
1. Confirm `git log --oneline origin/main` shows only PR #130 as new since `71dfe88`.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same pattern as prior deploys (check
   `deploy/2026-07-22-deploy-25.md` for exact commands/flags).
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Specifically verify Feature 52 on the LIVE site**: open the command palette, confirm
   (a) a partial title match works, (b) a query matching only the description text does
   NOT match, (c) case-insensitive matching works, (d) a fuzzy/typo'd query still matches a
   close title, (e) a label-based query matches. Real screenshots.

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Real screenshots proving Feature 52's search fix works on the LIVE deployed site. Saved
   under `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-26/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-26.md`.
4. A message to the coordinator with revision ID, commit SHA, and pass/fail.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify Feature 52 live with real screenshots, produce the log, and
message the coordinator. Then signal task_completed.
