# Brief: Security Auditor R3 — Farmtable Task State Model Phase 1 Core

## Scope
Freshly security-audit branch `task-state-core` in workspace `/workspace` inside your container, against `origin/main`.

Host path for the manager is `/workspace/farmtable-task-state-core`; inside your container the mounted repo is `/workspace`.

Authoritative contract: `/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md`
Developer project log: `.design/project-log/task-state-model-phase1-core.md`
R2 security report to verify, not trust: `/scion-volumes/scratchpad/projects/farmtable/reports/audit-task-state-core-r2.md`

## R3 Focus
- Verify the direct working-stage create/update bypass is closed.
- Verify `GetBlockedTasks` and import validation fixes do not introduce security/integrity bypasses.
- Verify Go/toolchain/module vulnerability hygiene with `govulncheck` if available.
- Re-check claim self-assignment/availability, migration actor semantics, import/export trust boundaries, and adapter normalization.

## Required Deliverables
- Write `/scion-volumes/scratchpad/projects/farmtable/reports/audit-task-state-core-r3.md`.
- Write `.design/project-log/task-state-model-phase1-security-audit-r3.md`.
- Include verdict `APPROVE` or `REQUEST CHANGES`, severity-classified findings with file:line references, commands/results, and residual risks.

## Termination
You MUST write both deliverables and then mark the task complete.
