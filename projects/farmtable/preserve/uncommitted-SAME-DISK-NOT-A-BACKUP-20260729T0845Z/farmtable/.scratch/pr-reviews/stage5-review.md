# Code Review: Stage 5 — OAuth/SSO & IAP Proxy Auth

**Branch:** `auth/stage5-oauth-iap-proxy`
**Commits:** `2955706` (feat), `85d345b` (docs)
**Reviewer:** code-review agent
**Date:** 2026-07-23

## Build & Test Results

- **`go build ./...`** — PASS (clean build, no errors)
- **`go test ./internal/serverapp/ -count=1`** — PASS (all 50 tests pass in 0.029s)

---

## Verdict: REQUEST CHANGES

Three findings must be addressed before merge: a race condition on the OAuth pending-states map (F1), an open-redirect vulnerability in the login endpoint (F2), and missing PKCE in the OAuth flow (F3). The remaining findings are lower-severity improvements.

---

## Findings

### F1 — HIGH: Race condition on `pendingStates` map (thread safety)

**File:** `internal/serverapp/oauth.go:37, 125, 147, 151, 251`

**Description:** `GoogleOAuthManager.pendingStates` is a plain `map[string]oauthState` accessed concurrently without synchronization. `handleLogin` writes to it (line 125), `handleCallback` reads and deletes from it (lines 147, 151), and `CleanExpiredOAuthStates` iterates and deletes (line 251). Since these handlers run in separate goroutines via `http.ServeMux`, concurrent access causes a data race that can crash the process with `concurrent map writes`.

**Suggested fix:** Add a `sync.Mutex` to `GoogleOAuthManager` and lock around all accesses to `pendingStates`:

```go
type GoogleOAuthManager struct {
    oauthConfig   *oauth2.Config
    sessionStore  sessions.Store
    provisioner   *UserProvisioner

    mu            sync.Mutex
    pendingStates map[string]oauthState
}
```

Lock in `handleLogin`, `handleCallback`, and `CleanExpiredOAuthStates`.

---

### F2 — HIGH: Open redirect via unvalidated `redirect_uri`

**File:** `internal/serverapp/oauth.go:120-124, 219-223`

**Description:** The login handler accepts an arbitrary `redirect_uri` query parameter and stores it verbatim. After successful OAuth callback, the user is redirected to this URL (line 222) with no validation. An attacker can craft a link like:

```
/api/auth/oauth/google/login?redirect_uri=https://evil-phishing-site.com
```

After the user authenticates with Google, they are redirected to the attacker's site. This is a classic open-redirect vulnerability used in phishing attacks.

**Suggested fix:** Validate that `redirect_uri` is a relative path (starts with `/` and does not contain `//` or a scheme):

```go
func isValidRedirect(uri string) bool {
    return uri != "" &&
        strings.HasPrefix(uri, "/") &&
        !strings.HasPrefix(uri, "//") &&
        !strings.Contains(uri, "://")
}
```

Apply in `handleLogin`:
```go
redirect := r.URL.Query().Get("redirect_uri")
if !isValidRedirect(redirect) {
    redirect = "/"
}
```

---

### F3 — MEDIUM: OAuth flow does not use PKCE

**File:** `internal/serverapp/oauth.go:130-134, 167`

**Description:** The OAuth authorization code flow does not implement PKCE (Proof Key for Code Exchange). While this is a server-side (confidential) client with a client secret — meaning it is not strictly vulnerable to authorization code interception — PKCE is now recommended for ALL OAuth 2.0 flows (OAuth 2.1 draft mandates it) and provides defense-in-depth against code injection attacks.

The `golang.org/x/oauth2` package supports PKCE natively via `oauth2.S256ChallengeOption`.

**Suggested fix:**

Add `CodeVerifier` field to `oauthState`:
```go
type oauthState struct {
    CreatedAt    time.Time
    Redirect     string
    CodeVerifier string
}
```

In `handleLogin`:
```go
verifier := oauth2.GenerateVerifier()
m.pendingStates[state] = oauthState{
    CreatedAt:    time.Now(),
    Redirect:     redirect,
    CodeVerifier: verifier,
}

url := m.oauthConfig.AuthCodeURL(state,
    oauth2.AccessTypeOffline,
    oauth2.SetAuthURLParam("prompt", "select_account"),
    oauth2.S256ChallengeOption(verifier),
)
```

In `handleCallback`:
```go
token, err := m.oauthConfig.Exchange(r.Context(), code,
    oauth2.VerifierOption(os.CodeVerifier),
)
```

---

### F4 — MEDIUM: OAuth state cleanup never triggered automatically

**File:** `internal/serverapp/oauth.go:248-256`

**Description:** `CleanExpiredOAuthStates()` is defined but never called. States consumed via successful callback are deleted, but abandoned login flows (user starts login but never completes callback) accumulate indefinitely. Under sustained attack, an adversary flooding `/api/auth/oauth/google/login` can grow the map without bound, causing memory exhaustion (DoS).

**Suggested fix:** Either:
- Start a background goroutine/ticker that periodically calls `CleanExpiredOAuthStates()`, or
- Add a max-size check in `handleLogin` that rejects new logins when pending states exceed a threshold (e.g., 10,000), or
- Run cleanup inline at the start of `handleLogin` (simplest, no goroutine needed):

```go
func (m *GoogleOAuthManager) handleLogin(w http.ResponseWriter, r *http.Request) {
    m.CleanExpiredOAuthStates() // clean before adding
    // ... rest of handler
}
```

---

