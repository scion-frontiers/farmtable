# PR Review: feat/f59-iap-token-header

**Branch:** `feat/f59-iap-token-header` vs `origin/main`
**Commit:** `c413664 feat: add x-farmtable-token fallback header for IAP compatibility`
**Files changed:** 5 (120 insertions, 19 deletions)

---

## Executive Summary

This change introduces `x-farmtable-token` as a custom gRPC metadata header, allowing the app-layer auth token to survive Google IAP, which consumes the standard `Authorization` header. The risk level is **low** — the change is well-scoped, the extraction logic is correct and tested, and all three client surfaces (CLI, decomposer, web) are updated consistently.

---

## Review Summary

**Verdict:** APPROVE

**Overview:** A clean, focused change that adds IAP-compatible token transport by introducing a custom header (`x-farmtable-token`) with clear precedence over `Authorization: Bearer`. Server-side extraction is centralized in a new `extractToken` helper shared by both unary and stream interceptors. Client-side changes are mechanical and consistent. Two new integration tests verify the custom header path and its precedence. The logic is correct and the implementation aligns with existing patterns.

---

### Critical Issues

None.

---

### Important Issues

1. **[internal/server/auth_test.go] No stream interceptor test coverage for custom header**

   The `startServerWithLookup` helper registers only `grpc.UnaryInterceptor`. The `TokenAuthStreamInterceptor` received the identical refactor (using the shared `extractToken` function) but has no dedicated test for the custom header path. Since both interceptors share `extractToken`, the core logic is indirectly covered, but the stream interceptor's wrapping and error-return path are not exercised.

   **Risk:** Low — the stream interceptor is a mechanical mirror of the unary one and shares the same extraction function. However, if they ever diverge, the gap could hide regressions.

   **Suggested fix:** Add at least one stream-based test (e.g., using `WatchTasks`) that authenticates via `x-farmtable-token` only. This could be a follow-up.

2. **[internal/server/auth.go:58] Misleading comment "will be rejected below"**

   ```go
   // Has Authorization header but wrong scheme — will be rejected below
   return ""
   ```

   The comment says "will be rejected below," but `extractToken` itself does not reject — it simply returns `""`. The rejection happens in the calling interceptor. This could mislead a future reader into thinking there's logic below the `return ""` within `extractToken`.

   **Suggested fix:**
   ```go
   // Has Authorization header but wrong scheme — caller will reject
   return ""
   ```

---

### Suggestions

1. **[internal/server/auth.go:47–62] Consider returning richer signal from `extractToken`**

   Currently, `extractToken` returns `""` for two semantically different cases: (a) no token headers present at all, and (b) `Authorization` header present with wrong scheme. The caller must then re-check `md.Get("authorization")` to distinguish them, duplicating the "wrong scheme" detection (lines 78, 117).

   A cleaner approach would return a `(token string, hasWrongScheme bool)` tuple, letting the interceptor branch without re-reading metadata. This eliminates the double-read and makes the control flow self-documenting.

   ```go
   func extractToken(md metadata.MD) (token string, wrongScheme bool) {
       if vals := md.Get("x-farmtable-token"); len(vals) > 0 && vals[0] != "" {
           return vals[0], false
       }
       if vals := md.Get("authorization"); len(vals) > 0 {
           if strings.HasPrefix(vals[0], "Bearer ") {
               return strings.TrimPrefix(vals[0], "Bearer "), false
           }
           return "", true // wrong scheme
       }
       return "", false // no credentials
   }
   ```

   **Impact:** Readability improvement, not a correctness issue.

2. **[internal/server/auth_test.go] Consider testing the inverse precedence case**

   `TestAuthInterceptor_CustomHeaderPrecedence` tests valid custom header + invalid Bearer (auth succeeds). Consider also testing invalid custom header + valid Bearer — confirming the server rejects even when a valid Bearer is present, reinforcing the documented precedence contract.

3. **[web/src/gen/grpc-client.ts:394] Header casing is fine but worth a note**

   The web client sends `X-Farmtable-Token` (Title-Case) while Go uses `x-farmtable-token` (lowercase). This is correct — HTTP/2 headers are case-insensitive, and gRPC-web proxies normalize to lowercase. The Go `metadata.MD.Get()` also normalizes. No action needed; just documenting for future reference.

---

### What's Done Well

- **Centralized extraction logic:** The `extractToken` helper is clean, well-documented, and avoids duplicating parsing logic across both interceptors. Good separation of concerns.
- **Precedence design is correct for the IAP use case:** Checking the custom header first is the right call — behind IAP, `Authorization` will contain the IAP-injected JWT, so the custom header is the only reliable source.
- **Test coverage for the happy path and precedence:** `TestAuthInterceptor_CustomHeader` (custom header only, no `Authorization`) and `TestAuthInterceptor_CustomHeaderPrecedence` (custom header wins over conflicting `Authorization`) cover the two key scenarios introduced by this change.
- **Consistent client-side updates:** All three client surfaces (CLI `authCtx`, decomposer `authCtx`, web `metadata()`) send both headers, ensuring backward compatibility with non-IAP deployments while enabling IAP-proxied deployments.
- **Empty token guard preserved:** `connect.go:authCtx` retains the early `if token == ""` guard, and `writer.go` validates non-empty token at construction time. The web client's `if (!this.token)` guard is also intact. No risk of sending empty custom headers.

---

### Verification Story

- **Tests reviewed:** Yes — 2 new tests (`TestAuthInterceptor_CustomHeader`, `TestAuthInterceptor_CustomHeaderPrecedence`) are well-structured integration tests using real token creation and bufconn. All 8 auth tests pass.
- **Build verified:** Yes — `go build ./...` succeeds cleanly.
- **Lint/static analysis:** `go vet` on changed packages produces no new warnings. Pre-existing `go vet` issues in `server.go` (proto lock copy) are unrelated to this change.
- **Security checked:** Yes — the custom header carries the same raw token as the existing `Bearer` scheme. No new credential exposure vectors. Token is hashed with SHA-256 before DB lookup, consistent with existing flow. No secrets in code or logs.
