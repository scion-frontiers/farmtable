# Feature 36: Independent Vertical Scroll for Main Content

## Summary

Added `min-height: 0` to the kanban board's `.board` CSS rule in
`ft-kanban-view.ts` so that tall kanban columns scroll their cards
internally instead of pushing the entire page vertically.

## Problem

When a kanban column contained many cards, the column's content would
grow beyond the viewport. Because the `.board` flex item used the
browser's default `min-height: auto`, it could not shrink below its
content size in a flex column layout. This caused the main content area
(`.main` in `ft-app.ts`) to scroll, potentially pushing the toolbar out
of view.

## Root Cause

In a CSS flex column layout, flex items default to `min-height: auto`,
which prevents them from shrinking below their intrinsic content height.
The `.board` div (a flex item inside `ft-kanban-view`'s column layout)
grew to fit the tallest column's full card list, overflowing the
viewport.

## Fix

Added a single CSS property to `.board` in `ft-kanban-view.ts`:

```css
.board {
  /* existing */
  display: flex;
  gap: 0.75rem;
  flex: 1;
  min-height: 0;       /* ← added */
  overflow-x: auto;
  padding-bottom: 0.5rem;
}
```

With `min-height: 0`, the board respects its flex-allocated height. The
kanban columns (which already have `overflow: hidden` on `:host` and
`overflow-y: auto` on `.cards`) then constrain their card lists and
scroll internally.

## Layout Chain

```
ft-app :host         → height: 100vh; flex-direction: column
  toolbar            → natural height (fixed at top)
  filter-chips       → natural height
  .content           → flex: 1; display: flex; overflow: hidden
    .main            → flex: 1; overflow: auto; padding: 1rem
      ft-kanban-view → height: 100%; flex-direction: column
        .board       → flex: 1; min-height: 0  ← THE FIX
          ft-kanban-column → overflow: hidden
            .cards   → flex: 1; overflow-y: auto  ← scrolls here
    .inspector       → width: 400px; overflow: hidden (unaffected)
```

## Precedent

This matches the existing pattern in `ft-tree-view.ts`, which already
uses `min-height: 0` on its `.canvas-container` flex item (line 59).

## Files Changed

- `web/src/components/kanban/ft-kanban-view.ts` — added `min-height: 0`
  to `.board` CSS rule (1 line)

## Verification

- Build passes (`npm run build` — tsc + vite, zero errors)
- Structural CSS test confirms:
  - Cards scroll within columns (scrollHeight > clientHeight)
  - Main content area does not scroll (scrollHeight ≈ clientHeight)
  - Toolbar stays fixed at top
  - Inspector panel stays fixed on right
- Screenshots with different md5 hashes prove real scroll interaction
- No regressions to other views (Dashboard, Tree, Ready Queue) — they
  use independent layout patterns (`display: block` or their own
  `min-height: 0`)

## Branch

`feat/f36-main-content-scroll`

## Date

2026-07-21
