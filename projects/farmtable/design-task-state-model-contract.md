# Farm Table Task State Model Design Contract

Date: 2026-07-27
Status: implementation-ready design contract
Authoritative decision record: `/scion-volumes/scratchpad/projects/farmtable/notes/task-state-model-cphase-decisions.md`
Codebase spot-checked: `/workspace/farmtable`

## 1. Problem Statement

Farm Table currently mixes durable workflow state with derived availability. The
same words are used for asserted columns and computed predicates: `ready` can
mean a native stage, a server ready queue result, or a client-side dependency
predicate; `blocked` can mean a native stage or graph-derived blockage.

The refactor must separate:

- asserted task state: durable data chosen by an authorized actor or process.
- computed availability: server-owned read/query behavior derived from stored
  primitives.

The goal is an implementation contract for the core data model, API, CLI, MCP,
web UI, import/export, adapters, migration, and documentation.

## 2. Current-Code Evidence

These observations are evidence only; the c-phase decision record remains
authoritative.

- The current Ent task schema stores both `phase` and `stage`; `stage` includes
  `backlog`, `ready`, `blocked`, `waiting_for_input`, `deferred`, and
  `scheduled` as native stage values, plus the active and terminal stages
  (`internal/store/schema/task.go:21-31`).
- The current proto documents phase/stage as a two-tier model and maps
  `OPEN` to `triage, backlog, ready`, `ON_HOLD` to `blocked,
  waiting_for_input, deferred, scheduled`, and `CLOSED` to terminal stages
  (`proto/farmtable.proto:35-71`).
- The server maps stage to phase on create/update; `blocked`,
  `waiting_for_input`, `deferred`, and `scheduled` currently map to
  `ON_HOLD` (`internal/server/convert.go:68-80`,
  `internal/server/server.go:108-123`, `internal/server/server.go:511-525`).
- `ClaimTask` currently rejects triage at the RPC layer, but it does not check
  dependency blockage, hold state, or future start date before calling the store
  (`internal/server/server.go:667-710`). The store claim path rejects closed and
  already assigned tasks, then sets assignee, phase, and stage to working
  (`internal/store/entstore.go:776-808`).
- Current `GetReadyTasks` starts from `phase=OPEN` and `stage=ready`, optionally
  including `triage` and `backlog`, then filters out tasks with non-closed
  blockers (`internal/store/entstore.go:2048-2129`). Current `GetBlockedTasks`
  starts from `phase != CLOSED` and finds non-closed blockers; it does not
  require `stage=blocked` (`internal/store/entstore.go:2146-2224`).
- Current dependency resolution treats every `phase=CLOSED` blocker as resolved
  in ready and blocked queries (`internal/store/entstore.go:2096-2099`,
  `internal/store/entstore.go:2177-2183`,
  `internal/store/entstore.go:2194-2200`).
- Current CLI stage parsing exposes `ready`, `blocked`, and `scheduled`
  (`internal/cli/enums.go:17-51`), and task list exposes a primary phase filter
  (`internal/cli/task.go:305-306`).
- Current MCP advertises task search phase filtering and ready work vocabulary
  in terms of open phases/ready tasks (`internal/mcp/server.go:142-164`).
- Current web toolbar exposes `phase` as the primary status filter
  (`web/src/components/ft-toolbar.ts:33-39`). Current kanban columns include a
  native Ready column and an asserted On Hold group containing Blocked,
  Waiting for Input, Deferred, and Scheduled
  (`web/src/components/kanban/ft-kanban-view.ts:28-44`).
- The Beads adapter maps a native `"blocked"` status to
  `(phase=open, stage=blocked)`, which already contradicts the server
  `phaseForStage` projection (`internal/platform/beads/beads.go:301-315`,
  `internal/server/convert.go:68-80`).
- A second Beads import path maps Beads `"open"` to `stage=ready`,
  `"blocked"` to `stage=blocked`, and `"deferred"` to `stage=deferred`
  (`internal/server/beads_import.go:99-109`).
- GitHub label mapping and treewalk logic currently refer to `StageBlocked`,
  `StageReady`, and `StageScheduled` (`internal/platform/github/labels.go:12-47`,
  `internal/platform/github/treewalk.go:89-106`,
  `internal/platform/github/treewalk.go:121-151`).
- Proto conversion helpers map removed proto stage values into store stages
  (`internal/convert/convert.go:23-57`).
