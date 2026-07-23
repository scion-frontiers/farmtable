# Stage 5 Review Fix Log

**Date:** 2026-07-23
**Branch:** auth/stage5-oauth-iap-proxy
**Commit:** 6312706

## Review Findings Addressed

The Stage 5 code review identified 7 findings (2 HIGH, 2 MEDIUM, 3 LOW). All actionable findings were fixed in commit 6312706.

### Fixed

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| F1 | HIGH | Race condition on `pendingStates` map | Added `sync.Mutex` to `GoogleOAuthManager`; locked around all map operations |
| F2 | HIGH | Open redirect via unvalidated `redirect_uri` | Added `isValidRedirect()` validator — only allows relative paths |
| F3 | MEDIUM | No PKCE in OAuth flow | Added `oauth2.GenerateVerifier()` + `S256ChallengeOption` in login, `VerifierOption` in callback |
| F4 | MEDIUM | State cleanup never called (DoS risk) | `CleanExpiredOAuthStates()` called inline at start of `handleLogin` |
| F5 | LOW | `context.Background()` instead of `r.Context()` | Replaced in Exchange and Client calls |
| F7 | LOW | Variable `os` shadows import | Renamed to `pending` |

### Not Fixed (Non-blocking)
| # | Severity | Issue | Reason |
|---|----------|-------|--------|
| F6 | LOW | `log.Printf` vs `slog` | Non-blocking style suggestion; can be addressed in a future cleanup pass |

## Build & Test
- `go build ./...` — PASS
- `go test ./internal/serverapp/ -count=1` — PASS (0.026s)
