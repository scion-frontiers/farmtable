> **FREEZE IN FORCE 2026-07-29 — NO DELETION, PRUNING, TIDYING OR SAFE-TO-DELETE CLASSIFICATION OF ANY TREE, WORKTREE, REGISTRATION OR STORE UNTIL THE COORDINATOR LIFTS IT. THIS FILE CONTAINS INSTRUCTIONS THAT PREDATE THE FREEZE AND MUST NOT BE FOLLOWED.**

# Brief: Engineering Manager — Feature 25: Inspector Tabs (General + Relationships)

## Critical Constraints (read first)

- **THIS FEATURE RUNS IN PARALLEL WITH FEATURE 24** (inspector date-field
  2x2 grid), which touches the SAME Inspector component area. The
  coordinator expects a real chance of merge conflict between the two —
  that's an accepted, anticipated risk. Use your own worktree:
  ```
  cd /workspace/farmtable
  git fetch origin
  git worktree add /workspace/farmtable-f25-inspector-tabs -b feat/inspector-tabs origin/main
  ```
  Do ALL work from `/workspace/farmtable-f25-inspector-tabs`. See
  `/scion-volumes/scratchpad/projects/farmtable/reports/worktree-experiment.md`
  for the validated pattern. Clean up the worktree after merge confirmation.
- **Treat the existing Inspector content as a black box to WRAP, not
  rewrite.** Feature 24 is concurrently changing the internal markup of
  the date fields specifically. To minimize collision: move/wrap the
  EXISTING content (whatever it currently renders, including however
  Feature 24 may have already changed the date fields if it merges
  first) into a "General" tab container, rather than re-implementing or
  reordering the content itself. Add tab-switching chrome around it, not
  through it.
- **Before opening the PR, rebase onto latest origin/main and confirm `gh
  pr view <n> --json mergeStateStatus,mergeable` shows CLEAN/MERGEABLE.**
  If Feature 24 has already merged by the time you're ready, you WILL
  likely need to resolve a conflict — expected. Follow the Feature 19
  precedent: rebase onto latest main, resolve by hand (read Feature 24's
  actual merged diff via `gh pr diff` before resolving, don't guess),
  re-verify build, confirm CLEAN/MERGEABLE before reporting ready.
- **Only one agent runs at a time within THIS feature's own cycle.**
  Feature 24 running concurrently in its own worktree is expected.
- **You do NOT merge anything.** Push, open a PR, message the coordinator.
  The coordinator sequences the two merges deliberately if needed.
- **Reviewers must be blind** — fresh `code-reviewer` agent per round.
- **Exit criteria:** Round 1 fix everything (incl. nitpicks). Round 2+:
  stop if only nitpicks remain. Hard cap 5 rounds.
- **Agents:** Developer `scion start farmtable-f25-dev --type developer
  <task>` (no `--harness`, default codex). Reviewer `scion start
  farmtable-f25-review-rN --type code-reviewer --harness claude <task>`.
- **The coordinator will NOT independently re-read your diff or re-open
  your screenshots** — your own verification is what stands.
- **INVESTIGATE BEFORE BUILDING the Relationships tab specifically:**
  the data model has `Task.parent_task_id` (hierarchy, up to 8 levels)
  and `repeated Relationship relationships` on Task (non-hierarchical
  dependency/semantic links — check `proto/farmtable.proto` for the
  `Relationship` message shape, it likely has a type enum such as
  BLOCKS/BLOCKED_BY and a target task reference). Also check whether
  there's an existing way to fetch a task's children (tasks whose
  `parent_task_id` equals this task's id) — e.g. a `ListTasks` filter,
  or whether you need to filter client-side from already-fetched board
  data. Report your findings on RPC/data availability to the coordinator
  before committing to an implementation approach — if something needed
  (e.g. resolving a parent/child task's title from just an ID) requires
  new backend surface, scope it minimally like Features 21/23's
  investigate-first steps did; don't build a generic
  relationship-management backend, just enough to read and display.

## Feature Spec

Restructure the Inspector panel to use tabs:

- **Tab 1: "General"** — everything the Inspector currently shows (title,
  description, priority, assignee, labels, dates, comments, etc. from
  Features 4-9, 21's settings if relevant, 23's comments) moves under
  this tab, functionally unchanged. This should be the default/active tab
  on open.
- **Tab 2: "Relationships"** — new tab showing, for the currently open
  task:
  - **Parent** (if `parent_task_id` is set): the parent task's title (and
    maybe phase/status badge), read-only for now — no need to build
    reparenting UI.
  - **Children**: tasks whose `parent_task_id` equals this task's id,
    listed (title + status).
  - **Blocked by** / **Blocking**: derived from `Task.relationships`
    (filter by whatever relationship-type values exist in the proto for
    blocking semantics), listed similarly.
  - If a related task can be opened by clicking it (i.e. if there's an
    existing internal function that opens the Inspector for a given task
    id, reuse it), wire that up — but if that would require building new
    navigation/deep-linking infrastructure, skip it and just render
    plain read-only entries for this feature; don't build new
    infrastructure to satisfy a nice-to-have.
  - If a category (e.g. no parent, no children, nothing blocking) is
    empty, show a clear "None" state rather than an empty gap.
- Tab switching should be keyboard-accessible (consistent with Features
  9-11's keyboard-nav conventions) and should NOT lose in-progress edits
  in the General tab when switching tabs and back (if the user was
  mid-edit on e.g. description, don't silently discard it — either
  preserve state across tab switches or, at minimum, don't crash/corrupt
  it).

Explicitly OUT of scope:
- Editing relationships (adding/removing blocks, reparenting) — display
  only for this feature.
- Any tab beyond General and Relationships.
- The date-field 2x2 grid layout itself (Feature 24's job) — just make
  sure whatever Feature 24 built still renders correctly inside your new
  General tab wrapper.

## Key Locations

- Work in `/workspace/farmtable-f25-inspector-tabs` (your own worktree).
- Frontend: `web/src/components/inspector/` — the Inspector component
  tree from Features 4, 5, 6, 7, 8, 9, 21, 23 (`gh pr diff` on any of
  those PR numbers for reference/conventions).
- Data model: `proto/farmtable.proto` — `Task.parent_task_id`,
  `Task.relationships`, `message Relationship` (check its exact fields —
  likely a type enum + target task id).
- Prior investigation reports for data-model grounding:
  `/scion-volumes/scratchpad/projects/farmtable/reports/investigation-collection-model.md`,
  `investigation-comments-model.md` (for citation style/expectations).
- Worktree pattern reference:
  `/scion-volumes/scratchpad/projects/farmtable/reports/worktree-experiment.md`
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-25-inspector-tabs.md`

## Deliverables

1. Pushed branch + open PR against `main`, confirmed CLEAN/MERGEABLE
   right before reporting ready.
2. Real, distinct screenshots (md5sum-verified) showing: (a) General tab
   (default, existing content intact), (b) Relationships tab with a task
   that has a parent/children/blocking relationships populated, (c)
   Relationships tab's empty state for a task with none.
   Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-25-inspector-tabs/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-25-inspector-tabs.md`
   with: investigate-first findings on relationship data availability,
   what was built, review rounds, any conflict/rebase encountered with
   Feature 24, and worktree experience notes.
4. A message to the coordinator with PR URL, summary, whether backend
   changes were needed, review outcome, and explicit note on whether a
   Feature-24 conflict was encountered.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/
  conflict/quota reports, and especially the investigate-first findings.
- Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the
log/screenshots, clean up your worktree post-merge, and message the
coordinator. Then signal task_completed.
