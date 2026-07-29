# Brief: Deploy latest `main` to Cloud Run (deploy-42) — Feature 63 (Default Dashboard View)

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-42 -b deploy-42-snapshot origin/main`
  (standing policy).
- **LOW-RISK DEPLOY** — UI-only routing/default-view change, two review rounds (one
  caught and fixed a real regression against Feature 62), real evidence throughout.
- Do not merge/modify any code. This is a build+deploy+verify task only.
- GitHub GraphQL API may still be rate-limited — prefer REST (`gh api repos/...`).

## Context
Last deploy was deploy-41, revision `farmtable-00048-zgz` (commit `65deb12`). Since then,
PR #146 merged to `main` (squash commit `eef367b29fcca7b224c31184549bc545db3f71fe`) —
Feature 63:
1. Default view (no `?view=` URL param) changed from Kanban to Dashboard.
2. View switcher reordered: Dashboard now leftmost, before Kanban.
3. Dashboard's icon changed from `bar-chart-line` to `grid`.
4. **Important interaction fix**: task deep-links (`?task=` present, Feature 62) with NO
   explicit `?view=` still default to Kanban (not Dashboard), since Dashboard doesn't
   support task centering/highlighting — this preserves Feature 62's UX. Only plain
   collection navigation (no task param) defaults to Dashboard.

## Task
1. Confirm exactly what's new: `git log --oneline origin/main` since `65deb12`.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same pattern as deploy-41.
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Verify Feature 63 works end-to-end on the LIVE instance** (Playwright against the
   deployed URL):
   a. Navigate to a collection URL with NO `?view=` and NO `?task=` param — confirm
      Dashboard loads.
   b. Confirm the view switcher shows Dashboard first (leftmost), before Kanban, with a
      grid icon.
   c. Navigate to a collection URL with `?task=<id>` and NO `?view=` param — confirm it
      lands on KANBAN (not Dashboard), with the task selected/highlighted and Inspector
      open, no dim overlay. This is the specific regression that was caught and fixed —
      verify it carefully.
   d. Confirm explicit `?view=` params (kanban, tree, dependencies, dashboard) still all
      work correctly, including `?view=dashboard&task=<id>` if worth checking.
5. Basic regression check: confirm normal view switching, task selection, and the
   Feature 62 deep-link flows from deploy-41 still work.
6. Report every check's pass/fail explicitly.

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Explicit pass/fail evidence for the checks above, especially (c) the deep-link
   fallback-to-kanban behavior. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-23-deploy-42/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-23-deploy-42.md`.
4. A message to the coordinator with revision ID, commit SHA, and explicit pass/fail on
   each check.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` — message immediately if anything
  looks broken.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify Feature 63 live with real evidence (especially the task-deep-link
fallback behavior), produce the log, and message the coordinator with a clear per-check
pass/fail. Then signal task_completed.
