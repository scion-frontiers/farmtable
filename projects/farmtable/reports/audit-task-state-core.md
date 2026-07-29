## Security Audit Report

Date: 2026-07-27
Branch: `task-state-core`
Workspace reviewed: `/workspace` (container mount for host `/workspace/farmtable-task-state-core`)
Base: `origin/main`
Verdict: `REQUEST CHANGES`

### Summary
- Critical: 0
- High: 1
- Medium: 2
- Low: 0

### Findings

#### [HIGH] GitHub pass-through claims bypass the new availability and accept gates
- **Location:** `internal/server/server.go:705`, `internal/store/multistore.go:227`, `internal/platform/github/passthrough.go:517`
- **Description:** The native server now rejects `ClaimTaskRequest.assignee_id` and delegates claim gating to the store, but `MultiStore.ClaimTask` dispatches directly to the backing collection store. `EntStore.ClaimTask` computes availability before claiming, while `GitHubPassThroughStore.ClaimTask` only finds the open GitHub issue and swaps its stage label to `working`. It does not reject `triage`, terminal/held/future-start equivalents, or dependency-blocked issues. Because `server.ClaimTask` removed its RPC-layer triage check and relies on store-level policy, GitHub-backed collections can bypass the contract's direct claim-by-ID invariant.
- **Impact:** A token with `task:claim` and collection access can move a GitHub-backed triage issue, or an issue with open sub-issues, into `working` without `task:accept` and without satisfying computed availability. This is an authorization boundary bypass for the task-state model and can cause unauthorized work-start state transitions in external collections.
- **Proof of concept:** On a GitHub pass-through collection, create or select an open issue with label `ft:stage/triage` or with an open sub-issue. Call `ClaimTask` with a token that has `task:claim` but not `task:accept`. `server.ClaimTask` checks identity/scope/collection and rejects only `assignee_id`, then `MultiStore` dispatches to `GitHubPassThroughStore.ClaimTask`, which applies the `working` label without evaluating availability.
- **Recommendation:** Enforce a shared claim policy before every backing store mutates claim state. Either require all stores to implement an availability/claimability interface and have `MultiStore` or `server.ClaimTask` call it, or implement the same policy inside `GitHubPassThroughStore.ClaimTask` before label mutation.

```go
func (s *GitHubPassThroughStore) ClaimTask(ctx context.Context, id uuid.UUID, assigneeID uuid.UUID, version string) (*ent.Task, error) {
    target, err := s.getOpenIssueByTaskID(ctx, id)
    if err != nil {
        return nil, err
    }
    current := s.issueToTask(target)
    availability, err := s.ComputeAvailability(ctx, current)
    if err != nil {
        return nil, err
    }
    if !availability.Available {
        return nil, store.ErrUnavailable
    }
    if current.Stage == task.StageTriage {
        return nil, store.ErrUnavailable
    }

    // Existing label-swap claim mutation follows only after policy passes.
}
```

#### [MEDIUM] Ent claim availability is checked before the write, not guarded atomically against blocker changes
- **Location:** `internal/store/entstore.go:904`
- **Description:** `EntStore.ClaimTask` loads the task and relationships, computes availability, then performs an update guarded by task ID, nil assignee, non-closed phase, and task version. The write predicate does not guard the availability inputs that live outside the claimed task row, especially blocker task stages. If a blocker is completed when availability is computed but concurrently reopened before the claim write commits, the claim can still succeed because the claimed task's version did not change.
- **Impact:** Authorized concurrent actions can create a persisted `working` claim on a task that is dependency-blocked at the time the claim finishes. This violates the "store claim transaction must guard the invariant under concurrency" requirement and can corrupt queue/claim semantics under realistic multi-agent races.
- **Proof of concept:** Task A is `accepted` and `blocked_by` task B. B is `completed`, so A appears available. Request 1 starts `ClaimTask(A)` and computes availability from B=`completed`. Request 2 reopens B to `accepted`. Request 1 then updates A because A's version/assignee/phase predicates still match, leaving A=`working` while B is unsatisfied.
- **Recommendation:** Move the availability check and the claim mutation into a single transaction and make the write fail if any unsatisfied blocker exists at write time. For SQLite/Postgres, this can be implemented as a transactional re-read plus conditional update, or a `NOT EXISTS` predicate over relationship/blocker rows in the claim update.

```go
tx, err := s.client.Tx(ctx)
if err != nil { return nil, err }
defer tx.Rollback()

old, err := tx.Task.Query().
    Where(task.IDEQ(id)).
    WithSourceRelationships().
    WithTargetRelationships().
    Only(ctx)
if err != nil { return nil, err }

availability, err := s.computeAvailabilityTx(ctx, tx, old)
if err != nil { return nil, err }
if !availability.Available { return nil, store.ErrUnavailable }

n, err := tx.Task.Update().
    Where(task.IDEQ(id), task.VersionEQ(old.Version), task.AssigneeIDIsNil()).
    SetAssigneeID(assigneeID).
    SetPhase(task.PhaseInProgress).
    SetStage(task.StageWorking).
    ClearHoldReason().
    Save(ctx)
```

