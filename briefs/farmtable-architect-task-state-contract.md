# Agent Brief: Farm Table Task State Design Contract

**Date:** 2026-07-26
**Phase:** Design contract writing
**Expected output:** A design contract, not implementation

## Objective

Write the implementation-ready design contract for the Farm Table task state
model refactor.

The contract should turn the settled c-phase/user decisions into a concrete,
testable specification for the next implementation phases: core data, API, CLI,
MCP, web UI, and documentation.

Primary source of truth:

`/scion-volumes/scratchpad/projects/farmtable/notes/task-state-model-cphase-decisions.md`

Useful investigation background:

`/scion-volumes/scratchpad/projects/farmtable/analysis-task-state-model.md`

Codebase:

`/workspace/farmtable`

The decision note is authoritative for product/model decisions. The older
analysis document and current code are evidence sources, not authority. When
making claims about current behavior, spot-check the code and cite file:line.

## Non-Goals

Do not implement code in this phase.

Do not reopen settled terminology decisions unless direct code evidence shows a
hard contradiction.

Do not involve `agent:phase-arch` unless ptone explicitly asks. This design
contract should proceed from the c-phase/ptone decision record.

Do not turn authorization for `triage -> accepted` into a task-state model
problem. It is deferred to auth design. Reference the side note only:

`/scion-volumes/scratchpad/projects/farmtable/notes/auth-side-note-triage-acceptance-authority.md`

Do not design a broad persisted availability matrix. Persist primitives; compute
availability.

Do not reintroduce native `ready` or manually asserted native `blocked`.

## Core Model To Specify

The contract should separate asserted state from computed availability.

Asserted state is durable state chosen by an authorized actor or process.
Computed availability is derived from stored primitives such as stage, hold
reason, start date, dependency relationships, assignment, priority/rank, and
terminal outcome.

### Native Stage

Specify the native workflow stage set as:

- `triage`: no acceptance judgment has been made yet.
- `accepted`: judged worth doing, but work has not started.
- active execution stages: preserve the current active stages unless the code
  review finds a reason to narrow them. Expected set includes `working`,
  `in_review`, `in_qa`, and `deploying`.
- terminal outcome stages: expected set includes `completed`, `wont_fix`,
  `duplicate`, and `cancelled`.

Specify removal from native workflow stage:

- `ready`: remove as a native asserted stage. It was acting as a
  hand-maintained cache of derived availability.
- `blocked`: remove as a native asserted stage. Dependency blockage is computed
  from graph relationships.
- `scheduled`: remove as a native asserted stage or hold reason. Use
  `start_date`.
- `on_hold` as a prime stage: replace with a hold/modifier axis.

Use `accepted`, not `backlog`, as the native pre-work state.

### Hold Reasons

Specify hold reason as an optional modifier axis, not as prime workflow stage.

Initial hold reason values:

- none
- `waiting_for_input`
- `deferred`

The hold reason can apply to accepted or active tasks.

Process rule to include in the contract and later docs:

- If missing input can change whether the task should be done at all, keep it in
  `triage`.
- If the task has already been judged worth doing and input is needed to execute
  it, use `accepted` or an active stage with `hold_reason=waiting_for_input`.

### Scheduling

Specify `start_date` as structured scheduling data that feeds computed
availability.

A task with a future `start_date` is unavailable until that date. It is not on
hold for that reason.

`deferred` means intentionally postponed without a concrete start date.

The API must enforce an integrity rule for `deferred` plus concrete future
`start_date`. Do not leave this as UI-only validation. The contract should choose
or explicitly recommend one canonical behavior:

- reject the combination, or
- setting a concrete `start_date` clears `hold_reason=deferred`.

### Phase

Keep `phase` as a cross-platform normalization projection on the wire.

Remove `phase` from native UX. Native UX should use active/closed/all plus
stage, hold reason, availability, assignment, priority, and rank.

