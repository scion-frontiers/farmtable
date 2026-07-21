# Fix: Passthrough Stuck-Spinner Bug

**Date:** 2026-07-21
**Task:** Fix infinite loading spinner on external-platform collections
**Branch:** fix/passthrough-spinner

## Summary

Fixed a live bug where external-platform collections (e.g. collection
466c2baa, platform: github) showed an infinite loading spinner on the deployed
dashboard. Two root causes were identified and fixed:

1. **Frontend: Fragile string-matching for gRPC Unimplemented detection.**
   The `isUnimplementedError()` function in `stream-manager.ts` relied on
   matching substrings like `"Unimplemented"`, `"code 12"`, etc. in the error
   message. When the server returned `codes.Unimplemented` with a custom status
   message that didn't contain any of these substrings, the error was
   misclassified and the stream manager entered an infinite reconnect loop
   instead of falling back to polling.

2. **Backend: PlatformResolver not wired into production server.** The
   `github.NewPlatformResolver()` was only used in tests but never registered
   in `cmd/farmtable-server/main.go`, so the MultiStore could not resolve
   GitHub collections to their passthrough stores at runtime.

## Changes

### web/src/util/grpc-error.ts (new)
- Created `GrpcError` class extending `Error` with a `code: number` property
  carrying the numeric `grpc.Code` value
- Exported `isUnimplementedError()` utility function for code-based detection

### web/src/gen/grpc-client.ts
- Added import and re-export of `GrpcError` from `../util/grpc-error.js`
- Streaming `onEnd` callback: changed `new Error(...)` to
  `new GrpcError(code, ...)` so the gRPC status code is preserved
- Unary `onEnd` callback: changed `new Error(...)` to
  `new GrpcError(output.status, ...)` so the gRPC status code is preserved

### web/src/store/stream-manager.ts
- Replaced the old `isUnimplementedError()` function (5-line string-matching)
  with a single-line code-based check:
  `err instanceof GrpcError && err.code === grpc.Code.Unimplemented`
- Added imports for `grpc` and `GrpcError`

### cmd/farmtable-server/main.go
- Added import for `github.com/farmtable-io/farmtable/internal/platform/github`
- Added `s.SetResolver(github.NewPlatformResolver())` after `NewMultiStore()`
  to wire platform resolution into the production server

## Verification

- `go build ./...` passes
- `go test ./...` passes (all packages)
- `tsc --noEmit` passes (frontend type check)
