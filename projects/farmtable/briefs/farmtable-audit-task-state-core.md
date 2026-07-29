# Brief: Security Auditor — Farmtable Task State Model Phase 1 Core

## Scope
Security-audit branch `task-state-core` in workspace `/workspace/farmtable-task-state-core` against `origin/main`.

Authoritative contract: `/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md`
Developer project log: `.design/project-log/task-state-model-phase1-core.md`

## Audit Requirements
- Inspect real diffs and run/cite verification as needed.
- Focus on authorization and invariant bypasses, especially claim self-assignment, rejection of `ClaimTaskRequest.assignee_id`, store-level claim gating, migration actor semantics, import/export trust boundaries, adapter normalization, API compatibility, and any data corruption or privilege escalation risk.
- Classify findings as Critical, High, Medium, Low, or Informational.

## Required Deliverables
- Write a security report to `/scion-volumes/scratchpad/projects/farmtable/reports/audit-task-state-core.md`.
- Write a project log entry to `.design/project-log/task-state-model-phase1-security-audit.md`.
- The report must include verdict `APPROVE` or `REQUEST CHANGES`, severity-classified findings with file:line references, commands/results, and residual risk.

## Termination
You MUST write both deliverables and then mark the task complete.
