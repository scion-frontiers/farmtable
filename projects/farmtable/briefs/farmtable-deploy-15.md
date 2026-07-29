# Brief: Deploy latest `main` to Cloud Run (deploy-15)

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-15 -b deploy-15-snapshot origin/main`
  (standing policy — farmtable-em-f44 and farmtable-em-passthrough-write are both actively
  working in their own separate worktrees right now, this is safe).
- Do not merge/modify any code. This is a build+deploy+verify task only.
- **This deploy includes REAL GitHub write capability** — be careful to verify against a
  TEST collection/repo, not scion-frontiers/farmtable's own production issues. Check
  `/scion-volumes/scratchpad/projects/farmtable/passthrough-write-implementation-log.md`
  for the test repo used during development (`scion-frontiers/scion-roadmap`) — reuse that
  or create your own throwaway test repo/collection, don't touch production data.
- The coordinator will NOT independently re-read your diff or re-open your screenshots —
  your own verification is what stands.

## Context
Last deploy was rev `farmtable-00020-flp` (commit `b2a8123`, Feature 43). Since then, PR
#116 (commit `2ac0945`) merged Phase 1 of GitHub Passthrough Write-Through: writes to
GitHub-backed collections marked `remote_data.writable=true` now flow through to the real
GitHub issue (title/description/comments), with optimistic UI updates and a 15s poll-based
reconciliation. A "↔ GitHub" badge appears in the toolbar for writable external
collections.

## Task
1. Confirm `git log --oneline origin/main` shows only PR #116 as new since `b2a8123`.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same pattern as prior deploys (check
   `deploy/2026-07-22-deploy-14.md` for exact commands/flags).
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Specifically verify Phase 1 write-through on the LIVE site**, against a TEST
   collection/repo (not production farmtable issues):
   - Confirm the "↔ GitHub" badge appears for a writable external collection.
   - Edit a task's title/description via the live UI, confirm it lands on the actual
     GitHub issue (check via `gh api` or the GitHub web UI).
   - Add a comment via the live UI, confirm it appears on the GitHub issue.
   - Real screenshots for each.
5. Confirm Feature 43 (tree parent-child only, deployed last round) is still working (quick
   spot-check, not full re-verification).

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Real screenshots + evidence (e.g. `gh api` output) proving Phase 1 write-through works
   on the LIVE deployed site against a test collection. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-15/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-15.md`.
4. A message to the coordinator with revision ID, commit SHA, and pass/fail.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify Phase 1 write-through live against a TEST collection with real
evidence, produce the log, and message the coordinator. Then signal task_completed.
