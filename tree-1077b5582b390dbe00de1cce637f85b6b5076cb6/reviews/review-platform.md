# Review: Platform Adapter Layer (Group 4)

**Reviewer:** code-review agent
**Date:** 2026-05-04
**Files reviewed:**
- `internal/platform/platform.go`
- `internal/platform/github/github.go`
- `internal/platform/github/github_test.go`

---

## Critical

### C1. GitHub labels are not mapped to NTO `Labels` field
**File:** `internal/platform/github/github.go:136-156` (IssueToCreateParams), `:159-184` (IssueToUpdateParams)
**Severity:** Critical

GitHub issue labels are stored into `RemoteData["labels"]` (a bag of metadata) but are never mapped to the NTO `Labels []string` field on `CreateTaskParams` / `UpdateTaskParams`. This means labels are invisible to any query that filters by `Labels` (e.g. `ListTasks` with a label filter), and the sync effectively drops structured label data.

**Fix:** In `IssueToCreateParams`, populate `p.Labels`:
```go
for _, l := range issue.Labels {
    p.Labels = append(p.Labels, l.GetName())
}
```
In `IssueToUpdateParams`, populate `p.AddLabels` with the current set of labels (and consider clearing stale labels via `p.RemoveLabels` or replacing the full set).

---

### C2. `Repo` and `Branch` fields not populated on sync
**File:** `internal/platform/github/github.go:136-156`
**Severity:** Critical

`CreateTaskParams` has `Repo` and `Branch` fields. The adapter knows the `owner/repo` but never sets `p.Repo`. For GitHub Issues (as opposed to PRs), `Branch` is admittedly N/A, but `Repo` should be set — it's a first-class field the server/CLI use for filtering and display.

**Fix:**
```go
p.Repo = fmt.Sprintf("%s/%s", a.owner, a.repo)  // in IssueToCreateParams — needs access to adapter fields
```
Since `IssueToCreateParams` is currently a free function, either pass `owner`/`repo` as parameters or make it a method on `GitHubAdapter`.

---

## High

### H1. No rate-limit handling for GitHub API calls
**File:** `internal/platform/github/github.go:63-64` (SyncCollection), `:106` (PushTask), `:126` (PushComment)
**Severity:** High

All GitHub API calls (`Issues.ListByRepo`, `Issues.Edit`, `Issues.Create`, `Issues.CreateComment`) return a `*github.Response` that includes `Rate` information, but the adapter never inspects it. When the rate limit is hit, the raw GitHub 403 error propagates with no retry or backoff. For a sync of a large repo (thousands of issues), this is almost guaranteed to happen.

**Fix:** At minimum, check `resp.Rate.Remaining` after each page fetch in `SyncCollection` and sleep until `resp.Rate.Reset` if exhausted. Alternatively, use `go-github`'s built-in rate-limit transport or a waiter. For `PushTask`/`PushComment`, detect the `*github.RateLimitError` and return a typed error so callers can retry.

---

### H2. `deterministicUUID` creates phantom user IDs with no corresponding user record
**File:** `internal/platform/github/github.go:288-289`
**Severity:** High

`deterministicUUID` maps GitHub logins to UUIDs and stores them in `AssigneeID`. But the store has no "users" table — `AssigneeID` is a bare UUID field, not a foreign key to a user entity. This means:

1. The UUID is stable (good), but it references nothing — queries like "list tasks by assignee" work only by coincidence of the same UUID being generated again.
2. There's no way to resolve the UUID back to a GitHub login without digging into `RemoteData` of every task for that user.
3. If a different platform adapter uses a different namespace or scheme, the same human could get two unrelated assignee UUIDs.

**Fix (short term):** Store the GitHub login in `RemoteData["assignee_login"]` alongside the deterministic UUID so it can be resolved. **Fix (long term):** Add a lightweight user/identity table or store assignee as a string identifier rather than a UUID.

---

### H3. `SyncOptions.FullSync` is accepted but never used
**File:** `internal/platform/platform.go:23`, `internal/platform/github/github.go:42-98`
**Severity:** High

`SyncOptions.FullSync` is defined in the interface contract but the GitHub adapter ignores it. The adapter always fetches `State: "all"` regardless of `FullSync`. If `FullSync` is `false`, the adapter should respect the `Since` filter and potentially skip closed issues.

**Fix:** Document the semantics of `FullSync` and implement them. For example, when `FullSync` is `false` and `Since` is nil, default `Since` to the last sync timestamp (which implies tracking it). When `FullSync` is `true`, ignore `Since` and re-fetch everything.

---

### H4. `updated_at` not stored — no way to do incremental sync correctly
**File:** `internal/platform/github/github.go:222-243` (buildRemoteData)
**Severity:** High

`buildRemoteData` stores `created_at` but not `updated_at` from the GitHub issue. Without persisting the latest `updated_at` seen during a sync, there's no reliable value to use for `SyncOptions.Since` on the next incremental sync. The caller has to guess or always do a full sync.

**Fix:** Store `updated_at` in remote data:
```go
rd["updated_at"] = issue.GetUpdatedAt().Format(time.RFC3339)
```
And consider persisting the high-water mark on the collection or adapter state so the next sync can pick up where it left off.

---

## Medium

### M1. Interface couples to Ent entities — not general for non-GitHub platforms
**File:** `internal/platform/platform.go:12-20`
**Severity:** Medium

The `Adapter` interface takes and returns `*ent.Task` and `*ent.Comment` directly. A Jira or Linear adapter would need to import the Ent ORM layer, which tightly couples the platform abstraction to the storage implementation. A more general interface would use the store's param types (e.g., `store.CreateTaskParams`) or its own platform-neutral DTOs.

