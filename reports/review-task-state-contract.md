# Review: Task State Model Design Contract

Date: 2026-07-27
Document reviewed: `/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md`
Verdict: REQUEST CHANGES

## Summary

The contract is directionally strong and represents the core c-phase decisions: `accepted` replaces `backlog`/native `ready`, `blocked` becomes computed dependency availability, `scheduled` becomes `start_date`, non-dependency pauses move to `hold_reason`, phase is retained as wire projection, and claim is gated by availability.

I found no explicit file:line citation in the contract that was plainly wrong against current source. However, the contract still has one API-boundary gap and several vocabulary-survival coverage gaps that are high risk for implementation. The most important change needed is to explicitly handle the existing `ClaimTaskRequest.assignee_id` override, because the contract says claim self-assigns to the claiming actor but does not specify whether this request field is removed, ignored, rejected, or restricted.

## Acceptance Criteria Check

| Acceptance criterion from authoring brief | Result | Notes |
|---|---:|---|
| Every settled decision from `task-state-model-cphase-decisions.md` is represented. | PASS | The native stage set, hold reasons, scheduling, phase projection, assignment vs claim, priority/rank queue ordering, terminal outcome dependency semantics, derived availability, streaming/watch concern, adapter fidelity, and process docs are represented. |
| Native asserted `ready`, asserted `blocked`, asserted `scheduled`, and prime `on_hold` cannot survive as behavior through overlooked CLI/MCP/web/adapter paths. | FAIL | The contract states broad categories, but it misses concrete current survival paths found in source: generated protobuf outputs, `DRAFT-schema.json`, `web/src/utils/task-ready.ts`, `web/src/styles/theme.css`, `internal/server/beads_import.go`, transition tests, docs, and `agents.md`. These should be named as migration/search targets or checklist items. |
| The distinction between assignment and claim is enforceable at the API level. | FAIL | The contract says claim self-assigns, but current proto exposes `ClaimTaskRequest.assignee_id` as "claim on behalf of another user/agent" at `proto/farmtable.proto:617-625`, and current RPC honors it at `internal/server/server.go:693-702`. The contract needs an explicit rule for this field. |
| `ClaimTask` cannot bypass computed availability by ID. | PASS | Section 6.3 explicitly requires RPC/MCP/CLI to use the same policy as queues and requires the store transaction to guard the invariant under concurrency. |
| Availability is computed from persisted primitives, not hand-maintained as a stage. | PASS | Section 5 says not to persist native `ready` or a broad availability matrix and lists persisted primitives. |
| Terminal outcome dependency semantics are testable. | PASS | The contract gives testable outcomes: `completed` satisfies, `duplicate` only with canonical replacement, `cancelled`/`wont_fix` do not automatically satisfy. It should still clarify the exact duplicate proof rule during implementation. |
| Phase remains available for normalization but is removed from native UX. | PASS | Sections 4.4, 9, 10, and 14 consistently keep phase on the wire and remove it from native controls. |
| Migration rules are specific enough for an implementation agent to write data migrations and tests without asking conceptual questions. | FAIL | Row-level stage migrations are specific, but source-fidelity/audit storage for lossy migrations is left unresolved, and implementation agents would need to know exactly where to store migration ambiguity. This is listed as an unresolved question, but migration depends on it. |
| Implementation phases are ordered with dependencies and review points. | PASS | Section 13 gives ordered phases and review points. |
| All current-code claims have file:line citations from fresh spot checks. | PASS | Every explicit citation in the contract was spot-checked and supports the stated claim. See citation section below. |

## Citation Verification

No explicit file:line citation in the contract was found to be wrong or stale.

Verified examples:

- `internal/store/schema/task.go:21-31` shows `phase` and `stage` enum fields, including `ready`, `blocked`, and `scheduled`.
- `proto/farmtable.proto:35-71` documents the current phase/stage model and maps `OPEN` and `ON_HOLD` as claimed.
- `internal/server/convert.go:68-80`, `internal/server/server.go:108-123`, and `internal/server/server.go:511-525` support the create/update phase projection claim.
- `internal/server/server.go:667-710` and `internal/store/entstore.go:776-808` support the current claim gate/bypass concern.
- `internal/store/entstore.go:2048-2129` and `internal/store/entstore.go:2146-2224` support the ready/blocked query claims.
- `internal/cli/enums.go:17-51`, `internal/cli/task.go:305-306`, `internal/mcp/server.go:142-164`, `web/src/components/ft-toolbar.ts:33-39`, and `web/src/components/kanban/ft-kanban-view.ts:28-44` support the CLI/MCP/web vocabulary claims.
- `internal/platform/beads/beads.go:301-315`, `internal/platform/github/labels.go:12-47`, and `internal/platform/github/treewalk.go:89-151` support the adapter vocabulary claims.
- `internal/store/entstore.go:1131-1140`, `internal/server/export_import.go:52-75`, `internal/server/export_import.go:401-408`, `proto/farmtable.proto:286-318`, and `proto/farmtable.proto:633-644` support their cited claims.