- ClaimTaskRequest currently exposes `assignee_id` as a claim-on-behalf
  override (`proto/farmtable.proto:617-625`), and the server currently honors it
  (`internal/server/server.go:693-702`).
- Assignment changes are already recorded in the change log when `assignee_id`
  changes (`internal/store/entstore.go:1131-1140`).
- Import/export currently serializes `phase`, `stage`, `native_label`,
  `start_date`, and other task primitives (`internal/server/export_import.go:52-75`,
  `internal/server/export_import.go:401-408`).
- The current Task proto carries `phase`, `stage`, `priority`, assignees, and
  `start_date`, but has no hold-reason, availability, or rank fields
  (`proto/farmtable.proto:286-318`).
- CloseTask already has terminal outcome stages and a `duplicate_of_task_id`
  field for canonical duplicate resolution (`proto/farmtable.proto:633-644`).
- Other current vocabulary survival paths include generated/draft schemas
  (`DRAFT-schema.json:24-29`, `DRAFT-schema.json:38-46`), a client-side ready
  predicate (`web/src/utils/task-ready.ts:5-20`), stage color tokens
  (`web/src/styles/theme.css:5-15`), transition tests that assert removed stage
  values (`internal/server/transitions_test.go:20-76`), root agent guidance
  (`agents.md:57-67`), README status/ready text (`README.md:41-48`), and
  architecture docs (`docs/architecture.md:66-78`,
  `docs/architecture.md:300-317`).

## 3. Definitions

Asserted state:

Durable task state selected by an authorized actor or process. In v1 this is
primarily `stage`, `hold_reason`, `start_date`, relationships, assignment,
priority, rank, and terminal duplicate resolution metadata.

Computed availability:

A server-owned read/query result derived from persisted primitives. It is not a
native workflow stage and must not be hand-maintained by users, agents, CLI,
MCP, adapters, or web UI.

Native workflow stage:

The durable stage vocabulary for Farm Table-owned tasks. Native UX and native
write paths must use this vocabulary.

Normalization projection:

Compatibility data exposed on the wire for cross-platform consumers. `phase`
remains a projection in API responses and generated types, but must not remain a
native UX control.

Assignment:

Responsibility/routing. Assignment may occur while a task is unavailable.

Claim:

Start of execution. Claim requires computed availability and self-assigns to the
claiming actor in v1.

## 4. Persisted Data Model

### 4.1 Native stage

The native asserted stage set is:

- `triage`: no acceptance judgment has been made yet.
- `accepted`: judged worth doing, but work has not started.
- `working`: execution has started.
- `in_review`: implementation/work output is under review.
- `in_qa`: task is in QA or validation.
- `deploying`: task is in deployment/release.
- `completed`: terminal successful outcome.
- `wont_fix`: terminal unsuccessful outcome.
- `duplicate`: terminal duplicate outcome.
- `cancelled`: terminal cancelled outcome.

The current active execution stages `working`, `in_review`, `in_qa`, and
`deploying` should be preserved. Current code and UI already expose all four
active stages (`internal/store/schema/task.go:26-29`,
`web/src/components/kanban/ft-kanban-view.ts:32-36`), and the code review found
no reason to narrow them.

Remove these from native workflow stage:

- `backlog`: replace with `accepted`.
- `ready`: derived availability, not asserted state.
- `blocked`: dependency blockage is computed from graph relationships.
- `scheduled`: scheduling is `start_date`.
- `waiting_for_input` as a stage: move to `hold_reason`.
- `deferred` as a stage: move to `hold_reason`.
- any prime `on_hold` stage or column group.

### 4.2 Hold reason

Add optional `hold_reason` as a modifier axis. Values:

- absent/null: not paused by hold.
- `waiting_for_input`: accepted or active work needs input to execute.
- `deferred`: intentionally postponed without a concrete start date.

`hold_reason` may apply only to accepted or active stages:

- allowed stages: `accepted`, `working`, `in_review`, `in_qa`, `deploying`.
- rejected stages: `triage`, `completed`, `wont_fix`, `duplicate`,
  `cancelled`.

`hold_reason` is not dependency blockage. A task can have both a hold reason and
unsatisfied blockers; availability reason codes should show both when the read
model cheaply has enough information.

### 4.3 Scheduling

