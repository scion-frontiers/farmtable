# Task State Model Phase 1 Predeploy Code Review

Date: 2026-07-27
Branch: `task-state-predeploy-migration`
Range: `origin/main...HEAD`
Verdict: APPROVE

## Summary

Reviewed the predeploy persisted task-state migration and narrow web compatibility patch against `/scion-volumes/scratchpad/projects/farmtable/briefs/farmtable-review-task-state-predeploy.md` and the Phase 1 task-state contract. No Critical or Important issues were found.

## Findings

### Critical

None.

### Important

None.

### Suggestions

None requiring follow-up before deployment.

## Review Notes

- `store.NewEntStore` runs `migratePersistedTaskState` after Ent schema creation and before returning the store, which matches the required startup ordering.
- `migratePersistedTaskState` selects only removed persisted stages, updates each task to Phase 1 primitives, and writes a `task_state_migration` change record in the same transaction.
- Classification for `backlog`, `ready`, `waiting_for_input`, `deferred`, `scheduled`, and `blocked` matches the contract, including distinguishing blocked rows with unsatisfied blocker evidence from ambiguous blocked rows without blocker evidence.
- The migration is idempotent because reruns only select rows still carrying removed stage strings.
- The web patch removes stale native stage labels from the command palette and switches ready queue filtering to server availability when present, with a Phase 1-aware fallback.

## Verification Commands

- `git status --short --branch` - passed; branch `task-state-predeploy-migration`.
- `git diff --stat origin/main...HEAD` - inspected; 9 files changed.
- `PATH="/home/scion/go/bin:$PATH" go test ./...` - passed.
- `PATH="/home/scion/go/bin:$PATH" go build ./...` - passed.
- `npm run build` in `web/` - passed; existing Vite large chunk warning only.
- `git diff --check origin/main...HEAD` - passed.
- `rg -n "Stage(Backlog|Ready|Blocked|Scheduled)|backlog|ready|blocked|scheduled|waiting_for_input|deferred" api proto internal web DRAFT-schema*` - inspected remaining old vocabulary; reviewed occurrences are compatibility, tests, docs, or migration/import paths rather than newly writeable native stage controls.

## Residual Risks

- This review did not execute a live Postgres migration. Based on the delta, the SQL is generated through Ent and direct predicates are simple `IN`/update/insert operations, but a staging or production-copy startup smoke remains the best validation for Postgres-specific DDL behavior.
- The migration performs an all-at-once read of old-stage task rows. The documented dogfood evidence shows small migrated counts, so this is acceptable for the predeploy migration.

## Final Verdict

APPROVE.
