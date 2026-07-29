# Feature 55: Fix Poll-Sync Flicker

**Status:** Completed  
**Branch:** `fix/f55-poll-sync-flicker`  
**PR:** #132  
**Commits:** `9a538c2` (main fix), `b1b6997` (review fixes)  
**Date:** 2026-07-22

## Problem

The dashboard Refresh button spinner flickered on every background poll cycle because `onPollRefreshStart` unconditionally set `this.isRefreshing = true`. Additionally, `TaskStore.upsert()` fired `tasks-changed` events even when the incoming task data was identical to the existing data, causing unnecessary re-renders during poll sync.

## Changes

### Fix 1: Suppress Refresh spinner on background polls
**File:** `web/src/components/ft-app.ts`

- **`onPollRefreshStart`** (line 93): Removed `this.isRefreshing = true` — background polls no longer trigger the spinner. The handler is now a no-op for the `isRefreshing` field.
- **`onManualRefresh`** (line 799): Added `this.isRefreshing = true` before `this.pollManager.refresh()` so the spinner only appears when the user explicitly clicks Refresh.
- **`onPollRefreshEnd`** remains unchanged — it still sets `this.isRefreshing = false`, which correctly clears after a manual refresh completes and is harmless for background polls.

### Fix 2: Add equality check to TaskStore.upsert()
**File:** `web/src/store/task-store.ts`

- Added deep equality check (`JSON.stringify` comparison) to `upsert()`. When no `_changes` array is provided AND the task data is identical to the existing entry, the method returns early without updating the Map or dispatching a `tasks-changed` event.
- When `_changes` is provided (streaming events), the event always fires — preserving existing behavior for real server-side mutations.
- Added explanatory comment on the `!_changes` guard.

### Fix 3: Handle refresh-error to prevent stuck spinner (from review)
**File:** `web/src/components/ft-app.ts`

- Added `onPollRefreshError` handler that clears `isRefreshing = false` on failed manual refreshes.
- Registered/unregistered in `switchToPolling()` and `stopPolling()` alongside existing event listeners.
- Pre-existing issue now fixed: previously, if a manual refresh failed, the spinner would stay stuck indefinitely.

## Verification

### Build
- Web frontend: `npm run build` ✅
- TypeScript: `tsc --noEmit` ✅ (no errors)
- Go binary: `go build -o ft ./cmd/ft` ✅

### Playwright Evidence
**Method:** Used `page.route()` to intercept gRPC-Web ListTasks calls with a 3-second delay, making the spinner state observable during in-flight requests. Programmatically switched ft-app to polling mode via `switchToPolling()`.

**Results (all verified via `isRefreshing` state AND `sl-button[loading]` DOM attribute):**

| Test | isRefreshing | Button `loading` attr | Result |
|---|---|---|---|
| Background poll in-flight | `false` | `false` | ✅ PASS |
| Manual refresh in-flight | `true` | `true` | ✅ PASS |
| After manual refresh | `false` | `false` | ✅ PASS |

### Screenshot Evidence
All screenshots at `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-55-poll-sync-flicker/`:

| Screenshot | MD5 | Description |
|---|---|---|
| `01-baseline-streaming.png` | `1773fc...` | Streaming mode — no Refresh controls visible |
| `02-polling-mode-idle.png` | `ed7433...` | Polling idle — Refresh button visible, no spinner |
| `03-background-poll-inflight.png` | `ed7433...` | Background poll **in-flight** — **identical to idle** (zero DOM change = no spinner) |
| `04-background-poll-complete.png` | `ed7433...` | Background poll complete — same as idle |
| `05-manual-refresh-inflight.png` | `833721...` | Manual refresh **in-flight** — **UNIQUE** (spinner visible on button) |
| `06-manual-refresh-complete.png` | `597d0f...` | Manual refresh complete — spinner cleared, timestamp updated |

**Key proof:** Screenshot 03 (background poll in-flight) is byte-identical to 02 (idle), while screenshot 05 (manual refresh in-flight) has a unique MD5 — visually showing the Shoelace loading spinner on the Refresh button.

### Code Review
- **Round 1:** APPROVE — 1 Important pre-existing (refresh-error) fixed, 2 suggestions addressed
- **Round 2:** APPROVE — no actionable findings
