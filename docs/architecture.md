# Farm Table — Architecture Overview

Farm Table is an open-source task runtime for AI agents. It gives coding
agents a single, predictable interface to receive work, understand
dependencies, and track progress — whether tasks live in GitHub, Jira,
Linear, or Farm Table's own built-in graph backend.

When no external platform is connected, the built-in backend provides a
graph-native task store with dependency tracking, atomic claims, and
ready-task detection. No API keys, no SaaS accounts, no configuration.

---

## 1. System Overview

Farm Table operates in two modes from the same codebase:

```
┌─ Embedded mode (default) ──────────────────────────────────────┐
│  ft CLI ──bufconn──► in-process FarmTableService               │
│                      └──► EntStore(SQLite)                     │
│  Single process. Zero infrastructure. Just works.              │
├─ Client-server mode ───────────────────────────────────────────┤
│  ft CLI ──gRPC/TLS──► farmtable-server (separate process)      │
│                       └──► EntStore(Postgres)                  │
│  Multi-agent coordination. Production deployments.             │
└────────────────────────────────────────────────────────────────┘
```

**Mode selection** is a single decision point in `internal/cli/connect.go`:

1. `FARMTABLE_SERVER` env var or `--server` flag → **client-server mode**
2. `server` key in config file → **client-server mode**
3. Otherwise → **embedded mode**, SQLite at `~/.farmtable/farmtable.db`
   (override via `FARMTABLE_DB_PATH`)

In embedded mode the CLI starts an in-process gRPC server over bufconn
(an in-memory network connection). Every consumer uses a
`FarmTableServiceClient` regardless of mode — the only difference is
the transport. No layer is aware of which mode it's running in.

| Aspect | Embedded | Client-Server |
|---|---|---|
| Database | SQLite (WAL, single writer) | Postgres (MVCC, row-level locks) |
| Server process | In-process via bufconn | Separate `farmtable-server` |
| Setup required | None | Postgres + server deploy |
| Multi-agent | Single agent | Full coordination |
| Graph queries | Full (recursive CTEs) | Full |
| Atomic claims | Process-level | Row-level |
| Auth | Auto-provisioned token | Managed API tokens |

---

## 2. Key Abstractions

### Normalized Task Object (NTO)

Every task — whether from GitHub, Linear, or the built-in backend — is
represented as a single normalized schema. The proto definition
(`proto/farmtable/v1/farmtable.proto`) is the source of truth.

**Three-tier status model.** Status is decomposed into three fields:

| Field | Cardinality | Purpose |
|---|---|---|
| `phase` | 4 values | Coarse lifecycle. Agents branch on this. |
| `stage` | 15 values | Fine-grained position. Humans and dashboards use this. |
| `native_label` | Free text | Verbatim platform status for round-trip fidelity. |

Stage determines phase — the mapping is a pure function
(`phaseForStage` in `internal/server/convert.go`):

```
 OPEN         triage → backlog → ready
 IN_PROGRESS  working → in_review → in_qa → deploying
 ON_HOLD      blocked → waiting_for_input → deferred → scheduled
 CLOSED       completed / wont_fix / duplicate / cancelled
```

**Code context.** Tasks carry optional software-development metadata:
`repo`, `branch`, `pull_requests` (id/url/status triples), and
`ci_status` (pending/running/passed/failed).

**Remote escape hatch.** `remote_id`, `remote_url`, and `remote_data`
(arbitrary JSON) preserve the original platform representation for
lossless sync.

See the proto file for the complete field set.

### Collections

Tasks are grouped into Collections — the Farm Table equivalent of a
project or board. Each collection maps 1:1 to a single external
platform scope (one GitHub repo, one Jira project, one Linear team)
or to the built-in backend.

In embedded mode a "default" collection is auto-created on first use.
When exactly one collection exists it's used implicitly — no
`--collection` flag needed.

### Relationships

Tasks form a directed dependency graph:

```
┌──────────┐   blocks    ┌──────────┐   blocks    ┌──────────┐
│  Task A  │────────────►│  Task B  │────────────►│  Task C  │
└──────────┘             └──────────┘             └──────────┘
```

