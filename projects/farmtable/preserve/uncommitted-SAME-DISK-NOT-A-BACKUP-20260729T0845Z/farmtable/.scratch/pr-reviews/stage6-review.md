# Stage 6 Code Review: Credential Improvements

**Branch:** `auth/stage6-credential-improvements`  
**Reviewer:** code-review-agent  
**Date:** 2026-07-23  
**Build:** `go build ./...` — PASS  
**Tests:** `go test ./internal/store/ ./internal/serverapp/ -count=1` — PASS  

## Verdict: REQUEST CHANGES

There are several security and correctness issues that need to be addressed before this can be merged.

---

## Critical Issues

### 1. `pendingStates` map is not thread-safe (linkflows.go)

**Severity: HIGH — data race / crash in production**

`LinkFlowManager.pendingStates` is a plain `map[string]linkState` that is read/written from HTTP handlers. HTTP handlers run concurrently via `net/http`. Concurrent map access without synchronization causes a Go runtime panic (`fatal error: concurrent map writes`).

```go
// linkflows.go:36
pendingStates map[string]linkState  // No mutex protecting this
```

All reads (`lm.pendingStates[state]`), writes (`lm.pendingStates[state] = ...`), and deletes (`delete(lm.pendingStates, state)`) across `handleGitHubInstall`, `handleGitHubCallback`, `handleJiraConnect`, `handleJiraCallback`, `handleLinearConnect`, `handleLinearCallback`, and `CleanExpiredStates` are unprotected.

**Fix:** Add a `sync.Mutex` (or `sync.RWMutex`) to `LinkFlowManager` and lock around all `pendingStates` access.

### 2. Encryption not integrated into store read/write path

**Severity: HIGH — encryption is defined but never applied**

`CredentialEncryptor` is fully implemented and tested in isolation, but it is never wired into the store layer. `CreateLinkedAccount` and `UpdateLinkedAccount` in `entstore.go` store `AuthToken` and `RefreshToken` in plaintext. No code calls `Encrypt()` before writing or `Decrypt()` after reading.

This means:
- Tokens are stored in plaintext despite the encryption infrastructure existing
- When encryption IS later wired in, `tokenrefresh.go` and `credmonitor.go` will break because they read `acct.AuthToken` / `acct.RefreshToken` directly and pass them to external APIs — encrypted ciphertext would be sent to GitHub/Jira/Linear

**Fix:** Either:
- (a) Integrate encryption into `EntStore.CreateLinkedAccount` / `UpdateLinkedAccount` / `GetLinkedAccount` so it's transparent, OR
- (b) Add encryption hooks at the `LinkFlowManager` / `TokenRefresher` layer and document the contract

### 3. `CredentialMonitor.CheckAccountNow` is a no-op stub (credmonitor.go:150)

**Severity: MEDIUM — misleading public API**

```go
func (cm *CredentialMonitor) CheckAccountNow(ctx context.Context, accountID string) error {
    return nil  // Always succeeds, never validates anything
}
```

This method is a public API that callers will trust to actually validate credentials. Returning `nil` unconditionally is dangerous — callers will conclude the credential is valid. At minimum, this should return an error indicating "not implemented" or be removed until it's actually implemented.

---

## Security Findings

### 4. OAuth state tokens have no expiry enforcement on lookup (linkflows.go)

**Severity: MEDIUM**

`CleanExpiredStates()` exists (10-minute cutoff) but is never called automatically. There's no ticker, no integration into `Start()`-style lifecycle, and nothing prevents an arbitrarily old state from being consumed. An attacker who captures a state parameter could use it hours or days later.

**Fix:** Either:
- (a) Check `ls.CreatedAt` on callback and reject states older than 10 minutes, OR  
- (b) Start a background goroutine that periodically calls `CleanExpiredStates()`

### 5. Token refresh failure immediately marks account as "expired" (tokenrefresh.go:114)

**Severity: MEDIUM — reliability concern**

A single transient failure (network blip, provider 500) permanently marks the account as expired. There's no retry logic or exponential backoff. The user's linked account becomes unusable after one failed refresh attempt.

```go
if err := tr.refreshAccount(ctx, acct); err != nil {
    expired := "expired"
    // Immediately marks expired — no retry
    if _, updateErr := tr.store.UpdateLinkedAccount(ctx, acct.ID, store.UpdateLinkedAccountParams{
        Status: &expired,
    }); updateErr != nil { ... }
}
```

**Fix:** Track a failure count (or `last_refresh_error_at`) and only mark as expired after N consecutive failures or if the error is specifically an auth error (401/403) vs. a transient error.

