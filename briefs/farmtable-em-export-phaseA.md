# Brief: Engineering Manager — Collection Export/Import Phase A: Backend + CLI

## Critical Constraints (read first)

- **Only one agent runs at a time.** Never run a developer and a reviewer
  simultaneously.
- **You do NOT merge anything.** When ready, push the branch, open a PR with
  `gh pr create`, then message the coordinator with the PR URL and summary.
  The coordinator runs `gh pr merge --squash` itself.
- **Reviewers must be blind.** Each review round is a brand-new
  `code-reviewer` agent (`--harness claude`) with zero knowledge of prior
  review feedback — give it only the current repo/diff state.
- **Exit criteria for the review loop:**
  - Round 1: have the developer fix ALL findings (including nitpicks).
  - Round 2 onward: if the fresh review returns ONLY nitpick/minor findings
    (nothing significant/blocking), STOP — ship as-is. Otherwise fix and
    run another fresh review round.
  - Hard cap: 5 review rounds total.
- **Agent types/harnesses:**
  - Developer: `scion start farmtable-exportA-dev --type developer <task>` —
    NO `--harness` flag (project default is codex).
  - Reviewer: `scion start farmtable-exportA-review-rN --type code-reviewer
    --harness claude <task>` (r1, r2, r3...).
- **Keep the developer agent alive** across all fix iterations.
- **Before opening the PR, rebase onto latest origin/main and confirm `gh
  pr view <n> --json mergeStateStatus,mergeable` shows CLEAN/MERGEABLE.**
- **Quota watch:** if an agent stalls/errors with quota/rate-limit signs,
  don't keep retrying — `scion look` it and message the coordinator.
- **The coordinator will NOT independently re-read your diff or re-open
  your screenshots** — your own verification is what stands. Be rigorous.
- **INVESTIGATE BEFORE BUILDING (do this first):** Before writing any
  code, the developer should read the design doc at
  `/scion-volumes/scratchpad/projects/farmtable/reports/design-export-import.md`
  in full, then verify that the proto messages and store methods described
  there align with the current codebase. Report what the developer finds
  before committing to the implementation plan — especially:
  - Whether any bulk-query store methods (e.g., listing all tasks without
    pagination) already exist or need to be added.
  - Whether the Ent-generated code supports transactional creation of all
    entity types needed (Collection, Task, Comment, Relationship, Change,
    User).
  - Whether the gRPC max message size is currently configured or uses the
    default 4 MB.

## Feature Spec

Add `ExportCollection` and `ImportCollection` gRPC RPCs to the
FarmTableService, plus `ft collection export` and `ft collection import`
CLI commands. This is Phase A of the collection export/import feature — the
backend and CLI surface. Phase B (web UI) will consume these RPCs in a
subsequent PR.

### Proto Changes

Add the following to `proto/farmtable.proto`:

**New messages:**

- `ExportCollectionRequest` — fields: `string id` (collection UUID),
  `bool include_changes` (include audit trail, default false).
- `ExportCollectionResponse` — fields: `bytes data` (the JSON export
  document), `repeated string warnings` (e.g., dropped cross-collection
  relationships).
- `ImportCollectionRequest` — fields: `bytes data` (the JSON export
  document), `optional string name` (override collection name),
  `bool dry_run` (validate without writing).
- `ImportCollectionResponse` — fields: `string collection_id` (new
  collection UUID), `ImportStats stats`, `repeated string warnings`.
- `ImportStats` — fields: `int32 users_matched`, `int32 users_created`,
  `int32 tasks`, `int32 comments`, `int32 relationships`, `int32 changes`.

**New RPCs (add to FarmTableService):**

```
rpc ExportCollection(ExportCollectionRequest) returns (ExportCollectionResponse);
rpc ImportCollection(ImportCollectionRequest) returns (ImportCollectionResponse);
```

