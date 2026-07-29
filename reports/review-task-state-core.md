# Task State Core Review

## Executive Summary

Risk level: HIGH. The branch makes substantial progress on the core task-state vocabulary and passes the available Go/web verification, but it has correctness regressions in adapter normalization/read models and does not yet enforce the claim availability invariant atomically under concurrent state or relationship changes.

Verdict: REQUEST CHANGES.

## Critical Issues

- [internal/store/entstore.go:921](/workspace/internal/store/entstore.go:921) Availability is computed before the claim update, but the update predicate only guards `id`, `assignee_id`, `phase`, and `version` at [internal/store/entstore.go:933](/workspace/internal/store/entstore.go:933). A relationship insert, blocker status change, hold, or future start-date update can make the task unavailable after `ComputeAvailability` and before `Save`, while the claim still succeeds because the final write does not re-check the availability predicates inside the same transaction. This violates the contract requirement that claim-by-ID cannot bypass computed availability and that the store claim transaction guards the invariant under concurrency.

Suggested Fix:

```go
// Perform claim in a transaction and make the final update conditional on
// the same task-row availability predicates. Recompute dependency availability
// inside the transaction immediately before Save, or lock/read the relevant
// task and relationship rows if the selected DB supports it.
tx, err := s.client.Tx(ctx)
// ...
old, err := tx.Task.Query().
    Where(task.IDEQ(id)).
    WithSourceRelationships().
    WithTargetRelationships().
    Only(ctx)
availability, err := computeAvailabilityTx(ctx, tx, old)
if !availability.Available {
    return nil, ErrUnavailable
}
n, err := tx.Task.Update().
    Where(
        task.IDEQ(id),
        task.AssigneeIDIsNil(),
        task.StageEQ(task.StageAccepted),
        task.HoldReasonIsNil(),
        task.StartDateIsNil(), // or StartDateLTE(now) as appropriate
        task.VersionEQ(old.Version),
    ).
    SetAssigneeID(assigneeID).
    SetPhase(task.PhaseInProgress).
    SetStage(task.StageWorking).
    ClearHoldReason().
    Save(ctx)
```

- [internal/platform/beads/beads.go:323](/workspace/internal/platform/beads/beads.go:323) `phaseStageToStatus` now maps every `StageAccepted` task to Beads `"blocked"`, and the next `StageAccepted` branch for `"deferred"` is unreachable. This means a normal open/accepted Farm Table task exported back to Beads is reported as blocked, while deferred cannot be represented. That breaks adapter normalization and can corrupt external status on sync.

Suggested Fix:

```go
func phaseStageToStatus(phase task.Phase, stage task.Stage, holdReason *task.HoldReason) string {
    switch {
    case phase == task.PhaseClosed:
        return "closed"
    case phase == task.PhaseInProgress || stage == task.StageWorking:
        return "in_progress"
    case holdReason != nil && *holdReason == task.HoldReasonDeferred:
        return "deferred"
    default:
        return "open"
    }
}
```

- [internal/platform/github/treewalk.go:121](/workspace/internal/platform/github/treewalk.go:121) GitHub treewalk now treats every accepted open issue as explicitly blocked, and [internal/platform/github/treewalk.go:145](/workspace/internal/platform/github/treewalk.go:145) treats every accepted child as a transitive blocker. Since accepted is the normal open state, `computeBlocked` will over-report ordinary tasks as blocked and make graph results unusable for GitHub collections.

Suggested Fix:

```go
// Do not infer explicit blockage from StageAccepted. Preserve the external
// blocked label/status separately during import, or derive blocked results only
// from open child/dependency relationships.
if hasExternalBlockedSignal(node) {
    // report explicit external block
}
```

## Important Issues

- [internal/store/entstore.go:2194](/workspace/internal/store/entstore.go:2194) `GetReadyTasksParams.IncludeUnblockedOpen` is still accepted at [internal/store/store.go:347](/workspace/internal/store/store.go:347) and passed from the RPC at [internal/server/server.go:1512](/workspace/internal/server/server.go:1512), but the store implementation ignores it entirely. The CLI/MCP help says `--include-unblocked` shows unblocked open tasks that are not currently claimable, so callers now get the same result whether the flag is set or not.

Suggested Fix:

```go
if p.IncludeUnblockedOpen {
    q = q.Where(task.PhaseEQ(task.PhaseOpen))
} else {
    q = q.Where(task.PhaseEQ(task.PhaseOpen), task.StageEQ(task.StageAccepted), task.HoldReasonIsNil())
}
```

