# Security Audit Brief R2: Task State Predeploy Migration

## Context

R1 security audit requested changes for one High issue: concurrent startup instances could replay stale task-state migration decisions and overwrite live post-migration task state, with duplicate migration notes. R2 added a Postgres advisory lock, row-conditional updates, note gating, and tests. Manager then ran a Cloud SQL Postgres scratch-schema proof.

R2 branch/worktree:

- Branch: `task-state-predeploy-migration`
- Worktree: `/workspace/farmtable-task-state-predeploy`
- Current HEAD: `2ae26d4`
- R2 fix commit: `ed4c862`
- Postgres proof commit: `2ae26d4`

Read:

- `/scion-volumes/scratchpad/projects/farmtable/reports/audit-task-state-predeploy.md`
- `.design/project-log/task-state-model-phase1-predeploy-migration.md`

## R2 Audit Scope

Determine whether the High security issue is fixed and whether any new Critical/High/Medium issue exists.

Focus on:

- Postgres advisory lock correctness, blocking behavior, unlock behavior, and connection lifecycle.
- Whether row-conditional update predicates are sufficient to prevent stale overwrite.
- Whether migration note creation is safe and not spoofable/duplicative.
- Whether Cloud SQL Postgres proof satisfies the deploy-blocking requirement.
- Dependency/vulnerability hygiene if relevant.

## Deliverables

Write both:

- `/scion-volumes/scratchpad/projects/farmtable/reports/audit-task-state-predeploy-r2.md`
- `.design/project-log/task-state-model-phase1-predeploy-security-audit-r2.md`

Verdict must be `APPROVE` or `REQUEST CHANGES`, with severity-classified findings first and verification commands/results.

You MUST write both deliverables and then mark the task complete.
