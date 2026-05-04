# Farm Table — Hardening Sprint

**Date:** 2026-05-03
**Input:** `.design/code-review.md`
**Goal:** Fix all critical and high-severity issues before adding new features. Establish a baseline where the core task lifecycle (create → claim → update → close) works correctly and safely.

---

## Batch 1: Immediate Fixes (no design decisions needed)

These are clear bugs with known fixes. Can be done in a single pass.

### 1.1 Fix unconditional UpdateTask (C1)

**File:** `internal/store/entstore.go` — `UpdateTask` method

**Problem:** When `version` is empty (client opts out of CAS), the server fetches the current version and passes it through, creating a fake CAS check with a TOCTOU race.

**Fix:** In `UpdateTask`, when `p.Version == ""`, skip the `task.VersionEQ(p.Version)` predicate in the WHERE clause. Build the update query conditionally:

```go
update := s.client.Task.Update().Where(task.IDEQ(id))
if p.Version != "" {
    update = update.Where(task.VersionEQ(p.Version))
}
```

Also update `internal/server/server.go` — remove the auto-fetch-version fallback (lines 208-216). When version is not provided by the client, pass empty string to the store. The store handles both cases.

**Also fix:** Change `ErrInvalidArgument` guard for empty version to allow it (remove lines 150-152 of current entstore.go).

### 1.2 Delete the version hook (C4)

**File:** `internal/store/entstore.go`

**Problem:** `versionHook()` is dead code for bulk updates and a double-increment trap for UpdateOne.

**Fix:**
1. Delete the `versionHook()` function entirely
2. Remove `client.Task.Use(versionHook())` from `NewEntStore`
3. Ensure each mutating method (`UpdateTask`, `ClaimTask`, `CloseTask`) manually increments the version. Verify this is already the case — the current code in each method should compute `newVersion = strconv.Itoa(oldVersion + 1)` and call `SetVersion(newVersion)`.

For `UpdateTask` without CAS (version empty): read current task first to get the current version, increment it, and set it on the update. This is safe because we're not using the version as a WHERE predicate — just incrementing it.

For `ClaimTask` and `CloseTask`: they already read the task first. Increment the version from the read result.

### 1.3 Fix ClaimTask TOCTOU — prevent reopening closed tasks (H1)

**File:** `internal/store/entstore.go` — `ClaimTask` method

**Problem:** The WHERE clause is `id = X AND assignee_id IS NULL` but doesn't check phase. A concurrent close can be overwritten.

**Fix:** Add `task.PhaseNEQ(task.PhaseClosed)` to the Update WHERE clause:

```go
q := s.client.Task.Update().
    Where(task.IDEQ(id), task.AssigneeIDIsNil(), task.PhaseNEQ(task.PhaseClosed))
```

### 1.4 Fix config file permissions (H6)

**File:** `internal/cli/config.go`

**Fix:** Change `os.WriteFile(path, data, 0o644)` to `os.WriteFile(path, data, 0o600)`.

### 1.5 Fix gRPC status code for CAS conflicts (H2)

**File:** `internal/server/server.go` — `storeErr` function

**Fix:** Change:
```go
if errors.Is(err, store.ErrConflict) {
    return status.Errorf(codes.FailedPrecondition, ...)
}
```
to:
```go
if errors.Is(err, store.ErrConflict) {
    return status.Errorf(codes.Aborted, ...)
}
```

Also update `internal/server/server_test.go` — change `codes.FailedPrecondition` assertions to `codes.Aborted` in the version conflict test.

### 1.6 Cap page_size server-side (H5)

**File:** `internal/server/server.go` — all List RPC handlers

**Fix:** After setting default page size, add:
```go
if pageSize > 200 {
    pageSize = 200
}
```

Apply to: `ListTasks`, `ListComments`, `ListChanges`, `ListCollections`.

---

## Batch 2: Structural Fixes (some refactoring needed)

### 2.1 Implement GetStatus and GetVersion RPCs (C3)

**File:** `internal/server/server.go`

**Fix:** Implement `GetStatus` and `GetVersion`:

```go
func (s *FarmTableService) GetStatus(ctx context.Context, req *pb.GetStatusRequest) (*pb.GetStatusResponse, error) {
    return &pb.GetStatusResponse{
        ServerVersion: version,
        // TODO: Add platform connection health checks
    }, nil
}

func (s *FarmTableService) GetVersion(ctx context.Context, req *pb.GetVersionRequest) (*pb.GetVersionResponse, error) {
    return &pb.GetVersionResponse{
        ServerVersion: version,
    }, nil
}
```

