> **FREEZE IN FORCE 2026-07-29 — NO DELETION, PRUNING, TIDYING OR SAFE-TO-DELETE CLASSIFICATION OF ANY TREE, WORKTREE, REGISTRATION OR STORE UNTIL THE COORDINATOR LIFTS IT. THIS FILE CONTAINS INSTRUCTIONS THAT PREDATE THE FREEZE AND MUST NOT BE FOLLOWED.**

# Brief: Engineering Manager — Feature 31: Command Palette / Global Search

## Critical Constraints (read first)

- **Runs IN PARALLEL with Feature 32** (dashboard/summary view). Use your own worktree:
  `git worktree add /workspace/farmtable-f31-command-palette -b feat/command-palette origin/main`
  (from `/workspace/farmtable`, after `git fetch origin`). Rebase onto latest main and
  confirm CLEAN/MERGEABLE before opening your PR.
- **Only one agent runs at a time within THIS feature's cycle.**
- **You do NOT merge anything.** Push, open PR, message the coordinator.
- **Reviewers must be blind** — fresh `code-reviewer` agent, `--harness claude`.
- **Exit criteria:** Round 1 fix everything. Round 2+: stop if only nitpicks remain. Cap 5
  rounds.
- **Developer harness:** no `--harness` flag on `scion start farmtable-f31-dev --type
  developer <task>` — inherit the current project default. Reviewer: `--harness claude`.
- **The coordinator will NOT independently re-read your diff or re-open your
  screenshots** — your own verification is what stands.
- **Real screenshots required.**

## Feature Spec

Source: item #1 in `/scion-volumes/scratchpad/projects/farmtable/reports/watcher-frontend-comparison.md`
("Command Palette / Global Search") — ranked the single highest-impact pattern in that
report.

Build a `<ft-command-palette>` component: a modal overlay triggered by a keyboard shortcut
(`Cmd+K`/`Ctrl+K`, or `/` if that doesn't conflict with existing text-input focus — check
for conflicts with existing shortcuts from Features 9-11 before picking one) providing
instant fuzzy search across all tasks in the current collection.

- Search across task title, ID, description, type, status/phase, and assignee
  simultaneously (all data already in `TaskStore` per the report — no backend changes
  needed).
- Results navigable with arrow keys, selectable with Enter (opens that task's inspector),
  dismissable with Escape.
- Include a keyboard-hint footer (e.g. "↑↓ navigate · ↵ select · esc close") and support
  mouse-hover selection too, not just keyboard.
- Reasonable result cap/scroll behavior for large task lists — don't render every task
  unfiltered.

Explicitly OUT of scope: cross-collection search (scope to the currently active
collection's tasks only), search history/recent searches, any fuzzy-matching library
beyond a straightforward substring/simple-fuzzy match — don't over-engineer the matching
algorithm for a first version.

## Key Locations

- Work in `/workspace/farmtable-f31-command-palette` (your own worktree).
- Frontend: `web/src/` — `TaskStore` for task data access, `ft-app.ts`'s
  `onDocumentKeyDown` (or equivalent) for wiring the trigger shortcut, existing modal/dialog
  patterns (Feature 20's `ft-new-collection-dialog`, Feature 23's comment dialog, etc.) for
  consistent Shoelace dialog usage.
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-31-command-palette.md`

## Deliverables

1. Pushed branch + open PR against `main`, confirmed CLEAN/MERGEABLE.
2. Real, distinct screenshots showing: (a) palette open with a search query typed and
   filtered results, (b) selecting a result opening that task's inspector. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-31-command-palette/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-31-command-palette.md`.
4. A message to the coordinator with PR URL, summary, review outcome.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/conflict/quota
  reports. Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the log/screenshots,
clean up your worktree post-merge, and message the coordinator. Then signal task_completed.
