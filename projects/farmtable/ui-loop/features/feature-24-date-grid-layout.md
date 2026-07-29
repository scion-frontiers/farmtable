# Feature 24: Inspector Date Grid Layout

## Summary

Changed the Inspector panel's date fields from a vertical list of full-width rows into a 2x2 CSS grid layout. Previously, Due date, Start date, Created, and Updated were each rendered as separate `<div class="row">` elements spanning the full inspector width. Now they share a compact grid:

```
Row 1:  Start Date  |  Due Date
Row 2:  Created     |  Updated
```

## Changes

**File modified:** `web/src/components/inspector/ft-inspector-meta.ts`

**CSS additions:**
- `.date-grid` -- CSS Grid container with `grid-template-columns: 1fr 1fr`
- `.date-cell` -- Flex column layout (label on top, value below)
- Overrides for `.date-value` and `.date-editor` within cells to left-align instead of right-align
- `.edit-buttons` wrapper so save/cancel icons sit together below the date input in edit mode
- Date input width set to 100% within cells to fit the narrower column

**Method changes:**
- Renamed `renderDateRow` to `renderDateCell` -- adapts the editable date field to work inside a grid cell with stacked layout and grouped edit buttons
- Added `renderReadOnlyDateCell` -- simple label/value cell for Created and Updated, shows em-dash when value is missing
- Updated `render()` -- replaced four separate date `<div class="row">` blocks with a single `<div class="date-grid">` containing four cells

**Behavioral preservation:**
- Start Date and Due Date remain editable with pencil icon, date input, save/cancel buttons
- Clear button still appears when a date value is set
- Keyboard navigation (Enter to save, Escape to cancel) unchanged
- Created is always shown (required field); Updated shows em-dash if absent
- Assignees, Type, Labels rows untouched

## Verification

- TypeScript compilation: passed (`tsc --noEmit`)
- Vite build: passed
- Go build: passed (embed updated)
- Screenshots captured showing the 2x2 grid in the inspector panel

## Review Rounds

- **Round 1:** APPROVE with 2 nitpicks:
  1. Dead `width: 9rem` on base `sl-input.date-input` (overridden by `.date-cell` variant) → fixed
  2. Missing `min-width: 0` on `.date-cell` for grid overflow guard → fixed
  Both addressed in commit `a3a18c6`.

- **Round 2:** APPROVE with 1 cosmetic nitpick only (orphaned base `.date-value`/`.date-editor` CSS overrides). Stopped per exit criteria (only nitpicks remain in Round 2+).

## Feature 25 Conflict

No conflict encountered. Feature 25 had not merged at the time of PR creation. The diff is narrow (single file, date fields only) — minimal surface for conflict.

## Worktree Experience

Worktree at `/workspace/farmtable-f24-date-layout` worked smoothly. Setup (npm ci + vite build) took ~15 seconds. No issues with branch exclusivity or builds. Consistent with Feature 23 experience.

## Commits

- `81148b6` — feat: change inspector date fields to 2x2 grid layout
- `a3a18c6` — fix: address R1 review nitpicks — remove dead CSS width, add grid overflow guard

## PR

https://github.com/scion-frontiers/farmtable/pull/70 — CLEAN/MERGEABLE confirmed
