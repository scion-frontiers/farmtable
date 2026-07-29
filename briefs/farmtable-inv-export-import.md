# Brief: Investigator — Collection Export/Import Feasibility & Landscape

## Critical constraints (read first)
- This is RESEARCH ONLY. Do not write implementation code, do not open a PR. Produce a
  findings document for a follow-on architect to design against.
- Do not disturb `/workspace/farmtable`'s shared checkout state if other agents are active
  there — reading files is fine; avoid `git checkout`/branch changes there. If you need to
  poke at CLI behavior, use a separate clone or worktree instead.
- This is a genuinely new capability (not a small UI tweak) — the point of this
  investigation is to surface the real design questions, not to hand back a "just wire it
  up" recommendation. Be thorough about what's hard, not just what's easy.

## Context
ptone@google.com wants: "export and import file format for full collection - be able to
snapshot for backup or for moving between servers. needs CLI and web UI surface support."

This means a user should be able to export an entire Collection (all its tasks, comments,
relationships, labels, custom fields, etc.) to a file, and import that file either back into
the same server (restore) or into a DIFFERENT farmtable server (migration) — via both the
`ft` CLI and the web dashboard.

## Task — investigate and report on:

1. **Full data model scope for "a complete collection".** Enumerate every entity that hangs
   off a Collection (directly or transitively) that would need to be captured for a
   lossless export: Tasks (and their fields), Comments, Relationships (parent/child,
   blocks/blocked-by/etc.), Labels/tags, Custom field definitions, Status mappings,
   Assignees/Users (do users need to be exported too, or just referenced by
   email/identifier and re-resolved on import?). Cite `proto/farmtable.proto` and
   `internal/store/schema/` for each entity found.
2. **Existing serialization/export capability.** Search the codebase (CLI commands under
   `internal/cli/`, any `export`/`dump`/`backup`/`snapshot` naming) for anything that
   already does partial export/import, even informally (e.g. does `ft` have any JSON output
   mode already on `list`/`get` commands that could be a starting point?).
3. **Cross-server ID handling.** Tasks/Comments/Collections use UUIDs
   (`buf.validate.field).string.uuid`). If a collection is exported from server A and
   imported into server B, what happens to those UUIDs — could importing preserve them
   (risk of collision with existing data on B), or does it need ID remapping (which then
   requires rewriting all foreign-key references consistently: task->collection,
   comment->task, comment->author, relationship->target task, parent_task_id)? Report
   what's structurally required either way — don't just recommend one, show the tradeoff.
4. **User/author identity across servers.** Comments have a required `author_id` FK to a
   User. If server B doesn't have that user, what's the expected behavior — create a
   placeholder, remap to an importing user, fail the import? Check how Users are modeled
   (`message User`) and whether there's already a notion of an "external"/orphaned
   reference in the schema for something like this.
5. **Versioning.** `Task` has a `version` field (proto `string version = 27`) — check what
   it's actually used for (optimistic concurrency? schema version?) and whether it has any
   bearing on export format versioning/forward-compat.
6. **CLI surface today.** What does `ft` currently support command-wise (`internal/cli/`)?
   What would a natural `ft collection export <id> --out file` / `ft collection import
   <file>` fit look like given existing command conventions (flags, output format, auth
   handling)?
7. **Web UI surface today.** Where would export/import naturally live in the web dashboard
   (e.g. near the collection picker/settings from Features 19/21)? Is there any existing
   file-upload/download pattern in `web/src/` to reuse, or would this be the first?

## Deliverables
Write findings to:
`/scion-volumes/scratchpad/projects/farmtable/reports/investigation-export-import.md`

Structure: one section per numbered item above, each with code citations (file:line) where
applicable, and a final "Open design questions for the architect" section listing the real
unresolved tradeoffs (e.g. ID remapping strategy, user-identity handling, format choice)
rather than picking answers yourself — that's the architect's job next.

## Direct contact
- Message the coordinator (`scion message coordinator "..."`) when done, or if blocked.
- Do not message ptone@google.com directly.

## Termination
You MUST produce the report at the path above and then mark the task complete.
