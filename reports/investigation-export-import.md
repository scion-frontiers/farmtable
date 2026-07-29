# Investigation: Collection Export/Import — Feasibility & Landscape

**Date:** 2026-07-19
**Investigator:** Investigator agent
**Scope:** Research only — no implementation code produced.

---

## Summary

A collection export/import feature is feasible but non-trivial. The data model has 6 entity types transitively hanging off a Collection (tasks, comments, relationships, changes, users, plus the collection itself), all cross-referenced by UUID foreign keys. No export/import capability exists today — this would be built from scratch. The hardest design questions are: (1) UUID collision/remapping strategy for cross-server migration, (2) user identity resolution when importing into a server with a different user population, and (3) whether to include the audit trail (Changes) in exports. The CLI already has strong JSON output infrastructure to build on, but the web UI has zero file-upload/download precedent. Scope: **Medium** — the server-side export is mostly a walk-and-serialize, but the import side (especially cross-server with ID remapping) has real complexity.

---

## 1. Full Data Model Scope for "a Complete Collection"

A lossless collection export must capture 6 entity types. Here is each entity, its source-of-truth definition, and the fields that would need serialization:

### Collection
- **Proto:** `message Collection` — `proto/farmtable.proto:345-371`
- **Ent schema:** `internal/store/schema/collection.go:10-31`
- **Proto fields:** id, name, description, platform, remote_id, workspace_id, linked_account_id, status_mappings[], custom_field_definitions[], remote_data, created_at, updated_at
- **Ent fields:** id, name, description, platform, created_at, updated_at
- **Gap:** `status_mappings`, `custom_field_definitions`, `remote_data`, `workspace_id`, `linked_account_id` exist in the proto but are **not persisted** in the Ent store schema for built-in collections. These only come into play for external-platform collections. For built-in `PLATFORM_FARMTABLE` collections, the Ent schema is the complete picture.

### Task
- **Proto:** `message Task` — `proto/farmtable.proto:272-341`
- **Ent schema:** `internal/store/schema/task.go:12-57`
- **Fields:** id, title, description, phase, stage, native_label, type, priority (nullable enum), assignee_id (single UUID FK — note: proto has `repeated User assignees` but Ent stores a single `assignee_id`), collection_id, parent_task_id (self-referencing FK for hierarchy), start_date, due_date, closed_at, created_at, updated_at, acceptance_criteria, remote_data (JSON), labels (JSON string array), repo, branch, ci_status (nullable enum), pull_requests (JSON array of maps), version (string, default "1")
- **Edges:** collection (back-ref), parent/children (self-ref), comments, changes, source_relationships, target_relationships (both with cascade delete)

### Comment
- **Proto:** `message Comment` — `proto/farmtable.proto:375-391`
- **Ent schema:** `internal/store/schema/comment.go:12-39`
- **Fields:** id, task_id (FK), author_id (FK to User), body, created_at, updated_at
- **Note:** Proto defines `repeated Attachment attachments` but the Ent schema has **no attachment fields** — attachments are not yet implemented in the store.

### Relationship
- **Proto:** `message Relationship` — `proto/farmtable.proto:211-213` (embedded in Task)
- **Ent schema:** `internal/store/schema/relationship.go:12-45`
- **Fields:** id, source_task_id (FK), target_task_id (FK), type (enum: blocks, blocked_by, relates_to, duplicates, duplicated_by)
- **Note:** In the proto, relationships appear as a repeated field on Task with just (type, target_task_id). In the store, they are a **separate table** with their own UUIDs and bidirectional edges. Export must capture the full Relationship entity, not just the proto-level (type, target) pair, to preserve IDs and the source/target distinction.

### Change (Audit Trail)
- **Proto:** `message Change` — `proto/farmtable.proto:395-412`
- **Ent schema:** `internal/store/schema/change.go:12-41`
- **Fields:** id, task_id (FK), author_id (FK to User), field_name, old_value (string), new_value (string), created_at
- **Design question:** Should the audit trail be exported? It's large, grows monotonically, and is reconstructable on import if the import replays changes. But for a true "snapshot backup" use case, it should be included.

### User
- **Proto:** `message User` — `proto/farmtable.proto:200-208`
- **Ent schema:** `internal/store/schema/user.go:12-32`
- **Fields:** id, email (optional, nullable), display_name, type (string, default "agent"), status (string, default "active"), platform_id (optional), created_at, updated_at
- **Referenced by:** Task.assignee_id, Comment.author_id, Change.author_id
- **Not exported:** ApiToken (`internal/store/schema/apitoken.go`) — these are server-local authentication secrets and must never leave the server.

