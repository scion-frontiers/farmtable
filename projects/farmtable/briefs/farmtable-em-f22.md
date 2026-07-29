> **FREEZE IN FORCE 2026-07-29 — NO DELETION, PRUNING, TIDYING OR SAFE-TO-DELETE CLASSIFICATION OF ANY TREE, WORKTREE, REGISTRATION OR STORE UNTIL THE COORDINATOR LIFTS IT. THIS FILE CONTAINS INSTRUCTIONS THAT PREDATE THE FREEZE AND MUST NOT BE FOLLOWED.**

# Brief: Engineering Manager — Feature 22: Reachable URLs for Kanban/Tree Views

## Critical Constraints (read first)

- **THIS FEATURE RUNS IN PARALLEL WITH FEATURE 23** (inspector add-comment),
  which is actively working in its own worktree at
  `/workspace/farmtable-f23-comments` right now. To avoid stepping on it
  (and on the general shared checkout), **you MUST NOT use
  `/workspace/farmtable` directly.** Create your own sibling worktree:
  ```
  cd /workspace/farmtable
  git fetch origin
  git worktree add /workspace/farmtable-f22-view-urls -b feat/view-mode-urls origin/main
  ```
  Do ALL work (build, dev server, screenshots, commits, push, PR) from
  `/workspace/farmtable-f22-view-urls`. See
  `/scion-volumes/scratchpad/projects/farmtable/reports/worktree-experiment.md`
  for the validated pattern/gotchas (no absolute-path issues, shared Go
  module cache, ~91MB/5s npm install per worktree, dev-server ports are
  configurable — pick a port that doesn't collide if you run a dev server
  concurrently with other features' worktrees). Clean up the worktree
  (`git worktree remove`) once the PR is merged and confirmed.
- **Only one agent runs at a time within THIS feature's own cycle** (dev
  OR reviewer, never both). Other features running concurrently in their
  own worktrees is fine and expected.
- **You do NOT merge anything.** Push the branch, open a PR with
  `gh pr create`, then message the coordinator. The coordinator merges.
- **Reviewers must be blind** — fresh `code-reviewer` agent per round,
  zero prior-feedback context.
- **Exit criteria for the review loop:**
  - Round 1: fix ALL findings (including nitpicks).
  - Round 2 onward: if a fresh review returns ONLY nitpick/minor findings,
    STOP — ship as-is. Otherwise fix and run another fresh round.
  - Hard cap: 5 review rounds total.
- **Agent types/harnesses:**
  - Developer: `scion start farmtable-f22-dev --type developer <task>` —
    NO `--harness` flag (project default is codex).
  - Reviewer: `scion start farmtable-f22-review-rN --type code-reviewer
    --harness claude <task>`.
- **Keep the developer agent alive** across all fix iterations.
- **Before opening the PR, rebase onto latest origin/main and confirm `gh
  pr view <n> --json mergeStateStatus,mergeable` shows CLEAN/MERGEABLE.**
  Other features are merging to main concurrently — rebase again right
  before opening the PR if time has passed. (Feature 19 hit a squash-merge
  conflict from stale base commits — avoid repeating it.)
- **The coordinator will NOT independently re-read your diff or re-open
  your screenshots** — your own verification is what stands. Be rigorous
  and specific.
- **Reuse Feature 18's routing mechanism (below), don't reinvent it.**
  This feature adds a second, orthogonal URL param alongside
  `?collection=`, not a new routing system.

## Feature 18 Routing Mechanism (reference — extend, don't replace)

- URL param: `?collection=<uuid>`; route state `FtApp.routeView = 'landing'
  | 'validating' | 'board'`.
- Navigate: `pushState` with `url.searchParams.set(...)` then call
  `applyRoute()`. A `popstate` listener calls `applyRoute()` for
  back/forward.
- Full detail: `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-18-collection-url-routing.md`

## Feature Spec

The dashboard toolbar has a Kanban/Tree view toggle (confirmed to exist —
see the collection-model investigation report for a toolbar inventory).
Currently switching between Kanban and Tree view is NOT reflected in the
URL — reloading or sharing a link always lands on whichever view is
default. Make the view mode URL-addressable, the same way collections are:

- Add a `?view=kanban` / `?view=tree` URL param (pick param name/values
  that read naturally; `view` + `kanban`/`tree` is a reasonable default
  unless you find an existing convention to match).
- Switching the toggle updates the URL via the SAME `pushState` +
  `applyRoute()` mechanism as collection switching (don't bypass routing
  with direct state mutation) — both params (`collection` and `view`)
  must coexist correctly in the URL (e.g.
  `?collection=<uuid>&view=tree`).
- Direct navigation to a URL with `?view=tree` (with or without a
  `?collection=` param) must render the Tree view directly on load, not
  just default to Kanban and require a manual toggle click.
- If `?view=` is absent, fall back to whatever the current default is
  today (don't change default behavior for existing URLs without the
  param — this should be additive, not breaking).
- Invalid/unrecognized `?view=` values should fall back gracefully to the
  default view (don't crash or show a blank state).
- Browser back/forward must correctly restore view mode via the existing
  `popstate` handling — extend it, don't duplicate it.

Explicitly OUT of scope:
- Any other new routable state (filters, selected task, etc.) — this
  feature is view-mode only.
- Redesigning the Kanban/Tree toggle UI itself.

## Key Locations

- Repo: branch off current `main` — but work in your OWN worktree
  (`/workspace/farmtable-f22-view-urls`) per the critical constraint above.
- Frontend: `web/src/` — the routing/`applyRoute()` logic from Feature 18
  (`gh pr diff 64` for reference), and wherever the Kanban/Tree toggle
  currently lives and switches view state (find it — likely near the
  toolbar component alongside the collection picker from Feature 19,
  `gh pr diff 65`).
- Prior feature logs for routing conventions:
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-18-collection-url-routing.md`,
  `feature-19-collection-picker.md`
- Worktree pattern reference:
  `/scion-volumes/scratchpad/projects/farmtable/reports/worktree-experiment.md`
- Repo's own agent guide: `/workspace/farmtable/agents.md`.
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-22-view-mode-urls.md`

## Deliverables

1. A pushed feature branch + open PR (via `gh pr create`) against
   `scion-frontiers/farmtable` `main`, confirmed CLEAN/MERGEABLE.
2. Real, distinct screenshots (md5sum-verified, genuine UI interaction)
   showing: (a) Kanban view with `?view=kanban` in the URL, (b) Tree view
   with `?view=tree` in the URL after toggling, (c) direct navigation to
   a `?view=tree` URL landing on Tree view without manual toggling.
   Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-22-view-mode-urls/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-22-view-mode-urls.md`
   with: the exact param/mechanism chosen, review rounds, final state,
   unaddressed nitpicks, developer's next-feature suggestion, and an
   honest note on how the worktree setup went.
4. A message to the coordinator with PR URL, branch, summary, final
   review outcome, and worktree experience.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/
  quota-concern reports or worktree friction.
- Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the
log and screenshots at the paths above, clean up your worktree after
merge is confirmed, and message the coordinator with the summary. Then
signal task_completed.
