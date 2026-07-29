# Brief: Feature 61 — Isolate/Solo Mode for Tree View

## Critical Constraints (read first)
- Use a dedicated git worktree: `git worktree add /workspace/farmtable-f61-isolate -b
  feature/f61-isolate-mode origin/main` (standing policy — always worktree, never the
  shared `/workspace/farmtable` checkout).
- **Local-build-first Playwright verification protocol applies** — do local verification
  first (SQLite mode, `FARMTABLE_DB_DIALECT=sqlite3`, `ft dashboard` against the
  pre-seeded `web-test/farmtable.db`), reserve live Cloud Run checks only for things local
  can't prove. See `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`
  and `HANDOFF-METHODOLOGY.md`.
- **Real evidence required** — this project has a strict, well-established evidence bar.
  Screenshots must show GENUINELY DISTINCT states (not duplicate/byte-identical captures
  passed off as before/after). Prefer capturing the actual DOM node-count or visible-node
  list alongside screenshots, since that's harder to fake than an image. Several past
  features got sent back for exactly this (duplicate screenshots, or screenshots that
  didn't actually differ) — don't be the next one.
- Scope is the **Tree View only** for this feature. Do NOT touch Kanban, Ready Queue, or
  Dependency View — if you think isolate-mode makes sense there too, note it as a
  follow-up suggestion in your final report, don't implement it.

## Context
ptone@google.com requested (2026-07-23): "we want a feature to 'solo' or 'isolate' the
selected task in the tree view - such that the graph is sectioned to only to nodes with
traversable connections to the selected task. For example - in parent-child tree -
selecting a node and switching to 'isolate' mode - would only only show descendants of
that node."

The Tree View (`web/src/components/ft-tree-view.ts`) currently renders the full
parent-child hierarchy for the collection, with the selected task highlighted, animated
pan/zoom centering on selection (Feature 41/58), and a minimap (Feature 54). Relevant
recent history you should be aware of before touching this component:
- Feature 56 (zoom-to-target-size + prominent highlight on selection)
- Feature 58 (restored combined pan+zoom animation, regression-fixed)
- Feature 60 (fixed dependency-view redraw/re-zoom on poll ticks — similar poll-tick
  redraw issue could apply here, be careful your isolate-mode toggle doesn't get wiped out
  by the 15s poll refresh; check how `poll-manager.ts` / `snapshotComplete()` interact with
  view state)

## Task
1. Add an **"Isolate" toggle control** to the Tree View (a button/icon near the existing
   view controls — look at how the view-mode switcher (Feature 29) and minimap toggle are
   placed for a consistent UI pattern). Suggested icon: a "focus"/"target" or "solo"-style
   icon; label it clearly (e.g., "Isolate" or "Solo").
2. **Behavior when a task is selected and Isolate mode is ON**:
   - Compute the set of DESCENDANTS of the selected task (all nodes reachable by
     following parent→child edges downward from the selected node) — per the user's
     explicit example, this means descendants only, NOT ancestors.
   - Re-render the tree showing ONLY the selected node + its descendants (hide/remove all
     other nodes and their connecting edges from the rendered graph).
   - If the selected task has no children, isolate mode should show just that single node.
3. **Behavior when selection changes while Isolate mode is ON**: re-compute and re-render
   for the newly selected node's descendant set (don't require toggling isolate off/on
   again).
4. **Behavior when Isolate mode is toggled OFF**: return to showing the full tree,
   preserving the current selection/highlight.
5. **Interaction with existing features**: the animated pan/zoom-to-selection, minimap,
   and prominent highlight should all continue to work correctly with the filtered
   (isolated) node set. The minimap in particular should either reflect the filtered view
   or be reasoned about explicitly in your report if you decide it should still show the
   full tree for orientation (your call, document the reasoning).
6. **Persist or reset on poll ticks**: confirm isolate mode state survives the 15s
   background poll refresh (shouldn't silently reset to full-tree view on a poll tick) —
   this is exactly the class of bug fixed in Feature 55/60, don't reintroduce it.

## Deliverables
1. PR against `main` with the isolate-mode feature.
2. Real evidence: local Playwright screenshots showing (a) full tree with a mid-hierarchy
   node selected, isolate OFF, (b) same node with isolate ON showing only it + descendants
   — these two states MUST be visibly and structurally different (different node counts —
   report the actual visible node count in each state, not just a screenshot). Also show
   (c) toggling isolate OFF again returns to the full tree. Also verify/report (d) isolate
   mode survives a poll tick (wait >15s with isolate on, confirm it's still isolated).
3. A brief written report (in your final message or a short file) confirming each
   behavior above was tested, with the node-count evidence.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for review requests, questions, or
  completion.
- Do not message ptone@google.com directly — relay any genuine design questions through
  the coordinator.

## Termination
You MUST implement the feature, verify all behaviors above with real evidence (including
quantitative node-count checks, not just screenshots), open a PR, and message the
coordinator with the PR link and evidence summary. Then signal task_completed.
