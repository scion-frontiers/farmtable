# Brief: Deploy latest `main` to Cloud Run (deploy-14)

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-14 -b deploy-14-snapshot origin/main`
  (standing policy — avoids branch collisions; farmtable-em-f44 and
  farmtable-em-passthrough-write are both actively working in their own separate worktrees
  right now, so this is safe).
- Do not merge/modify any code. This is a build+deploy+verify task only.
- The coordinator will NOT independently re-read your diff or re-open your screenshots —
  your own verification is what stands.

## Context
Last deploy was rev `farmtable-00019-w8z` (commit `6cddeb4`, Feature 42 DnD fix). Since
then, PR #115 (commit `b2a8123`) merged Feature 43: the Tree view now only draws
parent-child hierarchy lines, with BLOCKS/BLOCKED_BY dependency lines removed.

## Task
1. Confirm `git log --oneline origin/main` shows only PR #115 as new since `6cddeb4`.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same pattern as prior deploys (check
   `deploy/2026-07-22-deploy-13.md` for exact commands/flags).
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Specifically verify Feature 43 on the LIVE site**: find or create tasks with a BLOCKS
   relationship set up (reuse the test data pattern from
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-43-tree-parent-child-only/`
   if useful for reference), open the Tree view, and confirm only solid parent-child
   hierarchy lines show — no dashed BLOCKS lines. Real screenshot.
5. Confirm Feature 41's animated centering still works in this view (quick spot-check).

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Real screenshot proving Feature 43 works on the LIVE deployed site (parent-child only,
   no BLOCKS lines, using data that actually has a BLOCKS relationship). Saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-14/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-14.md`.
4. A message to the coordinator with revision ID, commit SHA, and pass/fail.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify Feature 43 live with a real screenshot on data that actually has a
BLOCKS relationship, produce the log, and message the coordinator. Then signal
task_completed.
