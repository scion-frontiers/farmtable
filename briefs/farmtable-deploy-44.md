# Brief: Deploy latest `main` to Cloud Run (deploy-44) — Feature 65 (Dashboard Ready Count)

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-44 -b deploy-44-snapshot origin/main`
  (standing policy).
- **LOW-RISK DEPLOY** — small, additive UI change, single review round, clean approve.
- Do not merge/modify any code. This is a build+deploy+verify task only.
- GitHub GraphQL API may still be rate-limited — prefer REST (`gh api repos/...`).
- Note: other in-flight work (Feature 66, Perf Phase 1) will land in later deploys — this
  deploy is just for Feature 65's merged commit.

## Context
Last deploy was deploy-43, revision `farmtable-00050-n8x` (commit `b67ac9d`). Since then,
PR #148 merged to `main` (squash commit `e5218539d576be5a8788da9d410aac4ef0b8a134`) —
Feature 65: Dashboard view now shows a top-level "Ready" item count (reusing the canonical
Ready Queue definition), clickable to navigate to the Ready Queue view.

## Task
1. Confirm exactly what's new: `git log --oneline origin/main` since `b67ac9d`.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same pattern as deploy-43.
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Verify Feature 65 on the live instance**:
   a. Load the Dashboard view, confirm the Ready count appears and is a plausible number.
   b. Cross-check: navigate to Ready Queue view for the same collection, confirm the
      count matches.
   c. Click the Ready count card, confirm it navigates to Ready Queue.
   d. Confirm no console errors, no regression to other Dashboard stats.
5. Report every check's pass/fail explicitly.

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Explicit pass/fail evidence for the checks above. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-24-deploy-44/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-24-deploy-44.md`.
4. A message to the coordinator with revision ID, commit SHA, and explicit pass/fail on
   each check.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` — message immediately if anything
  looks broken.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify Feature 65 live, produce the log, and message the coordinator
with a clear per-check pass/fail. Then signal task_completed.
