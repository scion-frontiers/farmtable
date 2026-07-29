# Feature 46 — Relationships Tab Delete + Quick-Add via Command Palette

**Status:** Complete  
**Branch:** `feat/f46-relationships-add-remove`  
**Date:** 2026-07-22

## Summary

Two enhancements to the Inspector Relationships tab:

1. **Delete icon per relationship row** — A trash-can icon appears on hover next to each relationship entry. Clicking it immediately removes the relationship (optimistic update with server rollback on error). No confirmation dialog, matching the existing label-removal pattern.

2. **"+" button on each relationship type section** — Each section heading (Blocked by, Blocks, Related, Duplicate of) has a "+" icon button. Clicking it opens the existing command palette component in a new "add-relationship" mode.

## Design Decisions

### Relationship Type Selection UI

Small pill/tab buttons above the search results inside the command palette:

```
TYPE  [ Blocks ]  [ Blocked by ]
```

The selected pill has a primary-colored border and background. Default is "Blocks". Only two types are offered — see limitations below.

### No Confirmation on Delete

Follows the existing pattern from `ft-inspector-meta.ts` where label removal dispatches immediately with optimistic update and rollback on error. No modal, no undo toast.

### Supported Relationship Types for Adding

**Only Blocks and Blocked by** are available in the add-relationship UI. The proto's `UpdateTaskRequest` only has `add_blocks` (field 22) and `add_blocked_by` (field 23). There are no `add_related` or `add_duplicate` fields. The backend's `remove_relationships` (field 24) removes by target task ID regardless of type, so deletion works for all relationship types.

The "+" buttons still appear on the Related and Duplicate of sections for consistency, but clicking them opens the same palette with only Blocks/Blocked by as options. A future proto extension could add `add_related` and `add_duplicate` fields to enable those types.

### Read-Only Mode

A `readOnly` prop was added to `ft-inspector-relationships`. When true, trash icons and "+" buttons are hidden. The prop is wired from `ft-inspector.ts` which already has a `readOnly` property.

## Files Changed

| File | Change |
|------|--------|
| `web/src/gen/service.ts` | Added `addBlocks`, `addBlockedBy`, `removeRelationships` to `UpdateTaskFields`; handle in `applyTaskUpdateFields` |
| `web/src/gen/grpc-client.ts` | Wire new fields in `updateTask` gRPC call |
| `web/src/components/inspector/ft-inspector-relationships.ts` | Added trash icon, "+" button, `readOnly` prop, event dispatching |
| `web/src/components/inspector/ft-inspector.ts` | Pass `readOnly` to relationships tab |
| `web/src/components/ft-command-palette.ts` | Added `mode`, `excludeTaskId`, relationship type pills, `relationship-add` event |
| `web/src/components/ft-app.ts` | Handle `open-add-relationship` and `relationship-add` events, manage palette mode state |

## Event Flow

### Remove Relationship
1. User hovers relationship entry → trash icon appears
2. Click trash → `ft-inspector-relationships` dispatches `task-update` with `{ removeRelationships: [targetTaskId] }`
3. Bubbles through `ft-inspector` to `ft-app`
4. `ft-app.onTaskUpdate` calls `applyTaskUpdate` (optimistic + server)

### Add Relationship
1. User clicks "+" in relationships tab
2. `ft-inspector-relationships` dispatches `open-add-relationship` with `{ taskId }`
3. `ft-app` opens command palette with `mode="add-relationship"`, `excludeTaskId=taskId`
4. User types to search, selects type pill, clicks a task
5. Command palette dispatches `relationship-add` with `{ targetTaskId, relationshipType }`
6. `ft-app.onRelationshipAdd` calls `applyTaskUpdate` with `addBlocks` or `addBlockedBy`
7. Palette closes, relationship appears in the tab

## Evidence

Screenshots saved to: `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-46-relationships-add-remove/`

- `01-relationships-tab-with-buttons.png` — Relationships tab showing "+" buttons on each section
- `02-palette-add-mode-empty.png` — Command palette opened in add-relationship mode
- `03-palette-search-results.png` — Search results with TYPE pills (Blocks selected), current task excluded
- `04-blocked-by-selected.png` — "Blocked by" type selected
- `05-after-add-relationship.png` — Relationship added: "Test task 1" appears under BLOCKED BY with Ready badge
- `06-trash-on-hover.png` — Trash icon visible on hover over the relationship entry
- `07-after-delete.png` — After clicking trash: relationship removed, back to "None"

## Verification

- [x] TypeScript compiles (`tsc --noEmit` via `npm run build`)
- [x] Vite build succeeds
- [x] Go binary builds (`go build -o ft ./cmd/ft`)
- [x] Add relationship flow works end-to-end (screenshot evidence)
- [x] Delete relationship flow works end-to-end (screenshot evidence)
- [x] Command palette navigate mode unaffected (Cmd+K still works normally)
- [x] Read-only mode hides mutation controls
