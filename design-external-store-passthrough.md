# Design: External Task Store — Category 1 (Server-Side Passthrough)

**Date:** 2026-07-20
**Author:** Architect agent
**Status:** Draft for review
**Scope:** Medium (3 implementation phases)
**Predecessor:** Discussion doc at `reports/design-external-store-brainstorm.md`

---

## Problem & Goals

Farmtable users want to view tasks from external systems (GitHub Issues, Linear, Jira) inside the Farmtable board without leaving the Farmtable UI. Today, this only works via a CLI-only passthrough mode (`FARMTABLE_GITHUB_REPO` env var) that runs an in-process gRPC server — it cannot be used from the deployed Cloud Run dashboard.

**This design delivers Category 1: a server-side API dialect shim** that proxies external task stores through Farmtable's gRPC API. External tasks appear as native Farmtable tasks in the board, Inspector, and (where applicable) graph queries — with always-fresh data fetched on demand from the external API.

### Success Criteria

1. A user can create a GitHub-platform collection on the live server, providing a repository identifier and credentials.
2. The Farmtable dashboard renders GitHub issues as task cards on the Kanban board — grouped by stage, with title, assignee, priority, and labels visible.
3. Graph queries (GetReadyTasks, GetBlockedTasks, GetCriticalPath, GetBottlenecks) work for external collections that have relationship structure (e.g., GitHub sub-issues), using an ephemeral in-memory SQLite store.
4. Data is always fresh — every query fetches from the external API. No sync infrastructure, no staleness.
5. The architecture is **replaceable**: when Category 4 (full mirror + live sync) is built, the passthrough code path for synced collections retires cleanly.

---

## Non-Goals

- **Sync infrastructure.** No background sync, no polling, no webhooks. That is Category 4 (future work).
- **WatchTasks for external collections.** Live streaming requires local state mutation events. The UI falls back to manual refresh or poll-on-interval for external collections.
- **Write path.** External tasks are read-only in v1. No editing, no commenting, no status changes from Farmtable.
- **Multi-platform abstraction.** This design targets GitHub as the first platform. The architecture supports additional platforms, but the generic adapter abstraction is deferred until a second platform is implemented.
- **Credential management UI.** Credentials are stored server-side but managed via CLI or direct API for v1. A dashboard UI for linking accounts is future work.

---

## Proposed Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Farmtable Server                       │
│                                                          │
│  ┌──────────────┐     ┌───────────────────────────────┐ │
│  │  gRPC Service │────▶│     MultiStore (router)       │ │
│  │  (server.go)  │     │                               │ │
│  └──────────────┘     │  platform == "farmtable"       │ │
│         │              │    └─▶ EntStore (Postgres)     │ │
│         │              │                               │ │
│         │              │  platform == "github"          │ │
│         │              │    └─▶ PassThroughStore ──────▶│─┼──▶ GitHub API
│         │              │                               │ │
│         │              │  platform == "linear" (future) │ │
│         │              │    └─▶ LinearPassThrough ─────▶│─┼──▶ Linear API
│         │              └───────────────────────────────┘ │
│         │                                                │
│         │   Graph queries (when collection.graph = true)  │
│         │              ┌───────────────────────┐         │
│         └─────────────▶│ Ephemeral SQLite      │         │
│                        │ (in-memory, per-req)  │         │
│                        │  - pre-migrated pool  │         │
│                        │  - load tasks + rels  │         │
│                        │  - run graph query    │         │
│                        │  - discard            │         │
│                        └───────────────────────┘         │
└─────────────────────────────────────────────────────────┘
```

### Component 1: MultiStore (Platform-Based Store Router)

The server currently takes a single `store.Store` dependency. To support multiple backends, introduce a `MultiStore` that routes operations based on the target collection's platform.

```go
// internal/store/multistore.go (pseudocode)

type MultiStore struct {
    primary   Store                          // EntStore (Postgres) — for farmtable-platform collections + shared entities (users, tokens)
    platforms map[string]Store               // platform name → passthrough store
    resolver  func(uuid.UUID) (string, error) // collection ID → platform lookup
}

