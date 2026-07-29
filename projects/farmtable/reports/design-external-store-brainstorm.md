# Design Brainstorm: Representing External Task Stores Without Full Sync

**Date:** 2026-07-20 (updated after discussion round 1)
**Author:** Architect agent
**Status:** Discussion draft — refined after user feedback
**Context:** Response to ptone@google.com's question about viable alternatives to full-copy sync for external task stores

---

## Problem Statement

Farmtable can already represent external task stores (GitHub Issues, Linear, Jira) as collections — the proto schema, Ent schema, and even a working implementation (GitHubPassThroughStore) all exist. The question is: **what is the right sync architecture?** Specifically, is a **partial sync + read-through cache** viable — where Farmtable holds a thin local index of external items and fetches full detail on demand — rather than eagerly materializing every field of every issue as a full local Task row?

### Success Criteria for Any Option

1. Board rendering (Kanban columns by stage) works with acceptable latency (<500ms after initial load).
2. Filtering and sorting by common fields (phase, stage, assignee, priority, labels) works.
3. The Inspector can display full task detail when a card is opened.
4. The architecture has a credible path to WatchTasks-style live updates (even if degraded).
5. Relationship traversal (parent-child, blocks/blocked-by) works at least within a single external collection.
6. The solution fits within the existing Store interface pattern, not a parallel universe.

### Non-Goals for This Discussion

- Webhook infrastructure design (relevant but a separate concern).
- Credential/linked-account management (prerequisite for all options, not differentiating).
- Multi-platform abstraction (GitHub adapter exists; generalizing to Linear/Jira is future work).
- Offline access (not a current Farmtable feature for any platform).

---

## 1. What Does the Current Data Model Assume That Would Need to Bend?

### Assumptions That Are Load-Bearing

**A. Every task is a fully-populated local row.**
The `EntStore.ListTasks()` query builds SQL predicates directly on task columns (`WHERE phase = 'open' AND stage = 'ready'`). Keyset pagination sorts on `created_at`/`updated_at`/`priority` columns. Board rendering calls `ListTasks` with a stage filter and expects the response to include `title`, `assignee`, `priority`, `labels` — everything needed to render a card. If any of these fields are absent or placeholder, the board renders incorrectly or incompletely.

**Impact:** Any architecture where board-level fields are not locally available requires either (a) fetching the entire external task list on every board render, or (b) an alternative query path.

**B. WatchTasks relies on a local event bus.**
The `eventBus` is populated by the `EntStore` when a task is created/updated/deleted via local RPCs. The passthrough store explicitly disables WatchTasks (`"streaming not available in pass-through mode"`). The Feature Loop UI depends on WatchTasks for live updates — without it, cards don't move between columns until a manual refresh.

**Impact:** Any architecture without proactive local storage cannot support WatchTasks natively. Workarounds: polling (client or server-side), or emitting synthetic events when a background sync detects changes.

**C. Relationship traversal requires both sides to exist locally.**
Graph queries (critical path, bottlenecks, ready tasks) join the `relationships` table with the `tasks` table. If task B blocks task A, and task B is an external task that hasn't been fetched/cached, the relationship is invisible. Worse, `CreateRelationship` validates that both `source_task_id` and `target_task_id` exist in the local store.

**Impact:** Cross-collection relationships to external tasks only work if both tasks have local rows. Within an external collection, relationships work only if the sync/index covers all tasks (not just viewed ones).

**D. The frontend `TaskStore` is a Map<string, Task> with full objects.**
`task-store.ts` calls `this.tasks.set(task.id, task)` and assumes every Task object is complete. Components like `ft-kanban-card` read `task.name`, `task.stage`, `task.priority`, `task.assignees` directly — no concept of "this field hasn't been fetched yet."

**Impact:** Introducing partial Task objects requires either (a) a loading/placeholder state in the UI for unfilled fields, or (b) ensuring the fields the board cares about are always populated before the task reaches the TaskStore.

### Assumptions That Are Easy to Bend

- **`description` is `Optional().Default("")`** — today an empty string, but could be changed to nullable to distinguish "not yet fetched" from "genuinely empty." Schema migration required but straightforward.
- **Comments are loaded per-task** — already a separate `ListComments` call, not bundled with ListTasks. Lazy-loading comments is already the natural pattern.
- **`remote_data` is an opaque JSON blob** — the escape hatch for platform-specific data. No code except convert.go inspects it, and it already carries `remote_id`, `remote_url`, and platform-specific metadata. This field can hold sync metadata (last_fetched, etag) without schema changes.

---

## 2. Architecture Options

I identified four viable architectures, plus one hybrid that I think is the most pragmatic. Each is assessed against the success criteria above.

### Option A: Server-Side Virtual Collection (Passthrough Lifted to Server)

