# Feature 1: Add Task UI

## Status: Complete — PR #47 open

**Branch:** `feat/add-task-ui`
**PR:** https://github.com/scion-frontiers/farmtable/pull/47
**Commits:** `01be179` feat: add kanban task creation UI, `71e980f` fix: address review round 1 feedback

## What Was Built
Added a "+ Add Task" button to the Farm Table Kanban dashboard header. Clicking it opens a modal dialog with a task name field (required, max 255 chars) and description textarea (optional, max 10,000 chars). Submitting calls the existing `farmtable.v1.FarmTableService/CreateTask` gRPC-Web RPC. The new task appears immediately in the Triage column via optimistic store insert and is confirmed by the WatchTasks live stream.

### Files Changed
- `web/src/gen/grpc-client.ts` — Added `createTask` RPC method to the gRPC-Web client
- `web/src/gen/service.ts` — Added `CreateTaskFields` type, `createTask` to interface + mock client
- `web/src/components/kanban/ft-add-task-dialog.ts` — New dialog component (Lit + Shoelace)
- `web/src/components/kanban/ft-kanban-view.ts` — Wired button + dialog into Kanban view
- `web/src/index.ts` — Registered new Shoelace component imports

## Review Rounds

### Round 1 — REQUEST CHANGES (6 findings, all fixed)

| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| 1 | Critical | Footer slot projection — buttons rendered in body, not footer because `slot="footer"` was on a grandchild of `sl-dialog` | Fixed: moved footer div as direct child of sl-dialog, Create button uses `requestSubmit()` |
| 2 | High | No user-visible error feedback — only console.error | Fixed: added `errorMessage` state + `sl-alert variant="danger"` + `setError()` method |
| 3 | High | Escape/overlay could dismiss dialog mid-creation | Fixed: added `@sl-request-close` handler that blocks dismiss when `isCreating` |
| 4 | Medium | No input length limits | Fixed: added `maxlength="255"` on name, `maxlength="10000"` on description |
| 5 | Medium | Mock client: created tasks don't appear on board in dev mode | Fixed: optimistic `this.store.upsert(task)` after successful create |
| 6 | Low | Duplicate `isCreatingTask` state in kanban view | Fixed: removed from kanban view, dialog owns creating state |

### Round 2 — APPROVE (4 minor/nitpick findings, unaddressed per process)

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 1 | Medium | Prefer `sl-initial-focus` event over manual `focus()` call | Unaddressed (stylistic) |
| 2 | Low | Error messages don't differentiate failure causes | Unaddressed (minor UX) |
| 3 | Low | `composed: true` on task-create event is unnecessary | Unaddressed (cosmetic) |
| 4 | Nitpick | `void` on `hide()` could swallow rejected promise | Unaddressed (extremely unlikely) |

Per review exit criteria: Round 2 found only minor/nitpick issues, so the feature ships as-is.

## Screenshots
- `kanban-add-task-button.png` — Kanban board with the blue "+ Add Task" button in top-right
- `add-task-dialog.png` — Add Task dialog open with Name and Description fields, Cancel/Create buttons

## Developer's Next-Feature Suggestion
Add inline create controls per kanban column so users can create a task directly into the intended stage (e.g., Backlog, Ready) instead of always defaulting to Triage. This would reduce post-create drag/edit steps and make task capture faster during planning sessions.
