# Stage 6 Review Fixes

**Date:** 2026-07-23
**Branch:** `auth/stage6-credential-improvements`
**Commit:** `fix(auth): address stage 6 review findings — thread safety, encryption integration, state expiry`

## Summary

Applied 7 code review findings from the stage 6 credential improvements review.

## Fixes Applied

### FIX 1 (HIGH): Thread-safe pendingStates map
- **File:** `internal/serverapp/linkflows.go`
- Added `sync.Mutex` to `LinkFlowManager` struct
- All reads, writes, and deletes of `pendingStates` are now protected by `mu.Lock()`/`mu.Unlock()` across all handlers and `CleanExpiredStates()`

### FIX 2 (HIGH): Encrypt credentials in store read/write path
- **File:** `internal/store/entstore.go`
- Added `credentialEncryptor` field and `SetCredentialEncryptor()` setter to `EntStore`
- `CreateLinkedAccount`: encrypts AuthToken and RefreshToken before saving
- `UpdateLinkedAccount`: encrypts AuthToken and RefreshToken if provided
- `GetLinkedAccount` and `ListLinkedAccounts`: decrypt tokens after reading
- Added `decryptLinkedAccount()` helper for in-place decryption
- Encryption is idempotent (crypto.go's `Encrypt` skips already-encrypted values)

### FIX 3 (MEDIUM): Implement CheckAccountNow
- **File:** `internal/serverapp/credmonitor.go`
- Replaced no-op stub with real implementation: parses account ID, fetches the account from the store, runs `checkAccount()` which validates credentials and updates status

### FIX 4 (MEDIUM): OAuth state token expiry enforcement
- **File:** `internal/serverapp/linkflows.go`
- In each callback handler, after looking up the state, check `time.Since(ls.CreatedAt) > stateMaxAge` and reject with 400 if expired
- Extracted `stateMaxAge` constant (10 minutes) shared with `CleanExpiredStates`

### FIX 5 (MEDIUM): Single-failure no longer marks account expired
- **File:** `internal/serverapp/tokenrefresh.go`
- Added `isDefinitiveAuthError()` helper that checks for 401/403/unauthorized/forbidden
- Only marks account as expired for definitive auth errors; transient errors (network, 5xx) log a warning but leave status unchanged

### FIX 6 (LOW): Use r.Context() instead of context.Background()
- **File:** `internal/serverapp/linkflows.go`
- All OAuth token exchange calls and `CreateLinkedAccount` calls now use `r.Context()` for proper request lifecycle management

### FIX 7 (LOW): HTTP method enforcement
- **File:** `internal/serverapp/linkflows.go`
- All 6 handlers now check `r.Method != http.MethodGet` at entry and return 405 Method Not Allowed

## Verification

- `go build ./...` passes
- `go test ./internal/store/ ./internal/serverapp/ -count=1` passes
