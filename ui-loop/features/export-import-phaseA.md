# Export/Import Phase A — Feature Log

## Status: MERGED — PR #72 → commit b8929bf

## PR
- **URL:** https://github.com/scion-frontiers/farmtable/pull/72
- **Branch:** feat/collection-export-import
- **Merge status:** CLEAN/MERGEABLE
- **Commits:** a426fdc, 1c5e8cc, 2915bbb

## Investigation Findings

### 1. Bulk-query store methods
- No unpaginated bulk export methods exist. All list methods use paginated pattern with Limit/LastID/LastSortValue.
- Existing List methods technically return all rows when Limit=0, but we still need dedicated bulk methods.
- No ListRelationships method exists — relationships accessed via task edges.

### 2. Transactional creation support
- CreateTask already uses s.client.Tx(ctx) pattern — proven pattern to follow.
- Ent Tx has clients for all needed entities: Collection, Task, Comment, Relationship, Change, User.
- All create builders expose SetID for caller-specified UUIDs.
- No GetUserByEmail exists — need to add. Ent predicates support user.EmailEQ.
- Need a new transaction-oriented import method, not composition of existing public methods.

### 3. gRPC max message size
- Default 4MB everywhere — no MaxRecvMsgSize/MaxSendMsgSize configured anywhere.
- Need to add to: production server (cmd/farmtable-server/main.go), embedded servers (internal/cli/dashboard.go, connect.go), test server (internal/testutil/testserver.go), and client dialing.

### 4. Proto structure
- Collection messages at proto/farmtable.proto:672-699 — add new messages after UpdateCollectionRequest.
- FarmTableService RPCs at proto/farmtable.proto:958-965 — add after UpdateCollection.
- Proto generation via `buf generate` per Makefile.

### 5. Store interface pattern
- Standard: Method(ctx, params) (result, error) with param structs in store.go.
- List methods return ([]*ent.X, int, error).

### 6. CLI pattern
- newCollectionCmd registers subcommands via cmd.AddCommand.
- Standard: resolveToken → newClient → authCtx → RPC call → handleGRPCError → output formatting.
- readInputValue supports - for stdin and @file for file content. Plain path needs os.ReadFile.

## Implementation

Implemented Phase A backend and CLI export/import on branch `feat/collection-export-import`.

### Proto/API
- Added `ExportCollectionRequest`, `ExportCollectionResponse`, `ImportCollectionRequest`, `ImportCollectionResponse`, and `ImportStats` messages.
- Added `ExportCollection` and `ImportCollection` RPCs to `FarmTableService`.
- Regenerated Go protobuf and gRPC bindings with `buf generate`.
- Added `min_len` validation constraints on ID and import data fields.

### Store
- Bulk export methods: `ListAllTasksForCollection`, `ListAllCommentsForCollection`, `ListAllChangesForCollection`, `ListAllRelationshipsForCollection`
- `GetUserByEmail`, `GetUsersByIDs` for user matching and batch lookup
- Transactional `ImportCollection` — creates collection, users, tasks, comments, relationships, and changes in one Ent transaction with rollback
- Pass-through store stubs for GitHub platform

### Server
- `ExportCollection` handler: PLATFORM_FARMTABLE validation, JSON export with format_version 1, cross-collection relationship dropping with warnings, optional change history
- `ImportCollection` handler: JSON parsing with DisallowUnknownFields, format_version validation, user resolution (email match or create), topological task ordering with cycle detection, UUID remapping, dry-run support, atomic transaction
- gRPC 64 MB message limits globally (server + client, all configurations)

### CLI
- `ft collection export <id-or-name> [--out file] [--include-changes]`
- `ft collection import <file|-|@path> [--name name] [--dry-run]`
- resolveCollectionIDArg for name-to-UUID resolution with proper error propagation

### Tests (9 test cases)
1. Round-trip: create → export → import → verify equality, UUID remapping, relationships
2. Round-trip with changes: export with include_changes, verify round-trip
3. Cross-collection relationship: verify dropped with warning
4. User email matching: verify reuse, not duplication
5. Ambiguous email: verify new user created
6. Parent cycle detection: verify error
7. Dry-run: verify no collection created, stats returned
8. Atomicity/rollback: verify no orphaned users on failure
9. Error cases: invalid JSON, unsupported format_version, non-farmtable, unknown fields

## Review Rounds

### Round 1 — REQUEST CHANGES → Fixed
**Findings fixed:**
- C1 (Critical): Moved user creation into import transaction — no more orphaned users
- I1 (Important): Replaced N+1 per-task comment/change queries with bulk collection-level queries
- I2 (Important): Added GetUsersByIDs batch lookup for export
- I3 (Important): Added bytes.min_len=2 proto validation on import data
- S1-S6: Dry-run wording, Users array init, CLI usage text, DisallowUnknownFields, etc.
- Added 4 additional tests: rollback, changes import, ambiguous email, parent cycle

### Round 2 — APPROVE → Fixed remaining items
**Findings fixed:**
- Significant: resolveCollectionIDArg error propagation (only InvalidArgument/NotFound fall through)
- Minor: Removed unused relationship eager loads from ListAllTasksForCollection
- Minor: Added include_changes round-trip test
- Suggestions: File permissions 0o600, simplified import reads, unbounded query docs

### Round 3 — APPROVE (clean)
**No blocking/significant findings.** Only nitpick/suggestion-level observations:
- Unbounded stdin/file read (gRPC 64MB backstop is sufficient for Phase A)
- No duplicate user ID validation in import (defensive, low-risk)
- MarshalIndent memory overhead for large payloads (streaming in Phase B)
- resolveCollectionIDArg linear scan (future enhancement)

Exit criteria met: R3 returned only nitpick/minor findings → ship as-is.

## Final State
- PR #72 MERGED: https://github.com/scion-frontiers/farmtable/pull/72 → commit b8929bf
- Branch: feat/collection-export-import (3 commits, squash-merged to main)
- Build: `go build ./...` passes
- Tests: `go test ./...` passes (9 export/import tests)
- All agents cleaned up after merge confirmation
- Phase B (web UI) can now consume ExportCollection/ImportCollection RPCs
