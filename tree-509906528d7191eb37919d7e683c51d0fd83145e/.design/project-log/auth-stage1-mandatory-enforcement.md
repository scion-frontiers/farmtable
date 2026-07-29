# Auth Stage 1: Mandatory Auth Enforcement

**Date:** 2026-07-23
**Branch:** auth/stage1-mandatory-enforcement

## Summary

Converted the farmtable auth interceptor from advisory (pass-through for
unauthenticated requests) to mandatory (reject unauthenticated requests when
token auth is configured). This is a breaking behavioral change: tokenless
requests to non-exempt RPCs now return `codes.Unauthenticated` instead of
silently succeeding.

## Changes

### Reject-by-default interceptor (`internal/server/auth.go`)

- `TokenAuthInterceptor`: when `lookup` is non-nil and no valid token is
  provided, requests to non-exempt RPCs are rejected with
  `codes.Unauthenticated` / "authentication required".
- `TokenAuthStreamInterceptor`: same change for streaming RPCs.
- When `lookup` is nil (open access mode), all requests pass through unchanged.

### RPC exemption list (`internal/server/auth.go`)

- Added `isUnauthenticatedEndpoint()` function that exempts `GetVersion` and
  `GetStatus` from auth checks. These health/status endpoints work without
  tokens even when auth is configured.
- Exemption check runs before token extraction, so exempt RPCs bypass the
  entire auth pipeline.

### FARMTABLE_OPEN_ACCESS env var

- `cmd/farmtable-server/main.go`: when `FARMTABLE_OPEN_ACCESS=1`, forces
  `lookup = nil` regardless of whether `FARMTABLE_TOKEN` is set. Logs "Open
  access mode enabled (FARMTABLE_OPEN_ACCESS)".
- `internal/cli/dashboard.go`: same support for the dashboard command.

### Embedded CLI mode verification

- Verified that `startEmbedded()` in `internal/cli/connect.go` works correctly
  with mandatory auth. The embedded mode always creates a local user and token
  via `ensureLocalUser()`, saves the token to config, and attaches it via
  `authCtx()` to all gRPC calls. No code changes needed.

### Test updates

- **New tests** (`internal/server/auth_test.go`):
  - `TestAuthInterceptor_NoTokenRejectsNonExemptRPC`: verifies tokenless
    requests to non-exempt RPCs are rejected.
  - `TestAuthInterceptor_ExemptRPCsPassWithoutToken`: verifies GetVersion and
    GetStatus work without tokens.
  - `TestAuthInterceptor_ValidTokenAccessesNonExemptRPC`: verifies valid tokens
    still grant access to non-exempt RPCs.
  - `TestAuthInterceptor_OpenAccessMode`: verifies all RPCs pass through when
    lookup is nil.

- **Updated tests**: Several existing tests that were implicitly relying on
  unauthenticated pass-through were updated to either use non-exempt RPCs or
  supply valid tokens:
  - `TestAuthInterceptor_InvalidToken` -> uses `ListCollections` instead of
    `GetVersion` (which is now exempt).
  - `TestAuthInterceptor_MissingBearerPrefix` -> same.
  - `TestAuthInterceptor_RecordUsageHasDeadline` -> same.
  - `TestListUsers`, `TestGetUser` in `identity_test.go` -> now create and
    supply valid tokens.

## Key Decisions

1. **Exemption before extraction**: The exemption check runs before metadata
   extraction or token parsing. This means exempt endpoints never touch the
   auth pipeline, which is simpler and more efficient.

2. **Existing test for NoLookupConfigured uses GetVersion**: The original
   `TestAuthInterceptor_NoLookupConfigured` test still passes because it uses
   `lookup=nil`, which means open access mode. GetVersion with nil lookup is
   doubly safe (open access + exempt).

3. **No changes to connect.go**: The embedded CLI mode was already correctly
   wired -- `ensureLocalUser` + `authCtx` handles token lifecycle end-to-end.

## Gotchas

- Tests that use `NewTestServerWithAuth` must supply a valid token for
  non-exempt RPCs. Previously they could rely on unauthenticated pass-through.
- The `TestAuthInterceptor_StoreBackedValidToken` test still uses `GetVersion`
  with a valid token, which works (exempt endpoints accept tokens too, they
  just don't require them).
