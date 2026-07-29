# Brief: Deploy latest `main` to Cloud Run (deploy-21)

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-21 -b deploy-21-snapshot origin/main`
  (standing policy).
- Do not merge/modify any code. This is a build+deploy+verify task only.
- The coordinator will NOT independently re-read your diff or re-open your screenshots —
  your own verification is what stands.

## Context
Last deploy was rev `farmtable-00026-746` (commit `2c973dc`, Feature 45). Since then, PR
#123 (commit `7a2e742`) merged Feature 46: a trash-can icon per relationship row in the
Inspector's Relationships tab (removes that relationship), and a "+" button on the
BLOCKS/BLOCKED_BY section headings that opens the existing command palette (Feature 31) in
a new add-relationship mode with type pills — extending that component rather than
duplicating it.

## Task
1. Confirm `git log --oneline origin/main` shows only PR #123 as new since `2c973dc`.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same pattern as prior deploys (check
   `deploy/2026-07-22-deploy-20.md` for exact commands/flags).
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Specifically verify Feature 46 on the LIVE site**:
   - Open a task's Inspector with an existing relationship, confirm a trash-can icon is
     present and removing it via click actually removes the relationship (confirm via a
     follow-up check, e.g. reload or `ft task show`).
   - Click the "+" on the Relationships section, confirm the command palette opens in
     add-relationship mode with type pills, select a task, confirm a new relationship is
     actually created.
   - Real screenshots for both flows.
5. Confirm Feature 45 (deployed last round) is still working (quick spot-check).

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Real screenshots proving Feature 46's delete and add flows work on the LIVE deployed
   site. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-21/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-21.md`.
4. A message to the coordinator with revision ID, commit SHA, and pass/fail.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify Feature 46 live with real screenshots for both delete and add
flows, produce the log, and message the coordinator. Then signal task_completed.
