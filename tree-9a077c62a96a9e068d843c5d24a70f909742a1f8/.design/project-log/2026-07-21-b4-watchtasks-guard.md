# B4: WatchTasks External Collection Guard

**Date:** 2026-07-21
**Task:** B4 — WatchTasks external collection guard
**Branch:** feat/extstore-b4-watchtasks-guard

## Summary

Added a guard to the WatchTasks streaming RPC that rejects watch requests
targeting external platform collections (github, linear, jira, asana, beads)
with `codes.Unimplemented`. External collections use passthrough stores that
proxy to external APIs and don't have local state mutation events, so real-time
streaming is not possible for them. Clients should use polling instead.

## Changes

### internal/server/watch.go
- Added `collection` package import for `collection.PlatformFarmtable` constant
- Inserted a guard block after request validation in `WatchTasks()`:
  - If `collection_id` is specified, parses and looks up the collection via
    `s.store.GetCollection()`
  - If the collection's platform is not `farmtable`, returns
    `codes.Unimplemented` with a descriptive message directing clients to use
    polling
  - If no `collection_id` is specified or platform is `farmtable`, proceeds
    normally

### internal/server/watch_test.go
- `TestWatchTasks_ExternalCollectionReturnsUnimplemented`: creates collections
  with github, linear, jira, and asana platforms; verifies each returns
  `codes.Unimplemented` from WatchTasks
- `TestWatchTasks_FarmtableCollectionAllowed`: verifies WatchTasks works
  normally for a default (farmtable) collection with `include_initial`
- `TestWatchTasks_NoCollectionFilterAllowed`: verifies WatchTasks works
  normally when no `collection_id` filter is specified

## Verification

- `go build ./internal/server/` passes
- `go test ./internal/server/` passes (all existing + 3 new tests)
