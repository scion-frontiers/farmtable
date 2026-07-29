# Brief: Engineering Manager — Feature 37: Scroll/Frame-to-Item on Navigation, Dim Overlay if Not in View

## Critical Constraints (read first)

- **DEPENDS ON FEATURE 36** (independent vertical scroll for main content) — do not start
  until Feature 36 has merged to `main`. Base your branch off `main` AFTER that merge, not
  before, so you have the actual scroll container to work with (check
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-36-main-content-scroll.md`
  for exactly what it built — container selector, CSS approach — before designing this).
- **Only one agent runs at a time.** Never run a developer and a reviewer simultaneously.
- **You do NOT merge anything.** Push, open a PR via `gh pr create`, message the
  coordinator.
- **Reviewers must be blind** — fresh `code-reviewer` agent, `--harness claude`.
- **Exit criteria:** Round 1 fix everything (incl. nitpicks). Round 2+: stop if only
  nitpicks remain. Hard cap 5 rounds.
- **Developer harness:** try `scion start farmtable-f37-dev --type developer <task>` first.
  The `developer` template had a serious provisioning bug recently (workspace-trust dialog
  + permanent "Not logged in") — if you hit that, delete and retry once with `--type
  default` instead. Reviewer: `--harness claude` as always.
- **Real screenshots required** (md5sum-verified, genuine interaction).
- **The coordinator will NOT independently re-read your diff or re-open your
  screenshots** — your own verification is what stands.
- **INVESTIGATE BEFORE BUILDING:** find the existing "highlight" behavior for a
  jumped-to/navigated task (the user says this already works — find it, likely in the
  Relationships tab's click-to-navigate from Feature 25/34, or the command palette's
  select-and-open from Feature 31) and build on top of that existing mechanism rather than
  inventing a parallel one. Also check how the app currently determines "is task X
  currently rendered in the active view" — you may need to add this check if it doesn't
  exist (e.g. querying the DOM for a matching card element, or checking against the
  current view's filtered task list before rendering).

## Feature Spec

Generalize task-navigation behavior across ALL trigger sources (Inspector Relationships
tab click-through, command palette selection, direct URL load with a task deep-link if one
exists, any other "jump to task X" trigger) so that when a task is navigated to:

1. **If the task IS present in the currently active main view** (Kanban, Tree, Dashboard,
   Ready Queue, etc.):
   - The main view scrolls (using Feature 36's new scroll container) so the task's card/row
     comes into view.
   - For Tree view specifically: since it's a graph/canvas rather than a simple scrollable
     list, "frame" or "zoom to" the node instead of a plain scroll — check how the Tree
     view (`ft-tree-view.ts`, recently touched by the tree-view infinite-growth fix,
     commit 6a7cafe) is implemented to determine what "frame this node" should mean
     concretely (pan/zoom the SVG viewport, or similar).
   - The existing highlight behavior stays as-is — you're adding scroll/frame-into-view on
     top of it, not replacing it.
2. **If the task is NOT present in the currently active view** (e.g., current view is Ready
   Queue and the navigated-to task is a blocked/not-ready task filtered out of that list,
   or Kanban filtered by a phase/assignee that excludes it):
   - Show a dimming overlay on the main content area: 50% opacity black overlay over the
     main view (not the toolbar/Inspector), indicating "the task you navigated to isn't
     shown in this view."
   - Decide on dismissal behavior (auto-clear after a few seconds, clear on next
     interaction, or requires an explicit dismiss — use judgment, document your choice).

Explicitly OUT of scope: automatically switching the user to a different view where the
task WOULD be visible (that's a nice future enhancement, not this feature — this feature is
scroll/frame-if-visible, dim-if-not).

## Key Locations

- Repo: `/workspace/farmtable`, base off `main` AFTER Feature 36 merges — fresh feature
  branch, PR to merge.
- Frontend: `web/src/` — existing highlight/navigate-to-task code (Relationships tab click-
  through from PR #71/#83, command palette from PR #82), Feature 36's new scroll container,
  `ft-tree-view.ts` for the Tree-view framing case.
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-37-scroll-to-item.md`

## Deliverables

1. Pushed branch + open PR against `main`, confirmed CLEAN/MERGEABLE.
2. Real, distinct screenshots showing: (a) navigating to a task that's visible in the
   current view — scrolled/framed into view with highlight, (b) Tree view framing
   specifically, (c) navigating to a task NOT in the current view — dim overlay visible.
   Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-37-scroll-to-item/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-37-scroll-to-item.md`
   documenting your dismissal-behavior choice for the dim overlay and the Tree-view framing
   approach.
4. A message to the coordinator with PR URL, summary, review outcome.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the log/screenshots,
and message the coordinator. Then signal task_completed.
