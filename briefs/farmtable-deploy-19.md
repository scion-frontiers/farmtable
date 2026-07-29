# Brief: Deploy latest `main` to Cloud Run (deploy-19)

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-19 -b deploy-19-snapshot origin/main`
  (standing policy — farmtable-em-f45 and farmtable-em-f46 are both actively working in
  their own separate worktrees right now, this is safe).
- Do not merge/modify any code. This is a build+deploy+verify task only.
- The coordinator will NOT independently re-read your diff or re-open your screenshots —
  your own verification is what stands.

## Context
Last deploy was rev `farmtable-00024-prb` (commit `aa0feb2`, Phase 3 write-through). Since
then, PR #121 (commit `cb19a2f`) merged Feature 47: a small CSS fix giving priority badges
in the Ready Queue view a fixed min-width so task titles align consistently regardless of
badge text length.

## Task
1. Confirm `git log --oneline origin/main` shows only PR #121 as new since `aa0feb2`.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same pattern as prior deploys (check
   `deploy/2026-07-22-deploy-18.md` for exact commands/flags).
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Specifically verify Feature 47 on the LIVE site**: open the Ready Queue view with
   tasks of varying priority (varying badge text width), confirm titles are consistently
   aligned. Real screenshot.

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Real screenshot proving Feature 47's alignment fix works on the LIVE deployed site.
   Saved under `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-19/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-19.md`.
4. A message to the coordinator with revision ID, commit SHA, and pass/fail.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify Feature 47 live with a real screenshot, produce the log, and
message the coordinator. Then signal task_completed.
