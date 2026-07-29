# Feature 3: Inline Kanban Card Editing

## Date
2026-07-19

## Summary
Implemented inline editing for Kanban task cards so quick title and priority changes can be made without opening the inspector.

## Files Changed
- `web/src/components/kanban/ft-task-card.ts`
  - Added title edit mode with a hover/focus pencil affordance and double-click activation.
  - Saves title changes on Enter or blur.
  - Cancels title edits on Escape.
  - Stops edit control interactions from bubbling into card selection or drag handling.
  - Added priority editing by switching the priority badge into a compact Shoelace select.
  - Dispatches composed, bubbling `task-update` events for title and priority changes.
- `web/src/components/kanban/ft-kanban-view.ts`
  - Listens for `task-update` on the main board and on-hold board containers.
  - Applies optimistic store updates, calls `client.updateTask`, and rolls back on failure.
- `web/src/gen/service.ts`
  - Fixed `MockFarmTableClient.updateTask` to persist updates back into `MOCK_TASKS`.

## Verification
- Ran `cd /workspace/farmtable/web && npx tsc --noEmit`.
- Captured Playwright screenshots against the local Vite build pointed at the Cloud Run backend:
  - `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-3-inline-card-edit/1-before-edit.png`
  - `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-3-inline-card-edit/2-title-editing.png`
  - `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-3-inline-card-edit/3-priority-editing.png`
  - `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-3-inline-card-edit/4-after-save.png`

## Notes
- The requested `farmtable-dev` skill was not installed in this environment, so the repo-documented dev workflow from `CLAUDE.md` was used.
- During screenshot cleanup, clearing priority back to `UNSPECIFIED` through the existing update path resulted in `NORMAL` from the backend. No backend or proto changes were made because this task was UI-only.
