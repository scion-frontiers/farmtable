# Brief: Deploy latest `main` to Cloud Run (deploy-17)

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-17 -b deploy-17-snapshot origin/main`
  (standing policy — farmtable-em-passthrough-write is actively working Phase 3 in its own
  separate worktree right now, this is safe).
- Do not merge/modify any code. This is a build+deploy+verify task only.
- Verify against a TEST collection/repo, not production farmtable issues, for anything
  involving GitHub writes.
- The coordinator will NOT independently re-read your diff or re-open your screenshots —
  your own verification is what stands.

## Context
Last deploy was rev `farmtable-00022-z2d` (commit `2f15c92`, Feature 44). Since then, PR
#118 (commit `2095838`) merged Passthrough Write-Through Phase 2: GitHub-backed collections
now show unmappable operations (dates, acceptance criteria, blocks/blocked-by, code
context, delete, drag-reorder) as disabled with explanatory tooltips, while mapped
operations (title, description, stage, priority, assignee, comments, create, close,
reparent) remain fully functional. Farmtable-platform collections are unaffected
(ALL_ENABLED).

## Task
1. Confirm `git log --oneline origin/main` shows only PR #118 as new since `2f15c92`.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same pattern as prior deploys (check
   `deploy/2026-07-22-deploy-16.md` for exact commands/flags).
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Specifically verify Phase 2 on the LIVE site**, using a GitHub-backed test collection
   (reuse or create one, don't touch production farmtable issues):
   - Confirm an unmappable field (e.g. a date field) shows disabled with a tooltip.
   - Confirm a mapped field (e.g. title) is still editable.
   - Confirm a Farmtable-platform collection is completely unaffected (nothing newly
     disabled there).
   - Real screenshots for each.
5. Confirm Feature 44 (dependency view, deployed last round) is still working (quick
   spot-check).

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Real screenshots proving Phase 2's capability gating works on the LIVE deployed site.
   Saved under `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-17/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-17.md`.
4. A message to the coordinator with revision ID, commit SHA, and pass/fail.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify Phase 2 live with real screenshots, produce the log, and message
the coordinator. Then signal task_completed.
