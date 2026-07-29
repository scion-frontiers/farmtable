# Code Review Brief: Task State Phase 1 Predeploy Migration

## Context

Farm Table Phase 1 core was merged to `main` in PR #177, but live deploy is held.
The hold found two predeploy blockers:

1. Existing persisted task rows were not migrated, only import/export fixtures were.
2. The currently deployed/pre-Phase-2 UI is semantically incompatible with migrated Phase 1 task state unless a narrow correctness patch ships with the backend.

Developer branch/worktree:

- Branch: `task-state-predeploy-migration`
- Worktree: `/workspace/farmtable-task-state-predeploy`
- Review range: `origin/main...HEAD`
- Implementation commits: `aab015bc40f9b4dc8f0208e35487d9db81910d4b`, plus manager evidence commit `d5f12d2`

Read these before reviewing:

- `/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md`
- `.design/project-log/task-state-model-phase1-predeploy-migration.md`
- Previous deploy hold context in `.eng-manager-state.md` if available

## Review Scope

Review correctness, maintainability, and merge readiness for:

- Startup/store migration for already-persisted old native task stages.
- Per-row `changes.field_name='task_state_migration'` audit records with compact JSON old/new payloads.
- Idempotency and transaction/error behavior.
- Compatibility with SQLite and Postgres production behavior.
- Preservation/recomputation of `phase`, `native_label`, `hold_reason`, `start_date`, and task availability semantics.
- Narrow Phase1-aware web correctness patch only: migrated `accepted`/`hold_reason` data must not be mislabeled as old `ready/backlog/blocked/scheduled` UI concepts.

Pay special attention to:

- Whether the migration can silently skip rows, partially migrate rows without notes, or duplicate notes.
- Whether startup order after Ent schema creation is correct.
- Whether ambiguous old rows are classified exactly per the contract.
- Whether zero UUID as migration actor is acceptable or creates integrity/security issues.
- Whether the implementation has performance or locking risks on production-scale data.
- Whether any removed native stage remains writeable/selectable as a native state.

## Verification Expected

Run or inspect enough to independently support the verdict. Suggested commands:

- `git status --short --branch`
- `git diff --stat origin/main...HEAD`
- `PATH="/home/scion/go/bin:$PATH" go test ./...`
- `PATH="/home/scion/go/bin:$PATH" go build ./...`
- `npm run build` in `web/`
- `git diff --check origin/main...HEAD`
- focused old-stage search over `api proto internal web DRAFT-schema*`

## Deliverables

Write both:

- `/scion-volumes/scratchpad/projects/farmtable/reports/review-task-state-predeploy.md`
- `.design/project-log/task-state-model-phase1-predeploy-code-review.md`

Report format:

- Verdict: `APPROVE` or `REQUEST CHANGES`
- Findings first, ordered by severity with file:line references
- Verification commands and outcomes
- Residual risks or follow-ups

You MUST write both deliverables and then mark the task complete.