// Route task operations to the appropriate store
func (m *MultiStore) ListTasks(ctx context.Context, p ListTasksParams) ([]*ent.Task, int, error) {
    if p.CollectionID != nil {
        platform, _ := m.resolver(*p.CollectionID)
        if s, ok := m.platforms[platform]; ok {
            return s.ListTasks(ctx, p)
        }
    }
    return m.primary.ListTasks(ctx, p)
}

// Shared entities always go to the primary store
func (m *MultiStore) CreateUser(ctx context.Context, p CreateUserParams) (*ent.User, error) {
    return m.primary.CreateUser(ctx, p)
}

func (m *MultiStore) LookupToken(ctx context.Context, hash string) (*ent.ApiToken, error) {
    return m.primary.LookupToken(ctx, hash)
}
```

**Design decisions:**

- **Collection metadata lives in the primary store (Postgres).** `CreateCollection`, `ListCollections`, `GetCollection`, `UpdateCollection` always route to `EntStore`. The collection row stores platform, remote_id, and settings — the passthrough store uses this metadata but doesn't store it.
- **User and token operations always route to the primary store.** These are Farmtable-global entities, not per-platform.
- **Task, comment, and relationship operations route by collection ID.** The resolver looks up the collection's platform from the primary store (cached after first lookup per request or with a short TTL).
- **The MultiStore implements the full Store interface.** Operations that don't apply to a passthrough store (e.g., `ImportCollection`, `CreateAPIToken`) delegate to the primary store unconditionally.

**Platform store registration** happens at server startup:

```go
// cmd/farmtable-server/main.go (pseudocode)

primary, _ := store.NewEntStore(ctx, pgOpts)
multi := store.NewMultiStore(primary)

// Register platform stores from linked accounts
accounts, _ := primary.ListLinkedAccounts(ctx)
for _, acct := range accounts {
    switch acct.Platform {
    case "github":
        owner, repo := parseGitHubRemoteID(acct.RemoteID)
        ps := github.NewPassThroughStore(acct.Token, owner, repo, nil)
        multi.RegisterPlatform(acct.CollectionID, "github", ps)
    }
}

svc := server.NewFarmTableService(multi, version, server.WithEventBus(eb))
```

**Alternative considered:** A per-RPC `if collection.Platform != "farmtable" { ... }` check in every server handler. Rejected: scatters platform routing across 30+ handlers. The MultiStore centralizes routing at the Store interface boundary, which is the natural abstraction point.

### Component 2: Credential Storage (LinkedAccount)

The LinkedAccount proto message exists but has no Ent schema or server RPCs. Add both.

**Ent schema:**

```go
// internal/store/schema/linkedaccount.go (pseudocode)

func (LinkedAccount) Fields() []ent.Field {
    return []ent.Field{
        field.UUID("id", uuid.UUID{}).Default(uuid.New),
        field.UUID("collection_id", uuid.UUID{}),           // 1:1 with a collection
        field.Enum("platform").Values("github", "linear", "jira", "asana", "beads"),
        field.String("auth_token").Sensitive(),               // Encrypted PAT or OAuth token
        field.Enum("auth_method").Values("pat", "oauth", "github_app"),
        field.JSON("scopes", []string{}).Optional(),
        field.String("remote_user_id").Optional().Default(""),
        field.Enum("status").Values("active", "expired", "revoked").Default("active"),
        field.Time("created_at").Default(timeNow).Immutable(),
        field.Time("expires_at").Optional().Nillable(),
    }
}
```

**Server RPCs** (minimal for v1):

```protobuf
rpc CreateLinkedAccount(CreateLinkedAccountRequest) returns (LinkedAccount);
rpc GetLinkedAccount(GetLinkedAccountRequest) returns (LinkedAccount);
rpc DeleteLinkedAccount(DeleteLinkedAccountRequest) returns (google.protobuf.Empty);
```

**CLI surface:**

```bash
ft collection link github \
  --collection <id> \
  --token <github-pat> \
  --repo owner/repo

