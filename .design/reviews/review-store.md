# Store Layer Code Review

**Reviewer:** Code Review Agent  
**Date:** 2026-05-04  
**Scope:** `internal/store/store.go`, `internal/store/entstore.go`, `internal/store/entstore_test.go`, `internal/store/helpers.go`, `internal/store/schema/*.go`  
**Excluded:** Generated `internal/store/ent/*` files

---

## CRITICAL

### C1. TOCTOU race: version regression in unconditional updates

**File:** `internal/store/entstore.go:289-307`  
**Also affects:** `ClaimTask` (line 485), `CloseTask` (line 532)

When `p.Version == ""` (unconditional update), the new version is computed from a stale read:

```go
old, err := s.client.Task.Get(ctx, id)   // Read version "3"
// ...
// Meanwhile, concurrent request bumps version 3→4→5
v, _ := strconv.Atoi(old.Version)         // v = 3
update = update.SetVersion(strconv.Itoa(v + 1))  // Sets version to "4", regressing from "5"
```

Without a version predicate in the WHERE clause, the UPDATE succeeds and **regresses the version counter** from 5 back to 4. A subsequent CAS update with `Version: "4"` would then succeed even though it's based on stale state — defeating the entire purpose of CAS.

This affects all three mutation methods when called without a version:
- `UpdateTask` (line 304-306): no WHERE on version when `p.Version == ""`
- `ClaimTask` (line 485-488): version derived from stale read, no WHERE on version when `version == ""`
- `CloseTask` (line 532-536): same pattern

**Suggested fix:** Always include the version in the WHERE clause, even for unconditional updates. Compute `SetVersion` atomically from the matched row, or use the version from the WHERE match. If avoiding CAS semantics is the goal, use a database-level auto-increment or `SET version = version + 1` expression instead of read-then-write.

---

### C2. CreateTask and UpdateTask relationship mutations are not transactional

**File:** `internal/store/entstore.go:136-163` (CreateTask), `internal/store/entstore.go:395-448` (UpdateTask)

In `CreateTask`, the task is persisted first (line 136), then relationships are created in separate queries (lines 141-160). If a relationship creation fails (e.g., foreign key violation on a bad `targetID`), the task persists with incomplete relationships — an inconsistent state. The error is returned but no cleanup occurs.

In `UpdateTask`, the problem is worse: the task update, relationship additions (lines 407-426), relationship removals (lines 427-437), and audit trail writes (line 444) are all separate queries with no transaction boundary. A failure partway through leaves the database in a partially-updated state.

**Suggested fix:** Wrap each mutation method in an Ent transaction (`s.client.Tx(ctx)`). All writes within a single logical operation must succeed or fail atomically.

---

## HIGH

### H1. ListTasks label filtering is post-query — breaks pagination and total count

**File:** `internal/store/entstore.go:263-273`

Label filtering happens in application code *after* the database query returns, *after* limit/offset are applied:

```go
// DB returns up to p.Limit rows
tasks, err := q.All(ctx)

// Then filter in memory
if len(p.Labels) > 0 {
    var filtered []*ent.Task
    for _, t := range tasks {
        if hasAllLabels(t.Labels, p.Labels) {
            filtered = append(filtered, t)
        }
    }
    tasks = filtered
}

return tasks, total, nil  // total is from the DB count (line 244), not post-filter count
```

This has three consequences:
1. **`total` is wrong** — it reflects all tasks matching DB filters, not the label-filtered count. Clients using this for pagination will compute wrong page counts.
2. **Page size is short** — requesting limit=20 may return 3 results if 17 were filtered out. The client has no way to know whether there are more results.
3. **Pages can miss items or show duplicates** — offset-based pagination against a shrinking result set produces gaps.

**Suggested fix:** Either push label filtering into the SQL query (e.g., JSON containment operator for Postgres, or restructure labels into a join table), or remove labels from the WHERE-based pagination flow and do a full scan with application-level pagination (collecting all matching IDs first, then returning the requested page).