Each `Relationship` entity has `(source_task_id, target_task_id, type)`
with a unique constraint on the triple. Types: `blocks`, `blocked_by`,
`relates_to`, `duplicates`, `duplicated_by`.

Tasks expose two Ent edge sets — `source_relationships` and
`target_relationships` — so traversals can walk edges in both
directions. Relationships power ready-task detection, dependency trees,
critical path analysis, and bottleneck detection.

### Change Audit Trail

Every mutation to a task is tracked. The `Change` entity records:

| Field | Description |
|---|---|
| `task_id` | Which task changed |
| `author_id` | Who made the change (from auth context) |
| `field_name` | Which field (`title`, `stage`, `assignee_id`, ...) |
| `old_value` / `new_value` | Before and after |
| `reason` | Optional context string |
| `created_at` | When |

Changes are recorded automatically inside `UpdateTask`, `ClaimTask`,
and `CloseTask` at the store layer. The `diffTask()` helper compares
old and new task states and writes one Change per modified field.
Queryable via `ListChanges` with optional field filtering.

---

## 3. Layer Diagram

```
┌────────────────────────────────────────────────────────────────┐
│  Consumers                                                     │
│  ┌──────────┐  ┌───────────────┐  ┌─────────────────────────┐ │
│  │  ft CLI   │  │ Agent Skills  │  │ MCP Adapter (ft mcp)    │ │
│  │ (Cobra)   │  │ (framework    │  │ 10 tools via stdio      │ │
│  │           │  │  wrappers)    │  │                         │ │
│  └─────┬─────┘  └──────┬────────┘  └────────┬────────────────┘ │
│        │               │                    │                  │
│        └───────────────┼────────────────────┘                  │
│                        │  gRPC (TCP or bufconn)                │
├────────────────────────┼───────────────────────────────────────┤
│  Auth Interceptor      │                                       │
│  TokenAuthInterceptor: SHA-256 token → user ID in context      │
├────────────────────────┼───────────────────────────────────────┤
│  Server                │                                       │
│  FarmTableService (internal/server/server.go)                  │
│  gRPC handlers: CRUD, graph queries, audit trail               │
│  convert.go: Ent entities ↔ proto messages                     │
├────────────────────────┼───────────────────────────────────────┤
│  Store (internal/store/)                                       │
│  store.go: Store interface                                     │
│  entstore.go: EntStore — dialect-agnostic implementation       │
├────────────────────────┼───────────────────────────────────────┤
│  Ent ORM (entgo.io)                                            │
│  schema/ → ent/ (generated)                                    │
├────────────────────────┼───────────────────────────────────────┤
│  Database                                                      │
│  SQLite (embedded)  or  Postgres (client-server)               │
└────────────────────────────────────────────────────────────────┘

  Beside the stack:
  internal/platform/ ── Adapter interface + platform-specific sync
```

Each layer depends only on the one below it. The `Store` interface
decouples the server from the database. The gRPC service definition
decouples consumers from the server implementation.

### Directory layout

```
cmd/
  ft/                    CLI binary
  farmtable-server/      Standalone gRPC server
internal/
  cli/                   Cobra commands + connect.go (mode decision)
  server/                gRPC handlers, auth interceptor, proto conversion
  store/                 Store interface + EntStore
    schema/              Ent entity definitions
    ent/                 Generated Ent code
  platform/              Adapter interface + platform implementations
    github/              GitHub Issues adapter
  mcp/                   MCP adapter
  testutil/              Test harnesses (in-memory SQLite + bufconn)
proto/
  farmtable/v1/          Protobuf definitions (source of truth)
api/
  farmtable/v1/          Generated Go proto bindings
.design/                 Design documents
```

---

## 4. Platform Adapter Interface

External platform integrations implement `platform.Adapter`
(`internal/platform/platform.go`):

```go
type Adapter interface {
    Platform() string
    SyncCollection(ctx, collectionID, SyncOptions) (SyncResult, error)
    PushTask(ctx, task) (remoteID, error)
    PushComment(ctx, comment, task) (remoteID, error)
}
```

### Sync model

