# Test Review Brief: Task State Phase 1 Predeploy Migration

## Context

Farm Table Phase 1 core is merged, but live deploy is blocked until we prove existing persisted rows migrate safely and the minimal current UI correctly handles Phase 1 state.

Developer branch/worktree:

- Branch: `task-state-predeploy-migration`
- Worktree: `/workspace/farmtable-task-state-predeploy`
- Review range: `origin/main...HEAD`
- Implementation commits: `aab015bc40f9b4dc8f0208e35487d9db81910d4b`, plus manager evidence commit `d5f12d2`

Read:

- `/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md`
- `.design/project-log/task-state-model-phase1-predeploy-migration.md`

## Test Review Scope

Assess whether tests and manual evidence are sufficient for deploy readiness:

- Startup migration covers all removed persisted stages: `ready`, `backlog`, `blocked`, `waiting_for_input`, `deferred`, `scheduled`.
- Rows with blockers, without blockers, future `start_date`, missing `start_date`, and terminal/triage edge cases behave per contract.
- One `task_state_migration` change note is created per transformed row with exact useful old/new payloads.
- Migration is idempotent on repeated startup.
- Store startup migration path is exercised, not only import/export migration.
- UI predicates and visible labels are tested or smoke-verified enough to prevent old-vocabulary misrepresentation.
- The 4,044-task dogfood DB evidence in the project log is credible and sufficient; flag gaps.

Use the Prove-It Pattern where appropriate: if you find a missing high-risk case, add or describe the failing test needed. If you add tests, commit them and record the commit.

## Suggested Verification

- `PATH="/home/scion/go/bin:$PATH" go test ./internal/store -run TestStartupMigration_PersistedOldTaskStates -count=1`
- `PATH="/home/scion/go/bin:$PATH" go test ./...`
- `PATH="/home/scion/go/bin:$PATH" go build ./...`
- `npm run build` in `web/`
- Any focused frontend/unit/manual verification you judge necessary.

## Deliverables

Write both:

- `/scion-volumes/scratchpad/projects/farmtable/reports/test-task-state-predeploy.md`
- `.design/project-log/task-state-model-phase1-predeploy-test-review.md`

Report format:

- Verdict: `APPROVE` or `REQUEST CHANGES`
- Coverage findings first, with file:line references where applicable
- Tests/commands run and outcomes
- Residual risks or recommended follow-ups

You MUST write both deliverables and then mark the task complete.
