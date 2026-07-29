# Brief: Deploy latest `main` to Cloud Run (deploy-29)

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-29 -b deploy-29-snapshot origin/main`
  (standing policy).
- Do not merge/modify any code. This is a build+deploy+verify task only.
- **This is a transient-UI-state fix** — a screenshot at a random moment won't prove it.
  Use the same technique Feature 55's dev used to verify locally: intercept the gRPC-Web
  poll request (e.g. `page.route()`) to introduce an artificial delay so you can capture
  the in-flight state, or otherwise reliably catch the spinner state during both a
  background poll and a manual refresh click. Check
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-55-poll-sync-flicker.md`
  for the exact approach used.
- The coordinator will NOT independently re-read your diff or re-open your screenshots —
  your own verification is what stands.

## Context
Last deploy was rev `farmtable-00034-svn` (commit `5ca9037`, Feature 54). Since then, PR
#132 (commit `f1a86dc`) merged Feature 55: the Refresh button no longer shows a loading
spinner during background poll ticks (only on manual refresh clicks), and the task store
skips redundant change events when poll data hasn't actually changed.

## Task
1. Confirm `git log --oneline origin/main` shows only PR #132 as new since `5ca9037`.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same pattern as prior deploys (check
   `deploy/2026-07-22-deploy-28.md` for exact commands/flags).
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Specifically verify Feature 55 on the LIVE site**, using a writable GitHub-backed test
   collection (switch it into polling mode): confirm a background poll tick does NOT show
   the Refresh spinner, and a manual click on Refresh DOES show it. Real screenshots proving
   both states (using the interception/delay technique to catch the transient state
   reliably, not a lucky timing guess).

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Real screenshots proving Feature 55's fix works on the LIVE deployed site — background
   poll shows no spinner, manual refresh does. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-29/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-29.md`.
4. A message to the coordinator with revision ID, commit SHA, and pass/fail.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify Feature 55 live with real, genuinely-distinct screenshots proving
both spinner states, produce the log, and message the coordinator. Then signal
task_completed.
