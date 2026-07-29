# Brief: Deploy latest `main` to Cloud Run (deploy-10)

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-10 -b deploy-10-snapshot origin/main`
  (standing policy — avoids branch collisions with any other in-flight workstream).
- Do not merge/modify any code. This is a build+deploy+verify task only.
- The coordinator will NOT independently re-read your diff or re-open your screenshots —
  your own verification is what stands. Be rigorous and honest about what you verify.

## Context
Last deploy was rev `farmtable-00015-65p` (commit `798efc5`). Since then, PR #111 (commit
`8dfd5b8`) merged Feature 39: a v3 fix to the scroll behavior. ptone@google.com explicitly
asked to redeploy once this fix lands so they can try it themselves - this deploy is
directly gating their next check.

Feature 39 fixes a real regression the user caught in deploy-9: F38's fix left
per-kanban-column scrollbars (from Feature 36) instead of ONE single scroll region for the
whole `main` content area, with the Inspector panel scrolling independently. Feature 39
removed the per-column `overflow`/`min-height` CSS in `ft-kanban-view.ts` /
`ft-kanban-column.ts` so `.main` is now the single vertical scroll container.

## Task
1. Confirm `git log --oneline origin/main` to see exactly what's new since `798efc5`
   (should be just PR #111, but verify).
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same `gcloud builds submit` / `gcloud run
   deploy` pattern as prior deploys (check
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-21-deploy-9.md` for exact
   commands/flags).
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Specifically verify Feature 39** on the live URL with Playwright, using a collection
   with enough tasks that main content overflows vertically:
   - Confirm `.main` (or whatever the actual single scroll container selector is - check
     the PR #111 diff / feature log at
     `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-39-single-scroll-region.md`)
     is THE scroll container: `scrollHeight > clientHeight` on it.
   - Confirm NO per-Kanban-column scrollbars exist anymore (columns should not have their
     own independent overflow).
   - Confirm scrolling `main` does not move the toolbar/header.
   - Confirm the Inspector panel (open it on a task) scrolls independently of `main` — i.e.
     scrolling Inspector content does not change `main`'s scrollTop, and vice versa.
   - Confirm horizontal scroll on wide Kanban boards still works.
   - Take real screenshots proving each of the above (reuse the evidence pattern from
     Feature 39's own screenshots at
     `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-39-single-scroll-region/`
     as a reference for what good evidence looks like here).
5. Report honestly if anything doesn't work as expected — this exact feature has failed
   live verification before (twice), so don't rubber-stamp it.

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Real Playwright screenshots proving Feature 39's single-scroll-region + independent
   inspector-scroll behavior on the LIVE deployed site (not just local/dev, which is what
   Feature 39's own dev verification used). Saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-21-deploy-10/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-21-deploy-10.md` (revision
   ID, commit SHA, what was verified, screenshot links).
4. A message to the coordinator with revision ID, commit SHA, and pass/fail on each item
   verified.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify Feature 39 live with real screenshots, produce the log, and message
the coordinator. Then signal task_completed.