Use `start_date` as structured scheduling data. A task with a future
`start_date` is unavailable until the start date. It is not on hold for this
reason.

`deferred` means postponed without a concrete start date. API integrity rule:

- Setting a concrete future `start_date` clears `hold_reason=deferred`.
- Setting `hold_reason=deferred` while a concrete future `start_date` is present
  rejects with `INVALID_ARGUMENT` unless the same request clears `start_date`.
- Past or present `start_date` does not by itself conflict with `deferred`, but
  clients should not set both; server-side create/update should normalize by
  clearing `deferred` when a `start_date` is set.

This canonical behavior keeps client workflows ergonomic while avoiding a
silent contradictory persisted state.

### 4.4 Phase

Keep `phase` on the wire as a cross-platform normalization projection.

Native phase projection:

- `OPEN`: `triage`, `accepted`
- `IN_PROGRESS`: `working`, `in_review`, `in_qa`, `deploying`
- `CLOSED`: `completed`, `wont_fix`, `duplicate`, `cancelled`
- `ON_HOLD`: compatibility only for external statuses that cannot yet be
  represented otherwise. Native Farm Table tasks should not project to
  `ON_HOLD`; native pauses use `hold_reason` plus the underlying stage.

Native UX must not offer `phase` as a primary control or label. Use active,
closed, all, stage, hold reason, availability, assignment, priority, and rank.

### 4.5 Assignment and audit

Keep assignment as the existing assignee field for v1. Do not add `claimed_by`.

Claim self-assigns to the claiming actor. Assigned plus an active stage implies
an active claim. Assignment may also be changed independently while a task is
unavailable.

Existing `ClaimTaskRequest.assignee_id` compatibility field:

- Native `ClaimTask` must reject `assignee_id` when it is present, returning
  `INVALID_ARGUMENT` with guidance to use assignment/update first.
- Native claim is strictly self-assignment to the authenticated claiming actor.
- Claim-on-behalf is not part of v1 native claim semantics. If restored later,
  it must be a separate privileged operation, such as `ClaimTaskOnBehalf`, with
  its own scope, audit event, assignment semantics, and the same computed
  availability gate as native claim.
- Generated clients may retain the field during wire-compatibility migration,
  but server behavior must reject it on native claim paths so API callers cannot
  bypass the assignment/claim separation.

The implementation must preserve assignment history through the existing change
log. The current diff logic records `assignee_id` changes
(`internal/store/entstore.go:1131-1140`); implementation must keep that behavior
or replace it with equivalent audit coverage.

### 4.6 Priority and rank

Persist `priority` and a new rank primitive for queue ordering. Rank scope is:

- collection
- priority band

Recommended initial shape:

- `rank` nullable numeric/string field with stable ordering semantics.
- uniqueness is not required in v1, but ordering must have a deterministic
  fallback.

Queue ordering:

1. priority band: `urgent`, `high`, `normal`, `low`, unspecified last.
2. rank within `(collection_id, priority)`.
3. stable fallback: `created_at`, then task ID.

Dense integer ranks are acceptable for initial implementation if the code paths
and tests acknowledge write amplification on reorder. The design must not depend
on dense ranks; future implementations may use sparse integer or fractional
ranks.

### 4.7 Terminal duplicate resolution

When closing as `duplicate`, require `duplicate_of_task_id` to identify the
equivalent/canonical replacement if the duplicate should satisfy dependents.
The current CloseTaskRequest already has this field
(`proto/farmtable.proto:633-644`). Without a canonical replacement,
`duplicate` does not satisfy blockers.

## 5. Computed Availability Model

Availability is computed server-side from persisted primitives. Do not persist a
native `ready` stage or a broad matrix of availability states.

Initial public surface:

```proto
message TaskAvailability {
  bool available = 1;
  repeated AvailabilityReason reasons = 2;
}

enum AvailabilityReason {
  AVAILABILITY_REASON_UNSPECIFIED = 0;
  AVAILABILITY_REASON_TRIAGE = 1;
  AVAILABILITY_REASON_TERMINAL = 2;
  AVAILABILITY_REASON_HELD = 3;
  AVAILABILITY_REASON_BLOCKED_BY_DEPENDENCY = 4;
  AVAILABILITY_REASON_FUTURE_START_DATE = 5;
}
```

Names can be adjusted to proto style during implementation, but the vocabulary
must stay this small in v1 unless a testable ambiguity appears.

