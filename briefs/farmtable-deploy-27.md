# Brief: Deploy latest `main` to Cloud Run (deploy-27)

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-27 -b deploy-27-snapshot origin/main`
  (standing policy — farmtable-em-f54 is actively working in its own worktree, this is
  safe).
- Do not merge/modify any code. This is a build+deploy+verify task only.
- The coordinator will NOT independently re-read your diff or re-open your screenshots —
  your own verification is what stands.

## Context
Last deploy was rev `farmtable-00032-ksz` (commit `0596714`, Feature 52). Since then, PR
#129 (commit `40f8d82`) merged Feature 53: removed the old, redundant "Relations" section
from the Inspector's General tab (the dedicated Relationships tab remains the sole place
relationships are shown/managed).

## Task
1. Confirm `git log --oneline origin/main` shows only PR #129 as new since `0596714`.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same pattern as prior deploys (check
   `deploy/2026-07-22-deploy-26.md` for exact commands/flags).
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Specifically verify Feature 53 on the LIVE site**: open a task's Inspector on the
   General tab, confirm no "Relations" section is present; confirm the dedicated
   Relationships tab still fully works (view/add/delete relationships). Real screenshots.

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Real screenshots proving Feature 53's change is live and the Relationships tab is
   unaffected. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-27/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-27.md`.
4. A message to the coordinator with revision ID, commit SHA, and pass/fail.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify Feature 53 live with real screenshots, produce the log, and
message the coordinator. Then signal task_completed.
