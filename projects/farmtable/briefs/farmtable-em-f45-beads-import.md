# Brief: Engineering Manager — Feature 45: Import Beads JSONL Format (Auto-Detected)

## Critical Constraints (read first)

- **Use a dedicated git worktree**, not the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-f45 -b feat/f45-beads-import origin/main`
  (standing policy).
- **Use the local-first verification protocol** — read
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`. Live-server check
  happens separately at deploy time.
- **Investigate the beads reference source and sample data BEFORE designing the mapping.**
  Do not guess at the beads JSONL schema — read the actual reference implementation.
- **Only one agent runs at a time.** Never run a developer and a reviewer simultaneously.
- **You do NOT merge anything.** Push, open a PR via `gh pr create`, message the
  coordinator.
- **Reviewers must be blind** — fresh `code-reviewer` agent, `--harness claude`.
- **Exit criteria:** Round 1 fix everything (incl. nitpicks). Round 2+: stop if only
  nitpicks remain. Hard cap 5 rounds.
- **Developer harness:** `--type developer` should work; fall back to `--type default` if
  you hit the workspace-trust/"Not logged in" bug.
- **Real evidence required**: an actual successful import of the real sample JSONL file
  (see below) into a Farmtable collection, verified via screenshots and/or `ft task list`
  output showing the imported tasks — not a synthetic/hand-crafted test file.
- **The coordinator will NOT independently re-read your diff or re-open your
  screenshots** — your own verification is what stands.

## Context (ptone@google.com, verbatim)

"As part of supporting the beads platform (where we have a reference to the source code in
the scratchpad) we want to support importing their jsonl format in our import feature (as
well as our native export) - we should be able to auto-detect the format - and should state
on the import file dialog what formats are supported. A sample file we want to use for
import is in the scratchpad, it is .jsonl format."

Farmtable already has an Export/Import feature (Phase A: backend RPCs + CLI, PR #72; Phase
B: web UI, PR #74) that handles Farmtable's own native export format (JSON). This feature
ADDS a second supported import format — Beads' JSONL — with auto-detection between the two,
and updates the import UI to state which formats are supported.

## Key reference materials (investigate these first)

- Beads reference source: `/scion-volumes/scratchpad/projects/farmtable/reference/beads/`
  — this is a full clone of the beads platform's source. Look at `beads.go`,
  `internal/beads/`, and `internal/validation/bead.go` to understand the actual JSONL
  record schema (field names, types, required vs optional fields, how relationships/status
  are represented).
- Sample JSONL files (there are a few — figure out which is the intended one, likely the
  top-level one since the others are nested inside the beads/watcher reference repos
  themselves and are just those projects' own dev data):
  - `/scion-volumes/scratchpad/issues.jsonl` (top-level, most likely the intended sample)
  - `/scion-volumes/scratchpad/projects/farmtable/reference/beads/issues.jsonl`
  - `/scion-volumes/scratchpad/projects/farmtable/reference/watcher/.beads/issues.jsonl`
  Read a few lines of each to confirm which matches "a sample file we want to use for
  import" — if genuinely ambiguous, message the coordinator to ask rather than guessing,
  but they likely all share the same schema so it may not matter much for schema purposes.
- Farmtable's own native export format: check `internal/` and `web/src/` wherever Phase A/B
  of Export/Import implemented it (search for "export"/"import" in `internal/store/` and
  `web/src/`), to understand the target schema you're mapping BEADS fields into.

## Task

1. **Understand the Beads JSONL schema** from the reference source + sample file(s).
   Beads is JSONL (one JSON object per line) — likely each line represents one issue/bead
   with fields for ID, title, description, status, dependencies/relationships, timestamps,
   etc. Map these to Farmtable's Task model as faithfully as possible (status → phase,
   dependencies → BLOCKS relationships if beads has that concept, etc.) — use your
   judgment on fields that don't have a clean mapping, and document your choices.
2. **Implement format auto-detection**: given an uploaded/selected import file, detect
   whether it's Farmtable's native export format (JSON) or Beads' JSONL format, and parse
   accordingly. A reasonable heuristic: try parsing as Farmtable's native format first
   (check for its expected top-level structure/fields); if that fails or the structure
   doesn't match, try line-by-line JSONL parsing and check if each line matches the Beads
   schema. Document your detection heuristic clearly in your log.
3. **Implement the Beads JSONL parser + import path**, converert to Farmtable's internal
   task-creation calls (reuse whatever Phase A's import RPC/logic already does for the
   native format, just add a new parsing path that feeds into the same downstream
   creation logic).
4. **Update the import file dialog UI** to state which formats are supported (e.g. "Import
   a Farmtable export (.json) or Beads issue export (.jsonl)") — check wherever Phase B's
   import UI lives in `web/src/`.
5. **Verify with the REAL sample file**: actually run an import of the sample `.jsonl` file
   (local-first) and confirm the resulting tasks look correct — titles/descriptions/status
   mapped sensibly, not garbled or empty.

## Key Locations

- Repo: base off current `main` — fresh feature branch, PR to merge.
- Backend: wherever Export/Import Phase A's RPCs/parsing logic live (search `internal/` for
  "import"/"export").
- Frontend: wherever Phase B's import dialog UI lives in `web/src/`.
- Beads reference: `/scion-volumes/scratchpad/projects/farmtable/reference/beads/`
- Sample data: `/scion-volumes/scratchpad/issues.jsonl` (verify this is the right one, see
  above)
- Local testing protocol:
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-45-beads-import.md`

## Deliverables

1. Pushed branch + open PR against `main`, confirmed CLEAN/MERGEABLE.
2. Real evidence: successful import of the actual sample JSONL file, screenshots of the
   resulting tasks in Farmtable, and/or `ft task list` output. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-45-beads-import/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-45-beads-import.md`
   documenting the Beads schema you found, your field-mapping decisions, and your
   auto-detection heuristic.
4. A message to the coordinator with PR URL, summary, review outcome.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports, or
  if the sample file choice is genuinely ambiguous.
- Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the log/evidence with
a real import of the sample file, and message the coordinator. Then signal task_completed.
