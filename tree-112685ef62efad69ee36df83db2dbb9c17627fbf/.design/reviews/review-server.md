# Server Layer Code Review

**Date:** 2026-05-04
**Scope:** `internal/server/server.go`, `internal/server/convert.go`, `internal/server/auth.go`, `internal/server/auth_test.go`, `internal/server/server_test.go`

---

## Critical

### S-01: Auth token comparison is timing-unsafe

**File:** `internal/server/auth.go:28`
**Severity:** Critical

```go
if token != validToken {
```

String `!=` comparison is not constant-time. An attacker can measure response times across many requests to determine the token character-by-character (timing side-channel attack).

**Fix:** Use `crypto/subtle.ConstantTimeCompare`:

```go
import "crypto/subtle"

if subtle.ConstantTimeCompare([]byte(token), []byte(validToken)) != 1 {
    return nil, status.Error(codes.Unauthenticated, "invalid token")
}
```

---

### S-02: ClaimTask and AddComment use random UUIDs for actor identity

**File:** `internal/server/server.go:391`, `internal/server/server.go:446`
**Severity:** Critical

```go
// ClaimTask
assigneeID := uuid.New()

// AddComment
authorID := uuid.New()
```

Every call generates a fresh random UUID as the actor. This means:
- Claims cannot be attributed to actual users
- Comments have fabricated authors
- There is no access control on who can claim/comment

**Fix:** Extract the authenticated user identity from the gRPC context (set by the auth interceptor). If auth is not yet wired to provide user identity, at minimum use a well-known sentinel UUID and add a `// TODO` so this is not shipped silently. Better: add user identity to context in the auth interceptor and extract it here.

```go
func userIDFromContext(ctx context.Context) (uuid.UUID, error) {
    // Extract from auth metadata or context value set by interceptor
}
```

---

## High

### S-03: `findLongestBlocksChain` has no depth limit — unbounded recursion

**File:** `internal/server/server.go:989-1027`
**Severity:** High

Unlike `buildDependencyNode` (which caps at `maxDepth=20`), `findLongestBlocksChain` has no depth limit. A sufficiently deep chain causes stack exhaustion. Additionally, each node issues an individual `GetTask` call (N+1 query problem), so a chain of 500 nodes means 500 sequential DB queries.

**Fix:** Add a depth limit parameter (e.g., 100) and bail out when exceeded:

```go
func (s *FarmTableService) findLongestBlocksChain(ctx context.Context, taskID uuid.UUID, visited map[uuid.UUID]bool, depth, maxDepth int) []criticalPathEntry {
    if visited[taskID] || depth >= maxDepth {
        return nil
    }
    // ...
    child := s.findLongestBlocksChain(ctx, targetID, visited, depth+1, maxDepth)
}
```

---

### S-04: `countDownstream` has no depth limit — unbounded recursion

**File:** `internal/server/server.go:1124-1138`
**Severity:** High

Same issue as S-03. `countDownstream` recurses without any depth bound.

**Fix:** Add the same depth-limit pattern as S-03.

---

### S-05: Critical path `visited` map produces incorrect longest path

**File:** `internal/server/server.go:989-1027`
**Severity:** High

The DFS uses a shared `visited` map across all branches. Once a node is visited via one branch, it's skipped on all other branches. This means the algorithm finds *a* path, not the *longest* path.

Example: given `A -> B -> D` and `A -> C -> B -> D`, the DFS visits A, explores B (marking B visited), reaches D. Then explores C, tries B but B is already visited, so C's path is just `[C]`. The result is `[A, B, D]` (length 3) when the correct longest path is `[A, C, B, D]` (length 4).

For a correct longest-path algorithm on a DAG, use topological sort + dynamic programming, or reset the visited set per branch (acceptable for small graphs with cycle detection separate from the visited set).

**Fix:** For correctness on a DAG: use topological sort. For a pragmatic fix: separate cycle detection from path exploration by passing visited as a stack (mark on entry, unmark on exit):

```go
func (s *FarmTableService) findLongestBlocksChain(ctx context.Context, taskID uuid.UUID, onStack map[uuid.UUID]bool) []criticalPathEntry {
    if onStack[taskID] { return nil } // cycle
    onStack[taskID] = true
    defer func() { onStack[taskID] = false }()
    // ... recurse ...
}
```

