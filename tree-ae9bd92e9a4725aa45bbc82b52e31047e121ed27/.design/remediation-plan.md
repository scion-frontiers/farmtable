# Remediation Plan

**Date:** 2026-05-04
**Input:** 5 review reports in `.design/reviews/`
**Goal:** Fix all critical and high issues before committing. Defer medium/low with tracking notes.

---

## Remediation Agent 1: Store Fixes

**Files:** `internal/store/entstore.go`, `internal/store/store.go`, `internal/store/schema/relationship.go`, `internal/store/entstore_test.go`

### Fix list:

**STORE-C1 (Critical): Version regression in unconditional updates**
In `UpdateTask`, `ClaimTask`, `CloseTask` — when version is empty, the current read-then-write pattern can regress the version counter under concurrency. Fix: always include the read version in the WHERE clause, even for unconditional updates. This makes unconditional updates "last-write-wins" but prevents version regression:
```go
// For unconditional update:
cur, err := s.client.Task.Get(ctx, id)
v, _ := strconv.Atoi(cur.Version)
update = update.Where(task.VersionEQ(cur.Version))  // ADD THIS
update = update.SetVersion(strconv.Itoa(v + 1))
```
If the WHERE doesn't match (concurrent write bumped version), retry once by re-reading the current version. If it still fails, return ErrConflict. This prevents regression while keeping unconditional semantics (caller doesn't need to know the version).

**STORE-C2 (Critical): No transaction boundaries**
Wrap `CreateTask` and `UpdateTask` in Ent transactions. Use `s.client.Tx(ctx)` and operate on the transaction client:
```go
tx, err := s.client.Tx(ctx)
if err != nil { return nil, err }
defer tx.Rollback()
// ... all creates/updates on tx instead of s.client ...
if err := tx.Commit(); err != nil { return nil, err }
```

**STORE-H2 (High): diffTask missing fields**
Add comparisons for: `acceptance_criteria`, `labels` (serialize to sorted JSON string for comparison), `pull_requests` (serialize to JSON string).

