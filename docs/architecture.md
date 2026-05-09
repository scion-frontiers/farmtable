# Farm Table Architecture

Farm Table is a task runtime for AI agents. It gives agents a single,
predictable interface to receive work, query what remains, and track
progress — whether tasks live in GitHub Issues, Linear, Jira, or Farm
Table's own built-in backend.

The system runs in two modes from the same codebase:

- **Embedded** — SQLite, in-process via bufconn. Zero config. One binary,
  no server process, no credentials needed.
- **Client-server** — Postgres, gRPC over TCP. Multi-agent safe with full
  MVCC and row-level locking.

Mode is a connection-time decision in a single function (`newClient` in
`internal/cli/connect.go`). Everything above the wire — CLI commands,
gRPC handlers, store operations — is mode-agnostic.

---

## Layer diagram

```
 ┌──────────────────────────────────────────────────────────┐
 │  Agent (CLI or programmatic gRPC client)                 │
 └────────────────────────┬─────────────────────────────────┘
                          │
 ┌────────────────────────▼─────────────────────────────────┐
 │  CLI layer  (internal/cli/)                              │
 │  Cobra commands: task, collection, comment, user, token  │
 │                                                          │
 │  connect.go ── mode decision:                            │
 │    FARMTABLE_SERVER set? ──► dialServer() ──► TCP gRPC   │
 │    otherwise             ──► startEmbedded() ──► bufconn │
 └────────────────────────┬─────────────────────────────────┘
                          │ pb.FarmTableServiceClient
 ┌────────────────────────▼─────────────────────────────────┐
 │  Server layer  (internal/server/)                        │
 │  FarmTableService: 28 RPC methods                        │
 │  TokenAuthInterceptor ── Bearer token → user ID context  │
 │  convert.go ── Ent entity ↔ proto message translation    │
 └────────────────────────┬─────────────────────────────────┘
 │                        │ store.Store interface
 ┌────────────────────────▼─────────────────────────────────┐
 │  Store layer  (internal/store/)                          │
 │  store.go ── interface (30+ methods)                     │
 │  entstore.go ── EntStore implementation                  │
 │  schema/ ── Ent schema definitions                       │
 └────────────────────────┬─────────────────────────────────┘
                          │ Ent ORM
 ┌────────────────────────▼─────────────────────────────────┐
 │  Database                                                │
 │  SQLite (embedded) or Postgres (server)                  │
 └──────────────────────────────────────────────────────────┘
```