ft collection unlink <collection-id>
```

**Credential security:**
- Tokens are encrypted at rest using a server-side encryption key (from environment variable or secret manager).
- Tokens are never included in `GetCollection` or `ListCollections` responses.
- The CLI `link` command accepts `--token` from a flag, env var, or stdin (for piping from a secret manager).

### Component 3: Ephemeral SQLite for Graph Queries

Graph queries (GetReadyTasks, GetBlockedTasks, GetCriticalPath, GetBottlenecks) require relationship traversal via SQL joins. The passthrough store doesn't have a database. Solution: load fetched tasks into a throwaway in-memory SQLite EntStore and run the existing graph query code against it.

**Pre-Migrated Template Pool:**

Creating an in-memory SQLite database and running Ent auto-migration takes ~10-50ms. To avoid this per-request cost, maintain a pool of pre-migrated empty databases:

```go
// internal/store/ephemeral.go (pseudocode)

type EphemeralStorePool struct {
    mu       sync.Mutex
    pool     []*EntStore        // pre-migrated, empty, ready to use
    maxSize  int                // pool capacity (e.g., 8)
}

// Get returns a pre-migrated in-memory EntStore ready for loading.
// If the pool is empty, creates and migrates a new one.
func (p *EphemeralStorePool) Get(ctx context.Context) (*EntStore, error) {
    p.mu.Lock()
    if len(p.pool) > 0 {
        s := p.pool[len(p.pool)-1]
        p.pool = p.pool[:len(p.pool)-1]
        p.mu.Unlock()
        return s, nil
    }
    p.mu.Unlock()
    return store.NewEntStore(ctx, store.StoreOptions{
        Dialect: "sqlite3",
        DSN:     "file::memory:?_fk=1",
        Migrate: true,
    })
}

// Return wipes the database and returns it to the pool.
// If the pool is full, closes the store instead.
func (p *EphemeralStorePool) Return(s *EntStore) {
    // DELETE FROM tasks; DELETE FROM relationships; etc.
    // (cheaper than recreating + migrating)
    s.Truncate()
    p.mu.Lock()
    defer p.mu.Unlock()
    if len(p.pool) < p.maxSize {
        p.pool = append(p.pool, s)
    } else {
        s.Close()
    }
}
```

**Graph query flow:**

```go
// internal/server/server.go — GetCriticalPath handler (pseudocode)