Adapters are proxy-oriented, not migration-oriented. The external
platform remains the source of truth for externally-created tasks:

- **Pull**: `SyncCollection` fetches remote items, maps to NTO fields,
  upserts into the store. `remote_id` + `collection_id` is the dedup
  key. Supports full sync and incremental (`SyncOptions.Since`).
- **Push**: `PushTask` / `PushComment` write local mutations back to
  the platform. Returns the remote ID for linking.
- **Round-trip**: Fields the NTO doesn't model are preserved in
  `remote_data` (JSON). The original platform status is preserved in
  `native_label` for lossless round-trips.

### Platform-specific adapters

| Platform | Package | Status |
|---|---|---|
| GitHub Issues | `internal/platform/github/` | Implemented |
| Linear | — | Planned |
| Jira | — | Planned |
| Asana | — | Planned |

### Capabilities by backend

| Capability | External platforms | Built-in backend |
|---|---|---|
| Task assignment | Serialized writes | Atomic claims (CAS) |
| Dependency scheduling | Read-only graph | Full graph queries + ready-task |
| Graph analytics | Not available | Critical path, bottlenecks |

---

## 5. Auth Model

### Token lifecycle

```
 Agent                           Farm Table
   │                                │
   │  Authorization: Bearer <raw>   │
   │───────────────────────────────►│
   │                                ├── hash = SHA-256(raw)
   │                                ├── lookup hash in api_tokens table
   │                                ├── check expiry
   │                                ├── inject user_id into gRPC context
   │                                │   (async: update last_used_at)
   │         response               │
   │◄───────────────────────────────│
```

Implemented as a gRPC `UnaryServerInterceptor` in
`internal/server/auth.go`. Raw tokens are never stored — only the
SHA-256 hash. Token creation returns the raw token exactly once.

### TokenLookup interface

| Implementation | Use case |
|---|---|
| `StoreTokenLookup` | Production. Queries the database. Supports revocation and expiry. |
| `legacyTokenLookup` | Development. Single static token via `FARMTABLE_TOKEN` env. Constant-time comparison. |

### Embedded auto-identity

In embedded mode no manual auth setup is needed. On first startup
`ensureLocalUser()` creates an agent user and API token, saves the raw
token to `~/.config/farmtable/config.toml`. Subsequent CLI calls
attach it automatically.

### Actor tracking

The authenticated user ID propagates from the auth interceptor through
server handlers into store mutations. `UpdateTask`, `ClaimTask`, and
`CloseTask` accept an `actorID` parameter, written to Change records
for audit attribution.

---

## 6. Graph Queries

Five graph RPCs operate on `blocks`/`blocked_by` relationships.
Implemented in `internal/server/server.go`.

### GetReadyTasks

Returns actionable tasks: in `ready` stage (or optionally any unblocked
open task) with no unresolved blockers. The store query finds tasks
whose `blocked_by` relationships all point to closed tasks. Response
includes `blockers_resolved` count so agents can prioritize recently
unblocked work.

Filters: `collection_id`, `assignee` (UUID or `"none"`), `min_priority`.

### GetBlockedTasks

Returns tasks with at least one unresolved blocker. For each blocked
task the response includes a `BlockerInfo` list: each blocker's ID,
name, phase, and stage — so agents know what to unblock.

### GetDependencyTree

Recursive traversal from a root task. Returns a tree of
`DependencyNode` messages, each containing the task and its downstream
(`blocks`) and upstream (`blocked_by`) children.

- `direction`: `UP` | `DOWN` | `BOTH` (default)
- `max_depth`: 1–20, default 5
- Cycle-safe via visited set

### GetCriticalPath

Longest blocking chain in a collection — the path that determines
minimum completion time. DFS from every non-closed task (or a specified
root), tracking the longest `blocks` chain. Reports the highest fan-out
node on the path as a bottleneck hint.

Bounded: 500 open tasks per collection, depth 50.

### GetBottlenecks

Tasks with the most downstream dependents. For each task that blocks
others, `countDownstream` recursively counts all transitive dependents.
Sorted by downstream count descending.

Same bounds: 500 tasks, depth 50.

### Edge traversal pattern