The contract should identify which generated types, API responses, CLI/MCP
surfaces, and web filters currently expose phase and distinguish:

- normalization/wire compatibility that remains, and
- native UX controls or labels that should disappear.

### Assignment And Claim

Specify assignment and claim as distinct concepts.

- assignment: responsibility/routing; may happen while unavailable.
- claim: start execution; must require availability.

V1 decision:

- `ClaimTask` strictly rejects unavailable tasks.
- No override path in v1.
- Claim self-assigns to the claiming actor.
- Do not add `claimed_by` in v1.
- Assigned plus active stage implies an active claim.
- Preserve assignment changes through existing audit/change history or specify
  the minimal audit requirement if current code is insufficient.

The design must state where the claim gate is enforced. A correct queue is not
enough if direct claim-by-ID can bypass availability.

### Queue Ordering

Specify queue ordering as:

1. priority
2. rank within priority band and collection
3. stable fallback, likely creation time or ID if rank is absent

The contract should define rank scope and tie-breaking. Recommended scope:
collection plus priority band.

Do not over-solve rank storage in the contract, but explicitly flag write
amplification from naive dense integer reordering. The implementation plan can
start simple while noting future options such as sparse ranks or fractional
ranks.

UI implication to record for the later web phase:

- drag/drop normally reorders within a priority band.
- optional convenience: dropping into a different priority band changes priority
  and re-ranks in the target band.

### Closure Outcomes And Dependencies

Specify dependency satisfaction by terminal outcome.

- `completed` satisfies blockers and can make dependents available.
- `duplicate` can satisfy blockers only when resolved to an equivalent or
  canonical replacement.
- `cancelled` and `wont_fix` do not automatically satisfy blockers.

Dependents blocked by unsuccessful terminal prerequisites need an attention
workflow. The expected remediation is to remove the dependency relationship or
rewire it to a replacement prerequisite.

### Derived Availability

Specify computed availability as server-owned read/query behavior.

Persist primitives:

- stage
- hold reason
- start date
- relationships
- assignment
- terminal outcome
- priority/rank

Do not persist every derived availability combination.

Initial public computed surface:

- `available: bool`
- a small, obvious set of reason codes

Keep the reason-code set small in v1. The decision note intentionally leaves the
exact names for design time. Do not expose a broad `claimable` field initially.
Queue/claim policy can compute claimability from availability, assignment, and
stage.

The contract should define availability semantics for at least these obvious
exclusions:

- not accepted for execution yet: `stage=triage`
- closed/terminal
- paused by hold reason
- blocked by unsatisfied dependency
- future start date

If the contract proposes more reason codes, mark them as optional/future unless
they are required to prevent ambiguous API behavior.

Avoid expensive per-row graph computations in initial list APIs. Call out richer
counts, blocker details, and optimization as future design work unless a current
endpoint requires them.

## Migration Contract

Include a migration section with explicit source and destination rules.

Expected rules to specify:

- existing native `stage=ready` rows migrate to `accepted`.
- remove `ready` from native write paths, CLI enums, MCP schema, web column
  definitions, colors/labels, import/export tables, and tests.
- keep derived ready/availability computation only under new availability
  vocabulary. Do not delete the computation accidentally while deleting the
  asserted stage.
- existing `stage=blocked` rows with at least one unsatisfied blocker migrate to
  `accepted` and surface blockage through computed availability.
- existing `stage=blocked` rows without an unsatisfied blocker migrate to
  `accepted` with `hold_reason=waiting_for_input`, unless code review discovers
  a more accurate existing primitive.
- external adapter behavior for blocked must be treated carefully because at
  least one external source may have a genuine blocked value. The contract
  should distinguish native workflow deletion from adapter normalization.
- remove `scheduled` as a stage/hold reason and use `start_date`.
- define the API integrity behavior for `deferred` plus concrete future
  `start_date`.
- preserve `phase` on the wire, but remove it from native UX.

The migration section should also identify data that cannot be migrated
perfectly and what audit/fidelity field carries that ambiguity.

