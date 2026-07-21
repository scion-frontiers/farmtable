# PR Review: Collection Export/Import Phase A — Round 3

**Branch:** `feat/collection-export-import` → `origin/main`  
**Commits:** a426fdc, 1c5e8cc, 2915bbb  
**Files changed:** 13 (+2,586 / −253)  
**Reviewer:** Code Review Agent — 2026-07-19  

---

## Executive Summary

This PR adds ExportCollection and ImportCollection gRPC RPCs with companion CLI commands, enabling full round-trip backup/restore of farmtable-platform collections. **The implementation is solid** — transactional imports with rollback, topological ordering of parent-child tasks, cycle detection, email-based user matching with ambiguity handling, dry-run mode, and comprehensive cross-collection relationship filtering. After two prior review rounds, the remaining issues are minor.

**Risk Level:** Low-Medium. Core logic is correct and well-tested; the remaining findings are minor hardening items, none blocking.

---

## Verdict: **APPROVE**

No critical or blocking issues remain. Two significant observations below are worth addressing in a follow-up but do not block merge.

---

## Critical Issues

None.

---

## Important Issues

### 1. `readCollectionImportData` — unbounded stdin/file read without size limit
**File:** `internal/cli/collection.go:271-279`  
**Severity:** Suggestion (downgraded — gRPC 64MB limit provides an effective backstop)

`io.ReadAll(os.Stdin)` and `os.ReadFile(path)` read the entire file into memory with no size guard. While the gRPC 64MB message-size limit will reject oversized payloads at the transport layer, the CLI client will still read an arbitrarily large file into memory before discovering it's too big.

This is a minor ergonomic issue rather than a security concern — the CLI is a local tool, and a user piping a 2GB file will just get a gRPC error after a long wait. Acceptable for Phase A.

**Suggested improvement (optional follow-up):**
```go
func readCollectionImportData(arg string) ([]byte, error) {
    const maxImportSize = 64 << 20 // match gRPC limit
    if arg == "-" {
        return io.ReadAll(io.LimitReader(os.Stdin, maxImportSize+1))
    }
    // ... file path handling ...
    info, err := os.Stat(path)
    if err != nil { return nil, err }
    if info.Size() > maxImportSize {
        return nil, fmt.Errorf("import file too large (%d bytes, max %d)", info.Size(), maxImportSize)
    }
    return os.ReadFile(path)
}
```

### 2. `validateImportReferences` does not validate duplicate user IDs
**File:** `internal/server/export_import.go:404-411`  
**Severity:** Suggestion

The validation loop builds a `userIDs` set from `doc.Users` but doesn't check for duplicate user IDs in the input. If an export document contains two user entries with the same ID (perhaps from manual editing), the second silently overwrites the first in the map. The task duplicate check exists in `orderImportTasks` (line 531) but there's no equivalent for users.

This is a defensive check rather than a likely failure scenario since the export path produces unique IDs.

**Suggested fix:**
```go
for _, exported := range doc.Users {
    if _, err := uuid.Parse(exported.ID); err != nil {
        return nil, fmt.Errorf("invalid user id %q: %v", exported.ID, err)
    }
    if _, exists := userIDs[exported.ID]; exists {
        return nil, fmt.Errorf("duplicate user id %q", exported.ID)
    }
    userIDs[exported.ID] = struct{}{}
}
```

---

## Observations

### 3. Export path: `json.MarshalIndent` for potentially large payloads
**File:** `internal/server/export_import.go:243`  
**Severity:** Nitpick

`json.MarshalIndent(doc, "", "  ")` allocates the entire JSON document in memory with pretty-printing overhead. For very large collections approaching the 64MB limit, `json.NewEncoder` with streaming would be more memory-efficient. Acceptable for Phase A with the documented plan to add streaming export later.

### 4. `resolveCollectionIDArg` does paginated linear scan
**File:** `internal/cli/collection.go:282-303`  
**Severity:** Nitpick

When the argument doesn't parse as a UUID, the code paginates through all collections to find a name match. This is O(n) over all collections. For most deployments this is fine, but a future enhancement could add a server-side "get collection by name" RPC. The paginated approach is correct as-is.

### 5. Import creates users with the exported `Type` and `Status` strings directly
**File:** `internal/server/export_import.go:509-514`  
**Severity:** Nitpick

The `Type` and `Status` fields from the export document are passed directly to `store.ImportUser` without enum validation, unlike Phase/Stage/Priority which are validated by their `parse*` functions. If these fields have a constrained domain in the schema, adding validation would be consistent. If they're freeform strings, this is fine.

### 6. Test helper `newExportImportTestServer` duplicates `testutil.NewTestServer`
**File:** `internal/server/export_import_test.go:34-64`  
**Severity:** Nitpick

This is a near-copy of `testutil.NewTestServer` that additionally returns the `*store.EntStore` for direct store assertions. The tests need this for data setup and verification, so the duplication is justified. Consider adding a `NewTestServerWithStore` variant to `testutil` in a follow-up to avoid drift.

---

## What's Done Well

1. **Transactional import with proper rollback.** The `EntStore.ImportCollection` method wraps all inserts in a single transaction with `defer tx.Rollback()`, and the `TestRPC_ImportCollection_CreatesUsersAtomically` test verifies rollback on duplicate relationship insertion. Textbook.

2. **Topological ordering with cycle detection.** `orderImportTasks` implements a clean DFS-based topological sort that handles parent-child ordering and detects cycles with `visiting`/`visited` sets. This prevents FK violations on import — well done.

3. **UUID remapping is thorough.** Task, comment, change, and relationship UUIDs are all remapped to new values on import. User UUIDs are remapped through the user-matching logic. The test at line 140 explicitly asserts original UUIDs are not preserved.

4. **Cross-collection relationship handling.** Export correctly identifies and drops relationships where either endpoint lives outside the collection, with a user-visible warning. Clean separation of concerns.

5. **`DisallowUnknownFields()` on import.** Using `json.NewDecoder` with `DisallowUnknownFields()` catches typos in hand-edited export files (tested at line 471).

6. **Dry-run mode.** The dry-run path correctly performs validation, user resolution, and stats computation without persisting anything. The test asserts collection count is unchanged.

7. **Consistent 64MB gRPC limit.** The message size increase is applied uniformly across all server/client configurations: production server, embedded server, dashboard, passthrough, test servers, and the client dialer. No path was missed.

8. **Test coverage is strong.** 9 test cases covering: round-trip, cross-collection relationship dropping, email matching, dry-run, atomicity/rollback, change history, ambiguous email, cycle detection, and error cases. Tests use direct store assertions to verify import correctness beyond the RPC response.

---

## Verification Story

| Check | Result |
|-------|--------|
| Build (`go build ./...`) | ✅ Clean |
| Tests (`go test ./internal/...`) | ✅ All pass |
| Export/Import tests (9 cases) | ✅ All pass |
| No regressions in existing tests | ✅ Confirmed |
| Security: Auth interceptor covers new RPCs | ✅ Applied at server level |
| Security: Input validation | ✅ UUID parsing, enum validation, reference integrity |
| Security: File permissions on export output | ✅ `0o600` on WriteFile |
| Proto validation annotations | ✅ min_len on id, min_len on import data |
| Passthrough store stubs | ✅ All new interface methods stubbed with ErrNotImplemented |

---

## Summary

This is a well-implemented feature after two rounds of review improvements. The transactional import, topological task ordering, user matching logic, and test coverage are all strong. The remaining observations are minor hardening items suitable for a follow-up pass. **Approved for merge.**
