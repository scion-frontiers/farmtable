# B8: UI Poll-on-Interval Refresh for External Collections

**Date:** 2026-07-21
**Branch:** `feat/extstore-b8-poll-refresh`
**Status:** Complete

## Summary

External platform collections (GitHub, Linear, Jira, etc.) do not support the
`WatchTasks` streaming RPC — the server returns `codes.Unimplemented`. This task
adds a polling fallback so the web dashboard can still show up-to-date task data
for external collections without requiring WatchTasks support.

## Changes

### New file: `web/src/store/poll-manager.ts`

- `PollManager` class that periodically calls `ListTasks` and replaces the
  `TaskStore` contents with the results.
- Default interval: 30 seconds.
- Exposes `refresh()` for manual/on-demand refresh.
- Emits `refresh-start`, `refresh-end`, `refresh-error`, and `status-changed`
  events so the UI can show loading states and last-refreshed timestamps.
- Token-guarded against stale responses when `stop()` is called mid-flight.

### Modified: `web/src/store/stream-manager.ts`

- Added `isUnimplementedError()` helper to detect gRPC `codes.Unimplemented`
  from error messages (code 12).
- On catching an Unimplemented error in the `connect()` method, the stream
  manager now emits a `watch-unsupported` custom event instead of retrying.
- Added `'polling'` to the `ConnectionStatus` type union.

### Modified: `web/src/components/ft-app.ts`

- Imported `PollManager`.
- Added `pollManager`, `isPolling`, `lastRefreshed`, `isRefreshing` state.
- On receiving `watch-unsupported` from `StreamManager`, calls
  `switchToPolling()` which tears down the stream and starts the `PollManager`.
- `stopPolling()` cleans up the poll manager and resets polling state.
- `showBoard()` and `showCollectionList()` now stop polling when switching.
- Passes `isPolling`, `lastRefreshed`, `isRefreshing` to `ft-toolbar`.
- Handles `manual-refresh` event from the toolbar.

### Modified: `web/src/components/ft-toolbar.ts`

- Added `isPolling`, `lastRefreshed`, `isRefreshing` properties.
- Added `renderRefreshControls()` that shows a "Refresh" button with loading
  state and a relative last-refreshed timestamp (e.g., "Updated 15s ago").
- Refresh controls only render when `isPolling` is true.
- `onRefreshClick()` dispatches `manual-refresh` event up to `ft-app`.
- Added CSS for `.refresh-controls` and `.last-refreshed`.

### Modified: `web/src/components/ft-connection-badge.ts`

- Added `'polling'` case to `statusDisplay()` — shows a green dot with
  "Polling" label.

## Acceptance Criteria

- [x] External collections auto-refresh via polling (30s interval)
- [x] Manual Refresh button works (visible only for polling collections)
- [x] Polling stops when switching to a farmtable collection
- [x] WatchTasks resumes for farmtable collections
- [x] TypeScript compiles (`npx tsc --noEmit` passes)
- [x] Last-refreshed timestamp shown in toolbar

## Architecture Notes

The `StreamManager` tries WatchTasks first for every collection. If the server
returns `Unimplemented`, it fires `watch-unsupported` once (no reconnect retry).
`FtApp` handles this by creating a `PollManager` that takes over data fetching.
When the user navigates to a different collection, both managers are stopped and
a fresh `StreamManager` is created — if the new collection is a farmtable
collection, WatchTasks will succeed and streaming resumes normally.