**What it is:** Move the existing `GitHubPassThroughStore` from the CLI to the server. The server holds collection metadata and credentials. Every `ListTasks`/`GetTask` call for an external-platform collection proxies directly to the external API. No local task rows at all.

**Concrete shape:**
```
Client → ListTasks(collection=github-X, stage=ready)
  → Server sees collection.platform == "github"
  → Server calls GitHub GraphQL: listIssues(states: [OPEN], labels: ["ready"])
  → Maps results to pb.Task objects
  → Returns to client
```

- **Board rendering:** Each board load triggers an external API call. Latency: 500ms-2s for GitHub GraphQL (depending on issue count). Acceptable for <200 issues; noticeable for >500.
- **Filtering:** Some filters map to API params (state → phase, labels → stage). Others require post-fetch in-memory filtering (priority, type, assignee for some platforms). Cannot sort by `updated_at` unless the API supports it.
- **WatchTasks:** **Cannot work.** Client must poll `ListTasks` on an interval (e.g., 15-30s) or accept stale board state. This is the biggest UX regression.
- **Relationships:** Only if the external API exposes them (GitHub sub-issues do via GraphQL). Cross-platform relationships impossible. Graph queries (critical path, bottlenecks) cannot work.
- **Write path:** Simplest of all options — writes go directly to the external API with no local state to invalidate.
- **Implementation cost:** Low. The code already exists in `passthrough.go`. Main work: credential storage on the server, platform routing in the gRPC service layer, and a polling fallback for the UI.

**What breaks:** WatchTasks, graph queries, cross-collection relationships, full-text search, reliable total counts, keyset pagination (external APIs have their own cursor formats).

**Viability: VIABLE for read-only browsing of small-to-medium repos.** Fatal flaw for power-user features (graph queries, live updates). Good as a Phase 0 "proof of concept" but not a long-term architecture.

---

### Option B: Thin Index + Lazy Detail

**What it is:** Proactively sync only "board-rendering fields" (title, phase, stage, priority, assignee, labels, parent_task_id, remote_id) into skeleton Task rows. Fetch heavy fields (description, acceptance_criteria, comments, custom_fields) lazily on task-open (Inspector view).

**Concrete shape:**
```
Background sync (every N minutes):
  → Fetch external issue list (title, state, assignee, labels only — use list endpoint)
  → For each issue: UPSERT a skeleton Task row with board-level fields
  → Set remote_data.synced_at = now(), remote_data.detail_fetched = false

Client → ListTasks(collection=github-X, stage=ready)
  → Server queries local Task table normally (SQL WHERE/ORDER)
  → Returns skeleton tasks (description may be empty/null)

Client → GetTask(id=...)
  → Server checks: is remote_data.detail_fetched == false?
  → If yes: fetch full issue detail from external API
  → Update local row with description, acceptance_criteria, etc.
  → Set remote_data.detail_fetched = true, remote_data.detail_fetched_at = now()
  → Return fully-populated task
```

- **Board rendering:** Fast — reads from local SQL. All board-level fields are synced. Filter/sort by phase, stage, priority, assignee, labels all work.
- **Inspector:** First open of a task triggers an API call (200-500ms). Subsequent opens use cached data. A TTL on `detail_fetched_at` can trigger refresh.
- **WatchTasks:** Semi-functional. Background sync can emit synthetic TaskEvents when it detects field changes. Not real-time, but the board updates within the sync interval (1-5 min).
- **Relationships:** Work within the collection if `parent_task_id` is synced. Full relationship table can be populated from external API's link metadata.
- **Write path:** Writes update the local row immediately + queue an async write-through to the external API. Or: disable editing for external tasks (simpler).
- **Implementation cost:** Medium. New background sync job, lazy-fetch logic in GetTask, schema changes for nullable `description`, UI handling for "loading detail..." state.

**What breaks:** Full-text search on description until detail is fetched. `description` field semantics change (empty ≠ not-yet-fetched). Any code that reads `task.Description` and assumes it's always populated.

**Key insight — this saves less than you'd think.** Task rows are individually small (~1-3KB each, most of which is title + description). The "heavy" data in external systems is comments (can be hundreds per issue, with full markdown bodies) and change/audit history — not the task fields themselves. A repo with 1000 issues produces ~3MB of fully-synced Task rows. The thin index of the same 1000 issues is ~1MB. You save 2MB at the cost of significant complexity.

**Viability: VIABLE but the complexity-to-benefit ratio is unfavorable.** The approach introduces a new "partially populated" state throughout the stack for marginal storage savings. Makes more sense if external task descriptions are routinely very large (multi-KB) and the collection has thousands of issues.

---

### Option C: Two-Table Architecture (External Index + Detail Cache)

**What it is:** A dedicated lightweight `external_task_index` table (not the Task table) for external items, plus a TTL-governed detail cache. ListTasks for external collections queries the index table. GetTask populates the detail cache (could be a separate table, Redis, or in-memory).

