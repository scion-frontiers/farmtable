# Brief: Deploy latest `main` to Cloud Run (deploy-40) — Feature 61 v2

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-40 -b deploy-40-snapshot origin/main`
  (standing policy).
- **LOW-RISK DEPLOY** — UI-only changes (Tree View + Dependency View components), two
  review rounds passed, all findings addressed. No backend/auth/infra changes.
- Do not merge/modify any code. This is a build+deploy+verify task only.
- GitHub GraphQL API may still be rate-limited — prefer REST (`gh api repos/...`).

## Context
Last deploy was deploy-39, revision `farmtable-00046-676` (commit `cc9d118`). Since then,
PR #144 merged to `main` (squash commit `aff98a2be87e3a08b1e594b05654ed8c20c9bb74`) —
Feature 61 v2, three parts:
1. **Bug fix**: un-soloing (toggling Solo off) in Tree View now correctly returns to the
   full tree (was previously broken — a redundant cache-clearing call was interfering).
2. **Dependency View Solo mode**: same Solo toggle concept as Tree View, but with
   bidirectional traversal (shows the selected node's full connected component via
   BLOCKS/BLOCKED_BY edges in both directions, not just descendants).
3. **Edge color-coding**: when a node is selected in Dependency View, edges to blocking
   tasks render red-orange (`#D55E00`), edges to blocked-by tasks render blue-purple
   (`#7B3FF2`) — colorblind-accessible, works with Solo mode on or off, and the color
   cache now correctly invalidates on poll/SSE-driven relationship changes (not just
   selection changes).

## Task
1. Confirm exactly what's new: `git log --oneline origin/main` since `cc9d118`.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same pattern as deploy-39.
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Verify all 3 parts work end-to-end on the live instance** (Playwright against the
   deployed URL):
   a. Tree View: select a mid-hierarchy task, toggle Solo ON (confirm filtered), toggle
      Solo OFF (confirm full tree ACTUALLY returns — this is the specific bug being
      fixed, don't skip verifying it).
   b. Dependency View: select a task with both blocking and blocked-by relationships,
      toggle Solo ON (confirm it shows the connected component in both directions, not
      just one), toggle OFF (confirm full graph returns).
   c. Dependency View: with a task selected (Solo can be either on or off), confirm
      edges render with the correct colors (red-orange for blocking, blue-purple for
      blocked-by) — capture actual color values if possible (e.g. via computed style),
      not just a visual screenshot.
   d. Confirm edge colors update correctly after a poll tick if relationships change
      (or at minimum, confirm no stale/incorrect colors persist across a poll cycle with
      the same data — full live relationship-change testing may not be practical, use
      judgment on how deep to go here).
   e. Confirm no console errors and no regression to normal (non-Solo) browsing in either
      view.
5. Report every check's pass/fail explicitly.

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Explicit pass/fail evidence for the checks above, with node-count/color evidence
   where applicable (not just screenshots). Saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-23-deploy-40/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-23-deploy-40.md`.
4. A message to the coordinator with revision ID, commit SHA, and explicit pass/fail on
   each check.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` — message immediately if anything
  looks broken.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify all 3 parts live with real evidence (especially the un-solo bug
fix), produce the log, and message the coordinator with a clear per-check pass/fail. Then
signal task_completed.
