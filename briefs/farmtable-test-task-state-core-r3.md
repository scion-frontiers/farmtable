# Brief: Test Engineer R3 — Farmtable Task State Model Phase 1 Core

## Scope
Freshly evaluate tests on branch `task-state-core` in workspace `/workspace` inside your container, against `origin/main`.

Host path for the manager is `/workspace/farmtable-task-state-core`; inside your container the mounted repo is `/workspace`.

Authoritative contract: `/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md`
Developer project log: `.design/project-log/task-state-model-phase1-core.md`

## R3 Focus
- Verify test coverage for the latest fixes: `GetBlockedTasks` terminal matrix, v2 invalid hold-state import rejection, direct working-stage create/update rejection, vulnerability/dependency updates where testable.
- Run focused tests and full suite as appropriate. Inspect assertions, not just names.

## Required Deliverables
- Write `/scion-volumes/scratchpad/projects/farmtable/reports/test-task-state-core-r3.md`.
- Write `.design/project-log/task-state-model-phase1-test-review-r3.md`.
- Include verdict `APPROVE` or `REQUEST CHANGES`, coverage findings, commands/results, and residual test risks.

## Termination
You MUST write both deliverables and then mark the task complete.
