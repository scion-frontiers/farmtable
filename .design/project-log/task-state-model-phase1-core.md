# Task State Model Phase 1 Core

Date: 2026-07-27
Branch: `task-state-core`
Base: `origin/main`
Final commit: `PENDING_FINAL_COMMIT_HASH`

## Implemented

- Repaired `task-state-core` history onto `origin/main`; `git merge-base --is-ancestor origin/main HEAD` passes and `git diff origin/main...HEAD` works.
- Replaced native ready/backlog/blocked/on-hold stage vocabulary with native stages `triage`, `accepted`, `working`, `in_review`, `in_qa`, `deploying`, `completed`, `wont_fix`, `duplicate`, and `cancelled`.
- Added persisted `hold_reason` and nullable `rank` fields, with generated Ent accessors and predicates.
- Added proto/API read model support for `TaskHoldReason`, `TaskAvailability`, `AvailabilityReason`, task `hold_reason`, task `rank`, and computed availability.
- Updated Go generated protobuf outputs and checked-in web generated outputs (`types.ts` and `farmtable.json`) so clients expose `hold_reason`, `rank`, and `availability`.
- Enforced native write validation in the store: removed native stages are rejected, hold reasons are only valid for accepted/active stages, and `hold_reason=deferred` conflicts with a concrete future `start_date`.
- Updated `ClaimTask` to reject request-level `assignee_id`, reject unavailable tasks by ID, self-assign the authenticated actor, move to `working`, and clear hold reason.
- Updated ready queue semantics to return available accepted tasks ordered by priority, rank within collection/priority, created-at, then task ID.
- Updated CLI/MCP parsers and help text so removed stages are not writeable/selectable native values.
- Normalized GitHub and Beads adapter open/blocked/deferred source states into accepted/hold primitives while preserving source-native status text.
- Bumped export `format_version` to 2 and kept import compatibility for versions 1 and 2.

## Migration Evidence

Persistent lossy migration notes are implemented through imported `Change` records:

- Field name: `task_state_migration`
- Author: service account `system:migration` (`00000000-0000-0000-0000-000000000001`)
- Values: compact JSON old/new state payloads with reason codes.

Focused migration matrix coverage:

- `ready` -> `accepted`, reason `old_ready_stage_to_accepted`.
- `blocked` with blocker evidence -> `accepted`, reason `old_blocked_stage_with_blocker_to_dependency_availability`; availability remains dependency-driven.
- `blocked` without blocker evidence -> `accepted` + `hold_reason=waiting_for_input`, reason `old_blocked_stage_without_blocker_to_waiting_for_input`.
- `scheduled` with `start_date` -> `accepted`, reason `old_scheduled_stage_with_start_date`.
- `scheduled` without `start_date` -> `accepted` + `hold_reason=deferred`, reason `old_scheduled_stage_without_start_date_to_deferred`.
- `deferred` with future `start_date` -> `accepted` without hold reason, reason `old_deferred_stage_future_start_date_cleared_hold`.
- Beads adapter-origin `blocked`/`deferred` statuses normalize to accepted/hold primitives while preserving native status fidelity.

Evidence tests:

- `TestRPC_ImportCollection_MigratesOldTaskStatesWithNotes`
- `TestComputeAvailability_ReasonsAndTerminalDependencies`
- `TestTaskStateValidation_HoldReasonRules`
- Existing claim/server tests updated for accepted-to-working and triage/unavailable rejection paths.

## Vocabulary Survival Evidence

Removed native stage constants search:

```bash
rg -n 'Stage(Backlog|Ready|Blocked|WaitingForInput|Deferred|Scheduled)|TASK_STAGE_(BACKLOG|READY|BLOCKED|WAITING_FOR_INPUT|DEFERRED|SCHEDULED)|TaskStage\.(BACKLOG|READY|BLOCKED|WAITING_FOR_INPUT|DEFERRED|SCHEDULED)' api proto internal web/src DRAFT-schema.json
```

Result: no matches.

Native vocabulary process/docs/generated search:

```bash
rg -n 'stage ready|ready stage|triage and backlog|backlog|scheduled|\bblocked\b|waiting_for_input|deferred' proto api/farmtable/v1/farmtable.pb.go internal/cli internal/mcp .agents/skills/farmtable docs/architecture.md README.md agents.md
```

Result: remaining matches are relationship/graph terminology (`blocked`, `blocked_by`, `GetReadyTasks`) and valid hold reasons (`waiting_for_input`, `deferred`); no removed value survives as a native writeable/selectable stage.

## Verification

Commands run and results:

- `PATH="/home/scion/go/bin:$PATH" buf generate`: pass.
- `PATH="/home/scion/go/bin:$PATH" go generate ./internal/store/ent`: pass.
- `PATH="/home/scion/go/bin:$PATH" go test ./...`: pass.
- `PATH="/home/scion/go/bin:$PATH" go build ./...`: pass.
- `npm run build` in `web/`: pass; Vite emitted the pre-existing chunk-size warning.
- `jq empty web/src/gen/farmtable.json`: pass.
- `git merge-base --is-ancestor origin/main HEAD`: pass.
- `git diff origin/main...HEAD`: pass.

## Remaining Risks

- `GetReadyTasks` remains the compatibility RPC/tool name, so generic "ready work" wording remains in command names and user-facing graph terminology. It no longer maps to a native `ready` stage.
- Phase 1 did not implement the broader web UI redesign; only generated web schema/types and stage display cleanup were updated as required by the core API change.
