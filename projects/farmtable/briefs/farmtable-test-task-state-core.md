# Brief: Test Engineer — Farmtable Task State Model Phase 1 Core

## Scope
Evaluate test coverage and verification for branch `task-state-core` in workspace `/workspace/farmtable-task-state-core` against `origin/main`.

Authoritative contract: `/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md`
Developer project log: `.design/project-log/task-state-model-phase1-core.md`

## Review Requirements
- Inspect the changed tests and implementation; do not rely on the developer summary.
- Run focused tests or full tests as needed to verify claims.
- Assess coverage for migration matrix, persistent migration notes, native stage validation, hold/start-date rules, computed availability reasons, claim bypass rejection, terminal dependency semantics, import/export versioning, adapters, CLI/MCP vocabulary, and generated type/schema cleanup.
- Identify missing tests that could allow accidental vocabulary survival or migration data loss.

## Required Deliverables
- Write a test review report to `/scion-volumes/scratchpad/projects/farmtable/reports/test-task-state-core.md`.
- Write a project log entry to `.design/project-log/task-state-model-phase1-test-review.md`.
- The report must include verdict `APPROVE` or `REQUEST CHANGES`, coverage findings with file:line references, commands/results, and any recommended additional tests.

## Termination
You MUST write both deliverables and then mark the task complete.