## API, CLI, MCP Contract

The design should specify:

- create/update validation for allowed native stages and hold reasons.
- claim validation for computed availability.
- queue query semantics.
- list/detail response shape for computed availability.
- minimal availability reason-code vocabulary.
- import/export compatibility behavior.
- generated client/type updates.
- CLI/MCP command vocabulary changes after removing native `ready`, `blocked`,
  `scheduled`, and phase UX concepts.

CLI/MCP are agent-facing surfaces. Empty queues must be legible: an agent should
be able to tell whether there is no work, only triage work, assigned work, held
work, blocked work, or future-start work at the level the v1 API can cheaply
support.

Do not require every breakdown to be persisted. Treat this as query/read model
behavior.

## Web UI Contract

The detailed web UI is a later phase, but the design contract must give that
phase stable semantics.

Specify UI-facing requirements:

- no native phase control.
- no native Ready column.
- no native Blocked column as asserted stage.
- active/closed/all filter remains a UX grouping over stage/terminal state.
- accepted work queue sorted by priority then rank.
- hold reason display and filters.
- unavailable indicators are derived from server-computed availability.
- attention view for dependents blocked by unsuccessful terminal prerequisites.
- drag/drop rank semantics inside priority band, with optional priority-changing
  convenience.

## Documentation Contract

Critique of the proposed implementation phasing:

The rough order "core data, API, CLI -> web UI -> documentation" is directionally
right for implementation. However, documentation cannot be entirely last. The
design contract itself must include the process rules that implementation and UX
depend on, especially triage vs accepted, hold reasons, assignment vs claim, and
availability behavior.

Recommended phasing:

1. Design contract and migration contract.
2. Core data/API/CLI/MCP implementation.
3. Web UI implementation against the stable contract.
4. User/process documentation polish.

Documentation work should therefore be split:

- contract/process rules now, inside this design phase.
- finished user-facing docs after implementation details settle.

## Required Deliverable Shape

Produce a design contract document in the scratchpad. Recommended path:

`/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md`

The document should include:

- problem statement
- definitions
- persisted data model
- computed availability model
- API/read model contract
- queue and claim policy
- migration rules
- adapter/import/export implications
- CLI/MCP implications
- web UI implications
- documentation/process rules
- explicit non-goals
- implementation phase plan
- acceptance criteria
- unresolved questions, limited to genuine design-time blockers

Keep unresolved questions tight. The goal is to unblock implementation planning,
not restart the terminology investigation.

## Acceptance Criteria For The Contract

The contract is done when:

- every settled decision from
  `/scion-volumes/scratchpad/projects/farmtable/notes/task-state-model-cphase-decisions.md`
  is represented.
- native asserted `ready`, asserted `blocked`, asserted `scheduled`, and prime
  `on_hold` cannot survive as behavior through overlooked CLI/MCP/web/adapter
  paths.
- the distinction between assignment and claim is enforceable at the API level.
- `ClaimTask` cannot bypass computed availability by ID.
- availability is computed from persisted primitives, not hand-maintained as a
  stage.
- terminal outcome dependency semantics are testable.
- phase remains available for normalization but is removed from native UX.
- migration rules are specific enough for an implementation agent to write data
  migrations and tests without asking conceptual questions.
- implementation phases are ordered with dependencies and review points.
- all current-code claims have file:line citations from fresh spot checks.

## Suggested Review Stance

Be strict about accidental vocabulary survival. A deleted enum value can still
survive through labels, color tables, import/export maps, CLI completions, MCP
schemas, generated TypeScript types, kanban columns, tests, and docs.

Be equally strict about query-only guarantees. If availability only exists in a
queue helper, direct mutations can bypass it. The contract should make the API
boundary explicit.

The highest-risk parts of the design are migration coverage, adapter fidelity,
watch/streaming behavior for computed availability, and acceptance criteria.
Spend review effort there.
