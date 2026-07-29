# Code Review: auth/stage4-scoped-tokens-rbac (Round 2)

## Review Summary

**Verdict:** REQUEST CHANGES

**Overview:** Stage 4 adds scoped tokens and basic RBAC with scope-based and collection-based access control across ~1400 new lines. The Round 1 fixes (commit 19b0a78) correctly addressed the 6 missing `RequireCollectionAccess` calls, but two handlers that accept `collection_id` still lack collection access checks, and task-by-ID handlers allow collection-scoped tokens to bypass collection restrictions entirely.

---

## Executive Summary

The fix commit properly added `RequireCollectionAccess` checks to ExportCollection, CreateLinkedAccount, GetReadyTasks, GetBlockedTasks, GetCriticalPath, and GetBottlenecks, and added ListCollections filtering. However, two remaining handlers with `collection_id` parameters lack checks (WatchTasks, ListLinkedAccounts), and a systemic gap allows collection-scoped tokens to read/write tasks by ID in unauthorized collections. The scope enforcement and backward compatibility design (nil scopes = wildcard) are well-implemented. Test coverage is strong at the unit and integration level.

---

## Critical Issues

### 1. WatchTasks: Missing RequireCollectionAccess for collection_id filter

**File:** `internal/server/watch.go:34`

WatchTasks accepts an optional `collection_id` but does not call `RequireCollectionAccess` when one is provided. Worse, when `collection_id` is nil, a collection-scoped token will receive task events from ALL collections, including those it is not authorized for. This is a live data stream bypass of the collection restriction.

The `RequireScope(ScopeTaskRead)` check was correctly added at line 26, but collection-level enforcement is absent.

**Suggested Fix:**

```go
// After line 28 (RequireScope check), before line 29 (validateWatchTasksRequest):
// When watching without a collection filter, verify the token is not collection-restricted.
if req.CollectionId == nil {
    if ids := CollectionIDsFromContext(stream.Context()); len(ids) > 0 {
        return status.Error(codes.PermissionDenied,
            "collection-scoped tokens must specify a collection_id for WatchTasks")
    }
}

// Inside the existing if req.CollectionId != nil block (line 34), add before the GetCollection call:
if err := RequireCollectionAccess(stream.Context(), collID); err != nil {
    return err
}
```

### 2. Task-by-ID handlers bypass collection restrictions

**Files:** `internal/server/server.go` — GetTask (:288), UpdateTask (:451), ClaimTask (:633), CloseTask (:681), AddComment (:734), ListComments (:761), GetComment (:807), ListChanges (:1136), GetDependencyTree (:1508)

These handlers accept a task ID (or task-adjacent ID) and perform operations without verifying that the task's collection is within the token's allowed collections. A collection-scoped token can read, modify, claim, or close any task if it knows the task UUID, effectively negating collection restrictions for all task operations.

**Impact:** A token scoped to collection A can call `GetTask(task_id_in_collection_B)` and receive full task data. Same applies to all mutating task operations.

**Suggested Fix:** Add a post-fetch collection check. Example for GetTask:

```go
func (s *FarmTableService) GetTask(ctx context.Context, req *pb.GetTaskRequest) (*pb.GetTaskResponse, error) {
    if err := RequireScope(ctx, ScopeTaskRead); err != nil {
        return nil, err
    }
    id, err := uuid.Parse(req.GetId())
    if err != nil {
        return nil, status.Errorf(codes.InvalidArgument, "invalid task id: %v", err)
    }
    t, err := s.store.GetTask(ctx, id)
    if err != nil {
        return nil, storeErr(err, "task")
    }
    // Enforce collection restriction on the task's owning collection.
    if err := RequireCollectionAccess(ctx, t.CollectionID); err != nil {
        return nil, err
    }
    // ... rest of handler
}
```

Apply the same pattern to UpdateTask, ClaimTask, CloseTask, AddComment, ListComments, GetComment, ListChanges, and GetDependencyTree.

---

## Important Issues

### 3. ListLinkedAccounts: Missing RequireCollectionAccess

**File:** `internal/server/server.go:1091`

`ListLinkedAccounts` parses an optional `collection_id` filter but does not call `RequireCollectionAccess`. A collection-scoped token can list linked accounts for any collection.

**Suggested Fix:**

```go
if req.CollectionId != nil {
    cid, err := uuid.Parse(*req.CollectionId)
    if err != nil {
        return nil, status.Errorf(codes.InvalidArgument, "invalid collection_id: %v", err)
    }
    if err := RequireCollectionAccess(ctx, cid); err != nil {
        return nil, err
    }
    p.CollectionID = &cid
}
```

Additionally, when `collection_id` is nil and the token is collection-scoped, results should be filtered to only show linked accounts for the allowed collections (similar to the ListCollections filtering pattern).

### 4. GetLinkedAccount / DeleteLinkedAccount: No collection enforcement

**Files:** `internal/server/server.go:1039, :1057`

These operate on linked account IDs without checking that the linked account's collection is within the token's allowed set. Similar to Critical issue #2, they allow cross-collection access via the resource ID.

**Suggested Fix:** After fetching the linked account, check `RequireCollectionAccess(ctx, la.CollectionID)`.

### 5. ListCollections pagination breaks with collection filtering

**File:** `internal/server/server.go:880-895`

