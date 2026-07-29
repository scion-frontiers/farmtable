# Auth Stage 6: External Credential Improvements

**Date:** 2026-07-23
**Branch:** `auth/stage6-credential-improvements`
**Status:** Complete

## Summary

Added encrypted-at-rest credential storage, OAuth flows for external platforms
(GitHub, Jira, Linear), background token refresh, and credential monitoring.

## Changes

### 1. Encrypted-at-Rest Storage (`internal/store/crypto.go`)

- `CredentialEncryptor` using AES-256-GCM for auth_token/refresh_token fields
- Encryption key loaded from `FARMTABLE_ENCRYPTION_KEY` env var (base64-encoded 32-byte key)
- `enc:v1:` prefix distinguishes encrypted values from plaintext
- Backward-compatible: plaintext tokens are returned as-is on decrypt
- `EncryptIfNeeded()` for transparent plaintext-to-encrypted migration
- Tests cover: round-trip, double-encrypt idempotency, wrong-key rejection,
  key rotation, plaintext migration, unique nonces

### 2. Ent Schema Updates (`internal/store/schema/linkedaccount.go`)

New fields on LinkedAccount:
- `refresh_token` (string, optional, sensitive) — OAuth refresh token
- `token_expiry` (time, optional, nillable) — when the access token expires
- `scopes_granted` (JSON string array, optional) — scopes the user granted
- `last_validated_at` (time, optional, nillable) — last credential validation

Supporting changes:
- `CreateLinkedAccountParams` extended with `RefreshToken`, `TokenExpiry`, `ScopesGranted`
- New `UpdateLinkedAccountParams` and `UpdateLinkedAccount()` method on `Store` interface
- Implemented on `EntStore`, `MultiStore`, `GitHubPassThroughStore`
- Ent code regenerated via `go generate ./internal/store/ent`

### 3. Platform OAuth Flows (`internal/serverapp/linkflows.go`)

HTTP endpoints for OAuth 2.0 link flows:
- **GitHub:** `GET /api/link/github/install` → `/api/link/github/callback`
- **Jira:** `GET /api/link/jira/connect` → `/api/link/jira/callback` (OAuth 2.0 3LO)
- **Linear:** `GET /api/link/linear/connect` → `/api/link/linear/callback`

Features:
- CSRF protection via random state parameter
- Auto-cleanup of expired pending states (10min TTL)
- Platform config from environment variables (`FARMTABLE_*_CLIENT_ID/SECRET`)
- Stores tokens with refresh_token, token_expiry, scopes_granted

### 4. Background Token Refresh (`internal/serverapp/tokenrefresh.go`)

- `TokenRefresher` goroutine scanning active OAuth LinkedAccounts every 30min
- Proactively refreshes tokens within 15min of expiry
- Uses `golang.org/x/oauth2` TokenSource for standard refresh flow
- On refresh failure: marks account status as `expired`
- Supports GitHub, Jira, Linear; skips PAT-based accounts

### 5. Credential Monitoring (`internal/serverapp/credmonitor.go`)

- `CredentialMonitor` goroutine checking credential validity every 1hr
- Per-platform lightweight API calls:
  - GitHub: `GET /user`
  - Jira: `GET /oauth/token/accessible-resources`
  - Linear: `POST /graphql` (auth header check)
- Invalid credentials → account status set to `expired`, `last_validated_at` updated
- Valid credentials → `last_validated_at` updated
- Pluggable validators via `SetValidator()` for testing

### 6. Tests

- `crypto_test.go` — 10 test cases covering encryption round-trip, key rotation,
  plaintext migration, invalid keys, nonce uniqueness
- `linkflows_test.go` — 10 test cases covering route registration, not-configured
  responses, missing params, state validation, URL generation
- `tokenrefresh_test.go` — 3 test cases covering construction, platform config
  resolution, constant values
- `credmonitor_test.go` — 5 test cases covering construction, validator set/get,
  failure handling, default validators

## Files Changed

| File | Change |
|------|--------|
| `internal/store/schema/linkedaccount.go` | Added 4 new fields |
| `internal/store/ent/` (generated) | Regenerated |
| `internal/store/store.go` | New params, interface method |
| `internal/store/entstore.go` | New fields in Create, new UpdateLinkedAccount |
| `internal/store/multistore.go` | UpdateLinkedAccount delegation |
| `internal/store/crypto.go` | **New** — AES-256-GCM encryption |
| `internal/store/crypto_test.go` | **New** — encryption tests |
| `internal/platform/github/passthrough.go` | UpdateLinkedAccount stub |
| `internal/serverapp/linkflows.go` | **New** — OAuth flows |
| `internal/serverapp/linkflows_test.go` | **New** — OAuth flow tests |
| `internal/serverapp/tokenrefresh.go` | **New** — background refresh |
| `internal/serverapp/tokenrefresh_test.go` | **New** — refresh tests |
| `internal/serverapp/credmonitor.go` | **New** — credential monitoring |
| `internal/serverapp/credmonitor_test.go` | **New** — monitoring tests |

## Test Results

All tests pass: `go test ./...` (existing + new)
Build clean: `go build ./...`
