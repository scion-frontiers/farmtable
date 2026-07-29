# Independent Review: Stage 5/6 Auth Wiring (commit 8665535)

**Reviewer:** Independent review agent  
**Date:** 2026-07-23  
**Scope:** Commit `7bf0ae5` (feat: wire stage 5/6 auth components into server startup), plus supporting commits `36235c3` (duplicate-symbol fix), `8665535` (project log)  
**Files reviewed:** `cmd/farmtable-server/main.go`, `internal/serverapp/unified.go`, `internal/serverapp/session.go`, `internal/cli/dashboard.go`, plus full source of `tokenrefresh.go`, `credmonitor.go`, `authmode.go`, `crypto.go`, `iapauth.go`, `oauth.go`, `linkflows.go`, `provisioning.go`, `auth.go`

---

## Verdict: APPROVE WITH FOLLOW-UPS

The change is **safe to run in production with the default `token` auth mode**. No blocking issues were found. The default path is inert with respect to all new code. Follow-up items are non-blocking and affect only opt-in modes that are not currently active.

---

## Review Findings

### 2a. Default-Path Safety: CONFIRMED SAFE

Traced the full default path with no auth-related env vars set (only `FARMTABLE_DB_URL` and `FARMTABLE_TOKEN` required):

1. **`AuthModeFromEnv()`** (`authmode.go:59`): reads `FARMTABLE_AUTH_MODE`. When unset, `ParseAuthMode("")` returns `AuthModeToken, nil`. `AuthModeToken` is `iota` = 0, the zero value. ✓

2. **`UnifiedHandler` switch** (`unified.go:72-93`): The switch has cases for `AuthModeOAuth` and `AuthModeProxy` only. `AuthModeToken` (zero value) matches neither case — no OAuth manager, no IAP middleware, no provisioner is created. ✓

3. **LinkFlowManager routes** (`unified.go:96-99`): Registered unconditionally when `Store != nil && BaseURL != ""`. In `main.go`, `Store` is always the MultiStore and `BaseURL` defaults to `http://localhost:<port>`. So link flow routes ARE registered in token mode. However, all handlers check `lm.oauthConfigs.<Platform> == nil` and return 503 when the platform client ID env vars are unset (`linkflows.go:130-131`, etc.). **Inert in default config.** ✓

4. **gRPC interceptors**: `TokenAuthInterceptor` and `TokenAuthStreamInterceptor` continue to receive the same `lookup` value as before. No change to the gRPC auth path. ✓

5. **Session management**: `SessionManager` creation still gated on `o.TokenLookup != nil`, exactly as before. ✓

**Conclusion:** With default env vars, the server startup path is functionally identical to the pre-wiring code. No new routes are reachable, no new middleware is active, no new goroutines interact with external services.

### 2b. Background Goroutine Safety: CONFIRMED SAFE (with notes)

**TokenRefresher** (`tokenrefresh.go`):
- Created with `PlatformRefreshConfigs{}` — all OAuth configs are nil (`main.go:103`).
- `Start()` launches `run()`, which immediately calls `refreshAll()`.
- `refreshAll()` calls `store.ListLinkedAccounts(ctx, {Status: "active"})`. If no active OAuth accounts exist (likely in a fresh deployment), returns empty list and does nothing.
- If accounts DO exist, `refreshAccount()` calls `configForPlatform()` → returns nil for every platform → returns error `"no OAuth config for platform X"` → logged, account left unchanged. **No panic, no nil deref.** ✓
- Ticker fires every 30 minutes (`defaultRefreshInterval`). Not a busy-loop. ✓
- No locks held, no DB connections held beyond individual queries. ✓

**CredentialMonitor** (`credmonitor.go`):
- `Start()` launches `run()`, which immediately calls `checkAll()`.
- `checkAll()` lists active accounts. If accounts exist, `checkAccount()` calls the platform validator (GitHub/Jira/Linear).
- **Note:** Validators make outbound HTTP calls to real platform APIs (`api.github.com/user`, `api.atlassian.com`, `api.linear.app`). If active linked accounts exist in the DB, these HTTP calls fire immediately on startup and then every 1 hour. This is by design but worth noting — it's not a "no-op" if accounts exist.
- All validators use `http.DefaultClient` with no explicit timeout. Context propagation from the `ctx` parameter provides cancellation but not a per-request timeout. **Minor concern — not blocking, but a timeout would be good hygiene.**
- No nil deref risk: validators check for errors and return gracefully. ✓
- Ticker fires every 1 hour. Not a busy-loop. ✓

