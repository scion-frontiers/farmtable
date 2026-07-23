# Feature 59: x-farmtable-token Fallback Header (IAP Auth Fix)

**Date:** 2026-07-23
**Author:** dev-f59-iap-token (developer agent), farmtable-em-f59 (eng-manager)
**Branch:** feat/f59-iap-token-header
**Status:** PR ready

## Problem

Farmtable deployed behind Google Cloud IAP on Cloud Run. IAP consumes the
`Authorization: Bearer` header for its own OIDC validation, so the farmtable
`ft_` API token never reaches the backend auth interceptor. This means all
gRPC API clients (ft CLI, decomposer binary) operate as unauthenticated when
going through IAP — no user identity is associated with mutations.

## Solution

Added `x-farmtable-token` as a custom gRPC metadata key, following the same
pattern Scion uses with `X-Scion-Agent-Token`. The auth interceptor now checks
`x-farmtable-token` first, then falls back to `Authorization: Bearer`.

### Changes

1. **Server (`internal/server/auth.go`)**:
   - Added `extractToken(md)` helper that checks `x-farmtable-token` first
   - Updated `TokenAuthInterceptor` and `TokenAuthStreamInterceptor` to use it
   - Preserved backward compatibility (Authorization: Bearer still works)
   - Preserved wrong-scheme error for malformed Authorization headers

2. **CLI (`internal/cli/connect.go`)**:
   - `authCtx()` now sends token via both `authorization` and `x-farmtable-token`

3. **Decomposer (`internal/decomposer/writer.go`)**:
   - Same dual-header pattern as CLI

4. **Web client (`web/src/gen/grpc-client.ts`)**:
   - `metadata()` now sends `X-Farmtable-Token` alongside `Authorization`

5. **Tests (`internal/server/auth_test.go`)**:
   - `TestAuthInterceptor_CustomHeader` — token via custom header only
   - `TestAuthInterceptor_CustomHeaderPrecedence` — custom header wins over Authorization

### What Was NOT Changed

- `internal/serverapp/unified.go` — grpcweb default `AllowedRequestHeaders: ["*"]` already
  passes custom headers through. No change needed.
- Auth enforcement model — still advisory (no token → pass-through)
- Token format/storage — unchanged

## Verification

- All 8 auth tests pass (6 existing + 2 new)
- Full `go test ./...` passes
- `go build -o ft ./cmd/ft` succeeds
- Live IAP verification: confirmed x-farmtable-token passes through IAP to the server
  (tested against the deployed Cloud Run instance)

## Review

Code review verdict: **APPROVE** (no critical issues, 1 comment fix applied).