Semantics:

- `stage=triage`: unavailable, reason `TRIAGE`.
- terminal stages: unavailable, reason `TERMINAL`.
- `hold_reason` present: unavailable, reason `HELD`.
- future `start_date`: unavailable, reason `FUTURE_START_DATE`.
- unsatisfied dependency: unavailable, reason `BLOCKED_BY_DEPENDENCY`.
- otherwise, an accepted or active task is available.

Availability is not the same as claimability. Do not add a broad public
`claimable` field in v1. Claim policy computes claimability from availability,
assignment, and stage.

Dependency satisfaction:

- `completed` satisfies blockers.
- `duplicate` satisfies blockers only when it has a canonical replacement and
  dependency evaluation can prove equivalence for the dependent.
- `cancelled` and `wont_fix` do not automatically satisfy blockers.

Dependents blocked by unsuccessful terminal prerequisites require attention.
Expected remediation is to remove the dependency or rewire it to the canonical
replacement.

List APIs should avoid expensive per-row graph fanout in v1. They must provide
`available` and reason codes where already cheap. Rich blocker details,
aggregate counts by reason, dependency fanout details, and optimized materialized
read models are future work unless an endpoint explicitly requires them.

## 6. API and Read Model Contract

### 6.1 Task response shape

Task detail responses must include:

- `stage`
- `hold_reason`
- `start_date`
- `phase` projection
- `priority`
- `rank`
- assignment
- relationships
- `availability { available, reasons }`

Task list responses should include the same availability shape. If the initial
list implementation cannot cheaply compute dependency blockage for every row,
it may return the non-graph reasons and mark graph reason coverage as endpoint
specific only if the contract for queues and claim still computes graph
availability authoritatively.

### 6.2 Create/update validation

Create/update must reject removed native stages on native write paths:

- `backlog`
- `ready`
- `blocked`
- `scheduled`
- stage-level `waiting_for_input`
- stage-level `deferred`

Create/update must accept only:

- stages: `triage`, `accepted`, `working`, `in_review`, `in_qa`, `deploying`,
  `completed`, `wont_fix`, `duplicate`, `cancelled`.
- hold reasons: absent, `waiting_for_input`, `deferred`.

Validation must be enforced in the API/server layer and backed by store/schema
constraints so direct internal paths cannot persist invalid native state.

### 6.3 Claim validation

`ClaimTask` must strictly reject unavailable tasks in v1. There is no override.

The gate must be enforced where direct claim-by-ID cannot bypass it:

- RPC/MCP/CLI handlers must call the same server/store availability policy used
  by queues.
- The store claim transaction must guard the invariant under concurrency.
- Claim must reject triage, terminal, held, future-start, and dependency-blocked
  tasks.

Claim behavior:

- self-assign to the claiming actor.
- set stage to `working`.
- clear any hold reason.
- preserve assignment/history changes.
- reject `ClaimTaskRequest.assignee_id` on native claim paths. To route work to
  another user/agent, call the assignment/update API, which may assign
  unavailable tasks, then let the assignee claim it when it is available.
- reject already assigned tasks unless implementation explicitly narrows this
  to "assigned to another actor"; v1 should keep the current already-assigned
  rejection unless product review decides otherwise.

### 6.4 Queue query semantics

The primary work queue returns tasks that are available for claim/start:

- stage is `accepted` by default.
- no hold reason.
- no future start date.
- no unsatisfied blockers.
- sorted by priority, rank, then fallback.

Active queues may include active stages for handoff/review operations, but
claim/start queue semantics must not include triage or terminal tasks.

Empty queues must be legible to CLI/MCP agents. V1 read behavior should expose
enough cheap breakdown to distinguish:

- no tasks in scope.
- only triage tasks.
- available tasks assigned to someone else.
- held tasks.
- dependency-blocked tasks.
- future-start tasks.
- closed-only scope.

Do not persist this breakdown. Compute it as read-model behavior.

### 6.5 Watch/streaming

Computed availability can change when related tasks change. Current update code
already publishes events to relationship target tasks when relationships are
added/removed (`internal/server/server.go:640-662`), but closing or changing a
blocker can also change dependent availability. Implementation must add review
points/tests for watcher invalidation:

- blocker terminal outcome changes.
- blocker duplicate canonical replacement changes.
- dependency edge add/remove.
- hold reason changes.
- start_date crosses from future to current.

