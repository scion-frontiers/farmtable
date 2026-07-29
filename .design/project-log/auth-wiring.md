# Auth Wiring: Stage 5/6 Server Startup Integration

**Date:** 2026-07-23
**Branch:** `auth/wire-stage5-stage6`
**Status:** Complete

## Summary

Wired Stage 5 (OAuth/IAP auth) and Stage 6 (credential improvements) components
into the server startup path. These components were previously merged to main
as standalone modules but were not integrated into `UnifiedHandler` or `main.go`.

## Changes

### `internal/serverapp/unified.go`
- Extended `UnifiedHandlerOptions` with `Store`, `AuthMode`, `BaseURL`,
  `IAPAudience`, and `AllowedDomains` fields
- `UnifiedHandler` now conditionally wires:
  - `GoogleOAuthManager` + `UserProvisioner` when `AuthMode == AuthModeOAuth`
  - `IAPAuthenticator` middleware + `UserProvisioner` when `AuthMode == AuthModeProxy`
  - `LinkFlowManager` routes whenever `Store` + `BaseURL` are both available
- Added `iapMiddleware()` helper that wraps HTTP requests: verifies IAP JWT,
  provisions users, creates sessions, and falls through when no assertion present

### `internal/serverapp/session.go`
- Added `SessionStore()` accessor on `SessionManager` so the OAuth manager
  can share the same gorilla `sessions.Store` for session creation

### `cmd/farmtable-server/main.go`
- Reads `FARMTABLE_AUTH_MODE` via `serverapp.AuthModeFromEnv()`
- Reads `FARMTABLE_IAP_AUDIENCE`, `FARMTABLE_ALLOWED_DOMAINS`, `FARMTABLE_BASE_URL`
- Sets `CredentialEncryptor` on `EntStore` when `FARMTABLE_ENCRYPTION_KEY` is set
- Passes all new fields to `UnifiedHandlerOptions`
- Starts `TokenRefresher` and `CredentialMonitor` as background goroutines
- Stops background services on SIGINT/SIGTERM before HTTP/gRPC shutdown

### `internal/cli/dashboard.go`
- Passes `Store` field to `UnifiedHandlerOptions` (enables link flows in dashboard)
- Leaves `AuthMode` at zero value (= `AuthModeToken`), preserving existing behavior

## Design Decisions

1. **Background services start from `main.go`**, not `UnifiedHandler`. They need
   a cancellable context tied to the server lifecycle, and `UnifiedHandler` is a
   pure handler factory with no lifecycle management.

2. **`AuthModeToken` is a no-op change**. When `FARMTABLE_AUTH_MODE` is unset or
   "token", no new code paths activate. The switch statement falls through to the
   existing behavior.

3. **IAP middleware wraps `grpcWebHandler`**, not the entire mux. This ensures
   IAP JWT verification applies to gRPC-web requests while static assets remain
   accessible without an assertion.

4. **Session sharing** via `SessionStore()` accessor rather than restructuring
   `SessionManager`'s constructor. This is the least invasive change and keeps
   the session key derivation logic encapsulated.

## Verification

- `go build ./...` passes
- `go test ./...` passes (all packages)
