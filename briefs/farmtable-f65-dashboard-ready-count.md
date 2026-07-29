# Brief: Feature 65 — Dashboard View: Top-Level Ready-Item Count

## Critical Constraints (read first)
- Use a dedicated git worktree: `git worktree add
  /workspace/farmtable-f65-dashboard-ready-count -b feature/f65-dashboard-ready-count
  origin/main` (standing policy).
- Local-build-first Playwright verification protocol applies.
- Real, saved evidence required (screenshot + a quick sanity check the count is correct
  against known data) — save to
  `/scion-volumes/scratchpad/projects/farmtable/reports/f65-dashboard-ready-count-evidence/`.

## Context
ptone@google.com requested (2026-07-24): "the dashboard view should include a top level
number of ready items."

This project already has a concept of "ready" tasks from Feature 34 (Ready Queue view) —
find and reuse that exact definition/query logic (likely: tasks with no unresolved
BLOCKED_BY dependencies, in a workable stage) rather than inventing a new one. Check
`ft-ready-queue-view.ts` or the backend RPC it uses (possibly a dedicated
`GetReadyTasks`/`ListReadyTasks` RPC, or client-side filtering — check both) for the
canonical logic.

The Dashboard view (Feature 32, minimal summary view) already exists — find its component
(likely `ft-dashboard-view.ts`, referenced in the Feature 63 work on default-view routing)
and add a prominent "Ready" count as one of its top-level summary numbers/stats.

## Task
1. Find the canonical "ready" task definition/query used by the Ready Queue view (Feature
   34) — reuse it exactly, don't reimplement slightly-different logic.
2. Add a "Ready" count to the Dashboard view's top-level summary stats, styled consistently
   with whatever other summary numbers already exist there (if the Dashboard currently
   shows e.g. total task count, in-progress count, etc. — match that visual pattern).
3. Make sure the count updates correctly on poll refresh (reuse whatever reactive pattern
   the rest of the Dashboard/Ready Queue view already uses — don't reintroduce a poll-tick
   redraw bug, this project has been bitten by that class of bug multiple times, Features
   55/60).
4. If it's natural/cheap to do, consider making the count clickable to navigate to the
   Ready Queue view (nice-to-have, not required — use your judgment on whether this fits
   cleanly, don't over-scope).

## Deliverables
1. PR against `main`.
2. Real evidence: screenshot of the Dashboard showing the new Ready count, plus a sanity
   check that the number matches the actual Ready Queue view's task count for the same
   collection (cross-check the two views side by side or via API call).
3. Confirm poll-tick updates work (wait through one 15s cycle after changing a task's
   ready status, confirm the count updates without a jarring redraw).

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for review requests, questions, or
  completion.
- Do not message ptone@google.com directly.

## Termination
You MUST add the ready-item count to the Dashboard view using the canonical Ready Queue
definition, verify with real evidence including a cross-check against the Ready Queue
view's actual count, open a PR, and message the coordinator with the PR link and evidence
summary. Then signal task_completed.
