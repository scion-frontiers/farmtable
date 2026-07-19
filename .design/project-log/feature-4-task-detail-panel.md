# Feature 4: Task Detail/Inspector Panel Inline Editing

Implemented inline editing in the inspector for description, due date, and start date.

## Summary

- Added description edit/view mode with explicit save/cancel controls.
- Added start date and due date edit/clear controls.
- Wired inspector `task-update` events through `ft-app` with optimistic update and rollback behavior.
- Added null date update support in the web client, mapped to `clear_due_date` and `clear_start_date`.
- Extracted `applyTaskUpdateFields()` so app, Kanban, and mock-client optimistic updates share parent/date clear behavior.

## Scope Notes

- Assignee editing remains out of scope because it needs user-picker/search UI.
- Relationship editing remains out of scope because it needs task-picker/search UI.
- Labels remain read-only in this pass; backend add/remove fields exist, but the UI needs a deliberate tag-editing workflow.
- Title and priority editing remain on Kanban cards from Feature 3.

## Verification

- `npm run build`
- `go test ./...`
- `go build ./...`
- `go build -o /workspace/.farmtable/bin/ft ./cmd/ft`
- Playwright local UI flow against Vite + `ft dashboard`
- `ft task get 6cb9258c-1d9c-41a2-9bed-f9772ab3d886 -o json` confirmed saved description and due date

Screenshots and the detailed feature log are under:

`/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-4-task-detail-panel/`

## Next Feature Suggestion

Add focused label editing in the inspector using tag chips plus explicit add/remove controls.
