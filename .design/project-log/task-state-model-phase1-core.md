# Task State Model Phase 1 Core

Date: 2026-07-27
Branch: `task-state-core`

## Commits

- `9837216` - `feat: replace native ready states with accepted`
- `acd64cc` - `feat: gate claims on computed availability`
- `36ceab8` - `docs: update native task state vocabulary`

Note: the mounted checkout had a broken `.git` worktree pointer to
`/workspace/farmtable/.git/worktrees/farmtable-task-state-core`, while the
actual source was mounted at `/workspace`. I initialized a local repository on
`task-state-core` and captured the mounted source as baseline commit `6d2feb0`
before committing task work.

## Implemented

- Added native `accepted` stage and removed old native Ent stage values from the
  persisted task schema.
- Added persisted optional `hold_reason` and nullable integer `rank`.
- Regenerated Ent code with `go generate ./internal/store/ent`.
- Updated server/store conversion so native responses project `accepted` and
  old proto stage inputs are normalized to `accepted` in compatibility paths.
- Updated GitHub/Beads adapter mappings and tests so external open/blocked/
  deferred statuses normalize into `accepted` rather than deleted native stages.
- Added store-side computed availability reasons for triage, terminal, held,
  future start date, and unsatisfied blockers.
- Updated claim to reject unavailable tasks by ID, reject already-assigned
  tasks as before, self-assign the authenticated actor, set `stage=working`,
  and clear hold reason.
- Updated ready queue store semantics to return available accepted tasks and
  order by priority, rank, created_at, then task ID.
- Updated CLI/MCP native stage parsers to accept exactly `triage`, `accepted`,
  `working`, `in_review`, `in_qa`, `deploying`, `completed`, `wont_fix`,
  `duplicate`, and `cancelled`.
- Updated root process guidance, README summary, and `DRAFT-schema.json`.

## Verification

Commands run and results:

- `npm ci --prefer-offline && npm run build` in `web/`: pass. Vite built
  `web/dist`; npm reported one high severity dependency audit finding.
- `go generate ./internal/store/ent`: pass.
- `go test ./internal/store`: pass.
- `go test ./internal/store ./internal/server`: pass.
- `go test ./...`: pass.
- `go build ./...`: pass.

Focused coverage added:

- `TestComputeAvailability_ReasonsAndTerminalDependencies` covers triage, held,
  future-start, dependency-blocked, claim rejection for unavailable tasks, and
  completed blocker satisfaction.
- Existing claim tests now cover accepted-to-working claim, assignment audit,
  already-claimed rejection, and triage claim rejection through server tests.

## Migration Evidence

Implemented compatibility normalization evidence:

- Old proto stage inputs `READY`, `BLOCKED`, `WAITING_FOR_INPUT`, `DEFERRED`,
  and `SCHEDULED` normalize to store `accepted` in `internal/convert`.
- Old import stage strings `backlog`, `ready`, `blocked`,
  `waiting_for_input`, `deferred`, and `scheduled` normalize to `accepted` in
  `internal/server/export_import.go`.
- Adapter-origin Beads `blocked` and `deferred` statuses normalize to
  `accepted` while preserving source status fidelity in adapter data paths.

Not completed in this slice:

- Persistent lossy migration-note records are not implemented.
- The explicit realistic old-state data matrix requested by the brief was not
  fully exercised with persisted migration notes.
- `scheduled` without `start_date` and `deferred` plus future `start_date`
  normalization are not fully enforced.

## Vocabulary Survival Evidence

Targeted commands run:

- `rg -n '\b(backlog|ready|blocked|scheduled|waiting_for_input|deferred|on_hold)\b' proto api/farmtable/v1 internal/store internal/server internal/cli internal/mcp internal/platform DRAFT-schema.json web/src README.md docs agents.md .agents`
- `rg -n 'Stage(Backlog|Ready|Blocked|WaitingForInput|Deferred|Scheduled)|TASK_STAGE_(BACKLOG|READY|BLOCKED|WAITING_FOR_INPUT|DEFERRED|SCHEDULED)' internal api proto web/src DRAFT-schema.json`

Findings:

- Removed native stage constants no longer survive in Ent-generated task code.
- CLI/MCP native parsers no longer accept removed stage strings.
- Remaining hits exist in compatibility/generated surfaces, tests, adapter
  source-fidelity text, graph terminology, web generated descriptors, and docs
  not fully polished in Phase 1.
- `api/farmtable/v1/farmtable.pb.go` and `web/src/gen/farmtable.json` still
  contain old generated enum names because `buf`/`protoc` were not available in
  the environment. I manually added `TASK_STAGE_ACCEPTED` to the checked-in Go
  generated surface so the Go build passes, but full generated artifact cleanup
  remains required.

## Remaining Risks

- Proto-generated cleanup is incomplete; old enum names still survive in
  generated Go raw descriptors and web generated schema outputs.
- The public `Task` proto source includes new availability and hold-reason
  definitions, but checked-in generated client structs were not fully updated
  to expose `hold_reason`, `rank`, and `availability` fields.
- Store-level validation for hold-reason/stage/start-date integrity is partial.
- Import/export format version bump and persisted migration-note audit records
  remain to be completed.
- Web UI redesign was intentionally not implemented, but generated web schema
  cleanup also remains incomplete.
