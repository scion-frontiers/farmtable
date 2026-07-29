# Task State Web UI

Date: 2026-07-27
Branch: task-state-web-ui

## Summary

Implemented the Phase 2 web UI pass for the stable task-state contract.

- Removed native phase filtering from the toolbar and active filter chips.
- Replaced phase filters with active/closed grouping, native stage, hold reason, availability, and assignee filters.
- Kept selectable stages to the native contract vocabulary: triage, accepted, active execution stages, and terminal outcomes.
- Surfaced hold reason, server-computed availability, and rank in board cards, available queue rows, dashboard stats, and task detail metadata/header.
- Updated the available queue and board column sorting to priority, rank, created_at, then task ID.
- Added dependency attention UI for tasks blocked by unsuccessful terminal prerequisites, including remove and rewire actions from the relationship panel.
- Updated the gRPC web mapper to decode hold_reason, rank, and availability from task responses and send holdReason/rank update fields when present.
- Adjusted local mock data away from native `ON_HOLD` projection for held Farm Table work.

## Verification

- `cd web && npm test` - pass
- `cd web && npm run build` - pass
  - Vite emitted the existing chunk-size warning for the main bundle.
- `git diff --check` - blocked initially because `/workspace/.git` pointed at missing worktree metadata (`/workspace/farmtable/.git/worktrees/farmtable-task-state-web-ui`). Local Git metadata was repaired before the final commit.

## Notes

The web app still retains generated wire-compatible phase fields in TypeScript responses, but native UI controls and labels no longer expose phase as task state. Availability display uses the server-provided `TaskAvailability` object when present; local fallback behavior remains conservative for mock/older snapshots.
