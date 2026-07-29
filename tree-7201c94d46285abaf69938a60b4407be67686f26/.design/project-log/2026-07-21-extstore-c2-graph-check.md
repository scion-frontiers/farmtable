# C2: collectionSupportsGraph Setting Check

**Date:** 2026-07-21
**Branch:** feat/extstore-c2-graph-check
**Task:** External Store Passthrough — graph query support detection

## Summary

Added `collectionSupportsGraph` function to `internal/server/graph_support.go`.
This function determines whether a collection supports graph queries (critical
path analysis, blocking graph, bottleneck detection) based on two layers:

1. **Explicit override** — If `RemoteData["graph_queries"]` is a boolean, that
   value is used directly.
2. **Platform defaults** — Otherwise, fall back to per-platform defaults:
   - `farmtable`, `github`, `linear`, `jira` → **true**
   - `asana`, `beads` → **false**
   - Unknown platforms → **false**

## Files Changed

- `internal/server/graph_support.go` — New file containing `collectionSupportsGraph`
  and the `platformGraphDefaults` map.
- `internal/server/graph_support_test.go` — Tests covering all platforms'
  defaults, explicit true/false overrides, nil and empty `RemoteData`, non-bool
  values in the override key, unknown platforms, and unrelated remote data keys.

## Test Results

All 8 test cases pass (`go test ./internal/server/ -run TestCollectionSupportsGraph`).
`go build` and `go vet` pass on the server package.

## Notes

The existing `go build ./...` has pre-existing failures in the `linkedaccount`
schema/ent packages due to missing files on `origin/main`; these are unrelated
to this change.
