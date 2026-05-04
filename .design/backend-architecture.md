# Farm Table — Backend Architecture: Dual-Mode Operation

**Date:** 2026-05-03
**Status:** Approved design
**Context:** Q12 from discussion-log.md. Farm Table should support both embedded (SQLite) and client-server (Postgres) operation modes while keeping the codebase simple and well-structured.

---

## 1. Problem

Farm Table's built-in backend currently assumes a client-server deployment: a separate `farmtable-server` process running against Postgres. This creates friction for:

- **Local development:** Developers need a running Postgres instance just to try `ft`.
- **Single-agent use:** A solo coding agent managing its own tasks doesn't need a database server.
- **Testing/CI:** Integration tests require Postgres infrastructure.
- **Quick starts:** The product principle is "agents start working immediately without API keys or platform setup." Requiring Postgres contradicts this.

## 2. Solution: Dual-Mode via bufconn

The CLI operates in two modes, determined automatically by configuration:

```
┌─ Embedded mode (default) ────────────────────────────┐
│  ft CLI ──bufconn──► in-process FarmTableService      │
│                      └──► EntStore(SQLite)            │
│  No separate server. No Postgres. Just works.         │
├─ Client-server mode ─────────────────────────────────┤
│  ft CLI ──gRPC──► farmtable-server (separate process) │
│                   └──► EntStore(Postgres)              │
│  Production deployments. Multi-agent coordination.    │
└──────────────────────────────────────────────────────┘
```

**Mode selection logic:**

1. If `FARMTABLE_SERVER` is set or `--server` flag is provided → **client-server mode**
2. If `server` is set in config file → **client-server mode**
3. Otherwise → **embedded mode** with SQLite at `~/.farmtable/farmtable.db` (overridable via `FARMTABLE_DB_PATH`)

**Why bufconn:** gRPC's `google.golang.org/grpc/test/bufconn` provides an in-memory network connection. The CLI commands always use a `FarmTableServiceClient` — in embedded mode, that client connects to an in-process gRPC server over bufconn instead of a TCP socket. Zero changes to CLI command code, service code, or store code. Only the connection setup differs.

---

## 3. Architecture Layers

```
┌──────────────────────────────────────────────┐
│                  cmd/ft/                      │  CLI binary
│                  cmd/farmtable-server/        │  Server binary
├──────────────────────────────────────────────┤
│  internal/cli/                               │  Cobra commands
│    connect.go  ← mode selection lives here   │  (unchanged except connect.go)
├──────────────────────────────────────────────┤
│  internal/server/                            │  FarmTableService (gRPC impl)
│    server.go, convert.go                     │  (unchanged)
├──────────────────────────────────────────────┤
│  internal/store/                             │  Store interface + EntStore
│    store.go    — interface                   │  (unchanged)
│    entstore.go — dialect-aware impl          │  (renamed from postgres.go)
│    schema/     — Ent schema definitions      │  (unchanged)
│    ent/        — generated code              │  (regenerated with SQLite support)
├──────────────────────────────────────────────┤
│  Postgres  or  SQLite                        │  Database layer
└──────────────────────────────────────────────┘
```

**Key property:** Each layer is unaware of the mode. The store doesn't know if it's embedded or remote. The service doesn't know if clients are in-process or networked. The CLI commands don't know which connection type they're using. Mode selection is a single decision point in `connect.go`.

---

## 4. Component Changes

### 4.1 EntStore (renamed from PostgresStore)

The current `PostgresStore` has no Postgres-specific code — all queries use Ent's builder API, which generates dialect-appropriate SQL. The rename reflects this:

```go
type EntStore struct {
    client  *ent.Client
    dialect string
}

func NewEntStore(ctx context.Context, opts StoreOptions) (*EntStore, error) {
    // opts.Dialect: "postgres" or "sqlite3"
    // opts.DSN: connection string
    client, err := ent.Open(opts.Dialect, opts.DSN)
    // ... same hook registration, schema migration
}
```

**StoreOptions struct:**

```go
type StoreOptions struct {
    Dialect string // "postgres" or "sqlite3"
    DSN     string // connection string
    Migrate bool   // run schema migration on startup (default: true)
}
```