**Concrete shape:**
```sql
CREATE TABLE external_task_index (
  collection_id UUID NOT NULL,
  remote_id     TEXT NOT NULL,
  local_id      UUID NOT NULL DEFAULT gen_random_uuid(),
  title         TEXT,
  phase         TEXT,
  stage         TEXT,
  priority      TEXT,
  assignee_ref  TEXT,          -- email or remote user ID, not a local UUID
  labels        JSONB,
  parent_remote_id TEXT,
  synced_at     TIMESTAMPTZ,
  PRIMARY KEY (collection_id, remote_id)
);
```

- **Board rendering:** Query the index table. Fast. But: different code path from local tasks. The UI must handle `ExternalTaskSummary` objects alongside `Task` objects, or the server must convert index rows into `pb.Task` messages with empty detail fields.
- **Filtering:** Works for indexed fields. Same as Option B.
- **WatchTasks:** Same as Option B — synthetic events on sync.
- **Relationships:** Harder — relationships reference Task UUIDs, but external tasks live in a different table. Need a mapping layer or use the index table's `local_id` as a stable surrogate.
- **Implementation cost:** High. Dual code paths everywhere. Every feature that touches tasks needs awareness of two storage models. The Store interface would need a second implementation (or significant refactoring) for external collections.

**What breaks:** The Store interface abstraction. Every consumer of `store.ListTasks()` now needs to know which table the results came from. The frontend needs to handle two task representations or the server needs to synthesize fake Task objects from index rows.

**Viability: NOT RECOMMENDED.** The dual-table complexity is high and the benefit over Option B (same data, separate table) is marginal. If you're going to sync board-level fields into a local row, just use the Task table — that's what it's for.

---

### Option D: Full Materialized Sync (Enhanced GitHubAdapter)

**What it is:** Sync all task-level fields from the external store into full, first-class Task rows. Sync incrementally using the external API's "updated since" / "modified after" capability. Comments and change history are NOT proactively synced — they're fetched lazily per-task.

**Concrete shape:**
```
Background sync (every N minutes, or webhook-triggered):
  → Fetch issues updated since last_sync_at (uses GitHub's `filterBy: {since: ...}`)
  → For each issue: UPSERT a full Task row (all fields populated)
  → Mark deleted/closed issues appropriately
  → Emit TaskEvent for each change (feeds WatchTasks)

Comments/history:
  → Fetched on demand when Inspector opens a task
  → Cached locally with TTL
  → Not part of the periodic sync
```

- **Board rendering:** Identical to native Farmtable tasks. Full SQL query capability.
- **Filtering/sorting:** All fields available. Full-text search on description works.
- **WatchTasks:** Works. Sync emits TaskEvents through the eventBus. Not real-time (depends on sync interval), but functionally equivalent to the live experience.
- **Relationships:** Full support. Parent-child from external API mapped to `parent_task_id`. Cross-collection relationships work if both sides have local rows.
- **Graph queries:** Work fully — critical path, bottlenecks, ready tasks all function.
- **Write path:** Write-through to external API. Update local row on confirmation. Conflict detection via version/ETag comparison.
- **Implementation cost:** Medium. GitHubAdapter already does most of this. Main work: wiring it into the server, incremental sync logic, credential management, and lazy comment loading.

**What the user's concern is:** "This IS full sync." And it is — every task field is materialized locally. But consider the actual cost:

| Repo size | Tasks | Storage (estimated) | Sync time |
|-----------|-------|---------------------|-----------|
| Small (personal) | 50 issues | ~100KB | <2s |
| Medium (team) | 500 issues | ~1MB | <10s |
| Large (org) | 5,000 issues | ~10MB | <60s |
| Very large | 50,000 issues | ~100MB | Minutes |

For the vast majority of real-world repos, the storage cost of fully-synced task rows is negligible. The operational cost (sync infrastructure) is identical whether you sync 5 fields or 25 fields per task.

**Viability: MOST CAPABLE option.** The "full sync" label sounds heavy, but the actual per-task data is small. The complexity of sync (scheduling, conflict detection, error recovery) exists regardless of how many fields you sync. This option avoids the partial-object complexity that plagues Options B and C.

---

### Option E (Recommended): Full Task Sync + Lazy Content Loading

**What it is:** A pragmatic hybrid that reframes the question. Instead of asking "which task fields to sync?", ask "which *entities* to sync proactively vs. lazily?"

**The insight:** Task rows are small and cheap to sync. Comments, change history, and attachments are large and grow monotonically — they're the real candidates for lazy loading. This maps cleanly to the UI's existing structure:

| UI Surface | Data Needed | Sync Strategy |
|------------|------------|---------------|
| Board card | title, stage, priority, assignee, type, labels | **Proactive sync** (needed for every render) |
| Inspector "General" tab | + description, acceptance_criteria, dates, code_context | **Proactive sync** (these are part of the Task row, individually small) |
| Inspector "Comments" tab | comment thread | **Lazy fetch on tab open** (already a separate API call today) |
| Inspector "Activity" tab | change history | **Lazy fetch on tab open** (already a separate API call today) |

