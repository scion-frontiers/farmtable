# Cloud SQL Connection Limit Investigation

**Project:** deploy-demo-test | **Instance:** scion-postgres-test | **Date:** 2026-07-23

## Root Cause

The 100-connection limit is the Postgres `max_connections` database flag, explicitly set to `100` on the Cloud SQL instance (`settings.databaseFlags`). This is not an Auth Proxy limit.

## Instance Details

| Property | Value |
|---|---|
| Tier | `db-g1-small` (shared-core, 0.5 vCPU, 1.7 GB RAM) |
| Postgres version | 16.13 |
| `max_connections` flag | **100** (explicitly set) |
| Disk | 10 GB PD-SSD, auto-resize enabled |
| HA | Zonal (no failover replica) |

The `db-g1-small` tier's default `max_connections` is 100, which matches the explicit flag. This tier can theoretically support up to ~200 connections before memory pressure becomes a problem, but 100 is the configured hard ceiling.

## App-Level Connection Pool: NONE

The Farmtable server opens the Postgres connection via Ent ORM at `/workspace/farmtable/internal/store/entstore.go:65`:

```go
client, err = ent.Open(opts.Dialect, opts.DSN)
```

**No pool tuning is applied for Postgres.** There are no calls to `SetMaxOpenConns`, `SetMaxIdleConns`, `SetConnMaxLifetime`, or `SetConnMaxIdleTime` on the Postgres path. (The SQLite path at line 87 correctly sets `SetMaxOpenConns(1)`.)

Go's `database/sql` defaults to **unlimited open connections** and **2 idle connections**. Under sustained load (700 RPCs/min), each concurrent request can open a new connection. With `containerConcurrency: 80`, a single Cloud Run instance can have up to 80 concurrent requests, each potentially holding a DB connection, which can spike well above 100 when transactions overlap.

## Cloud Run Scaling Config

| Property | Value |
|---|---|
| Max instances | 100 |
| Min instances | Not set (defaults to 0) |
| Container concurrency | 80 |
| CPU | 1 vCPU |
| Memory | 512 Mi |
| Cloud SQL connection | `run.googleapis.com/cloudsql-instances` annotation (built-in Auth Proxy sidecar) |

The Auth Proxy is configured via the `cloudsql-instances` annotation (not a separate sidecar container). Each Cloud Run instance gets its own Auth Proxy, but all instances share the same Postgres `max_connections = 100` budget. Even a single instance at concurrency 80 can exhaust 100 connections. Two or more instances will definitely exceed it.

## Recommendations

1. **Set `SetMaxOpenConns` on the Postgres path in `entstore.go`.** A safe starting value is 20-25 per instance. This is the most impactful fix. Also set `SetConnMaxLifetime(5 * time.Minute)` and `SetConnMaxIdleTime(1 * time.Minute)` to recycle stale connections.

2. **Increase `max_connections` on the Cloud SQL instance.** Bump to 200 (`gcloud sql instances patch scion-postgres-test --database-flags=max_connections=200`). The `db-g1-small` tier can handle this.

3. **Upgrade the instance tier.** `db-g1-small` is a shared-core instance. Under sustained load, `db-custom-1-3840` (1 vCPU, 3.75 GB) would provide dedicated CPU and support 200+ connections comfortably.

4. **Cap Cloud Run max instances.** With `max_connections=100` and 25 connections per instance, cap at 4 instances (`--max-instances=4`) to stay within budget: 4 x 25 = 100. Adjust proportionally if `max_connections` is raised.

5. **Consider PgBouncer.** For heavier scaling, deploy PgBouncer as a Cloud Run sidecar or standalone service for connection multiplexing. This decouples app concurrency from Postgres connection count.
