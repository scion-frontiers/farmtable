> **FREEZE IN FORCE 2026-07-29 — NO DELETION, PRUNING, TIDYING OR SAFE-TO-DELETE CLASSIFICATION OF ANY TREE, WORKTREE, REGISTRATION OR STORE UNTIL THE COORDINATOR LIFTS IT. THIS FILE CONTAINS INSTRUCTIONS THAT PREDATE THE FREEZE AND MUST NOT BE FOLLOWED.**

# Brief: Engineering Manager — Feature 32: Dashboard / Summary View (Minimal)

## Critical Constraints (read first)

- **Runs IN PARALLEL with Feature 31** (command palette). Use your own worktree:
  `git worktree add /workspace/farmtable-f32-dashboard -b feat/dashboard-summary origin/main`
  (from `/workspace/farmtable`, after `git fetch origin`). Rebase onto latest main and
  confirm CLEAN/MERGEABLE before opening your PR.
- **Only one agent runs at a time within THIS feature's cycle.**
- **You do NOT merge anything.** Push, open PR, message the coordinator.
- **Reviewers must be blind** — fresh `code-reviewer` agent, `--harness claude`.
- **Exit criteria:** Round 1 fix everything. Round 2+: stop if only nitpicks remain. Cap 5
  rounds.
- **Developer harness:** no `--harness` flag on `scion start farmtable-f32-dev --type
  developer <task>` — inherit the current project default. Reviewer: `--harness claude`.
- **The coordinator will NOT independently re-read your diff or re-open your
  screenshots** — your own verification is what stands.
- **Real screenshots required.**

## Feature Spec

Source: item #2 in `/scion-volumes/scratchpad/projects/farmtable/reports/watcher-frontend-comparison.md`
("Dashboard / Summary View").

**Scope this to the MINIMAL version explicitly called out as XS in the report** — phase
counts + priority counts only. Do NOT build the "Readiness" (Ready vs. Blocked) stats in
this feature — that requires relationship-queryability work being investigated separately
in Feature 34 (Ready Queue View); building it here would duplicate or race that
investigation. If Feature 34 lands the needed data access pattern first, a follow-up
feature can add the readiness card to this dashboard — that's out of scope for this PR.

Build a project-level overview: when a collection is selected, add a way to view (e.g. a
new toolbar button/tab, or as a landing state before the board — use your judgment on the
least disruptive integration point, but don't replace the existing Kanban/Tree
default-landing behavior) a dashboard showing:
- Stat cards: Open / In Progress / Closed / Total task counts.
- Priority breakdown badges (however many priority levels Farmtable's data model actually
  has — check the proto, don't assume Watcher's P0-P3 scheme maps directly).

- All data needed is already in `TaskStore` — pure frontend, no backend changes.
- Keep it visually consistent with existing card/badge styling already used elsewhere
  (e.g. priority badges likely already exist somewhere in cards/inspector — reuse that
  styling rather than inventing new badge colors).

## Key Locations

- Work in `/workspace/farmtable-f32-dashboard` (your own worktree).
- Frontend: `web/src/` — `TaskStore` for aggregation, existing card/badge components for
  style reuse, toolbar/routing (Features 18, 22, 29) for how to add a new
  view/entry-point without disrupting existing Kanban/Tree behavior.
- Data model reference for priority levels: `proto/farmtable.proto` (`Task.priority` field
  / enum).
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-32-dashboard.md`

## Deliverables

1. Pushed branch + open PR against `main`, confirmed CLEAN/MERGEABLE.
2. Real, distinct screenshots showing the dashboard with real stat/priority counts from an
   actual collection. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-32-dashboard/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-32-dashboard.md`
   — explicitly note the readiness-stats deferral and why.
4. A message to the coordinator with PR URL, summary, review outcome.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/conflict/quota
  reports. Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the log/screenshots,
clean up your worktree post-merge, and message the coordinator. Then signal task_completed.