The collection filtering happens after pagination. If the store returns a full page of 10 results but only 2 pass the filter:
- `total` is set to 2 (incorrect — the actual total of allowed collections across all pages is unknown)
- `has_more` is false (because `len(cols) != pageSize`), even though later pages may contain allowed collections
- Clients stop paginating and miss allowed collections

**Suggested Fix:** Either push the collection ID filter down to the store query (preferred for correctness and efficiency):

```go
// In store layer, add CollectionIDs filter to ListCollectionsParams
type ListCollectionsParams struct {
    // ...existing fields...
    CollectionIDs []uuid.UUID // restrict results to these collections
}
```

Or, as a lighter-weight fix, adjust has_more to always be true when filtering is active and results exist (acknowledging total_count will be approximate):

```go
if len(allowedIDs) > 0 {
    // ... filtering code ...
    cols = filtered
    total = len(cols)
    // Signal there may be more pages since we're post-filtering
    // (total is approximate; store-level filtering would be more accurate)
}
```

### 6. GetReadyTasks / GetBlockedTasks without collection_id return cross-collection data

**Files:** `internal/server/server.go:1302, :1405`

When `req.CollectionId` is nil, GetReadyTasks and GetBlockedTasks return tasks from ALL collections. The `RequireCollectionAccess` check only fires when a collection_id is explicitly provided. A collection-scoped token calling `GetReadyTasks()` without a collection filter will see tasks across all collections.

**Suggested Fix:** When the token has collection restrictions and no collection_id filter is provided, either reject the request or automatically filter to the allowed collections:

```go
// After the routing check block
allowedIDs := CollectionIDsFromContext(ctx)
if req.CollectionId == nil && len(allowedIDs) > 0 {
    // If scoped to a single collection, use it automatically
    if len(allowedIDs) == 1 {
        p.CollectionID = &allowedIDs[0]
    } else {
        return nil, status.Error(codes.InvalidArgument,
            "collection-scoped tokens must specify collection_id")
    }
}
```

---

## Suggestions

### 7. Scope check ordering: RequireScope before RequireIdentity

In some handlers (e.g., `CreateTask` line 88-91), `RequireIdentity` runs before `RequireScope`. Since `RequireScope` is a cheaper check (context lookup + slice scan), consider putting it first to fail fast. This is a minor performance suggestion and doesn't affect correctness.

### 8. Consider a centralized handler-to-scope mapping

The scope enforcement is distributed across 25+ handlers via manual `RequireScope` calls. A table-driven or interceptor-based approach (mapping gRPC method names to required scopes) would reduce the chance of missing checks in future handlers and make the security policy auditable from a single location.

### 9. DefaultScopesForUserType: "unknown" user type returns nil (wildcard)

**File:** `internal/server/scopes.go:130`

The `default` case returns `nil`, which is treated as wildcard. If a new user type is added without updating this function, tokens for that type would silently get wildcard access. Consider returning an empty slice or a minimal set for unknown types.

---

## What's Done Well

- **Backward compatibility:** Treating nil/empty scopes as wildcard is a clean migration strategy that ensures existing tokens continue working without data migration. This is well-documented in code comments.
- **Consistent error semantics:** All scope/collection failures return `codes.PermissionDenied` with descriptive messages including the missing scope or collection ID.
- **Test coverage:** 608 lines of tests covering unit-level scope/collection checks, store-level persistence round-trips, and integration tests with a real gRPC server and auth interceptor. The tests verify both positive and negative cases.
- **Token lookup pipeline:** The Scopes and CollectionIDs flow cleanly through `TokenLookupResult` → `TokenAuthInterceptor` → context → handler checks. Both unary and stream interceptors are updated.
- **CLI integration:** The `--scope` and `--collection` flags with validation are a good UX addition, and the default scope assignment based on user type is a sensible default.
- **Fix commit quality:** The Round 1 fix (19b0a78) is surgical — it adds exactly the missing checks to the identified handlers without introducing new issues.

---

## Verification Story

- **Tests reviewed:** Yes — 608 lines in `rbac_test.go` with good coverage of scope enforcement, collection restriction, backward compatibility, and store-level persistence. Missing: no tests for WatchTasks with collection-scoped tokens, no tests for task-by-ID cross-collection access.
- **Build verified:** Yes — `go build ./...` succeeds.
- **Lint/static analysis:** `go vet` reports 4 pre-existing protobuf lock-copy warnings (not introduced by this PR).
- **Security checked:** Yes — identified 2 critical and 4 important authorization bypass vectors.

---

## Summary of Required Changes

| # | Severity | Handler(s) | Issue |
|---|----------|-----------|-------|
| 1 | Critical | WatchTasks | Missing RequireCollectionAccess; unfiltered stream leak |
| 2 | Critical | GetTask, UpdateTask, ClaimTask, CloseTask, AddComment, ListComments, GetComment, ListChanges, GetDependencyTree | Task-by-ID bypass of collection restrictions |
| 3 | Important | ListLinkedAccounts | Missing RequireCollectionAccess for collection_id filter |
| 4 | Important | GetLinkedAccount, DeleteLinkedAccount | No collection enforcement on resource ID lookup |
| 5 | Important | ListCollections | Pagination broken with post-fetch collection filtering |
| 6 | Important | GetReadyTasks, GetBlockedTasks | Unfiltered results when collection_id omitted |