#### [MEDIUM] Beads adapter status projection corrupts accepted tasks into external `blocked`
- **Location:** `internal/platform/beads/beads.go:319`
- **Description:** `phaseStageToStatus` has two consecutive `case stage == task.StageAccepted` branches. The first always returns `blocked`, making the second `deferred` branch unreachable. As a result, any accepted Farm Table task written through this adapter is projected to Beads as `blocked`, regardless of whether the task is merely accepted/available or held/deferred. The Beads JSONL import converter also still emits removed native stages (`ready`, `blocked`, `deferred`, `backlog`) at `internal/server/beads_import.go:99`, relying on the generic old-format migration path instead of normalizing at the adapter boundary.
- **Impact:** A user or agent with normal write/sync permissions can unintentionally mark available accepted Beads tasks as blocked in the external system. That can hide work from queues and downstream automation, creating an integrity and availability problem across the adapter boundary.
- **Recommendation:** Carry hold/source status into the Beads projection instead of deriving external status from `phase, stage` alone, and normalize JSONL import directly to `accepted` plus `hold_reason`/fidelity metadata.

```go
func phaseStageHoldToStatus(phase task.Phase, stage task.Stage, hold *task.HoldReason) string {
    switch {
    case phase == task.PhaseClosed:
        return "closed"
    case phase == task.PhaseInProgress || stage == task.StageWorking:
        return "in_progress"
    case hold != nil && *hold == task.HoldReasonDeferred:
        return "deferred"
    case hold != nil && *hold == task.HoldReasonWaitingForInput:
        return "blocked"
    default:
        return "open"
    }
}
```

### Positive Observations
- Native `ClaimTask` now rejects request-level `assignee_id` at `internal/server/server.go:714`, preserving self-assignment semantics for the Ent-backed path.
- Ent stage enums and server/CLI/MCP stage parsers no longer expose removed native stages as selectable native values.
- Store validation rejects hold reasons on triage/terminal stages and rejects contradictory `hold_reason=deferred` with future `start_date`.
- Import compatibility writes persistent `task_state_migration` change records with compact JSON old/new payloads for lossy old-state migrations.
- Focused state and adapter tests pass for the Ent-backed implementation and migration behavior.

### Commands and Results
- `git status --short --branch && git rev-parse --show-toplevel && git branch --show-current && git merge-base HEAD origin/main` -> branch `task-state-core`, root `/workspace`, merge-base `a2442ffa98fefc6fbb408e774344960e991f58cb`.
- `git diff --stat origin/main...HEAD` -> 66 files changed, 2787 insertions, 1243 deletions.
- `git diff --check origin/main...HEAD` -> pass.
- `rg -n 'Stage(Backlog|Ready|Blocked|WaitingForInput|Deferred|Scheduled)|TASK_STAGE_(BACKLOG|READY|BLOCKED|WAITING_FOR_INPUT|DEFERRED|SCHEDULED)|TaskStage\\.(BACKLOG|READY|BLOCKED|WAITING_FOR_INPUT|DEFERRED|SCHEDULED)'` -> no matches.
- `go test ./internal/store ./internal/server ./internal/platform/beads ./internal/platform/github ./internal/mcp ./internal/cli` -> store, platform/beads, platform/github, MCP, and CLI passed; server failed in `TestWatchTasks_CreatedEvent` with a timeout and `sql: database is closed`.
- `go test ./internal/server -run 'TestRPC_ImportCollection_MigratesOldTaskStatesWithNotes|TestBeadsStatusToPhaseStage|TestConvertBeadsToExportDocument|TestRPC_ClaimTask_RejectsTriageStage|TestScopedToken_AgentCanClaimAcceptedTask'` -> pass.
- `go test ./internal/store -run 'TestComputeAvailability|TestTaskStateValidation|TestClaimTask'` -> pass.
- `go test ./internal/platform/github -run 'Test.*Claim|TestCompute|TestMapLabels|TestIssueToPhaseStage'` -> pass.
- `go test ./internal/platform/beads -run 'TestStatusMapping|TestBeadsSyncIntegration'` -> pass.
- `npm audit --omit=dev` in `web/` -> `found 0 vulnerabilities`.
- `go list -m -json -mod=readonly all` -> pass, resolved module graph from committed Go module files.
- `go tool govulncheck ./...` -> not available in this Go toolchain (`go: no such tool "govulncheck"`).

### Residual Risk
- I did not run the full `go test ./...` suite after the focused package failure; the focused state/security tests above passed.
- Web UI redesign was out of scope for this security audit, but remaining UI/client-side ready terminology should be reviewed in the phase 3 work.
- The import path accepts removed stage strings in both format versions and migrates them rather than rejecting them for `format_version: 2`. This does not persist invalid native state, but it is stricter to reject removed native stages in new-format imports unless explicitly declared as adapter/legacy data.