### F5 — LOW: `context.Background()` used instead of request context

**File:** `internal/serverapp/oauth.go:167, 228`

**Description:** Both `m.oauthConfig.Exchange(context.Background(), code)` and `m.oauthConfig.Client(context.Background(), token)` use `context.Background()` instead of `r.Context()`. If the client disconnects mid-OAuth-exchange, the server-side HTTP calls to Google continue to completion rather than being cancelled. Not a security issue but a correctness/resource-efficiency concern.

**Suggested fix:**
```go
token, err := m.oauthConfig.Exchange(r.Context(), code)
// ...
client := m.oauthConfig.Client(r.Context(), token)
```

---

### F6 — LOW: `log.Printf` used instead of structured logging

**File:** `internal/serverapp/iapauth.go:291-293`, `internal/serverapp/oauth.go:155,169,179,194`, `internal/serverapp/provisioning.go:97`

**Description:** The new code uses `log.Printf` for logging while the reference implementation (`proxyauth.go`) uses `slog.Warn`/`slog.Debug`. Structured logging is preferable for observability in production. Non-blocking.

---

### F7 — LOW: Variable shadowing — `os` used as variable name

**File:** `internal/serverapp/oauth.go:146`

**Description:** The line `os, ok := m.pendingStates[state]` uses `os` as a variable name, which shadows the `os` package import at the top of the file. While the `os` package isn't used later in `handleCallback`, this harms readability and can confuse future readers.

**Suggested fix:** Rename to `pending`, `stateInfo`, or `oauthSt`:
```go
pending, ok := m.pendingStates[state]
```

---

## Security Checklist

| Check | Result |
|-------|--------|
| IAP JWT issuer validation | PASS |
| IAP JWT audience binding | PASS |
| IAP JWT expiry + clock skew | PASS |
| IAP JWT algorithm restriction (ES256 only) | PASS |
| IAP JWT kid lookup from JWKS | PASS |
| IAP JWT signature verification | PASS |
| IAP email/sub presence required | PASS |
| JWKS cache thread safety | PASS |
| JWKS body size limit (1MB) | PASS |
| JWKS debounce / stampede protection | PASS |
| OAuth CSRF state parameter | PASS |
| OAuth PKCE | **FAIL** — not implemented (F3) |
| OAuth redirect validation | **FAIL** — open redirect (F2) |
| OAuth state map thread safety | **FAIL** — data race (F1) |
| Domain allowlist enforcement | PASS |
| Domain allowlist bypass resistance | PASS — lowercased comparison |
| User self-escalation prevention | PASS — type/status hardcoded to "human"/"active" |
| Email normalization (lowercase) | PASS |
| Email verified check (OAuth) | PASS |
| Response body size limits | PASS (1MB on JWKS/userinfo, 512B on error bodies) |

## Architecture Assessment

The code is well-structured with clean separation of concerns:

- **`authmode.go`** — Minimal, correct enum pattern with case-insensitive parsing and roundtrip consistency.
- **`iapauth.go`** — Closely follows the reference pattern from `proxyauth.go`. JWT validation logic is substantively identical. The addition of `NowFunc` for testing clock-dependent behavior is a nice improvement over the reference.
- **`oauth.go`** — Clean handler structure with proper error responses. Core flow is sound; the issues are in missing hardening (PKCE, redirect validation, thread safety).
- **`provisioning.go`** — Good find-or-create semantics with domain gating. Prefers active users when duplicates exist.

**Note:** The auth mode enum and new implementation files are not yet wired into the server startup (`unified.go`). This is expected for a staged implementation and means the code compiles and is tested in isolation but is not exercised in production. Wiring should happen in a subsequent integration stage.

## Test Coverage Assessment

| Component | Coverage | Notes |
|-----------|----------|-------|
| AuthMode parse/string/roundtrip | Excellent | All modes, edge cases, case insensitivity, whitespace |
| IAP JWT validation | Excellent | 18 tests: valid, expired, wrong aud/iss, missing sub/email, future iat, missing exp, invalid JWT, unknown kid, wrong sig key, custom issuer, clock skew, email lowercasing, JWKS down |
| IAP prefix stripping | Excellent | With/without prefix, empty string |
| OAuth login flow | Good | Redirect, not-configured, default redirect |
| OAuth callback | Good | Invalid state, OAuth error, missing code, not configured |
| OAuth state cleanup | Adequate | Expiry logic tested; no test for race conditions |
| User provisioning | Excellent | Find existing, create new, derive name, case-insensitive, active preference, domain allowlist allow/block/empty, empty email, domain parsing |

**Missing test:** No test for concurrent `pendingStates` access (F1 would be caught by `go test -race`).

---

## Summary

| # | Severity | Finding | Action |
|---|----------|---------|--------|
| F1 | HIGH | Race condition on `pendingStates` map | Must fix |
| F2 | HIGH | Open redirect via `redirect_uri` | Must fix |
| F3 | MEDIUM | No PKCE in OAuth flow | Should fix |
| F4 | MEDIUM | State cleanup never called (DoS risk) | Should fix |
| F5 | LOW | `context.Background()` instead of `r.Context()` | Nice to fix |
| F6 | LOW | `log.Printf` vs structured `slog` | Non-blocking |
| F7 | LOW | Variable name `os` shadows import | Non-blocking |

The IAP authenticator and provisioning components are solid — security-critical JWT validation follows the reference implementation correctly and has excellent test coverage. The OAuth flow is structurally sound but needs hardening in three areas (thread safety, redirect validation, PKCE) before it's production-ready.