---

### S-06: GetCriticalPath and GetBottlenecks load unbounded tasks into memory

**File:** `internal/server/server.go:908-935`, `internal/server/server.go:1047-1073`
**Severity:** High

Both RPCs load up to 3000 tasks (1000 per phase x 3 phases) into memory with no pagination or streaming. On a large collection this causes excessive memory usage and latency.

**Fix:** Either:
1. Add a configurable cap and return an error if exceeded, or
2. Implement these as store-level SQL queries (topological sort in SQL), or
3. Add a hard cap with a warning in the response

At minimum, document the limit and consider reducing from 1000 to a safer default (e.g., 200 per phase).

---

### S-07: No auth interceptor for streaming RPCs

**File:** `internal/server/auth.go`
**Severity:** High (if streaming RPCs are added)

Only `grpc.UnaryServerInterceptor` is implemented. If any streaming RPC is added to the service, it will bypass authentication entirely.

**Fix:** Add a `StreamServerInterceptor` with the same logic:

```go
func TokenAuthStreamInterceptor(validToken string) grpc.StreamServerInterceptor {
    return func(srv interface{}, ss grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
        // same token validation logic
    }
}
```

---

## Medium

### S-08: ListTasks silently ignores all stages after the first

**File:** `internal/server/server.go:196-199`
**Severity:** Medium

```go
if len(req.GetStages()) > 0 {
    st := stageFromProto(req.GetStages()[0])
    p.Stage = &st
}
```

The proto field `stages` is plural (repeated), but only `[0]` is used. Clients passing multiple stages get silently incorrect results.

**Fix:** Either pass all stages to the store layer (requires updating `ListTasksParams.Stage` to a slice), or return `InvalidArgument` if more than one stage is provided:

```go
if len(req.GetStages()) > 1 {
    return nil, status.Errorf(codes.InvalidArgument, "filtering by multiple stages is not yet supported")
}
```

---

### S-09: ListTasks has inline page token decoding, unlike all other List RPCs

**File:** `internal/server/server.go:169-178`
**Severity:** Medium

`ListTasks` manually decodes the page token inline while `ListComments`, `ListCollections`, `ListChanges`, `GetReadyTasks`, and `GetBlockedTasks` all use the `decodePageToken` helper. This is a consistency issue and the inline version lacks the empty-string short-circuit.

**Fix:** Replace lines 168-178 with:

```go
offset, err := decodePageToken(req.GetPageToken())
if err != nil {
    return nil, err
}
```

---

### S-10: No input validation for required string fields

**File:** `internal/server/server.go:34` (CreateTask), `internal/server/server.go:438` (AddComment), `internal/server/server.go:571` (CreateCollection)
**Severity:** Medium

- `CreateTask` accepts an empty `name`
- `AddComment` accepts an empty `body`
- `CreateCollection` accepts an empty `name`

These will create database rows with blank required fields.

**Fix:** Add validation at the top of each handler:

```go
if req.GetName() == "" {
    return nil, status.Errorf(codes.InvalidArgument, "name is required")
}
```

---

### S-11: `storeErr` fallback leaks internal error details to clients

**File:** `internal/server/server.go:1177`
**Severity:** Medium

```go
return status.Errorf(codes.Internal, "%s: %v", entity, err)
```

The raw `err` message is returned to the client, potentially exposing SQL errors, file paths, or internal state.

**Fix:** Log the full error server-side and return a generic message to the client:

```go
// log.Printf("internal error for %s: %v", entity, err)
return status.Errorf(codes.Internal, "internal error for %s", entity)
```

---

### S-12: taskToProto target relationship conversion may confuse clients

**File:** `internal/server/convert.go:264-271`
**Severity:** Medium

```go
if edges := t.Edges.TargetRelationships; len(edges) > 0 {
    for _, r := range edges {
        pt.Relationships = append(pt.Relationships, &pb.Relationship{
            Type:         relationshipTypeToProto(r.Type),
            TargetTaskId: r.SourceTaskID.String(),
        })
    }
}
```

