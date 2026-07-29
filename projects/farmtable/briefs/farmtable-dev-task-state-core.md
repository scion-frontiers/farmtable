# Brief: Developer — Farmtable Task State Model Phase 1 Core Implementation

## Critical Constraints
- Work only in `/workspace/farmtable-task-state-core` on branch `task-state-core`.
- Do not touch `/workspace/farmtable` except to read context if needed.
- Follow the approved contract exactly: `/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md`.
- This is Phase 1 only: core data/API/CLI/MCP/adapters/migration/tests/process-rule docs. Do not implement the web UI redesign except generated TypeScript/schema outputs required by proto/API generation.
- Removed native stage vocabulary must not survive as writeable/selectable native values: `backlog`, `ready`, `blocked`, `scheduled`, stage-level `waiting_for_input`, stage-level `deferred`, and prime `on_hold`.
- `phase` remains a wire projection for compatibility but must not be introduced as a native control.
- Local verification first. For web-generated build impact, use `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`; live Cloud Run deployment is out of scope and must be escalated to the manager/coordinator.

## Required Deliverables
1. A committed implementation on branch `task-state-core`.
2. A project log entry at `.design/project-log/task-state-model-phase1-core.md`.
3. Verification evidence in the project log, including exact commands run and results.
4. Migration evidence against realistic old-state data, covering old `ready`, `blocked` with blockers, `blocked` without blockers, `scheduled` with and without `start_date`, `deferred` plus future `start_date`, and adapter-origin blocked values.
5. Vocabulary-survival evidence from targeted `rg` searches over proto/generated outputs, store/server/CLI/MCP/adapters, import/export, tests, docs/process guidance, `DRAFT-schema.json`, and web generated types/colors/utilities.

## Implementation Scope
- Persisted model: add native `accepted`, optional `hold_reason`, and `rank`; remove old native stage write support; update Ent schema/migrations/generated code.
- Proto/API/read model: add availability response model and reason enum; expose `hold_reason`, `rank`, and availability where required; keep `phase` as compatibility projection.
- Validation: enforce allowed native stages and hold-reason rules in server/API and store constraints.
- Migration/import/export: implement explicit testable migration rules from the contract and persistent lossy migration notes using the existing change-log model or an equivalent dedicated migration-note mechanism if required.
- Availability: compute server-side availability from stage, hold reason, future `start_date`, dependencies, and terminal dependency semantics.
- Claim: reject unavailable tasks by ID, reject `ClaimTaskRequest.assignee_id`, self-assign the authenticated actor, set `stage=working`, clear hold reason, and preserve assignment audit.
- Queue/list/watch: update queue semantics/order and add review points/tests for availability invalidation behavior or documented v1 limitations.
- CLI/MCP: update parsers, flags/help/schema/output to use `accepted`, `--hold`, availability filters/reasons, priority/rank ordering, and legible empty queue explanations.
- Adapters: normalize GitHub, Beads, and import paths into the new primitives while preserving external/native status fidelity.
- Tests: add focused coverage for migration, validation, availability reasons, claim rejection/bypass prevention, terminal dependency semantics, old import/export, adapters, CLI/MCP vocabulary, and generated enum/schema cleanup.
- Process-rule docs required during implementation: update the minimum docs/agent guidance that would otherwise keep teaching deleted native stages. Final docs polish belongs to Phase 3.

## Key Context
- Original manager brief: `/scion-volumes/scratchpad/projects/farmtable/briefs/farmtable-em-task-state-model.md`
- Contract review context: `/scion-volumes/scratchpad/projects/farmtable/reports/review-task-state-contract.md`
- Prior high-risk bar: `.design/project-log/auth-stage4-scope-extension.md` and reports under `/scion-volumes/scratchpad/projects/farmtable/reports/review-scope-ext*.md`, `/scion-volumes/scratchpad/projects/farmtable/reports/review-deploy-v*.md`
- Build/test guidance: `CLAUDE.md`

## Acceptance Criteria
- Native asserted stages are exactly `triage`, `accepted`, `working`, `in_review`, `in_qa`, `deploying`, `completed`, `wont_fix`, `duplicate`, and `cancelled`.
- Native write paths reject all removed stages listed above.
- Availability is computed and exposed as `available` plus the small reason-code enum from the contract.
- Direct `ClaimTask` cannot bypass availability and rejects triage, terminal, held, dependency-blocked, future-start, already-assigned, and request-level `assignee_id` cases.
- Lossy migrations persist old/new compact JSON notes with reason codes.
- Queue ordering is priority, rank within collection/priority, then created-at/task-ID fallback.
- Terminal dependency semantics are test-covered.
- CLI/MCP/import/export/adapters/generated artifacts cannot write/select removed stages as native values.
- `go generate ./internal/store/ent`, proto/client generation if applicable, `go test ./...`, and `go build ./...` pass, or any failure is documented with concrete blocker evidence.

## Termination
You MUST commit your work, write `.design/project-log/task-state-model-phase1-core.md`, send the manager a summary with commit hash and verification evidence, and then mark the task complete.
