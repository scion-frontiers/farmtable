# Brief: Deploy latest `main` to Cloud Run (deploy-47) — Periodic Redraw Fix

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-47 -b deploy-47-snapshot origin/main`
  (standing policy).
- **MODERATE-RISK DEPLOY** — this fixes a genuine bug ptone reported (periodic UI
  redraw), verified via a thorough root cause analysis and independent review, but it
  touches the GitHub passthrough polling path and the universal `TaskStore.upsert()`
  equality check used by ALL tasks (native + external) — verify carefully that native
  Farmtable tasks are unaffected, not just GitHub-sourced ones.
- Do not merge/modify any code. This is a build+deploy+verify task only.
- GitHub GraphQL API may still be rate-limited — prefer REST (`gh api repos/...`).

## Context
Last deploy was deploy-46, revision `farmtable-00053-brh` (commit `44056de`). Since then,
PR #151 merged to `main` (squash commit `d1a061cc217e1f5c23953bb1b744e8cf444ebad6`) — fixes
the periodic UI redraw bug ptone reported. Root cause: two sources of non-determinism in
the GitHub passthrough polling path defeated the Feature 55 `upsert()` equality check —
(1) `ClosedAt` was fabricated as `time.Now()` on every poll for closed GitHub issues
instead of using GitHub's real close timestamp, now fixed with a fallback to
`UpdatedAt.Time` if `ClosedAt` is somehow null, (2) `JSON.stringify`-based equality was
sensitive to non-deterministic key ordering in `remoteData` (from Go map serialization),
now fixed with a `stableStringify()` that sorts keys recursively. Full root cause doc:
`/scion-volumes/scratchpad/projects/farmtable/reports/periodic-redraw-v2-evidence/root-cause-analysis.md`

## Task
1. Confirm exactly what's new: `git log --oneline origin/main` since `44056de`.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same pattern as recent deploys.
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Verify the fix on the live instance — THIS IS THE CORE TASK**:
   a. Find or use a collection with GitHub-passthrough tasks (external, linked
      collection). Open it and watch for at least 2 full poll cycles (30-45+ seconds —
      poll interval is 15s for writable / 30s for read-only external collections). Use
      DevTools/a MutationObserver or similar to detect whether the view re-renders when
      the underlying data hasn't actually changed.
   b. Confirm closed GitHub issues in that collection show a stable, correct `closedAt`
      timestamp (not changing between polls, and matching the issue's actual GitHub
      close time if you can cross-check via `gh issue view`).
   c. Confirm a native (non-GitHub) Farmtable collection is unaffected — no new flicker
      introduced, normal behavior preserved.
5. Regression check: confirm Feature 66 (Solo, deployed last revision) and other recent
   features still work — quick smoke test, not exhaustive re-verification.
6. Report every check's pass/fail explicitly — this is a real bug fix ptone is waiting on,
   don't summarize away a partial failure.

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Explicit pass/fail evidence for the checks above, especially confirmation the redraw
   is actually gone across multiple poll cycles on a real GitHub-passthrough collection.
   Saved under `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-24-deploy-47/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-24-deploy-47.md`.
4. A message to the coordinator with revision ID, commit SHA, and explicit pass/fail on
   each check.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` — message immediately if anything
  looks broken.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify the redraw is actually fixed on a real GitHub-passthrough
collection across multiple poll cycles, confirm native tasks unaffected, produce the log,
and message the coordinator with a clear per-check pass/fail. Then signal task_completed.