### Entity Dependency Graph
```
Collection
  └── Task (via collection_id FK)
        ├── Comment (via task_id FK)
        │     └── User (via author_id FK)
        ├── Relationship (via source_task_id / target_task_id FK)
        ├── Change (via task_id FK)
        │     └── User (via author_id FK)
        ├── Task (self-ref via parent_task_id — hierarchy)
        └── User (via assignee_id FK)
```

### Not Part of a Collection Export
- **ApiToken** (`internal/store/schema/apitoken.go`): Auth secrets, server-local.
- **LinkedAccount** (`proto/farmtable.proto:417-434`): Proto-only, not in Ent schema. Platform OAuth credentials.
- **WebhookEvent** (`proto/farmtable.proto:438-454`): Transient events, not persisted in Ent.

---

## 2. Existing Serialization/Export Capability

**There is no export, import, dump, backup, or snapshot functionality anywhere in the codebase.** Grep for these terms across `internal/`, `cmd/`, `web/src/` returns zero relevant hits.

However, the codebase has **strong JSON serialization infrastructure** that would serve as a foundation:

### CLI Output System (`internal/cli/output.go`)
- `taskToMap()` (`output.go:35-70`): Converts a proto Task to a `map[string]interface{}` for JSON output. Has a `compact` flag for list vs. detail views. Covers all NTO fields including relationships, custom_fields, code_context.
- `collectionToMap()` (`output.go:83-123`): Converts a proto Collection including status_mappings and custom_field_definitions.
- `commentToMap()` (`output.go:125-134`): Comment with author.
- `changeToMap()` (`task.go:899-917`): Change record with old/new values.
- `userToMap()` / `userFullToMap()` (`output.go:136-160`): User serialization.
- `printJSON()`, `printJSONLine()` (`output.go:14-21`): JSON and JSONL formatters.

### Server-Side Converters (`internal/server/convert.go`)
- `taskToProto()` (`convert.go:172-267`): Ent entity -> proto Task. Handles all fields including relationships from edges.
- `collectionToProto()` (`convert.go:366-378`): Ent entity -> proto Collection.
- `commentToProto()` (`convert.go:380-389`): Ent entity -> proto Comment.
- `changeToProto()` (`convert.go:391-406`): Ent entity -> proto Change.
- `userToProto()` (`convert.go:157-168`): Ent entity -> proto User.

### Existing CLI Output Modes
- `ft task list --full --collection <id> --output json` — outputs full NTO JSON for tasks (paginated, max 200/page)
- `ft task get <id> --with-comments --with-changes --output json` — single task with comments and audit trail
- `ft collection get <id> --output json` — collection metadata
- Output format flag: `--output json|jsonl|table|quiet` (global, `root.go:30`)

### What's Missing for Export
- No bulk/batch RPC to fetch all tasks + comments + relationships in one call
- ListTasks is paginated (max 200 per page via `ListTasksRequest.page_size`)
- No way to fetch all comments across a collection — only per-task via `ListComments`
- No way to fetch all relationships directly — they come back as edges on tasks
- No way to list all changes across a collection — only per-task via `ListChanges`

---

## 3. Cross-Server ID Handling