**CredentialEncryptor** nil-safety (`entstore.go`):
- Every use of `s.credentialEncryptor` in `EntStore` is guarded by `if s.credentialEncryptor != nil`. ✓
- `decryptLinkedAccount()` returns nil immediately when encryptor is nil (`entstore.go:1933`). ✓
- No nil deref risk anywhere in the encryption path. ✓

### 2c. Graceful Shutdown: CONFIRMED SAFE (with minor note)

**Shutdown sequence** (`main.go:110-131`):
1. Signal received on `sigCh`
2. `refresher.Stop()` → calls `cancel()` on the child context → `run()` exits via `<-ctx.Done()` → ticker cleaned up by `defer ticker.Stop()`
3. `monitor.Stop()` → same pattern
4. HTTP server `Shutdown()` with 10s timeout
5. gRPC `GracefulStop()` with 5s fallback to `Stop()`
6. Parent context `cancel()` called

**Minor note — data race on `cancel` field:**
`main.go` calls `go refresher.Start(ctx)` which sets `tr.cancel` in a goroutine (`tokenrefresh.go:54`), while the signal handler reads `tr.cancel` via `refresher.Stop()` in a different goroutine. There is no synchronization between these writes and reads. The Go race detector would flag this. Practically harmless because:
- The signal can't arrive before the goroutine scheduler has had time to run `Start()`
- The parent context `cancel()` at line 131 provides a backup cancellation path
- Same issue exists for `CredentialMonitor`

**Also:** `main.go:103-106` calls `go refresher.Start(ctx)` and `go monitor.Start(ctx)`, but `Start()` internally does `go tr.run(ctx)`. This creates a double goroutine (outer goroutine exits immediately after launching inner goroutine). Functionally correct but unnecessary — could just call `refresher.Start(ctx)` directly (without `go`). Not a bug.

### 2d. Secrets Handling (FARMTABLE_ENCRYPTION_KEY): SAFE, with a follow-up

**When unset** (`main.go:44-47`, `crypto.go:48-53`):
- `NewCredentialEncryptorFromEnv()` returns `(nil, ErrEncryptionKeyNotSet)`
- The `if err == nil && encryptor != nil` check fails → encryptor not set
- Credentials stored/read in plaintext. No panic, no log noise. ✓

**When set with valid key:**
- AES-256-GCM encryption enabled. `Encrypt()` checks `IsEncrypted()` to avoid double-encryption. `Decrypt()` handles plaintext (unencrypted) values by returning them as-is for backward compatibility. ✓

**Follow-up — silent fallback on malformed key:**
When `FARMTABLE_ENCRYPTION_KEY` is set but malformed (not valid base64 or not 32 bytes), `NewCredentialEncryptor()` returns an error, and `main.go` silently falls back to no encryption. An operator who sets this var expects encryption to be active. A `log.Printf("WARNING: FARMTABLE_ENCRYPTION_KEY is set but invalid: %v — credentials will NOT be encrypted", err)` would prevent a silent insecurity window.

### 2e. Other Findings

#### Finding 1: `handleGetSession` rejects OAuth/IAP sessions (known limitation, severity confirmation)

The EM disclosed that OAuth/IAP sessions don't set `sessKeyToken`, preventing the session-to-gRPC bridge. The actual impact is slightly broader than described:

- `handleGetSession()` (`session.go:191-194`) checks `sessKeyToken` and returns 401 if empty
- This means `GET /api/auth/session` reports OAuth/IAP users as "not authenticated" even though they have a valid session with user info
- The web dashboard's auth state detection would be broken in OAuth/IAP modes
- `SessionToBearerMiddleware` also won't inject headers, so gRPC-web requests from OAuth/IAP sessions fail at the `TokenAuthInterceptor`