**SQLite DSN conventions:**
- File-based: `file:~/.farmtable/farmtable.db?_fk=1`
- In-memory (tests): `file::memory:?cache=shared&_fk=1`
- `_fk=1` enables foreign key enforcement (off by default in SQLite)

### 4.2 connect.go (CLI connection logic)

Today:

```go
func newClient(server, token string) (pb.FarmTableServiceClient, *grpc.ClientConn, error) {
    conn, err := dialServer(server)
    return pb.NewFarmTableServiceClient(conn), conn, nil
}
```

After:

```go
func newClient(globals *globalFlags) (pb.FarmTableServiceClient, io.Closer, error) {
    server := resolveServer(globals.server)
    
    if server != "" {
        // Client-server mode: dial remote
        conn, err := dialServer(server)
        return pb.NewFarmTableServiceClient(conn), conn, nil
    }
    
    // Embedded mode: start in-process server with SQLite
    return startEmbedded()
}

func startEmbedded() (pb.FarmTableServiceClient, io.Closer, error) {
    dbPath := resolveDBPath() // ~/.farmtable/farmtable.db
    store, err := store.NewEntStore(ctx, store.StoreOptions{
        Dialect: "sqlite3",
        DSN:     fmt.Sprintf("file:%s?_fk=1", dbPath),
    })
    
    lis := bufconn.Listen(1 << 20) // 1MB buffer
    srv := grpc.NewServer()
    pb.RegisterFarmTableServiceServer(srv, server.NewFarmTableService(store))
    go srv.Serve(lis)
    
    conn, err := grpc.NewClient("passthrough:///bufconn",
        grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
            return lis.DialContext(ctx)
        }),
        grpc.WithTransportCredentials(insecure.NewCredentials()),
    )
    
    client := pb.NewFarmTableServiceClient(conn)
    closer := &embeddedCloser{conn: conn, srv: srv, store: store}
    return client, closer, nil
}
```

### 4.3 farmtable-server (standalone binary)

No changes to the server binary itself. It continues to read `FARMTABLE_DB_URL` and run as a standalone gRPC server. The only addition is supporting dialect selection:

```go
dbDialect := os.Getenv("FARMTABLE_DB_DIALECT") // default: "postgres"
dbURL := os.Getenv("FARMTABLE_DB_URL")
store, err := store.NewEntStore(ctx, store.StoreOptions{
    Dialect: dbDialect,
    DSN:     dbURL,
})
```

This allows running the standalone server against SQLite for staging/testing if desired, though Postgres remains the production recommendation.

### 4.4 Ent code generation

Add SQLite dialect support to the Ent generation. In `internal/store/ent/generate.go`:

```go
//go:generate go run -mod=mod entgo.io/ent/cmd/ent generate --target ./ent --feature sql/upsert ./schema
```

And add the SQLite driver dependency:

```go
import _ "github.com/mattn/go-sqlite3" // SQLite driver
```

---

## 5. SQLite Compatibility Notes

### 5.1 What works identically

The current codebase uses only Ent's builder API — no raw SQL, no Postgres-specific functions. All existing queries work on both dialects:

