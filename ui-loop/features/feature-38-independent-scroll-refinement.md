# Feature 38: Independent Scroll for Main Content (Refinement of Feature 36)

## Problem

After Feature 36 (PR #106) fixed scrolling within kanban columns by adding `min-height: 0` and `overflow: auto` to `.board` and `.on-hold-columns`, the main content area still didn't scroll independently from the header toolbar and inspector panel. Scrolling within the main content could move the entire page, shifting the header and inspector.

## Root Cause

The root issue was **not in `ft-app.ts`'s `:host` styles** as initially suspected — those styles correctly declared `display: flex; flex-direction: column; height: 100vh`. The problem was an **external CSS rule in `theme.css`** that overrode the shadow DOM styles:

```css
/* web/src/styles/theme.css */
ft-app {
  display: block;  /* ← OVERRIDES :host { display: flex } */
  height: 100%;
}
```

In the CSS cascade, **external styles targeting a custom element take precedence over `:host` styles** defined within the component's shadow DOM. This meant `ft-app` was rendered as `display: block` instead of `display: flex`, completely breaking the flex column layout.

### Why this caused the scroll problem

With `display: block`:
- The `.content` div was not a flex item — it expanded to its natural content height (1896px instead of ~735px)
- `.main` also expanded to the full content height, so `overflow: auto` never activated
- The entire page height exceeded the viewport, causing document-level scrolling
- This moved the toolbar and inspector with the scroll

## Fix

### 1. `web/src/styles/theme.css` (primary fix)

Changed `display: block` to `display: flex` so the external rule no longer conflicts with the component's internal flex layout:

```css
ft-app {
  display: flex;    /* was: display: block */
  height: 100%;
}
```

### 2. `web/src/components/ft-app.ts` (defensive hardening)

Added belt-and-suspenders CSS to prevent future regressions:

- **`:host` → `overflow: hidden`**: Prevents any overflow from escaping the component and triggering document-level scroll
- **`.content` → `min-height: 0`**: Explicitly allows the flex item to shrink in the column direction (some browsers don't respect `overflow: hidden` as an implicit `min-height: 0` trigger for flex items)
- **`.main` → `min-width: 0`**: Ensures the flex item can shrink below content's natural width in the row flex container

## Layout Chain: Before vs After

### Before (broken)

```
ft-app (external)     → display: BLOCK; height: 100%     ← :host display: flex OVERRIDDEN
  ft-toolbar           → natural height (~65px)
  ft-filter-chips      → hidden (display: none)
  .content             → height: 1896px (expands to content) ← SHOULD BE ~735px
    .main              → height: 1896px; overflow: auto (never activates)
      ft-kanban-view   → height: 100% = 1896px
        .board         → flex: 1; overflow: auto (works internally but parent is too tall)
```

Document scrolls because `.content` extends beyond viewport.

### After (fixed)

```
ft-app (external)     → display: FLEX; height: 100%       ← matches :host styles
  :host                → flex-direction: column; overflow: hidden
  ft-toolbar           → natural height (~65px)
  ft-filter-chips      → hidden (display: none)
  .content             → flex: 1; min-height: 0; height: 735px ← PROPERLY BOUNDED
    .main              → flex: 1; overflow: auto; height: 735px ← SCROLL CONTAINER
      ft-kanban-view   → height: 100% = 703px (735 - 2*16px padding)
        .board         → flex: 1; overflow: auto (scrolls internally)
    .inspector         → width: 400px; overflow: hidden     ← INDEPENDENT
```

`.main` is a proper scroll container. Header and inspector remain fixed.

## Why Feature 36 Was Incomplete

Feature 36 correctly fixed scrolling **within** kanban columns by adding `min-height: 0` and `overflow: auto` to `.board`. But it didn't address the **app shell layout** — specifically the `display: block` override in `theme.css` that prevented the entire flex column layout from working. Without `display: flex` on the host element, the flex-based height chain from `:host` → `.content` → `.main` was broken at the root level.

## Files Changed

1. **`web/src/styles/theme.css`** — Changed `ft-app { display: block }` to `display: flex`
2. **`web/src/components/ft-app.ts`** — Added `overflow: hidden` to `:host`, `min-height: 0` to `.content`, `min-width: 0` to `.main`

## Verification

- Build passes (`npm run build`)
- Toolbar stays at `top: 0px` across all scroll operations
- Inspector stays at `top: 65px` during board scroll
- Document `scrollTop` is always 0
- `.content` height is properly bounded (735px = 800px viewport - 65px toolbar)
- Kanban board horizontal scroll works independently (2164px content in 815px container)
- All views tested: Kanban, Tree, Dashboard

## Screenshots

Saved to `feature-38-independent-scroll-refinement/`:
- `kanban-inspector-1-top.png` — Kanban board at initial position with inspector open
- `kanban-inspector-2-scrolled.png` — Board scrolled right; toolbar and inspector remain in same pixel position
- `dashboard-1-top.png` — Dashboard view with correct layout
- `tree-1-top.png` — Tree view with correct layout
