# Feature 1: Add Task UI

## Summary

Implemented the kanban Add Task flow for the Farm Table web dashboard.

## Changes

- Added `createTask` to the web service client interface and mock client.
- Added `CreateTask` unary RPC wiring to the gRPC-web client.
- Added `<ft-add-task-dialog>` with required name input, optional description textarea, and Cancel/Create actions.
- Added a `+ Add Task` button to the kanban view and wired `task-create` events to `client.createTask()`.
- Registered the new component and required Shoelace components in the web entrypoint.

## Verification

- `cd web && npm ci`
- `cd web && npm run build`
- Built local CLI for screenshot runtime: `go build -o /workspace/.farmtable/bin/ft ./cmd/ft`
- Ran local dashboard backend and Vite dev server for browser verification.
- Verified through Playwright that submitting the dialog creates a task and it appears on the board via the existing stream.

## Screenshots

- `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-1-add-task-ui/kanban-add-task-button.png`
- `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-1-add-task-ui/add-task-dialog.png`

## Next UI/UX Suggestion

Add inline create controls per kanban column so users can create a task directly in the intended stage, instead of always defaulting to triage. This would reduce post-create drag/edit steps and make task capture faster during planning sessions.
