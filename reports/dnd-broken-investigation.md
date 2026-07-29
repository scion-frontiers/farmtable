# Investigation: Drag-and-Drop Broken Everywhere

**Date:** 2026-07-22  
**Status:** Root cause found, fix verified  
**Severity:** Critical — core user-facing functionality completely broken  
**Scope:** XS (one-line CSS fix)

## Summary

Drag-and-drop on the kanban board is broken because PR #111 (commit `8dfd5b8`, merged 2026-07-21 15:17) removed `flex: 1` from the `.cards` CSS rule in `ft-kanban-column.ts`. This caused the drop target (the `.cards` div containing the task cards) to shrink to its content height rather than filling the entire column. Since columns stretch to match the tallest column via flex cross-axis alignment, this creates a massive **dead zone** (up to 1795px, ~95% of the column area for empty columns) where drops silently fail. The fix is to add `flex: 1;` back to `.cards`.

## Reproduction

### Why the prior investigation missed it

The prior investigation (triage-dnd-investigation.md) used Playwright mouse events targeting the **exact center** of the `.cards` div's bounding rect. This precision-targeted the small valid drop zone. A real user drags to the visible column area, which is almost entirely dead zone.

### Demonstrated with Playwright on the live deployment

**Before fix** — drag to the "Working" column at y=500 (287px below the `.cards` bottom at y=213):
```
dragover reached .cards handler: false at final position
drop occurred: false
Result: ❌ FAILED
```

**After fix** (injecting `flex: 1` on `.cards` via Playwright):
```
.cards now extends to bottom: 2007px (covers entire column)
dragover reached .cards handler: true
drop occurred: true
Result: ✓ SUCCESS
```

### Dead zone measurements (live deployment)

| Column | Cards | Host Height | .cards Height | Dead Zone | % Dead |
|--------|-------|------------|---------------|-----------|--------|
| Triage | 0 | 1884px | 40px | **1795px** | 95% |
| Backlog | 1 | 1884px | 106px | **1728px** | 92% |
| Ready | 17 | 1884px | 1835px | 0px | 0% |
| Working | 0 | 1884px | 40px | **1795px** | 95% |
| In Review | 1 | 1884px | 132px | **1702px** | 90% |
| In QA | 0 | 1884px | 40px | **1795px** | 95% |
| Deploying | 0 | 1884px | 40px | **1795px** | 95% |
| Completed | 0 | 1884px | 40px | **1795px** | 95% |

Empty columns have only a 40px (2rem, from `min-height`) valid drop target at the top. Users dragging anywhere else in the visually prominent column area get no response.

## Root Cause

### Specific commit and property

- **PR:** #111, "fix(web): single scroll region for main content (v3 scroll fix)"
- **Merge commit:** `8dfd5b8` (2026-07-21 15:17:30 -0700)
- **File:** `web/src/components/kanban/ft-kanban-column.ts`
- **Property:** `flex: 1` removed from `.cards` CSS rule (also removed `overflow-y: auto`)

### Before (working):
```css
.cards {
  flex: 1;           /* ← STRETCHED to fill column height */
  overflow-y: auto;  /* ← per-column scroll (also removed) */
  padding: 0 0.5rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 2rem;
  ...
}
```

### After (broken):
```css
.cards {
  /* flex: 1 REMOVED — .cards shrinks to content height */
  /* overflow-y: auto REMOVED — scroll now via .main ancestor */
  padding: 0 0.5rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 2rem;
  ...
}
```

### Why this breaks DnD

1. The `.board` container uses `display: flex` (row direction). Default `align-items: stretch` stretches all columns to match the tallest column.
2. Without `flex: 1`, the `.cards` div only covers actual card content height.
3. The remaining column height (header to bottom) has no element with drag event handlers.
4. HTML5 DnD events (`dragover`, `drop`) in the empty space fire on `ft-kanban-column`'s shadow host, which has no drag handlers — they're on the `.cards` div inside the shadow root.
5. Since `dragover` is never `preventDefault()`-ed in the dead zone, the browser shows a "no drop" cursor and suppresses the `drop` event.

### Why the PR removed it

The PR #111 commit message says: "Remove now-inert `flex: 1` from `.cards` (no longer needed since the column is not height-constrained)." This was incorrect — the column IS effectively height-constrained by flex cross-axis stretching when adjacent columns are taller. `flex: 1` was still needed to make the drop target fill the stretched height.

## Other PRs Checked

- **PR #109** (commit `50b51ba`): Added `overflow: hidden` to ft-app `:host`. Not the cause — doesn't affect drop target sizing.
- **PR #112** (commit `8ac4bc0`): Inspector panel CSS only. Isolated.
- **PR #113** (commit `146b3be`): Tree view animation only. Isolated.

## Recommended Fix

Add `flex: 1;` back to the `.cards` CSS rule in `web/src/components/kanban/ft-kanban-column.ts`:

```css
.cards {
  flex: 1;  /* ← ADD THIS BACK: ensures drop target fills column height */
  padding: 0 0.5rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 2rem;
  transition: background 0.15s;
}
```

This is safe because:
- The scroll is now handled by `.main` (the PR #111 change that works correctly)
- `flex: 1` just makes `.cards` fill the available height within the column, it doesn't bring back per-column scrolling
- The `overflow-y: auto` removal should stay — that WAS the source of per-column scroll, and `.main` now handles it

## Verification

The fix was verified via Playwright on the live deployment by injecting `flex: 1` via `cardsDiv.style.flex = '1'`. After injection:
- All columns show 0px dead zone
- Drops succeed at any point within the column area
- No regression in scroll behavior

## Open Questions

None — root cause is clear, fix is verified.
