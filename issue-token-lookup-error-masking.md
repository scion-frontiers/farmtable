# Issue: Token Lookup Masks DB Errors as "invalid token"

**Severity:** Medium (causes confusing failures under load)  
**Date:** 2026-07-23  
**Found during:** Decomposer resume run against flash-lite v3 collection

## Observation

The decomposer resume run failed after ~10 minutes with:
```
rpc error: code = Unauthenticated desc = invalid token
```

The ft_ token is a static secret with no expiry. The run started with a freshly retrieved token. The IAP OIDC token (1hr TTL) should also have been valid — 10 minutes is well within the window. Yet the error claims "invalid token."

## Root Cause

In `internal/server/auth.go` lines 143-145:

```go
result, err := lookup.LookupByHash(ctx, hash)
if err != nil {
    return nil, status.Error(codes.Unauthenticated, "invalid token")
}
```

Any error from `LookupByHash` — including transient database errors, connection timeouts, context cancellation — is returned as "invalid token." This is misleading because:

1. The token IS valid; the lookup just failed to execute.
2. Clients (like the decomposer) interpret "invalid token" as a permanent auth failure and give up, when a retry would succeed.
3. Debugging is harder because the real error (DB timeout, connection pool exhaustion, etc.) is swallowed.

The same pattern appears in the stream interceptor (lines 192-194).

## Confirmed Root Cause (from server logs)

Cloud Run logs confirm the actual trigger:

```
Exceeded maximum of 100 connections per instance "deploy-demo-test:us-central1:scion-postgres-test"
```

The Cloud SQL Postgres instance has a **100-connection limit per Cloud Run instance**. The decomposer's sustained ~700 RPCs/min exhausts the connection pool. When a DB connection can't be acquired, the `LookupByHash` query fails, and auth.go masks it as "invalid token."

This explains:
- Why it happens after minutes, not hours (pool saturates under sustained load)
- Why it's intermittent (depends on concurrent connection usage from all clients)
- Why the ft_ token works fine on retry (connections free up during backoff)

Timestamps from Cloud Logging:
- Resume pass 1 failure: ~15:46 UTC → connection errors at 15:46
- Resume pass 2 failure: ~15:58 UTC → connection errors at 15:57
- Resume pass 3 (ongoing): connection errors appearing at 16:11

## Recommended Fixes

### Server-side (two items)

1. **Distinguish token-not-found from DB error:**

```go
result, err := lookup.LookupByHash(ctx, hash)
if err != nil {
    if errors.Is(err, ErrTokenNotFound) {
        return nil, status.Error(codes.Unauthenticated, "invalid token")
    }
    // DB/transient error — return Internal, not Unauthenticated
    log.Printf("token lookup error: %v", err)
    return nil, status.Error(codes.Internal, "authentication service unavailable")
}
```

2. **The `LookupByHash` implementation should return a sentinel error** (e.g., `ErrTokenNotFound`) when the token genuinely doesn't exist, vs propagating DB errors as-is.

3. **Client-side retry:** The decomposer's `callLLMWithRetry` retries LLM errors, but gRPC Unauthenticated errors from the writer are not retried. Could add retry-on-transient for writer calls too, but fixing the server to return the correct error code is the right fix.

## Additional Concerns

- **IAP OIDC token refresh:** Even though this specific failure wasn't IAP-related, the decomposer mints the IAP token once at startup. For runs longer than 1 hour, the IAP token WILL expire. The decomposer should either refresh the token periodically or detect the specific IAP error ("Invalid IAP credentials: Unable to parse JWT") and re-mint.

### Infrastructure

3. **Increase Cloud SQL connection limit or add pgbouncer:** The 100-connection limit
   is the default for a small Cloud SQL instance. Options:
   - Increase `max_connections` on the Postgres instance
   - Add a Cloud SQL Auth Proxy with connection pooling (pgbouncer mode)
   - Tune the app's connection pool (`max_open_conns`, `max_idle_conns`) to stay under the limit

### Client-side (done)

4. **Decomposer retry with backoff:** PR #141 adds retry with exponential backoff and
   jitter for all writer calls, including retrying `codes.Unauthenticated` as a workaround
   for this bug. This lets the decomposer ride through connection spikes.

## Reproduction

Run the decomposer in resume mode against a large collection (~14,000 tasks) with concurrency 8. The sustained API call rate (~700/min) exhausts the Cloud SQL 100-connection limit within 4-10 minutes.
