# Issue: Cloud SQL Connection Pool Exhaustion Under Load

**Severity:** High (blocks sustained API load, e.g. decomposer runs)  
**Date:** 2026-07-23  
**Found during:** Decomposer resume runs against flash-lite v3 collection

## Observation

The Cloud SQL Postgres instance (`deploy-demo-test:us-central1:scion-postgres-test`) has a 100-connection limit per Cloud Run instance. Under sustained decomposer load (~700 RPCs/min at concurrency 8), the connection pool is exhausted within 4-10 minutes:

```
Exceeded maximum of 100 connections per instance "deploy-demo-test:us-central1:scion-postgres-test"
```

When a DB connection can't be acquired, token lookup queries fail. The auth middleware (`auth.go`) masks these DB errors as `codes.Unauthenticated / "invalid token"`, making the failure appear to be a token issue when it's actually infrastructure.

## Impact

- Decomposer resume runs fail after minutes — 82% of RPCs fail on first attempt when pool is saturated
- Even with client-side retry (PR #141), throughput drops from ~700 tasks/min to ~6.5 tasks/min
- Any other sustained API consumer would hit the same issue
- Misleading error messages make debugging harder

## Root Cause Analysis

The Cloud Run → Cloud SQL Auth Proxy path has a default 100-connection limit. Each incoming gRPC call that touches the database needs a connection. With:
- 8 concurrent decomposer goroutines
- Each making CreateTask, ListChildren, GetTask, UpdateTask calls
- Each call requiring a DB connection for token lookup AND the actual operation
- Plus any other concurrent users of the service

The 100-connection budget is quickly exhausted.

## Recommended Fix

### Option A: Cloud SQL Auth Proxy with Connection Pooling (Recommended)

Use the Cloud SQL Auth Proxy in [pgbouncer-compatible mode](https://cloud.google.com/sql/docs/postgres/connect-run#connection-pool) or deploy a standalone pgbouncer sidecar. This multiplexes many logical connections over fewer physical connections.

Cloud Run supports the built-in Cloud SQL connector with `--add-cloudsql-instances` which handles auth but does NOT pool. Adding pgbouncer as a sidecar or using AlloyDB Auth Proxy (which has built-in pooling) would solve this.

### Option B: Application-Level Connection Pool Tuning

Configure the Go database/sql pool in the Farmtable server:

```go
db.SetMaxOpenConns(25)     // Stay well under 100
db.SetMaxIdleConns(10)     // Keep idle connections ready
db.SetConnMaxLifetime(5 * time.Minute)
db.SetConnMaxIdleTime(1 * time.Minute)
```

This prevents the app from using all 100 connections, leaving headroom for connection churn. However, it may limit throughput under high concurrency.

### Option C: Increase Cloud SQL max_connections

Scale up the Postgres instance tier to get a higher connection limit. Quick fix but doesn't address the underlying pool management issue.

### Option D: Server-side Request Rate Limiting

Add rate limiting or request queuing at the gRPC layer so the server never exceeds its connection budget. Returns `ResourceExhausted` (429 equivalent) to clients, which they can retry. This is the most resilient approach but adds complexity.

## Recommendation

**Option B (app-level pool tuning) as an immediate fix** — it's a config change, no infra work. Combine with **Option A (pgbouncer)** as a longer-term solution for production scalability.

Also fix `auth.go` error masking (separate issue: `issue-token-lookup-error-masking.md`) so DB errors return `codes.Internal` not `codes.Unauthenticated`.

## Related

- `issue-token-lookup-error-masking.md` — auth.go masks DB errors as "invalid token"
- PR #141 — client-side retry with backoff (workaround, merged/pending)
- `design-decomposer-retry-resilience.md` — design for client-side resilience
