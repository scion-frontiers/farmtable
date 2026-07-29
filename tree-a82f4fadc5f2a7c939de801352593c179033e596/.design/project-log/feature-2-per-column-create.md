# Feature 2: Per-Column Inline Create Controls

## What Was Built

Added a subtle inline add control to each Kanban board column header. Clicking a
column add control opens the existing Add Task dialog targeted to that column,
updates the dialog title to include the target label, and creates the submitted
task in the selected stage.

The global Add Task button remains unchanged and continues to create tasks in
the default Triage stage.

## Files Changed

- `web/src/gen/service.ts`: added `stage` to `CreateTaskFields` and updated the
  mock client to return the requested stage with the matching phase.
- `web/src/gen/grpc-client.ts`: forwards `stage` in `CreateTaskRequest` when
  provided.
- `web/src/components/kanban/ft-add-task-dialog.ts`: added target stage state,
  target-aware dialog labels, and stage propagation in the `task-create` event.
- `web/src/components/kanban/ft-kanban-column.ts`: added the inline column add
  icon button and `column-add-task` event.
- `web/src/components/kanban/ft-kanban-view.ts`: listens for column add events,
  targets the dialog, and stores created tasks with the selected stage and
  matching phase.

## Design Decisions

- Kept the stage-to-phase mapping duplicated in the mock service instead of
  importing Kanban UI code into the service layer.
- Used a low-opacity Shoelace `sl-icon-button` so the control is visible but
  does not dominate the column header.
- Preserved the existing Add Task dialog as the single create surface, with
  target state reset after the dialog closes.
- Corrected optimistic store insertion defensively when a target stage is
  present, while still relying on the client/server response as the source of
  task data.
