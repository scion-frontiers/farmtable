# Brief: farmtable-inv-comments

## Critical constraints (read first)
- Read-only investigation. Do NOT modify any code, do NOT commit, do NOT open a PR.
- Do not touch `/workspace/farmtable` in a way that changes its checked-out branch or
  working tree state — other agents (Feature 21 dev) are actively working there. Reading
  files is fine; do not run `git checkout`/`git pull`/etc. that would disturb it. If you need
  a clean checkout, use `git show <ref>:<path>` or clone to a separate temp directory instead.
- Answer with evidence (file paths + line refs) from the actual proto/store/server code, not
  assumptions from naming conventions.

## Context
Relaying a data-model question from ptone@google.com about the farmtable app:

**Are comments a linked record (separate entity/table with a foreign key to the task), or
are they stored embedded within the Task object itself (e.g. a repeated field on Task)?**

Answer definitively, and describe the relationship if it's a linked record (1:many? does a
comment belong to exactly one task? any other entities comments link to, e.g. author/user?).

## Key locations
- Proto: `/workspace/farmtable/proto/farmtable.proto` — look for `message Comment` and
  check whether `Task` has a `repeated Comment` field or a separate `comment(s)`-fetching RPC
  (e.g. `ListComments`/`GetComments`) that takes a task ID.
- Store/ORM: `/workspace/farmtable/internal/store/schema/` — look for a `comment.go` (or
  similar) Ent schema file and its edges, alongside `task.go` for comparison.
- Server: `/workspace/farmtable/internal/server/` — any comment-related RPC handlers.
- For reference, a similar prior investigation (collection model) is at
  `/scion-volumes/scratchpad/projects/farmtable/reports/investigation-collection-model.md` —
  same evidence style expected (proto + Ent schema citations).

## Deliverables
Write findings to:
`/scion-volumes/scratchpad/projects/farmtable/reports/investigation-comments-model.md`

Must contain: direct answer (linked record vs. embedded), code citations (file:line) for
proto message/field definitions and Ent schema/edges, the relationship cardinality if
linked, and a confidence note.

## Direct contact
- Report to the coordinator only (`scion message coordinator "..."`) — do not message the
  end user directly, this is a relayed question.

## Termination
You MUST produce the report at the path above and then mark the task complete.
