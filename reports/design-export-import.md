# Design: Collection Export/Import

**Date:** 2026-07-19
**Author:** Architect agent
**Status:** Ready for implementation
**Scope:** Medium (2 phases)

---

## Problem & Goals

Users need to export a complete farmtable collection to a portable file and import it on another server (or the same server for backup/restore). This enables two primary use cases:

1. **Backup/Restore** — snapshot a collection for safekeeping and restore it later.
2. **Cross-Server Migration** — move a collection from one farmtable instance to another.

**Success criteria:**
- A collection exported from server A can be imported on server B and produce a functionally identical collection (same tasks, comments, relationships, user attribution).
- The export file is human-readable and self-documenting (JSON with a version field).
- Both CLI (`ft`) and web dashboard surfaces are supported.
- Import is atomic — either the entire collection is created, or nothing is (no partial imports).

---

## Non-Goals

- **Merge-into-existing collection.** Import always creates a new collection. Merging overlapping data into an existing collection requires conflict resolution that is out of scope for v1.
- **External platform collections.** Export/import is scoped to `PLATFORM_FARMTABLE` collections only. External platform collections (GitHub, Linear, Jira, etc.) have fields not persisted in the Ent schema and should be synced via their respective platform integrations.
- **Streaming export for very large collections.** v1 uses unary (single request/response) RPCs. Collections with 10k+ tasks with full audit history may hit gRPC message size limits; a streaming version can be added later.
- **Attachments.** The proto defines `Attachment` but it is not implemented in the Ent store. Export/import ignores attachments.
- **API token migration.** Tokens are server-local authentication secrets and are never included in exports.

---

## Design Decisions (Investigator's 10 Open Questions)

### 1. UUID Strategy: Always Remap on Import

**Decision:** All entities receive new UUIDs on import. The import process builds an `original_uuid -> new_uuid` mapping table and rewrites every FK reference consistently.

**Rationale:** Remap-by-default is the only safe choice for both use cases:
- *Cross-server migration:* The target server may already have data. Even though UUIDv4 collision probability is negligible *statistically*, a user importing the same file twice (testing, recovery after a failed import) will *definitely* collide. The unique constraint on `(source_task_id, target_task_id, type)` for relationships would reject the second import.
- *Backup/restore:* Creating a fresh copy with new IDs is fine — the original still exists if this is a same-server restore, and the user can delete the old one.

**Alternatives rejected:**
- *Preserve original UUIDs:* Simpler format but breaks on duplicate imports and populated servers. Would require a `--force` flag to handle collisions, adding complexity with risk of data corruption.
- *User-selectable flag (`--preserve-ids` / `--remap-ids`):* Adds UX complexity for marginal benefit. If a future use case needs ID preservation (e.g., disaster recovery to an empty server), it can be added as an opt-in flag later. Always-remap is the correct default.

### 2. Cross-Collection Relationships: Drop with Warning

**Decision:** If a `Relationship.target_task_id` or `source_task_id` references a task outside the exported collection, that relationship is **excluded from the export** with a warning printed to stderr (CLI) or included in the export response metadata (web).

