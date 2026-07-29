# Task State Model Phase 1 Core

Date: 2026-07-27
Branch: `task-state-core`
Base: `origin/main`
Implementation commit: `328e347d269c4f4748e9efdfa868b8deeddd5422`
Review follow-up implementation commit: `bc3edf95f00947bd7f30f6a21b05f5309202c4e3`
R2 follow-up implementation commit: `28d9f9493894b3b326ff572d30a050d12ed076e0`

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

## Review Follow-Up

Phase 1 review gates requested changes from code review, test review, and
security audit. Fixes completed in this follow-up:

- GitHub pass-through `ClaimTask` now evaluates claimability before label
  mutation: accepted stage only, no existing assignee, no open sub-issues, and
  no legacy unavailable labels (`blocked`, `waiting_for_input`, `deferred`,
  `scheduled`).
- Ent-backed `ClaimTask` now runs availability recomputation and mutation in a
  transaction, with final predicates for accepted/open/no hold/no future
  start/no unsatisfied blockers. Zero-row writes are reclassified to
  `ErrUnavailable`, `ErrAlreadyClaimed`, or `ErrAlreadyClosed` where possible.
- `MultiStore` now routes `ComputeAvailability` to backing stores so wrapped
  service responses expose availability reasons.
- GitHub treewalk no longer treats plain `accepted` as explicitly blocked or
  as a transitive blocker. Only open sub-issues and explicit legacy unavailable
  labels produce blocked read-model entries.
- Beads status projection no longer exports plain accepted/open tasks as
  `blocked`; `hold_reason=waiting_for_input` projects to Beads `blocked` and
  `hold_reason=deferred` projects to Beads `deferred`.
- Beads JSONL import now emits format v2 native state (`accepted` plus
  `hold_reason` where needed) at the adapter boundary, rather than deleted
  native stages.
- Format v2 native imports now reject removed stage strings. Format v1 remains
  the explicit legacy migration path.
- `GetReadyTasks.IncludeUnblockedOpen` now returns unblocked open tasks that
  are not currently claimable, while still excluding dependency-blocked tasks.
  Returned tasks carry availability reasons.
- Docs/comments called out by review now describe native holds as
  `accepted + hold_reason`; `ON_HOLD` is documented as compatibility-only.

## R2 Follow-Up

R2 code review and security audit requested changes. Fixes completed in this
follow-up:

- `GetBlockedTasks` now uses `terminalStageSatisfiesDependency`, the same
  dependency satisfaction policy used by computed availability. `completed`
  satisfies a blocker; `wont_fix`, `cancelled`, and `duplicate` without a
  canonical replacement remain unresolved blockers.
- Format v2 import now validates native hold-state combinations before store
  import. It rejects hold reasons on `triage` and terminal stages, and rejects
  `hold_reason=deferred` with a concrete future `start_date`.
- Direct `CreateTask(stage=working)` and `UpdateTask(stage=working)` are
  rejected with `InvalidArgument` and guidance to use `ClaimTask`; `working`
  remains claim/start semantics only.
- Go release hygiene was updated: `go.mod` now targets Go `1.26.5`,
  `golang.org/x/net v0.55.0`, and `golang.org/x/text v0.39.0`; `go mod tidy`
  completed.
- `govulncheck ./...` was installed/run after updates and reported no reachable
  vulnerabilities.

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
- `TestRPC_ImportCollection_FormatV2RejectsRemovedNativeStages`
- `TestComputeAvailability_ReasonsAndTerminalDependencies`
- `TestComputeAvailability_TerminalDependencyMatrix`
- `TestGetBlockedTasks_TerminalDependencyMatrix`
- `TestTaskStateValidation_HoldReasonRules`
- `TestRPC_GetBlockedTasks_TerminalDependencyMatrix`
- `TestRPC_GetReadyTasksIncludeUnblockedOpenIncludesUnavailableReasons`
- `TestRPC_ImportCollection_FormatV2RejectsInvalidHoldState`
- `TestRPC_CreateTaskRejectsDirectWorkingStage`
- `TestRPC_UpdateTaskRejectsDirectWorkingStage`
- `TestComputeBlocked_DoesNotTreatAcceptedAsBlocked`
- `TestIssueUnavailableForClaim`
- `TestTaskToIssue_StatusProjection`
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

Follow-up search:

```bash
rg -n 'ready stage|stage ready|triage and backlog|backlog|scheduled|ON_HOLD|on_hold|Open/Blocked|OnHold|Deferred' .agents/skills/farmtable docs/architecture.md internal/server internal/platform internal/cli internal/mcp README.md agents.md
```

Result: remaining matches are compatibility enum handling (`ON_HOLD`),
explicit legacy v1 migration code/tests for removed values, GitHub legacy
unavailable label detection, and valid hold/dependency terminology.

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
- Focused follow-up verification: `go test ./internal/store ./internal/platform/github ./internal/platform/beads ./internal/server`: pass.
- R2 focused store verification: `go test ./internal/store -run 'TestGetBlockedTasks_TerminalDependencyMatrix|TestComputeAvailability_TerminalDependencyMatrix'`: pass.
- R2 focused server verification: `go test ./internal/server -run 'TestRPC_GetBlockedTasks_TerminalDependencyMatrix|TestRPC_ImportCollection_FormatV2RejectsInvalidHoldState|TestRPC_CreateTaskRejectsDirectWorkingStage|TestRPC_UpdateTaskRejectsDirectWorkingStage'`: pass.
- Vulnerability verification: `govulncheck ./...`: no reachable vulnerabilities found.

## Remaining Risks

- `GetReadyTasks` remains the compatibility RPC/tool name, so generic "ready work" wording remains in command names and user-facing graph terminology. It no longer maps to a native `ready` stage.
- Phase 1 did not implement the broader web UI redesign; only generated web schema/types and stage display cleanup were updated as required by the core API change.
- Duplicate-with-canonical dependency satisfaction remains out of scope because
  there is no persisted canonical replacement field. The v1 behavior that
  `duplicate` without canonical replacement does not satisfy dependencies is
  covered by `TestComputeAvailability_TerminalDependencyMatrix`.