---

### H2. diffTask omits labels, pull_requests, and acceptance_criteria

**File:** `internal/store/entstore.go:668-774`

The audit trail function `diffTask` compares many fields but misses:
- **`labels`** — changes via `AddLabels`/`RemoveLabels` are silently unrecorded
- **`pull_requests`** — PR additions via `AddPullRequests` are silently unrecorded
- **`acceptance_criteria`** — updates via `SetAcceptanceCriteria`/`ClearAcceptance` are silently unrecorded

These are fields users would want to see in an audit trail. The gap means the change history is incomplete.

**Suggested fix:** Add comparisons for these fields. For JSON fields (`labels`, `pull_requests`), serialize to a canonical form (e.g., sorted JSON) and compare the strings.

---

### H3. No unique constraint on relationships — duplicates can be created

**File:** `internal/store/schema/relationship.go:40-45`

The relationship schema has indexes on `source_task_id` and `target_task_id` individually, but no composite unique constraint on `(source_task_id, target_task_id, type)`. This means:
- Calling `AddBlocks` with the same target twice creates two identical relationship rows
- There's no guard in `CreateTask` or `UpdateTask` against this

**Suggested fix:** Add a unique index:
```go
index.Fields("source_task_id", "target_task_id", "type").Unique(),
```
And handle the uniqueness violation gracefully in the store code (skip or upsert).

---

### H4. Pull request deduplication missing

**File:** `internal/store/entstore.go:383-394`

Adding pull requests simply appends to the existing slice without checking for duplicates:

```go
if len(p.AddPullRequests) > 0 {
    prs := old.PullRequests
    for _, pr := range p.AddPullRequests {
        prs = append(prs, map[string]string{...})
    }
    update.SetPullRequests(prs)
}
```

Calling `UpdateTask` twice with the same PR URL produces duplicate entries. There's also no way to remove or update a PR's status once added.

**Suggested fix:** Deduplicate by PR ID or URL before appending. Consider adding `RemovePullRequests` support in `UpdateTaskParams` for completeness.

---

### H5. CloseTask allows re-closing an already-closed task

**File:** `internal/store/entstore.go:518-569`

Unlike `ClaimTask` (which checks `old.Phase == task.PhaseClosed` and returns `ErrAlreadyClosed`), `CloseTask` has no guard against re-closing. The WHERE clause (line 534-535) is just `task.IDEQ(id)` — it will match already-closed tasks. Re-closing overwrites the `stage`, `closed_at`, and increments the version, potentially changing a "completed" task to "cancelled" with a new timestamp.

**Suggested fix:** Add `task.PhaseNEQ(task.PhaseClosed)` to the WHERE clause, or check `old.Phase` before the update and return `ErrAlreadyClosed`.

---

## MEDIUM

### M1. ListCollections, ListComments, and ListChanges don't Clone before Count

**File:** `internal/store/entstore.go:603, 645, 798`

`ListTasks` correctly uses `q.Clone().Count(ctx)` (line 244), but the other three list methods call `q.Count(ctx)` directly and then reuse `q` for `.All()`. In Ent, `Count()` may modify internal query state (e.g., clearing select columns). While this might work in current Ent versions, it's fragile and inconsistent.

```go
// ListCollections — line 603
total, err := q.Count(ctx)     // no Clone
// ...
cols, err := q.All(ctx)        // reusing q after Count

// vs ListTasks — line 244
total, err := q.Clone().Count(ctx)  // correct
```

**Suggested fix:** Use `q.Clone().Count(ctx)` consistently in all list methods.

---

### M2. GetReadyTasks and GetBlockedTasks have N+1 query problem

**File:** `internal/store/entstore.go:855-892` (GetReadyTasks), `internal/store/entstore.go:940-971` (GetBlockedTasks)

