# Code Review: Collection Export/Import Phase A

**Branch:** `feat/collection-export-import` (commit `a426fdc`)
**Reviewer:** Senior Staff Engineer
**Date:** 2026-07-19

---

## Review Summary

**Verdict:** REQUEST CHANGES

**Overview:** A well-structured first pass at collection export/import with solid test coverage and thorough input validation. One significant correctness issue (orphaned users on failed import) and two N+1 query patterns need addressing before merge; the remaining items are minor improvements.

---

## Critical Issues

### C1. User creation outside import transaction — orphaned users on failure

**File:** `internal/server/export_import.go:279, 479-488`
**Severity:** Critical

`resolveImportUsers` creates new users via `s.store.CreateUser` (line 479) on the **main store client**, outside the transaction that `s.store.ImportCollection` opens at `entstore.go:1519`. If the import transaction fails (e.g., a task has a duplicate ID, a FK violation, or a commit error), the created users persist as orphans in the database with no collection or tasks referencing them.

**Failure scenario:** Import a document with 10 users that need creation. Import succeeds at user creation, but fails at task 47 due to an invalid parent reference. Result: 10 orphaned user rows, no collection created, and the user sees only an error.

**Suggested Fix:** Move user creation into the `ImportCollection` transaction. Pass the unresolved user list to the store layer and let the store's transaction handle both user creation and collection import atomically:

```go
// Option A: Add user creation to ImportCollectionParams
type ImportCollectionParams struct {
    Collection    ImportCollection
    UsersToCreate []CreateUserParams   // new field
    UserMapping   map[string]uuid.UUID // pre-resolved matches
    Tasks         []ImportTask
    // ...
}

// In entstore.go ImportCollection, create users inside the tx:
for _, u := range p.UsersToCreate {
    created, err := tx.User.Create()...
    // update mapping
}
```

Alternatively, if restructuring the store interface is too invasive for Phase A, wrap the entire import handler in a store-level transaction or document the orphan risk and add cleanup.

---

## Important Issues

### I1. N+1 query: Comments and changes fetched per-task in export

**File:** `internal/server/export_import.go:145-177`
**Severity:** Important (Performance)

The export handler iterates over all tasks and makes one `ListAllCommentsForTask` call (and optionally one `ListAllChangesForTask` call) **per task**. For a collection with 500 tasks, this issues 500-1000 individual DB queries.

**Suggested Fix:** Add bulk query methods to the store:

```go
// Store interface
ListAllCommentsForCollection(ctx, CollectionID) ([]*ent.Comment, error)
ListAllChangesForCollection(ctx, CollectionID) ([]*ent.Change, error)

// Implementation uses JOIN:
// Comment.Query().Where(comment.HasTaskWith(task.CollectionIDEQ(collID))).All(ctx)
```

Then group results by TaskID in the handler. This reduces the comment/change export to 1-2 queries regardless of task count.

### I2. N+1 query: Users fetched individually in export

**File:** `internal/server/export_import.go:206-215`
**Severity:** Important (Performance)

Each user referenced by tasks/comments is fetched with an individual `GetUser` call inside a loop. For collections with many distinct assignees and commenters, this can be N separate queries.

**Suggested Fix:** Add a `GetUsersByIDs(ctx, []uuid.UUID) ([]*ent.User, error)` method using `user.IDIn(ids...)`, and call it once:

```go
users, err := s.store.GetUsersByIDs(ctx, userIDList)
```

### I3. `ImportCollectionRequest.data` has no validation constraint

**File:** `proto/farmtable.proto:714`
**Severity:** Important (Security, minor)

The `bytes data` field has no `buf.validate` constraint, so it accepts empty payloads (which would then fail at JSON unmarshal with a less helpful error). Adding `[(buf.validate.field).bytes.min_len = 2]` gives a clean validation error for empty/trivial payloads. The gRPC 64MB max message size provides the upper bound.

---

## Suggestions

### S1. `ExportCollectionRequest.id` should use `.string.uuid` validation

**File:** `proto/farmtable.proto:699`
**Severity:** Suggestion

The server-side handler (`export_import.go:103`) immediately calls `uuid.Parse(req.GetId())`. Unlike `GetTaskRequest` which accepts UUID prefixes, this endpoint requires a full UUID. Using `[(buf.validate.field).string.uuid = true]` would reject non-UUID inputs at the proto validation layer, before reaching the handler.

However, I note the CLI resolves collection names to UUIDs via `resolveCollectionIDArg`, so `min_len = 1` is consistent with the CLI-facing design. Consider whether you want to allow name-based resolution server-side in the future. If not, tighten to `.uuid`.

### S2. Dry-run warning message says "created" for users that were not created

**File:** `internal/server/export_import.go:490-491`
**Severity:** Suggestion (UX)

In dry-run mode, the warning says `"Created %d new users"` even though no users were actually created (line 475-477 skips creation). Consider:

