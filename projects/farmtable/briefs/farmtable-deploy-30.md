# Brief: Deploy latest `main` to Cloud Run (deploy-30)

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-30 -b deploy-30-snapshot origin/main`
  (standing policy — farmtable-em-f57 is actively working in its own worktree, this is
  safe).
- Do not merge/modify any code. This is a build+deploy+verify task only.
- **GitHub GraphQL API rate limit may be exhausted** (hit `API rate limit already
  exceeded` earlier) — if you need `gh pr` commands, prefer REST endpoints (`gh api
  repos/... `) over `gh pr view`/`gh pr diff` which use GraphQL, in case it's still
  exhausted.
- The coordinator will NOT independently re-read your diff or re-open your screenshots —
  your own verification is what stands.

## Context
Last deploy was rev `farmtable-00035-rg4` (commit `f1a86dc`, Feature 55). Since then, PR
#133 (commit `696cacc`) merged Feature 56: selecting a task node in either tree view (Tree
or Dependency) now animates zoom+pan together so the node occupies ~20% of viewport width,
and the selected-node highlight is more prominent (3px border + offset box-shadow halo).

## Task
1. Confirm `git log --oneline origin/main` shows only PR #133 as new since `f1a86dc`.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same pattern as prior deploys (check
   `deploy/2026-07-22-deploy-29.md` for exact commands/flags).
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Specifically verify Feature 56 on the LIVE site**: select a task node in both the Tree
   view and Dependency view, confirm the zoom animation settles with the node at roughly
   20% of viewport width (measure via `page.evaluate()` reading bounding-box vs viewport
   width, same technique the dev used), and confirm the highlight is visibly thicker/offset
   compared to before. Real screenshots with the measured percentage.

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Real screenshots + measured percentage proving Feature 56's zoom-to-target-size works on
   the LIVE deployed site, on both views. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-30/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-30.md`.
4. A message to the coordinator with revision ID, commit SHA, and pass/fail.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify Feature 56 live with real measured screenshots, produce the log,
and message the coordinator. Then signal task_completed.
