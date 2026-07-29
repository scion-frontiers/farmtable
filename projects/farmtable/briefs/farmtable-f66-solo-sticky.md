# Brief: Feature 66 — Solo State Sticky Across Tree/Dependency View Switches

## Critical Constraints (read first)
- Use a dedicated git worktree: `git worktree add /workspace/farmtable-f66-solo-sticky -b
  feature/f66-solo-sticky origin/main` (standing policy).
- Local-build-first Playwright verification protocol applies.
- **Read Feature 61/61v2 history first** — Solo mode was added to Tree View (PR #140) and
  extended to Dependency View (PR #144) with a bug-fix round (PR #147 area, un-solo fix).
  Also read Feature 62 (task deep-link URLs, `?task=` param, PR #145) and Feature 63
  (default Dashboard view, PR #146) since this touches the same view-switching/URL-state
  code in `ft-app.ts`. Two other agents may have recently touched this file — rebase onto
  latest `main` before starting.
- Real, saved evidence required — screenshots showing the actual cross-view persistence,
  saved to `/scion-volumes/scratchpad/projects/farmtable/reports/f66-solo-sticky-evidence/`.

## Context
ptone@google.com requested (2026-07-24): "solo state should be sticky across parent/child
and dependency tree view - I should be able to solo view an item in parent child view -
then switch to dependency view and stay in solo on that item."

Currently, Solo mode (`isolateMode`) is implemented as local component state in both
`ft-tree-view.ts` (Feature 61) and `ft-dependency-view.ts` (Feature 61v2) — each view has
its own independent `isolateMode`/`selectedTaskId` state that resets or is irrelevant when
you switch to the other view. The request is for this to persist: if you Solo task X in
Tree View, then switch to Dependency View, Dependency View should ALSO be in Solo mode for
task X (using its own traversal rule — descendants-only for Tree View, bidirectional
connected-component for Dependency View, per each view's existing Solo semantics — the
node-set computed doesn't need to match between views, just the "Solo is ON for task X"
state needs to carry over).

## Task
1. Lift the Solo state (`isolateMode` boolean + the target task ID, which is likely just
   the existing `selectedTaskId`) up from being local to each view component to a shared
   location — most likely `ft-app.ts`, alongside the existing view-mode and selected-task
   state from Features 62/63. Pass it down as a property to whichever view
   (Tree/Dependency) is currently active.
2. When switching views (via the view-mode switcher), if Solo was ON in the previous view
   for task X, the new view should initialize with Solo ON for the same task X (each view
   computing its own node set per its own existing logic).
3. Consider whether Solo state should also be reflected in the URL (extending the
   `?task=` scheme from Feature 62 with something like `&solo=1` or similar) for
   consistency with how task selection and view mode are already URL-persisted — this
   would also make Solo-mode deep-links shareable, which seems like a natural fit. Use
   your judgment on whether this is in-scope or better left as a follow-up; if you do add
   it, make sure it doesn't conflict with the existing Feature 62/63 URL logic (check for
   merge conflicts / logic collisions since those were touched recently).
4. Confirm un-soloing in one view also correctly clears the shared state so the other view
   doesn't unexpectedly show stale Solo state.
5. Confirm this doesn't affect Kanban or Ready Queue views (Solo is Tree/Dependency only)
   — switching to/from those views should have no Solo-related side effects.

## Deliverables
1. PR against `main`.
2. Real evidence: screenshot sequence showing (a) Solo ON for task X in Tree View, (b)
   switch to Dependency View, confirm Solo is still ON for task X (with Dependency View's
   own connected-component node set), (c) switch back to Tree View, confirm still Solo'd
   on X, (d) un-solo, switch views, confirm Solo stays off in the other view too.
3. Confirm no regression to Features 61/61v2/62/63 (quick regression pass).
4. A brief report noting whether you added URL persistence for Solo state and why/why not.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for review requests, questions, or
  completion.
- Do not message ptone@google.com directly.

## Task — Part 2 (added mid-flight): fix extraneous nodes/edges in Dependency View Solo mode
ptone reported a bug (2026-07-24, screenshot at
`/scion-volumes/scratchpad/projects/farmtable/bug-report-solo-dependency-extraneous-nodes.png`):
Solo mode in Dependency View shows nodes and edges that are NOT actually part of the
selected node's blocking/blocked-by chain — extraneous "neutral" cross-edges (rendered
dashed blue in the screenshot) between nodes that aren't on any real path to/from the
selected node. Fix the bidirectional connected-component traversal (and edge
classification) in `ft-dependency-view.ts` so ONLY nodes on an actual directed path to/from
the selected node are included, and only the real chain edges are drawn. Verify with a
reproduction matching the bug's shape (multi-column graph with siblings) and
before/after evidence showing the extraneous nodes+edges are gone. Include this fix in the
same PR as the sticky-Solo-state work.

## Termination
You MUST make Solo state persist across Tree View / Dependency View switches, fix the
extraneous nodes/edges bug in Dependency View Solo mode, verify with real evidence showing
both the cross-view behavior and the corrected node/edge set, confirm no regressions, open
a PR, and message the coordinator with the PR link and evidence summary. Then signal
task_completed.
