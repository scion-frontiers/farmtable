# Feature 40: Inspector Panel Vertical Scroll

**Date:** 2026-07-21
**Branch:** feat/f40-inspector-scroll
**Status:** Implemented, verified locally with screenshots

## History

This is the fourth iteration of the scroll feature:

1. **Feature 36 (PR #106):** Added per-kanban-column scroll (wrong approach).
2. **Feature 38 (PR #109):** Fixed app-shell layout bug (`theme.css`'s
   `ft-app { display: block }` overriding `:host { display: flex }`). Header/Inspector
   stay fixed while `main` scrolls.
3. **Feature 39 (PR #111):** Removed per-column scroll so `.main` is the single scroll
   container for the whole main content area. Verified live.
4. **Feature 40 (this):** User feedback: "the inspector content has no vertical scroll
   capability." The Inspector panel clips content with no way to scroll when content
   overflows its visible height.

## Problem

After Feature 39, `.main`'s scroll worked correctly. But the Inspector panel had no
scroll mechanism at all — when its content (task properties, description, comments,
change history) exceeded the panel's visible height, content was clipped and inaccessible.

## Root Cause

The flex height chain through Shoelace's `sl-tab-group` component was broken.

The `.inspector` container in `ft-app.ts` correctly bounded the Inspector's height
(it's a flex item inside `.content { flex: 1; min-height: 0; overflow: hidden }`), and
`ft-inspector` declared `:host { height: 100% }` to inherit that bounded height. The
`.body` div inside the General tab panel had `overflow-y: auto`, which should have
created a scroll container.

However, the `sl-tab-group` web component (from Shoelace) has its own shadow DOM with
an internal flex column layout (`.tab-group { display: flex; flex-direction: column }`).
Three issues prevented the height chain from propagating:

1. **Redundant `display: flex; flex-direction: column` on `sl-tab-group`** — this styled
   the HOST element of the Shoelace component, conflicting with its internal layout.
   Shoelace already applies `display: flex; flex-direction: column` to its internal
   `.tab-group` container via `::part(base)`.

2. **Missing `min-height: 0` on `sl-tab-group` and `::part(body)`** — without this,
   these flex items couldn't shrink below their content's natural height, so the bounded
   height from the parent never propagated inward.

3. **Missing `height: 100%` on `::part(base)`** — the internal `.tab-group` container
   didn't fill its parent, so it grew to its natural content height instead of being
   bounded.

The `.body` div's `overflow-y: auto` never activated because its parent chain was
unbounded — all the scroll containers above it grew to fit their content rather than
constraining to the available viewport space.

## Changes Made (CSS only, 1 file)

### `web/src/components/inspector/ft-inspector.ts`

1. **`.body` rule** — Removed `flex: 1` and `overflow-y: auto`. The tab panel itself
   (`sl-tab-panel::part(base)`) is now the scroll container. The `.body` div just needs
   `padding-bottom: 1rem` for spacing.

2. **`sl-tab-group` rule** — Removed `display: flex; flex-direction: column` (redundant
   with Shoelace's internal layout). Added `min-height: 0` so it can shrink as a flex
   item within `ft-inspector`'s column layout.

3. **Added `sl-tab-group::part(base) { height: 100% }`** — The internal `.tab-group`
   container now fills its parent, propagating the bounded height inward.

4. **`sl-tab-group::part(body)` rule** — Added `min-height: 0` so the body area can
   shrink, allowing the bounded height to reach the `sl-tab-panel`.

### NOT changed

- **`ft-app.ts`**: `.inspector { overflow: hidden }` remains — it correctly clips at
  the Inspector boundary. Scroll happens inside `ft-inspector` via the tab panel.
- **`ft-app.ts`**: `.main { overflow: auto }` remains — Feature 39's single scroll
  region is preserved.
- **`theme.css`**: No changes — Feature 38's `display: flex` fix remains.
- **`ft-kanban-view.ts`** / **`ft-kanban-column.ts`**: No changes — Feature 39's
  per-column scroll removal preserved.

## Layout Chain: Before vs After

### Before (broken — no Inspector scroll)

```
ft-app :host         → height: 100vh; flex-direction: column; overflow: hidden
  toolbar            → natural height (~65px)
  .content           → flex: 1; display: flex; min-height: 0; overflow: hidden
    .main            → flex: 1; overflow: auto ← SINGLE SCROLL (working)
    .inspector       → width: 400px; overflow: hidden ← clips
      ft-inspector :host → display: flex; flex-direction: column; height: 100%
        .header-bar    → flex-shrink: 0
        ft-inspector-header → flex-shrink: 0
        sl-tab-group   → flex: 1; display: flex(REDUNDANT); flex-direction: column(REDUNDANT); overflow: hidden
          ::part(base) → .tab-group — NO height: 100% → UNBOUNDED
            ::part(body) → flex: 1; overflow: hidden — NO min-height: 0 → CAN'T SHRINK
              sl-tab-panel → height: 100%; overflow-y: auto (but parent unbounded → no scroll)
                .body    → flex: 1; overflow-y: auto ← NEVER ACTIVATES
```

### After (fixed — Inspector scrolls independently)

```
ft-app :host         → height: 100vh; flex-direction: column; overflow: hidden
  toolbar            → natural height (~65px)
  .content           → flex: 1; display: flex; min-height: 0; overflow: hidden
    .main            → flex: 1; overflow: auto ← SINGLE SCROLL (unchanged)
    .inspector       → width: 400px; overflow: hidden ← clips (unchanged)
      ft-inspector :host → display: flex; flex-direction: column; height: 100%
        .header-bar    → flex-shrink: 0
        ft-inspector-header → flex-shrink: 0
        sl-tab-group   → flex: 1; min-height: 0; overflow: hidden ← CAN SHRINK
          ::part(base) → height: 100% ← FILLS PARENT, BOUNDED
            ::part(body) → flex: 1; min-height: 0; overflow: hidden ← CAN SHRINK
              sl-tab-panel → height: 100%; overflow-y: auto ← SCROLL CONTAINER ✓
                ::part(base) → height: 100%; overflow-y: auto ← INNER SCROLL ✓
                  .body → padding-bottom: 1rem ← CONTENT (scroll handled by parent)
```

## Verification

### Build
`npm run build` passes (tsc --noEmit + vite build, 337 modules, 0 errors).
`go build -o ft ./cmd/ft` succeeds.

### Local Dashboard Verification (per local-test-protocol.md)

Used local dashboard with SQLite seed DB (22 tasks after adding extras for main scroll testing).

Programmatic verification via Playwright:
- Inspector `tabPanelBaseScrollHeight: 776`, `tabPanelBaseHeight: 645` → content overflows, scroll activates
- `tabPanelBaseOverflowY: "auto"` → scroll container correctly configured
- After `page.mouse.wheel(0, 400)` on inspector: `tabPanelBaseScrollTop: 131` → inspector scrolled ✓
- After `page.mouse.wheel(0, 300)` on main: `mainScrollTop: 300`, `inspectorScrollTop: 131` → independent ✓
- `toolbarTop: 0` throughout → toolbar fixed ✓
- `documentScrollTop: 0` throughout → no page-level scroll ✓

### Screenshots (saved to `feature-40-inspector-scroll/`)

- **`A-inspector-before-scroll.png`** — Inspector open showing task "Test task 4 - backlog item".
  Properties, Description, Comments visible. Content extends below viewport (no Change History
  visible). Backlog column shows 17 tasks confirming main content also overflows.

- **`B-inspector-scrolled-down.png`** — After scrolling Inspector down. Properties section
  partially scrolled up (Assignees/Labels gone). "Change History (0)" now visible at bottom,
  proving previously hidden content is reachable.

- **`C-main-scroll-unaffected.png`** — Main content scrolled down 300px. Original cards
  partially scrolled off, "Additional test task 1-5" visible. Toolbar at top. Inspector
  position unchanged. Inspector scroll position maintained.

- **`D-independent-scroll.png`** — Confirms independent scroll: `mainScrollTop: 300`,
  `inspectorScrollTop: 131`, `documentScrollTop: 0`. Scrolling one does not affect the other.

## Files Changed

- `web/src/components/inspector/ft-inspector.ts` — 4 CSS changes (removed 4 properties, added 3 properties, added 1 new rule)

## Local-First Protocol Feedback

The local-first protocol worked well. Total time from build to verified screenshots was ~3 minutes.
Key observations:
- The seed DB initially had only 7 tasks, which wasn't enough to make `.main` overflow. Added
  15 more tasks via `ft task create` to properly test main scroll.
- The collection selection landing page required an extra click before reaching the board.
- Playwright's `page.mouse.wheel()` works correctly for testing scroll interaction through
  shadow DOM boundaries.