Additional current-code vocabulary surfaces that the contract should name or explicitly include in a migration checklist:

- `internal/convert/convert.go:23-46` maps removed proto stages into store stages.
- `proto/farmtable.proto:617-625` exposes claim stage and `assignee_id` override fields.
- `internal/server/beads_import.go:99-109` maps Beads `open` to `ready`, `blocked` to `blocked`, and `deferred` to `deferred`; tests assert this at `internal/server/beads_import_test.go:172-184` and `internal/server/beads_import_test.go:297-301`.
- `web/src/styles/theme.css:5-14` defines `--ft-stage-ready` and `--ft-stage-blocked`.
- `web/src/utils/task-ready.ts:5-20` computes a client-side ready predicate using phase and dependency relationships.
- `DRAFT-schema.json:15-29` preserves `ON_HOLD`, `ready`, `blocked`, and `scheduled`.
- `README.md:39-48`, `docs/architecture.md:64-78`, `docs/architecture.md:303-309`, and `agents.md:60-65` preserve native phase/ready/blocked vocabulary.
- `internal/server/transitions_test.go:18-38` and `internal/server/transitions_test.go:118-122` preserve deleted stage values in transition-scope tests.

## Decision-Note Coverage

Represented decisions:

- Native stages simplify to `triage`, `accepted`, active stages, and terminal outcomes.
- `accepted` replaces native `backlog`.
- Native `ready`, `blocked`, `scheduled`, and prime `on_hold` are removed.
- `waiting_for_input` and `deferred` become optional hold reasons applicable to accepted or active work.
- Future `start_date` drives availability and is not a hold reason.
- Phase remains a cross-platform wire projection and is removed from native UX.
- Assignment and claim are distinct; claim requires availability; no `claimed_by` in v1.
- Queue ordering is priority first, then rank within collection/priority.
- Terminal blockers are outcome-sensitive.
- Availability is computed from primitives and exposed with small reason codes.
- Watch/streaming invalidation is called out.
- External adapter/native-label fidelity and process docs are included.

Gaps or contradictions:

- The contract does not settle the current claim-on-behalf field. Current source has `optional string assignee_id = 5` in `ClaimTaskRequest` with a comment saying it overrides assignee, and the server honors it. That is in tension with "Claim self-assigns to the claiming actor" and with the brief's requirement that assignment vs claim be enforceable at the API level.
- The unresolved migration fidelity field is too important to leave open if implementation must write migrations without conceptual questions. The contract can still allow implementation choice, but it should define the minimum storage contract, such as an existing change-log event shape or a specific fidelity/migration-note field.

## Migration / Vocabulary-Survival Risk

The migration section has the right conceptual rules, but it is not strict enough as an implementation checklist. It should explicitly cover:

- CLI enum parsing and completions.
- MCP schemas and tool descriptions.
- Web column definitions, labels, filters, color tokens, generated TypeScript enums, and client-side `isReady` logic.
- Server/proto conversion helpers and generated protobuf files.
- Import/export structs and old/new format version handling.
- Both Beads adapter paths: `internal/platform/beads/beads.go` and `internal/server/beads_import.go`.
- GitHub label and treewalk logic.
- Tests that currently assert removed stage values.
- Docs and agent guidance.
- Draft/schema artifacts such as `DRAFT-schema.json`.

## API / Internal Consistency

The API, CLI/MCP, web, and persisted model sections are mostly consistent. They all treat `phase` as compatibility projection, remove native ready/blocked/scheduled, and make availability server-owned.

The main inconsistency is claim self-assignment versus the existing claim override field. The contract should specify one of:

- remove `ClaimTaskRequest.assignee_id`;
- reject it on native claim paths;
- keep it only for a separate "assign then claim on behalf" privileged operation with explicit scope and availability semantics.

Without that rule, "claim self-assigns" and "assignment may change independently while unavailable" are not enforceable at the API boundary.

## Unresolved Questions Review

Mostly tight, but one item is too broad:

- OK: exact proto field numbers/enum names.
- OK: whether list responses compute dependency availability for every row or only queue/detail endpoints.
- Needs tightening: "concrete fidelity/audit field used for lossy migration notes" is not just an implementation detail if migrations must be written without conceptual questions.
- OK: rank storage algorithm, because the ordering semantics are already fixed.

## Overall Verdict

REQUEST CHANGES.

Required changes before approval:

1. Add an explicit API contract for `ClaimTaskRequest.assignee_id` and claim-on-behalf behavior, consistent with self-assignment and assignment-vs-claim separation.
2. Strengthen the migration checklist with the additional current vocabulary surfaces listed above.
3. Define the minimum persistence/audit contract for lossy migration ambiguity instead of leaving it fully unresolved.
