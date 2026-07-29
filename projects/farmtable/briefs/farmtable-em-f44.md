# Brief: Engineering Manager — Feature 44: New "Dependency Tree" View (Blocking-Only, Left-to-Right Layered)

## Critical Constraints (read first)

- **Use a dedicated git worktree**, not the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-f44 -b feat/f44-dependency-view origin/main`
  (standing policy — this runs in parallel with farmtable-em-f43 and
  farmtable-em-passthrough-write, both active in their own worktrees right now).
- **Use the local-first verification protocol** for your first round of verification —
  read `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`. A live-server
  check happens separately at deploy time.
- **This is a NEW view, distinct from the existing Tree view** (which Feature 43 is
  currently simplifying to parent-child-only, in a different worktree). Base your branch
  off current `main` — if Feature 43 merges before you're done, rebase onto it; if not,
  that's fine, your changes are additive (a new view) and shouldn't conflict much, but
  check `gh pr list` for Feature 43's status before you open your PR in case a rebase is
  needed.
- **Only one agent runs at a time.** Never run a developer and a reviewer simultaneously.
- **You do NOT merge anything.** Push, open a PR via `gh pr create`, message the
  coordinator.
- **Reviewers must be blind** — fresh `code-reviewer` agent, `--harness claude`.
- **Exit criteria:** Round 1 fix everything (incl. nitpicks). Round 2+: stop if only
  nitpicks remain. Hard cap 5 rounds.
- **Developer harness:** `--type developer` should work; fall back to `--type default` if
  you hit the workspace-trust/"Not logged in" bug.
- **Real screenshots required**, including a case with multi-layer dependencies (at least 3
  layers deep) and a case where one task is blocked by 2+ tasks in the SAME earlier layer
  (to prove the "one item, multiple incoming lines, still one layer" rule below).
- **The coordinator will NOT independently re-read your diff or re-open your
  screenshots** — your own verification is what stands.

## Feature Spec (ptone@google.com, verbatim, then broken down precisely)

"we want to build a second tree view. this one only showing the blocking relationships.
this one will be oriented left to right. with the left most side consisting of unblocked
tasks (functionally same set as ready list) with the next layer (layer 2) to the right
being tasks directly blocked. each layer to the right would be blocked by a sequence of
issues. for an item blocked by two issues, it would still be in layer 2, with a line to
each blocking issue. the view selector icon for this second tree view can be same as first
but rotated 90 CW"

### Precise layout algorithm

This is a left-to-right LAYERED DAG layout using ONLY `BLOCKS`/`BLOCKED_BY` relationships
(check `ft-tree-view.ts` / `tree-lines-investigation` report at
`/scion-volumes/scratchpad/projects/farmtable/reports/tree-lines-investigation/research.md`
for exactly how `BLOCKS` relationships are currently modeled — Feature 43 found these are
drawn from `rel.type === RelationshipType.BLOCKS` in the existing Tree view). No
parent-child hierarchy lines in this view at all — this view is exclusively about blocking
dependencies.

1. **Layer 0 (leftmost)**: tasks with no incomplete blocking dependencies — i.e. "unblocked"
   tasks. Use the SAME definition of "unblocked"/"ready" that Feature 34's Ready Queue view
   already implements (check `ft-ready-queue-view.ts` or wherever that logic lives) — don't
   reinvent this determination, reuse or directly call the same logic/query so the two
   views are consistent with each other.
2. **Layer N (N > 0)**: a task's layer = `1 + max(layer of each of its direct blocking
   tasks)`. This is standard longest-path DAG layering: if a task is blocked by tasks in
   layers 0 and 2, it goes in layer 3 (one more than the highest/rightmost blocker), NOT
   layer 1 — the example in the spec ("blocked by two issues, still layer 2") assumes both
   blockers happen to be in layer 0 (unblocked); generalize correctly for blockers at mixed
   layers.
3. **Edges**: draw a line from each task to each of its direct blocking tasks (the tasks
   that must complete before it can proceed) — so an item blocked by 2 tasks gets 2 lines,
   regardless of which layer it lands in. Match the existing Tree view's visual style for
   these edges if reasonable (dashed indigo, per the investigation report) for consistency,
   or use your judgment if a different style reads more clearly in this layered context.
4. **Completed/done tasks**: decide sensibly whether a completed task that used to block
   something still gets drawn as a blocker (probably not — if it's done, it's no longer
   actually blocking, so the "unblocked" layer-0 definition should already treat the
   dependent task as unblocked once all its blockers are done; document your choice).
5. **Cycles**: BLOCKS relationships could theoretically form a cycle (a data integrity
   issue, but defend against it) — if you detect one, don't infinite-loop; break ties
   sensibly (e.g. cap layer depth, or place cyclic tasks in a fallback layer) and note it in
   your log rather than crashing.
6. Reuse existing Tree view infrastructure where sensible: canvas/SVG setup, zoom/pan,
   Feature 41's animated centering-on-selection (750ms ease-in-out) should also work in
   this new view for consistency, and Feature 43's parent-child Tree view's general
   component patterns. But this is functionally a distinct view/component — don't
   overload the existing `ft-tree-view.ts` with a mode flag unless that's clearly the
   cleaner approach after you look at the code; use your judgment on new-component vs.
   parameterized-existing-component, document which you chose and why.

### View selector

- Add this as a new view mode alongside Kanban/Tree/Dashboard/Ready-Queue (Feature 29's
  icon-based view mode switcher — check `ft-toolbar.ts` or wherever the switcher lives).
- Icon: reuse the existing Tree view's icon, rotated 90° clockwise (a CSS `transform:
  rotate(90deg)` on the same icon element/SVG is the simplest approach — don't create a new
  icon asset unless rotation genuinely doesn't read well, in which case use judgment).
- Name it something clear — "Dependencies" or "Blocking" view (your choice, document it) —
  check with a short note in your log rather than guessing silently if genuinely unsure,
  but don't block on this, pick something reasonable.
- URL routing: Feature 22 added `?view=kanban|tree` — add a new value for this view
  consistent with that pattern.

## Key Locations

- Repo: base off current `main` (through Feature 42's DnD fix) — fresh feature branch, PR
  to merge.
- Frontend: `web/src/` — `ft-tree-view.ts` (existing Tree view, reference for
  canvas/SVG/zoom/pan/animation patterns), `ft-ready-queue-view.ts` (Feature 34, reuse its
  "unblocked" logic), `ft-toolbar.ts` (Feature 29's view switcher, Feature 22's URL
  routing).
- Relationship model reference: `proto/farmtable.proto` /
  `/scion-volumes/scratchpad/projects/farmtable/reports/tree-lines-investigation/research.md`
- Local testing protocol:
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-44-dependency-view.md`

## Deliverables

1. Pushed branch + open PR against `main`, confirmed CLEAN/MERGEABLE.
2. Real screenshots: (a) a multi-layer (3+) dependency chain rendered correctly
   left-to-right, (b) a task blocked by 2+ tasks landing in the correct (max+1) layer with
   a line to each blocker, (c) the new view-switcher icon (rotated tree icon), (d) Feature
   41's animated centering working in this new view. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-44-dependency-view/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-44-dependency-view.md`
   documenting your design choices (new component vs. parameterized existing one, view
   name, done-task-blocker handling, cycle handling).
4. A message to the coordinator with PR URL, summary, review outcome.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the log/screenshots
per the spec above, and message the coordinator. Then signal task_completed.
