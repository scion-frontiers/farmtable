# PR Review: Collection Export/Import Phase A — Round 2

**Verdict:** APPROVE

**Overview:** This PR adds well-structured ExportCollection and ImportCollection RPCs with proper transaction safety, UUID remapping, topological ordering of parent-child tasks, cycle detection, and comprehensive input validation. The second commit cleanly addresses the expected round-1 issues. The code is ready to merge with a few non-blocking observations.

---

## Critical Issues

None.

---

## Important Issues

### 1. `resolveCollectionIDArg` swallows non-NotFound errors

**File:** `internal/cli/collection.go:277`
**Severity:** SIGNIFICANT

The function tries `GetCollection` first and, on *any* error, falls through to scanning all collections by name. If the server returns an Internal or Unavailable error (DB timeout, server overload), the error is silently swallowed and the function performs a full scan that will likely also fail — producing a confusing "not found" error instead of the actual server error.

```go
// Current
if _, err := client.GetCollection(ctx, &pb.GetCollectionRequest{Id: arg}); err == nil {
    return arg, nil
}
// Falls through on ALL errors, including Internal/Unavailable
```

**Suggested Fix:**
```go
func resolveCollectionIDArg(ctx context.Context, client pb.FarmTableServiceClient, arg string) (string, error) {
    _, err := client.GetCollection(ctx, &pb.GetCollectionRequest{Id: arg})
    if err == nil {
        return arg, nil
    }
    // Only fall through to name-based lookup for InvalidArgument (not a valid UUID)
    // or NotFound. All other errors should surface immediately.
    code := status.Code(err)
    if code != codes.InvalidArgument && code != codes.NotFound {
        return "", handleGRPCError(err)
    }
    // ... continue with ListCollections scan
```

### 2. `ListAllTasksForCollection` eagerly loads relationships that are never used

**File:** `internal/store/entstore.go:484-485`
**Severity:** MINOR

The export handler queries relationships separately via `ListAllRelationshipsForCollection`, yet `ListAllTasksForCollection` eagerly loads `.WithSourceRelationships().WithTargetRelationships()`. This triggers unnecessary JOINs/subqueries on every export.

```go
// Current — unnecessarily loads relationships
tasks, err := s.client.Task.Query().
    Where(task.CollectionIDEQ(p.CollectionID)).
    WithSourceRelationships().   // <-- not used by export
    WithTargetRelationships().   // <-- not used by export
    Order(task.ByCreatedAt(), task.ByID()).
    All(ctx)
```

**Suggested Fix:** Remove the eager loads since the export handler fetches relationships through a dedicated query:
```go
tasks, err := s.client.Task.Query().
    Where(task.CollectionIDEQ(p.CollectionID)).
    Order(task.ByCreatedAt(), task.ByID()).
    All(ctx)
```

If other callers of `ListAllTasksForCollection` need these (currently there are none — this is a new method), consider a separate parameter or a different query method.

### 3. No test coverage for export with `include_changes`

**File:** `internal/server/export_import_test.go`
**Severity:** MINOR

The round-trip test exports without `IncludeChanges: true`. The `TestRPC_ImportCollection_ImportsChanges` test manually crafts a doc with changes rather than testing the export→import round-trip for changes. This leaves the export-side change-collection code path (`ListAllChangesForCollection`, building `changesByTask`, iterating changes in the export) untested in integration.

**Suggested Fix:** Add an integration test or extend the round-trip test to call `ExportCollection` with `IncludeChanges: true` and verify the changes appear in the exported JSON and survive a round-trip import.

---

## Suggestions

### 4. Export file permissions allow world-read

**File:** `internal/cli/collection.go:194`

`os.WriteFile(out, resp.GetData(), 0o644)` writes the export file as world-readable. The export contains user emails and potentially sensitive task data. Consider using `0o600` to restrict to the current user only.

### 5. `readCollectionImportData` unnecessary string round-trip for `@path`

**File:** `internal/cli/collection.go:268-274`

When `arg` starts with `@`, the data is read via `readInputValue` which returns `string`, then converted back to `[]byte`. For large import files this causes an unnecessary copy. Could read directly as bytes:

```go
func readCollectionImportData(arg string) ([]byte, error) {
    if arg == "-" {
        return io.ReadAll(os.Stdin)
    }
    path := arg
    if len(arg) > 0 && arg[0] == '@' {
        path = arg[1:]
    }
    return os.ReadFile(path)
}
```

### 6. Consider documenting the unbounded query risk

**Files:** `internal/store/entstore.go` (all `ListAll*` methods)

The `ListAll*` methods load entire result sets without pagination. This is acceptable for Phase A but for very large collections (100k+ tasks with comments and changes), the export path could cause significant memory pressure. Consider adding a code comment noting this is a Phase A constraint and that streaming export should be considered for Phase B.

---

## What's Done Well

- **Transaction safety:** The `ImportCollection` store method correctly wraps all inserts in a single transaction with `defer tx.Rollback()`. The `TestRPC_ImportCollection_CreatesUsersAtomically` test cleverly verifies rollback by triggering a duplicate relationship constraint violation and confirming no user was persisted.

- **Topological sort with cycle detection:** `orderImportTasks` implements clean DFS-based topological ordering with a `visiting`/`visited` two-map pattern that correctly detects cycles in parent_task_id references. This ensures parents are created before children in the DB transaction.

- **Referential integrity validation:** `validateImportReferences` performs thorough pre-flight checks — all user IDs referenced by tasks/comments/changes must exist in the doc's user list, all task IDs referenced by comments/relationships/changes must exist in the task list, and all enum values (phase, stage, priority, ci_status, relationship type) are validated against the known set.

- **`DisallowUnknownFields` on import JSON decoder:** Catches typos in hand-crafted import files (e.g., `"taks"` instead of `"tasks"`) with the test `TestRPC_ImportExportCollection_Errors` explicitly verifying this.

- **User matching strategy:** The email-first matching with fallback-to-create-on-ambiguity is well thought out. The ambiguous email test case is particularly thorough.

- **Consistent 64MB gRPC message size:** Applied across all server/client/test configurations — production, embedded, dashboard, passthrough, and test servers. No path can silently hit the default 4MB limit.

- **Clean separation:** The export/import logic is well-isolated in its own file with clear data types for the JSON schema. The `export_import.go` file is self-contained and doesn't pollute the main server handler.

---

## Verification Story

- **Tests reviewed:** Yes — 9 focused tests covering round-trip, cross-collection relationship dropping, user email matching, dry-run, atomicity/rollback, change history import, ambiguous email, cycle rejection, and error cases. Good edge case coverage.
- **Build verified:** Yes — `go build ./...` passes clean.
- **Tests pass:** Yes — all 9 export/import tests pass (`go test ./internal/server/ -run 'ExportImport|Export|Import'`).
- **Security checked:** Yes — auth interceptor covers all RPCs (applied at gRPC server level), input validation is thorough, no credential exposure, no path traversal risk (CLI reads local files as expected).
