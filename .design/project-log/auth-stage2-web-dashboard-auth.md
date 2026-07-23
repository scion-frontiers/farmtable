# Auth Stage 2: Web Dashboard Auth

**Date:** 2026-07-23
**Branch:** auth/stage2-web-dashboard-auth

## Summary

Implemented a complete login flow for the web dashboard so browser users can
authenticate after Stage 1 mandatory auth enforcement.

## Changes

### Server-side session endpoints (`internal/serverapp/session.go`)

- `POST /api/auth/session` — accepts `{"token": "ft_..."}`, validates against
  the token store via `server.TokenLookup`, creates an encrypted session cookie,
  returns user info.
- `GET /api/auth/session` — returns session info if session cookie is valid,
  re-validates the token (handles revocation). Returns 401 if no session.
- `DELETE /api/auth/session` — clears the session cookie (logout).
- Uses `gorilla/sessions` CookieStore with AES-256 encryption.
- Session key derived from `FARMTABLE_SESSION_KEY` env var, or auto-generated
  with a warning log (suitable for development).
- Cookie settings: httpOnly, SameSite=Lax, Secure when behind HTTPS/proxy.

### Session-to-bearer middleware (`internal/serverapp/session.go`)

- `SessionToBearerMiddleware` wraps gRPC-web handlers.
- Reads session cookie, extracts the stored farmtable token, injects it as
  `Authorization: Bearer <token>` and `X-Farmtable-Token` headers.
- Passes through unchanged when an `Authorization` header is already present.
- Applied in `UnifiedHandler` when `TokenLookup` is provided.

### UnifiedHandler changes (`internal/serverapp/unified.go`)

- Added `UnifiedHandlerOptions` struct with optional `TokenLookup` field.
- `UnifiedHandler` now accepts variadic options (backward compatible).
- When `TokenLookup` is provided, registers session endpoints and wraps gRPC-web
  handler with session-to-bearer middleware.
- Changed mux route registration from `HandleFunc` to `Handle` to support
  the middleware-wrapped gRPC-web handler.

### Dashboard and server integration

- `internal/cli/dashboard.go` — passes `TokenLookup` to `UnifiedHandler`.
- `cmd/farmtable-server/main.go` — passes `TokenLookup` to `UnifiedHandler`.

### Frontend: Login dialog (`web/src/components/ft-login-dialog.ts`)

- New Lit web component with a token input and "Sign in" button.
- POSTs to `/api/auth/session`, reloads page on success.
- Error feedback for invalid tokens and network errors.

### Frontend: Session check and login flow (`web/src/components/ft-app.ts`)

- Added `checkSessionAndRoute()` — checks `GET /api/auth/session` on startup.
- If no session and no localStorage token, shows the login dialog.
- If session exists or localStorage fallback is present, proceeds normally.
- Added `onLogout` handler that DELETEs the session and reloads.

### Frontend: Logout button (`web/src/components/ft-toolbar.ts`)

- Added `sessionUser` property showing user badge with display name.
- Added logout icon button (box-arrow-right) with tooltip.
- Dispatches `logout` custom event, handled by `ft-app`.

### Security: Removed `?token=` URL parameter (`web/src/gen/grpc-client.ts`)

- Removed `params.get('token')` from token resolution chain.
- Tokens in URLs leak in browser history, server logs, and referrer headers.
- `window.FARMTABLE_TOKEN` and `localStorage['farmtable.token']` remain as
  fallbacks for development and testing.

### Tests (`internal/serverapp/session_test.go`)

16 new tests covering:
- POST with valid/invalid/expired/empty token
- POST with invalid JSON body
- POST with nil lookup (service unavailable)
- GET with valid session / no session / revoked token
- DELETE clears session
- Session-to-bearer middleware injects headers
- Middleware passthrough with existing auth
- Middleware passthrough with no session
- Method not allowed (PUT)
- UnifiedHandler with/without session routes

All 18 tests in the serverapp package pass (2 existing + 16 new).

## Dependency added

- `github.com/gorilla/sessions v1.4.0`
- `github.com/gorilla/securecookie v1.1.2` (transitive)

## Files modified

- `internal/serverapp/session.go` (new)
- `internal/serverapp/session_test.go` (new)
- `internal/serverapp/unified.go` (modified)
- `internal/cli/dashboard.go` (modified)
- `cmd/farmtable-server/main.go` (modified)
- `web/src/components/ft-login-dialog.ts` (new)
- `web/src/components/ft-app.ts` (modified)
- `web/src/components/ft-toolbar.ts` (modified)
- `web/src/gen/grpc-client.ts` (modified)
- `web/src/index.ts` (modified)
- `go.mod` / `go.sum` (dependency addition)
