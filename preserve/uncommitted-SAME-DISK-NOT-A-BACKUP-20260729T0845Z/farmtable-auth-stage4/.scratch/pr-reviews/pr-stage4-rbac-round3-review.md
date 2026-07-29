# Code Review: auth/stage4-scoped-tokens-rbac — Round 3

**Branch:** `auth/stage4-scoped-tokens-rbac`
**Commit:** `d8651df` (fix: complete collection access enforcement across all RPC handlers)
**Reviewer:** code-reviewer
**Date:** 2026-07-23
**Round:** 3 of N

---

## Review Summary

**Verdict:** REQUEST CHANGES

**Overview:** Round 2 fixes (d8651df) correctly close the 6 previously identified gaps — WatchTasks, task-by-ID handlers, linked account handlers, GetReadyTasks/GetBlockedTasks, and ListCollections pagination. However, a systematic handler-by-handler audit reveals 3 remaining authorization bypass vectors: `ListTasks` without a `collection_id` filter, `GetComment` by ID, and `ListChanges` by `task_id` — all of which allow collection-scoped tokens to read data from collections they should not access.

---

## Handler-by-Handler Audit (Full Coverage Table)

| Handler | Collection Check | Status |
|---------|-----------------|--------|
| CreateTask | `RequireCollectionAccess(ctx, collID)` | ✅ |
| InsertTasksAfter | `RequireCollectionAccess(ctx, collID)` | ✅ |
| GetTask | Post-fetch `RequireCollectionAccess(ctx, t.CollectionID)` | ✅ |
| **ListTasks** | Only when `collection_id` is specified | ❌ **Gap** |
| UpdateTask | Post-fetch `RequireCollectionAccess(ctx, existing.CollectionID)` | ✅ |
| ClaimTask | Post-fetch `RequireCollectionAccess(ctx, existing.CollectionID)` | ✅ |
| CloseTask | Post-fetch `RequireCollectionAccess(ctx, existing.CollectionID)` | ✅ |
| DeleteTask | Returns `Unimplemented` | N/A |
| AddComment | Post-fetch via task `RequireCollectionAccess(ctx, t.CollectionID)` | ✅ |
| ListComments | Post-fetch via task `RequireCollectionAccess(ctx, t.CollectionID)` | ✅ |
| **GetComment** | None | ❌ **Gap** |
| GetCollection | `RequireCollectionAccess(ctx, id)` | ✅ |
| ListCollections | Post-fetch filter + corrected pagination | ✅ |
| CreateCollection | Creates new collection, no check needed | N/A |
| UpdateCollection | `RequireCollectionAccess(ctx, id)` | ✅ |
| CreateLinkedAccount | `RequireCollectionAccess(ctx, collID)` | ✅ |
| GetLinkedAccount | Post-fetch `RequireCollectionAccess(ctx, la.CollectionID)` | ✅ |
| DeleteLinkedAccount | Post-fetch `RequireCollectionAccess(ctx, la.CollectionID)` | ✅ |
| ListLinkedAccounts | `RequireCollectionAccess` when `collection_id` specified + post-fetch filter | ✅ |
| **ListChanges** | None (takes `task_id` but no collection check) | ❌ **Gap** |
| WhoAmI | User-specific, no collection data | N/A |
| ListUsers | User management, not collection-scoped | N/A |
| GetUser | User management, not collection-scoped | N/A |
| GetReadyTasks | Guard + `RequireCollectionAccess` | ✅ |
| GetBlockedTasks | Guard + `RequireCollectionAccess` | ✅ |
| GetDependencyTree | Post-fetch `RequireCollectionAccess(ctx, t.CollectionID)` | ✅ |
| GetCriticalPath | `RequireCollectionAccess(ctx, collID)` | ✅ |
| GetBottlenecks | `RequireCollectionAccess(ctx, collID)` | ✅ |
| WatchTasks | `RequireCollectionAccess` + `CollectionIDsFromContext` guard | ✅ |
| ExportCollection | `RequireCollectionAccess(ctx, collectionID)` | ✅ |
| ImportCollection | Creates new collection, uses `ScopeCollectionAdmin` | N/A |
| GetVersion | Unauthenticated endpoint | N/A |
| GetStatus | Unauthenticated endpoint | N/A |

