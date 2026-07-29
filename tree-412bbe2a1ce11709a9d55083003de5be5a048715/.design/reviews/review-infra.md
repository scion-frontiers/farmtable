# Infrastructure Review — Review Group 5

**Reviewer:** code-review agent (infra)
**Date:** 2026-05-04
**Scope:** `cmd/farmtable-server/main.go`, `cmd/ft/main.go`, `go.mod`, `go.sum`, `internal/testutil/*`, `Makefile`, `buf.gen.yaml`

---

## Summary

The infrastructure layer is compact and mostly well-structured. The server binary has proper graceful shutdown and signal handling. Test utilities are clean. There are a handful of issues — one high-severity security concern in the auth interceptor, one medium issue with test isolation, and several low-severity items around dependency currency, Makefile completeness, and buf codegen config.

---

## Findings

### INFRA-1 — Auth interceptor: token comparison is not constant-time

**Severity: HIGH**
**File:** `internal/server/auth.go:28`

The token comparison uses `!=` (string equality), which is vulnerable to timing side-channel attacks. An attacker can iteratively guess the token one byte at a time by measuring response latency.

```go
// Current
if token != validToken {
```

**Fix:** Use `crypto/subtle.ConstantTimeCompare`:
```go
import "crypto/subtle"

if subtle.ConstantTimeCompare([]byte(token), []byte(validToken)) != 1 {
    return nil, status.Error(codes.Unauthenticated, "invalid token")
}
```

---

### INFRA-2 — Auth interceptor: no `Bearer ` prefix validation

**Severity: MEDIUM**
**File:** `internal/server/auth.go:27`

`strings.TrimPrefix` silently returns the original string if the prefix is missing. A client sending `authorization: <raw-token>` (without the `Bearer ` prefix) will still authenticate successfully, breaking the expected Bearer token contract. This could mask client-side bugs and deviates from RFC 6750.

**Fix:** Explicitly validate the prefix:
```go
val := auth[0]
if !strings.HasPrefix(val, "Bearer ") {
    return nil, status.Error(codes.Unauthenticated, "authorization header must use Bearer scheme")
}
token := strings.TrimPrefix(val, "Bearer ")
```

---

### INFRA-3 — Test store uses `cache=shared` in-memory SQLite — risk of cross-test pollution

**Severity: MEDIUM**
**File:** `internal/testutil/teststore.go:14`

The DSN `file::memory:?cache=shared&_fk=1` uses a shared cache, which means all connections in the same process see the same in-memory database. If two tests run in parallel (or `NewTestStore` is called twice without closing the first), they share state.

This is safe *today* because `go test` runs test functions sequentially within a package by default, and each call to `NewTestStore` + cleanup creates/destroys the store. However, it's fragile — adding `t.Parallel()` to any test will silently break isolation.

**Fix:** Use a unique database name per test to guarantee isolation:
```go
dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared&_fk=1", t.Name())
```

Each test gets its own named in-memory database; `cache=shared` is still needed for Ent's multiple-connection access pattern but is scoped to that name.

---

### INFRA-4 — `go-github` is on v62; current latest is v72+

**Severity: LOW**
**File:** `go.mod:8`

`github.com/google/go-github/v62 v62.0.0` is roughly 10 major versions behind. The go-github project cuts a new major version for every GitHub API change, so this isn't a security concern per se, but newer versions include important API fixes and support for newer GitHub features (e.g., fine-grained PATs, Copilot APIs).

**Recommendation:** Upgrade to the latest major version when convenient. Not blocking.

---

### INFRA-5 — Server binary: `FARMTABLE_TOKEN` empty-string bypass is intentional but undocumented

**Severity: LOW**
**File:** `cmd/farmtable-server/main.go:49-52`

When `FARMTABLE_TOKEN` is unset/empty, the auth interceptor passes all requests through (line 15-16 of `auth.go`). This is a reasonable dev/local behavior, but there's no log warning that auth is disabled. A misconfigured production deployment would silently run without authentication.

**Fix:** Add a warning log when the token is empty:
```go
token := os.Getenv("FARMTABLE_TOKEN")
if token == "" {
    log.Println("WARNING: FARMTABLE_TOKEN is not set — authentication is disabled")
}
```

---

### INFRA-6 — `buf.gen.yaml` output path uses wrong module prefix

**Severity: LOW**
**File:** `buf.gen.yaml:7,10`

The `opt` values reference `module=go.farmtable.dev/api/gen`, but `go.mod` declares the module as `github.com/farmtable-io/farmtable`. Generated code imports under `github.com/farmtable-io/farmtable/api/farmtable/v1`, not `go.farmtable.dev/api/gen`. This config appears stale — codegen must be working via a different mechanism or was manually corrected after generation.

**Recommendation:** Verify `buf generate` actually produces correct import paths. If the module opt is ignored due to `out: api` placing files correctly, it's still confusing and should be updated to match the real module path:
```yaml
opt:
  - module=github.com/farmtable-io/farmtable/api
```

---

### INFRA-7 — Makefile: no `clean`, `proto-lint`, or `run` targets

**Severity: LOW**
**File:** `Makefile`

The Makefile has four targets (`generate`, `build`, `test`, `lint`). Missing:
- `clean` — remove build artifacts
- `run` / `serve` — start the server locally (useful for dev)
- `migrate` — run migrations independently
- `fmt` — `gofmt` / `goimports`

These are ergonomic, not correctness issues. The existing targets cover CI needs.

**Recommendation:** Add `clean` and `fmt` targets at minimum.

---

### INFRA-8 — Test server does not register auth interceptor

**Severity: LOW**
**File:** `internal/testutil/testserver.go:20`

The test server is created with `grpc.NewServer()` (no interceptors), while the production server uses `grpc.NewServer(grpc.UnaryInterceptor(server.TokenAuthInterceptor(token)))`. This means auth behavior is untested in integration tests that use `NewTestServer`.

This is likely intentional — tests shouldn't need to pass tokens — but it means the auth interceptor's interaction with real handlers is never integration-tested via this utility.

**Recommendation:** The dedicated `auth_test.go` covers the interceptor in isolation, which is acceptable. Consider adding a `NewTestServerWithAuth(t, token)` variant if auth integration testing is needed later.

---

### INFRA-9 — Server binary version mismatch with CLI binary

**Severity: INFO**
**File:** `cmd/farmtable-server/main.go:18`, `cmd/ft/main.go:5`

The server binary uses `var version = "dev"` (set at build time via ldflags), while the CLI uses `var version = "0.2.0"` (hardcoded). There's no mechanism ensuring these stay in sync.

**Recommendation:** Either inject both via ldflags in the Makefile, or define a shared version constant.

---

## Issue Tally

| Severity | Count | IDs |
|----------|-------|-----|
| HIGH     | 1     | INFRA-1 |
| MEDIUM   | 2     | INFRA-2, INFRA-3 |
| LOW      | 5     | INFRA-4, INFRA-5, INFRA-6, INFRA-7, INFRA-8 |
| INFO     | 1     | INFRA-9 |

## Recommendation

**Must fix before merge:** INFRA-1 (constant-time comparison).
**Should fix:** INFRA-2 (Bearer prefix validation), INFRA-3 (test isolation), INFRA-5 (auth-disabled warning).
**Can defer:** INFRA-4, INFRA-6, INFRA-7, INFRA-8, INFRA-9.
