# Task State Model Phase 1 Predeploy Security Audit

Date: 2026-07-27
Branch: `task-state-predeploy-migration`
Range: `origin/main...HEAD`
Verdict: REQUEST CHANGES

## Summary

Security audit found one High-severity deploy blocker in the startup migration.
The migration is transactionally safe for a single process, but it is not safe
under concurrent startup during a rolling deploy because it reads old-stage rows
before the migration transaction and later updates by task ID only.

## Findings

### [HIGH] Concurrent startup can replay stale migration decisions

- **Location:** `internal/store/entstore.go:111`
- **Issue:** `migratePersistedTaskState` loads all old-stage rows, starts a
  transaction, and updates each row by ID without re-checking the old stage or
  existing migration note.
- **Impact:** Two app instances can read the same old rows. After instance A
  commits and begins serving traffic, instance B can apply stale updates and
  duplicate `task_state_migration` notes. If a task is claimed or otherwise
  updated between those commits, B can move it back to `open/accepted`, clear
  hold state, and leave assignment/audit state misleading.
- **Required fix:** Make each migrated row conditional on still having the old
  persisted stage, insert the migration note only when that conditional update
  affects one row, and preferably add a Postgres transaction-scoped advisory
  lock or durable migration marker around the migration body.

Suggested shape:

```go
n, err := tx.Task.Update().
    Where(
        task.IDEQ(t.ID),
        task.StageEQ(t.Stage),
        predicate.Task(func(s *entsql.Selector) {
            s.Where(entsql.In(s.C(task.FieldStage), oldPersistedTaskStageValues()...))
        }),
    ).
    SetStage(migration.stage).
    SetPhase(migration.phase).
    ClearHoldReason().
    Save(ctx)
if err != nil {
    return fmt.Errorf("updating migrated task %s: %w", t.ID, err)
}
if n == 0 {
    continue
}
// Record task_state_migration only after n == 1.
```

Add a regression test for two migration attempts against the same database with
an interleaved claim/update. The expected outcome is one migration note and no
overwrite of post-migration state.

## Positive Observations

- Task mutation and migration note creation are in one transaction for the
  non-concurrent path, avoiding a migrated row without a note on ordinary
  failures.
- The migration note JSON is compact and preserves enough evidence to explain
  the state transition.
- Zero UUID is acceptable for this migration under the current required UUID
  `changes.author_id` schema because `field_name='task_state_migration'`
  distinguishes the event as system-authored.
- Server-side claim remains the authoritative safety boundary and checks
  availability, accepted stage, nil hold reason, start date, dependencies, and
  assignment.
- The web ready predicate now honors server-provided availability and falls back
  to Phase 1-aware checks.

## Verification

- `PATH="/home/scion/go/bin:$PATH" go test ./...` - pass
- `PATH="/home/scion/go/bin:$PATH" go build ./...` - pass
- `PATH="/home/scion/go/bin:$PATH" govulncheck ./...` - not available on PATH
- `PATH="/home/scion/go/bin:$PATH" go run golang.org/x/vuln/cmd/govulncheck@latest ./...` - pass; 0 called vulnerabilities
- `npm audit --omit=dev` from `web/` - pass; 0 vulnerabilities
- `git diff --check origin/main...HEAD` - pass
- Focused removed-stage search - pass for native enum/constants; old strings
  remain only in compatibility paths, tests, docs, and ready/blocked graph
  query vocabulary.

## Residual Risk

The migration loads all matching tasks and relationships and then performs
per-blocker lookups. The recorded 4,044-task dogfood run supports this branch's
immediate scale, but a future larger deployment should batch or otherwise
bound migration work.