All primary entities use UUID v4 generated via `uuid.New()` (Go's `github.com/google/uuid`). The following table shows every UUID-typed field and its FK relationships:

| Entity       | Field            | FK Target     | Schema Location                    |
|-------------|------------------|---------------|------------------------------------|
| Collection  | id               | (PK)          | schema/collection.go:16            |
| Task        | id               | (PK)          | schema/task.go:18                  |
| Task        | collection_id    | Collection.id | schema/task.go:39                  |
| Task        | assignee_id      | User.id       | schema/task.go:38                  |
| Task        | parent_task_id   | Task.id       | schema/task.go:40                  |
| Comment     | id               | (PK)          | schema/comment.go:17               |
| Comment     | task_id          | Task.id       | schema/comment.go:18               |
| Comment     | author_id        | User.id       | schema/comment.go:19               |
| Relationship| id               | (PK)          | schema/relationship.go:17          |
| Relationship| source_task_id   | Task.id       | schema/relationship.go:18          |
| Relationship| target_task_id   | Task.id       | schema/relationship.go:19          |
| Change      | id               | (PK)          | schema/change.go:17                |
| Change      | task_id          | Task.id       | schema/change.go:18                |
| Change      | author_id        | User.id       | schema/change.go:19                |
| User        | id               | (PK)          | schema/user.go:16                  |

### Strategy A: Preserve Original UUIDs

- **Pros:** Simple export format. Cross-references remain valid without rewriting. If server B is empty (fresh install), this is the obvious choice.
- **Cons:** UUID collision risk if server B already has data. UUID v4 collision probability is negligible *statistically*, but if a user imports the same collection twice (restore after a botched import, or testing), IDs **will** collide. No unique constraint prevents importing a duplicate collection with the same ID.
- **Risk:** The Ent schema has a unique constraint on `(source_task_id, target_task_id, type)` for relationships (`schema/relationship.go:44`). Duplicate imports would hit this.

### Strategy B: Remap All UUIDs on Import

- **Pros:** No collision risk ever. Can import the same export file multiple times.
- **Cons:** Requires a complete UUID mapping table during import: `old_uuid -> new_uuid` for every entity. Must rewrite every FK reference consistently:
  - Task.collection_id -> new collection UUID
  - Task.parent_task_id -> new task UUID
  - Task.assignee_id -> new or matched user UUID
  - Comment.task_id -> new task UUID
  - Comment.author_id -> new or matched user UUID
  - Relationship.source_task_id -> new task UUID
  - Relationship.target_task_id -> new task UUID
  - Change.task_id -> new task UUID
  - Change.author_id -> new or matched user UUID
  - **Cross-collection relationships:** If a Relationship.target_task_id points to a task *outside* the exported collection, remapping breaks. Must detect and handle gracefully (drop? warn? preserve original UUID?).

### Structural Observation
Relationships can reference tasks in OTHER collections (the proto has no collection-scoping on `target_task_id`). An export of Collection A may include a relationship where `target_task_id` points to a task in Collection B. This is a fundamental design question for the architect.

---

## 4. User/Author Identity Across Servers

### How Users Are Modeled
- `User` entity (`schema/user.go:16-28`): id (UUID), email (optional nullable string), display_name, type ("human"/"agent"/"service_account"), status ("active"/"suspended"/"archived"), platform_id (optional string)
- The `email` field is **optional and nullable** — not all users have one (especially agents and service accounts).
- There is **no unique constraint on email** in the schema — it's just `field.String("email").Optional().Nillable()`.
- There is **no concept of "external", "orphaned", or "placeholder" user** in the schema. All user types are: human, agent, service_account.

### Where Users Are Referenced
- `Task.assignee_id` — optional FK, nullable
- `Comment.author_id` — **required** FK (schema/comment.go:19 — no `.Optional()`)
- `Change.author_id` — **required** FK (schema/change.go:19 — no `.Optional()`)

### The Problem
When importing into server B:
1. Comments and Changes **require** a valid `author_id`. The FK constraint will reject the record if the user doesn't exist.
2. If the original author doesn't exist on server B, the import must either:
   - **Create a placeholder user** with the exported name/email/type. This is the cleanest approach for preserving authorship. Could use a special status or naming convention to mark them as imported.
   - **Remap to the importing user.** Loses authorship attribution, which defeats the purpose of audit trails.
   - **Fail the import.** Overly strict — makes cross-server migration impractical.
3. If users are created during import, email collisions could occur if a user with the same email already exists on server B (though there's no unique constraint on email, so technically both could coexist — but this is confusing).

### Suggested Resolution Path
Users should be exported as part of the collection bundle (all users referenced by any task, comment, or change in the collection). On import, match by email first (if present), then by display_name + type, and create new users for unmatched entries. This is the architect's call.

---

## 5. Version Field Analysis

- **Definition:** `field.String("version").Default("1")` — `schema/task.go:56`
- **Proto:** `string version = 27` — `proto/farmtable.proto:340`
- **Purpose:** **Optimistic concurrency control (CAS)**, not schema versioning.

### How It Works (from `internal/store/entstore.go`):
- On every update: version is incremented — `SetVersion(strconv.Itoa(v + 1))` (entstore.go:527,531)
- On conditional update: `Where(task.VersionEQ(p.Version))` — rejects with `ErrConflict` if version mismatch (entstore.go:524-525)
- On claim: same CAS pattern with version check (entstore.go:755-763)
- Version starts at "1" for new tasks and monotonically increments.
- Documented in proto comment: "Opaque concurrency token for optimistic locking. Monotonic integer (as string) on the built-in backend" (proto:339-341)

### Bearing on Export/Import
- **No bearing on export format versioning.** The `version` field is per-task CAS state, not a schema version.
- On import, imported tasks should have their `version` field preserved (for backup/restore) or reset to "1" (for migration to a new server where no concurrent writers exist yet).
- The export file format itself needs its **own** version field (e.g., `"format_version": "1"`) for forward compatibility. This is independent of Task.version.

---

## 6. CLI Surface Today

### Current Command Tree (`internal/cli/root.go:35-48`)
```
ft
├── task
│   ├── get <id>          (--with-comments, --with-changes)
│   ├── list              (--phase, --stage, --assignee, --full, --limit, --cursor, etc.)
│   ├── create <name>     (--description, --stage, --priority, --parent, etc.)
│   ├── insert-after <id> (--step, --type, --priority)
│   ├── update <id>       (extensive field flags)
│   ├── claim <id>        (--assignee, --stage, --version)
│   ├── release <id>      (--stage, --reason)
│   ├── close <id>        (--stage, --reason, --duplicate-of)
│   ├── ready             (graph query)
│   ├── blocked           (graph query)
│   ├── tree <id>         (dependency tree)
│   ├── critical-path     (graph query)
│   └── bottlenecks       (graph query)
├── collection
│   ├── list              (--platform)
│   ├── get <id>
│   └── create <name>     (--description)
├── comment               (add, list)
├── change                (list)
├── user                  (whoami, list, get)
├── token                 (create, list, revoke)
├── config                (show, set)
├── version
├── status
├── mcp
├── watch                 (streaming)
└── dashboard             (web UI)
```

### Natural Command Shape
Based on existing conventions (`root.go:30-33` global flags, cobra subcommand pattern):

```bash
# Export
ft collection export <id-or-name> --out <file.json>
ft collection export <id-or-name> --out -  # stdout
ft collection export <id-or-name> --out <file.json> --include-changes  # include audit trail
ft collection export <id-or-name> --out <file.json> --format json  # future: protobuf, etc.

# Import
ft collection import <file.json>
ft collection import -  # stdin
ft collection import <file.json> --name "New Name"  # override collection name
ft collection import <file.json> --dry-run  # validate without writing
ft collection import <file.json> --remap-ids  # force UUID remapping (vs. preserve)
```

### Implementation Notes
- Both commands would be new subcommands under `newCollectionCmd()` (`collection.go:16-21`)
- Auth handling: same `resolveToken(globals.token)` + `authCtx()` pattern used everywhere
- The `--output` global flag should be respected for export (json is natural default)
- For import, progress reporting could use stderr (as `printTaskTable` already does at `output.go:309`)
- The `readInputValue()` helper (`internal/cli/input.go`) already supports `@file` and `-` for stdin — this pattern should be reused for import

---

## 7. Web UI Surface Today

### Technology Stack
- **Framework:** Lit (Web Components) + Shoelace (UI component library)
- **State:** Custom `TaskStore` + `TaskStoreController` + `StreamManager`
- **API client:** gRPC-Web via `@improbable-eng/grpc-web` with protobufjs (`web/src/gen/grpc-client.ts`)

### Collection-Related UI Components
- **`ft-toolbar.ts`** (toolbar.ts:34-416): Top toolbar containing collection picker, settings gear icon (line 148-154), new collection button, phase/assignee filters, view toggle
- **`ft-collection-picker.ts`** (collection-picker.ts:8-228): Dropdown to switch active collection
- **`ft-collection-settings-dialog.ts`** (collection-settings-dialog.ts:28-191): Modal dialog for editing collection name/description. Only shown for `PLATFORM_FARMTABLE` collections (toolbar.ts:146)
- **`ft-new-collection-dialog.ts`**: Modal for creating new collections

### Natural Placement for Export/Import
- **Export button:** Next to the gear icon in the toolbar's `.collection-controls` div (toolbar.ts:134-156). Could be a download icon (`box-arrow-down` or `download` in Shoelace icon set). Conditionally shown for `PLATFORM_FARMTABLE` only, like the settings gear.
- **Import:** Either a dedicated toolbar button or within the collection picker dropdown, or as an option in the new-collection dialog ("Import from file" alongside "Create new").
- **Alternative:** Add Export/Import actions inside the `ft-collection-settings-dialog` as additional buttons below Save/Cancel.

### File Upload/Download Precedent
- **There is NO existing file upload or download pattern in the web UI.** The only file reference is `Attachment.filename` in `web/src/gen/types.ts:172`, which is defined but not used in any component.
- This would be the **first file-upload/download interaction** in the dashboard.
- For **download (export):** Use the standard browser pattern — create a Blob from JSON, generate an Object URL, programmatically click an `<a>` element with `download` attribute. No server endpoint needed if the client assembles the data from existing RPCs.
- For **upload (import):** Use `<input type="file">` or Shoelace's `<sl-button>` wrapping a hidden file input. Read via `FileReader`, parse JSON, then make a series of gRPC calls to create entities. Or, if a server-side import RPC is added, upload the raw file as bytes.
- **Consideration:** Client-side export (fetching all data via existing RPCs and assembling locally) vs. server-side export (a new RPC that streams/returns the full bundle). Client-side is simpler to build but must handle pagination; server-side is more reliable for large collections.

---

## Open Design Questions for the Architect

### 1. UUID Strategy: Preserve vs. Remap
Should imported entities keep their original UUIDs or get new ones? This affects every FK reference in the bundle. Preserving is simpler for backup/restore to the same server; remapping is required for safe migration to a populated server. Consider offering both as import flags (`--preserve-ids` / `--remap-ids`), with remap as default.

### 2. Cross-Collection Relationships
If a Relationship.target_task_id points to a task outside the exported collection, what happens on import? Options: drop the relationship with a warning, preserve the original UUID (works if the target exists on the importing server), or fail. The Ent schema allows cross-collection relationships since there's no collection scoping on the Relationship table.

### 3. User Identity Resolution on Import
How should the import handle users that don't exist on the target server? The Comment and Change entities have **required** author_id FKs. Options:
- Create placeholder users (what type? what status?)
- Match by email (email is optional and non-unique — may not be reliable)
- Match by display_name + type
- Remap all to the importing user (loses attribution)
- Some combination with a configurable policy

### 4. Audit Trail (Changes) Inclusion
Should the audit trail be part of the export? It can be very large and is theoretically reconstructable. Options:
- Always include (complete backup)
- Optional (`--include-changes` flag)
- Never include (leaner export, audit trail starts fresh on import)

### 5. Export Format
What file format? Candidates:
- **JSON** — human-readable, matches existing CLI output format, largest size
- **JSONL** — one entity per line, streamable, easier to process
- **Protobuf binary** — compact, schema-typed, not human-readable
- **SQLite** — direct database dump (already the built-in backend format), most complete but least portable
- Consider a container format (JSON document with sections for collection, tasks, comments, relationships, changes, users) with a `format_version` field.

### 6. Export/Import API Surface
Should this be:
- **CLI-only** (client-side assembly using existing RPCs) — simplest, but slow for large collections (many paginated calls)
- **New gRPC RPCs** (`ExportCollection` / `ImportCollection`) — server-side, more efficient, but new proto definitions and server logic
- **Both** (server-side RPCs used by both CLI and web UI)
The brief requests both CLI and web UI support, which argues for server-side RPCs.

### 7. Ent Schema Gaps
The Ent Collection schema is missing several proto fields: `status_mappings`, `custom_field_definitions`, `remote_data`, `workspace_id`, `linked_account_id`. For `PLATFORM_FARMTABLE` collections these are unused, but if export/import should round-trip collections from external platforms, these need to be addressed first. Is export/import scoped to built-in collections only?

### 8. Task.version Handling on Import
Reset all task versions to "1" on import (clean slate, appropriate for migration) or preserve them (appropriate for backup/restore where concurrent writers may exist)? If preserving, the version must not conflict with any CAS operations that have already occurred on the target server.

### 9. Assignee Multiplicity Gap
The proto Task has `repeated User assignees` (multiple assignees), but the Ent schema stores a single `assignee_id`. The server-side `taskToProto()` wraps the single assignee in a list (convert.go:203). Export should use the proto representation (list), but import must handle the impedance mismatch — only the first assignee can be stored. This is a pre-existing schema limitation, not specific to export/import, but the export format should not lose data.

### 10. Size Limits and Streaming
For large collections (thousands of tasks, each with comments and changes), the export could be very large. Should the format support streaming (JSONL / server-streaming RPC) or be a single document? The web UI download may need a progress indicator for large exports.