The `PushTask`/`PushComment` methods take Ent entities as input, meaning any future adapter must accept Ent types even if the adapter has nothing to do with Ent.

**Fix (deferred OK):** Replace `*ent.Task` with a platform-neutral struct or the store param types. This is a design decision that can wait until a second adapter is needed, but it's worth flagging as a known coupling.

---

### M2. `SyncCollection` continues on individual task errors but provides no detail
**File:** `internal/platform/github/github.go:77-89`
**Severity:** Medium

When `CreateTask` or `UpdateTask` fails for a single issue, the adapter increments `result.Errors` and `continue`s, but the error is silently swallowed. The caller gets a count of errors but no detail about which issues failed or why. For debugging sync issues, this is unhelpful.

**Fix:** Accumulate errors into a slice on `SyncResult` (e.g., `SyncResult.ErrorDetails []SyncError` with issue number and error message), or log them. At minimum, wrap and return a multi-error if any failures occurred.

---

### M3. `buildRemoteIDIndex` does a full table scan — no dedicated query
**File:** `internal/platform/github/github.go:296-322`
**Severity:** Medium

To build the `remoteID → taskID` index, the adapter pages through *all* tasks in the collection via `ListTasks`, reading every field. For large collections (10k+ tasks), this is expensive. A dedicated store method like `ListRemoteIDs(collectionID) map[string]uuid.UUID` that selects only `id` and `remote_data` would be much cheaper.

**Fix (deferred OK):** Add a dedicated store query that returns only `(id, remote_data)` pairs, or add a `remote_id` column to the task table for direct indexing. For now, the current approach works for moderate-sized collections.

---

### M4. `PushComment` doesn't handle updating existing comments
**File:** `internal/platform/github/github.go:120-133`
**Severity:** Medium

`PushComment` always calls `CreateComment` — it never checks if the comment already exists on the issue (e.g., via a remote comment ID). If sync runs twice, comments may be duplicated on GitHub.

**Fix:** Store the remote comment ID on the `Comment` entity (in its own `RemoteData` or a dedicated field), and call `Issues.EditComment` when updating.

---

### M5. `New()` uses `context.Background()` for OAuth client
**File:** `internal/platform/github/github.go:31`
**Severity:** Medium

The OAuth HTTP client is created with `context.Background()`, which means it can't be cancelled by the caller's context. If the adapter is created during a request lifecycle, this context should be propagated.

**Fix:** Accept a `context.Context` parameter in `New()` or use a transport-level approach that doesn't bind a context at construction time. The `go-github` client uses the per-request context for actual API calls, so the practical impact is limited to token refresh flows, but it's still a best-practice violation.

---

## Low

### L1. `issueStateToPhaseStage` maps everything non-"closed" to Triage
**File:** `internal/platform/github/github.go:206-213`
**Severity:** Low

GitHub has exactly two states (`open`, `closed`), but GitHub Projects and issue metadata (e.g., "in progress" labels, project board columns) can provide richer status. Currently, all open issues land in `PhaseOpen / StageTriage` regardless. Consider mapping specific labels (e.g., `in-progress`, `blocked`) to appropriate phases/stages for richer initial triage.

This is a design choice rather than a bug — flagging for product consideration.

---

### L2. `extractIssueNumber` doesn't handle `json.Number` parse error
**File:** `internal/platform/github/github.go:283-284`
**Severity:** Low

The `json.Number` case silently ignores parse errors (`n, _ := v.Int64()`). If the JSON contains a malformed number, this returns 0 with no indication of why.

**Fix:** Log or return the error:
```go
n, err := v.Int64()
if err != nil {
    return 0 // or log the error
}
return int(n)
```

---

### L3. `deterministicUUID` uses `uuid.NameSpaceURL` — semantically incorrect
**File:** `internal/platform/github/github.go:288-289`
**Severity:** Low

`uuid.NameSpaceURL` is for URL-shaped names (per RFC 4122). The input `"github:user:alice"` is not a URL. This won't cause collisions, but `uuid.NameSpaceDNS` or a custom namespace UUID would be more semantically correct and would avoid any theoretical overlap with real URL-based UUIDs used elsewhere.

**Fix:** Define a custom namespace UUID constant for FarmTable user mapping:
```go
var farmtableUserNS = uuid.MustParse("...some-random-uuid...")
```

---

### L4. Test file has no test for `SyncCollection` or `PushTask`/`PushComment`
**File:** `internal/platform/github/github_test.go`
**Severity:** Low

The test file covers mapping functions (`IssueToCreateParams`, `IssueToUpdateParams`, `TaskToIssueRequest`, `extractIssueNumber`, `deterministicUUID`, `extractLabels`) thoroughly, but has no tests for the adapter methods themselves (`SyncCollection`, `PushTask`, `PushComment`). These would require mocking the GitHub client or the store, which is understandable for a first pass, but should be added.

---

## Summary

| Severity | Count | Items |
|----------|-------|-------|
| Critical | 2     | C1, C2 |
| High     | 4     | H1, H2, H3, H4 |
| Medium   | 5     | M1, M2, M3, M4, M5 |
| Low      | 4     | L1, L2, L3, L4 |

**Recommended immediate fixes:** C1 (labels not mapped), C2 (repo not populated), H1 (rate-limit handling), H4 (store updated_at for incremental sync). The remaining High and Medium items can be deferred to a hardening pass but should be tracked.