**Severity assessment:** The EM's characterization of "non-blocking, opt-in modes only" is **accurate**. These modes are not active in the default token mode, and enabling them requires explicit env var configuration. However, when someone DOES enable OAuth/IAP mode, the web dashboard will be non-functional until this is addressed. This should be a priority follow-up before either mode is documented or recommended.

#### Finding 2: `CleanExpiredStates` for `LinkFlowManager` never called

`LinkFlowManager.CleanExpiredStates()` (`linkflows.go:465-474`) removes expired OAuth state tokens from the in-memory map. However, this method is never called anywhere — no periodic cleanup, no call during request handling (unlike `GoogleOAuthManager.handleLogin` which calls `CleanExpiredOAuthStates()` before creating new states).

In the default token-mode deployment, the link flow handlers return 503 before adding states, so no accumulation occurs. But if platform OAuth is configured (`FARMTABLE_GITHUB_CLIENT_ID` etc.), abandoned flows would accumulate without cleanup. **Low severity** — the states are small and the attack surface is limited since each endpoint checks for config before processing.

#### Finding 3: No auth-mode validation for missing prerequisites

When `AuthMode` is set to `oauth` but `FARMTABLE_GOOGLE_CLIENT_ID` is not set:
- `GoogleOAuthConfigFromEnv()` returns nil (`oauth.go:59-60`)
- `NewGoogleOAuthManager(nil, ...)` creates a manager with `oauthConfig == nil`
- Route handlers return 503 — safe, but no startup warning

When `AuthMode` is set to `proxy` but `FARMTABLE_IAP_AUDIENCE` is not set:
- `IAPAuthenticator{Audience: ""}` is created
- `validateClaims()` checks `claims.Audience.Contains("")` — this would match ANY JWT audience claim, effectively disabling audience binding
- **This is a potential security concern** if proxy mode were actually activated without an audience: any valid IAP JWT from any project would be accepted

**Practical risk: LOW** — proxy mode requires explicit opt-in via `FARMTABLE_AUTH_MODE=proxy`, and in the current deployment, this env var is not set. But a startup validation (`if authMode == AuthModeProxy && os.Getenv("FARMTABLE_IAP_AUDIENCE") == "" { log.Fatal(...) }`) would prevent a future misconfiguration.

---

## Follow-Up Items (non-blocking)

1. **Log warning on malformed `FARMTABLE_ENCRYPTION_KEY`** — prevent silent fallback to plaintext storage when the operator intends encryption. (`main.go:44-47`)

2. **Address `sessKeyToken` gap for OAuth/IAP sessions** — either modify `handleGetSession` to accept sessions with `sessKeyUserID` (without requiring `sessKeyToken`), or have OAuth/IAP flows generate a scoped token for the session bridge. Required before either mode is production-ready.

3. **Add startup validation for proxy mode prerequisites** — `log.Fatal` if `AuthModeProxy` is set without `FARMTABLE_IAP_AUDIENCE`, to prevent audience-binding bypass. (`main.go`, after `AuthModeFromEnv()` call)

4. **Add periodic cleanup for `LinkFlowManager.pendingStates`** — either call `CleanExpiredStates()` from a timer or integrate cleanup into the request handlers (as `GoogleOAuthManager` does).

5. **Add HTTP request timeout to credential monitor validators** — validators in `credmonitor.go` use `http.DefaultClient` with no per-request timeout. Add a timeout (e.g., 10s) to prevent slow platform APIs from blocking the monitor indefinitely.

6. **Remove unnecessary `go` wrapper on `Start()` calls** — `main.go:103,106` can call `refresher.Start(ctx)` and `monitor.Start(ctx)` directly since `Start()` already spawns its own goroutine. This eliminates the theoretical data race on the `cancel` field and the unnecessary double-goroutine.

---

## Summary

The wiring commit is clean and well-structured. The default `token` auth mode path is completely inert with respect to all new functionality. Background goroutines are safe — they query the DB for active accounts and do nothing when none exist, and they respect shutdown signals via context cancellation. Encryption handling is nil-safe throughout. The most notable finding (IAP audience binding with empty audience string) is theoretical since proxy mode is not activated, but warrants a startup guard before that mode goes live. All follow-ups are non-blocking for the current production deployment.