The platform adapter subsystem (`internal/platform/`) sits beside the
store layer. Adapters sync external platforms into the store and push
local mutations back out. See [Platform adapters](#platform-adapter-interface)
below.

---

## Key abstractions

### Normalized Task Object (NTO)

Every task in Farm Table — whether it originated in GitHub, Linear, or
the built-in backend — is represented as a single normalized schema.
The proto definition (`proto/farmtable/v1/farmtable.proto`) is the
source of truth.

Key design choices:

**Three-tier status model.** Status is decomposed into three fields that
serve different audiences:

| Field | Cardinality | Purpose |
|-------|-------------|---------|
| `phase` | 4 values: `open`, `in_progress`, `on_hold`, `closed` | Coarse lifecycle. Agents branch on this. |
| `stage` | 14 values (see below) | Fine-grained position. Humans and dashboards use this. |
| `native_label` | Free text | Verbatim platform status. Preserved for round-trip fidelity. |

Stage determines phase — the mapping is a pure function (`phaseForStage`
in `internal/server/convert.go`):

```
 OPEN         triage → backlog → ready
 IN_PROGRESS  working → in_review → in_qa → deploying
 ON_HOLD      blocked → waiting_for_input → deferred → scheduled
 CLOSED       completed / wont_fix / duplicate / cancelled
```

**Code context.** Tasks carry optional software-development metadata:
`repo`, `branch`, `pull_requests` (id/url/status triples), and
`ci_status` (pending/running/passed/failed). This lives on the task
directly rather than in a separate entity, since it's always loaded
with the task.

**Remote escape hatch.** `remote_id`, `remote_url`, and `remote_data`
(arbitrary JSON) store the original platform representation. Fields the
NTO doesn't model are preserved here for lossless sync.

### Collections

A collection is a 1:1 mapping to a single external integration scope —
one GitHub repo, one Linear team, one Jira project. Every task belongs
to exactly one collection.

The built-in backend uses a `farmtable`-platform collection created
automatically in embedded mode (`ensureDefaultCollection` in
`connect.go`).

### Relationships

Task dependencies are stored as a separate `Relationship` entity with
fields `(source_task_id, target_task_id, type)`. Types:

- `blocks` / `blocked_by` — hard dependencies, used by graph queries
- `relates_to` — informational links
- `duplicates` / `duplicated_by` — duplicate tracking

The entity carries a unique constraint on `(source, target, type)`.
Tasks expose two edge sets — `source_relationships` and
`target_relationships` — so graph traversals can walk edges in both
directions.

### Change audit trail

Every mutation to a task (update, claim, close) records a `Change`
entity: `(task_id, author_id, field_name, old_value, new_value,
created_at)`. The store's `recordChanges` helper diffs the before/after
task states and writes one Change per modified field.

Changes are queryable via `ListChanges`, filterable by field name. This
gives agents and humans a full history of who changed what and when.

---

## Dual-mode design

### Embedded mode

```
ft task list
    │
    ▼
startEmbedded()
    ├── store.NewEntStore(sqlite3, file:~/.farmtable/farmtable.db)
    ├── grpc.NewServer() with TokenAuthInterceptor
    ├── bufconn.Listen()               ◄── in-memory "network"
    ├── go srv.Serve(lis)
    ├── grpc.NewClient("passthrough:///bufconn", ContextDialer → lis)
    └── ensureLocalUser() + ensureDefaultCollection()
```

On first run, `ensureLocalUser` creates a `local` user and API token,
saving the raw token to `~/.config/farmtable/config.toml`. Subsequent
invocations reuse this identity transparently.

SQLite runs in WAL mode with `MaxOpenConns(1)`, foreign keys enabled
via PRAGMA. This is single-writer by design — sufficient for one agent
or local development.

### Client-server mode

```
farmtable-server
    ├── store.NewEntStore(postgres, $FARMTABLE_DB_URL)
    ├── grpc.NewServer() with TokenAuthInterceptor
    └── net.Listen(:50051)

ft --server host:50051 task list
    └── dialServer(host:50051) ──► TLS (or insecure for localhost)
```

Postgres provides MVCC, row-level locks, and concurrent multi-agent
writes. The server binary (`cmd/farmtable-server/`) is the standalone
entry point.

### Mode selection

The decision lives in `newClient` (`internal/cli/connect.go`):

```
if --server flag || FARMTABLE_SERVER env || config.server
    → dial remote TCP
else
    → startEmbedded (bufconn + SQLite)
```

Flag → env → config precedence applies to all resolved values (server,
token, collection, output format).

---

## Auth model

### Token lifecycle

```
 Agent                         Farm Table
   │                              │
   │  Authorization: Bearer <raw> │
   │─────────────────────────────►│
   │                              ├── hash = SHA-256(raw)
   │                              ├── lookup token_hash in api_tokens table
   │                              ├── verify not expired
   │                              ├── inject user_id into gRPC context
   │                              │   (async: update last_used_at)
   │                              │
   │       response               │
   │◄─────────────────────────────│
```

Implemented in `internal/server/auth.go` as a gRPC
`UnaryServerInterceptor`.

Raw tokens are never stored. The `api_tokens` table holds `token_hash`
(SHA-256 hex), linked to a `user_id`. Token creation
(`Store.CreateAPIToken`) returns the raw token exactly once; subsequent
lookups use the hash.

### TokenLookup interface

Two implementations:

| Implementation | Use case |
|----------------|----------|
| `StoreTokenLookup` | Production. Queries the database. Supports revocation and expiry. |
| `legacyTokenLookup` | Development. Single in-memory token. Set via `FARMTABLE_TOKEN` env. |

### Embedded auto-identity

In embedded mode, no explicit auth setup is required. `ensureLocalUser`
creates an agent user and token on first run, persists the raw token to
the config file, and all subsequent CLI calls attach it automatically.

### Actor tracking

The authenticated `user_id` from the token is propagated through the
server layer into store mutations. `UpdateTask`, `ClaimTask`, and
`CloseTask` all accept an `actorID` parameter, which is written to
Change records for audit attribution.

---

## Platform adapter interface

```go
// internal/platform/platform.go

type Adapter interface {
    Platform() string
    SyncCollection(ctx context.Context, collectionID uuid.UUID, opts SyncOptions) (SyncResult, error)
    PushTask(ctx context.Context, task *ent.Task) (remoteID string, err error)
    PushComment(ctx context.Context, comment *ent.Comment, task *ent.Task) (remoteID string, err error)
}

type SyncOptions struct {
    FullSync bool
    Since    *time.Time
}

type SyncResult struct {
    Created int
    Updated int
    Errors  int
}
```

### Sync model

Adapters are proxy-oriented, not migration-oriented. The external
platform remains the source of truth for externally-created tasks:

1. **Pull**: `SyncCollection` fetches remote items, maps them to NTO
   fields, and upserts into the store. `remote_id` + `collection_id`
   is the dedup key.
2. **Push**: `PushTask` / `PushComment` write local mutations back to
   the platform. Returns the remote ID for linking.
3. **Incremental**: `SyncOptions.Since` limits sync to recently
   modified items. `FullSync` forces a complete re-read.

### Remote data round-trip

Fields the NTO doesn't cover are preserved in `remote_data` (JSON).
The original platform status is preserved in `native_label`. This
allows lossless round-trips: Farm Table can read a GitHub issue, modify
its stage, and push it back without losing GitHub-specific metadata.

### Current status

The `platform.Adapter` interface is defined and the `internal/platform/`
package is scaffolded. The GitHub adapter is in progress. Linear, Jira,
and Asana adapters are planned.

---

## Graph queries

The relationship edges enable five graph-aware RPCs. All operate on
the `blocks`/`blocked_by` relationship types.

### GetReadyTasks

Returns tasks that are actionable: in `ready` stage (or optionally any
unblocked `open` task) with no unresolved blockers.

The store query finds tasks whose `blocked_by` relationships all point
to closed tasks. Response includes `blockers_resolved` count so agents
can prioritize recently unblocked work.

Filters: `collection_id`, `assignee` (UUID or `"none"`), `min_priority`.

### GetBlockedTasks

Returns tasks that cannot proceed, with full blocker details. For each
blocked task, the response includes a `BlockerInfo` list with each
blocker's ID, name, phase, and stage — so agents know what to unblock.

Filters: `collection_id`, `assignee`.

### GetDependencyTree

Recursive traversal from a root task. Returns a tree of
`DependencyNode` messages, each containing the task and its
`blocks`/`blocked_by` children.

Parameters:
- `direction`: `UP` (follow blocked_by), `DOWN` (follow blocks), `BOTH`
- `max_depth`: 1–20, default 5

The traversal uses a `visited` set to handle cycles. It walks both
`source_relationships` and `target_relationships` edges to find
connections regardless of which side stored the relationship.

### GetCriticalPath

Finds the longest blocking chain in a collection — the sequence of
tasks where each blocks the next, representing the path that determines
minimum completion time.

Algorithm: DFS from every non-closed task (or a specified root),
tracking the longest `blocks` chain via `findLongestBlocksChain`. Uses
an `onStack` set for cycle detection. Capped at depth 50 and 500 open
tasks per collection.

The response includes the path nodes and the highest fan-out task along
the path as a bottleneck hint.

### GetBottlenecks

Identifies tasks with the most downstream dependents. For each task
that blocks others, `countDownstream` recursively counts all transitive
dependents.

Results are sorted by downstream count descending. This tells agents
which tasks, if completed, would unblock the most work.

Same limits apply: 500 open tasks max, depth 50.

### Edge traversal pattern

All graph queries must traverse both edge directions because
relationships are stored as `(source, target, type)`. A `blocks`
relationship appears as a `source_relationship` on the blocker and a
`target_relationship` on the blocked task — but a `blocked_by`
relationship reverses this. The server code checks both edge sets:

```go
// "blocks" edges: source→target via SourceRelationships
for _, rel := range t.Edges.SourceRelationships {
    if rel.Type == "blocks" { /* follow rel.TargetTaskID */ }
}
// "blocked_by" edges stored on target: target→source via TargetRelationships
for _, rel := range t.Edges.TargetRelationships {
    if rel.Type == "blocked_by" { /* follow rel.SourceTaskID */ }
}
```

---

## Store interface

The `Store` interface (`internal/store/store.go`) defines all data
access. `EntStore` (`internal/store/entstore.go`) is the sole
implementation, built on the Ent ORM.

Key operations grouped by entity:

| Entity | Operations |
|--------|------------|
| Task | `Create`, `Get`, `List`, `Update`, `Claim`, `Close` |
| Collection | `Create`, `Get`, `List` |
| Comment | `Add`, `Get`, `List` |
| Change | `List` (read-only — writes happen internally via `recordChanges`) |
| User | `Create`, `Get`, `GetByName`, `List` |
| ApiToken | `Create`, `Lookup`, `List`, `Revoke`, `UpdateLastUsed` |
| Graph | `GetReadyTasks`, `GetBlockedTasks` |

### Optimistic locking

Tasks carry a `version` field (monotonic integer as string). `Update`,
`Claim`, and `Close` take a version parameter. If the provided version
doesn't match the current value, the store returns `ErrConflict` (mapped
to gRPC `Aborted`). Agents must re-read and retry.