For target relationships, `TargetTaskId` is set to `r.SourceTaskID`. This is semantically correct (pointing to the "other side"), but the `Type` is preserved as-is. For example, if task A has a "blocks" relationship targeting task B, then when loading B, the target relationship shows `Type=blocks, TargetTaskId=A`. From B's perspective, this should be `blocked_by`, not `blocks`.

**Fix:** Invert the relationship type for target relationships, or add an `IsInverse` field to the proto `Relationship` message.

---

### S-13: N+1 query problem in all graph RPCs

**File:** `internal/server/server.go:829`, `internal/server/server.go:995`, `internal/server/server.go:1125`
**Severity:** Medium

`buildDependencyNode`, `findLongestBlocksChain`, and `countDownstream` each call `s.store.GetTask()` individually per node. For a graph with N nodes, this results in N sequential database round-trips.

**Fix:** For the immediate term, this is acceptable for small graphs with the depth limits from S-03/S-04 in place. Long-term, batch-load tasks or implement graph queries at the store/SQL level.

---

## Low

### S-14: `changeToProto` creates structpb.Value from raw strings

**File:** `internal/server/convert.go:406-411`
**Severity:** Low

```go
if c.OldValue != "" {
    ch.OldValue, _ = structpb.NewValue(c.OldValue)
}
```

`structpb.NewValue` with a string argument creates a string Value, but the error is silently discarded. If the value is malformed (e.g., contains invalid UTF-8), the error is swallowed.

**Fix:** Check the error or use `structpb.NewStringValue` directly (which cannot fail).

---

### S-15: `ciStatusFromProto` returns "unknown" for UNSPECIFIED

**File:** `internal/server/convert.go:303`
**Severity:** Low

The default case returns `"unknown"` which is not a valid `task.CiStatus` enum value. This could cause issues if the string is persisted.

**Fix:** Return `""` (empty string) for unspecified, matching the pattern used by `prStatusFromProto`.

---

### S-16: Page token offset can be negative

**File:** `internal/server/server.go:1184-1196`
**Severity:** Low

`decodePageToken` parses an integer from the base64-decoded string but doesn't validate that the offset is non-negative. A crafted token like `base64("-5")` would produce a negative offset, which could cause unexpected SQL behavior.

**Fix:** Add a bounds check:

```go
if offset < 0 {
    return 0, status.Errorf(codes.InvalidArgument, "invalid page_token")
}
```

---

## Test Coverage Gaps

| Area | Status |
|------|--------|
| Auth interceptor (4 cases) | Covered |
| CRUD task lifecycle | Covered |
| Pagination + page_size cap | Covered |
| CAS version conflict | Covered |
| Claim + double-claim | Covered |
| Close + invalid stage | Covered |
| Labels (create, add/remove) | Covered |
| Dates (set, clear) | Covered |
| Priority filter | Covered |
| Sort | Covered |
| Audit trail + field filter | Covered |
| Graph: GetReadyTasks | Covered |
| Graph: GetBlockedTasks | Covered |
| Graph: GetDependencyTree | Covered |
| Graph: GetCriticalPath | Covered |
| Graph: GetBottlenecks | Covered |
| **AddComment / ListComments / GetComment** | **Missing** |
| **ListCollections** | **Missing** |
| **CreateTask with blocks/blockedBy** | **Missing** |
| **UpdateTask with PR/CI/repo/branch** | **Missing** |
| **Graph cycle handling** | **Missing** |
| **GetDependencyTree max_depth exceeded** | **Missing** |
| **Negative/invalid page_token** | **Missing** |
| **Empty name/body validation** | **Missing** (depends on S-10 fix) |

---

## Summary

| Severity | Count | IDs |
|----------|-------|-----|
| Critical | 2 | S-01, S-02 |
| High | 5 | S-03, S-04, S-05, S-06, S-07 |
| Medium | 6 | S-08, S-09, S-10, S-11, S-12, S-13 |
| Low | 3 | S-14, S-15, S-16 |

**Recommended remediation priority:** S-01 (timing attack), S-03/S-04 (unbounded recursion), S-05 (incorrect algorithm), S-02 (identity), S-09 (easy consistency fix), S-10 (input validation).