Then keep the per-row availability classification so non-claimable open tasks are returned only for the compatibility mode with clear reason codes.

- [internal/server/beads_import.go:103](/workspace/internal/server/beads_import.go:103) The Beads JSONL conversion path still emits old native stage strings (`ready`, `blocked`, `deferred`, `backlog`) into the intermediate Farm Table export document. The later import migration currently cleans those up, but this means a new Beads import still depends on old-format migration semantics instead of normalizing at the adapter boundary, and it also writes migration notes for brand-new adapter data rather than preserving external status as adapter fidelity metadata.

Suggested Fix:

```go
case "open":
    return "open", "accepted"
case "blocked":
    return "open", "accepted" // plus native_label or remote_data status fidelity
case "deferred":
    return "open", "accepted" // plus hold_reason=deferred in the export task
case "pinned":
    return "open", "accepted"
```

- [.agents/skills/farmtable/SKILL.md:30](/workspace/.agents/skills/farmtable/SKILL.md:30) and [docs/architecture.md:76](/workspace/docs/architecture.md:76) document `ON_HOLD` as a native projection for accepted tasks with hold reasons. The contract says native Farm Table tasks should not project to `ON_HOLD`; holds should use the underlying stage plus `hold_reason`, with `ON_HOLD` retained only as compatibility for external statuses that cannot yet be represented.

Suggested Fix: Update these docs to state that native `phase` projects to `OPEN`, `IN_PROGRESS`, or `CLOSED`, while `ON_HOLD` is compatibility-only for external normalized statuses.

## Suggestions

- [internal/server/graph_routing_test.go:271](/workspace/internal/server/graph_routing_test.go:271), [internal/server/transitions_test.go:19](/workspace/internal/server/transitions_test.go:19), and similar changed test comments still use old vocabulary such as "ready stage", "backlog", and "scheduled" for cases that now pass `StageAccepted`. These are not functional blockers, but they weaken the vocabulary-survival evidence and make future reviewers re-verify whether the old value is actually still selectable.

## Positive Feedback

- The native enum and generated artifacts consistently remove the deleted stage constants from the core proto/Ent/client surfaces.
- Store validation covers hold-reason stage constraints and the future `start_date` versus `hold_reason=deferred` conflict, including focused tests.
- `ClaimTaskRequest.assignee_id` is rejected at the RPC boundary, and normal claim now self-assigns the authenticated actor.
- Import migration notes use persistent `task_state_migration` change records with compact JSON old/new payloads and a system migration actor.

## Verification

- `git diff --stat origin/main...HEAD`: 66 files changed, 2787 insertions, 1243 deletions.
- `rg -n 'Stage(Backlog|Ready|Blocked|WaitingForInput|Deferred|Scheduled)|TASK_STAGE_(BACKLOG|READY|BLOCKED|WAITING_FOR_INPUT|DEFERRED|SCHEDULED)|TaskStage\.(BACKLOG|READY|BLOCKED|WAITING_FOR_INPUT|DEFERRED|SCHEDULED)' api proto internal web/src DRAFT-schema.json`: no matches.
- `rg -n 'stage ready|ready stage|triage and backlog|backlog|scheduled|\bblocked\b|waiting_for_input|deferred' proto api/farmtable/v1/farmtable.pb.go internal/cli internal/mcp .agents/skills/farmtable docs/architecture.md README.md agents.md`: remaining matches include expected graph/relationship terms and valid hold reasons, plus stale comments/docs called out above.
- `go test ./...`: pass.
- `go build ./...`: pass.
- `go generate ./internal/store/ent`: pass and left no generated diff.
- `npm run build` in `web/`: pass; Vite reported the existing chunk-size warning.
- `git diff --check origin/main...HEAD`: pass.
- `buf generate`: not run because `buf` is not installed in this container (`zsh: command not found: buf`).

## Residual Risks

- I did not run Postgres-tagged integration tests; the available untagged Go suite passed.
- Existing database row migration outside import/export was not proven by a dedicated migration test in this review. Because Ent enum validators only guard writes, add explicit migration coverage before relying on production upgrades with pre-existing `ready`/`blocked`/`scheduled` rows.
- Availability on list responses computes dependency reasons through per-row graph checks; this is acceptable for phase 1 but may need a read-model optimization if queue sizes grow.

## Final Verdict

REQUEST CHANGES. Fix the adapter status regressions, the GitHub blocked read model, and the atomic claim availability gate before merge; then rerun the same verification commands plus `buf generate` in an environment with `buf` installed.
