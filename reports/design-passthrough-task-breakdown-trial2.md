# Task Breakdown: External Store Passthrough (Cat 1) Design

**Date:** 2026-07-20
**Collection:** `ext-store-passthrough-design` (ID: `11f2f0ec-6cf2-4a1e-86f8-333d08d031d5`)
**Source design:** `/scion-volumes/scratchpad/projects/farmtable/design-external-store-passthrough.md`
**Server:** `farmtable-qo7k5fvpda-uc.a.run.app:443`

---

## Summary

- **23 active tasks** (3 phase epics + 20 implementable leaf tasks)
- **3 phases** matching the design's rollout sequence: A (Infrastructure), B (Server-Side Passthrough), C (Ephemeral SQLite + Graph Queries)
- **7 tasks** can start immediately in parallel (no unmet dependencies)
- **Dependency graph** uses `BLOCKED_BY` relationships to encode execution ordering — not phase-level gating, but precise per-task dependencies

---

## Decomposition Approach

### Grouping logic
Tasks are grouped under three epic parents matching the design's three independently-deployable phases. Within each phase, tasks are scoped by component (store, schema, proto, server, CLI, UI, platform) rather than by file, because several design components touch multiple files and a file-level split would create artificial coupling.

### Dependency precision
Rather than blanket "Phase B depends on Phase A", dependencies are narrowed to the specific tasks that actually produce the artifact a downstream task needs. For example:
- The CLI `collection link` command (#A6) only blocks on the server RPC handlers (#A5), not on the MultiStore (#A1) or schema work (#A2).
- The UI collection selector (#B4) has no backend dependencies at all — it reads from ListCollections which already works.
- The EphemeralStorePool (#C1) can start in parallel with Phase A and B since it's a standalone utility.

### Self-containment
Each task description restates the relevant interface contracts, file paths, and design constraints. A developer picking up task C3 (graph query routing) can implement it knowing the EphemeralStorePool API, the collectionSupportsGraph contract, and the MultiStore routing behavior — without reading sibling tasks A1 or B2.

---

## Phase A: Infrastructure (MultiStore + LinkedAccount + CLI)

**Epic:** `e3013bf7-ccb6-4499-9834-aa84d0382de6`

| ID (short) | Title | Type | Priority | Parent | Blocked By | Scope |
|------------|-------|------|----------|--------|------------|-------|
| `e3aa9d46` | Implement MultiStore platform-based store router | story | HIGH | Phase A | — | Create `internal/store/multistore.go` implementing the Store interface. Routes collection/user/token ops to primary EntStore; routes task/comment/relationship ops by collection platform. Platform registration method. Resolver with caching. |
| `1b8d6c05` | Add LinkedAccount Ent schema and Collection remote_data field | story | HIGH | Phase A | — | New `internal/store/schema/linkedaccount.go` with credential fields (id, collection_id, platform enum, encrypted auth_token, auth_method, scopes, status, timestamps). Add `remote_data` JSON field to Collection schema for per-collection settings. Run ent generate. |
| `88174cbf` | Define LinkedAccount proto messages and RPC service methods | story | HIGH | Phase A | — | Add CreateLinkedAccount/Get/Delete request/response protos and three RPC definitions to FarmTableService. Auth_token excluded from all response messages. Generate Go stubs. |
| `846a62cb` | Implement LinkedAccount store CRUD operations in EntStore | story | HIGH | Phase A | `1b8d6c05` (schema) | Add Create/Get/GetByCollectionID/Delete/List methods to EntStore. AES-256-GCM token encryption with key from env var. Unique constraint on collection_id. |
| `eba35544` | Implement LinkedAccount server RPC handlers | story | HIGH | Phase A | `88174cbf` (proto), `846a62cb` (store CRUD) | Three gRPC handlers in server. Proto conversion helpers. Token never in response. Validation (collection exists, platform supported). |
| `5cbff714` | Add CLI commands: ft collection link and ft collection unlink | story | NORMAL | Phase A | `eba35544` (server RPCs) | `ft collection link github --collection <id> --token <pat> --repo owner/repo` and `ft collection unlink <id>`. Token from flag, env var, or stdin. |
| `9987ea5e` | Wire MultiStore into server startup | task | HIGH | Phase A | `e3aa9d46` (MultiStore) | Change `cmd/farmtable-server/main.go` to construct MultiStore wrapping EntStore, pass to NewFarmTableService. No platform stores registered yet — pure pass-through. |

**DAG entry points (ready to start):** A1 (MultiStore), A2 (Schema), A3 (Proto) — all three can be done in parallel.

**Critical path within Phase A:** A2 → A4 → A5 → A6 (schema → store CRUD → server RPCs → CLI)

---

## Phase B: Server-Side Passthrough (External Tasks on Board)

**Epic:** `b202db7d-d0df-44b0-89aa-e5f8a94fd2a0`

| ID (short) | Title | Type | Priority | Parent | Blocked By | Scope |
|------------|-------|------|----------|--------|------------|-------|
| `bd40428e` | Adapt PassThroughStore for server-side use | story | HIGH | Phase B | — | Modify `internal/platform/github/passthrough.go`: accept collectionID in constructor, remove deterministic UUID. Fix `taskToProto` in `convert.go` to use actual platform. Return `codes.Unimplemented` for write ops and inapplicable operations. |
| `38ce5db9` | Implement lazy platform store construction in MultiStore | story | HIGH | Phase B | `e3aa9d46` (MultiStore), `846a62cb` (store CRUD), `bd40428e` (passthrough adaptations) | Extend MultiStore to lazily construct PassThroughStore instances on first request for an external collection. LRU cache for warm instances. Look up LinkedAccount credentials, parse remote_id, construct store. Error handling for missing/expired credentials. |
| `ae0c23c0` | Gate WatchTasks for external collections | task | NORMAL | Phase B | `38ce5db9` (lazy construction) | Return `codes.Unimplemented` from WatchTasks handler (`internal/server/watch.go`) for non-farmtable collections with clear error message. |
| `cc01fec2` | UI: Add collection selector dropdown to toolbar | story | NORMAL | Phase B | — | `<sl-select>` dropdown in toolbar (`web/src/components/ft-toolbar.ts`). Populated from ListCollections. Platform badge for external collections. Selection switches the active board. |
| `f79b9430` | UI: Read-only indicator and disabled edit controls | story | NORMAL | Phase B | `cc01fec2` (selector) | Disable editing (title edit, drag-to-move, comment box, create buttons) for external collections. Show read-only badge. Ensure "View in GitHub" link renders in Inspector. |
| `e1453edd` | UI: WatchTasks skip, poll-on-interval fallback, and refresh button | story | NORMAL | Phase B | `ae0c23c0` (WatchTasks gating), `cc01fec2` (selector) | Skip WatchTasks stream for external collections. Auto-poll at 60s interval. Manual "Refresh" button. "Updated Xs ago" indicator. |
| `69a1922d` | UI: Loading state for API-proxied external data | task | LOW | Phase B | — | Loading spinner/skeleton during external collection data fetch. Error state for failed fetches. Pure UI — no backend dependencies. |
| `c634467c` | Error handling: surface expired/revoked token errors clearly | task | NORMAL | Phase B | `38ce5db9` (lazy construction) | Map GitHub 401/403/404 to specific gRPC error codes (Unauthenticated, ResourceExhausted, NotFound) with actionable messages. UI should display errors as banners/toasts, not swallow them. |

**DAG entry points (ready to start):** B1 (PassThroughStore adaptations), B4 (UI Collection selector), B7 (UI Loading state) — all can start immediately, in parallel with Phase A work.

**Critical path within Phase B:** B1 + [A1, A4] → B2 → B3 → B6 (passthrough + MultiStore + CRUD → lazy construction → WatchTasks gating → UI fallback)

---

## Phase C: Ephemeral SQLite + Graph Queries

**Epic:** `cd097dcb-d293-49e7-8519-7c7a83612905`

| ID (short) | Title | Type | Priority | Parent | Blocked By | Scope |
|------------|-------|------|----------|--------|------------|-------|
| `91abe7c9` | Implement EphemeralStorePool for in-memory SQLite | story | NORMAL | Phase C | — | New `internal/store/ephemeral.go`. Pool of pre-migrated in-memory SQLite EntStore instances. Get/Return/Truncate/Close lifecycle. Configurable max size (default 4). Mutex-protected. Each instance is independent — concurrent queries use isolated DBs. |
| `74390234` | Implement collectionSupportsGraph check | task | NORMAL | Phase C | `1b8d6c05` (schema) | Helper function checking `collection.RemoteData["graph_queries"]` with platform-based defaults (github/linear/jira: true, asana: false). Used by graph query handlers to gate the ephemeral path. |
| `af6dd848` | Route graph query handlers through ephemeral SQLite | story | HIGH | Phase C | `38ce5db9` (lazy construction), `91abe7c9` (pool), `74390234` (graph check) | Modify GetReadyTasks, GetBlockedTasks, GetCriticalPath, GetBottlenecks in `server.go`: detect external collection → check graph support → fetch all tasks → load into ephemeral SQLite → extract relationships → run existing graph query logic → return. Add EphemeralStorePool field to FarmTableService. |
| `b97f3168` | Initialize EphemeralStorePool at server startup | task | NORMAL | Phase C | `91abe7c9` (pool) | Create pool in `cmd/farmtable-server/main.go`, pass via `server.WithEphemeralPool()` option. Pool size from env var or default 4. Close on shutdown. |
| `24ae15c1` | Integration tests: graph queries on external collections | task | NORMAL | Phase C | `af6dd848` (routing), `b97f3168` (startup) | 7 test scenarios: GetReadyTasks (correct results), GetBlockedTasks, GetCriticalPath (chain), GetBottlenecks (fan-out), graph-disabled collection returns Unimplemented, concurrent isolation, no ephemeral data leaks to Postgres. Mock passthrough store + real ephemeral pool. |

**DAG entry points (ready to start):** C1 (EphemeralStorePool) — can start immediately, in parallel with all Phase A and B work.

**Critical path within Phase C:** [B2, C1, C2] → C3 → C5 (lazy construction + pool + graph check → routing → tests)

---

## Full DAG Visualization

```
PHASE A                          PHASE B                         PHASE C
─────────────────────────────    ──────────────────────────────   ──────────────────────
                                                               
A1 MultiStore ──────────┐        B1 PassThroughStore ─────┐      C1 EphemeralPool ──────┐
                        ├──► A7  Startup wiring           │                              │
                        │                                 │      C2 graphSupports ──────┐│
                        └──────────────────────────────┐  │      (blocked by A2)        ││
                                                       │  │                              ││
A2 Schema ─────────► A4 Store CRUD ──┐                 │  │                              ││
                                     │                 ▼  ▼                              ▼▼
A3 Proto  ─────────► A5 Server RPCs  ├──► B2 Lazy construction ──► B3 WatchTasks ──┐  C3 Graph routing
                                     │        │                                    │      │
                     A6 CLI ◄────────┘        │         B4 UI Selector ──────────┐ │      │
                     (blocked by A5)          │              │                   │ │      ▼
                                              │              ▼                   ▼ ▼  C4 Startup init
                                              │         B5 UI Read-only    B6 UI Poll    │
                                              │                                          ▼
                                              └──► B8 Error handling             C5 Tests
                                              
                                         B7 UI Loading (no deps)
```

**Overall critical path (longest dependency chain):**
A2 → A4 → B2 → C3 → C5 (schema → store CRUD → lazy construction → graph routing → integration tests)

**Maximum parallelism at start:** 7 tasks (A1, A2, A3, B1, B4, B7, C1)

---

## Observations on the Decomposition

### Parts that decomposed cleanly
- **Phase A internal dependencies** are straightforward: schema → CRUD → RPCs → CLI is a natural pipeline, and the MultiStore is independent of it.
- **UI tasks** are genuinely independent of backend work and can be developed/tested against existing collections, then verified with external ones later.
- **EphemeralStorePool** is a clean standalone utility with no external dependencies — good candidate for early parallel work.

### Parts that required judgment calls
- **PassThroughStore adaptations (B1) vs. taskToProto fix:** These touch different files (`platform/github/passthrough.go` vs. `server/convert.go`) but are conceptually a single "make the passthrough store server-ready" change. Kept as one task because splitting would create unnecessary coordination — the developer needs to understand both changes together.
- **MultiStore lazy construction (B2):** This is the linchpin of Phase B — it has 3 incoming blockers and 3 downstream dependents. It couldn't be split further without creating artificial seams. The task description is correspondingly detailed.
- **Graph query routing (C3):** This is the most complex single task. It touches 4 handlers and involves a multi-step flow (fetch → load → query → return). Could potentially be split per-handler, but the handlers share the same pattern and splitting would quadruple the interface documentation overhead with no real implementation benefit.

### Ambiguities in the design
- **Token encryption key source:** The design mentions "environment variable or secret manager" but doesn't specify the env var name or fallback behavior. Task A4 makes a pragmatic choice (env var with plaintext fallback for dev).
- **Relationship extraction from GitHub tasks:** The design references `extractRelationships(t)` but doesn't specify how GitHub sub-issue relationships map to the Farmtable relationship model. Task C3 names this as a helper to implement but the exact mapping needs discovery during implementation.
- **Collection selector vs. separate section:** Open question #2 in the design asks whether external collections should be in a separate UI section. Task B4 defaults to a single unified dropdown — the simpler option that can be refined post-v1.