Relationships are stored as `(source, target, type)`. A `blocks`
relationship appears as a `source_relationship` on the blocker and a
`target_relationship` on the blocked task — but `blocked_by` reverses
this. All graph code checks both edge sets:

```go
for _, rel := range t.Edges.SourceRelationships {
    if rel.Type == "blocks" { /* follow rel.TargetTaskID */ }
}
for _, rel := range t.Edges.TargetRelationships {
    if rel.Type == "blocked_by" { /* follow rel.SourceTaskID */ }
}
```

---

## 7. MCP Adapter

`ft mcp serve` exposes Farm Table as tools via the
[Model Context Protocol](https://modelcontextprotocol.io/), allowing
MCP-aware agents to discover and invoke Farm Table operations through
tool-based interaction.

### Architecture

```
Agent/Framework ──stdio──► MCP Server (mcp-go library)
                               │
                               ▼
                          mcp.Server (internal/mcp/server.go)
                          10 registered tool handlers
                               │
                               ▼
                          FarmTableServiceClient (gRPC)
                               │
                       ┌───────┴────────┐
                       │                │
                    bufconn          gRPC/TCP
                  (embedded)      (client-server)
```

The MCP server wraps a `FarmTableServiceClient`. It connects via
bufconn in embedded mode or TCP in client-server mode — same as the
CLI. A `ClientFactory` function is injected at construction time to
abstract the connection setup.

### Tools (10)

| Tool | Maps to RPC | Description |
|---|---|---|
| `task_list` | `ListTasks` | List tasks with filters, sorting, pagination |
| `task_get` | `GetTask` | Full details with optional comments and changes |
| `task_create` | `CreateTask` | Create with all NTO fields |
| `task_update` | `UpdateTask` | Partial update: fields, labels, relationships |
| `task_claim` | `ClaimTask` | Atomic claim → working stage |
| `task_close` | `CloseTask` | Close with stage (completed, wont_fix, ...) |
| `task_search` | `ListTasks` | Name substring search (client-side filter) |
| `task_tree` | `GetDependencyTree` | Dependency tree traversal |
| `task_ready` | `GetReadyTasks` | Unblocked tasks ready to work on |
| `task_critical_path` | `GetCriticalPath` | Longest dependency chain |

Each handler parses `CallToolRequest` arguments, maps to gRPC request
types, calls the underlying client, and returns JSON. The adapter
handles collection auto-resolution (single-collection shortcut), enum
parsing, date parsing, and auth context propagation.

The MCP server is a pure translation layer — no business logic. All
validation, auth, and persistence happen in the gRPC service below.

---

## Data Model Summary

```
Collection 1───────* Task 1───────* Comment
                      │
                      ├───────* Relationship (source/target → Task)
                      │
                      ├───────* Change (audit trail)
                      │
                      └───────? parent Task (hierarchy)

User 1───────* ApiToken
  │
  └───────* Task (via assignee_id)
```

Eight Ent entities defined in `internal/store/schema/`. Generated code
in `internal/store/ent/`. Regenerate after schema changes:
`go generate ./internal/store/ent`.

### Store interface

`Store` (`internal/store/store.go`) defines all data access. `EntStore`
is the sole implementation, dialect-agnostic via Ent's builder API.

**Optimistic locking.** Tasks carry a `version` field (monotonic integer
as string). `Update`, `Claim`, and `Close` take a version parameter.
Mismatch → `ErrConflict` → gRPC `Aborted`. Agents re-read and retry.

**Pagination.** List operations use cursor-based (keyset) pagination:
cursor encodes `(LastID, LastSortValue)` as base64 JSON. Graph queries
use offset-based pagination since results are computed in-memory.

---

## Building and Testing

```bash
go build ./...                       # build everything
go test ./...                        # all tests — no Postgres needed
go generate ./internal/store/ent     # regenerate Ent after schema changes
go build -o bin/ft ./cmd/ft          # build the CLI
```

All tests use in-memory SQLite via `internal/testutil/` helpers:

- `NewTestStore()` — in-memory EntStore with auto-migration
- `NewTestServer()` — bufconn gRPC server + client for RPC round-trips
