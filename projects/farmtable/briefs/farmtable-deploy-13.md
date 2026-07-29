# Brief: URGENT Deploy latest `main` to Cloud Run (deploy-13)

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-13 -b deploy-13-snapshot origin/main`
  (standing policy — avoids branch collisions with any other in-flight workstream).
- Do not merge/modify any code. This is a build+deploy+verify task only.
- **This is urgent** — production drag-and-drop has been broken for real users. Move
  quickly but verify properly using real HTML5 DnD event simulation (`page.dragAndDrop()` /
  `locator.dragTo()`), NOT plain `mouse.move()` sequences — a prior investigation got a
  false negative using mouse-based simulation because it happened to land precisely on a
  card instead of the (previously broken) mostly-dead drop-target zone. See
  `/scion-volumes/scratchpad/projects/farmtable/reports/dnd-broken-investigation.md` for
  full context.
- The coordinator will NOT independently re-read your diff or re-open your screenshots —
  your own verification is what stands. Be rigorous and honest.

## Context
Last deploy was rev `farmtable-00018-jmx` (commit `146b3be`, Feature 41). Since then, PR
#114 (commit `6cddeb4`) merged Feature 42: a 1-line CSS fix restoring `flex: 1` on `.cards`
in `ft-kanban-column.ts`, which had been dropped by PR #111 (Feature 39) and was silently
shrinking Kanban drop targets down to just the card content — leaving large dead zones
(up to 95% of a column's visible area for short/empty columns) where real user drags
silently failed.

## Task
1. Confirm `git log --oneline origin/main` shows only PR #114 as new since `146b3be`.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same `gcloud builds submit` / `gcloud run
   deploy` pattern as prior deploys (check `deploy/2026-07-22-deploy-12.md` for exact
   commands/flags).
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Specifically verify Feature 42 on the LIVE site** with Playwright, using REAL HTML5 DnD
   simulation:
   - Find a column that's short/mostly-empty relative to the tallest column (or create this
     condition) and attempt a drop into what was previously dead space (not just onto an
     existing card) — confirm the drop now succeeds.
   - Confirm Feature 39's single main-scroll-region behavior is NOT regressed (no
     per-column scrollbars reappeared).
   - Real screenshots for both.
5. Report honestly if anything doesn't work as expected.

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Real screenshots proving Feature 42's fix works on the LIVE deployed site using real DnD
   events (not mouse-move simulation) — a drop succeeding in what was previously dead
   space. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-13/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-13.md`.
4. A message to the coordinator with revision ID, commit SHA, and pass/fail — message
   immediately given the urgency.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify Feature 42 live with real HTML5-DnD-based screenshots, produce the
log, and message the coordinator immediately. Then signal task_completed.
