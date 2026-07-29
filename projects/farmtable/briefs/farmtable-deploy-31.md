# Brief: Deploy latest `main` to Cloud Run (deploy-31)

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-31 -b deploy-31-snapshot origin/main`
  (standing policy — farmtable-em-f59 is actively working in its own worktree, this is
  safe).
- Do not merge/modify any code. This is a build+deploy+verify task only.
- GitHub GraphQL API may still be rate-limited — prefer REST (`gh api repos/...`) over
  `gh pr view`/`gh pr diff` if you need PR metadata.
- **This is a regression-fix redeploy** — the whole point is proving the animation is
  smooth again. A static before/after screenshot pair is NOT sufficient; capture a
  mid-animation frame sequence like the dev did (see
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-58-combined-pan-zoom/`
  for the reference pattern).
- The coordinator will NOT independently re-read your diff or re-open your screenshots —
  your own verification is what stands.

## Context
Last deploy was rev `farmtable-00036-4lm` (commit `696cacc`, Feature 56). Since then, PR
#135 (commit `b500753`) merged Feature 58: restores the smooth combined pan+zoom animation
(750ms ease-in-out) that Feature 56 had regressed — both the Tree view and Dependency view
now animate the viewport pan and zoom together instead of the pan snapping instantly.

## Task
1. Confirm `git log --oneline origin/main` shows only PR #135 as new since `696cacc`.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same pattern as prior deploys (check
   `deploy/2026-07-22-deploy-30.md` for exact commands/flags).
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Specifically verify Feature 58 on the LIVE site**: select a task in both the Tree view
   and Dependency view, capture a mid-animation frame sequence (4-5+ screenshots across the
   ~750ms transition) proving the pan and zoom interpolate together smoothly, not an
   instant jump. Also spot-check Feature 56's ~20% zoom target and highlight styling are
   still correct (non-regression).

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Real mid-animation frame sequence screenshots proving Feature 58's fix works on the LIVE
   deployed site, on both views. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-23-deploy-31/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-23-deploy-31.md`.
4. A message to the coordinator with revision ID, commit SHA, and pass/fail.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify Feature 58 live with a real mid-animation frame sequence, produce
the log, and message the coordinator. Then signal task_completed.
