# A8: Server Startup MultiStore Wiring

**Date:** 2026-07-21
**Task:** A8 — Wire MultiStore into server startup
**Branch:** feat/extstore-a8-multistore-wiring

## Summary

Modified `cmd/farmtable-server/main.go` to wrap the EntStore with a MultiStore
at server startup. This is a prerequisite for the External Store Passthrough
feature — the MultiStore acts as a transparent passthrough when no platform
stores are registered, but provides the routing infrastructure needed for B3
(lazy platform store registration).

## Changes

### cmd/farmtable-server/main.go
- Renamed the `store.NewEntStore()` result from `s` to `entStore`
- Added `store.NewMultiStore(entStore)` wrapping call, assigned to `s`
- All downstream code (`NewStoreTokenLookup`, `NewFarmTableService`, `defer
  s.Close()`) continues to work because `*MultiStore` satisfies `store.Store`

### cmd/farmtable-server/main_test.go
- Added `TestMultiStoreWrapsEntStore` test that creates an EntStore, wraps it
  with MultiStore, and verifies operations pass through correctly — mirroring
  the exact server startup pattern

## Verification

- `go build ./...` passes
- `go test ./...` passes (all packages)
- New test `TestMultiStoreWrapsEntStore` passes

## Notes

- The change is intentionally minimal (3 lines of functional code)
- With no platform stores registered, MultiStore is a no-op passthrough
- The `*MultiStore.Close()` method properly delegates to the wrapped EntStore