- CRUD operations (Create, Get, Query, Update, Delete)
- WHERE clauses with predicates (EQ, NEQ, In, IsNil)
- Ordering, pagination (Limit, Offset)
- Edge traversal (task → comments, task → relationships)
- JSON fields (Ent handles dialect differences for JSON storage)
- UUID fields (stored as TEXT in SQLite, which is correct)
- Timestamp fields (stored as TEXT in SQLite via Ent's time serialization)

### 5.2 Concurrency: advisory locks vs. process-level locking

| Concern | Postgres | SQLite |
|---|---|---|
| Concurrent writes | Row-level locks, MVCC | WAL mode, process-level serialization |
| Atomic claims (CAS) | UPDATE WHERE works under MVCC | UPDATE WHERE works under WAL (single-writer) |
| Multiple server processes | Fully supported | Not supported (file lock contention) |

**Embedded mode is inherently single-process.** The `ft` CLI starts and stops the embedded server per invocation. SQLite's write serialization is sufficient — there's no concurrent writer. If an agent runs multiple `ft` commands in rapid succession, SQLite's WAL mode handles this correctly (writes queue behind the file-level write lock).

**For multi-agent deployments, use client-server mode with Postgres.** This is the correct operational guidance: embedded/SQLite is for single-agent and development; Postgres is for production multi-agent coordination.

### 5.3 Graph queries (Phase 2D)

Recursive CTEs (needed for dependency tree traversal, critical path analysis) are supported by both Postgres and SQLite. The graph query implementations in `internal/graph/` will use Ent's SQL builder or raw CTEs — both dialects handle `WITH RECURSIVE` correctly.

### 5.4 Ent schema migrations

Ent's `client.Schema.Create(ctx)` handles both dialects. It generates CREATE TABLE statements appropriate to the target database. For production Postgres deployments, consider using Ent's versioned migration support (`entc migrate`) for controlled schema evolution. For embedded SQLite, auto-migration on startup is appropriate.

---

## 6. Data Location & Lifecycle

### 6.1 Embedded mode defaults

| Item | Default | Override |
|---|---|---|
| Database file | `~/.farmtable/farmtable.db` | `FARMTABLE_DB_PATH` |
| Config file | `~/.config/farmtable/config.toml` | `FARMTABLE_CONFIG` |

The `~/.farmtable/` directory is created automatically on first use.

### 6.2 Data portability

An embedded SQLite database can be migrated to Postgres when a team outgrows single-agent use. This is a future CLI command (`ft admin migrate-db --to postgres://...`) — not in scope for v1, but the architecture doesn't preclude it.

---

## 7. Testing Strategy

| Test type | Backend | How |
|---|---|---|
| Unit tests (store layer) | In-memory SQLite | `file::memory:?cache=shared&_fk=1` |
| Unit tests (server layer) | In-memory SQLite via EntStore | Same |
| Integration tests (CLI) | Embedded mode (bufconn + SQLite) | Default behavior, no setup |
| Integration tests (full stack) | Postgres via Docker/testcontainers | `FARMTABLE_DB_URL` pointed at test Postgres |
| CI | In-memory SQLite for fast tests, Postgres for full suite | Matrix strategy |

The embedded architecture means most tests need zero infrastructure. Postgres-specific tests (concurrency under load, advisory locks, production migration paths) run in CI with a containerized Postgres instance.

---

## 8. Implementation Phases

### Phase A: EntStore refactor (prerequisite, low risk)

**Scope:** Rename and generalize the store constructor. No behavior changes.

1. Rename `postgres.go` → `entstore.go`, `PostgresStore` → `EntStore`
2. Replace `NewPostgresStoreFromDSN(ctx, dsn)` with `NewEntStore(ctx, StoreOptions{})` accepting dialect + DSN
3. Add `_ "github.com/mattn/go-sqlite3"` import for SQLite driver
4. Add SQLite-specific Ent configuration: enable foreign keys (`_fk=1`), WAL mode (`_journal_mode=WAL`)
5. Update `cmd/farmtable-server/main.go` to use new constructor with `FARMTABLE_DB_DIALECT` env var (defaulting to "postgres")
6. Verify: existing server binary still works unchanged against Postgres

**Validation:** `go build ./...` passes. Existing Postgres path unchanged.

> **Implementation note (2026-05-03) — Phase A complete.**
>
> All items implemented as specified. Notable decisions:
>
> - **SQLite configuration via PRAGMAs instead of DSN params:** Rather than relying solely on `_fk=1` and `_journal_mode=WAL` DSN query parameters (which depend on driver-level support), the `openSQLite()` helper opens the `database/sql` connection directly, executes `PRAGMA journal_mode=WAL` and `PRAGMA foreign_keys=ON` explicitly, then wraps it with Ent's `entsql.OpenDB()`. This guarantees the pragmas take effect regardless of driver version.
> - **Single connection for SQLite:** `db.SetMaxOpenConns(1)` is set for SQLite to avoid "database is locked" errors under concurrent access, consistent with WAL mode's single-writer model.
> - **`StoreOptions.Migrate` is explicit:** The old constructor always ran migrations. The new `StoreOptions.Migrate` field must be set to `true` explicitly (it does not default to true via zero value). `cmd/farmtable-server/main.go` passes `Migrate: true`. This gives Phase B's embedded mode and Phase D's test infrastructure control over whether migrations run.
> - **Old `NewPostgresStore()` (env-var reader) removed:** The original code had two constructors — `NewPostgresStore()` (reads `FARMTABLE_DB_URL` from env) and `NewPostgresStoreFromDSN()`. Both are replaced by the single `NewEntStore(ctx, StoreOptions{})`. The env-var reading responsibility stays in `main.go` where it belongs.

### Phase B: Embedded mode in CLI (core feature)

**Scope:** Add the bufconn embedded path to the CLI.

1. Add `google.golang.org/grpc/test/bufconn` dependency
2. Refactor `connect.go`: extract mode selection logic, add `startEmbedded()` function
3. Add `resolveDBPath()` — reads `FARMTABLE_DB_PATH` or defaults to `~/.farmtable/farmtable.db`
4. Ensure `~/.farmtable/` directory is created if it doesn't exist
5. Add `embeddedCloser` type that cleans up server + store + connection on close
6. Update all CLI commands to use the new `newClient(globals)` signature (returns `io.Closer` instead of `*grpc.ClientConn`)

**Validation:** `ft task create "test task" -c default` works with no server running, no Postgres, no config. Creates `~/.farmtable/farmtable.db`.

> **Implementation note (2026-05-03) — Phase B complete.**
>
> All items implemented as specified. Notable decisions:
>
> - **`resolveServer` returns `""` for embedded mode:** The `defaultServer` constant (`localhost:50051`) was removed. When no `--server` flag, `FARMTABLE_SERVER` env, or config `server` value is set, `resolveServer` returns an empty string, triggering embedded mode in `newClient`. This is the single decision point described in section 3.
> - **`requireToken` removed from command handlers:** In embedded mode, there is no auth — the in-process gRPC server has no auth middleware. Removing the CLI-side `requireToken` gate allows embedded mode to work without configuring a token. Client-server mode still sends the token via `authCtx` if present; server-side auth enforcement is a separate concern.
> - **`embeddedCloser` shutdown order:** `Close()` calls `conn.Close()` (client connection), then `srv.Stop()` (gRPC server), then `store.Close()` (database). This ensures in-flight RPCs complete before the store is closed.
> - **`version.go` also updated:** The version command had a separate `newClient` call that was gated on `token != ""`. Updated to use the new `newClient(globals)` signature and work in both modes.

### Phase C: Default collection for embedded mode

**Scope:** Remove friction for embedded zero-config use.

1. On first embedded startup, auto-create a "default" collection (platform: farmtable) if none exists
2. If no `--collection` flag and no `default_collection` in config, and exactly one collection exists, use it implicitly
3. This means `ft task create "Fix the bug"` works with zero flags on a fresh install

**Validation:** Fresh install → `ft task create "hello"` → task created in auto-provisioned default collection.

> **Implementation note (2026-05-03) — Phase C complete.**
>
> All items implemented as specified. Notable decisions:
>
> - **Auto-creation in `startEmbedded()`:** `ensureDefaultCollection()` runs as a post-connection hook after the in-process gRPC server is ready. It calls `ListCollections` via the client; if `total_count == 0`, it creates a "default" collection (platform: farmtable, set by the server's `CreateCollection` handler). This is idempotent — subsequent invocations see the existing collection and skip creation.
> - **`resolveCollectionFromServer()` helper:** When `resolveCollection()` returns empty (no `--collection` flag, no `FARMTABLE_COLLECTION` env, no `default_collection` in config), this helper calls `ListCollections` and returns the sole collection's ID if exactly one exists. If zero or multiple collections exist, it returns empty — preserving the existing error for `task create` and the "unscoped" behavior for `task list`/`task get`.
> - **Commands updated:** `task create`, `task list`, and `task get` now resolve collection after client creation so the server can be queried. Other commands (`task update`, `task claim`, `task close`, `comment add/list`) operate by task ID and don't need collection resolution.
> - **No new dependencies or config keys:** The feature requires zero configuration. The only user-visible change is that `ft task create "hello"` works on a fresh install with no flags.

### Phase D: Test infrastructure

**Scope:** Set up test harnesses using the embedded architecture.

1. Create `internal/testutil/teststore.go` — helper that creates an in-memory EntStore for tests
2. Create `internal/testutil/testserver.go` — helper that starts a bufconn server and returns a client
3. Write store-layer tests (CRUD, CAS, claim, close) against in-memory SQLite
4. Write server-layer tests (RPC round-trips) against bufconn
5. Add Makefile target: `make test` runs all tests (no Postgres needed)

**Validation:** `make test` passes on a machine with no Postgres installed.

> **Implementation note (2026-05-03) — Phase D complete.**
>
> All items implemented as specified. Notable decisions:
>
> - **`testutil.NewTestStore()` uses `file::memory:?cache=shared&_fk=1`:** Each test gets a fresh in-memory SQLite database with auto-migration. The helper returns the `*store.EntStore` and a cleanup func for `defer`. Uses `cache=shared` so multiple connections within a test share the same database (required by SQLite in-memory semantics).
> - **`testutil.NewTestServer()` composes `NewTestStore()`:** Creates an in-memory store, wires it to a `FarmTableService`, starts a bufconn-backed gRPC server, and returns a `pb.FarmTableServiceClient`. Cleanup tears down connection → server → store in order.
> - **CAS version increment fix:** The `versionHook` relies on `OldVersion(ctx)` which only works for `UpdateOneID()` operations, not bulk `Update()` with WHERE clauses. Since `UpdateTask`, `ClaimTask`, and `CloseTask` all use bulk `Update()` for CAS matching, the hook silently failed to increment versions. Fixed by computing and setting the new version explicitly in each method (`strconv.Atoi(version) + 1`). The hook remains for any future `UpdateOneID` call paths.
> - **Store tests (6 test functions, 11 subtests):** Cover CreateTask+GetTask round-trip, GetTask not-found, ListTasks with collection/phase/stage/combined filters, UpdateTask CAS (correct version, wrong version, missing version), ClaimTask (success + double-claim), CloseTask (completed, wont_fix, invalid stage).
> - **Server tests (5 test functions, 7 subtests):** Cover CreateTask→GetTask RPC round-trip, ListTasks 3-page pagination, UpdateTask version conflict returning `codes.FailedPrecondition`, ClaimTask (success + double-claim), CloseTask (completed + invalid stage returning `codes.InvalidArgument`).
> - **Makefile unchanged:** The existing `make test` target (`go test ./...`) already discovers and runs all tests. No Postgres needed — all tests use in-memory SQLite via the testutil helpers.

---

## 9. What This Design Does NOT Cover

- **SQLite-to-Postgres migration tooling** — future CLI command, not v1
- **Multiple embedded databases** (per-project databases) — single global database for now
- **SQLite in standalone server mode** — technically possible via `FARMTABLE_DB_DIALECT=sqlite3`, but not a supported production configuration. Postgres is required for multi-agent production deployments.
- **Connection pooling for SQLite** — not needed; single connection is correct for WAL mode in embedded use

---

## 10. Summary

| Aspect | Embedded mode | Client-server mode |
|---|---|---|
| Database | SQLite (`~/.farmtable/farmtable.db`) | Postgres |
| Server process | In-process via bufconn | Separate `farmtable-server` |
| Setup required | None | Postgres + server deployment |
| Multi-agent support | Single agent only | Full multi-agent coordination |
| Graph queries | Full support (recursive CTEs) | Full support |
| Atomic claims | Process-level (sufficient) | Row-level (MVCC) |
| Target users | Local dev, single agent, CI/testing | Production teams, multi-agent |

The architecture keeps the codebase simple: one store implementation, one service implementation, one CLI codebase. The mode is a connection-time decision, not an architectural fork.