---

## Critical Issues

### 1. [Critical] `ListTasks` allows collection-scoped tokens to list tasks across all collections

**File:** `internal/server/server.go:336-452`

`ListTasks` checks `RequireCollectionAccess` only when `collection_id` is specified (line 364), but has no guard for collection-scoped tokens that omit `collection_id`. A token restricted to collection A can call `ListTasks({})` and receive tasks from collections B, C, etc.

This is the same pattern that was fixed for `GetReadyTasks` (line 1389-1394) and `GetBlockedTasks` (line 1499-1504) in this commit, but `ListTasks` was missed.

**Impact:** Direct data leak across collection boundaries. An attacker with a collection-scoped token can enumerate all tasks in the system.

**Suggested Fix:**
```go
func (s *FarmTableService) ListTasks(ctx context.Context, req *pb.ListTasksRequest) (*pb.ListTasksResponse, error) {
    if err := RequireScope(ctx, ScopeTaskRead); err != nil {
        return nil, err
    }
+   // Collection-scoped tokens must specify a collection_id.
+   if req.CollectionId == nil {
+       if ids := CollectionIDsFromContext(ctx); len(ids) > 0 {
+           return nil, status.Error(codes.InvalidArgument,
+               "collection-scoped tokens must specify collection_id")
+       }
+   }
    pageSize := int(req.GetPageSize())
    // ...
```

---

## Important Issues

### 2. [Important] `GetComment` has no collection access check

**File:** `internal/server/server.go:845-859`

`GetComment` fetches a comment by ID and returns it without verifying the calling token has access to the comment's parent task's collection. A collection-scoped token can read any comment in the system if the comment UUID is known.

**Impact:** Data leak for comment content across collection boundaries. Lower exploitability than ListTasks (requires knowing a comment UUID), but still a bypass of the access model.

**Suggested Fix:**
```go
func (s *FarmTableService) GetComment(ctx context.Context, req *pb.GetCommentRequest) (*pb.Comment, error) {
    if err := RequireScope(ctx, ScopeTaskRead); err != nil {
        return nil, err
    }
    id, err := uuid.Parse(req.GetId())
    if err != nil {
        return nil, status.Errorf(codes.InvalidArgument, "invalid comment id: %v", err)
    }
    c, err := s.store.GetComment(ctx, id)
    if err != nil {
        return nil, storeErr(err, "comment")
    }
+   // Verify the token has access to the comment's task's collection.
+   if t, err := s.store.GetTask(ctx, c.TaskID); err != nil {
+       return nil, storeErr(err, "task")
+   } else if err := RequireCollectionAccess(ctx, t.CollectionID); err != nil {
+       return nil, err
+   }
    return commentToProto(c), nil
}
```

### 3. [Important] `ListChanges` has no collection access check

**File:** `internal/server/server.go:1219-1264`

`ListChanges` takes a `task_id` and returns audit trail entries without verifying the calling token has access to the task's collection. Combined with the `ListTasks` bypass (Issue #1), an attacker can discover task IDs from other collections and then read their full change history.

**Impact:** Audit trail data leak across collection boundaries. Exploitable in combination with Issue #1.

**Suggested Fix:**
```go
func (s *FarmTableService) ListChanges(ctx context.Context, req *pb.ListChangesRequest) (*pb.ListChangesResponse, error) {
    if err := RequireScope(ctx, ScopeTaskRead); err != nil {
        return nil, err
    }
    taskID, err := uuid.Parse(req.GetTaskId())
    if err != nil {
        return nil, status.Errorf(codes.InvalidArgument, "invalid task_id: %v", err)
    }
+   // Verify the token has access to the task's collection.
+   if t, err := s.store.GetTask(ctx, taskID); err != nil {
+       return nil, storeErr(err, "task")
+   } else if err := RequireCollectionAccess(ctx, t.CollectionID); err != nil {
+       return nil, err
+   }
    pageSize := int(req.GetPageSize())
    // ...
```

---

## Suggestions

### 4. [Suggestion] `ListLinkedAccounts` has same pagination bug that was fixed in `ListCollections`

**File:** `internal/server/server.go:1209-1213`