Time-based start_date availability does not naturally emit a task mutation.
V1 may document that clients refresh queues, or implement scheduled invalidation
later. Do not fake this by persisting availability.

## 7. Migration Rules

Migration must be explicit and testable.

Stage migration:

- `triage` -> `triage`
- `backlog` -> `accepted`
- `ready` -> `accepted`
- `working` -> `working`
- `in_review` -> `in_review`
- `in_qa` -> `in_qa`
- `deploying` -> `deploying`
- `waiting_for_input` -> `accepted`, `hold_reason=waiting_for_input`
- `deferred` -> `accepted`, `hold_reason=deferred`
- `scheduled` -> `accepted`, preserve `start_date`; if no start date exists,
  set `hold_reason=deferred` and record migration ambiguity.
- `completed` -> `completed`
- `wont_fix` -> `wont_fix`
- `duplicate` -> `duplicate`
- `cancelled` -> `cancelled`

Blocked migration:

- existing `stage=blocked` with at least one unsatisfied blocker -> `accepted`;
  blockage surfaces through computed availability.
- existing `stage=blocked` without an unsatisfied blocker -> `accepted`,
  `hold_reason=waiting_for_input`, unless implementation discovers a more
  accurate existing primitive.

Ready migration:

- existing `stage=ready` -> `accepted`.
- do not delete the ready/availability computation while deleting the asserted
  stage; move it under the new availability vocabulary.

Deferred/start_date integrity migration:

- if a row ends with `hold_reason=deferred` and a concrete future `start_date`,
  clear `hold_reason`.
- preserve the original ambiguity in audit/fidelity metadata.

Phase migration:

- recompute native `phase` from migrated stage for native Farm Table tasks.
- preserve wire `phase` compatibility for generated clients.
- imported/external rows with invariant violations, such as Beads
  `(phase=open, stage=blocked)`, must be normalized to the new native primitive
  set while preserving the original native status/fidelity label.

Unmigratable ambiguity:

- `stage=blocked` without graph blockers may mean waiting for input, an
  external system, a human policy hold, or a stale manual label. Store this
  ambiguity in existing change/audit history or a migration note/fidelity field,
  with the old stage/native label.
- `scheduled` without `start_date` cannot be reconstructed as a concrete date;
  use `deferred` and record the old value.
- `ready` had no reliable proof that the task was genuinely unblocked; graph
  availability must be recomputed after migration.

Minimum migration audit/fidelity contract:

- Every lossy state migration must write a persistent migration note.
- The minimum accepted shape is a change-log record on the task with:
  `field="task_state_migration"`, `old_value` containing the old
  `phase`, `stage`, `native_label`, and relevant scheduling/dependency snapshot
  as compact JSON, and `new_value` containing the new `stage`, `hold_reason`,
  and reason code for the migration decision as compact JSON.
- The actor for these records is the system/migration actor. If the existing
  change schema cannot represent a system actor cleanly, implementation must add
  a dedicated migration actor or a dedicated migration-note table before running
  the data migration.
- For adapter-origin rows, preserve the original external status in
  `native_label`/`native_status` or raw `remote_data` in addition to the
  migration note.
- Import of old export formats must produce the same migration notes or import
  warnings that can be persisted if the import is committed.

Migration must update all native write paths, generated enum schemas, CLI
parsers/completions/help, MCP schemas/descriptions, web columns/labels/colors,
import/export mappings, tests, and docs. A value removed from the native model
must not survive as a selectable native value.

Specific current vocabulary-survival checklist:

- `proto/farmtable.proto` comments/enums/RPC request fields and generated
  protobuf outputs under `api/farmtable/v1/`.
- `internal/convert/convert.go` and server conversion/validation helpers.
- `DRAFT-schema.json`.
- CLI enum parsing, help, completions, ready/blocked graph command text, watch
  filters, and task output vocabulary.
- MCP schemas, descriptions, and tool outputs.
- Web generated TypeScript types, kanban columns, toolbar filters, labels,
  stage color tokens in `web/src/styles/theme.css`, and client-side ready logic
  in `web/src/utils/task-ready.ts`.
- Import/export structs, export format version handling, and old-format import
  migration warnings.
- Both Beads paths: `internal/platform/beads/beads.go` and
  `internal/server/beads_import.go`, plus their tests.
