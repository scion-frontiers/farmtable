# Brief: Security Auditor R2 — Farmtable Task State Model Phase 1 Core

## Scope
Freshly security-audit branch `task-state-core` in workspace `/workspace` inside your container, against `origin/main`.

Host path for the manager is `/workspace/farmtable-task-state-core`, but inside your container the mounted repo is `/workspace`.

Authoritative contract: `/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md`
Developer project log: `.design/project-log/task-state-model-phase1-core.md`
Prior reports to verify, not blindly trust:
- `/scion-volumes/scratchpad/projects/farmtable/reports/review-task-state-core.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/test-task-state-core.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/audit-task-state-core.md`

## R2 Focus
- Verify whether the previous security blockers are fixed: GitHub pass-through claim bypass, Ent claim availability race, and Beads accepted-to-blocked projection.
- Re-check authorization/invariant bypasses, migration actor semantics, import/export trust boundaries, adapter normalization, and API compatibility.
- Classify findings as Critical, High, Medium, Low, or Informational.

## Required Deliverables
- Write a security report to `/scion-volumes/scratchpad/projects/farmtable/reports/audit-task-state-core-r2.md`.
- Write a project log entry to `.design/project-log/task-state-model-phase1-security-audit-r2.md`.
- The report must include verdict `APPROVE` or `REQUEST CHANGES`, severity-classified findings with file:line references, commands/results, and residual risk.

## Termination
You MUST write both deliverables and then mark the task complete.
