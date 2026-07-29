> **FREEZE IN FORCE 2026-07-29 — NO DELETION, PRUNING, TIDYING OR SAFE-TO-DELETE CLASSIFICATION OF ANY TREE, WORKTREE, REGISTRATION OR STORE UNTIL THE COORDINATOR LIFTS IT. THIS FILE CONTAINS INSTRUCTIONS THAT PREDATE THE FREEZE AND MUST NOT BE FOLLOWED.**

# Brief: Engineering Manager — Feature 33: Collapsible Inspector Sections (Persisted)

## Critical Constraints (read first)

- **Runs IN PARALLEL with Feature 34** (Ready Queue view). Use your own worktree:
  `git worktree add /workspace/farmtable-f33-collapsible-inspector -b feat/inspector-collapsible-sections origin/main`
  (from `/workspace/farmtable`, after `git fetch origin`). Rebase onto latest main and
  confirm CLEAN/MERGEABLE before opening your PR.
- **Only one agent runs at a time within THIS feature's cycle.**
- **You do NOT merge anything.** Push, open PR, message the coordinator.
- **Reviewers must be blind** — fresh `code-reviewer` agent, `--harness claude`.
- **Exit criteria:** Round 1 fix everything. Round 2+: stop if only nitpicks remain. Cap 5
  rounds.
- **Developer harness:** no `--harness` flag on `scion start farmtable-f33-dev --type
  developer <task>` — inherit the current project default. Reviewer: `--harness claude`.
- **The coordinator will NOT independently re-read your diff or re-open your
  screenshots** — your own verification is what stands.
- **Real screenshots required.**
- **Interacts with Feature 25's tabs (General/Relationships).** The inspector already has
  a tabbed structure (PR #71) — this feature adds collapsible sections WITHIN the General
  tab's content, not a competing structural change. Check that PR's diff before starting so
  you extend it correctly rather than fighting the existing tab structure.

## Feature Spec

Source: item #8 in `/scion-volumes/scratchpad/projects/farmtable/reports/watcher-frontend-comparison.md`
("Collapsible Inspector Sections with Persisted State").

Make each section within the Inspector's General tab (header/meta, description, relations,
comments, change history — whatever sections currently exist per Features 4-9, 21, 23, 25)
collapsible via a disclosure header with an animated chevron. Persist collapse/expand state
per section to `localStorage` so it survives page reloads.

- Use Shoelace's `<sl-details>` component (the report notes this provides the behavior out
  of the box) rather than building a custom collapsible from scratch, unless `<sl-details>`
  genuinely doesn't fit some section's existing markup — justify in your log if you deviate.
- `localStorage` keys should be scoped sensibly (e.g. per-section, not per-task — the
  report's Watcher precedent uses keys like `inspector.collapse.description`, i.e. the
  PREFERENCE is global across all tasks, not saved per individual task).
- Preserve all existing inline-editing behavior within each section (date editing from
  Feature 24, comment adding from Feature 23, etc.) — collapsing is purely a
  show/hide wrapper, it must not break any existing interaction when expanded.
- Keyboard-accessible (the `<sl-details>` component should handle this, but verify).

## Key Locations

- Work in `/workspace/farmtable-f33-collapsible-inspector` (your own worktree).
- Frontend: `web/src/components/inspector/` — the various inspector section components
  from Features 4-9, 21, 23, 25 (`gh pr diff 71` for the tab structure specifically).
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-33-collapsible-inspector.md`

## Deliverables

1. Pushed branch + open PR against `main`, confirmed CLEAN/MERGEABLE.
2. Real, distinct screenshots showing: (a) sections expanded (default/normal state), (b)
   some sections collapsed, (c) after a page reload, collapse state persisted correctly.
   Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-33-collapsible-inspector/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-33-collapsible-inspector.md`.
4. A message to the coordinator with PR URL, summary, review outcome.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/conflict/quota
  reports. Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the log/screenshots,
clean up your worktree post-merge, and message the coordinator. Then signal task_completed.
