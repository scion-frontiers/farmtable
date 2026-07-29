# Task State Phase 1 Predeploy Migration Review

## Review Summary

**Verdict:** APPROVE

**Overview:** LOW risk: the branch adds a targeted startup migration for persisted removed task stages and a narrow web compatibility patch for available/ready queue semantics. I found no blocking correctness, security, or merge-readiness issues in the `origin/main...HEAD` delta.

### Critical Issues

None.

### Important Issues

None.

### Suggestions

None requiring a cleanup pass before merge.

### What's Done Well

- [internal/store/entstore.go:76] The migration is wired immediately after Ent schema creation, so startup normalizes old persisted stage rows before normal store use.
- [internal/store/entstore.go:126] Task row rewrites and `changes.field_name='task_state_migration'` audit inserts occur in one transaction, preventing partially migrated rows without audit records.
- [internal/store/entstore.go:190] The old-stage classification matches the Phase 1 contract for `backlog`, `ready`, `waiting_for_input`, `deferred`, `scheduled`, and ambiguous `blocked` rows.
- [internal/store/entstore_test.go:80] The new regression test covers the old-stage matrix, audit payloads, no old-stage rows remaining, zero UUID actor expectation, and second-start idempotency.
- [web/src/utils/task-ready.ts:8] The web queue predicate now prefers server-provided availability and only uses a Phase 1-aware fallback when availability is absent.

### Verification Story

- Tests reviewed: yes. Reviewed `TestStartupMigration_PersistedOldTaskStates`, import/export migration compatibility context, and the Phase 1 availability code paths touched by the UI patch.
- Build verified: yes. `PATH="/home/scion/go/bin:$PATH" go build ./...` passed.
- Test suite verified: yes. `PATH="/home/scion/go/bin:$PATH" go test ./...` passed.
- Web build verified: yes. `npm run build` in `web/` passed; Vite emitted only the existing large chunk warning.
- Diff hygiene verified: yes. `git diff --check origin/main...HEAD` passed.
- Removed native stage search inspected: yes. `rg` over `api proto internal web DRAFT-schema*` showed remaining old vocabulary in compatibility/import/test/docs paths, not as newly writeable native stage constants or web stage labels in the reviewed delta.
- Security checked: yes. The migration adds no user-input boundary, secret handling, or external I/O. The zero UUID migration author is consistent with the current required `changes.author_id` schema and explicitly tested.

### Residual Risks

- I did not run a live Postgres integration migration. The implementation uses Ent/SQL primitives that are dialect-compatible, and the general Go suite passed, but production Postgres should still rely on the deploy smoke described in the migration log or a staging startup check.
- The startup migration loads all old-stage tasks before opening its write transaction. This is acceptable for the observed dogfood counts and bounded predeploy migration scope, but it would be worth batching only if production has unexpectedly large numbers of old-stage rows.

## Executive Summary

Risk level: LOW. The migration and web patch are tightly scoped, covered by focused tests, and pass the required build/test checks.

## Critical Issues

None.

## Observations

No requested pre-merge changes. The only notable residual risk is lack of a live Postgres migration run in this review environment.

## Positive Feedback

The implementation treats task updates and audit notes atomically and has strong idempotency coverage, which directly addresses the deploy hold concerns.

## Final Verdict

APPROVE.
