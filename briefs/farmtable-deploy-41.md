# Brief: Deploy latest `main` to Cloud Run (deploy-41) — Feature 62 (Task Deep-Links)

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-41 -b deploy-41-snapshot origin/main`
  (standing policy).
- **LOW-RISK DEPLOY** — UI-only routing change, reviewed, with real verified evidence
  (screenshots + JSON log at
  `/scion-volumes/scratchpad/projects/farmtable/reports/f62-task-urls-evidence/` — read
  this for context on what was already tested locally, then re-verify live).
- Do not merge/modify any code. This is a build+deploy+verify task only.
- GitHub GraphQL API may still be rate-limited — prefer REST (`gh api repos/...`).

## Context
Last deploy was deploy-40, revision `farmtable-00047-w29` (commit `aff98a2`). Since then,
PR #145 merged to `main` (squash commit `65deb12ef92c00a40d2b8b6b4d66b1e2712798f5`) —
Feature 62: task-level deep-linking via `?task=<taskId>` URL query param. Loading a URL
with this param selects the task, centers/zooms the Tree or Dependency view on it, and
opens the Inspector. Manually selecting a task/opening the Inspector updates the URL to
match (shareable). Works for Tree View and Dependency View; Kanban updates the URL but
doesn't scroll-to-card (documented limitation, not a bug).

## Task
1. Confirm exactly what's new: `git log --oneline origin/main` since `aff98a2`.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same pattern as deploy-40.
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Verify Feature 62 works end-to-end on the LIVE instance** (Playwright against the
   deployed URL — this is the first live test of this feature, local evidence already
   exists but hasn't been confirmed against the real deployed environment/IAP):
   a. Select a task in Tree View, capture the resulting URL (should include `?task=`).
   b. Open that captured URL in a FRESH browser context, confirm: correct task selected,
      view centered/zoomed on it, Inspector open with correct task details.
   c. Repeat for Dependency View.
   d. Close the Inspector, confirm `?task=` is removed from the URL.
   e. Switch collections, confirm no stale `?task=` param leaks into the new collection's
      URL/state.
5. Basic regression check: confirm normal (non-deep-link) navigation still works
   (selecting tasks, switching views, etc.) — this feature touches core app routing so a
   quick regression pass is worthwhile.
6. Report every check's pass/fail explicitly.

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Explicit pass/fail evidence for the checks above (screenshots for the fresh-context
   deep-link scenarios especially). Saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-23-deploy-41/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-23-deploy-41.md`.
4. A message to the coordinator with revision ID, commit SHA, and explicit pass/fail on
   each check.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` — message immediately if anything
  looks broken.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify Feature 62 live with real evidence (especially the fresh-context
deep-link round trip), produce the log, and message the coordinator with a clear per-check
pass/fail. Then signal task_completed.
