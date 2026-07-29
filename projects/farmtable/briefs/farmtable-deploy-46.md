# Brief: Deploy latest `main` to Cloud Run (deploy-46) — Feature 66 (Sticky Solo + BFS Fix)

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-46 -b deploy-46-snapshot origin/main`
  (standing policy).
- **MODERATE-RISK DEPLOY** — this fixes a real, previously-reported bug (ptone's
  screenshot showed extraneous nodes/edges in Dependency View Solo mode) via a
  non-trivial BFS logic change, plus a meaningful state-architecture refactor (lifting
  Solo state to a shared location). Two review rounds passed with thorough code tracing,
  but verify carefully on the live instance given the blast radius.
- Do not merge/modify any code. This is a build+deploy+verify task only.
- GitHub GraphQL API may still be rate-limited — prefer REST (`gh api repos/...`).

## Context
Last deploy was deploy-44, revision `farmtable-00051-l7d` (commit `e521853`) — note
deploy-45 (Perf Phase 1) may or may not have completed yet; check `git log` to see what's
actually included. PR #150 merged to `main` (squash commit
`44056dea0a9cf5987b03a1160d4bce1db6ffb4ce`) — Feature 66:
1. Solo mode state now persists when switching between Tree View and Dependency View
   (previously reset per-view).
2. `&solo=1` URL param added for Solo-mode deep-linking (alongside existing `?task=`/
   `?view=`).
3. **Bug fix**: Dependency View Solo mode was showing extraneous nodes/edges not on the
   selected task's actual blocking chain — root cause was a shared BFS visited-set bug
   that silently broke the downstream (BLOCKS) traversal. Now fixed with per-direction
   visited sets.

## Task
1. Confirm exactly what's new: `git log --oneline origin/main` since `e521853` (or since
   whatever deploy-45 landed, if it completed first — check for it).
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same pattern as recent deploys.
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Verify Feature 66 on the live instance**:
   a. Select a task with real BLOCKS/BLOCKED_BY relationships in Dependency View (find a
      collection with actual dependency chains — check recent collections used for
      Feature 61v2/64 testing, or the ones referenced in
      `/scion-volumes/scratchpad/projects/farmtable/bug-report-solo-dependency-extraneous-nodes.png`
      if that same collection/data still exists). Toggle Solo ON — confirm ONLY the
      actual upstream/downstream chain nodes and edges appear, no extraneous siblings or
      unrelated nodes (this is the core bug fix — verify it directly against ptone's
      original report, not just a synthetic test).
   b. With Solo ON in Dependency View, switch to Tree View — confirm Solo is still ON for
      the same task (sticky state).
   c. Switch back to Dependency View — confirm Solo still ON, still correctly filtered.
   d. Un-solo — confirm it clears in both views, URL `&solo=1` removed.
   e. Confirm no Solo-related side effects in Kanban/Ready Queue/Dashboard.
   f. Confirm `&solo=1` URL deep-link works (paste a URL with task+view+solo params into a
      fresh browser context, confirm it loads correctly soloed).
5. Regression check: confirm normal (non-Solo) Tree/Dependency View browsing, task
   deep-links (Feature 62), and default-view routing (Feature 63) still work.
6. Report every check's pass/fail explicitly — this bug fix matters to ptone, don't
   summarize away a partial failure.

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Explicit pass/fail evidence for the checks above, especially (a) the core bug-fix
   verification against real chain data. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-24-deploy-46/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-24-deploy-46.md`.
4. A message to the coordinator with revision ID, commit SHA, and explicit pass/fail on
   each check.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` — message immediately if anything
  looks broken.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify Feature 66 live with real evidence (especially the core
extraneous-nodes bug fix against real data), produce the log, and message the coordinator
with a clear per-check pass/fail. Then signal task_completed.