After modifying the proto, regenerate Go code (`go generate ./...` or the
project's protoc workflow — check the Makefile / build instructions).

### Store Layer

Add new store methods to support bulk operations. These do NOT go through
the paginated ListTasks/ListComments/ListChanges interfaces — they need to
fetch ALL entities for a collection efficiently.

**For export (read-only):**
- `ListAllTasksForCollection(ctx, collectionID) ([]*ent.Task, error)` —
  all tasks with edges (relationships, comments) eager-loaded.
- `ListAllCommentsForTask(ctx, taskID) ([]*ent.Comment, error)` — all
  comments for a task, no pagination.
- `ListAllChangesForTask(ctx, taskID) ([]*ent.Change, error)` — all
  changes for a task, no pagination.
- `ListAllRelationshipsForCollection(ctx, collectionID)` — or extract from
  task edges; the developer should choose the most efficient approach.

**For import (transactional write):**
- The import must create all entities within a **single database
  transaction** — if any step fails, the entire import rolls back. Use the
  same `s.client.Tx(ctx)` pattern as `CreateTask`.
- The import must be able to create entities with **server-generated UUIDs**
  (not caller-specified) and build the mapping as it goes. The import
  topologically sorts tasks by `parent_task_id` (parents before children)
  so that the parent's new UUID is available when creating the child.
- New store methods or a single `ImportCollection` method that wraps the
  entire transactional creation — developer's judgment on whether to add
  individual bulk-create methods or a monolithic import method.
- User resolution: for each user in the export file, match by email first
  (if email is present and exactly one match exists on the server), else
  create a new user. User creation/matching happens BEFORE the main
  transaction (users are shared resources, not collection-scoped).

### Server Handlers

**ExportCollection handler:**
1. Validate the collection exists and is `PLATFORM_FARMTABLE`. Return
   `InvalidArgument` for non-farmtable collections.
2. Fetch the collection, all tasks, all comments (per task), all
   relationships (filter to intra-collection only), and optionally all
   changes.
3. Collect all referenced user IDs (from assignee_id, author_id fields),
   fetch those users.
4. Build the export JSON document matching the format in the design doc
   (see `/scion-volumes/scratchpad/projects/farmtable/reports/design-export-import.md`
   for the exact format spec and a sample document).
5. Return the JSON as `bytes data` plus any warnings.

**ImportCollection handler:**
1. Parse and validate the JSON document. Check `format_version == 1`.
2. Resolve users (match by email or create new).
3. If `dry_run`, return stats and warnings without writing.
4. Create collection (new UUID), create tasks (topologically sorted by
   parent_task_id, all new UUIDs), create comments, create relationships,
   create changes — all in one transaction.
5. Remap every FK reference using the `old_uuid -> new_uuid` mapping.
6. On success, return the new collection ID and stats.
7. On failure, the transaction rolls back — no partial data.

**gRPC message size:** Raise `MaxRecvMsgSize` and `MaxSendMsgSize` to
64 MB for these two RPCs (or globally if the server configuration makes
per-RPC limits impractical). Check how the gRPC server is currently
configured — if it already uses custom options, add there; otherwise add
`grpc.MaxRecvMsgSize(64 << 20)` and `grpc.MaxSendMsgSize(64 << 20)` to
the server options.

### CLI Commands

**`ft collection export <id-or-name> [flags]`**

Register as a new subcommand under `newCollectionCmd()` in
`internal/cli/collection.go`.

Flags:
- `--out <file>` — write to file instead of stdout.
- `--include-changes` — include audit trail.

Behavior:
- Calls `ExportCollection` RPC.
- Writes the `data` bytes to `--out` file or stdout.
- Prints warnings to stderr (one per line, prefixed with `warning:`).
- On error, prints the error to stderr and exits with non-zero status.
- Uses the same `resolveToken` / `authCtx` auth pattern as all other
  commands.

**`ft collection import <file> [flags]`**

Flags:
- `--name <name>` — override the collection name.
- `--dry-run` — validate without importing.

Arguments:
- `<file>` — path to export file. Supports `-` for stdin and `@file`
  prefix via the existing `readInputValue()` helper in `input.go`.

Behavior:
- Reads the file, calls `ImportCollection` RPC.
- On success: prints the new collection ID and import stats (respects
  `--output` global flag for json/table/quiet formatting).
- On `--dry-run`: prints validation results and stats, then exits
  without creating anything.
- Prints warnings to stderr.

### Export File Format Reference

The complete format specification with a sample document is in the design
doc. Key structural points for the developer:

```json
{
  "format_version": 1,
  "exported_at": "RFC3339 timestamp",
  "generator": "farmtable",
  "collection": { "id": "...", "name": "...", "description": "...", "platform": "farmtable", "created_at": "...", "updated_at": "..." },
  "users": [ { "id": "...", "display_name": "...", "email": "..." or null, "type": "human|agent|service_account", "status": "active|..." } ],
  "tasks": [ { "id": "...", "title": "...", all Ent fields, NO collection_id (implicit) } ],
  "comments": [ { "id": "...", "task_id": "...", "author_id": "...", "body": "...", "created_at": "...", "updated_at": "..." } ],
  "relationships": [ { "id": "...", "source_task_id": "...", "target_task_id": "...", "type": "blocks|blocked_by|relates_to|duplicates|duplicated_by" } ],
  "changes": [ { "id": "...", "task_id": "...", "author_id": "...", "field_name": "...", "old_value": "...", "new_value": "...", "created_at": "..." } ]
}
```

- All IDs in the file are original UUIDs from the source server.
- `collection_id` is NOT on tasks (it's implicit from `collection`).
- Enum values use lowercase Ent enum strings (e.g., `"open"`, `"blocks"`).
- Timestamps are RFC 3339 strings.
- `changes` is an empty array when `--include-changes` was not used.

### Import UUID Remapping Rules

Every entity gets a new server-generated UUID on import. The following FK
fields must be rewritten using the mapping:

| Entity       | FK Field          | Maps To            |
|-------------|-------------------|--------------------|
| Task        | (implicit)        | New Collection ID  |
| Task        | assignee_id       | Matched/New User   |
| Task        | parent_task_id    | New Task ID        |
| Comment     | task_id           | New Task ID        |
| Comment     | author_id         | Matched/New User   |
| Relationship| source_task_id    | New Task ID        |
| Relationship| target_task_id    | New Task ID        |
| Change      | task_id           | New Task ID        |
| Change      | author_id         | Matched/New User   |

Tasks must be created in topological order (parents before children) so
that `parent_task_id` can be remapped.

### Key Design Decisions (Do Not Deviate)

These are load-bearing decisions from the design doc — do not change them
without escalating to the coordinator:

1. **Always remap UUIDs on import.** No `--preserve-ids` option in v1.
2. **Drop cross-collection relationships with a warning.** Do not include
   relationships referencing tasks outside the exported collection.
3. **Match users by email first, then create new.** If email matching is
   ambiguous (multiple matches), create a new user instead of guessing.
4. **Reset task.version to "1" on import.** Do not preserve the original
   CAS version.
5. **Import always creates a new collection.** No merge-into-existing.
6. **PLATFORM_FARMTABLE only.** Return an error for other platform types.

### Testing Requirements

- **Round-trip test:** Create a collection with tasks, comments, and
  relationships. Export it. Import the export. Verify:
  - Same number of tasks, comments, relationships.
  - All task titles, descriptions, fields match.
  - Comment bodies and author display names match.
  - Relationship structure (blocks/blocked_by graph) is preserved.
  - No UUID from the original collection appears in the imported copy.
  - Task versions are all "1" in the imported collection.
- **Cross-collection relationship test:** Create a relationship to a task
  in another collection. Export. Verify the relationship is dropped and a
  warning is returned.
- **User matching test:** Export from a collection with a user that has an
  email. Import into a server that has a user with the same email. Verify
  the existing user is reused (not duplicated).
- **Dry-run test:** Import with `--dry-run`. Verify no collection is
  created but stats are returned.
- **Error cases:** Invalid JSON, unsupported format_version, non-farmtable
  collection export attempt.

Explicitly OUT of scope:
- Web UI (that's Phase B).
- Merge-into-existing collection.
- Streaming export for very large collections.
- `--preserve-ids` flag.
- Export of non-farmtable-platform collections.

## Key Locations

- Repo: `/workspace/farmtable`, base off current `main` — use a fresh
  feature branch, PR to merge.
- **Design doc (READ FIRST):**
  `/scion-volumes/scratchpad/projects/farmtable/reports/design-export-import.md`
- Proto: `proto/farmtable.proto` — add new messages near existing
  Collection messages (around line 690), new RPCs in FarmTableService
  (around line 965).
- Server: `internal/server/server.go` (handlers, around line 840),
  `internal/server/convert.go` (entity conversion helpers).
- Store interface: `internal/store/store.go` (Store interface, params).
- Store impl: `internal/store/entstore.go` (Ent implementation of Store).
- CLI: `internal/cli/collection.go` (collection subcommands),
  `internal/cli/output.go` (output helpers), `internal/cli/input.go`
  (`readInputValue` helper for `@file` / `-` stdin).
- Ent schemas: `internal/store/schema/` — `collection.go`, `task.go`,
  `comment.go`, `relationship.go`, `change.go`, `user.go`.
- Repo's own agent guide: `/workspace/farmtable/agents.md` and
  `/workspace/farmtable/CLAUDE.md` — dev/build/test conventions,
  `farmtable-dev` skill for env setup.
- Prior feature logs for context/patterns:
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/`
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/export-import-phaseA.md`

## Deliverables

1. A pushed feature branch + open PR (via `gh pr create`) against
   `scion-frontiers/farmtable` `main`, confirmed CLEAN/MERGEABLE via `gh
   pr view --json mergeStateStatus,mergeable` before reporting ready.
2. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/export-import-phaseA.md`
   with: findings from the investigate-first step, what was built (proto
   changes, store methods, server handlers, CLI commands), each review
   round's findings/resolutions, final state, and any issues encountered.
3. A message to the coordinator with: PR URL, branch, summary (including
   the proto/store/server/CLI breakdown), and final review outcome.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/
  quota-concern reports, and especially to report the investigate-first
  findings before committing to implementation.
- Do not message ptone@google.com directly — that's the coordinator's job.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the
log at the path above, and message the coordinator with the summary. Then
signal task_completed. Do not delete your developer agent until the
coordinator confirms the merge landed or explicitly tells you to clean up.
