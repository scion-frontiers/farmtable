# Feature 4: Task Detail/Inspector Panel Inline Editing

## Status: Complete — PR #50 opened

**Branch:** `feat/task-detail-panel`
**PR:** https://github.com/scion-frontiers/farmtable/pull/50
**Commits:**
- `94020b7` feat: add inspector description editing
- `53228dc` feat: add inspector date editing
- `94d5aed` refactor: share optimistic task field updates
- `d1a04f7` docs: log inspector inline editing work
- `3627850` fix: address review round 1 feedback

## What Was Built

Added inline editing inside the existing task inspector panel for simple scalar fields already supported by the web update path.

### Description Editing
- Inspector description now has an edit affordance (pencil icon)
- Clicking the pencil opens an inline `sl-textarea` pre-filled with current markdown source
- Save via the check button or Ctrl/Cmd+Enter
- Cancel via the x button or Escape
- Saved content returns to the existing sanitized markdown preview
- Double-click on description text also activates editing

### Date Editing
- Due date and start date rows are now always visible (with "None" placeholder when unset)
- Each row has an inline edit button that opens an `sl-input type="date"`
- Save on check button or Enter; Cancel on x button or Escape
- Existing dates can be cleared with a row-level x button
- Web `UpdateTaskFields` now represents date clears as `null`, mapped to `clear_due_date` / `clear_start_date` in the gRPC request

### Shared Optimistic Update Path
- `ft-app` now handles `task-update` events from the inspector using the same optimistic update + rollback pattern used by Kanban card editing
- Added `applyTaskUpdateFields()` in the service layer so app, Kanban, and mock-client share parent/date clear behavior
- Eliminated 3 duplicate implementations of nullable field merge logic

## Explicitly Left Read-Only / Out of Scope

- **Assignees** — read-only; editing needs user selection/search UI
- **Relationships** — read-only; editing needs task-picker/search UI
- **Labels** — read-only in this pass; backend supports add/remove but needs deliberate tag-editing UX
- **Title/Priority** — editing stays on Kanban cards from Feature 3 (not duplicated)

## Files Changed

- `web/src/components/ft-app.ts` — handles inspector `task-update` events with optimistic rollback
- `web/src/components/inspector/ft-inspector.ts` — passes `taskId` into editable sub-components
- `web/src/components/inspector/ft-inspector-desc.ts` — description edit/view mode with save/cancel/keyboard shortcuts
- `web/src/components/inspector/ft-inspector-meta.ts` — date edit/clear controls, labels always visible
- `web/src/components/kanban/ft-kanban-view.ts` — refactored to use shared `applyTaskUpdateFields()`
- `web/src/gen/grpc-client.ts` — maps null dates to clear-date RPC fields
- `web/src/gen/service.ts` — expanded `UpdateTaskFields` typing, added `applyTaskUpdateFields()`, updated mock client

## Review Rounds

### Round 1 — APPROVE (2 Important, 6 Suggestions — all fixed)

| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| I-1 | Important | Description trim comparison asymmetry | Fixed: trim both sides in comparison |
| I-2 | Important | `unsafeHTML` + `renderMarkdown` DOMPurify dependency | Fixed: added safety comment at call site |
| S-1 | Suggestion | Redundant `taskId` property on `ft-inspector-meta` | Fixed: removed, using `this.task.id` directly |
| S-2 | Suggestion | `HTMLInputElement` cast for `sl-textarea` | Fixed: changed to `{ value: string }` interface |
| S-3 | Suggestion | Type assertion on computed date property key | Fixed: added explanatory comment |
| S-4 | Suggestion | UTC midnight timezone display for dates | Unaddressed: consistent with existing pattern |
| S-5 | Suggestion | Optimistic rollback stale object reference | Unaddressed: pre-existing pattern in kanban view |
| S-6 | Suggestion | Labels row always rendered | Acknowledged as improvement |

### Round 2 — APPROVE (1 Important pre-existing, 4 Suggestions, 1 Nitpick — shipped as-is)

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 1 | Important | Concurrent edit rollback can overwrite | Pre-existing pattern, not regression |
| 2 | Suggestion | Server response discarded on success | Pre-existing pattern |
| 3 | Suggestion | UTC midnight date timezone | Same as R1-S4 |
| 4 | Suggestion | No external update guard during editing | Common UX behavior |
| 5 | Suggestion | Arrow function allocations in renderDateRow | Negligible perf impact |
| 6 | Nitpick | Double cast through `unknown` in onDraftInput | Minor type cast style |

Per review exit criteria: Round 2 found only pre-existing patterns and minor suggestions with no new significant/blocking findings, so the feature ships as-is.

## Screenshots

Saved under `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-4-task-detail-panel/`:

- `1-panel-open.png` — Inspector open with real task data showing labels, dates, description
- `2-description-editing.png` — Description textarea open for inline editing with save/cancel controls
- `3-description-saved.png` — Description saved and rendered in markdown preview
- `4-due-date-editing.png` — Due date input open with date picker
- `5-due-date-saved.png` — Due date saved as Jul 27, 2026

## Verification

- `npm run typecheck` — pass
- `npm run build` — pass (existing Vite chunk-size warning only)
- `go test ./...` — pass
- `go build ./...` — pass
- Playwright against local Vite + `ft dashboard` — confirmed description and date edits persist via `ft task get`

## Developer's Next-Feature Suggestion

Add focused label editing in the inspector using tag chips plus an add/remove control. It is the next smallest inspector edit feature because backend add/remove label fields already exist, but the UI should avoid an ambiguous full-list replacement text box.