- GitHub label mapping and treewalk logic.
- Transition/RBAC/server/store tests that assert removed stages, including
  `internal/server/transitions_test.go`.
- README, `docs/architecture.md`, root `agents.md`, and any generated or copied
  agent skill docs.

## 8. Adapter, Import, and Export Implications

Native deletion is not the same as external adapter deletion.

Adapters may ingest external statuses named `ready`, `blocked`, or `scheduled`,
but they must normalize into the new primitives:

- external `blocked` with graph evidence -> dependency relationships plus
  computed availability.
- external `blocked` without graph evidence -> `hold_reason=waiting_for_input`
  or adapter-specific fidelity metadata.
- external `scheduled` -> `start_date` when a date exists; otherwise
  `hold_reason=deferred` plus fidelity metadata.
- external `ready` -> `accepted`; availability remains computed.

Preserve source fidelity:

- Keep `native_label`/`native_status` or equivalent raw adapter data for
  round-trip/import fidelity.
- Native UX must not display foreign vocabulary as Farm Table native workflow
  labels unless explicitly marked as external/native source status.

Import/export:

- Bump export format version.
- Export new `hold_reason`, `rank`, and availability-compatible primitives.
- Keep exporting `phase` for compatibility, but document it as projection.
- Import old format v1 by applying the migration rules above.
- Import new format rejects removed native stages unless the import is declared
  old-format or adapter-fidelity data.
- Include warnings and persistent migration notes for lossy blocked/scheduled
  migrations.

## 9. CLI and MCP Implications

CLI and MCP are agent-facing surfaces and must use the server read model.

Remove from native CLI/MCP stage inputs:

- `backlog`
- `ready`
- `blocked`
- `scheduled`
- `waiting_for_input` as stage
- `deferred` as stage

Add:

- `accepted` stage.
- `--hold waiting_for_input|deferred`.
- filters for `available`, `unavailable_reason`, active/closed/all grouping,
  priority, rank/order, assignee.

Phase:

- Keep phase in JSON/full outputs for wire compatibility.
- Remove phase as the primary native list/watch UX filter. If a compatibility
  `--phase` remains temporarily, hide/deprecate it and document that native
  users should prefer active/closed/all and stage/availability filters.

Queue/empty-state behavior:

- `task_ready` should become availability/work-queue semantics, not
  `stage=ready`.
- Empty queue output must include a compact explanation when possible:
  `no_available_work`, `triage_only`, `held`, `blocked_by_dependency`,
  `future_start`, `assigned_elsewhere`, or `closed_only`.
- MCP tool descriptions must stop saying "ready stage" or "open phases" for
  native work queues.

Claim:

- `task_claim` and CLI claim must call the same API claim gate. Direct claim by
  ID cannot bypass computed availability.

## 10. Web UI Implications

The web phase must implement the stable semantics in this contract.

Required changes:

- no native phase control.
- no native Ready column.
- no native Blocked column as asserted stage.
- no native Scheduled or On Hold stage group.
- active/closed/all remains as a UX grouping over stage/terminal state.
- accepted work queue sorted by priority, then rank, then stable fallback.
- hold reason display and filters.
- unavailable indicators come from server-computed availability.
- attention view for dependents blocked by unsuccessful terminal prerequisites.
- drag/drop normally reorders within a priority band.
- optional convenience: dropping into another priority band changes priority and
  re-ranks in the target band.

The native board should show stage lanes for triage, accepted, active stages,
and terminal outcomes or a closed grouping. Held and unavailable states should
be modifiers/badges/filters on cards, not prime columns.

## 11. Documentation and Process Rules

Documentation cannot wait entirely until the end. These process rules must live
in the design/API/docs during implementation:

- If missing input can change whether the task should be done at all, keep it
  in `triage`.
- If the task has already been judged worth doing and input is needed to execute
  it, use `accepted` or an active stage with
  `hold_reason=waiting_for_input`.
- `deferred` means intentionally postponed without a concrete start date.
- A future `start_date` makes a task unavailable until that date; it is not a
  hold reason.
- Assignment is routing/responsibility and may happen while unavailable.
- Claim starts execution and requires computed availability.
- `completed` satisfies blockers.
- `duplicate` satisfies blockers only with a canonical equivalent replacement.
- `cancelled` and `wont_fix` do not automatically unblock dependents.

