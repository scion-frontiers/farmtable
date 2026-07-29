> **FREEZE IN FORCE 2026-07-29 — NO DELETION, PRUNING, TIDYING OR SAFE-TO-DELETE CLASSIFICATION OF ANY TREE, WORKTREE, REGISTRATION OR STORE UNTIL THE COORDINATOR LIFTS IT. THIS FILE CONTAINS INSTRUCTIONS THAT PREDATE THE FREEZE AND MUST NOT BE FOLLOWED.**

# Brief: Engineering Manager — Feature 34: Ready Queue View

## Critical Constraints (read first)

- **Runs IN PARALLEL with Feature 33** (collapsible inspector sections). Use your own
  worktree: `git worktree add /workspace/farmtable-f34-ready-queue -b feat/ready-queue-view origin/main`
  (from `/workspace/farmtable`, after `git fetch origin`). Rebase onto latest main and
  confirm CLEAN/MERGEABLE before opening your PR.
- **Only one agent runs at a time within THIS feature's cycle.**
- **You do NOT merge anything.** Push, open PR, message the coordinator.
- **Reviewers must be blind** — fresh `code-reviewer` agent, `--harness claude`.
- **Exit criteria:** Round 1 fix everything. Round 2+: stop if only nitpicks remain. Cap 5
  rounds.
- **Developer harness:** no `--harness` flag on `scion start farmtable-f34-dev --type
  developer <task>` — inherit the current project default. Reviewer: `--harness claude`.
- **The coordinator will NOT independently re-read your diff or re-open your
  screenshots** — your own verification is what stands.
- **Real screenshots required.**
- **INVESTIGATE BEFORE BUILDING — this determines the feature's actual size.** Per the
  source report, the key open question is whether `TaskStore` makes `blockedBy`
  relationship data queryable GLOBALLY (across all tasks at once, e.g. already loaded as
  part of each task object from `ListTasks`/`WatchTasks`) or only PER-TASK (fetched
  on-demand when opening a single task's inspector, per Feature 25's Relationships tab).
  - If globally available already: this is a **Small**, pure-frontend feature.
  - If only per-task: you'd need either a new aggregating RPC or expensive per-task
    fetches for every task to compute "blocked" status app-wide. **Do not build a new
    backend RPC without checking in with the coordinator first** — report your finding and
    proposed approach, and get confirmation before adding new backend surface, since this
    could turn a Small UI feature into a Medium+ backend+frontend one.

## Feature Spec

Source: item #4 in `/scion-volumes/scratchpad/projects/farmtable/reports/watcher-frontend-comparison.md`
("Ready Queue View").

Add a Ready Queue view: a flat, priority-sorted list of tasks that are open or in-progress
AND not blocked by any open dependency (i.e., all of a task's `BLOCKED_BY` relationships
point to already-closed/done tasks, or it has none).

Each row: priority badge, type icon, ID, title, labels, and a "Blocks N" badge showing how
many other tasks would be unblocked if this one completes (i.e. count of tasks that have a
`BLOCKED_BY` relationship pointing at this task, still open themselves).

- Add this as a new view/entry-point in the toolbar, consistent with however Feature 29's
  icon-based switcher and Feature 22's routing work (check those PRs — if merged by the
  time you start, follow their pattern; if not yet merged, use a reasonable interim toolbar
  button and note that it should be folded into the icon switcher once Feature 29 lands).
- Use the reusable `<ft-empty-state>` component from Feature 30 for the "nothing ready"
  empty case, if that PR has merged by the time you build this — check first; if not merged
  yet, use a simple inline message and note the follow-up to adopt the shared component.

Explicitly OUT of scope: the Blocked view (item #5) and Dependency Graph view (item #6)
from the same report — those are separate, not-yet-requested features; don't build them
speculatively even though they share the same data prerequisite.

## Key Locations

- Work in `/workspace/farmtable-f34-ready-queue` (your own worktree).
- Frontend: `web/src/` — `TaskStore`, `ft-inspector-relationships.ts` (Feature 25,
  `gh pr diff 71`) for how relationship data is currently fetched/shaped — this is your
  starting point for the investigate-first question above.
- Data model: `proto/farmtable.proto` — `Task.relationships`, `Relationship` message
  (type enum including `BLOCKS`/`BLOCKED_BY`).
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-34-ready-queue.md`

## Deliverables

1. Investigate-first finding reported to the coordinator BEFORE committing to an
   implementation approach (per the constraint above).
2. Pushed branch + open PR against `main`, confirmed CLEAN/MERGEABLE.
3. Real, distinct screenshots showing: (a) the Ready Queue with real ready tasks and
   correct "Blocks N" badges, (b) the empty state when nothing is ready. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-34-ready-queue/`
4. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-34-ready-queue.md`.
5. A message to the coordinator with PR URL, summary, review outcome.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/conflict/quota
  reports, and REQUIRED before adding any new backend RPC per the investigate-first
  constraint.
- Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the log/screenshots,
clean up your worktree post-merge, and message the coordinator. Then signal task_completed.
