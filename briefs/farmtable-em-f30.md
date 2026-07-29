> **FREEZE IN FORCE 2026-07-29 — NO DELETION, PRUNING, TIDYING OR SAFE-TO-DELETE CLASSIFICATION OF ANY TREE, WORKTREE, REGISTRATION OR STORE UNTIL THE COORDINATOR LIFTS IT. THIS FILE CONTAINS INSTRUCTIONS THAT PREDATE THE FREEZE AND MUST NOT BE FOLLOWED.**

# Brief: Engineering Manager — Feature 30: Reusable Empty State Component

## Critical Constraints (read first)

- **Runs IN PARALLEL with Feature 29** (icon-based view switcher). Use your own worktree:
  `git worktree add /workspace/farmtable-f30-empty-state -b feat/empty-state-component origin/main`
  (from `/workspace/farmtable`, after `git fetch origin`). Rebase onto latest main and
  confirm CLEAN/MERGEABLE before opening your PR.
- **Only one agent runs at a time within THIS feature's cycle.**
- **You do NOT merge anything.** Push, open PR, message the coordinator.
- **Reviewers must be blind** — fresh `code-reviewer` agent, `--harness claude`.
- **Exit criteria:** Round 1 fix everything. Round 2+: stop if only nitpicks remain. Cap 5
  rounds.
- **Developer harness:** no `--harness` flag on `scion start farmtable-f30-dev --type
  developer <task>` — inherit the current project default (don't hardcode a harness).
  Reviewer: `--harness claude`.
- **The coordinator will NOT independently re-read your diff or re-open your
  screenshots** — your own verification is what stands.
- **Real screenshots required** for the visible states.

## Feature Spec

Source: item #9 in `/scion-volumes/scratchpad/projects/farmtable/reports/watcher-frontend-comparison.md`
("Reusable Empty State Component").

Build a standardized `<ft-empty-state>` Lit component: configurable icon, title, subtitle
(optional), and optional icon color/variant. Centered layout, consistent typography.

- Apply it to at least one real existing empty-state case in the app as a proof of
  integration (check for a spot that currently has an ad hoc "no tasks" or similar message
  — e.g. an empty Kanban column, empty Tree view, or empty filtered-results state from
  Features 15-17 — replace ONE of these with the new component to demonstrate it works,
  without regressing that feature's existing behavior).
- Don't do a project-wide sweep replacing every empty state in this PR — that's
  unnecessary scope for a first landing. Just prove the component works in one real spot;
  future features (e.g. Feature 32's Dashboard, Feature 34's Ready Queue) can adopt it
  directly once merged.

## Key Locations

- Work in `/workspace/farmtable-f30-empty-state` (your own worktree).
- Frontend: `web/src/components/` — check Feature 17's empty-filter-state message
  (`gh pr diff` on that PR if you can find its number in
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/loop-log.md`) as a good candidate
  integration point, or pick another real empty-state spot if that one doesn't fit cleanly.
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-30-empty-state.md`

## Deliverables

1. Pushed branch + open PR against `main`, confirmed CLEAN/MERGEABLE.
2. Real, distinct screenshots showing the empty state component rendered in its real
   integration spot, plus a general "component with different icon/title/subtitle" sample
   if easy to show. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-30-empty-state/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-30-empty-state.md`.
4. A message to the coordinator with PR URL, summary, review outcome.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/conflict/quota
  reports. Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the log/screenshots,
clean up your worktree post-merge, and message the coordinator. Then signal task_completed.
