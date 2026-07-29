# B7 Read-Only Mode — Review Fixes

**Date:** 2026-07-21
**PR:** #104 (feat/extstore-b7-read-only-mode)

## Summary

Addressed three code-review findings on the B7 read-only mode feature for
external (non-farmtable) collections.

## Bug 1: Comment submission not disabled in read-only mode

**Files:** `ft-inspector-comments.ts`, `ft-inspector.ts`

- Added `readOnly` property to `ft-inspector-comments`.
- When `readOnly` is true, the comment textarea and "Add comment" button are
  hidden entirely.
- Added an early-return guard in `submitComment()` so writes are blocked even if
  the form were somehow rendered.
- Passed `?readOnly` from `ft-inspector` to the comments component.

## Bug 2: Tree-view drop handlers lack readOnly guards

**Files:** `ft-tree-view.ts`, `ft-tree-node.ts`

- Added `if (this.readOnly) return;` guards to `onNodeDrop`, `onCanvasDrop`,
  and `reparentTask` in `ft-tree-view`.
- Added `readOnly` property to `ft-tree-node` and set `draggable` conditionally
  (`false` when read-only).
- Passed `?readOnly` from `ft-tree-view` to each `ft-tree-node` instance.

## UX: Priority badge still interactive in read-only mode

**File:** `ft-task-card.ts`

- `renderPriorityBadge()` now returns a plain `<sl-badge>` (no click handler or
  tooltip) when `readOnly` is true, matching the pattern in
  `ft-inspector-header.ts`.

## Defense-in-depth

**Files:** `ft-kanban-view.ts`, `ft-kanban-column.ts`

- Added `if (this.readOnly) return;` to `onTaskCreate` and `onColumnAddTask` in
  `ft-kanban-view`.
- Added `if (this.readOnly) return;` to `onAddTaskClick` in `ft-kanban-column`.