**STORE-H3 (High): No unique constraint on relationships**
Add composite unique index to `internal/store/schema/relationship.go`:
```go
index.Fields("source_task_id", "target_task_id", "type").Unique(),
```
Run `go generate ./internal/store/ent` after schema change. In entstore.go, handle uniqueness violations on relationship creation gracefully (skip duplicate, don't error).

**STORE-H5 (High): CloseTask allows re-closing**
Add guard in CloseTask, same as ClaimTask pattern:
```go
if cur.Phase == task.PhaseClosed {
    return nil, ErrAlreadyClosed
}
```

**Quick wins (Medium):**
- M1: Use `q.Clone().Count(ctx)` in ListCollections, ListComments, ListChanges
- M3: Sort label slice in `mergeLabels` before returning (`sort.Strings(result)`)
- M5: Add default sort `task.ByCreatedAt()` when SortField is empty

### Tests to update:
- Update TestUpdateTask_CAS to verify version never regresses
- Verify relationship unique constraint prevents duplicates
- Verify re-closing returns ErrAlreadyClosed

---

## Remediation Agent 2: Server + Auth Fixes

**Files:** `internal/server/server.go`, `internal/server/auth.go`, `internal/server/convert.go`, `internal/server/server_test.go`

### Fix list:

**S-01/INFRA-1 (Critical): Timing-unsafe token comparison**
In `auth.go`, replace string `!=` with `crypto/subtle.ConstantTimeCompare`:
```go
import "crypto/subtle"

if subtle.ConstantTimeCompare([]byte(token), []byte(validToken)) != 1 {
    return nil, status.Error(codes.Unauthenticated, "invalid token")
}
```

**INFRA-2 (Medium): Bearer prefix validation**
In `auth.go`, validate the `Bearer ` prefix explicitly before trimming:
```go
val := auth[0]
if !strings.HasPrefix(val, "Bearer ") {
    return nil, status.Error(codes.Unauthenticated, "authorization must use Bearer scheme")
}
token := strings.TrimPrefix(val, "Bearer ")
```

**S-03/S-04 (High): Unbounded recursion in graph RPCs**
Add `maxDepth` parameter (default 100) to `findLongestBlocksChain` and `countDownstream`. Bail when exceeded.

**S-05 (High): Incorrect critical path algorithm**
Fix the visited map: use backtracking (mark on entry, unmark on exit) instead of a permanent visited set. This correctly finds the longest path on a DAG:
```go
func (s *FarmTableService) findLongestBlocksChain(ctx context.Context, taskID uuid.UUID, onStack map[uuid.UUID]bool, depth, maxDepth int) []criticalPathEntry {
    if onStack[taskID] || depth >= maxDepth { return nil }
    onStack[taskID] = true
    defer func() { onStack[taskID] = false }()
    // ... recurse, track longest child chain ...
}
```

**S-06 (High): Unbounded task loading in GetCriticalPath/GetBottlenecks**
Cap total loaded tasks to 500. If collection has more non-closed tasks, return an error suggesting the caller narrow the scope.

**Quick wins (Medium):**
- S-09: Replace inline page token decoding in ListTasks with `decodePageToken` helper
- S-11: Don't leak internal errors in storeErr fallback — log full error, return generic message
- S-16: Validate page token offset is non-negative in `decodePageToken`
- INFRA-5: Add warning log in `cmd/farmtable-server/main.go` when FARMTABLE_TOKEN is empty

**Explicitly deferred:**
- S-02 (random UUIDs for actor identity): This is the known C2 deferral from the hardening sprint. Requires auth context → user identity mapping design. NOT a regression — tracked in Batch 3.
- S-07 (no stream interceptor): No streaming RPCs exist yet. Add when needed.
- S-08 (ListTasks stages filter): Document as single-stage only for now.
- S-12 (relationship type inversion): Cosmetic — defer to next pass.
- S-13 (N+1 in graph RPCs): Acceptable with depth limits in place. Optimize later.

---

## Remediation Agent 3: CLI + Platform Fixes

**Files:** `internal/cli/task.go`, `internal/cli/config.go`, `internal/cli/connect.go`, `internal/cli/config_cmd.go`, `internal/platform/github/github.go`

### Fix list:

**PLATFORM-C1 (Critical): Labels not mapped to NTO**
In `IssueToCreateParams`, map GitHub labels to `p.Labels`:
```go
for _, l := range issue.Labels {
    p.Labels = append(p.Labels, l.GetName())
}
```
In `IssueToUpdateParams`, set `p.AddLabels` from current issue labels.

**PLATFORM-C2 (Critical): Repo not populated**
Pass `owner` and `repo` to `IssueToCreateParams` (change signature or make it a method). Set `p.Repo = owner + "/" + repo`.

**CLI-H1 (High): Invalid sort/order silently ignored**
Add validation for `--sort` and `--order` flags — return exitError if value not in valid set.

**CLI-H2 (High): Config permissions on pre-existing files**
After `os.WriteFile`, call `os.Chmod(path, 0o600)`.

**Quick wins (Medium):**
- CLI-M1: Aggregate errors in embeddedCloser.Close() with `errors.Join`
- CLI-M4: Change `config path` command from `Run` to `RunE`
- PLATFORM-H4: Store `updated_at` in remote_data for incremental sync support

**Explicitly deferred:**
- PLATFORM-H1 (rate limiting): Important but complex. Track for next sprint.
- PLATFORM-H2 (phantom user IDs): Known limitation until user/identity table exists.
- PLATFORM-H3 (FullSync semantics): Document current behavior, implement when sync state tracking is added.
- PLATFORM-M1 (Adapter couples to Ent): Design decision deferred until second adapter.
- CLI-M2 (resolveDBPath error handling): Low risk in practice, defer.
- CLI-M3 (IPv6 localhost): Edge case, defer.
- CLI-M5 (config loaded multiple times): Performance, not correctness. Defer.

---

## Process

1. All 3 remediation agents run in parallel — no file overlap
2. Each agent must run `go generate ./internal/store/ent` if schema changes (Agent 1 only)
3. Each agent must verify `go build ./...` and `go test ./...` pass
4. After all 3 complete, fm creates commits and pushes
