## Security Audit Report

Verdict: REQUEST CHANGES

### Summary
- Critical: 0
- High: 1
- Medium: 0
- Low: 0

### Findings

#### [HIGH] Startup migration can replay stale decisions and overwrite live task state during concurrent rollout
- **Location:** `/workspace/internal/store/entstore.go:111`
- **Description:** `migratePersistedTaskState` queries all old-stage tasks before starting its transaction, then later updates each task by ID only. It does not re-check that the task still has the old stage, does not lock the migration globally, and does not make the audit note insert conditional on the row actually being migrated. During a multi-instance deploy, two processes can both read the same old rows. After process A commits and begins serving traffic, process B can commit stale updates computed from pre-migration data and write duplicate `task_state_migration` notes.
- **Impact:** This can corrupt operational state during deployment, not only duplicate audit rows. Example: process A migrates `ready -> accepted`; a user or agent claims the task on the now-serving instance, moving it to `working`; process B then writes its stale migration update by ID and moves the claimed task back to `open/accepted` while leaving assignment/audit history inconsistent. The same race can clear a hold reason or replace a user's post-migration state change with a migration decision. This undermines claim semantics, availability safety, and audit integrity.
- **Proof of concept:** In a rolling deploy with two app instances:
  1. Instance A and B both execute the query at `/workspace/internal/store/entstore.go:111` and load task `T` with `stage='ready'`.
  2. A starts its transaction, updates `T` to `stage='accepted'`, writes one `task_state_migration` note, commits, and starts serving.
  3. An authenticated worker claims `T`, changing it to `phase='in_progress', stage='working'`.
  4. B starts/continues its transaction using the stale Ent object, calls `UpdateOneID(T).SetStage(accepted).SetPhase(open)` at `/workspace/internal/store/entstore.go:144`, and inserts another migration note at `/workspace/internal/store/entstore.go:172`.
  5. `T` is no longer in the claimed working state and the change log falsely records a second migration.
- **Recommendation:** Make the migration claim each row atomically and skip note creation unless the old-stage row was actually updated. For Postgres production, also use a transaction-scoped advisory lock or a durable migration marker so only one instance runs the migration body. A minimal row-safe pattern is:

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
// Insert the migration note only after n == 1.
```

If the implementation keeps process-level concurrency possible, add a test that runs two migration attempts against the same database and interleaves a claim/update between them. The expected outcome is one migration note and no overwrite of post-migration state.

### Positive Observations
- The per-row task update and migration note creation are in one database transaction, so a single-process failure should not leave a migrated task without its migration note.
- Migration note payloads are structured JSON and preserve old phase, old stage, native label, start date, and the migration reason.
- The zero UUID migration actor is acceptable under the current `changes.author_id` schema because it is a required UUID field with no user foreign key. The `field_name='task_state_migration'` discriminator makes the system-authored nature explicit.
- Claim semantics after migration are server-enforced by `ComputeAvailability`, `noUnsatisfiedBlockerPredicates`, `StageAccepted`, nil hold reason, and non-future start-date checks.
- The web fallback ready predicate now excludes held and future-start tasks and treats only `completed` blockers as satisfying dependencies.
- Dependency audit results were clean for called Go code and production web packages.

### Verification
- `PATH="/home/scion/go/bin:$PATH" go test ./...` - pass
- `PATH="/home/scion/go/bin:$PATH" go build ./...` - pass
- `PATH="/home/scion/go/bin:$PATH" govulncheck ./...` - blocked locally because `govulncheck` was not installed on PATH
- `PATH="/home/scion/go/bin:$PATH" go run golang.org/x/vuln/cmd/govulncheck@latest ./...` - pass; 0 called vulnerabilities, 0 imported-package vulnerabilities, 15 vulnerabilities in required modules that are not called
- `npm audit --omit=dev` in `web/` - pass; 0 vulnerabilities
- `git diff --check origin/main...HEAD` - pass
- Focused search for removed native stage constants/generated enum references - no removed native `TaskStage` constants or proto enum values found in the changed API surface; remaining old-state strings appear in migration/import compatibility, tests, docs, CLI/MCP "ready/blocked" query vocabulary, or platform adapter compatibility.

### Residual Risks and Follow-ups
- The startup migration loads all matching tasks and relationships into memory and performs per-blocker lookups. This is acceptable for the evidenced 4,044-task dogfood database, but for substantially larger production datasets the migration should be batched or guarded with deployment runbook expectations to reduce startup lock duration and memory pressure.
- The predeploy patch leaves some UI dependency-view copy using "ready" and "non-closed" wording. I did not classify this as a security blocker because the claim API remains authoritative, but it is a correctness cleanup candidate for the next UI pass.