### Pagination

List operations use cursor-based (keyset) pagination. The cursor
encodes `(LastID, LastSortValue)` as base64 JSON. The query uses
`WHERE (sort_field, id) > (last_sort_value, last_id)` to resume
efficiently. Graph queries use offset-based pagination since their
result sets are computed in-memory.

---

## Ent schema

Eight entity types defined in `internal/store/schema/`:

```
Task ──────┬──► Collection
           ├──► Task (parent/children)
           ├──► Comment (1:many)
           ├──► Change (1:many, cascade delete)
           └──► Relationship (source_relationships, target_relationships)

User ──────┬──► ApiToken (1:many)

Relationship ── (source_task_id, target_task_id, type)
                unique on (source, target, type)
```

Schema regeneration: `go generate ./internal/store/ent`

---

## Directory layout

```
cmd/
  ft/                    CLI binary entry point
  farmtable-server/      Standalone gRPC server entry point
internal/
  cli/                   Cobra commands + connect.go (mode decision)
  server/                gRPC handlers, auth, proto conversion
  store/                 Store interface + EntStore implementation
    schema/              Ent entity definitions
    ent/                 Generated Ent code
  platform/              Adapter interface + platform implementations
  testutil/              Test harnesses (in-memory SQLite + bufconn)
proto/
  farmtable/v1/          Proto definitions (source of truth)
api/
  farmtable/v1/          Generated Go proto bindings
.design/                 Design documents
docs/                    This document
```

---

## Testing

All tests run against in-memory SQLite — no Postgres required.

`internal/testutil/` provides two harnesses:

- `NewTestStore()` — creates an EntStore backed by `file::memory:?cache=shared`,
  runs migrations, returns a cleanup function.
- `NewTestServer()` — wraps `NewTestStore`, stands up a gRPC server on
  bufconn, returns a `FarmTableServiceClient` ready to call.

Test coverage spans store-layer CRUD, version conflict handling,
relationship creation, change recording, and server-layer RPC
round-trips including pagination and error codes.

```
go test ./...
```
