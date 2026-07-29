# Brief: Deploy latest `main` to Cloud Run (deploy-33)

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-33 -b deploy-33-snapshot origin/main`
  (standing policy — farmtable-em-blind-auth-exercise may still be active, this is safe).
- Do not merge/modify any code. This is a build+deploy+verify task only.
- GitHub GraphQL API may still be rate-limited — prefer REST (`gh api repos/...`) over
  `gh pr view`/`gh pr diff` if you need PR metadata.
- **Real quantitative evidence required, not just screenshots** — this bug (and its
  evidence) has a documented history of broken/duplicate screenshot captures. Follow the
  pattern from Feature 60's final (accepted) evidence: log actual viewport pan/scale
  values before and after a poll cycle via `page.evaluate()`, not just visual screenshots.

## Context
Last deploy was rev `farmtable-00038-gmg` (commit `7d64230`, Feature 59). Since then, PR
#137 (commit `c957f7e`) merged Feature 60: fixes the Dependency view's viewport
(pan+zoom) resetting on every poll tick for external/polling collections — sorts the
relationships array in the structure-comparison key, and guards the poll's
`snapshotComplete` signal so it only fires on actual data changes.

## Task
1. Confirm `git log --oneline origin/main` shows only PR #137 as new since `7d64230`.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same pattern as prior deploys (check
   `deploy/2026-07-23-deploy-32.md` for exact commands/flags).
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Specifically verify Feature 60 on the LIVE site**: open a writable/polling GitHub
   collection's Dependency view, capture the viewport's pan/scale values (via
   `page.evaluate()`), wait through at least 2 real poll cycles (~30s), capture the
   viewport values again, and confirm they're stable (no reset) even if the poll fired.
   Also confirm the Tree view is unaffected.

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Real quantitative evidence (viewport values before/after real poll cycles) proving
   Feature 60's fix works on the LIVE deployed site. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-23-deploy-33/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-23-deploy-33.md`.
4. A message to the coordinator with revision ID, commit SHA, and pass/fail.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify Feature 60 live with real quantitative viewport evidence, produce
the log, and message the coordinator. Then signal task_completed.