Final user/process documentation should be polished after implementation settles
the exact CLI/MCP flags and UI layout.

## 12. Explicit Non-Goals

- Do not implement code in this design phase.
- Do not reopen settled terminology decisions unless direct code evidence shows
  a hard contradiction.
- Do not solve `triage -> accepted` authorization here; it is an auth design
  concern. See
  `/scion-volumes/scratchpad/projects/farmtable/notes/auth-side-note-triage-acceptance-authority.md`.
- Do not persist a broad availability matrix.
- Do not reintroduce native `ready`.
- Do not reintroduce manually asserted native `blocked`.
- Do not add `claimed_by` in v1.
- Do not add a broad public `claimable` field in v1.
- Do not over-solve rank storage beyond a testable initial primitive and clear
  future options.

## 13. Implementation Phase Plan

Phase 1: core contract/migration review

- Review this contract against c-phase decisions.
- Confirm proto field names and migration format/version policy.
- Confirm exact availability enum names.

Phase 2: core data, API, CLI, MCP

- Add `accepted`, `hold_reason`, `rank`, and `availability` response model.
- Remove native write support for deleted stages.
- Implement migration and import old-format compatibility.
- Implement persistent migration notes before any lossy state migration.
- Implement server availability computation and claim gate.
- Reject `ClaimTaskRequest.assignee_id` on native claim paths.
- Update queue APIs and generated clients.
- Update CLI and MCP schemas/help/output.
- Add tests for migration, validation, availability reasons, claim rejection,
  terminal dependency semantics, and import/export.

Phase 3: web UI

- Remove phase control and deleted native columns.
- Implement active/closed/all grouping, hold filters, availability indicators,
  accepted queue ordering, rank drag/drop, and attention workflow.
- Update generated TypeScript usage.

Phase 4: documentation polish

- Update user docs, agent docs, MCP workflow docs, migration notes, and adapter
  fidelity notes after implementation details stabilize.

Review points:

- after migration tests pass.
- after claim gate tests prove direct claim-by-ID cannot bypass availability.
- after adapter/import/export tests prove old vocabulary does not survive as
  native selections.
- after web generated types compile and deleted values are not reachable through
  UI controls.

## 14. Acceptance Criteria

The implementation satisfies this contract when:

- Native asserted stages are exactly `triage`, `accepted`, `working`,
  `in_review`, `in_qa`, `deploying`, `completed`, `wont_fix`, `duplicate`,
  and `cancelled`.
- Native `ready`, `blocked`, `scheduled`, `backlog`, stage-level
  `waiting_for_input`, stage-level `deferred`, and prime `on_hold` cannot be
  selected through API, CLI, MCP, web, import/export, adapters, generated types,
  tests, colors, labels, columns, completions, or docs.
- Availability is computed from persisted primitives and exposed as
  `available` plus small reason codes.
- `ClaimTask` rejects unavailable tasks by ID, including triage, terminal, held,
  dependency-blocked, and future-start tasks.
- Native `ClaimTask` rejects request-level `assignee_id`; claim-on-behalf is not
  silently honored by native claim paths.
- Claim self-assigns to the claiming actor and moves the task to `working`.
- Assignment changes remain audited.
- Lossy state migrations persist migration notes with old/new state and the
  migration reason.
- Queue ordering is priority, rank within collection/priority, then stable
  fallback.
- Terminal dependency behavior is testable: completed satisfies; duplicate only
  with canonical replacement; cancelled/wont_fix do not satisfy automatically.
- Phase remains in wire responses/generated compatibility types but disappears
  from native UX controls.
- Migration rules are covered by tests for old ready, blocked with/without
  blockers, scheduled with/without start_date, deferred plus future start_date,
  and adapter-origin blocked values.
- Empty CLI/MCP queues are legible at the v1 read-model level.
- Watch/streaming behavior has explicit tests or documented limitations for
  computed availability changes caused by related task changes.

## 15. Unresolved Questions

These are implementation-detail questions, not terminology reopeners:

- Exact proto field numbers and enum names for `hold_reason`,
  `TaskAvailability`, and `AvailabilityReason`.
- Whether v1 list responses compute dependency availability for every returned
  row or only for queue/detail endpoints, given graph fanout cost.
- Whether the first rank implementation uses sparse integers, dense integers,
  or fractional strings. The contract requires ordering semantics, not a
  specific storage algorithm.
