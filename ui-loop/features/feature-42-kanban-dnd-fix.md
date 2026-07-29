# Feature 42: Kanban Drag-and-Drop Dead Zone Fix

**Date:** 2026-07-22
**Branch:** `fix/f42-kanban-dnd-deadzone`
**Commit:** `4602156`
**Status:** Complete — pushed to origin

## Problem

PR #111 (commit `8dfd5b8`) removed `flex: 1` from the `.cards` CSS rule in
`web/src/components/kanban/ft-kanban-column.ts` as part of Feature 39's
single-scroll-region fix. This caused the `.cards` drop-target div to shrink
from filling the entire column height down to only covering its content area.

Since Kanban columns stretch via flex cross-axis alignment to match the tallest
column, this created massive dead zones (up to 95% of empty columns) where drag
and drop events silently failed — the user would drop a card and nothing would
happen.

## Fix

Restored `flex: 1;` as the first property in the `.cards` CSS rule (line 102).
This makes the `.cards` div fill the available column height again, ensuring the
entire column area is a valid drop target.

**Intentionally NOT restored:** `overflow-y: auto` — this was correctly removed
in PR #111 to implement the single scroll region (Feature 39). Only `flex: 1`
was needed.

### Diff

```diff
 .cards {
+  flex: 1;
   padding: 0 0.5rem 0.5rem;
   display: flex;
```

## Verification

Playwright test script (`verify-dnd-fix.mjs`) confirmed all tests pass:

| Test | Result |
|------|--------|
| `.cards` div fills column height (all 8 columns at 291px/291px) | PASS |
| DnD to bottom of column (previously dead zone) | PASS |
| DnD to middle of empty column area | PASS |
| No per-column scrollbars (Feature 39 regression check) | PASS |

Screenshots saved to:
`/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-42-kanban-dnd-fix/`

## Build Verification

- `npm ci && npm run build` — TypeScript and Vite build clean
- `go build -o ft ./cmd/ft` — Go binary builds clean
- Dashboard served on port 9090 with test DB