func (s *FarmTableService) GetCriticalPath(ctx context.Context, req *pb.GetCriticalPathRequest) (*pb.GetCriticalPathResponse, error) {
    coll, _ := s.store.GetCollection(ctx, collectionID)

    if coll.Platform == "farmtable" {
        // Native collection — use primary store directly (existing code path)
        return s.getCriticalPathFromStore(ctx, req)
    }

    // External collection — check if graph queries are enabled
    if !collectionSupportsGraph(coll) {
        return nil, status.Errorf(codes.Unimplemented,
            "graph queries not available for %s collections without relationship support", coll.Platform)
    }

    // Fetch all tasks from external API
    tasks, _, _ := s.store.ListTasks(ctx, store.ListTasksParams{CollectionID: &coll.ID, Limit: 5000})

    // Load into ephemeral SQLite
    ephemeral, _ := s.ephemeralPool.Get(ctx)
    defer s.ephemeralPool.Return(ephemeral)

    tempColl, _ := ephemeral.CreateCollection(ctx, store.CreateCollectionParams{Name: coll.Name, Platform: coll.Platform})
    for _, t := range tasks {
        t.CollectionID = tempColl.ID
        ephemeral.CreateTask(ctx, taskToCreateParams(t))
    }
    // Also load relationships (from task edges or remote_data)
    for _, t := range tasks {
        for _, rel := range extractRelationships(t) {
            ephemeral.CreateRelationship(ctx, rel)
        }
    }

    // Run existing graph query against ephemeral store
    tempSvc := server.NewFarmTableService(ephemeral, s.version)
    return tempSvc.GetCriticalPath(ctx, req)
}
```

**Per-collection graph setting:**

Not all external sources have relationship structure. A Jira project with no issue links, or a simple GitHub repo with no sub-issues, gains nothing from the ephemeral SQLite path. The graph query capability is controlled by a per-collection setting:

```go
// Derived from collection.remote_data or a dedicated field
func collectionSupportsGraph(coll *ent.Collection) bool {
    // Default per platform:
    //   github: true (has sub-issues)
    //   linear: true (has relations)
    //   jira:   true (has issue links)
    //   asana:  false (no native task relationships)
    //
    // Override via collection remote_data:
    //   {"graph_queries": false}  — disable even for platforms that support it
    //   {"graph_queries": true}   — enable (no-op if platform default is true)
}
```

**Storage mechanism for the setting:** Add a `remote_data` JSON field to the Collection Ent schema (it already exists in the proto but is not persisted in the database). This field stores per-collection configuration including `graph_queries` (bool), and can be extended for future platform-specific settings without schema migrations.

```go
// Addition to internal/store/schema/collection.go
field.JSON("remote_data", map[string]any{}).Optional(),
```

### Component 4: Passthrough Store Enhancements

The existing `GitHubPassThroughStore` implements the `Store` interface but was designed for CLI-only use. Adjustments for server-side use:

**a. Remove the hardcoded collection ID.**
Currently, `collectionID` is a deterministic UUID from `"github:owner/repo"`. In server mode, the collection ID comes from the Postgres collection row. The passthrough store needs to accept the collection ID as a constructor parameter.

```go
func NewPassThroughStore(token, owner, repo string, collectionID uuid.UUID, cfg *GitHubConfig) *GitHubPassThroughStore {
    // ...
    return &GitHubPassThroughStore{
        // ...
        collectionID: collectionID,  // was: deterministicUUID(...)
    }
}
```

**b. Set `platform` correctly on returned tasks.**
The `taskToProto` converter in `convert.go` currently hardcodes `Platform: PLATFORM_FARMTABLE`. For passthrough tasks, this must reflect the actual platform. The passthrough store already sets `CollectionID` on each task — the conversion layer should derive the platform from the collection, not hardcode it.

**c. Collection CRUD operations delegate to the primary store.**
The passthrough store's `CreateCollection`, `GetCollection`, `ListCollections` methods should not be called directly — the MultiStore routes these to the primary store. The passthrough store can either leave these as no-ops or panic-on-call (they should never be reached).

**d. Unimplemented operations return proper gRPC errors.**
Methods that don't apply to external collections (e.g., `ImportCollection`, `CreateAPIToken`, `ListChanges`) return `codes.Unimplemented` with a clear message rather than silently returning empty results.

### Component 5: UI Adaptations (Minimal)

The dashboard requires minimal changes for Cat 1:

**a. Collection selector.**
The UI currently auto-selects the first collection. For external collections to be useful, users need to switch between collections. A `<sl-select>` dropdown in the toolbar, populated from `ListCollections`, with the current collection highlighted.

**b. Read-only indicator.**
When viewing an external-platform collection, disable edit controls (task title edit, stage drag-to-move, comment box, etc.). Show a small badge or tooltip: "This collection is read-only — changes must be made in [GitHub/Linear/Jira]."

**c. "View in [Platform]" link.**
The Inspector already has a `remote_url` concept. For external tasks, show a prominent "View in GitHub" link that opens the issue in a new tab. (The experiment report confirms this link already renders for GitHub-platform collections.)

**d. Loading state for API-proxied data.**
Since every board load fetches from the external API (no local cache), the UI should show a loading spinner/skeleton while the passthrough request is in flight. For native collections this is near-instant (local DB); for external collections it may take 500ms-2s.

**e. No WatchTasks.**
WatchTasks is disabled for external collections. The UI should not open a WatchTasks stream for external collections. Instead, provide a manual "Refresh" button and/or an auto-poll interval (configurable, default 60s).

---

## Alternatives Considered

### Alternative 1: Category 2 — Minimal Metadata Sync (DISCARDED)

**What:** Proactively sync only board-rendering fields (title, phase, stage, priority, assignee, labels) into skeleton Task rows. Lazy-load full task detail on Inspector open.

**Why discarded:**
- **Sync infrastructure cost is the same as full sync.** Whether you sync 5 fields or 25, you need a sync scheduler, staleness detection, conflict handling, and error recovery. The per-field marginal cost is near-zero.
- **Introduces partial-object complexity.** Every code path that reads `task.Description` must handle "not yet fetched" — a new null-vs-empty ambiguity that leaks through the Store interface, proto conversion, and frontend TaskStore.
- **External APIs return full objects anyway.** GitHub's list-issues endpoint returns title, body, state, labels, assignees in one response. You can't request a subset. Discarding the description after fetching it saves nothing on the API side.
- **Storage savings are negligible.** A 1000-issue repo fully synced is ~3MB of task rows. The thin index of the same 1000 issues is ~1MB. You save 2MB at the cost of significant stack-wide complexity.
- **Sits in the "valley of diminishing returns."** Pays the sync tax (staleness, infrastructure) without the payoff that justifies it (fresh data via live sync). The coherent positions are bimodal: no sync (Cat 1) or full sync with live updates (Cat 4).

**Decision:** Skip entirely. If sync is worth building, build it right (Cat 4). If not, the passthrough (Cat 1) delivers value without sync.

### Alternative 2: Category 3 — Full Data Mirror Without Live Sync (DISCARDED)

**What:** Sync all task fields from the external store into full Postgres Task rows. Refresh via periodic polling (1-5 min interval). Lazy-load comments.

**Why discarded:**
- **Same sync infrastructure cost as Cat 4, without the freshness.** Polling introduces a staleness window of up to N minutes. Users see stale data on the board and must wait for the next sync to see external changes.
- **Throwaway stepping stone.** The polling-based sync would be replaced by webhook-driven sync (Cat 4) once built. Building Cat 3 as a waypoint means building infrastructure you'll retire.
- **The "valley" problem.** Cat 3 is marginally better than Cat 2 (full query capability vs. partial) but fundamentally shares the same flaw: sync without freshness. The investment in sync infrastructure is only justified if it comes with live updates.

**Decision:** Skip. Go from Cat 1 (no sync, always fresh) directly to Cat 4 (full sync, live updates via webhooks) when ready to invest.

### Decision Log

| ID | Decision | Rationale | Reversibility |
|----|----------|-----------|---------------|
| D1 | Cat 1 first, Cat 4 as future destination | Bimodal spectrum — middle categories have poor complexity/benefit ratio | Easy — Cat 1 is designed to be replaced by Cat 4, not extended |
| D2 | Skip Cat 2 (thin index) | Same sync cost as full sync, adds partial-object complexity, negligible storage savings | Easy — never built |
| D3 | Skip Cat 3 (full mirror, no live sync) | Throwaway stepping stone — polling sync replaced by webhooks in Cat 4 | Easy — never built |
| D4 | MultiStore router at Store interface | Centralizes routing vs. per-handler if/else | Medium — Store interface is load-bearing; changing the routing pattern later touches many call sites |
| D5 | Ephemeral in-memory SQLite for graph queries | Reuses existing graph code without production DB impact | Easy — can be replaced by direct Postgres queries when Cat 4 stores tasks locally |
| D6 | Per-collection graph setting via remote_data | Avoids wasted ephemeral DB loading for sources without relationships | Easy — additive field, no schema coupling |
| D7 | Passthrough store gets collection ID from Postgres row | Decouples from deterministic UUID generation | Easy — constructor parameter change |
| D8 | Read-only for v1 | Simplest correct behavior; write path is a separate design decision | Easy — additive to unlock later |

---

## Migration / Rollout

This feature is entirely additive. No existing behavior changes. External-platform collections are a new capability layered alongside the existing farmtable-platform behavior.

**Rollout sequence:**

1. **Phase A** lands the MultiStore, LinkedAccount schema + RPCs, and CLI `collection link` command. The server can accept external collections but the passthrough store is not yet wired.
2. **Phase B** moves the passthrough store server-side and wires it through MultiStore. External collections return live data. The dashboard shows external tasks.
3. **Phase C** adds the ephemeral SQLite pool and graph query support for external collections. UI adaptations (collection selector, read-only indicator, refresh button).

Each phase is independently deployable. Phase B depends on Phase A. Phase C depends on Phase B. The phases can be separate PRs and deploys.

**Backward compatibility:** Existing farmtable-platform collections are unaffected. The MultiStore routes all farmtable-platform operations to the same EntStore they use today. The new code paths only activate for non-farmtable platform collections.

---

## Open Questions

1. **Token encryption.** What encryption mechanism for stored PATs? Options: (a) application-level AES-256-GCM with key from env var, (b) Cloud KMS envelope encryption, (c) store tokens in Secret Manager and reference by ID. Recommendation: (a) for v1, upgrade to (b) if needed.

2. **Collection selector UX.** Should external collections appear in the same dropdown as native collections, or in a separate "External Sources" section? If the user has 1 native collection and 3 GitHub repos linked, the dropdown could get noisy.

3. **Rate limiting.** GitHub API allows 5000 requests/hour with a PAT. A board with 4 stage columns and 200 issues makes ~1 ListTasks call per board load. At 60s auto-refresh, that's 60 calls/hour — well within limits. But graph queries add another full-list fetch. Should we show remaining rate limit budget to the user?

4. **Passthrough store lifecycle.** When should the server construct passthrough store instances? Options: (a) eagerly at startup from all linked accounts, (b) lazily on first request per collection, (c) per-request (no caching). Recommendation: (b) lazy construction with an LRU cache. Avoids startup cost for rarely-used collections while keeping warm instances for active ones.

5. **Error UX for expired/revoked tokens.** When a linked account's token is rejected by the external API (401), how is this surfaced? The board should show an actionable error ("GitHub credentials expired — re-link this collection") rather than a generic "Failed to load tasks."

---

## Implementation Phases

### Phase A: Infrastructure (MultiStore + LinkedAccount + CLI)

**Summary:** Add the MultiStore router, LinkedAccount Ent schema and server RPCs, and the `ft collection link` CLI command. No external data flows yet — this is plumbing.

**Scope:**
- `internal/store/multistore.go` — MultiStore implementation wrapping the primary EntStore. Initially routes everything to primary (no platform stores registered).
- `internal/store/schema/linkedaccount.go` — Ent schema for credential storage.
- Add `remote_data` JSON field to Collection Ent schema (for per-collection settings like `graph_queries`).
- `internal/server/server.go` — LinkedAccount CRUD RPCs (Create, Get, Delete).
- `internal/cli/collection.go` — `ft collection link` and `ft collection unlink` subcommands.
- `cmd/farmtable-server/main.go` — Construct MultiStore instead of bare EntStore; pass to NewFarmTableService.
- Proto: `CreateLinkedAccountRequest/Response`, `GetLinkedAccountRequest`, `DeleteLinkedAccountRequest` messages + RPC definitions.

**Deliverable:** `ft collection link github --collection <id> --token <pat> --repo owner/repo` stores credentials. No external queries yet.

### Phase B: Server-Side Passthrough (External Tasks on Board)

**Summary:** Move GitHubPassThroughStore to run server-side, wire through MultiStore. External collections return live data. Dashboard shows external tasks.

**Scope:**
- `internal/platform/github/passthrough.go` — Accept `collectionID` as constructor param (remove deterministic UUID). Add platform field to returned tasks.
- `internal/store/multistore.go` — Platform store registration. On first request for an external collection, lazily construct the passthrough store from the linked account credentials.
- `internal/server/convert.go` — Fix `taskToProto` to use actual task platform instead of hardcoding `PLATFORM_FARMTABLE`.
- `internal/server/watch.go` — Return `codes.Unimplemented` for WatchTasks on external collections (with a message suggesting refresh).
- `web/src/components/ft-toolbar.ts` — Collection selector dropdown. Read-only badge for external collections. Manual "Refresh" button.
- `web/src/gen/grpc-client.ts` — Skip WatchTasks for external collections; use poll-on-interval fallback.

**Deliverable:** Select a GitHub collection in the dashboard → see live GitHub issues on the board. Filter by stage/assignee works. Inspector shows full issue detail.

### Phase C: Ephemeral SQLite + Graph Queries

**Summary:** Add the ephemeral in-memory SQLite pool. Graph queries work for external collections with relationship support.

**Scope:**
- `internal/store/ephemeral.go` — EphemeralStorePool: pre-migrated SQLite template, Get/Return/Truncate lifecycle.
- `internal/server/server.go` — Graph query handlers (GetCriticalPath, GetBottlenecks, GetReadyTasks, GetBlockedTasks): detect external collection → fetch tasks → load into ephemeral store → run query → return.
- `internal/server/server.go` — `collectionSupportsGraph()` check using `collection.remote_data["graph_queries"]` with platform-based defaults.
- `cmd/farmtable-server/main.go` — Initialize EphemeralStorePool at startup (pool size configurable, default 4).
- Tests: graph query test with a mock passthrough store feeding into ephemeral SQLite.

**Deliverable:** `ft task ready --collection <github-collection-id>` returns ready tasks computed from GitHub sub-issue relationships.

---

## Acceptance Criteria

### Phase A (Infrastructure)
1. `ft collection link github --collection <id> --token <pat> --repo owner/repo` succeeds and stores a LinkedAccount row.
2. `ft collection unlink <collection-id>` removes the linked account.
3. Linked account tokens are not visible in any Collection response (List, Get).
4. MultiStore routes all operations to the primary EntStore when no platform stores are registered (existing behavior unchanged).
5. Collection `remote_data` field persists and round-trips through Create → Get.

### Phase B (Server-Side Passthrough)
1. Creating a GitHub-platform collection and linking credentials → `ft task list --collection <id>` returns live GitHub issues.
2. Dashboard board renders GitHub issues as cards with title, stage, assignee, priority, labels.
3. Dashboard Inspector shows full issue detail (description, labels, assignee, dates) for external tasks.
4. Filter by phase, stage, labels works for external collections.
5. Tasks from external collections have `platform: github` (not `platform: farmtable`).
6. WatchTasks returns `Unimplemented` for external collections; UI uses poll-on-interval.
7. Edit controls are disabled for external collection tasks.
8. "View in GitHub" link is visible and correct for external tasks.
9. Expired/invalid tokens produce a clear user-facing error, not a generic failure.
10. Existing farmtable-platform collections are completely unaffected.

### Phase C (Graph Queries)
1. `ft task ready --collection <github-collection-id>` returns tasks with no unresolved blockers, computed from GitHub sub-issue relationships.
2. `ft task blocked --collection <github-collection-id>` returns tasks with open blockers.
3. GetCriticalPath and GetBottlenecks return results for external collections with relationship data.
4. Graph queries return `Unimplemented` for external collections where `graph_queries` is disabled (or platform default is false).
5. Ephemeral SQLite instances are pooled and reused (no per-request migration cost after warm-up).
6. Ephemeral data does not leak into the production Postgres database.
7. Concurrent graph queries use isolated in-memory instances (no cross-request contamination).

---

## Future Work: Category 4 (Full Mirror + Live Sync)

> This section is intentionally high-level. Category 4 is a separate design effort.

When the decision is made to invest in full sync infrastructure, the architecture shifts from "passthrough" to "mirror + live sync":

**Core change:** External tasks are materialized as full Postgres Task rows (same table as native tasks). A webhook-driven sync layer keeps them current. The passthrough store is retired for synced collections — the primary EntStore handles all queries.

**Key components (to be designed):**
- **Webhook receiver:** Per-platform HTTP endpoint on Cloud Run. GitHub: `issues` and `sub_issues` events. Validates webhook signatures. Triggers targeted sync for affected issues.
- **Sync engine:** Receives webhook payloads or on-demand triggers. Upserts Task rows from external data. Emits TaskEvents through eventBus (enabling WatchTasks for external collections).
- **Incremental sync:** Uses external API's "updated since" filtering (GitHub: `since` parameter, Linear: `updatedAt` filter) for efficient delta sync. Full sync only on initial collection link or manual re-sync.
- **Write path:** Comments and status changes write-through to external API. Conflict detection via version/ETag comparison. Start with comments (idempotent, low-conflict), then stage changes.
- **Fallback polling:** For platforms without webhook support, or as a consistency check, periodic polling at configurable intervals.

**What carries over from Cat 1:**
- MultiStore (extended to route synced collections through primary EntStore instead of passthrough)
- LinkedAccount (same credential storage)
- Collection `remote_data` settings
- Platform detection and `taskToProto` platform awareness

**What gets retired:**
- Passthrough store usage for synced collections (replaced by local store queries)
- Ephemeral SQLite for graph queries (graph queries run against the primary Postgres store)
- Poll-on-interval UI fallback (WatchTasks works natively)

**Estimated scope:** Large. Per-platform webhook handlers, sync engine, conflict resolution, write-through — each is a medium-sized project. Recommend scoping to GitHub-only first, then generalizing.
