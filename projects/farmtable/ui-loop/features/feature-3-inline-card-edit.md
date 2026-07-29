# Feature 3: Inline Task Editing from Kanban Card

## Status: Complete — PR opened

**Branch:** `feat/inline-card-edit`
**Commits:** `e2ce803` feat: add inline kanban card editing, `9c84d93` fix: address review round 1 feedback

## What Was Built

Added inline editing of task title and priority directly from Kanban cards, so users can make quick corrections without opening a full inspector/detail view.

### Title Editing
- Pencil icon appears on card hover (opacity transition 0→1)
- Clicking the pencil icon opens an inline `sl-input` pre-filled with the current title
- Save on Enter or blur (focus loss)
- Cancel on Escape — reverts to original title
- Empty titles are rejected (no-op)
- Double-click on title area also activates editing

### Priority Editing
- Clicking the priority badge button opens an `sl-select` dropdown
- All priorities available: No priority, Urgent, High, Normal, Low
- Selection immediately saves and closes the dropdown
- `sl-after-hide` event used for reliable cleanup with hoisted popups

### Event Wiring
- Cards dispatch `task-update` custom event with `{ taskId, fields }` detail
- Event bubbles through shadow DOM (`composed: true`) to `ft-kanban-view`
- `onTaskUpdate` handler follows the established optimistic-update pattern:
  - Update store immediately for instant UI feedback
  - Call `client.updateTask()` asynchronously
  - Rollback store on API error + console.warn

### UX Details
- Edit mode suppresses drag-and-drop (both `draggable` attribute toggle and `onDragStart` guard)
- All edit interactions call `stopPropagation()` to prevent card selection/drag interference
- Keyboard events (Enter, Escape) also stop propagation to prevent parent handler interference

### Scope
- Both title and priority editing are included — the `TaskPriority` enum already existed in the data model and the `updateTask` RPC was fully wired
- No proto/backend schema changes were needed
- No descoping was necessary

### Files Changed
- `web/src/components/kanban/ft-task-card.ts` — Primary: added edit state management, inline title input, priority select dropdown, edit affordance styling, event dispatching
- `web/src/components/kanban/ft-kanban-view.ts` — Added `onTaskUpdate` event handler wired on both main board and on-hold containers, added console.warn + TODO on error rollback paths (both onStageChange and onTaskUpdate)
- `web/src/gen/service.ts` — Fixed `MockFarmTableClient.updateTask` to actually mutate the `MOCK_TASKS` array (was creating a new object without persisting)
- `.design/project-log/feature-3-inline-card-edit.md` — Project log entry

## Review Rounds

### Round 1 — APPROVE with recommendations (1 Important, 4 Suggestions — all fixed)

| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| 1 | Important | `priorityLabel` can be `undefined` for unknown enum values | Fixed: added `?? 'Unknown'` fallback and `UNSPECIFIED: 'neutral'` to PRIORITY_VARIANT |
| 2 | Suggestion | Title input lacks `maxlength` constraint | Fixed: added `maxlength="200"` to sl-input |
| 3 | Suggestion | Silent rollback on save failure — no user feedback | Fixed: added `console.warn` + TODO comment on both onStageChange and onTaskUpdate catch blocks |
| 4 | Suggestion | `Number()` cast on priority value has no NaN guard | Fixed: added `Number.isNaN(raw)` guard |
| 5 | Suggestion | `@sl-blur` unreliable for hoisted select cleanup | Fixed: changed to `@sl-after-hide` |

### Round 2 — APPROVE (2 "Important" findings confirmed as already correctly handled, 6 Suggestions — unaddressed per exit criteria)

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| I-1 | Important | Double-fire on blur after Enter — reviewer confirms guard handles it correctly | Unaddressed (already correct; recommend comment only) |
| I-2 | Important | Escape then blur — reviewer confirms guard handles it correctly | Unaddressed (already correct) |
| S-1 | Suggestion | `draggable` string "false" semantics — reviewer says "no change needed" | Unaddressed |
| S-2 | Suggestion | maxlength 200 vs MAX_TITLE_LEN 80 mismatch — naming suggestion | Unaddressed |
| S-3 | Suggestion | Priority cast doesn't validate against known enum values | Unaddressed |
| S-4 | Suggestion | `@sl-after-hide` vs `@blur` — reviewer says "well-chosen" | Unaddressed |
| S-5 | Suggestion | parentTaskId logic duplication between view and mock client | Unaddressed |
| S-6 | Suggestion | onClick fires after editing interactions — acceptable UX | Unaddressed |

Per review exit criteria: Round 2 found only minor/suggestion findings with no significant/blocking items, so the feature ships as-is.

## Screenshots

All saved under `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-3-inline-card-edit/`:

- `1-before-edit.png` — Card showing "Test task from real client" with "No priority" badge
- `2-title-editing.png` — Card with inline title input field active
- `3-priority-editing.png` — Card with priority dropdown open showing all options (also shows pencil edit icon and edited title)
- `4-after-save.png` — Card showing updated title and "Low" priority badge after save
- `debug-page.png` — Full board view during verification

## Developer's Next-Feature Suggestion

The developer who built this feature suggests adding a task detail/inspector panel that opens when clicking a card (the `task-select` event is already wired). This would provide a full editing view for all task fields (description, assignees, labels, dates, relationships) beyond the quick inline title/priority editing.
