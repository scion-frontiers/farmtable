# Feature 10: Kanban Card Keyboard Navigation

## Summary

Added keyboard accessibility to the kanban board's task cards — focusable cards, Enter/Space activation, roving tabindex with arrow key navigation within and across columns, and visible focus styling. Mirrors the keyboard-first pattern established in Feature 9 (inspector keyboard navigation).

## Changes

- `web/src/components/kanban/ft-task-card.ts`
  - Made the card shell focusable with roving `tabindex` (managed by parent column).
  - Added Enter/Space keyboard activation that dispatches the existing `task-select` event.
  - Added a public `focusCard()` method for parent-managed roving focus.
  - Added visible `:focus-visible` focus styling using `--ft-focus-ring`, `--ft-focus-ring-offset`, and `--sl-color-primary-500`.
  - Added `role="option"` and `aria-label` for screen reader accessibility.
  - Added `aria-selected` attribute for selected card state.
  - Guarded keyboard activation so nested inline edit controls keep their own keyboard behavior (`e.target !== e.currentTarget`).

- `web/src/components/kanban/ft-kanban-column.ts`
  - Added roving tabindex state with one active card per column (`activeCardIndex`).
  - Added ArrowUp/ArrowDown/Home/End movement within the column.
  - Memoized sorted tasks via `@state() _sortedTasks` computed in `updated()`.
  - Clamps the active index when the task list changes.
  - Dispatches a composed `column-nav` event for ArrowLeft/ArrowRight.
  - Uses delegated event handlers via `data-card-index` attributes (avoids per-card closure allocation).
  - Added `role="listbox"` and `aria-label` on the cards container.

- `web/src/components/kanban/ft-kanban-view.ts`
  - Handles `column-nav` events at the view level for cross-column navigation.
  - Moves focus left/right to adjacent non-empty columns.
  - Clamps target row index to destination column length.
  - Board columns and on-hold columns are separate keyboard regions by design (documented in code).

## Commits

- `8ff4dcc` — feat: add keyboard navigation to kanban task cards
- `9ddb8eb` — fix: address R1 review findings for kanban keyboard nav
- `df0a76e` — fix: address R2 review findings for kanban keyboard nav

## Verification Results

- `cd web && npm run typecheck`: passed (all 3 commits)
- `cd web && npm run build`: passed (all 3 commits)
- Runtime Playwright check: ArrowDown moved focus between cards; ArrowRight moved focus to adjacent column.

## Screenshots

Saved in `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-10-kanban-keyboard-nav/`.

- `card-focus-ring.png`
  - Shows the first Triage task card with the visible keyboard focus ring.
  - MD5: `3ada7993474df11a584117090d293559`

- `card-arrowdown-focus.png`
  - Shows focus moved to the next Triage card after pressing ArrowDown.
  - MD5: `b90405b0ca29672167ff246f342974c8`

## Review History

### R1: APPROVE with 1 Important + 4 Suggestions (ALL fixed)
- I-1: `sortedTasks` getter re-sorts on every call → used `this.tasks.length` in `updated()` and `this.cardElements.length` for End key
- S-1: Missing `role` attribute on card shell → added `role="button"` and `aria-label`
- S-2: Cross-column nav scope undocumented → added comment explaining board vs on-hold separation
- S-3: Inline arrow closures in template → converted to delegated handlers with `data-card-index`
- S-4: `--sl-` CSS prefix misleading → renamed to `--ft-focus-ring` / `--ft-focus-ring-offset`

### R2: REQUEST CHANGES with 1 Critical (self-downgraded) + 2 Important + 4 Suggestions
- I-1: Missing ARIA container role → added `role="listbox"` and `aria-label` on cards container
- I-2: `sortedTasks` getter recomputes on every access → replaced with `@state() _sortedTasks` computed in `updated()`
- Card role changed from `role="button"` to `role="option"` with `aria-selected`

### R3: APPROVE with 1 Important (non-blocking) + 3 Suggestions
- I-1: `updated()` → `willUpdate()` to avoid double render (efficiency, not correctness) — not fixed, ship as-is per exit criteria
- S-1: `aria-selected="false"` could be omitted via `nothing` — ship as-is
- S-2: Default `cardTabIndex` could be `-1` — ship as-is
- S-3: `column-nav` event doesn't need `composed: true` — ship as-is

### Unaddressed R3 Suggestions (shipped as-is per exit criteria)
- `updated()` vs `willUpdate()` for derived state (double render, no visual effect)
- `aria-selected="false"` verbosity on non-selected options
- Default `cardTabIndex = 0` vs `-1`
- `column-nav` event `composed: true` scope

## Suggested Next UI/UX Feature

Add a compact keyboard shortcut overlay for the board and inspector, opened from the toolbar. The next accessibility step is discoverability: users can now navigate by keyboard, but there is no in-app way to learn the supported keys.

## Final State

- Branch: `feat/kanban-keyboard-nav`
- Commits: 3 (feat + R1 fixes + R2 fixes)
- 3 files changed, +179 / -4 lines
- All quality checks pass (typecheck, build)
- 3 review rounds: R1 APPROVE (all fixed), R2 REQUEST CHANGES (all fixed), R3 APPROVE (non-blocking only, ship as-is)
