# Auth Stage 5: OAuth/IAP Proxy Authentication

**Date:** 2026-07-23
**Branch:** `auth/stage5-oauth-iap-proxy`
**Status:** Complete

## Summary

Added three authentication modes selectable via `FARMTABLE_AUTH_MODE`:

| Mode    | Env Value | How it works |
|---------|-----------|--------------|
| Token   | `token`   | Existing API token auth (default, unchanged) |
| OAuth   | `oauth`   | Google OAuth 2.0 login → session cookie |
| Proxy   | `proxy`   | IAP JWT assertion → auto-provisioned user |

## Files Created

### `internal/serverapp/authmode.go`
- `AuthMode` type with `Token`, `OAuth`, `Proxy` constants
- `ParseAuthMode(s)` — case-insensitive parsing with validation
- `AuthModeFromEnv()` — reads `FARMTABLE_AUTH_MODE` env var

### `internal/serverapp/provisioning.go`
- `UserProvisioner` — find-or-create users by email
- Domain allowlist via `FARMTABLE_ALLOWED_DOMAINS` (comma-separated)
- Prefers active users when multiple exist for an email
- Lowercases emails for consistent lookup
- Derives display name from email prefix when not provided

### `internal/serverapp/oauth.go`
- `GoogleOAuthManager` — handles Google OAuth 2.0 login flows
- `GET /api/auth/oauth/google/login` — redirects to Google with CSRF state
- `GET /api/auth/oauth/google/callback` — exchanges code, fetches userinfo, provisions user, creates session
- Configured via `FARMTABLE_GOOGLE_CLIENT_ID` / `FARMTABLE_GOOGLE_CLIENT_SECRET`
- Optional `redirect_uri` query param for post-login redirect
- CSRF state with 10-minute expiry cleanup
- Shares session cookie with existing `SessionManager`

### `internal/serverapp/iapauth.go`
- `IAPAuthenticator` — verifies `X-Goog-IAP-JWT-Assertion` JWTs
- ES256 signature verification via JWKS endpoint
- `iapJWKSCache` — lazy-fetch, proactive refresh, on-miss refresh
- 30-second clock skew tolerance
- Strips `accounts.google.com:` IdP prefix from `sub`/`email` claims
- Returns `(nil, nil)` when no assertion header present (fall-through)
- Configurable audience (mandatory), issuer, JWKS URL, HTTP client
- `NowFunc` injection for deterministic testing

## Test Coverage

All files have comprehensive tests:

- **authmode_test.go** — parsing, string roundtrip, case-insensitivity
- **provisioning_test.go** — find existing, create new, derive display name, case-insensitive email, prefer active user, domain allowlist (allowed/blocked/empty), empty email, domain parsing
- **oauth_test.go** — login redirect, not-configured 503, invalid state, OAuth error, missing code, route registration, state cleanup, env config
- **iapauth_test.go** — valid token (full ES256 verify), no header, expired, wrong audience, wrong issuer, missing sub/email/exp, future iat, invalid JWT, unknown kid, wrong signing key, custom issuer, clock skew tolerance, email lowercasing, IdP prefix stripping, JWKS server down

## Dependencies Added

- `github.com/go-jose/go-jose/v4` — already a transitive dependency, now used directly for IAP JWT verification

## Architecture Decisions

1. **Separate from LinkFlowManager**: Google OAuth login is user-facing auth (creates sessions), not platform linking (creates LinkedAccounts). Keeping them separate avoids coupling.

2. **IAP returns `(nil, nil)` on missing header**: This enables fall-through to other auth methods. The server can chain proxy auth → token auth.

3. **UserProvisioner is auth-mode agnostic**: Both OAuth and IAP proxy use the same provisioner. Any future auth modes (SAML, OIDC) can reuse it.

4. **Domain allowlist on provisioner**: Applied regardless of auth mode, providing a consistent security boundary.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `FARMTABLE_AUTH_MODE` | `token` (default), `oauth`, or `proxy` |
| `FARMTABLE_GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `FARMTABLE_GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `FARMTABLE_IAP_AUDIENCE` | Expected IAP JWT audience |
| `FARMTABLE_ALLOWED_DOMAINS` | Comma-separated domain allowlist |

## Integration Notes

The new components are created but not yet wired into `cmd/farmtable-server/main.go` or `unified.go`. Integration wiring (reading `FARMTABLE_AUTH_MODE`, constructing the appropriate managers, and registering routes) is deferred to the wiring phase. The components are designed to be composed:

```go
// Example wiring (not yet implemented):
mode, _ := serverapp.AuthModeFromEnv()
switch mode {
case serverapp.AuthModeOAuth:
    prov := serverapp.NewUserProvisioner(store, os.Getenv("FARMTABLE_ALLOWED_DOMAINS"))
    oauthMgr := serverapp.NewGoogleOAuthManager(config, sessionStore, prov)
    oauthMgr.RegisterRoutes(mux)
case serverapp.AuthModeProxy:
    iap := &serverapp.IAPAuthenticator{Audience: os.Getenv("FARMTABLE_IAP_AUDIENCE")}
    // Use iap.Authenticate(r) in middleware
}
```