The `version` var needs to be passed to `NewFarmTableService` or set as a package-level variable. Choose whichever is cleaner.

### 2.2 Refactor CLI error handling — eliminate os.Exit in command handlers (H4)

**Files:** `internal/cli/errors.go`, all CLI command files

**Problem:** `handleGRPCError()` and `exitError()` call `os.Exit()`, bypassing deferred cleanup (especially `closer.Close()` in embedded mode).

**Fix:**
1. Change `handleGRPCError` and `exitError` to return an error instead of calling `os.Exit()`
2. Create a custom error type that carries the exit code:
   ```go
   type exitErr struct {
       code    int
       message string
   }
   func (e *exitErr) Error() string { return e.message }
   ```
3. In `root.go`, set a post-run hook or wrap `Execute()` to extract the exit code from the error and call `os.Exit()` once — after all defers have run.
4. Update all command handlers to `return` the error from `handleGRPCError`/`exitError` instead of the current fire-and-forget pattern.

This is the largest refactor in the batch. Every command handler needs to change from:
```go
handleGRPCError(err) // calls os.Exit, never returns
```
to:
```go
return handleGRPCError(err) // returns error, let cobra handle it
```

### 2.3 Implement basic auth interceptor for server mode (H3 — partial)

**File:** `cmd/farmtable-server/main.go`, new file `internal/server/auth.go`

**Fix:** Add a unary interceptor that checks for a Bearer token in gRPC metadata:

```go
func tokenAuthInterceptor(validToken string) grpc.UnaryServerInterceptor {
    return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
        if validToken == "" {
            return handler(ctx, req) // no token configured, allow all
        }
        md, ok := metadata.FromIncomingContext(ctx)
        if !ok {
            return nil, status.Error(codes.Unauthenticated, "missing metadata")
        }
        auth := md.Get("authorization")
        if len(auth) == 0 || auth[0] != "Bearer "+validToken {
            return nil, status.Error(codes.Unauthenticated, "invalid token")
        }
        return handler(ctx, req)
    }
}
```

Register in `main.go`:
```go
token := os.Getenv("FARMTABLE_TOKEN")
grpcServer := grpc.NewServer(
    grpc.UnaryInterceptor(tokenAuthInterceptor(token)),
)
```

When `FARMTABLE_TOKEN` is not set, the server runs unauthenticated (dev/embedded mode). When set, all requests must include the matching Bearer token.

This does NOT solve C2 (agent identity) — that requires mapping tokens to user IDs. Defer to a follow-up.

---

## Batch 3: Feature Completions (tracked, not blocking)

These are features that exist in the proto/CLI but aren't wired through the store/server. They're not bugs — they're incomplete implementations. Track as follow-up work, not hardening.

| Item | Summary | Priority |
|------|---------|----------|
| M1 | ListTasks filter support (priority, type, labels, parent, sort) | Next sprint |
| M2 | CreateTask/UpdateTask field support (labels, dates, relationships, code_context) | Next sprint |
| M4 | Change audit trail (write Change records on mutations) | Next sprint |
| C2 | Agent identity from auth context (requires auth design) | Next sprint |
| M3 | Cursor-based pagination (replace offset) | v1.1 |
| M5 | CloseTask version handling without explicit version | With Batch 1.2 |

---

## Test Requirements

Each batch fix should include a test that validates the fix:

| Fix | Required test |
|-----|--------------|
| 1.1 (unconditional update) | Test that UpdateTask without version succeeds even after concurrent write |
| 1.2 (delete hook) | Verify version increments correctly without the hook |
| 1.3 (ClaimTask phase check) | Test that claiming a closed task returns error |
| 1.5 (Aborted status code) | Update existing test assertion |
| 1.6 (page_size cap) | Test that page_size > 200 is capped to 200 |
| 2.1 (GetStatus/GetVersion) | Test both RPCs return non-error responses |
| 2.2 (error handling) | Test that embedded mode cleanup runs on error |
| 2.3 (auth interceptor) | Test unauthenticated request is rejected when token is set |

---

## Execution Plan

- **Batch 1:** Assign to a single developer agent. All fixes are localized (1-5 line changes each except 1.2). Should complete in one pass.
- **Batch 2:** Assign after Batch 1 lands. 2.2 (error handling refactor) is the largest item and touches every CLI command file. Consider assigning 2.1 and 2.3 in parallel with 2.2.
- **Batch 3:** Defer to next planning cycle. Not part of hardening.
