# Brief: Code Reviewer R3 — Farmtable Task State Model Phase 1 Core

## Scope
Freshly review branch `task-state-core` in workspace `/workspace` inside your container, against `origin/main`.

Host path for the manager is `/workspace/farmtable-task-state-core`; inside your container the mounted repo is `/workspace`.

Authoritative contract: `/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md`
Developer project log: `.design/project-log/task-state-model-phase1-core.md`
R2 reports to verify, not trust:
- `/scion-volumes/scratchpad/projects/farmtable/reports/review-task-state-core-r2.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/audit-task-state-core-r2.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/test-task-state-core-r2.md`

## R3 Focus
- Verify the R2 blockers are fixed: `GetBlockedTasks` terminal dependency semantics, v2 import hold/start-date validation, direct `CreateTask`/`UpdateTask` into `working` rejection or equivalent claim routing, and Go/module updates.
- Re-check prior high-risk surfaces enough to catch regressions: claim invariants, import/export migration, adapters, generated artifacts, CLI/MCP vocabulary.
- Inspect real diffs and run/cite commands.

## Required Deliverables
- Write `/scion-volumes/scratchpad/projects/farmtable/reports/review-task-state-core-r3.md`.
- Write `.design/project-log/task-state-model-phase1-code-review-r3.md`.
- Include verdict `APPROVE` or `REQUEST CHANGES`, findings with file:line references, verification commands/results, and residual risks.

## Termination
You MUST write both deliverables and then mark the task complete.
