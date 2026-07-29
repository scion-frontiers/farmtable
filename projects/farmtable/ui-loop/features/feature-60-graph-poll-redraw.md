# Feature 60: Fix Dependency View Redraw/Re-Zoom on Poll Ticks

**Date:** 2026-07-23
**Branch:** `fix/f60-graph-poll-redraw`
**Commit:** `e49fab2`
**Status:** Complete

## Problem

The Dependency graph view reset its viewport (pan + zoom snapping back to default) on every poll tick for external/polling collections. Two defects combined to cause this:

1. **Unstable structureKey()**: The `structureKey()` method in `ft-dependency-view.ts` did not sort the relationships array before joining. If the external API returned relationships in a different order between calls, the key changed, triggering a full re-layout and viewport reset.

2. **Unconditional snapshotComplete()**: `PollManager.refresh()` in `poll-manager.ts` fired `snapshotComplete()` on every poll cycle regardless of whether data had actually changed, triggering `requestUpdate()` on all views.

## Changes

### Fix 1: Sort relationships in structureKey()
**File:** `web/src/components/dependency/ft-dependency-view.ts`

Added `.sort()` to the inner relationships map chain, making the structure key order-insensitive for relationship arrays.

### Fix 2a: Make upsert() return boolean
**File:** `web/src/store/task-store.ts`

Changed `upsert()` return type from `void` to `boolean`. Returns `false` when the incoming task is identical to the stored one (no-op), `true` when data was actually updated. All existing callers ignore the return value, so this is backward-compatible.

### Fix 2b: Guard snapshotComplete() in PollManager.refresh()
**File:** `web/src/store/poll-manager.ts`

Added `anyChanged` tracking flag. Each `upsert()` and `delete()` call now contributes to this flag. `snapshotComplete()` is only fired when `anyChanged || store.isLoading`, preventing unnecessary view updates on no-op poll cycles.

## Verification

### Build verification
- TypeScript type-check (`tsc --noEmit`): PASS
- Vite production build: PASS
- Go build (`go build -o ft ./cmd/ft`): PASS

### Runtime verification
- Dashboard starts and serves HTML on port 9091
- Default collection loads with 7 test tasks
- **Dependency view** renders correctly with all tasks, phase badges, and color-coded borders
- **Tree view** renders correctly (regression check) with parent-child relationships visible
- **Board/Kanban view** renders correctly with proper phase columns

### Programmatic verification (Playwright)
- **upsert() returns boolean:** Confirmed (`typeof` check returns `"boolean"`)
- **Identical upsert returns false:** Confirmed (re-upserting same task data returns `false`)
- **No-change poll suppresses snapshotComplete:** Confirmed (`anyChanged === false`, `wouldFireSnapshot === false` when all tasks are identical)

## Evidence

Screenshots saved to `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-60-graph-poll-redraw/`:
- `01-dashboard-loaded.png` — Collection picker
- `02-collection-selected.png` — Board view with tasks loaded
- `03-dependency-view.png` — Dependency view (from initial script run)
- `04-tree-view-regression.png` — Tree view regression check (initial)
- `05-dependency-view.png` — Dependency graph view with all 7 tasks rendered
- `06-tree-view-regression.png` — Tree view with parent-child relationships
