> **FREEZE IN FORCE 2026-07-29 — NO DELETION, PRUNING, TIDYING OR SAFE-TO-DELETE CLASSIFICATION OF ANY TREE, WORKTREE, REGISTRATION OR STORE UNTIL THE COORDINATOR LIFTS IT. THIS FILE CONTAINS INSTRUCTIONS THAT PREDATE THE FREEZE AND MUST NOT BE FOLLOWED.**

# Brief: Engineering Manager — Feature 29: Icon-Based View Mode Switcher

## Critical Constraints (read first)

- **Runs IN PARALLEL with Feature 30** (reusable empty-state component). Use your own
  worktree: `git worktree add /workspace/farmtable-f29-view-switcher -b feat/view-mode-icons origin/main`
  (from `/workspace/farmtable`, after `git fetch origin`). See
  `/scion-volumes/scratchpad/projects/farmtable/reports/worktree-experiment.md` for the
  validated pattern. Rebase onto latest main and confirm `gh pr view --json
  mergeStateStatus,mergeable` is CLEAN/MERGEABLE before opening your PR — resolve any
  conflict by reading the other feature's actual merged diff first.
- **Only one agent runs at a time within THIS feature's cycle** (dev OR reviewer).
- **You do NOT merge anything.** Push, open PR via `gh pr create`, message the coordinator.
- **Reviewers must be blind** — fresh `code-reviewer` agent per round, `--harness claude`.
- **Exit criteria:** Round 1 fix everything (incl. nitpicks). Round 2+: stop if only
  nitpicks remain. Hard cap 5 rounds.
- **Developer harness:** `scion start farmtable-f29-dev --type developer <task>` — no
  `--harness` flag, inherit whatever the current project default is (recently reset due to
  a quota issue on one harness — just take the default, don't hardcode one).
  Reviewer: `--harness claude` explicitly, as always.
- **The coordinator will NOT independently re-read your diff or re-open your
  screenshots** — your own verification is what stands.
- **Real screenshots required** (md5sum-verified, genuine interaction) — this is a visible
  UI change.

## Feature Spec

Source: item #10 in `/scion-volumes/scratchpad/projects/farmtable/reports/watcher-frontend-comparison.md`
("Expanded View Mode Switcher").

Replace the current Kanban/Tree view switcher (an `<sl-radio-group>` with text labels
"Kanban"/"Tree") with a compact, icon-based segmented control in the toolbar. Each view
gets a distinct icon with a tooltip (use Shoelace's icon set / `<sl-tooltip>`) instead of a
text label.

- Scope to the TWO existing views (Kanban, Tree) for now — the source pattern in Watcher
  supports 6 views, but Farmtable currently only has 2. Build the segmented-control
  component to be easily extensible (adding a third icon/view later should be trivial),
  but don't build placeholder icons for views that don't exist yet.
- Preserve the existing `?view=kanban|tree` URL routing behavior from Feature 22 — this is
  purely a visual/interaction change to the switcher control, not a routing change.
- Keyboard-accessible (arrow keys to move between icons, Enter/Space to select) — consistent
  with this project's established keyboard-nav conventions (Features 9-11).
- Match existing toolbar icon-button styling (dark mode toggle, help button, etc. already
  use icon buttons — follow that visual convention).

Explicitly OUT of scope: adding new views (Ready Queue is being built in parallel — Feature
34 — but do not wire it into this switcher; that integration can happen as a small
follow-up once both are merged, don't create a merge dependency between them).

## Key Locations

- Work in `/workspace/farmtable-f29-view-switcher` (your own worktree).
- Frontend: `web/src/` — find the current view switcher (likely near the toolbar,
  alongside the collection picker from Feature 19 and view routing from Feature 22 —
  `gh pr diff 69` for reference).
- Worktree pattern reference:
  `/scion-volumes/scratchpad/projects/farmtable/reports/worktree-experiment.md`
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-29-view-switcher.md`

## Deliverables

1. Pushed branch + open PR against `main`, confirmed CLEAN/MERGEABLE.
2. Real, distinct screenshots showing the new icon switcher in both states (Kanban active,
   Tree active) plus a tooltip visible on hover. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-29-view-switcher/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-29-view-switcher.md`.
4. A message to the coordinator with PR URL, summary, review outcome.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/conflict/quota
  reports. Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the log/screenshots,
clean up your worktree post-merge, and message the coordinator. Then signal task_completed.
