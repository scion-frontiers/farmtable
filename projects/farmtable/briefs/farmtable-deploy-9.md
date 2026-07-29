# Brief: Deploy latest `main` to Cloud Run (deploy-9)

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-9 -b deploy-9-snapshot origin/main`
  (standing policy as of 2026-07-21 — avoids branch collisions with any other in-flight
  workstream touching `/workspace/farmtable`).
- Do not merge/modify any code. This is a build+deploy+verify task only.
- The coordinator will NOT independently re-read your diff or re-open your screenshots —
  your own verification is what stands. Be rigorous and honest about what you verify.

## Context
User (ptone@google.com) asked whether the vertical-scroll fixes are live on Cloud Run. Last
deploy was rev `farmtable-00014-jfd` (commit `6aeed20`, included PR #107 passthrough spinner
fix). Since then, `main` has merged:
- PR #108 — Feature 35 (constant task title above inspector tabs)
- PR #106 — Feature 36 (independent vertical scroll for main content, first pass)
- Feature 37 (scroll/frame-to-item on navigation, dim overlay if not in view) — PR number
  not recorded in our tracker, find it via `gh pr list --state merged --search "F37 OR
  scroll-to-item"` if needed for your own reference
- PR #109 (commit `50b51ba`) — Feature 38 (truly independent main-content scroll — the real
  fix; #106 alone was incomplete per the user)
- PR #110 (commit `798efc5`) — decomposer extras app (`cmd/decomposer/`,
  `internal/decomposer/` — a new standalone Go binary, does not affect the web server
  directly but is part of `main` now)

Check `git log --oneline origin/main` to confirm exactly what's included since
`6aeed20` before you deploy — don't assume the list above is exhaustive.

## Task
1. In your worktree, confirm current deployed Cloud Run revision matches `6aeed20` (or
   whatever's actually live) via `gcloud run services describe farmtable --project
   deploy-demo-test --region us-central1 --format=json` and cross-referencing image tag/git
   SHA if embedded, or just proceed — the point is to get `main` HEAD deployed regardless.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — use the same `gcloud builds submit` /
   `gcloud run deploy` pattern as prior deploys (check
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-21-deploy-7.md` or
   `deploy-8` logs for the exact commands/flags: image tag, service account, Cloud SQL
   instance flags).
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Specifically verify the vertical-scroll fix (Feature 38)** on the live URL — use
   Playwright: open a collection with a tall Kanban column, scroll the main content area,
   and confirm via screenshots at two different scroll positions that the header/toolbar
   and Inspector panel (open it on a task) stay in the exact same pixel position while only
   the main content scrolls. This is the specific thing the user asked about — don't just
   confirm the site loads.
5. Spot-check Feature 35 (task title constant above inspector tabs) and Feature 37
   (scroll/frame-to-item + dim overlay) are visibly present/working too, since they're
   bundled in this same deploy.
6. Report honestly if anything doesn't work as expected — do not force a screenshot that
   doesn't match reality.

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Real Playwright screenshots proving the Feature 38 scroll fix (two scroll positions,
   header/Inspector pixel-identical). Saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-21-deploy-9/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-21-deploy-9.md` (revision
   ID, commit SHA, what was verified, screenshot links).
4. A message to the coordinator with revision ID, commit SHA, and pass/fail on each item
   verified.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify (especially the scroll fix with real screenshots), produce the log,
and message the coordinator. Then signal task_completed.