When `ListLinkedAccounts` does post-fetch filtering (line 1188-1201), the `has_more` check at line 1209 uses `len(accounts) == pageSize` on the *filtered* result set. If the store returns a full page (50 items) but filtering reduces it to, say, 3 items, `has_more` is incorrectly set to `false` — the client stops paginating even though more matching results may exist on later pages.

This is the exact same bug that was fixed for `ListCollections` in this commit (lines 920, 945-953 using `storeFull`), but the same pattern was not applied to `ListLinkedAccounts`.

**Suggested Fix:** Apply the same `storeFull` pattern used in `ListCollections`:
```go
    allowedIDs := CollectionIDsFromContext(ctx)
    // ...
    accounts, total, err := s.store.ListLinkedAccounts(ctx, p)
    // ...
+   storeFull := len(accounts) == pageSize
    if req.CollectionId == nil && len(allowedIDs) > 0 {
        // ... filtering ...
    }
    // ...
-   if len(accounts) > 0 && len(accounts) == pageSize {
+   if len(allowedIDs) > 0 && req.CollectionId == nil {
+       if storeFull && len(accounts) > 0 {
+           last := accounts[len(accounts)-1]
+           resp.HasMore = true
+           resp.NextPageToken = encodeCursor(last.ID.String(), last.CreatedAt.UTC().Format(time.RFC3339Nano))
+       }
+   } else if len(accounts) > 0 && len(accounts) == pageSize {
        last := accounts[len(accounts)-1]
        resp.HasMore = true
        resp.NextPageToken = encodeCursor(last.ID.String(), last.CreatedAt.UTC().Format(time.RFC3339Nano))
    }
```

---

## What's Done Well

- **Consistent post-fetch pattern for task-by-ID handlers.** The pattern of fetching the task first, then calling `RequireCollectionAccess(ctx, t.CollectionID)` is applied consistently across `GetTask`, `UpdateTask`, `ClaimTask`, `CloseTask`, `AddComment`, `ListComments`, and `GetDependencyTree`. This is the right approach for ID-based lookups.

- **`WatchTasks` dual guard is correct and robust.** The fix correctly handles both cases: (a) when `collection_id` is provided, it calls `RequireCollectionAccess`, and (b) when `collection_id` is absent but the token is collection-scoped, it returns `PermissionDenied`. The error code choice (`PermissionDenied` vs. `InvalidArgument` for the stateless handlers) is appropriate since the streaming endpoint has security implications beyond just query correctness.

- **`ListCollections` pagination fix is well-reasoned.** The `storeFull` approach correctly handles the case where post-fetch filtering reduces the result count below `pageSize`. The comment explaining that `total` is an approximation is honest and helpful for future maintainers.

- **Comprehensive test coverage.** The `rbac_test.go` file covers wildcard tokens, nil scopes (backward compatibility), specific scope enforcement, collection scoping, claim scope, admin scope, and store-level persistence. The test structure is clean and tests are clearly named.

- **Auth interceptor correctly propagates collection IDs.** Both unary (`TokenAuthInterceptor`) and stream (`TokenAuthStreamInterceptor`) interceptors call `ContextWithCollectionIDs`, ensuring the RBAC context is available to all handler types.

---

## Verification Story

- **Tests reviewed:** Yes — `rbac_test.go` has 608 lines of well-structured tests. Tests cover scope and collection enforcement, backward compatibility, and store-level persistence. No tests exist yet for the 3 identified gaps (ListTasks without collection_id, GetComment, ListChanges).
- **Build verified:** Yes — `go build ./...` passes cleanly.
- **Tests pass:** Yes — `go test ./internal/server/ -count=1` passes (0.510s).
- **Security checked:** Yes — systematic handler audit completed (table above). 3 authorization bypass vectors identified.

---

## Summary of Findings by Severity

| # | Severity | Handler | Issue |
|---|----------|---------|-------|
| 1 | **Critical** | `ListTasks` | Collection-scoped tokens can list all tasks without specifying `collection_id` |
| 2 | **Important** | `GetComment` | No `RequireCollectionAccess` — leaks comments across collections |
| 3 | **Important** | `ListChanges` | No `RequireCollectionAccess` — leaks audit trail across collections |
| 4 | **Suggestion** | `ListLinkedAccounts` | Post-fetch filtering breaks pagination (same bug fixed in `ListCollections`) |
