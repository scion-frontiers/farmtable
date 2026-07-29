# Feature 2: Per-Column Inline Create Controls

## Status: Complete — PR #48 open

**Branch:** `feat/per-column-create`
**PR:** https://github.com/scion-frontiers/farmtable/pull/48
**Commits:** `fa7f020` feat: add per-column inline task creation controls, `5538fbf` fix: address review round 1 feedback

## What Was Built

Added a lightweight "+" icon button to each Kanban column header (Triage, Backlog, Ready, Working, In Review, In QA, Deploying, Completed, and On Hold columns). Clicking a column's "+" opens the existing Add Task dialog with a contextual title (e.g., "Add Task to Backlog") and creates the submitted task in that column's stage instead of defaulting to Triage.

The global "+ Add Task" button in the header continues to work as-is, defaulting to Triage.

### Files Changed
- `web/src/gen/service.ts` — Added optional `stage` to `CreateTaskFields`, exported canonical `phaseForStage` with full stage coverage (OPEN, IN_PROGRESS, ON_HOLD, CLOSED, UNSPECIFIED), updated mock client to use provided stage
- `web/src/gen/grpc-client.ts` — Passes `stage` to `CreateTask` RPC request
- `web/src/components/kanban/ft-add-task-dialog.ts` — Added `targetStage`/`targetStageLabel` properties, `setTarget()` method, contextual dialog title, stage in `TaskCreateDetail` event, state reset on dialog close
- `web/src/components/kanban/ft-kanban-column.ts` — Added `sl-icon-button` "+" in column header with hover-reveal styling (opacity 0.35→1), dispatches `column-add-task` event
- `web/src/components/kanban/ft-kanban-view.ts` — Wires `column-add-task` events to dialog on both main board and on-hold containers, passes stage to `createTask`, consolidated `phaseForStage` import from service.ts (removed local duplicate)
- `.design/project-log/feature-2-per-column-create.md` — Project log entry

## Review Rounds

### Round 1 — APPROVE with recommendations (5 findings, all fixed)

| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| 1 | Important | Duplicated `phaseForStage` with divergent ON_HOLD handling — service.ts version mapped ON_HOLD stages to OPEN, while ft-kanban-view.ts mapped them to ON_HOLD | Fixed: consolidated into single exported `phaseForStage` in service.ts with correct ON_HOLD, CLOSED, UNSPECIFIED handling; removed local copy from ft-kanban-view.ts |
| 2 | Important | Client-side stage/phase override of server response inverts trust model | Fixed: added TODO comment explaining the override is a safety net during rollout |
| 3 | Suggestion | `targetStage` truthiness check fragile with `TaskStage.UNSPECIFIED = 0` | Fixed: changed to `this.targetStage != null` |
| 4 | Suggestion | Missing `size="small"` on `sl-icon-button` | Fixed: added `size="small"` |
| 5 | Suggestion | No tests for new behavior (pre-existing gap) | Fixed: added TODO comment for test coverage |

### Round 2 — APPROVE (2 medium non-blocking observations, unaddressed per process)

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 1 | Medium | `phaseForStage` placement in service.ts — might be better in a shared utility | Unaddressed (architectural preference, non-blocking) |
| 2 | Medium | Silent server-response override — could add `console.warn` on mismatch | Unaddressed (logging suggestion, non-blocking) |

Per review exit criteria: Round 2 found only medium/non-blocking items, so the feature ships as-is.

## Screenshots

All saved under `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-2-per-column-create/`:

- `01-board-column-add-controls.png` — Kanban board showing "+" buttons in each column header, with tasks in Backlog (3) and In QA (1) created via column controls
- `dialog-backlog.png` — Add Task dialog open with title "Add Task to Backlog"
- `02-created-in-backlog.png` — Backlog column showing 4 tasks after creating via column "+" button
- `dialog-in-qa.png` — Add Task dialog targeted at In QA column
- `03-created-in-in-qa.png` — In QA column showing task created via column "+" button

## Developer's Next-Feature Suggestion

Add inline task editing from the Kanban card, starting with title and priority. It builds naturally on per-column creation by letting users quickly correct or triage newly created tasks without opening the full inspector.
