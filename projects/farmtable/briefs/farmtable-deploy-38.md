# Brief: Deploy latest `main` to Cloud Run (deploy-38) — Feature 61 (Solo tree view mode)

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-38 -b deploy-38-snapshot origin/main`
  (standing policy).
- **LOW-RISK DEPLOY** — a single, narrowly-scoped UI feature (Tree View only), reviewed
  twice (round 1 + round 2), no auth/backend changes involved.
- Do not merge/modify any code. This is a build+deploy+verify task only.
- GitHub GraphQL API may still be rate-limited — prefer REST (`gh api repos/...`).

## Context
Last deploy was deploy-37, revision `farmtable-00043-w5m` (commit `5c05b0d`). Since then,
PR #140 merged to `main` (squash commit `0cf1f4b4c16422937917299bde8823344486e270`):
Feature 61 — a "Solo" toggle for the Tree View that filters the visible tree to just the
selected task + its descendants. Two review rounds passed, all nitpicks fixed, label
renamed from "Isolate" to "Solo" per ptone's preference.

## Task
1. Confirm exactly what's new: `git log --oneline origin/main` since `5c05b0d`.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same pattern as deploy-37 (check
   `deploy/2026-07-23-deploy-37.md` for exact commands/flags).
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Verify Feature 61 works end-to-end on the live instance** (Playwright against the
   deployed URL, since this is a genuinely new UI behavior worth live-checking, not just a
   backend no-op):
   a. Open the Tree View on a collection with a multi-level hierarchy, select a
      mid-hierarchy task, confirm the "Solo" button appears and is enabled.
   b. Click "Solo" — confirm the tree filters to show only the selected task + its
      descendants (capture the visible node count before/after, similar to the dev's
      original evidence).
   c. Click "Solo" again (or deselect) — confirm it returns to the full tree.
   d. Confirm no console errors and the button label reads "Solo" (not "Isolate").
5. Also do a basic regression smoke check: confirm normal Tree View browsing (without
   Solo) still works — pan/zoom/minimap/highlight from prior features unaffected.
6. Report every check's pass/fail explicitly.

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Explicit pass/fail evidence for the checks above, with node-count evidence for the
   Solo toggle specifically. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-23-deploy-38/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-23-deploy-38.md`.
4. A message to the coordinator with revision ID, commit SHA, and explicit pass/fail on
   each check.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` — message immediately if anything
  looks broken.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify Feature 61 live with real evidence (node counts, not just a
screenshot), produce the log, and message the coordinator with a clear per-check
pass/fail. Then signal task_completed.