**Rationale:** Cross-collection relationships reference tasks that will not exist on the target server (they aren't part of this export). After UUID remapping, the original target UUID is meaningless. Silently preserving a dangling FK would create a broken relationship.

**Alternatives rejected:**
- *Preserve original UUID:* Only works if the same task happens to exist on the target server with the same UUID — effectively never after remapping.
- *Fail the export:* Too strict. Cross-collection relationships are a valid data model feature; their presence shouldn't block exporting the rest of the collection.
- *Include the referenced task:* Scope creep — exporting tasks from other collections cascades unboundedly.

### 3. User Identity Resolution: Match by Email, Then Create

**Decision:** On import, for each user in the export file:
1. If the user has an email and a user with the same email exists on the target server, **match** to that existing user (reuse their UUID).
2. Otherwise, **create a new user** with the exported `display_name`, `email`, `type`, and `status` fields.

The `author_id` and `assignee_id` FK references are then rewritten to point to the matched or newly created user's UUID.

**Rationale:** Comments and Changes have **required** `author_id` FKs — the import cannot succeed without valid user references. Creating users is safe because User entities in farmtable are lightweight identity records with no auth implications (API tokens are separate entities, never exported). Email matching provides reasonable "same person" resolution for the common case where both servers share a user population.

**Why not match by `display_name + type`?** Display names are not unique and can change. Email is a better stable identifier, even though it's optional and non-unique in the schema. If email matching produces ambiguity (multiple users with the same email on the target server), fall back to creating a new user rather than guessing.

**Alternatives rejected:**
- *Remap all to the importing user:* Loses authorship attribution, defeating the purpose of preserving comments and audit trails.
- *Fail on unmatched users:* Makes cross-server migration impractical — the target server would need every user pre-created.
- *Require a user mapping file:* Too cumbersome for v1. Could be added as an advanced `--user-map` flag later.

### 4. Audit Trail (Changes): Optional, Excluded by Default

**Decision:** The export includes Changes only when explicitly requested via `--include-changes` (CLI) or a checkbox in the web UI.

**Rationale:** Changes grow monotonically (every field update on every task creates a Change record). For a mature collection, the audit trail can be 10-100x larger than the active data. Most use cases (migration, backup for re-import) care about current state, not history. Including changes by default would make exports unnecessarily large and slow.

The `format_version` and format structure support the `changes` section being present or absent — the import handles both cases.

**Alternatives rejected:**
- *Always include:* Punishes the common case. A collection with 500 tasks might have 50,000 change records.
- *Never include:* Removes a legitimate archival use case. The opt-in flag costs almost nothing to implement.

### 5. Export Format: Single JSON Document with Sections

**Decision:** The export file is a single JSON object:

```json
{
  "format_version": 1,
  "exported_at": "2026-07-19T12:00:00Z",
  "generator": "farmtable",
  "collection": { ... },
  "users": [ ... ],
  "tasks": [ ... ],
  "comments": [ ... ],
  "relationships": [ ... ],
  "changes": [ ... ]
}
```

All IDs within the file are the **original UUIDs** from the source server. FK references (e.g., `task.assignee_id`, `comment.author_id`) reference other entities within the same file by their original UUIDs. This makes the file self-consistent and human-readable — you can grep for a UUID and see every entity that references it.

**Rationale:** JSON aligns with the existing strong JSON infrastructure (`taskToMap`, `collectionToMap`, `commentToMap`, `printJSON`). A single document is simpler than JSONL for this use case: we're exporting exactly one collection, not streaming an unbounded feed. The `format_version` field provides forward compatibility — future schema changes bump the version and the import code can handle old and new formats.

**Alternatives rejected:**
- *JSONL:* Streamable, but adds complexity (multi-line parsing, entity ordering matters) for a use case that doesn't need streaming in v1.
- *Protobuf binary:* Compact but not human-readable. Debugging import failures with a binary format is painful. Not worth the size savings for the expected data volumes.
- *SQLite dump:* Most complete but tightly coupled to the storage backend. Not portable between SQLite and Postgres backends.

### 6. API Surface: New Server-Side gRPC RPCs

**Decision:** Add two new RPCs to the `FarmTableService`:

```
rpc ExportCollection(ExportCollectionRequest) returns (ExportCollectionResponse);
rpc ImportCollection(ImportCollectionRequest) returns (ImportCollectionResponse);
```

The CLI commands and web UI both call these RPCs. The server has direct store access, so it can efficiently query all entities without pagination overhead (export) and create everything in a single transaction (import).

**Rationale:**
- **Export:** The existing RPCs would require N+1 calls: ListTasks (paginated, max 200/page), then ListComments and ListChanges per task. A server-side export queries the store directly in a single pass.
- **Import:** Atomicity is critical — creating a collection, tasks, comments, relationships, and users must all succeed or all fail. The existing Create/Add RPCs don't support transactional batching. A server-side import can wrap everything in a single database transaction.
- **Code deduplication:** Both CLI and web UI use the same RPCs. No logic duplication.

**Alternatives rejected:**
- *CLI-only client-side assembly:* Works for export but not for atomic import. Would require duplicating the logic for web UI.
- *Direct SQLite access from CLI:* Couples the CLI to the storage backend. Breaks when the server uses Postgres instead of embedded SQLite.

### 7. Ent Schema Gaps: Scoped to PLATFORM_FARMTABLE Only

**Decision:** Export/import only works for `PLATFORM_FARMTABLE` collections. The server validates this and returns an error if the user attempts to export an external platform collection.

**Rationale:** External platform collections have proto fields (`status_mappings`, `custom_field_definitions`, `remote_data`, `workspace_id`, `linked_account_id`) not persisted in the Ent schema. An export of these collections would be incomplete. External platform collections should be synced via their platform integrations, not via file export.

This aligns with the existing UI pattern: the settings gear icon in the toolbar is already conditionally shown only for `PLATFORM_FARMTABLE` collections.

### 8. Task.version Handling: Reset to "1" on Import

**Decision:** All imported tasks have their `version` field set to `"1"`.

**Rationale:** The `version` field is an optimistic concurrency control (CAS) token, not a schema version. Imported tasks are new entities on the target server — no concurrent writers have ever touched them. Starting at `"1"` is semantically correct and consistent with how `CreateTask` initializes new tasks. Preserving the original version (e.g., `"47"`) would be misleading and could cause CAS confusion if the server expects monotonic versions starting from a known baseline.

### 9. Assignee Multiplicity Gap: Use Proto Representation, Store First Only

**Decision:** The export format uses the Ent-level representation (`assignee_id` as a single nullable UUID), not the proto-level `repeated User assignees` list. On import, `assignee_id` is mapped through the UUID remapping table and stored directly.

**Rationale:** The impedance mismatch between proto (repeated assignees) and Ent (single `assignee_id`) is a pre-existing schema limitation. Using the Ent-level representation in the export avoids data loss — we export exactly what the store has. If the schema eventually supports multiple assignees, the `format_version` will bump and the export format will change accordingly.

### 10. Size Limits: Unary RPC with Raised Message Size for v1

**Decision:** v1 uses unary (single request/response) RPCs. The server raises `MaxRecvMsgSize` and `MaxSendMsgSize` for the export/import RPCs to 64 MB (configurable).

**Rationale:** A collection with 1,000 tasks, 5 comments each, and no audit trail is roughly 2-5 MB of JSON. 64 MB supports collections up to roughly 10,000-20,000 tasks with comments. This is far beyond typical usage. If larger collections become common, a streaming version can be added in a future release without changing the file format (the file format is JSON, not tied to the RPC transport).

**Known limitation:** Very large collections with `--include-changes` could exceed 64 MB. Document this in the CLI help text.

---

## Proposed Design

### Export File Format

The export file is a JSON document with the following structure. All fields use the **Ent schema field names** (snake_case), not the proto field names, to stay close to the storage layer and avoid the proto-Ent impedance mismatches.

```json
{
  "format_version": 1,
  "exported_at": "2026-07-19T15:30:00Z",
  "generator": "farmtable",

  "collection": {
    "id": "a1b2c3d4-...",
    "name": "Sprint 42",
    "description": "Q3 planning sprint",
    "platform": "farmtable",
    "created_at": "2026-07-01T09:00:00Z",
    "updated_at": "2026-07-19T15:00:00Z"
  },

  "users": [
    {
      "id": "u1-...",
      "display_name": "Alice Chen",
      "email": "alice@example.com",
      "type": "human",
      "status": "active"
    },
    {
      "id": "u2-...",
      "display_name": "BuildBot",
      "email": null,
      "type": "agent",
      "status": "active"
    }
  ],

  "tasks": [
    {
      "id": "t1-...",
      "title": "Implement auth middleware",
      "description": "Add JWT validation to all API endpoints",
      "phase": "open",
      "stage": "ready",
      "native_label": "",
      "type": "feature",
      "priority": "high",
      "assignee_id": "u1-...",
      "parent_task_id": null,
      "start_date": null,
      "due_date": "2026-07-25T00:00:00Z",
      "closed_at": null,
      "created_at": "2026-07-15T10:00:00Z",
      "updated_at": "2026-07-19T14:00:00Z",
      "acceptance_criteria": "All endpoints return 401 without valid JWT",
      "labels": ["security", "backend"],
      "repo": "github.com/example/api",
      "branch": "feat/auth",
      "ci_status": "passed",
      "pull_requests": [
        {"id": "123", "url": "https://github.com/example/api/pull/123", "status": "open"}
      ],
      "remote_data": null
    }
  ],

  "comments": [
    {
      "id": "c1-...",
      "task_id": "t1-...",
      "author_id": "u1-...",
      "body": "Started the implementation, middleware skeleton is up.",
      "created_at": "2026-07-16T11:00:00Z",
      "updated_at": "2026-07-16T11:00:00Z"
    }
  ],

  "relationships": [
    {
      "id": "r1-...",
      "source_task_id": "t1-...",
      "target_task_id": "t2-...",
      "type": "blocks"
    }
  ],

  "changes": []
}
```

**Notes on the format:**
- `collection_id` is **not** stored on each task — it is implicit from the `collection` top-level object. All tasks in the file belong to that collection.
- `users` contains every user referenced by any `assignee_id`, `author_id` in the file. This is a denormalized snapshot — users exist independently on the server, but the export captures the attribution metadata needed for import.
- `changes` is an empty array when `--include-changes` is not used. When included, each Change has `id`, `task_id`, `author_id`, `field_name`, `old_value`, `new_value`, `created_at`.
- Timestamps are RFC 3339 strings (consistent with existing JSON output in the CLI).
- Enum values use lowercase Ent enum strings (`"open"`, `"ready"`, `"high"`, `"blocks"`) not proto enum names.

### Proto Messages

```protobuf
// ── Export/Import ──

message ExportCollectionRequest {
  string id = 1;              // UUID of the collection to export
  bool include_changes = 2;   // Include audit trail (default: false)
}

message ExportCollectionResponse {
  bytes data = 1;             // JSON export document as bytes
  repeated string warnings = 2;  // e.g., "Dropped 2 cross-collection relationships"
}

message ImportCollectionRequest {
  bytes data = 1;             // JSON export document as bytes
  optional string name = 2;   // Override the collection name (optional)
  bool dry_run = 3;           // Validate without writing (default: false)
}

message ImportCollectionResponse {
  string collection_id = 1;   // UUID of the newly created collection
  ImportStats stats = 2;      // Counts of imported entities
  repeated string warnings = 3;  // e.g., "Created 2 new users: ..."
}

message ImportStats {
  int32 users_matched = 1;
  int32 users_created = 2;
  int32 tasks = 3;
  int32 comments = 4;
  int32 relationships = 5;
  int32 changes = 6;
}
```

**Design choices in the proto:**
- `bytes data` rather than inline message fields: keeps the proto simple and avoids defining a parallel set of export-specific message types for every entity. The JSON format is the contract; the proto just transports it.
- `warnings` as a repeated string: provides structured feedback for dropped relationships, created users, etc. without requiring a complex diagnostic message type.
- `dry_run`: essential for safe migration workflows — validate the file before committing.

### Server-Side Implementation (Pseudocode)

#### ExportCollection Handler

```go
func (s *FarmTableService) ExportCollection(ctx context.Context, req *ExportCollectionRequest) (*ExportCollectionResponse, error) {
    // 1. Get collection, verify PLATFORM_FARMTABLE
    coll := s.store.GetCollection(ctx, req.Id)
    if coll.Platform != "farmtable" {
        return error("export only supported for farmtable platform collections")
    }

    // 2. Fetch all tasks for this collection (no pagination — direct store query)
    tasks := s.store.ListAllTasksForCollection(ctx, coll.ID)  // new store method, no limit

    // 3. For each task, fetch comments (and optionally changes)
    comments := []
    changes := []
    userIDs := set{}
    for _, task := range tasks {
        taskComments := s.store.ListAllCommentsForTask(ctx, task.ID)
        comments = append(comments, taskComments...)
        for _, c := range taskComments {
            userIDs.add(c.AuthorID)
        }
        if req.IncludeChanges {
            taskChanges := s.store.ListAllChangesForTask(ctx, task.ID)
            changes = append(changes, taskChanges...)
            for _, ch := range taskChanges {
                userIDs.add(ch.AuthorID)
            }
        }
        if task.AssigneeID != nil {
            userIDs.add(*task.AssigneeID)
        }
    }

    // 4. Fetch relationships (only intra-collection ones)
    relationships := []
    warnings := []
    taskIDSet := set(task.ID for task in tasks)
    for _, task := range tasks {
        for _, rel := range task.Edges.SourceRelationships {
            if taskIDSet.contains(rel.TargetTaskID) {
                relationships = append(relationships, rel)
            } else {
                warnings = append(warnings, "Dropped cross-collection relationship ...")
            }
        }
    }

    // 5. Fetch referenced users
    users := s.store.GetUsers(ctx, userIDs)

    // 6. Assemble JSON document
    doc := buildExportDocument(coll, tasks, comments, relationships, changes, users)
    data := json.Marshal(doc)

    return &ExportCollectionResponse{Data: data, Warnings: warnings}
}
```

#### ImportCollection Handler

```go
func (s *FarmTableService) ImportCollection(ctx context.Context, req *ImportCollectionRequest) (*ImportCollectionResponse, error) {
    // 1. Parse and validate the JSON document
    doc := parseExportDocument(req.Data)
    if doc.FormatVersion != 1 {
        return error("unsupported format version: %d", doc.FormatVersion)
    }

    // 2. Resolve users: match by email or create new
    userMapping := map[uuid.UUID]uuid.UUID{}  // original -> new
    stats := ImportStats{}
    for _, exportedUser := range doc.Users {
        if existingUser := matchUserByEmail(ctx, exportedUser.Email); existingUser != nil {
            userMapping[exportedUser.ID] = existingUser.ID
            stats.UsersMatched++
        } else {
            newUser := s.store.CreateUser(ctx, exportedUser.toPrams())
            userMapping[exportedUser.ID] = newUser.ID
            stats.UsersCreated++
        }
    }

    if req.DryRun {
        return &ImportCollectionResponse{Stats: stats, Warnings: warnings}
    }

    // 3. Begin transaction
    tx := s.store.BeginTx(ctx)

    // 4. Create collection (new UUID)
    collName := req.Name ?? doc.Collection.Name
    newColl := tx.CreateCollection(collName, doc.Collection.Description)
    collMapping := {doc.Collection.ID: newColl.ID}

    // 5. Create tasks (new UUIDs, remap FKs)
    taskMapping := map[uuid.UUID]uuid.UUID{}
    for _, exportedTask := range doc.Tasks {
        params := exportedTask.toCreateParams()
        params.CollectionID = newColl.ID
        params.AssigneeID = userMapping[exportedTask.AssigneeID]  // may be nil
        params.ParentTaskID = taskMapping[exportedTask.ParentTaskID]  // may need ordering
        newTask := tx.CreateTask(params)
        taskMapping[exportedTask.ID] = newTask.ID
    }

    // 6. Create comments (new UUIDs, remap task_id and author_id)
    for _, exportedComment := range doc.Comments {
        tx.CreateComment(taskMapping[comment.TaskID], userMapping[comment.AuthorID], comment.Body)
    }

    // 7. Create relationships (new UUIDs, remap source/target task IDs)
    for _, exportedRel := range doc.Relationships {
        tx.CreateRelationship(taskMapping[rel.SourceTaskID], taskMapping[rel.TargetTaskID], rel.Type)
    }

    // 8. Create changes if present (new UUIDs, remap task_id and author_id)
    for _, exportedChange := range doc.Changes {
        tx.CreateChange(taskMapping[change.TaskID], userMapping[change.AuthorID], ...)
    }

    // 9. Commit transaction
    tx.Commit()

    return &ImportCollectionResponse{CollectionID: newColl.ID, Stats: stats}
}
```

**Import ordering note:** Tasks with `parent_task_id` references create a dependency: a child task must be created after its parent so the parent's new UUID is available in `taskMapping`. The import must **topologically sort** tasks by `parent_task_id` before creation (roots first, then children). This is straightforward since the hierarchy is a tree (no cycles).

### CLI Surface

#### Export Command

```bash
ft collection export <id-or-name> [flags]

Flags:
  --out <file>           Write to file instead of stdout
  --include-changes      Include audit trail (change history) in export

Examples:
  ft collection export "Sprint 42" --out sprint42-backup.json
  ft collection export abc123 > backup.json
  ft collection export abc123 --include-changes --out full-backup.json
```

**Implementation notes:**
- New subcommand registered under `newCollectionCmd()` in `collection.go`.
- Calls `ExportCollection` RPC via the existing gRPC client.
- Writes the `data` bytes from the response to `--out` file or stdout.
- Prints warnings from the response to stderr.
- Uses `resolveToken(globals.token)` + `authCtx()` for authentication (same as all CLI commands).

#### Import Command

```bash
ft collection import <file> [flags]

Flags:
  --name <name>          Override the collection name
  --dry-run              Validate without importing

Arguments:
  <file>                 Path to export file (or - for stdin, or @file)

Examples:
  ft collection import sprint42-backup.json
  ft collection import sprint42-backup.json --name "Sprint 42 (restored)"
  ft collection import sprint42-backup.json --dry-run
  cat backup.json | ft collection import -
```

**Implementation notes:**
- New subcommand registered under `newCollectionCmd()`.
- Reads the file using `readInputValue()` pattern (supports `@file` and `-` for stdin).
- Calls `ImportCollection` RPC.
- On success: prints the new collection ID and import stats to stdout (respects `--output` global flag).
- On `--dry-run`: prints validation results and stats without creating anything.
- Prints warnings (created users, etc.) to stderr.

### Web UI Surface

#### Export (Download)

**Placement:** A download icon button in the toolbar's `.collection-controls` div, next to the settings gear icon. Conditionally shown only for `PLATFORM_FARMTABLE` collections (same condition as the gear icon).

```html
<!-- In ft-toolbar.ts, inside the PLATFORM_FARMTABLE conditional block -->
<sl-icon-button
  name="download"
  label="Export collection"
  @click=${this.onExportClick}
></sl-icon-button>
```

**Flow:**
1. User clicks the download icon.
2. The handler calls `ExportCollection` via gRPC-Web.
3. On response, creates a Blob from the `data` bytes, generates an Object URL, and triggers a download via a programmatic `<a>` click with `download` attribute.
4. File name: `<collection-name>-<YYYY-MM-DD>.json` (sanitized for filesystem safety).
5. If warnings are present, show a brief `sl-alert` toast listing them.
6. No modal needed — single-click export.

**Include-changes option:** For v1, the web UI exports **without** changes (the common case). A future iteration could add a popover or small dialog with a checkbox before starting the export.

#### Import (Upload)

**Placement:** A new `ft-import-collection-dialog` component, triggered by an upload icon button in the toolbar. The button is always visible (importing is always into a new `PLATFORM_FARMTABLE` collection regardless of the currently selected collection).

```html
<!-- In ft-toolbar.ts, inside .collection-controls -->
<sl-icon-button
  name="upload"
  label="Import collection"
  @click=${this.onImportClick}
></sl-icon-button>
```

**Flow:**
1. User clicks the upload icon.
2. An `ft-import-collection-dialog` opens (Shoelace `<sl-dialog>`, same pattern as `ft-new-collection-dialog`).
3. Dialog contains:
   - A file input (`<input type="file" accept=".json">`, styled via Shoelace button).
   - Once a file is selected: display the file name, detected collection name, and entity counts (parsed client-side from the JSON).
   - An optional "Collection name" text input, pre-filled with the name from the file (editable to override).
   - "Import" and "Cancel" buttons.
4. On "Import": read the file via `FileReader`, send the bytes to `ImportCollection` via gRPC-Web.
5. Show a loading spinner during the RPC call.
6. On success: close the dialog, show an `sl-alert` toast with import stats, and navigate to the newly imported collection (same `pushState` + `applyRoute()` pattern used by the new-collection dialog).
7. On error: show the error message inline in the dialog (same pattern as `ft-new-collection-dialog`'s error handling).

---

## Alternatives Considered

### Client-Side Export/Import (No New RPCs)

**What:** CLI and web UI assemble the export by calling existing RPCs (ListTasks, ListComments per task, ListChanges per task) and perform import by calling CreateCollection, CreateTask, AddComment, etc.

**Why rejected:**
- Export requires N+1 paginated calls (200 tasks/page, then comments per task, changes per task). Slow and complex.
- Import has no transactional guarantees — a failure partway through leaves a partial collection. No existing RPC supports creating entities with caller-specified UUIDs.
- Logic duplicated between Go CLI and TypeScript web UI.

### Hybrid: Client-Side Export, Server-Side Import

**What:** Export uses existing RPCs (acceptable for CLI), but import uses a new server-side RPC (necessary for atomicity).

**Why rejected:** Asymmetric approach adds implementation complexity for marginal benefit. Since the import RPC requires backend work regardless, the marginal cost of adding an export RPC is low, and it provides a cleaner, faster export path for both surfaces.

### Direct SQLite Access for CLI

**What:** CLI opens the SQLite database file directly for export (read-only) and import (write), bypassing the gRPC server entirely.

**Why rejected:** Couples the CLI to the storage backend. Breaks when the server uses Postgres. Requires the CLI to run on the same machine as the database. Doesn't help the web UI at all.

---

## Migration / Rollout

This feature is entirely additive — no existing behavior changes. The new RPCs, CLI commands, and UI components are purely new surface area.

**Rollout plan:**
1. **Phase A** lands the backend RPCs and CLI commands. Users can export/import via `ft` immediately.
2. **Phase B** lands the web UI. No backend changes needed — it consumes the Phase A RPCs.
3. Both phases can be deployed independently. Phase B is a no-op without Phase A (the RPCs won't exist), so they must be deployed in order.

**Backward compatibility:** The `format_version: 1` field in the export file ensures that future format changes (e.g., adding multi-assignee support, new entity types) can be handled gracefully. The import handler checks the version and can maintain backward-compatible parsing for older formats.

---

## Open Questions

None. All 10 investigator questions are resolved above. The design is ready for implementation.

---

## Implementation Phases

### Phase A: Backend + CLI (Export/Import RPCs + `ft` Commands)

**Summary:** Add `ExportCollection` and `ImportCollection` gRPC RPCs to the server, the necessary store-layer functions (bulk query for export, transactional bulk create for import), and the `ft collection export` / `ft collection import` CLI commands.

**Scope:**
- Proto: New messages (`ExportCollectionRequest/Response`, `ImportCollectionRequest/Response`, `ImportStats`) and two new RPC definitions.
- Store: New methods for bulk-querying all tasks/comments/changes/relationships for a collection (without pagination limits), and new methods for transactional bulk entity creation with caller-controllable UUIDs.
- Server: `ExportCollection` and `ImportCollection` handlers implementing the export assembly and import-with-remapping logic. Raise gRPC message size limits.
- CLI: `ft collection export` and `ft collection import` subcommands under `collection.go`.
- Tests: Round-trip test (export a collection, import it, verify data integrity).

**Deliverable:** Working `ft collection export` and `ft collection import` commands, verified by a round-trip test.

### Phase B: Web UI (Export Download + Import Upload)

**Summary:** Add an export download button and an import upload dialog to the web dashboard, both calling the Phase A RPCs via gRPC-Web.

**Scope:**
- Toolbar: Export icon button (download) and import icon button (upload), conditionally shown for farmtable platform collections (export) and always shown (import).
- `ft-import-collection-dialog.ts`: New Lit component following the `ft-new-collection-dialog` pattern. File input, validation preview, import button, error handling.
- Export: Browser-side Blob → Object URL → download trigger. No new component needed (inline handler in `ft-toolbar.ts`).
- Navigation: On successful import, navigate to the new collection using existing `pushState` + `applyRoute()` routing.

**Deliverable:** Working export/import from the web dashboard, with screenshots showing both flows.

---

## Acceptance Criteria

### Phase A (Backend + CLI)
1. `ft collection export <id> --out file.json` produces a valid JSON file matching the format spec.
2. `ft collection import file.json` creates a new collection with all tasks, comments, and relationships intact.
3. All UUIDs are remapped — no UUID from the export file appears in the imported collection.
4. FK references (task→collection, comment→task, comment→author, relationship→source/target, task→parent, task→assignee) are all consistently rewritten.
5. Users are matched by email when possible; new users are created otherwise.
6. Cross-collection relationships are dropped with a warning.
7. `--include-changes` flag correctly includes/excludes the audit trail.
8. `--dry-run` validates the file and reports stats without writing anything.
9. `--name` flag overrides the collection name on import.
10. Import is atomic — on any error, no partial collection is left behind.
11. Exporting a non-farmtable-platform collection returns a clear error.
12. Round-trip test: export → import → export the import → diff the two exports (modulo UUIDs and timestamps) shows structural equivalence.

### Phase B (Web UI)
1. Export button appears next to the settings gear for farmtable collections, not for external platform collections.
2. Clicking export downloads a `.json` file with the correct collection name in the filename.
3. Import button opens a dialog with a file picker.
4. Selecting a file shows the collection name and entity counts.
5. Clicking "Import" creates the collection and navigates to it.
6. Errors are shown inline in the dialog (not silently swallowed).
7. The newly imported collection's tasks, comments, and relationships are visible on the board.
