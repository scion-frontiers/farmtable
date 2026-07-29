# Developer Brief: Task State Phase 1 Predeploy Migration R2 Fix

## Context

Farm Table Phase 1 core is already merged to `main`, but live deploy remains held.
The predeploy migration branch adds a startup migration for already-persisted old task-stage rows and narrow Phase1-aware web correctness.

Current branch/worktree:

- Branch: `task-state-predeploy-migration`
- Worktree: `/workspace/farmtable-task-state-predeploy`
- Current HEAD before your work: `b08770c`
- Review range: `origin/main...HEAD`

Read before editing:

- `/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md`
- `.design/project-log/task-state-model-phase1-predeploy-migration.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/audit-task-state-predeploy.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/review-task-state-predeploy.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/test-task-state-predeploy.md`

## Blocking Finding To Fix

Security audit R1 verdict is `REQUEST CHANGES` with one High finding:

`migratePersistedTaskState` queries old-stage tasks before opening its transaction, then updates each task by ID only. In a rolling/multi-instance deploy, two instances can read the same old rows. Instance A migrates and starts serving; a user claims or updates a migrated task; instance B then commits a stale migration update by ID and can move the task back from `working` to `accepted/open`, while writing a duplicate `task_state_migration` note.

This blocks deploy.

## Required Fix

Make startup migration safe under concurrent/multi-instance rollout:

- Do not overwrite a row unless it still has the exact old stage being migrated at write time.
- Do not insert a migration note unless the row was actually updated by this migration attempt.
- Prevent duplicate migration notes under repeated/concurrent startup.
- For Postgres production, add an explicit cross-instance guard such as a transaction-scoped advisory lock or a durable migration marker. Use a dialect-safe approach for SQLite.
- Keep the existing single-process atomicity guarantee: the task row update and its `task_state_migration` note must commit together.
- Preserve all existing classification behavior and audit payload semantics.

## Required Tests

Add focused regression coverage that would fail on the current implementation. At minimum prove:

- Running the migration twice does not duplicate notes.
- A second/stale migration attempt cannot overwrite a task that was changed after the first migration. Example acceptable proof: seed old `ready`, migrate it, claim or otherwise move it to `working`, then invoke the migration path again and verify it remains `working` with only one migration note.
- The row-conditional write path creates notes only for rows it actually changed.

Use the existing store test patterns and keep tests deterministic. If a true interleaving test is feasible, add it; otherwise document precisely what concurrency hazard the deterministic stale-replay regression covers.

## Postgres Verification Requirement

The coordinator added a separate deploy gate: this migration must be run against a real/realistic Postgres instance, not only SQLite. There is a Cloud SQL instance visible to the manager:

- `deploy-demo-test:us-central1:scion-postgres-test`

The manager may run the final Postgres proof after your fix, but if you can access `FARMTABLE_TEST_POSTGRES_URL` or another Postgres DSN inside your container, run:

- integration migration tests against Postgres, or
- a startup migration against a Postgres schema seeded from the 4,044-task dogfood dataset if practical.

Record what you could and could not run.

## Verification

Run and record:

- `PATH="/home/scion/go/bin:$PATH" go test ./internal/store -run TestStartupMigration -count=1`
- `PATH="/home/scion/go/bin:$PATH" go test ./...`
- `PATH="/home/scion/go/bin:$PATH" go build ./...`
- `npm run build` in `web/` if web files changed
- `PATH="/home/scion/go/bin:$PATH" govulncheck ./...` or `go run golang.org/x/vuln/cmd/govulncheck@latest ./...`
- `git diff --check origin/main...HEAD`

## Deliverables

- Code/tests committed on `task-state-predeploy-migration`.
- Project log entry updated/appended at `.design/project-log/task-state-model-phase1-predeploy-migration.md`.
- Manager summary message with final HEAD, commit hash, fixes, verification, and any remaining Postgres verification gap.

You MUST commit your work, write the project log entry, and then mark the task complete.