### 6. Linear token validator sends POST with empty body (credmonitor.go:211-218)

**Severity: LOW**

```go
req.Method = "POST"
// No body set — sends Content-Length: 0 POST to GraphQL endpoint
```

This overwrites the method AFTER `http.NewRequestWithContext` was called with `"GET"`. It works for 401/403 detection but is fragile — a valid token may receive a 400 for malformed request, which currently passes validation. Consider sending a minimal GraphQL query body like `{"query":"{ viewer { id } }"}`.

---

## Design & Quality Observations

### 7. OAuth handler duplication

The three platform handlers (GitHub, Jira, Linear) follow an identical pattern: validate config → parse collection_id → generate state → store state → redirect (install handlers) and validate config → check state → validate platform → check code → exchange → create account (callback handlers). This is ~200 lines of near-identical code.

**Suggestion (non-blocking):** Extract a generic `handleInstall(platform, config)` and `handleCallback(platform, config)` to eliminate duplication. The only per-platform variation is Jira's `audience`/`prompt` params and GitHub's route naming.

### 8. `context.Background()` in HTTP handlers (linkflows.go)

The OAuth token exchange calls use `context.Background()` instead of `r.Context()`:

```go
token, err := lm.oauthConfigs.GitHub.Exchange(context.Background(), code)
```

This means the exchange is not cancelled if the client disconnects. Use `r.Context()` instead for proper request lifecycle management.

### 9. No HTTP method enforcement on OAuth endpoints

None of the handlers check `r.Method`. The install/connect endpoints should accept only GET, and callbacks should also be GET-only. Currently, any HTTP method (POST, PUT, DELETE) will be processed.

### 10. Missing `writeJSON` helper for error responses in linkflows.go

Some responses use `http.Error()` (plaintext) while the success path uses `writeJSON()`. Consider using `writeJSONError()` consistently for machine-parseable error responses.

---

## Test Coverage Assessment

### Strengths
- `crypto_test.go` (300 lines): Excellent coverage — round-trip, double-encrypt idempotency, wrong key, key rotation, plaintext migration, unique nonces, invalid keys, empty values. Very thorough.
- `linkflows_test.go` (229 lines): Good coverage of error paths — not-configured, missing collection_id, invalid state, missing code, expired state cleanup, URL formatting.

### Gaps
- **No integration tests** for `tokenrefresh.go` `refreshAll()` / `refreshAccount()` with a mock store. Only unit tests for constructor and config-for-platform.
- **No integration tests** for `credmonitor.go` `checkAll()` / `checkAccount()` with a mock store. Only unit tests for constructor and validator registration.
- **No test** that the encryption round-trips through `EntStore.CreateLinkedAccount` → `GetLinkedAccount` (because encryption isn't integrated).
- **No concurrency test** for `pendingStates` access (would likely expose the data race).
- **No test** for `CheckAccountNow` (which is a stub anyway).
- `linkflows_test.go` does not test the happy path through `handleGitHubCallback` with a mock token exchange.

---

## Store / Schema Review

The Ent schema changes (`linkedaccount.go`) and generated code are correct:
- `refresh_token` is marked `.Sensitive()` — correctly excluded from JSON serialization and `String()` output
- `token_expiry` and `last_validated_at` are `.Optional().Nillable()` — appropriate for fields that may not be present
- `scopes_granted` is `JSON([]string{}).Optional()` — correct type
- `UpdateLinkedAccount` in `entstore.go` properly handles all optional fields with nil checks
- `MultiStore` and `GitHubPassThroughStore` both implement the new `UpdateLinkedAccount` interface method

---

## Summary

| # | Issue | Severity | Type |
|---|-------|----------|------|
| 1 | `pendingStates` not thread-safe | HIGH | Bug |
| 2 | Encryption not integrated into store layer | HIGH | Design gap |
| 3 | `CheckAccountNow` is a no-op stub | MEDIUM | Misleading API |
| 4 | No state token expiry enforcement on lookup | MEDIUM | Security |
| 5 | Single-failure marks account expired | MEDIUM | Reliability |
| 6 | Linear validator sends POST with no body | LOW | Fragile |
| 7 | Handler duplication (non-blocking) | LOW | Code quality |
| 8 | `context.Background()` instead of `r.Context()` | LOW | Best practice |
| 9 | No HTTP method enforcement | LOW | Security hardening |

**Required for merge:** Fix issues #1 (thread safety) and #2 (encryption integration). Issue #3 should be addressed (either implement or remove the stub). Issues #4 and #5 are strongly recommended.