```go
if dryRun {
    warnings = append(warnings, fmt.Sprintf("Would create %d new users", created))
} else {
    warnings = append(warnings, fmt.Sprintf("Created %d new users", created))
}
```

### S3. Export document `Users` field not initialized, will be null in JSON when empty

**File:** `internal/server/export_import.go:133`
**Severity:** Suggestion

`doc.Users` is never initialized (unlike `Tasks`, `Comments`, `Relationships`, `Changes` which all get `make([]..., 0, ...)` or `[]exportT{}`). If a collection has no tasks with assignees and no comments, the exported JSON will have `"users": null` instead of `"users": []`. This is inconsistent with the other arrays and may trip up external consumers.

**Suggested Fix:**
```go
doc := exportDocument{
    // ...
    Users:         []exportUser{},           // add initialization
    Tasks:         make([]exportTask, 0, len(tasks)),
    // ...
}
```

### S4. `readCollectionImportData` supports stdin via `"-"` and `@file`, but `"import <file>"` usage text suggests only file paths

**File:** `internal/cli/collection.go:253, 276-280`
**Severity:** Suggestion

The `Use: "import <file>"` doesn't mention that `-` for stdin or `@path` syntax is supported. Consider:

```go
Use: "import <file|-|@path>"
```

### S5. Relationship query may return relationships where only one side is in the collection

**File:** `internal/store/entstore.go:1013-1024`
**Severity:** Suggestion (Correctness confirmation)

`ListAllRelationshipsForCollection` uses `OR(source in collection, target in collection)`. This is intentional — it fetches cross-collection relationships so the export handler can detect and drop them (lines 181-190). The logic is correct; just noting the query is broader than "intra-collection" by design, and the export handler filters appropriately.

### S6. Consider `json.NewDecoder` with `DisallowUnknownFields` for stricter import parsing

**File:** `internal/server/export_import.go:233`
**Severity:** Suggestion

Currently `json.Unmarshal` silently ignores unknown fields in the import document. For a format that has a `format_version` field, you may want stricter parsing to catch typos in field names (e.g., `"taks"` instead of `"tasks"` would silently result in zero tasks imported):

```go
dec := json.NewDecoder(bytes.NewReader(req.GetData()))
dec.DisallowUnknownFields()
if err := dec.Decode(&doc); err != nil { ... }
```

This would be a breaking change if external tools add extra fields, so consider whether you want forward-compatibility or strictness.

---

## What's Done Well

1. **Topological sort for parent tasks (`orderImportTasks`)** — Clean DFS-based topological ordering with cycle detection. This correctly ensures parent tasks are created before children in the import transaction, preventing FK violations. The algorithm is textbook and well-implemented.

2. **Comprehensive input validation** — `validateImportReferences` validates every ID, cross-references all task/user/comment/relationship references, and validates enum values before any database writes. This is thorough defensive programming.

3. **Cross-collection relationship handling** — The decision to fetch all relationships (including cross-collection), filter them, and warn on dropped ones is clean. The export handler correctly uses a task ID set for O(1) membership checks.

4. **Transaction usage in `ImportCollection` store method** — The Ent transaction with `defer tx.Rollback()` is idiomatic Go/Ent. All entity creation within the transaction is properly sequenced (collection first, then tasks in topological order, then comments, then relationships, then changes).

5. **gRPC message size coordination** — The 64MB limit is consistently applied across all connection paths: production server, CLI client, embedded server, dashboard, passthrough, and test servers. The `grpcMaxMessageSize` constant prevents drift.

6. **Test quality** — Five tests covering the main paths: round-trip fidelity (with UUID remapping, user matching, parent-child, labels, relationships), cross-collection relationship dropping, email-based user matching, dry-run side-effect verification, and error cases. The round-trip test is particularly thorough in verifying imported data matches expectations.

7. **Passthrough store stubs** — All new interface methods are properly stubbed with `ErrNotImplemented` in the GitHub passthrough store, keeping the interface satisfied.

---

## Verification Story

- **Tests reviewed:** Yes — 5 tests, all pass. Coverage is good for happy paths. Missing test: import with changes included, import with ambiguous email (multiple users with same email), import with a cycle in parent_task_id.
- **Build verified:** Yes — `go build ./...` succeeds.
- **Lint/static analysis clean:** Not run (no linter config detected in CI diff), but build is clean.
- **Security checked:** Yes — auth interceptor applies uniformly to all RPCs (no allowlist), UUID parsing validates all IDs, platform restriction prevents non-farmtable imports. No credential exposure. The orphaned-user issue (C1) is the main concern.

---

## Summary of Required Changes

| # | Severity | Issue | Action |
|---|----------|-------|--------|
| C1 | Critical | Orphaned users on failed import | Move user creation into the import transaction |
| I1 | Important | N+1 comments/changes queries in export | Add bulk collection-level queries |
| I2 | Important | N+1 user queries in export | Add batch user fetch by IDs |
| I3 | Important | No validation on import `data` bytes | Add `min_len` proto validation |