**Concrete implementation shape:**

```
Sync layer (runs server-side):
  1. Incremental sync every 1-5 minutes (configurable per collection)
     → GitHub: GET /repos/{owner}/{repo}/issues?since={last_sync}&state=all
     → For each issue: UPSERT full Task row
     → Emit TaskEvent per changed task (feeds WatchTasks/eventBus)
  2. On-demand sync: collection-level "Refresh" action triggers immediate sync

Comment loading:
  1. ListComments(taskId) checks: does task have remote_id?
  2. If yes and comments not cached (or stale): fetch from external API, cache locally
  3. Cache in Comment table with TTL marker (remote_data.fetched_at)
  4. Return cached comments

Write path (Phase 2, optional for v1):
  1. User edits task in Farmtable → update local row immediately
  2. Queue async write-through to external API
  3. On success: update remote_data with confirmed external state
  4. On failure: mark task as "sync conflict" (surface in UI)
  OR: For v1, disable editing for external-platform tasks entirely.
```

**Why this is better than Option B (thin index):**

1. **No partial-object complexity.** Every Task row is fully populated. No "field not yet fetched" states. No nullable-vs-empty ambiguity. No loading spinners on the Inspector's General tab.
2. **Same sync infrastructure cost.** You need a background sync job regardless. Fetching 25 fields per issue costs the same API call as fetching 5 fields — external APIs return full objects.
3. **Negligible storage difference.** Task-level metadata is ~1-3KB per issue. Syncing description adds maybe 1KB average. On a 1000-issue repo, the difference is ~1MB. Comments, which are NOT synced proactively, can be 10-100x that.
4. **Clean separation.** "Tasks are synced, comments are lazy" is a simple invariant. "Some task fields are synced, others are lazy" is a complex invariant that leaks into every consumer.

**Why this is better than Option D (full materialized sync):**

It IS Option D for task rows — but it explicitly excludes proactive comment/history sync, which is where the real data volume lives. A GitHub issue might have 2KB of task metadata and 200KB of comments. By lazy-loading comments, you avoid syncing 99% of the data volume while maintaining 100% of the query capability for the board/filter/graph features.

**What needs to change in Farmtable:**

1. **Server-side platform routing.** When a ListTasks/GetTask call targets a collection with `platform != "farmtable"`, the server routes through the appropriate adapter. The Store interface already supports this — the GitHubPassThroughStore is a Store implementation.
2. **Background sync job.** A goroutine (or Cloud Run Job) that periodically calls `GitHubAdapter.SyncCollection()` for each external collection. The adapter code already exists; it needs to be wired to a scheduler.
3. **Credential management.** LinkedAccount entity for storing platform credentials (PATs, OAuth tokens). The proto already defines this message.
4. **Lazy comment loading.** The `ListComments` handler checks if the task's collection is external. If so, fetches from the external API on demand, caches in the Comment table with a staleness marker.
5. **Sync-aware event emission.** The sync job emits TaskEvents through the eventBus so WatchTasks works. This makes external tasks show up in the live board without polling.

**What does NOT need to change:**

