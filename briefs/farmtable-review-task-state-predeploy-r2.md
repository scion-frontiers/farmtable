# Code Review Brief R2: Task State Predeploy Migration

## Context

R1 predeploy code review and test review approved. R1 security audit requested changes for one High issue: concurrent startup instances could replay stale task-state migration decisions and overwrite post-migration task state, with duplicate audit notes.

R2 branch/worktree:

- Branch: `task-state-predeploy-migration`
- Worktree: `/workspace/farmtable-task-state-predeploy`
- Current HEAD: `2ae26d4`
- Review range: `origin/main...HEAD`
- R2 fix commit: `ed4c862`
- Manager Postgres evidence commit: `2ae26d4`

Read:

- `/scion-volumes/scratchpad/projects/farmtable/reports/audit-task-state-predeploy.md`
- `.design/project-log/task-state-model-phase1-predeploy-migration.md`

## R2 Review Scope

Focus on:

- Whether `ed4c862` fully fixes the stale replay/concurrent startup issue.
- Whether the Postgres advisory lock is correct, connection-scoped behavior is safe, and SQLite behavior remains valid.
- Whether row-conditional updates and migration-note creation now prevent overwrites and duplicate notes.
- Whether R2 tests prove the former bug.
- Whether the Cloud SQL Postgres proof in the project log is credible and sufficient.

Do not reopen R1-approved scope unless the R2 changes create a new issue.

## Deliverables

Write both:

- `/scion-volumes/scratchpad/projects/farmtable/reports/review-task-state-predeploy-r2.md`
- `.design/project-log/task-state-model-phase1-predeploy-code-review-r2.md`

Verdict must be `APPROVE` or `REQUEST CHANGES`, with findings first and verification commands/results.

You MUST write both deliverables and then mark the task complete.
