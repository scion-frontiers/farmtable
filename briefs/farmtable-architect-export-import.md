# Brief: Architect — Collection Export/Import Format & Phased Plan

## Critical constraints (read first)
- This is a DESIGN task, not implementation. Produce a design doc + phased implementation
  plan. Do not write application code or open a PR.
- Do not disturb `/workspace/farmtable`'s shared checkout if other agents are active there
  — reading files is fine, avoid branch/checkout changes there.
- Resolve the open design questions yourself and make explicit recommendations — don't punt
  them back unanswered. The investigator's job was to surface tradeoffs; yours is to decide
  and justify.

## Context
ptone@google.com wants full-collection export/import (backup + cross-server migration),
with both CLI (`ft`) and web dashboard surfaces. An investigator already mapped the data
model, existing capabilities, and 10 open design questions:
`/scion-volumes/scratchpad/projects/farmtable/reports/investigation-export-import.md`
(read this fully first — don't re-derive what it already covered).

The investigator's overall scope recommendation was "Medium" — this project should end up
as roughly 2-3 phases handed to Engineering Manager agents in sequence (matching how the
rest of this UI-improvement loop has worked: see
`/scion-volumes/scratchpad/projects/farmtable/HANDOFF-METHODOLOGY.md` and
`/scion-volumes/scratchpad/projects/farmtable/ui-loop/loop-log.md` for the established
EM/developer/reviewer process and brief conventions this project uses).

## Task

1. Read the investigation report in full.
2. Resolve each of its 10 open design questions with an explicit decision + rationale,
   in particular:
   - Export file format (structure, likely JSON given "strong JSON infra" the investigator
     found — confirm or override).
   - Cross-server ID strategy: preserve UUIDs vs. remap on import, and exactly how FK
     references (task->collection, comment->task, comment->author, relationship->target,
     parent_task_id) get rewritten consistently if remapping.
   - User/author identity resolution on import when the importing server doesn't have a
     matching user (create placeholder? require pre-existing user mapping? fail loudly?).
   - Format versioning scheme (even if minimal) so future schema changes don't silently
     corrupt older export files.
   - Whether import creates a brand-new collection (safe default) vs. allows
     merge-into-existing (riskier, likely defer).
3. Design the concrete file format: give an actual example (e.g. a JSON schema/sample
   snippet) showing a small collection with a task, a comment, and a relationship.
4. Design the CLI surface: exact command shape(s) (e.g. `ft collection export <id> --out
   file.json`, `ft collection import <file.json>`), flags, error handling, auth
   requirements — consistent with existing `ft` command conventions found by the
   investigator.
5. Design the web UI surface: where it lives (e.g. near the collection settings gear icon
   from Feature 21), the export flow (trigger -> download) and import flow (trigger ->
   file picker -> upload -> progress/result feedback -> land on the newly imported
   collection), given there's no existing file upload/download precedent in the web app
   per the investigator's findings — keep this as simple as reasonably possible for a v1.
6. Produce a **phased implementation plan** sized for this project's EM/developer/reviewer
   process (see loop-log.md for the pattern: one EM per phase, investigate-first where
   backend RPCs may not exist yet, blind reviewer rounds, PR per phase). Suggest a sensible
   phase breakdown — likely something like:
   - Phase A: backend export/import RPCs or CLI-only export/import logic (whichever your
     design calls for) + `ft` CLI commands.
   - Phase B: web UI surface (export button/download, import button/upload flow).
   (Adjust this breakdown if your design suggests a better split — e.g. if export and
   import are meaningfully different-sized efforts, split them instead of backend/frontend.)
   For each phase, write it in the SAME brief format the EMs in this project already use —
   look at an existing brief for the exact structure/sections to match (e.g.
   `/scion-volumes/scratchpad/projects/farmtable/briefs/farmtable-em-f21.md` is a good
   backend+frontend example to mirror), so the coordinator can hand your phase briefs
   directly to new EM agents with minimal editing.

## Deliverables

1. A design doc at
   `/scion-volumes/scratchpad/projects/farmtable/reports/design-export-import.md` covering
   the format, decisions on all 10 open questions with rationale, CLI surface, web UI
   surface, and the phase breakdown with a one-paragraph summary of each phase.
2. One EM-ready brief file per phase, written in the established brief format/conventions,
   saved at
   `/scion-volumes/scratchpad/projects/farmtable/briefs/farmtable-em-export-phaseA.md` (and
   `-phaseB.md`, etc. — name them by letter in dependency order). These should be complete
   enough that the coordinator can dispatch them to EM agents with just a filepath
   reference, the same way every other feature in this project has been briefed.
3. A message to the coordinator summarizing the design decisions and the phase breakdown
   (with brief file paths), and noting any risk/uncertainty worth flagging before phases
   are dispatched.

## Direct contact
- Message the coordinator (`scion message coordinator "..."`) when done, or if blocked on
  a decision only the coordinator/user can make (flag it explicitly rather than guessing on
  something with real user-facing consequences, e.g. data-loss risk on import).
- Do not message ptone@google.com directly.

## Termination
You MUST produce the design doc and per-phase EM briefs at the paths above, then message
the coordinator with the summary. Then mark the task complete.
