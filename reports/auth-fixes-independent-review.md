# Independent Review: Stage 5/6 Auth Fix Follow-ups (commit 5c05b0d)

**Reviewer:** Independent review agent  
**Date:** 2026-07-23  
**Scope:** Commit `5c05b0d` (fix(auth): address post-hoc review findings for stage 5/6 wiring)  
**Files reviewed:** `cmd/farmtable-server/main.go`, `internal/serverapp/unified.go`, `internal/serverapp/oauth.go`, `internal/serverapp/provisioning.go`  
**Original findings reference:** `/scion-volumes/scratchpad/projects/farmtable/reports/auth-wiring-independent-review.md`

---

## Verdict: APPROVE WITH FOLLOW-UPS

Fixes 1 and 3 are correct and complete. Fix 2 (session-to-gRPC bridge) was included despite being tracked as a separate follow-up task, but the implementation is sound for OAuth mode. A token-accumulation concern exists in the IAP middleware path that should be addressed before proxy mode goes live. No changes affect the default `AuthMode=token` path.

---

## Fix-by-Fix Analysis

### Fix 1: Empty IAP Audience Startup Validation — CORRECT

**Original finding:** `IAPAuthenticator{Audience: ""}` matches ANY JWT audience claim via `claims.Audience.Contains("")` (iapauth.go:136), effectively disabling audience binding in proxy mode when `FARMTABLE_IAP_AUDIENCE` is unset.

**What was done (main.go:82-88):**
```go
if authMode == serverapp.AuthModeProxy && os.Getenv("FARMTABLE_IAP_AUDIENCE") == "" {
    log.Fatal("FARMTABLE_IAP_AUDIENCE is required when FARMTABLE_AUTH_MODE=proxy — " +
        "without it, audience binding is disabled and any valid IAP JWT would be accepted")
}
if authMode == serverapp.AuthModeOAuth && os.Getenv("FARMTABLE_GOOGLE_CLIENT_ID") == "" {
    log.Println("WARNING: FARMTABLE_AUTH_MODE=oauth but FARMTABLE_GOOGLE_CLIENT_ID not set — OAuth login will return 503")
}
```

**Assessment:**
- Uses `log.Fatal` for the security-sensitive proxy case (correct — this is a bypass, not a degradation).
- Uses `log.Println("WARNING:")` for the OAuth case (correct — missing client ID means 503 responses, not a security bypass).
- Validation runs after `AuthModeFromEnv()` and before any server components are created, so no partial-init state on failure.
- Bonus: the OAuth warning was not in the original findings but is a sensible addition.
- No bypass path: the env var is read directly, not via a struct field that could be defaulted elsewhere.

**Verdict: Fully addresses the original finding. No issues.**

### Fix 2: Session-to-gRPC Bridge — INCLUDED (was supposed to be follow-up)

**Original finding:** OAuth/IAP sessions don't set `sessKeyToken`, so `handleGetSession` returns 401 and `SessionToBearerMiddleware` can't inject Bearer headers for gRPC requests. Tracked as follow-up task `a7104d1b-674b-448c-aded-b6e0e9eb3ca7`.

**What was done:**
1. Added `CreateSessionToken()` to `UserProvisioner` (provisioning.go:135-153): creates a 24-hour API token via `store.CreateAPIToken`, scoped with `DefaultScopesForUserType()`.
2. Called in OAuth `handleCallback` (oauth.go:235-239): sets `sessKeyToken` on the session after user provisioning.
3. Called in `iapMiddleware` (unified.go:153-158): same pattern for IAP-provisioned users.
4. Both call sites log and continue on error (graceful degradation — dashboard won't work, but server doesn't crash).

**Assessment — OAuth path:** Sound. `handleCallback` runs once per login flow. One token per login is reasonable. The token expires in 24h, matching session lifetime.

**Assessment — IAP path: TOKEN ACCUMULATION CONCERN.** The `iapMiddleware` runs on **every HTTP request** when `AuthMode=proxy`. The middleware always provisions the user and creates a session — there is no check for "does this session already have a valid token?" Each request:
1. IAP assertion is validated (always present in proxy mode)
2. User is provisioned (find-or-create, so the user lookup is idempotent)
3. Session is retrieved or created
4. `CreateSessionToken` creates a **new** API token row in the DB
5. The old token in `sessKeyToken` is overwritten (orphaned in the DB)

Orphaned tokens expire after 24 hours and are never revoked or cleaned up. For a busy IAP-protected deployment, this could mean hundreds/thousands of token rows per user per day.

