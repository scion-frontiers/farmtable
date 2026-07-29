# Code Review Plan — Organized by Review Group

**Date:** 2026-05-04
**Goal:** Review all uncommitted code in logical groups, remediate issues, then commit cleanly.

---

## Review Group 1: Store Layer (core data access)

**Scope:** The store interface, Ent implementation, schema changes, and store tests.

**Files:**
- `internal/store/store.go` (+76 lines — new params, interface methods for graph queries)
- `internal/store/entstore.go` (new file — replaces deleted `postgres.go`, ~668 lines total)
- `internal/store/entstore_test.go` (new file — ~1,080 lines, 22 tests)
- `internal/store/schema/task.go` (+8 lines — labels, repo, branch, ci_status, pull_requests fields)
- `internal/store/postgres.go` (deleted — renamed to entstore.go)

**Review focus:**
- Correctness of CAS logic (version handling in UpdateTask with/without version)
- TOCTOU safety in ClaimTask/CloseTask WHERE clauses
- Label merge logic (add/remove)
- Relationship CRUD (blocks/blocked_by creation, deletion)
- Audit trail integration (diffTask coverage, recordChanges error handling)
- Graph query methods (GetReadyTasks, GetBlockedTasks — SQL correctness)
- Test coverage completeness

**Do NOT review:** `internal/store/ent/*` (generated code — review schema, not output)

---

## Review Group 2: Server Layer (gRPC handlers + conversion)

**Scope:** gRPC service implementation, proto↔ent conversion, auth interceptor, and server tests.

**Files:**
- `internal/server/server.go` (+647 lines — all RPC handlers including 5 graph RPCs)
- `internal/server/convert.go` (+137 lines — labels, code_context, relationships, sort/CI/PR converters)
- `internal/server/auth.go` (new file — token auth interceptor)
- `internal/server/auth_test.go` (new file — auth interceptor tests)
- `internal/server/server_test.go` (new file — ~1,100 lines, 21 tests)

**Review focus:**
- Input validation (UUID parsing, enum validation, page size capping)
- gRPC status code correctness (Aborted for CAS, FailedPrecondition for business rules, etc.)
- Graph RPC algorithms (dependency tree traversal, critical path, bottleneck calculation — cycle safety, depth limits)
- Auth interceptor security (token comparison, metadata extraction)
- Proto conversion completeness (all fields mapped, edge cases for nil/empty)
- Test coverage for error paths

---

## Review Group 3: CLI Layer (commands + connectivity)

**Scope:** All CLI command files, connection logic, error handling, and output formatting.

**Files:**
- `internal/cli/connect.go` (+118 lines — embedded mode, bufconn, auto-collection)
- `internal/cli/errors.go` (+21/-lines — ExitError pattern, no more os.Exit in handlers)
- `internal/cli/root.go` (+12 lines — single os.Exit extraction point)
- `internal/cli/task.go` (+114/-lines — all task commands with new field support)
- `internal/cli/collection.go` (+32 lines)
- `internal/cli/comment.go` (+26/-lines)
- `internal/cli/config.go` (+2/-lines — 0o600 permissions)
- `internal/cli/config_cmd.go` (+4 lines)
- `internal/cli/status.go` (+17 lines)
- `internal/cli/version.go` (+22 lines)

**Review focus:**
- Embedded mode lifecycle (bufconn setup, cleanup via embeddedCloser, defer safety)
- ExitError pattern (no remaining os.Exit calls in command handlers)
- Flag parsing correctness (--labels, --due-date, --add-pr-url, etc.)
- Config file permissions (0o600)
- Error handling consistency (all commands return errors, none fire-and-forget)

---

## Review Group 4: Platform Adapter (GitHub Issues)

**Scope:** Platform interface and GitHub adapter — entirely new code.

**Files:**
- `internal/platform/platform.go` (new file — Adapter interface, SyncOptions, SyncResult)
- `internal/platform/github/github.go` (new file — ~323 lines, GitHubAdapter implementation)
- `internal/platform/github/github_test.go` (new file — mapping tests)

**Review focus:**
- Interface design (Adapter contract — is it general enough for other platforms?)
- GitHub issue ↔ NTO mapping correctness (state→phase/stage, labels, assignees)
- SyncCollection pagination and error handling (continues on individual failures)
- Remote ID index approach (ListTasks-based scan vs dedicated query)
- deterministicUUID security (SHA1 namespace collision risk)
- PushTask/PushComment error handling
- Test coverage for mapping edge cases

---

## Review Group 5: Infrastructure + Server Binary

**Scope:** Server binary, dependencies, test utilities.

**Files:**
- `cmd/farmtable-server/main.go` (+18 lines — auth interceptor registration, dialect config)
- `go.mod` (+4 lines — go-github, oauth2 deps)
- `go.sum` (+12 lines)
- `internal/testutil/` (new — teststore.go, testserver.go)

**Review focus:**
- Server startup (env var handling, graceful shutdown, signal handling)
- Auth interceptor registration (correct ordering with other interceptors)
- Test utilities (in-memory SQLite setup, bufconn test server)
- Dependency versions (go-github v62, oauth2 — are these current?)

---

## Process

### Phase 1: Review
fm assigns one review agent per group (5 agents in parallel). Each agent:
1. Reads all files in their group
2. Checks the review focus items
3. Produces a findings report: issues found (critical/high/medium/low), with file:line references
4. Reports back to fm

### Phase 2: Remediation
Based on review findings, fm assigns remediation agents to fix critical and high issues. Medium/low issues can be deferred with a note.

### Phase 3: Commit + Push
After remediation, fm:
1. Stages files in logical commit groups:
   - Commit 1: Store layer (schema + store.go + entstore.go + tests)
   - Commit 2: Server layer (server.go + convert.go + auth.go + tests)
   - Commit 3: CLI layer (all cli/* files)
   - Commit 4: Platform adapter (internal/platform/*)
   - Commit 5: Infrastructure (cmd/farmtable-server, go.mod, testutil, .design docs)
2. Creates commits with clear messages
3. Pushes to remote
