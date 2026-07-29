# Brief: Deploy latest `main` to Cloud Run (deploy-54) — Inspector External Link + Tractor Favicon

## Critical Constraints (read first)
- Dedicated git worktree: `git worktree add /workspace/farmtable-deploy-54 -b deploy-54-snapshot origin/main`
- Check `scion list` yourself before starting — stop and message the coordinator if
  another `farmtable-deploy-*` agent is already running.
- Do not merge/modify any code. Build+deploy+verify only.

## Context
Last deploy was deploy-53, revision `farmtable-00060-cxw` (commit `773fb00`). Since then,
two PRs merged to `main`:
1. **PR #161** (merge commit `f7246a23fcdcd6251e295171e953e61430994fc6`) — Feature 69:
   adds a platform-agnostic "External Source" row to the Inspector General tab that
   conditionally renders when a task has `remoteUrl` set (currently populated for
   GitHub-sourced tasks). Native tasks show no such row.
2. **PR #162** (merge commit `0697a71176722e23c1be40c19b57ab6c2191ac22`) — Feature 70:
   adds an SVG favicon (`web/public/favicon.svg`) rendering the tractor emoji (🚜),
   wired up via a `<link rel="icon">` tag in `web/index.html`.

## Task
1. Confirm what's new: `git log --oneline origin/main` since `773fb00`.
2. Build and deploy to the `farmtable` Cloud Run service, project `deploy-demo-test`,
   region `us-central1`.
3. Verify live and serving 100% traffic.
4. **Verify Feature 69 (Inspector external link)**:
   a. Open a GitHub-sourced task's Inspector (check for an existing GitHub-mirrored
      collection, e.g. one referencing `scion-frontiers/farmtable` used in earlier
      testing this session) — confirm an "External Source" row with a working link
      pointing to the correct GitHub issue URL appears.
   b. Open a native (non-external) task's Inspector — confirm NO external source row
      appears.
5. **Verify Feature 70 (favicon)**:
   a. Load the site and confirm the browser tab shows the tractor emoji favicon (take a
      screenshot showing the actual browser tab, not just the raw SVG).
6. Regression check: Kanban auto-scroll (deploy-53), Dependency View fixes (deploy-49/51/52),
   Feature 67 layout toggle (deploy-50), Dashboard — quick spot checks, not exhaustive.
7. Report every check's pass/fail explicitly.

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified.
2. Explicit pass/fail evidence with real screenshots, saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-24-deploy-54/`
3. A deploy log at `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-24-deploy-54.md`.
4. A message to the coordinator with revision ID, commit SHA, and pass/fail per check.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` if anything looks broken.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify both Feature 69 and Feature 70 live with real evidence, confirm
no regressions, produce the log, and message the coordinator with a clear per-check
pass/fail. Then signal task_completed.
