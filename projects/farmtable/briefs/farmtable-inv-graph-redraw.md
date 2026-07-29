# Brief: Investigate — Periodic Background Refresh Causes Full Graph View Redraw + Re-Zoom

## Critical Constraints (read first)
- Use a dedicated git worktree: `git worktree add /workspace/farmtable-inv-graph-redraw -b
  explore/graph-redraw origin/main` (standing policy — farmtable-em-f59 is active in its
  own worktree, this avoids collision).
- **Investigation only — do not fix anything yet.** Produce findings; the coordinator will
  dispatch a fix EM based on scope.
- Use the local-first verification protocol
  (`/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`) to reproduce.

## Context (ptone@google.com, verbatim)

"there is some periodic refresh in the background that is causing the entire graph view to
redraw (and re-zoom into selected task)"

This is about the Tree view and/or Dependency view (the "graph view(s)" — check which one(s)
are affected, could be both). Related but distinct history:
- Feature 55 (PR #132) fixed a periodic-poll flicker in the Kanban board / toolbar Refresh
  button, by adding an equality check to `TaskStore.upsert()` so `tasks-changed` events
  don't fire when poll data is unchanged. That fix may not fully cover the graph views'
  specific re-render trigger, or the graph views may listen to a different event/path.
- Feature 41/56/58 built and then had to fix a selection-triggered zoom/pan animation
  (750ms ease-in-out, ~20% viewport target). If something is causing that animation to
  RE-TRIGGER on every poll tick (not just on actual user selection), that would exactly
  match the reported symptom ("re-zoom into selected task").

## Task

1. **Reproduce**: open a writable GitHub-backed collection (which has the 15s poll from
   Phase 1 of the write-through project) in the Tree view or Dependency view, select a
   task (triggering the zoom/pan animation once), then wait and observe across multiple
   poll cycles (~30-45s) without touching anything. Confirm whether the view redraws/
   re-zooms on its own periodically. Also check if this happens on NATIVE (non-external)
   collections, which use streaming/WatchTasks rather than polling — if it happens there
   too, the root cause is different (not poll-specific).
2. **Trace the trigger**: find what event/state change causes the graph view component to
   re-render its full layout AND re-run the zoom-to-selection logic. Likely candidates:
   - The view's Lit `render()`/`updated()` lifecycle reacting to a `tasks-changed` or
     similar event/property change that fires even when data is unchanged (check if
     Feature 55's equality check in `TaskStore.upsert()` actually applies to whatever event
     the graph views listen to, or if they use a different path).
   - The zoom/pan-to-selection logic (Feature 41/56/58) being invoked from a code path that
     runs on every re-render rather than only on an actual NEW selection event (e.g. if
     `selectedTaskId` is read reactively and the animation trigger isn't properly gated to
     only fire on a genuine CHANGE to that value).
3. **Determine scope**: does this affect both the Tree view and Dependency view, or just
   one? Is it specific to writable/polling external collections, or does it also happen on
   native streaming collections?

## Deliverables

1. A findings report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/graph-redraw-investigation.md`:
   whether reproduced, exact root cause with file/line references, scope (which views,
   which collection types affected), and a fix recommendation with scope estimate.
2. A message to the coordinator with the root cause summary and recommendation.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` with findings.
- Do not message ptone@google.com directly.

## Termination
You MUST reproduce (or rule out) the issue, find the root cause, produce the report, and
message the coordinator. Then signal task_completed.
