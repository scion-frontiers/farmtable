# Farm Table Code Review

Reviewed: 2026-05-03
Scope: Full codebase — proto, store, server, CLI, tests, cmd entrypoints

---

## CRITICAL

### C1. `UpdateTask` unconditional mode is broken — always applies CAS even when client opts out

**Files:** `internal/server/server.go:208-216`, `internal/store/entstore.go:191-256`

When the client omits `version` from `UpdateTaskRequest` (intending an unconditional update, per the proto contract at `proto/farmtable.proto:564-565`), the server fetches the current version from the database and passes it to the store. The store then applies a `WHERE version = ?` predicate regardless. If any concurrent write bumps the version between the server's Get (line 211) and the store's Update (line 243), the update fails with `ErrConflict → FailedPrecondition`.

This violates the proto contract ("Omit for unconditional updates") and creates a TOCTOU race. The equivalent unconditional paths in `ClaimTask` and `CloseTask` work correctly — they skip the version predicate when version is empty. `UpdateTask` is the only one that breaks.

**Fix:** When version is not provided by the client, don't add `task.VersionEQ(p.Version)` to the WHERE clause in `entstore.go:198`. This requires either a separate code path in the store or a sentinel value.

---

### C2. `ClaimTask` generates a random UUID for every claim — agent identity is lost

**File:** `internal/server/server.go:272-273`

```go
// In a real system, assigneeID comes from auth context. Use a placeholder.
assigneeID := uuid.New()
```

This is not a TODO in a prototype — it's the shipped code path. Every claim creates a new random UUID as the assignee, which means:
- No way to determine who claimed a task (assignee ID is meaningless noise)
- `--assignee` filter on `ft task list` is useless — there are no stable identities to filter on
- The "already claimed" check (line 270) works mechanically, but the identity it records is garbage
- The `ft task claim` workflow from `cli-design.md` ("atomically claim and start a task") is fundamentally broken — the agent can never prove it's the claimant

The same issue exists for `AddComment` at line 327 (`authorID := uuid.New()`).

---

### C3. `ft status` crashes in embedded mode — `GetStatus` RPC is not implemented

**Files:** `internal/server/server.go` (missing), `internal/cli/status.go:24-28`

`GetStatus` and `GetVersion` are listed in the proto service definition but have no implementation in `server.go`. The embedded `UnimplementedFarmTableServiceServer` returns `codes.Unimplemented`. The `version` command handles this gracefully (swallows the error, line 32-37 of version.go). But `status.go` calls `handleGRPCError(err)` on line 28, which calls `os.Exit()`. Result: `ft status` always crashes in every mode.

Also missing: `WhoAmI`, `ListUsers`, `GetUser`. These don't have CLI commands yet so they only silently fail if called via direct gRPC.

---

### C4. Version hook is dead code that creates a double-increment trap

**File:** `internal/store/entstore.go:85-98`

The `versionHook()` is registered on `client.Task.Use()` (line 52) and attempts to auto-increment the version on every Update/UpdateOne mutation. However:

1. **It never fires for current code.** All update methods (`UpdateTask`, `ClaimTask`, `CloseTask`) use `client.Task.Update()` (bulk update). For `OpUpdate`, `m.OldVersion(ctx)` returns an error (Ent can't resolve the old value for bulk mutations), so the `if err == nil` guard skips the increment. The hook is dead code.

2. **It will double-increment if anyone uses `UpdateOne`.** Every method already manually sets the version via `SetVersion(strconv.Itoa(v + 1))`. If a future method uses `client.Task.UpdateOneID(id)`, the hook WILL fire and increment the version a second time (old+1 from hook + old+1 from manual code = version jumps by 2).

This is a maintenance trap. Either the hook should be the sole version management mechanism (and manual `SetVersion` calls should be removed), or the hook should be deleted.

---

## HIGH

### H1. TOCTOU race in `ClaimTask` — closed tasks can be reopened

**File:** `internal/store/entstore.go:258-296`

`ClaimTask` first reads the task (line 259) to check preconditions (not closed, not already claimed), then performs a separate bulk Update (line 275-287). Without an explicit version parameter:

1. Task is OPEN with no assignee — Get check passes
2. Concurrent request closes the task (sets phase=CLOSED, stage=completed)
3. The Update's WHERE clause is `id = X AND assignee_id IS NULL` — closing doesn't set an assignee, so `assignee_id IS NULL` is still true
4. Update succeeds: sets phase=IN_PROGRESS, stage=WORKING on a closed task

The task is silently reopened. The phase check at line 267 only runs against the stale snapshot. The optional version parameter mitigates this when used, but it's not required.

**Fix:** Add `task.PhaseNEQ(task.PhaseClosed)` to the Update's WHERE clause.

---

### H2. Wrong gRPC status code for CAS conflicts

**Files:** `internal/server/server.go:551`, `proto/farmtable.proto:564-565`

The proto documents CAS rejection as `ABORTED`:
```proto
// If set, the update is conditional: server rejects with ABORTED if
// the task's current version does not match.
```

But `storeErr()` maps `ErrConflict` to `codes.FailedPrecondition`. Per gRPC conventions, `ABORTED` is the correct code for concurrency-related conflicts (sequencer check failures, transaction aborts). `FAILED_PRECONDITION` means "fix the system state first" — wrong semantics for "retry with fresh version." The distinction matters for automated retry logic; agents following the proto spec would look for `ABORTED` and never see it.

---

### H3. No authentication or authorization at all

**Files:** `internal/server/server.go` (entire file), `cmd/farmtable-server/main.go:42`

The gRPC server is created with `grpc.NewServer()` — no interceptors. The CLI sends Bearer tokens via metadata (`connect.go:authCtx`), but the server never reads them. Any client can connect and perform any operation: create tasks, claim them, close them, read all data.

For embedded mode this is less critical (local process), but `farmtable-server` (main.go) listens on a TCP port and is fully open. The discussion log (Q8) documents "API token auth for v1" as a design decision, but it's not implemented.

---

### H4. `os.Exit()` in CLI command handlers prevents resource cleanup

**Files:** `internal/cli/errors.go:87,100`, all CLI command files

Every error path calls `exitError()` or `handleGRPCError()`, both of which call `os.Exit()`. This bypasses all deferred cleanup:
- `defer closer.Close()` — database connections, gRPC connections, and the embedded server leak
- In embedded mode, this means SQLite WAL checkpoints may not run, and the bufconn listener leaks

The idiomatic pattern is to return errors from `RunE` and let cobra handle exit codes. The current pattern makes every CLI error a resource leak.

---

### H5. No page_size cap enforced server-side

**File:** `internal/server/server.go:128-131`

The proto defines `int32 page_size = 12 [(buf.validate.field).int32 = {gte: 1, lte: 200}]` but there's no buf/validate interceptor registered. The server accepts any `page_size`, including `INT32_MAX`. A malicious or buggy client can request all records in a single page, causing unbounded memory allocation and potential OOM.

The server sets a default of 50 (line 129) when `page_size <= 0`, but never caps values above 0.

---

### H6. Config file written with world-readable permissions

**File:** `internal/cli/config.go:99`

`SaveConfigValue` writes the config file (which can contain the API token) with mode `0644`:
```go
return os.WriteFile(path, []byte(...), 0o644)
```

This makes the token readable by any user on the system. Should be `0600`.

---

## MEDIUM

### M1. `ListTasks` silently ignores most filter parameters

**Files:** `internal/server/server.go:127-198`, `internal/store/entstore.go:153-188`

The proto `ListTasksRequest` defines filters for: `collection_id`, `phase`, `stages` (repeated), `assignee`, `priority`, `type`, `labels`, `parent_task_id`, `sort_field`, `sort_order`, `full`. The server implementation handles only: `collection_id`, `phase`, `stages[0]` (first only), `assignee`. Everything else is silently dropped:

| Filter | Proto | Server | Store |
|--------|-------|--------|-------|
| priority | yes | ignored | not supported |
| type | yes | ignored | not supported |
| labels | yes | ignored | not supported |
| parent_task_id | yes | ignored | not supported |
| sort_field/order | yes | ignored | not supported |
| full | yes | ignored | always full NTO |
| stages (OR) | repeated | only [0] | single value |

The CLI sends all of these filters. Agents will construct filtered queries expecting results and get unfiltered data back without any error.

---

### M2. `CreateTask` silently ignores labels, dates, relationships, and code_context

**File:** `internal/server/server.go:33-83`

`CreateTaskRequest` includes `labels`, `due_date`, `start_date`, `blocks_task_ids`, `blocked_by_task_ids`, `repo`, `branch`, and `reason`. The server drops all of these. The CLI exposes them as flags (`--label`, `--due-date`, `--blocks`, `--repo`, etc.) and the user gets a successful response with none of these fields applied.

Similarly, `UpdateTask` ignores `add_labels`, `remove_labels`, `add_blocks`, `add_blocked_by`, `remove_relationships`, `due_date`, `start_date`, `repo`, `branch`, `add_pull_requests`, `ci_status`, and `reason`.

---

### M3. Offset-based pagination is unstable under concurrent writes

**Files:** `internal/server/server.go:565-582`, all List RPCs

Pagination uses base64-encoded offsets. This has known problems:
- If items are inserted or deleted between page fetches, results shift — items are skipped or duplicated
- Database performance degrades with large offsets (`OFFSET 10000` still scans 10000 rows)
- The offset tokens are trivially decodable (base64 of an integer), making them fragile to manipulation

Cursor-based pagination (keyset pagination using `created_at` + `id`) would be more correct and performant. The proto field is already named `page_token`, which suggests cursor semantics.

---

### M4. No audit trail — Changes are never written

**Files:** `internal/store/entstore.go` (entire file), `internal/server/server.go`

The `Change` entity exists in the schema, `ListChanges` is fully implemented at both store and RPC level, and the CLI has `--with-changes` and `--reason` flags. But no code path ever creates a Change record. The `reason` field from requests is silently discarded. The audit trail feature is a complete no-op — queries always return empty results.

The discussion log (Q1) identifies the Change audit trail as a key differentiator. It's architecturally present but not wired up.

---

### M5. `CloseTask` has no CAS protection without explicit version

**File:** `internal/store/entstore.go:298-340`

When `version` is empty (not provided by client), `CloseTask` reads the current task's version (line 305-312), computes `cv + 1` (line 316), but the WHERE clause is just `task.IDEQ(id)` — no version predicate. Between the Get and the Update, another update could change the version, and the close would overwrite it with `cv + 1` (which is now stale). The resulting version would be incorrect (lower than it should be), violating the monotonic version guarantee.

**Fix:** When version is not provided, either skip version management entirely or always add `task.VersionEQ(cur.Version)` to the WHERE clause.

---

### M6. `embeddedCloser.Close()` silently drops connection and server errors

**File:** `internal/cli/connect.go:146-150`

```go
func (c *embeddedCloser) Close() error {
    c.conn.Close()       // error ignored
    c.srv.Stop()         // not GracefulStop
    return c.store.Close()
}
```

Only the store's close error is returned. Connection close errors are silently discarded. Also uses `Stop()` instead of `GracefulStop()`, which forcibly terminates any in-flight RPCs rather than letting them complete.

---

### M7. Count query and data query are non-atomic in List operations

**File:** `internal/store/entstore.go:153-188` (and all other List methods)

All List methods first run `q.Count(ctx)` and then `q.All(ctx)` as separate database operations. Between the two queries, the data can change, resulting in:
- `total_count: 10` but returning 11 items (or 9)
- `has_more: true` when there are actually no more items

For SQLite with `SetMaxOpenConns(1)`, the single-connection serialization mitigates this. For Postgres, it's a real inconsistency.

---

### M8. `validStages()` returns stages in random order

**File:** `internal/cli/enums.go:155-161`

```go
func validStages() string {
    stages := make([]string, 0, len(stageValues))
    for k := range stageValues {
        stages = append(stages, k)
    }
    return strings.Join(stages, ", ")
}
```

Go map iteration order is randomized. Error messages listing valid stages will show a different order each time, which looks like a bug to users and makes error messages harder to parse for agents.

---

## LOW

### L1. Comment order parameter is silently ignored

**Files:** `internal/server/server.go:340-377`, `internal/store/entstore.go:414-431`

`ListCommentsRequest` has `SortOrder order = 4`. The CLI sends it (`comment.go:97-100`). The server doesn't pass it to the store. The store always orders by `created_at` ascending. Requesting `--order desc` does nothing.

---

### L2. `StoreOptions.Migrate` comment is wrong

**File:** `internal/store/entstore.go:27`

```go
Migrate bool // run schema migration on startup (default: true when zero value)
```

The zero value of `bool` in Go is `false`. The comment claims the default is `true`. All callers explicitly set `Migrate: true`, so behavior is correct, but the comment is misleading.

---

### L3. `description` field semantics — can't distinguish empty from absent

**Files:** `internal/store/ent/schema/task.go:26`, `internal/server/convert.go:197-199`

The Task schema sets `field.String("description").Optional().Default("")`. The proto uses `optional string description = 3`. In `taskToProto`:
```go
if t.Description != "" {
    pt.Description = &t.Description
}
```

An explicitly empty description and a never-set description are indistinguishable. Both result in `description: null` in the proto output. Minor semantic mismatch.

---

### L4. `truncate()` breaks multi-byte characters

**File:** `internal/cli/output.go:256-261`

```go
func truncate(s string, max int) string {
    if len(s) <= max {
        return s
    }
    return s[:max-1] + "..."
}
```

Uses `len(s)` (byte length) and `s[:max-1]` (byte slice). For multi-byte UTF-8 characters (common in non-English text), this can split a character mid-sequence, producing invalid UTF-8 in table output.

---

### L5. No unique constraint on collection name

**File:** `internal/store/ent/schema/collection.go`

Multiple collections can have the same name. `ensureDefaultCollection` (connect.go:134-143) checks `TotalCount > 0` — if any collection exists, it skips creation. But it doesn't verify a "default" collection specifically exists. If the first collection was created with a non-default name, no default collection is created, and `resolveCollectionFromServer` falls back to "use the only collection" logic (connect.go:64-68), which may or may not be correct.

---

### L6. `parseDate` doesn't handle timezones properly

**File:** `internal/cli/task.go:429-439`

```go
for _, layout := range []string{
    time.RFC3339,
    "2006-01-02T15:04:05Z",
    "2006-01-02",
} {
```

The `"2006-01-02"` layout parses dates in UTC by default (`time.Parse` uses UTC when no timezone info is present), which is fine. But `"2006-01-02T15:04:05Z"` treats `Z` as a literal character, not a timezone indicator. `time.Parse` with a literal `Z` in the layout will match the character `Z` but won't set the timezone to UTC. This can produce incorrect timestamps. Use `time.RFC3339` which handles `Z` correctly, or use `"2006-01-02T15:04:05-07:00"` as a fallback.

---

### L7. User schema has no relationships

**File:** `internal/store/ent/schema/user.go`

The User entity has fields but no edges. This means:
- Can't query "tasks assigned to user X" through Ent's relationship API
- Can't enforce foreign key constraints on `assignee_id` or `author_id`
- Users are never actually created in the database — all user IDs in tasks and comments are orphaned UUIDs

---

### L8. No context timeouts on database operations

**Files:** All store methods, all server methods

No method sets a context timeout. A slow or hanging database connection will block the gRPC handler indefinitely. For the embedded SQLite backend with `SetMaxOpenConns(1)`, a stuck connection blocks the entire application.

---

## Test Coverage Gaps

### T1. Zero CLI tests
No tests exist for any CLI command. The entire `internal/cli/` package is untested. This includes:
- Input parsing (`readInputValue`, `parseDate`, `parseStage`)
- Output formatting (`taskToMap`, `printTaskTable`)
- Config loading/saving
- Connection establishment (embedded and remote modes)
- Error handling and exit codes

### T2. No tests for concurrent access
All tests are single-goroutine sequential operations. The TOCTOU races documented above (H1, C1) are never exercised. A basic test that runs `ClaimTask` from two goroutines simultaneously would catch the race.

### T3. No tests for comment or change RPCs
`server_test.go` only tests Task and Collection RPCs. AddComment, ListComments, GetComment, and ListChanges have zero RPC-level test coverage.

### T4. No tests for clear operations
`UpdateTask`'s clear operations (`ClearPriority`, `ClearAssignee`, `ClearParent`, `ClearAcceptance`) are untested at both store and RPC levels.

### T5. No tests for embedded mode lifecycle
`connect.go:startEmbedded`, `ensureDefaultCollection`, and the `embeddedCloser` cleanup path are untested. The entire embedded mode — the default user experience — has no integration test.

### T6. No negative/edge-case tests
Missing: empty title creation, max-length strings, page_size=0 vs page_size=1 vs page_size=200+, deeply nested parent task chains, creating a task with a nonexistent collection ID (FK violation).