**Mitigation options (not implemented):**
- Check if `sess.Values[sessKeyToken]` already contains a valid, non-expired token before creating a new one.
- Or: skip session creation entirely when the session cookie already has a valid `sessKeyToken`.
- Or: add a periodic cleanup for expired `session-auth` tokens.

**Was this appropriate to include?** The brief flagged this as a follow-up that should NOT have been fixed in this narrow commit. The commit message explicitly lists it as fix #2. The implementation is functionally correct for the OAuth path but has the IAP accumulation issue. Given that:
- Neither OAuth nor IAP mode is active in production today
- The fix is contained (38 lines across 3 files, using existing `CreateAPIToken` infrastructure)
- The OAuth path is correct
- The IAP accumulation issue is a performance/hygiene concern, not a security issue

**This is not a blocking problem, but the IAP token-per-request pattern should be fixed before proxy mode is activated.**

### Fix 3: Encryption Key Validation — CORRECT

**Original finding:** When `FARMTABLE_ENCRYPTION_KEY` is set but malformed (invalid base64 or not 32 bytes), `NewCredentialEncryptor()` returns an error, and `main.go` silently falls back to no encryption.

**What was done (main.go:48-53):**
```go
} else if os.Getenv("FARMTABLE_ENCRYPTION_KEY") != "" {
    log.Fatalf("FARMTABLE_ENCRYPTION_KEY is set but invalid: %v — "+
        "refusing to start with plaintext credential storage when encryption was intended", err)
}
```

**Assessment:**
- The `else if` correctly catches the case where the key IS set but `NewCredentialEncryptorFromEnv()` returned an error.
- Trace of failure modes:
  - Key not set → `NewCredentialEncryptorFromEnv()` returns `(nil, ErrEncryptionKeyNotSet)` → first branch fails (`err != nil`) → `else if` checks `os.Getenv` → empty → no fatal. ✅
  - Key set, valid → returns `(encryptor, nil)` → first branch succeeds → encryption enabled. ✅
  - Key set, invalid base64 → returns `(nil, error)` → first branch fails → `else if` → key IS set → `log.Fatalf`. ✅
  - Key set, wrong length → returns `(nil, ErrEncryptionKeySize)` → same path → `log.Fatalf`. ✅
- Uses `log.Fatalf` (stronger than the original suggestion of "warn loudly") — appropriate since the operator explicitly intended encryption.
- The error message includes the underlying error (`%v`, err) so the operator knows whether it's a base64 problem or a key-length problem.

**Verdict: Fully addresses the original finding. All failure modes covered.**

### Default-Path Impact: CONFIRMED NO CHANGE

All three fixes are gated on opt-in conditions that are inactive in the default deployment:

| Fix | Gate | Default state | Impact |
|-----|------|---------------|--------|
| IAP audience validation | `authMode == AuthModeProxy` | `AuthModeToken` (iota=0) | None |
| OAuth client ID warning | `authMode == AuthModeOAuth` | `AuthModeToken` | None |
| Session bridge (OAuth) | Inside `handleCallback` | OAuth routes return 503 | None |
| Session bridge (IAP) | Inside `iapMiddleware` | Middleware not wired | None |
| Encryption key validation | `FARMTABLE_ENCRYPTION_KEY != ""` | Not set | None |

The gRPC interceptors, session management, and all existing token-mode paths are unchanged.

---

## Follow-Up Items

1. **Fix IAP session token accumulation** — Before activating proxy mode, add a check in `iapMiddleware` to skip `CreateSessionToken` when the session already contains a valid, non-expired token. Alternatively, add periodic cleanup of expired `session-auth` tokens from the `api_tokens` table.

2. **Session token revocation on logout** — `handleLogout` clears the session cookie but does not revoke the API token in the DB. The token remains valid for up to 24 hours. Consider calling `RevokeAPIToken` during logout for defense-in-depth.

3. **The session-bridge fix should be covered by the existing follow-up task** (`a7104d1b-674b-448c-aded-b6e0e9eb3ca7`) — verify that task is updated to reflect that the basic bridge is now implemented, with the IAP accumulation issue as remaining work.

---

## Process Note

This commit is the second instance where the EM's blind code-reviewer failed to provision, leading to self-review of its own fix. While the code quality is fine, the pattern means these fixes lack independent review at authoring time — which is exactly why this post-hoc review exists. The fixes are approachable and correct, but the self-review pattern should be addressed to avoid normalizing it.
