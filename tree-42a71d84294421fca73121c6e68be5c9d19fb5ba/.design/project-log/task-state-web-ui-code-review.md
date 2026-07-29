# Task State Web UI Code Review

Date: 2026-07-27
Branch: task-state-web-ui
Commit reviewed: 2f912bbee2f4cfc2f40f2650164a56c69a697fb9
Base requested: 7a0f220dbd9332cb8db62138c841777432b4eda4
Primary report: `/scion-volumes/scratchpad/projects/farmtable/reports/review-task-state-web-ui.md`

## Summary

Verdict: REQUEST CHANGES.

The Phase 2 web UI implementation mostly satisfies the contract: phase controls are gone, filter chips use the new contract filters, generated stage values no longer include deleted native values, availability/hold/rank are surfaced, rank ordering is implemented, and the unsuccessful terminal dependency attention workflow is present.

Two contract gaps remain:

- `web/src/components/kanban/ft-kanban-view.ts:29` renders only `Completed` among terminal columns, so `wont_fix`, `duplicate`, and `cancelled` tasks are not visible on the board even though they are valid native stages and are filterable.
- `web/src/gen/service.ts:396` leaves mock change-history labels `Ready` and `Blocked`, which are rendered verbatim by the inspector and keep deleted vocabulary visible in the UI.

## Verification

- `cd web && npm run build`: pass. Vite emitted the bundle-size warning for the main chunk.
- `cd web && npm test`: pass.
- `git fetch origin main`: blocked by missing GitHub credentials, so the explicit requested base commit could not be materialized locally.

## Recommendation

Add board coverage for all terminal native stages or otherwise provide a closed/outcome board representation, update column colors to cover those stages, and replace the mock change-history values with contract vocabulary before merge.
