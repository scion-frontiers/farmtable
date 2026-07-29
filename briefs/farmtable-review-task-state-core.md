# Brief: Code Reviewer — Farmtable Task State Model Phase 1 Core

## Scope
Review branch `task-state-core` in workspace `/workspace/farmtable-task-state-core` against `origin/main`.

Authoritative contract: `/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md`
Developer project log: `.design/project-log/task-state-model-phase1-core.md`

## Review Requirements
- Do not trust the developer summary. Inspect real diffs and run or cite real verification commands.
- Focus on correctness, API compatibility, migration safety, vocabulary survival, store/API invariants, adapter normalization, CLI/MCP behavior, and generated artifacts.
- Verify that deleted native stages cannot be written or selected as native asserted values: `backlog`, `ready`, `blocked`, `scheduled`, stage-level `waiting_for_input`, stage-level `deferred`, and prime `on_hold`.
- Verify claim-by-ID cannot bypass computed availability, and that `ClaimTaskRequest.assignee_id` is rejected.
- Verify lossy migration notes are persistent and sufficiently shaped per the contract.

## Required Deliverables
- Write a review report to `/scion-volumes/scratchpad/projects/farmtable/reports/review-task-state-core.md`.
- Write a project log entry to `.design/project-log/task-state-model-phase1-code-review.md`.
- The report must include verdict `APPROVE` or `REQUEST CHANGES`, findings ordered by severity with file:line references, verification commands/results, and residual risks.

## Termination
You MUST write both deliverables and then mark the task complete.