Both methods load all candidate tasks, then for each task iterate over relationships and call `s.client.Task.Get(ctx, rel.TargetTaskID)` or `s.client.Task.Get(ctx, rel.SourceTaskID)` for every relationship. With T tasks having R relationships each, this produces T + T*R database queries.

For a project with 100 open tasks averaging 3 relationships each, that's 400 queries per call.

**Suggested fix:** Batch-load all referenced task IDs in a single query, then look up from the result map. Alternatively, use Ent's eager loading on the relationship edges to load the related tasks in one query.

---

### M3. mergeLabels produces non-deterministic order

**File:** `internal/store/entstore.go:451-467`

The function iterates over a map to build the result slice. Go map iteration order is non-deterministic, so identical label sets produce different JSON representations across calls. This could cause:
- Spurious diffs in audit trails or API comparisons
- Non-reproducible test behavior (the test at line 497 sorts before checking, masking this)

**Suggested fix:** Sort the result slice before returning:
```go
sort.Strings(result)
return result
```

---

### M4. strconv.Atoi errors silently swallowed for version parsing

**File:** `internal/store/entstore.go:302, 305, 485, 532`

All version-to-int conversions use the pattern `v, _ := strconv.Atoi(...)`, discarding the error. If the version string is ever non-numeric (e.g., corrupted data, empty string), `v` becomes 0 and the next version becomes "1" — silently resetting the version counter.

**Suggested fix:** Return `ErrInvalidArgument` when `strconv.Atoi` fails, at least for the CAS path where the caller-supplied `p.Version` is parsed (line 302). For the `old.Version` path (line 305), this indicates data corruption and should log a warning.

---

### M5. No default sort order in ListTasks

**File:** `internal/store/entstore.go:217-242`

When `SortField` is empty, no ORDER BY is applied. Database engines don't guarantee any particular row order without ORDER BY, making pagination with limit/offset unreliable — tasks can shift between pages or appear twice.

**Suggested fix:** Add a default sort (e.g., `created_at ASC`) as a fallback when no sort field is specified.

---

### M6. repo and branch fields use empty string instead of nil for "not set"

**File:** `internal/store/schema/task.go:49-50`

```go
field.String("repo").Optional().Default(""),
field.String("branch").Optional().Default(""),
```

Unlike other optional fields (`priority`, `assignee_id`, `start_date`, etc.) which use `Nillable()`, repo and branch use `Optional().Default("")`. This means `ClearRepo()` (entstore.go:368) sets the value back to `""`, which is indistinguishable from "never set". The ent-generated `ClearRepo()` method may not even exist for non-Nillable optional string fields — or it may behave unexpectedly.

**Suggested fix:** Make these fields Nillable to match the pattern of other optional fields, or document that empty string means "not set."

---

### M7. RemoveRelationships is unidirectional — only removes source-side relationships

**File:** `internal/store/entstore.go:427-437`

```go
for _, targetID := range p.RemoveRelationships {
    _, err := s.client.Relationship.Delete().
        Where(
            relationship.SourceTaskIDEQ(id),
            relationship.TargetTaskIDEQ(targetID),
        ).Exec(ctx)
```

This only removes relationships where the current task is the *source*. If task B created a "blocks" relationship with source=B, target=A, removing from task A won't find it. The API caller would need to know the relationship's directionality to remove it, which is error-prone.

**Suggested fix:** Remove relationships matching either direction:
```go
Where(
    relationship.Or(
        relationship.And(relationship.SourceTaskIDEQ(id), relationship.TargetTaskIDEQ(targetID)),
        relationship.And(relationship.SourceTaskIDEQ(targetID), relationship.TargetTaskIDEQ(id)),
    ),
)
```

---

## LOW

### L1. collectionPlatform silently defaults to "farmtable" on unknown input

**File:** `internal/store/helpers.go:22`

Invalid platform strings are silently converted to `"farmtable"` instead of returning an error. This masks misconfiguration.

**Suggested fix:** Return an error for unknown platforms, or validate at the `CreateCollection` call site.

