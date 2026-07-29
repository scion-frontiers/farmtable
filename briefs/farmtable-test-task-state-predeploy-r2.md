# Test Review Brief R2: Task State Predeploy Migration

## Context

R1 code/test approved, but R1 security found a High concurrency/stale-replay bug in startup migration. R2 added row-conditional updates, Postgres advisory locking, and new regression tests. Manager also ran a Cloud SQL Postgres dogfood-scale migration proof.

R2 branch/worktree:

- Branch: `task-state-predeploy-migration`
- Worktree: `/workspace/farmtable-task-state-predeploy`
- Current HEAD: `2ae26d4`
- R2 fix commit: `ed4c862`

Read:

- `/scion-volumes/scratchpad/projects/farmtable/reports/audit-task-state-predeploy.md`
- `.design/project-log/task-state-model-phase1-predeploy-migration.md`

## R2 Test Scope

Assess whether test coverage now proves:

- stale migration replay cannot overwrite a task changed after first migration;
- notes are created only for rows actually changed;
- second startup does not duplicate notes;
- existing old-stage matrix coverage still passes;
- Cloud SQL Postgres proof is credible for the deploy gate.

Run focused and broad verification as needed.

## Deliverables

Write both:

- `/scion-volumes/scratchpad/projects/farmtable/reports/test-task-state-predeploy-r2.md`
- `.design/project-log/task-state-model-phase1-predeploy-test-review-r2.md`

Verdict must be `APPROVE` or `REQUEST CHANGES`, with coverage findings and verification commands/results.

You MUST write both deliverables and then mark the task complete.
