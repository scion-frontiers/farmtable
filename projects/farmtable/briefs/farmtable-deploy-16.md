# Brief: Deploy latest `main` to Cloud Run (deploy-16)

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-16 -b deploy-16-snapshot origin/main`
  (standing policy — farmtable-em-passthrough-write is actively working Phase 2 in its own
  separate worktree right now, this is safe).
- Do not merge/modify any code. This is a build+deploy+verify task only.
- The coordinator will NOT independently re-read your diff or re-open your screenshots —
  your own verification is what stands.

## Context
Last deploy was rev `farmtable-00021-hth` (commit `2ac0945`, Passthrough Write-Through
Phase 1). Since then, PR #117 (commit `2f15c92`) merged Feature 44: a new "Dependency Tree"
view — left-to-right layered DAG showing only BLOCKS/BLOCKED_BY relationships, with layer 0
= unblocked/ready tasks and layer N = max(blocker layers)+1. View-switcher icon reuses the
Tree view's icon rotated 90°CW.

## Task
1. Confirm `git log --oneline origin/main` shows only PR #117 as new since `2ac0945`.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same pattern as prior deploys (check
   `deploy/2026-07-22-deploy-15.md` for exact commands/flags).
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Specifically verify Feature 44 on the LIVE site**: create/find tasks with a multi-layer
   BLOCKS chain (reuse the test-data pattern from
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-44-dependency-view/`
   if useful), switch to the new Dependency view, confirm the layered left-to-right layout
   renders correctly and the view-switcher icon (rotated tree icon) is present. Real
   screenshots.
5. Confirm Feature 43 (tree parent-child only) and Phase 1 write-through (deployed last
   round) are still working (quick spot-check, not full re-verification).

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Real screenshot proving Feature 44's dependency view works on the LIVE deployed site.
   Saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-16/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-16.md`.
4. A message to the coordinator with revision ID, commit SHA, and pass/fail.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify Feature 44 live with a real screenshot, produce the log, and
message the coordinator. Then signal task_completed.