---

### L2. StoreOptions.Migrate comment is misleading

**File:** `internal/store/entstore.go:29`

The comment says `"run schema migration on startup (default: true when zero value)"` but `bool` zero value is `false`. Migration only runs when explicitly set to `true`.

**Suggested fix:** Fix the comment, or change the field to a `*bool` with nil meaning "default to true."

---

### L3. No tests for GetReadyTasks or GetBlockedTasks

**File:** `internal/store/entstore_test.go`

The test file has 22 tests covering CRUD, CAS, relationships, labels, dates, sorting, and audit trails — but zero tests for the graph query methods `GetReadyTasks` and `GetBlockedTasks`. These methods contain complex filtering logic (blocker resolution, relationship traversal) that is prone to bugs and should be tested.

**Suggested fix:** Add tests covering:
- Task with all blockers resolved → appears in ready results
- Task with open blockers → excluded from ready results
- Task with no relationships → appears in ready results (if stage matches)
- Bidirectional blocker resolution (both source/target relationship types)
- GetBlockedTasks returns correct blocker info
- Pagination (offset/limit) for both methods

---

### L4. UpdateTask with no actual changes still increments version

**File:** `internal/store/entstore.go:289-449`

Calling `UpdateTask` with an empty `UpdateTaskParams{}` (no field changes, no label changes, no relationship changes) still issues a database UPDATE that increments the version. This produces a version bump with no corresponding change, and `diffTask` would return an empty changeset — so `recordChanges` writes nothing to the audit trail, but the version has still incremented.

**Suggested fix:** After building the update, check if any fields were actually modified. If not, return the current task without issuing an UPDATE.

---

### L5. ClaimTask returns generic ErrConflict instead of specific error under concurrency

**File:** `internal/store/entstore.go:502-504`

If a task is claimed by another user between the `Get` (line 471) and the `Update` (line 494), the WHERE clause (`AssigneeIDIsNil()`) won't match, returning `n == 0 → ErrConflict`. The caller gets `ErrConflict` instead of the more informative `ErrAlreadyClaimed`. The early checks on lines 478-483 provide the right errors for the non-concurrent case, but under concurrency the error type degrades.

**Suggested fix:** When `n == 0`, re-fetch the task to determine the actual reason (already claimed vs. already closed vs. version mismatch) and return the appropriate error.

---

### L6. Audit trail for UpdateTask always records author as uuid.Nil

**File:** `internal/store/entstore.go:444`

```go
if err := s.recordChanges(ctx, id, uuid.Nil, old, result); err != nil {
```

`UpdateTaskParams` has no `AuthorID` field, so every update is recorded with a nil author. The audit trail can't attribute updates to specific users. `ClaimTask` does pass the assignee as author (line 511), showing the pattern is supported.

**Suggested fix:** Add an `AuthorID` field to `UpdateTaskParams` and `CloseTask`, and thread it through to `recordChanges`.

---

## Test Coverage Assessment

The test suite (22 tests, ~1,080 lines) covers:
- **Good:** CRUD basics, CAS version semantics, claim/close lifecycle, labels (add/remove/AND-filter), dates (set/clear), relationships (add/remove), sorting, audit trail recording for all mutation types, error cases (not found, already claimed, already closed, invalid close stage)
- **Missing:** GetReadyTasks, GetBlockedTasks (graph queries), concurrent access patterns, pagination edge cases, pull request operations, CI status updates, repo/branch operations

---

## Summary

| Severity | Count | Key Themes |
|----------|-------|------------|
| CRITICAL | 2 | Version regression under concurrency; no transaction boundaries |
| HIGH | 5 | Label filter breaks pagination; audit trail gaps; duplicate relationships; re-close allowed |
| MEDIUM | 7 | Missing Clone; N+1 queries; non-deterministic labels; version parsing; no default sort |
| LOW | 6 | Missing tests; misleading defaults; weak error types; nil author in audit trail |