- Task table schema (external tasks are full Task rows)
- ListTasks/GetTask query logic (same SQL queries work)
- Frontend TaskStore, Kanban board, Inspector General tab
- Relationship table and graph queries
- Export/Import (external collections excluded per existing design decision #7)

**Viability: RECOMMENDED.** This is the pragmatic sweet spot. It reuses the most existing code (GitHubAdapter + Store interface), avoids the partial-object complexity of thin-index approaches, and defers the genuinely expensive data (comments/history) to lazy loading.

---

## 3. Read-Through Cache: What It Would Look Like Here (and Why It's Not the Best Fit)

The brief specifically asks about a read-through cache architecture, so let me address it directly.

**A read-through cache for Farmtable would look like:**
- A cache layer (Redis, in-memory, or a cache table) keyed by `(platform, collection_id, remote_id)`.
- On `ListTasks`: check if the cached list is fresh (within TTL). If stale, fetch from external API, update cache, return.
- On `GetTask`: check if the cached task is fresh. If stale or missing, fetch from external API, cache it, return.
- TTL: 1-5 minutes for list metadata, 5-30 minutes for task detail.

**Why it's not the best fit for Farmtable specifically:**

1. **The board needs ALL tasks, not one.** A read-through cache shines when you're looking up individual items by key ("get user by ID"). But the Kanban board renders ALL tasks in a collection grouped by stage. This means every board load either (a) hits the full external API to refresh the list, or (b) shows stale cached data. There's no key-level cache benefit — you always need the whole list.

2. **SQL query capabilities are lost.** A cache can answer "give me task X" but not "give me all tasks WHERE stage='ready' AND priority='high' ORDER BY updated_at". To support filtering/sorting, the cache would need to index on those fields — at which point you've reinvented a database table, which is what Option B/D/E already are.

3. **Cache invalidation is the sync problem in disguise.** A TTL-based cache with background refresh IS a sync mechanism. You're just calling it a "cache" instead of a "sync." The operational complexity (when to refresh, how to detect changes, how to handle stale data) is identical.

4. **Farmtable already has the "database" half.** The Task table IS the cache. Syncing external tasks into Task rows and refreshing them periodically is a read-through cache implemented in Postgres instead of Redis — and it comes with SQL query capability for free.

**Where a read-through cache DOES make sense:** for comments and change history. These are fetched per-task, individually large, and not needed for board rendering. A TTL-based cache for comments (fetch on Inspector open, cache for 5 minutes) is exactly the right pattern — and it's what Option E proposes.

---

## 4. Partial Sync Tiers and the Inspector Tabbed Structure

The brief asks whether there's a middle ground where list-level metadata is synced proactively but heavy fields are lazy-loaded on tab-open. Yes — and this maps cleanly to the Inspector's existing tab structure:

| Inspector Tab | Data Source | Sync Tier |
|---------------|-----------|-----------|
| General (title, description, fields) | Task row | Proactive sync |
| Comments | Comment table | Lazy fetch (cache with TTL) |
| Activity / Changes | Change table | Lazy fetch (cache with TTL) |
| Relationships | Relationship table | Proactive sync (populated during task sync) |
| Code Context | Task row fields | Proactive sync (repo, branch, CI from external API if available) |

**But the tier boundary should be between entities (tasks vs. comments), not between fields within a task.** Splitting the Task row itself into "synced fields" and "lazy fields" adds complexity disproportionate to the benefit:

- **External APIs return full objects.** GitHub's list-issues endpoint returns title, body (description), state, labels, assignees, etc. all in one response. You can't request "just title and state." So you're fetching the full object during sync anyway — throwing away the description field after fetching it saves nothing on the API side.
- **Description is small.** Average GitHub issue description: ~500 bytes. Average comment thread: 5-50KB. The ROI of lazy-loading description is ~100x smaller than lazy-loading comments.
- **Partial Task objects leak complexity.** If `description` can be null-meaning-not-fetched, every code path that reads `task.Description` needs to handle this. The frontend needs a loading state on the General tab. The `taskToProto` converter needs to signal "field not available" somehow.

**Recommendation:** Sync the full Task row (all fields). Lazy-load comments and change history. This gives the Inspector tabs a clean fetch model: General tab always has data on render (no spinner), Comments tab shows a spinner on first open for external tasks then caches.

---

## 5. Write Path Options

If a user edits or comments on an externally-sourced task in Farmtable:

### Option W1: Read-Only (Disable Editing for External Tasks)

**What:** The UI disables edit controls for tasks where `collection.platform != "farmtable"`. Users must go to the external tool to make changes. Farmtable picks up the changes on next sync.

**Pros:** Zero conflict risk. Simplest to implement. Clear mental model for users.
**Cons:** Reduced utility — Farmtable becomes a read-only viewer for external tasks.
**Recommendation for v1:** Start here. Editing can be added later once the read path is solid.

### Option W2: Synchronous Write-Through

**What:** Edits in Farmtable are immediately proxied to the external API. If the external API accepts the change, the local row is updated. If it rejects (conflict, permissions), the edit fails with an error.

**Pros:** Strong consistency. The user knows immediately if their edit succeeded.
**Cons:** Latency on every edit (external API call in the request path). Requires platform-specific write adapters. Permission model may differ (user has Farmtable access but not GitHub write access).
**When to use:** For comments (adding a comment is idempotent and low-conflict) or status changes (moving a card between columns).

### Option W3: Async Write-Through with Conflict Detection

**What:** Edits update the local row immediately (optimistic). A background job pushes the change to the external API. If the push fails (conflict, stale version), the task is marked as "sync conflict" and the user is prompted to resolve.

**Pros:** Snappy UI. Edits feel instant.
**Cons:** Eventual consistency. The task may diverge from the external source until the push completes. Conflict resolution UI is complex.
**When to use:** For bulk editing workflows where latency matters.

### Conflict Implications

- **Last-write-wins with staleness detection.** On sync, compare the external issue's `updated_at` against `remote_data.last_synced_at`. If the external issue was modified by someone else since our last sync, log the conflict. For v1, external wins (their change overwrites ours) with a notification to the user.
- **Version/ETag-based CAS.** The Task's `version` field can carry the external API's ETag or `updated_at` timestamp. On write-through, include `If-Match: <version>` or equivalent. If it fails (412 Precondition Failed), the local row is stale — re-sync before retrying.

**Recommendation:** Start with W1 (read-only) for v1. Add W2 (sync write-through) for comments and stage changes in v2. W3 (async) is only needed if users demand low-latency bulk editing of external tasks, which seems unlikely for v1.

---

## 6. Comparison to Existing Mechanisms

### vs. GitHubPassThroughStore (CLI Passthrough)

| Dimension | CLI Passthrough | Option E (Full Task Sync + Lazy Comments) |
|-----------|----------------|------------------------------------------|
| Where it runs | CLI-only (in-process gRPC server) | Server-side (Cloud Run) |
| Local storage | None | Task rows in Postgres |
| Freshness | Always fresh (every call is an API call) | Sync interval (1-5 min) + on-demand refresh |
| WatchTasks | Disabled | Works (sync emits events) |
| Filtering | Limited (some filters post-fetch) | Full SQL capability |
| Graph queries | Not implemented | Works |
| Comments | Fetched per-call | Lazy-loaded + cached |
| Write path | Direct to GitHub | Write-through (or read-only for v1) |
| Credentials | Env var ($GITHUB_TOKEN) | Stored in LinkedAccount table |
| Code reuse | Moderate | High — reuses GitHubAdapter.SyncCollection() |

**Reuse opportunity:** The `issueToTask()` mapping logic in `passthrough.go` (lines 117-150) is directly reusable for the sync path. The `LabelMapper` (stage/priority/type mapping from labels) is platform-agnostic and works for both patterns.

### vs. Export/Import

| Dimension | Export/Import | Option E |
|-----------|-------------|----------|
| Trigger | Manual (user clicks export/import) | Automatic (background sync) |
| Scope | Full snapshot of one collection | Incremental updates |
| Direction | One-way (export from A, import to B) | Bidirectional (sync both ways) |
| ID strategy | Always remap (new UUIDs) | Deterministic UUIDs (SHA1 of remote ID) |
| Platform | PLATFORM_FARMTABLE only | External platforms |
| Comments | Included in snapshot | Lazy-loaded on demand |

**Reuse opportunity:** Limited. Export/Import is a point-in-time snapshot mechanism. The sync architecture is fundamentally different (incremental, bidirectional, ongoing). However, the user-identity resolution pattern from Import (match by email, create if unmatched) is directly applicable to mapping external assignees to Farmtable users.

### vs. Read-Through Cache (Hypothetical)

| Dimension | Read-Through Cache | Option E |
|-----------|-------------------|----------|
| Initial board load | Slow (cache miss → API call) | Fast (local SQL query) |
| Subsequent loads | Fast (cache hit within TTL) | Fast (local SQL query) |
| Filtering/sorting | Limited to cache index fields | Full SQL capability |
| WatchTasks | Cannot work | Works via sync-emitted events |
| Storage model | Key-value cache | Relational (Task table) |
| Cache invalidation | TTL-based (5 min?) | Sync-based (explicit refresh) |
| Graph queries | Cannot work | Works |

**The key difference:** A read-through cache answers "give me this specific item" efficiently. Farmtable's board answers "give me all items grouped by stage" — a set query, not a point query. Set queries need a database, not a cache.

---

## 7. Viability Summary

| Option | Board UX | Live Updates | Graph Queries | Complexity | Storage | Verdict |
|--------|---------|-------------|---------------|-----------|---------|---------|
| A: Server-Side Virtual | Slow (API per render) | None (poll only) | No | Low | Zero | Phase 0 only |
| B: Thin Index + Lazy Detail | Fast | Degraded | Partial | High | Low | Over-engineered |
| C: Two-Table Architecture | Fast | Degraded | Partial | Very High | Low | Not recommended |
| D: Full Materialized Sync | Fast | Yes | Yes | Medium | Low-Medium | Capable but overkill name |
| **E: Full Task Sync + Lazy Comments** | **Fast** | **Yes** | **Yes** | **Medium** | **Low** | **Recommended** |

**Option E is Option D with a precise scope boundary:** sync task rows (small, needed for all queries), lazy-load comments and history (large, needed only on task-open). The "full sync" label that makes Option D sound heavy is misleading — you're syncing ~2KB per issue, not ~200KB. The 200KB is comments, and those are lazy-loaded in all options.

---

## 8. If We Proceed: Implementation Phases

### Phase 0 — Server-Side Passthrough (Optional, Fast Win)
Move GitHubPassThroughStore to server-side with stored credentials. This gives immediate value (view GitHub issues from the dashboard) with minimal code changes. WatchTasks stays disabled; users poll via refresh. **This is Option A, used as a stepping stone, not a destination.**

### Phase 1 — Background Sync + Event Emission
Wire GitHubAdapter into the server. Add a background sync goroutine that calls `SyncCollection()` on a timer for each external collection. Emit TaskEvents through the eventBus on each sync delta. WatchTasks now works for external tasks (delayed by sync interval).

### Phase 2 — Lazy Comment Loading
Add comment fetching from the external API when `ListComments` is called for an external task. Cache in the Comment table with a `fetched_at` marker. Refresh on cache miss or staleness.

### Phase 3 — Write Path (Comments First)
Allow adding comments to external tasks via write-through. Comment creation is idempotent and low-conflict — a good first write-path feature. Status changes (move card between columns → update external issue state) can follow.

### Phase 4 — Webhook Integration
Replace polling-based sync with webhook-triggered sync for near-real-time updates. GitHub webhooks → Cloud Run endpoint → sync affected issues → emit TaskEvents. Polling remains as fallback for platforms without webhook support.

---

## Open Questions

1. **Sync interval vs. webhook priority.** For v1, is a 1-5 minute polling interval acceptable, or is near-real-time a requirement? Webhooks add infrastructure (public endpoint, secret management, retry handling) that may not be worth it for Phase 1.

2. **Assignee mapping strategy.** When syncing, how do we map external users (GitHub usernames, Linear emails) to Farmtable User rows? The Export/Import design uses email matching. Should we do the same, or create "ghost" user records with `type: "external"` and a `remote_id` reference?

3. **Collection-scoped vs. global sync.** Should each external collection have its own sync timer, or should there be a single sync manager that round-robins? A single manager is simpler but creates head-of-line blocking for slow APIs.

4. **Error visibility.** When sync fails (API rate limit, auth expired, network error), how is this surfaced? A status badge on the collection? A toast notification? A dedicated sync-status API?

5. **Scale boundary.** At what point (number of issues) does full task sync become impractical? My estimate: 50K+ issues would take minutes per sync and produce ~100MB of task rows. For repos at that scale, is a pagination-aware incremental sync sufficient, or do we need a fundamentally different approach (e.g., sync only open issues, archive closed)?

---

## Key Takeaway

The question "can we avoid full sync?" conflates two things:

1. **Syncing task metadata** — small per-item (~2KB), needed for all board/filter/graph features, cheap to sync in bulk. **Yes, you should sync this.**
2. **Syncing comments and history** — large per-item (10-100KB), needed only on task-open, expensive to sync in bulk. **No, you should lazy-load this.**

The architecture that falls out of this decomposition is straightforward: use the existing `GitHubAdapter.SyncCollection()` to populate Task rows, lazy-load comments via the external API on demand, emit TaskEvents on sync for live updates. Most of the code already exists.

---

## Addendum: Refined Category Framework (from discussion with ptone@google.com)

After reviewing the initial analysis, ptone proposed a cleaner 4-category spectrum that sharpens the architectural tradeoffs:

| Category | Description | Sync Infrastructure | Data Freshness | Local Query Power |
|----------|------------|---------------------|---------------|-------------------|
| **Cat 1** | API dialect shim / URL proxy | None | Always fresh | Limited (API-shaped queries only) |
| **Cat 2** | Minimal metadata sync | Polling + staleness mgmt | Stale between syncs | Board + graph traversal |
| **Cat 3** | Full data mirror (lazy comments) | Polling + staleness mgmt | Stale between syncs | Full SQL |
| **Cat 4** | Full mirror + live sync (webhooks) | Webhooks + fallback polling | Near-real-time | Full SQL |

### The "Valley" Insight

**Categories 2 and 3 sit in a valley of diminishing returns.** They pay the sync tax (introducing staleness, requiring sync scheduling, conflict detection, error recovery) without getting the payoff that justifies it (fresh data). The sync infrastructure cost is roughly constant regardless of sync depth — whether you sync 5 fields or 25 fields, you need the same scheduler, the same error handling, the same staleness detection. Cat 2 pays the same as Cat 3 for less capability.

The coherent architectural positions are bimodal:

- **Cat 1 (No sync):** Always-fresh data. Zero sync infrastructure. Accept latency and limited local query capability. Clear mental model: "Farmtable is a lens into the external system."
- **Cat 4 (Full sync + live updates):** Full local query capability. Near-real-time freshness. Accept webhook infrastructure cost per platform. Clear mental model: "Farmtable is a local mirror that stays current."

### Revised Assessment

**Cat 1 is more viable than I initially credited.** As a "read-only window into external systems" it delivers real, immediate value:
- Users see their GitHub issues in the Farmtable board. Data is always current.
- No sync state to debug. No staleness to explain.
- Graph traversal within a single external collection IS feasible — the passthrough fetches all issues, so parent-child relationships are available for in-memory graph computation. The current code doesn't implement this (GetCriticalPath etc. return unimplemented), but it's architecturally possible.
- The main limitations (no WatchTasks, latency on board load, no cross-collection graph queries to native Farmtable tasks) are acceptable if expectations are set correctly.

**Cat 4 is the right destination for full integration.** But the webhook/live-sync layer is where per-platform complexity concentrates — GitHub webhooks, Linear webhooks, and Jira webhooks have different payloads, delivery guarantees, and auth models. Each needs a public endpoint, secret verification, and retry handling.

**Practical note on "live sync":** Polling at 30-60 second intervals approximates Cat 4's freshness for many use cases without webhook infrastructure. Whether this counts as "Cat 3 with fast polling" or "Cat 4 without webhooks" depends on whether the user's concern is architectural purity or perceptible freshness.

### Revised Path Forward

1. **Ship Cat 1 first** — move GitHubPassThroughStore to server-side, add credential storage. Delivers "view my GitHub issues in the Farmtable board" in days. No sync infrastructure required.
2. **Build toward Cat 4 as the destination** — but through Cat 3 as a stepping stone (not a resting point). The full data mirror (Cat 3) is the infrastructure that Cat 4 needs — webhooks just replace the polling trigger.
3. **Skip Cat 2 entirely** — thin-index sync introduces the same infrastructure as Cat 3 with less capability. Not worth the intermediate step.

### Open Question: Platform Scope

The Cat 4 effort scales with platform count:
- GitHub-only: weeks (adapter code exists, webhook handler is one endpoint).
- GitHub + Linear: add a second adapter + webhook handler. Moderate effort.
- GitHub + Linear + Jira + Asana: significant per-platform investment. May warrant a generic adapter abstraction, but over-engineering this before the second platform is a risk.

---

## Addendum 2: Agreed Path — Cat 1 → Cat 4 (Skip Cat 3)

After further discussion, the agreed path is:

**Cat 1 → Cat 4 directly. Skip Cat 2 and Cat 3.**

Rationale: If you're going to build sync infrastructure, build it right the first time (with live sync / webhooks). A polling-based mirror (Cat 3) is throwaway work that gets replaced by webhooks. Don't build an intermediate you'll discard.

### Cat 1: Graph Queries via Ephemeral In-Memory SQLite

A key refinement to the Cat 1 architecture: graph queries (GetCriticalPath, GetBottlenecks, GetReadyTasks) don't need a new in-memory graph implementation. Instead, reuse the existing SQL-based graph query code by loading passthrough results into a throwaway in-memory SQLite EntStore:

```
Graph query flow (Cat 1):
  1. Fetch all issues from external API via passthrough
  2. Spin up an in-memory SQLite EntStore (Ent already supports SQLite — the CLI uses it)
  3. Run Ent auto-migration on the in-memory DB (creates tables, ~10-50ms)
  4. Bulk-insert fetched tasks + relationships into the in-memory store
  5. Run existing graph query methods (GetCriticalPath, etc.) against it
  6. Return results; in-memory DB is garbage-collected when request completes
```

**Benefits:**
- Zero new graph query code — reuses all existing EntStore graph methods
- Zero production DB impact — the ephemeral store is in-memory only
- Concurrency-safe — each request gets its own isolated SQLite instance
- No cleanup needed — the in-memory DB vanishes when the request ends

**Costs:**
- Ent auto-migration overhead per request (~10-50ms). Mitigable by pooling pre-migrated instances or keeping a template.
- Full API fetch required for each graph query (same as any passthrough ListTasks call).
- Memory usage scales with issue count (but <1000 tasks is <10MB in-memory).

**Alternative considered:** Load ephemeral rows into production Postgres with a disposable collection ID. Simpler code (no second Ent client) but writes to the production DB and requires cleanup. Rejected in favor of the in-memory approach to keep the production DB clean.

### Refined Cat 1 Implementation Scope

| Feature | Approach |
|---------|----------|
| ListTasks / GetTask | Server-side passthrough (API-proxied, always-fresh) |
| Credentials | LinkedAccount table (PAT storage, per-collection) |
| Board rendering | Works — passthrough returns full task objects |
| Filtering | API-mappable filters (state, labels) server-side; others post-fetch |
| Graph queries | Ephemeral in-memory SQLite (reuses existing code) |
| WatchTasks | Disabled (UI falls back to poll-on-interval or manual refresh) |
| Comments | Fetched per-call from external API (no local caching) |
| Write path | Read-only (editing disabled for external-platform tasks) |
| Code changes | Move passthrough to server, add credential storage, add ephemeral SQLite path for graph queries |

### Cat 4 (Future Destination)

When ready to invest in full sync infrastructure:
- Full data mirror into Postgres Task table (all task fields + relationships)
- Webhook-driven sync per platform (GitHub → Linear → Jira as needed)
- Polling fallback for platforms without webhook support
- WatchTasks works via sync-emitted events
- Lazy comment loading with local caching
- Write-through for comments and status changes

Cat 4 is a separate design effort. The Cat 1 architecture is designed to be **replaceable**, not **extensible** — when Cat 4 is built, the passthrough code path for synced collections is simply retired in favor of the local store path.
