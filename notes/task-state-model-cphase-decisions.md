# Task State Model: c-phase / ptone Decisions

**Date:** 2026-07-26
**Thread:** dedicated c-phase review thread
**Status:** Decision capture for design drafting. This is not an implementation spec.

## Core Framing

Farm Table should separate asserted task state from computed task availability.

Asserted state is durable state chosen by an authorized actor or process. Computed
availability is derived from stored primitives such as stage, hold reason,
relationships, start dates, assignment, and terminal outcome.

## Settled Decisions

### Native Stage

Native workflow stage should be simplified to:

- `triage`: no acceptance judgment has been made yet.
- `accepted`: task has been judged worth doing, but work has not started.
- active execution stages such as `working`, `in_review`, `in_qa`, `deploying`.
- terminal outcome stages such as `completed`, `wont_fix`, `duplicate`,
  `cancelled`.

Use `accepted` rather than `backlog` for the native pre-work state.

Remove these from native workflow stage:

- `ready`: it was functioning as a hand-maintained cache of derived
  availability.
- `blocked`: dependency blockage is computed from graph relationships.
- `scheduled`: scheduling should be represented by `start_date`, not a
  duplicate asserted state.
- `on_hold` as a prime stage.

### Hold Reasons

Represent non-dependency pauses with an optional hold/modifier axis rather than
prime workflow stages.

Initial hold reasons:

- `waiting_for_input`
- `deferred`
- none

`waiting_for_input` and `deferred` can apply to accepted or active work, not only
to pre-work tasks.

Rule for process guidance:

- If missing input can change whether the task should be done at all, keep the
  task in `triage`.
- If the task has already been judged worth doing and input is needed to execute
  it, use `accepted` or an active stage with `hold_reason=waiting_for_input`.

### Scheduling

Remove `scheduled` as an asserted state or hold reason.

`start_date` is structured scheduling data and feeds computed availability. A
task with a future `start_date` is unavailable until that date, but it is not
on hold.

`deferred` means intentionally postponed without a concrete start date.

API-level integrity rule:

- `deferred` and a concrete future `start_date` should not silently coexist.
- The API should either reject the combination or define a canonical behavior,
  likely setting `start_date` clears `deferred`.

### Phase

Keep `phase` on the wire as a cross-platform normalization projection.

Remove `phase` from native UX as a primary user-facing control. Native UX should
use active/closed/all plus stage, hold, availability, assignment, priority, and
rank filters.

### Assignment And Claim

Assignment and claim are distinct concepts.

- assignment: responsibility/routing; may happen while a task is unavailable.
- claim: start execution; must require availability.

`ClaimTask` should strictly reject unavailable tasks in v1, with no override.

Claim may self-assign to the claiming actor. Do not add a separate `claimed_by`
field in v1. Use audit/change history to preserve previous assignment changes.

Assigned plus an active stage implies an active claim.

### Queue Ordering

Queue ordering is priority first, then rank.

Rank is pull order within a priority band and collection. UI drag/drop should
normally operate within the priority band.

Optional UI convenience: dragging an item into another priority band can change
the priority and then re-rank it within that band.

Implementation note: rank reordering can cause write amplification if many rows
are renumbered. The design should flag this and avoid over-solving it in the
initial model.

### Closure Outcomes And Dependencies

Not every terminal outcome satisfies blockers.

- `completed` unblocks dependents.
- `duplicate` can unblock dependents only if it resolves to an equivalent or
  canonical replacement.
- `cancelled` and `wont_fix` should not automatically make dependents available.

Dependents blocked by unsuccessful terminal prerequisites should show up in an
attention/review workflow. The likely remediation is to remove the stale
dependency relationship or rewire it to a replacement prerequisite.

### Derived Availability

Do not persist every derived availability combination.

Persist primitives:

- stage
- hold reason
- start date
- relationships
- assignment
- terminal outcome
- priority/rank

Compute availability server-side at read/query time.

Expose computed reason codes from server APIs so UI, CLI, MCP, and agents share
one source of truth.

For now, keep the computed public surface to `available` plus a small obvious
set of reason codes. Do not expose broad `claimable` fields initially; claimable
can be computed by queue/claim policy from availability, assignment, and stage.

Start with the smaller obvious reason set. Revisit exact naming and expansion at
design time.

Avoid expensive per-row graph computations in the initial design. Note richer
counts, blocker details, and optimization work as future design/implementation
concerns.

## Deferred / Design-Time Questions

### Authorization For Acceptance

Who can move `triage -> accepted` is an authorization/policy concern, not a core
task-state data model concern. A side note was filed for future auth design:

`/scion-volumes/scratchpad/projects/farmtable/notes/auth-side-note-triage-acceptance-authority.md`

### Availability Read Model Details

Revisit at design time:

- exact reason-code names
- whether queue APIs need only a preferred/top-level exclusion reason or a
  larger breakdown
- how much per-task availability detail belongs in general list/detail APIs
- whether and when to expose richer count fields

### Streaming / Watch

Computed availability can change when related tasks change, not only when the
task itself changes. Example: closing a blocker can change dependent
availability.

This needs deeper design-time investigation. The decision so far is only that
it matters and should be called out explicitly.

### External Adapters And Native Labels

External adapter mapping and `native_label` fidelity remain design issues.
Native UX should not leak external vocabulary back into the simplified native
workflow.

### Process Documentation

Companion documentation is required. It should cover:

- triage vs accepted rule
- hold reason usage
- assignment vs claim
- availability and queue behavior
- human UI workflows for triage, prioritization, monitoring, and graph review
- CLI/MCP workflows for agents
