# B8: UI Poll-on-Interval Refresh for External Collections

**Date:** 2026-07-21
**Branch:** `feat/extstore-b8-poll-refresh`
**Status:** Complete

## Summary

When an external collection's `WatchTasks` returns `codes.Unimplemented`, the
UI now falls back to periodic `ListTasks` polling (30-second interval). A manual
Refresh button with loading state and last-refreshed timestamp is shown in the
toolbar. Polling stops when switching to the collection list or another
collection, and `WatchTasks` streaming resumes for farmtable-native collections.

## Changes

### New Files

- **`web/src/store/poll-manager.ts`** — `PollManager` class that periodically
  calls `ListTasks` and replaces the `TaskStore` contents. Emits
  `refresh-start`, `refresh-end`, `refresh-error`, and `status-changed` events.
  Uses token-guarded async to prevent stale responses. Default interval: 30s.

### Modified Files

- **`web/src/store/stream-manager.ts`**
  - Added `'polling'` to the `ConnectionStatus` type union.
  - Added `isUnimplementedError()` helper to detect gRPC code 12.
  - In `connect()` catch block: detect Unimplemented errors and emit
    `watch-unsupported` event instead of scheduling a reconnect.

- **`web/src/components/ft-app.ts`**
  - Added `PollManager` import and `pollManager?` field.
  - Added event handler properties: `onWatchUnsupported`, `onPollRefreshStart`,
    `onPollRefreshEnd`.
  - Added `@state()` properties: `isPolling`, `lastRefreshed`, `isRefreshing`.
  - Updated `disconnectedCallback` to clean up `watch-unsupported` listener and
    call `stopPolling()`.
  - Updated toolbar template to pass `?isPolling`, `.lastRefreshed`,
    `?isRefreshing`, and `@manual-refresh` bindings.
  - Updated `showCollectionList()` and `showBoard()` to call `stopPolling()`.
  - Updated `showBoard()` to register `watch-unsupported` listener on
    `StreamManager`.
  - Updated `stopStream()` to remove `watch-unsupported` listener.
  - Added `switchToPolling()`, `stopPolling()`, and `onManualRefresh` methods.

- **`web/src/components/ft-toolbar.ts`**
  - Added three new properties: `isPolling` (Boolean, reflect), `lastRefreshed`
    (Date | null), `isRefreshing` (Boolean, reflect).
  - Added CSS for `.refresh-controls` and `.last-refreshed`.
  - Added `renderRefreshControls()` method: shows an sl-button with
    arrow-clockwise icon and loading/disabled state during refresh, plus a
    relative-time timestamp.
  - Added `onRefreshClick()` dispatching `manual-refresh` event.
  - Added `formatRelativeTime()` for human-readable timestamps.
  - Updated `render()` to include refresh controls before the connection badge
    when polling is active.

- **`web/src/components/ft-connection-badge.ts`**
  - Added `case 'polling'` to `statusDisplay()` returning a green dot with
    label "Polling".

## Architecture

```
StreamManager.connect()
    |
    | catch: isUnimplementedError(err)?
    |    yes -> emit 'watch-unsupported'
    v
FtApp.onWatchUnsupported()
    |
    v
FtApp.switchToPolling()
    |
    | creates PollManager(client, taskStore)
    | listens to refresh-start/refresh-end
    v
PollManager.start()
    |
    | immediate ListTasks fetch
    | then setInterval(30s)
    v
PollManager.refresh()
    |
    | listTasks() -> store.clear() + store.upsert(each) + snapshotComplete()
    | emits refresh-end with lastRefreshed timestamp
    v
FtToolbar.renderRefreshControls()
    |
    | shows Refresh button + "Updated Xs ago"
    | onClick -> dispatches 'manual-refresh'
    v
FtApp.onManualRefresh()
    |
    v
PollManager.refresh() (manual trigger)
```

## Acceptance Criteria

- [x] Detect `codes.Unimplemented` from `WatchTasks` and fall back to polling
- [x] 30-second polling interval via `ListTasks`
- [x] Manual Refresh button with loading state
- [x] Last-refreshed relative timestamp
- [x] Stop polling on collection switch; resume WatchTasks for farmtable
- [x] Connection badge shows "Polling" with green dot
- [x] TypeScript compiles cleanly (`npx tsc --noEmit`)
