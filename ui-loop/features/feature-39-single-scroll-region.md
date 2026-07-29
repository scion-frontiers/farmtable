# Feature 39: Single Scroll Region for Main + Inspector (v3 fix)

**Date:** 2026-07-21
**Branch:** feat/f39-independent-scroll-v3
**Commit:** c6a6038
**Status:** Implemented, verified with live data screenshots

## History

This is the third iteration of the scroll fix:

1. **Feature 36 (PR #106):** Added `overflow: auto` + `min-height: 0` to the kanban board's
   `.board` and `.on-hold-columns`, plus `overflow-y: auto` on column `.cards`. Result: each
   kanban column got its own scrollbar (per-column scroll). The app shell still allowed
   page-level scroll.
2. **Feature 38 (PR #109):** Found the real app-shell bug — `theme.css` had
   `ft-app { display: block }` overriding the Shadow DOM's `:host { display: flex }`.
   Fixed by changing to `display: flex`, plus defensive CSS. This fixed the header/inspector
   staying fixed while main scrolls.
3. **Feature 39 (this):** User feedback: "what I really need are independent vertical scroll
   bars for the whole of the main and inspector content." The per-column scroll from F36
   was still active. This fix removes per-column scroll so the entire board scrolls as one
   unit via `.main`.

## Problem

After F36 and F38, the kanban board had per-column vertical scrollbars — each column's
`.cards` div scrolled independently. The user wanted exactly TWO scroll regions:
- The entire `.main` content area as ONE scrollable region
- The Inspector panel as a SEPARATE scrollable region
- Scrolling one must not affect the other (already working from F38)

## Root Cause

Feature 36 added `height: 100%` → `flex: 1; min-height: 0` → `overflow-y: auto` chain
that constrained the kanban view to the viewport height and made each column scroll
internally. The fix is to remove these constraints so the kanban view grows to its
natural content height, and `.main` (which already has `overflow: auto` from the app shell)
becomes the sole vertical scroll container.

## Changes Made (CSS only, 2 files)

### `web/src/components/kanban/ft-kanban-view.ts`

1. **`:host` rule** — Removed `height: 100%`. Without this height constraint, the kanban
   view grows to its natural content height (tallest column). `.main`'s `overflow: auto`
   then provides the scrollbar.
2. **`.board` rule** — Removed `flex: 1` and `min-height: 0`. `flex: 1` made the board
   fill remaining height (enabling internal scroll). `min-height: 0` allowed it to shrink
   below content size. Both removed so the board grows naturally. `overflow: auto` is KEPT
   for horizontal scroll of wide boards — vertical scroll won't activate because the board
   is unconstrained vertically.
3. **`.on-hold-columns` rule** — Removed `min-height: 0`. Same rationale as `.board`.

### `web/src/components/kanban/ft-kanban-column.ts`

4. **`.cards` rule** — Removed `overflow-y: auto`. This was the per-column scrollbar.
   Without it, cards lay out at full natural height. Columns stretch to the tallest column
   via flex-row `align-items: stretch`. The board grows to fit, and `.main` scrolls.

### NOT changed

- **`ft-app.ts`**: `.main` already has `overflow: auto` — it becomes the single vertical
  scroll container automatically once the kanban view stops constraining its height.
- **`ft-inspector.ts`**: Already has independent scroll via `.body { overflow-y: auto }`
  and tab panels with `overflow-y: auto`. The `.inspector` div clips with
  `overflow: hidden` and `ft-inspector :host { height: 100% }` manages internal scroll.
- **`theme.css`**: No change needed (F38's `display: flex` fix remains).

## Layout Chain: Before vs After

### Before (per-column scroll)

```
ft-app :host         → height: 100vh; flex-direction: column; overflow: hidden
  toolbar            → natural height (~65px)
  .content           → flex: 1; display: flex; min-height: 0; overflow: hidden
    .main            → flex: 1; overflow: auto (COULD scroll, but kanban constrains itself)
      ft-kanban-view → height: 100% ← CONSTRAINS to .main height
        .board       → flex: 1; min-height: 0; overflow: auto ← SCROLLS HERE (both axes)
          ft-kanban-column → overflow: hidden
            .cards   → flex: 1; overflow-y: auto ← PER-COLUMN SCROLLBAR
    .inspector       → width: 400px; overflow: hidden (independent via ft-inspector)
```

### After (single scroll region on .main)

```
ft-app :host         → height: 100vh; flex-direction: column; overflow: hidden
  toolbar            → natural height (~65px)
  .content           → flex: 1; display: flex; min-height: 0; overflow: hidden
    .main            → flex: 1; overflow: auto ← SINGLE VERTICAL SCROLL CONTAINER
      ft-kanban-view → NO height constraint, grows to content
        .board       → overflow: auto (horizontal only — vertical never activates)
          ft-kanban-column → overflow: hidden
            .cards   → NO overflow-y: auto, cards flow naturally
    .inspector       → width: 400px; overflow: hidden (independent via ft-inspector)
```

## Verification

### Build
`npm run build` passes (tsc --noEmit + vite build, 337 modules, 0 errors).

### Scroll Structure (programmatic verification via Playwright)

- `.main` `overflowY: "auto"`, `scrollHeight: 1896`, `clientHeight: 735` → `.main` IS the scroll container
- Column `.cards` `overflowY: "visible"`, `scrollHeight === clientHeight` → NO per-column scrollbars
- After `page.mouse.wheel(0, 500)` on `.main`: `mainScrollTop: 500`, `toolbarTop: 0`, `documentScrollTop: 0` → main scrolled, toolbar fixed, no page-level scroll
- Inspector scroll: `mainScrollTop` stayed at 300 during inspector wheel event → independent

### Screenshots (saved to `feature-39-single-scroll-region/`)

- **`A-initial-top.png`** — Kanban board with real tasks (23 total, 14 in Ready column).
  All columns at same height, no per-column scrollbars visible. Content extends below
  viewport, confirming `.main` will need to scroll.

- **`B-main-scrolled.png`** — After `page.mouse.wheel(0, 500)` on `.main`. Content has
  scrolled down (different cards visible). Toolbar remains at top (pixel position 0).
  TRIAGE column (left) now shows empty space — confirming the WHOLE board moved together
  as one unit, not individual columns.

- **`C-inspector-scrolled.png`** — Inspector open showing task details (Properties,
  Description, Comments). Main content scrolled down (mainScrollTop: 300). Inspector
  scrolled via separate mouse wheel event. Main scroll position UNCHANGED at 300 —
  confirming independent scroll regions.

- **`D-horizontal-scroll.png`** — Board scrolled right via `page.mouse.wheel(400, 0)`.
  TRIAGE column no longer visible (scrolled past), READY column visible with task cards,
  empty columns (WORKING, IN REVIEW, etc.) visible to the right. Toolbar fixed at top.
  Confirms horizontal scroll still works.

## Files Changed

- `web/src/components/kanban/ft-kanban-view.ts` — removed 4 CSS properties (height, flex, min-height x2)
- `web/src/components/kanban/ft-kanban-column.ts` — removed 1 CSS property (overflow-y)
