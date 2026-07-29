# Agent Task Lifecycle — Assignment, Audit, and Workflow Improvements

## Context

During a dogfooding experiment (2026-05-09), we assigned a critical graph traversal bug directly to a developer agent using Farm Table as the task brief. The agent received a one-sentence prompt plus a task ID, read the full bug report via `ft task get`, fixed it in 2 minutes, closed the task, and pushed the commit.

**What worked:** Task-as-brief is powerful. The `ft task get` description contained root cause, affected file locations, and fix pattern — the agent needed nothing else. The tool replaced the traditional task brief document entirely.

**What didn't work:** The agent skipped `ft task claim` despite being told to claim the task. The completed task has no assignee. No stage transitions occurred (went from `triage` directly to `completed`, skipping `working`). The audit trail doesn't reflect who did the work.

## Analysis

### Why agents skip ceremony

Developer agents optimize for the stated goal (fix the bug) and drop steps that feel like bookkeeping. This is predictable and should be designed around, not fought. `ft task claim` and `ft task update --stage working` are overhead the agent sees no value in — the agent doesn't check the board, doesn't coordinate with teammates via stage visibility, and doesn't care about audit trail.

### Who should own assignment: coordinator vs developer?

| Approach | Pros | Cons |
|----------|------|------|
| **Coordinator assigns (push)** | Reliable — coordinator is already deciding delegation. Immediate visibility. Matches actual authority model. | Coordinator needs agent identity. Extra step before `scion start`. |
| **Developer claims (pull)** | Auth-verified via C2 token. Self-service. | Unreliable — agents skip it. Window where task appears unassigned. |
| **Auto-assign on close** | Zero friction. Safety net. | No in-progress visibility. After-the-fact. |

**Recommendation: Coordinator assigns at delegation time. Tool auto-captures on close as safety net.**

The coordinator is the reliable actor. It's the one making the delegation decision and starting the agent. Recording that decision in the tool is a natural extension of the delegation workflow, not extra ceremony.

### Proposed tool improvements

#### 1. `ft task assign <id> <agent-name>` — Shorthand command

Combines setting assignee + moving stage to `working` in one atomic step. Reduces coordinator friction from two flags to one command.

```
ft task assign <task-id> <agent-name>
# equivalent to: ft task update <id> --assignee <agent-name> --stage working
```

**Technical dependency:** Requires AUTH-1 (token→user mapping) — already completed. No other blockers.  
**Parent stream:** CLI Polish (Stream 4)

#### 2. Auto-assign on `ft task close` — Implicit audit capture

When `ft task close` is called by an authenticated user (C2 token present) and the task has no assignee, auto-set the closer as assignee. The identity is already resolved in the gRPC context via the auth interceptor — this is just using it.

```go
// In CloseTask handler, after resolving user from context:
if task.Assignees == nil || len(task.Assignees) == 0 {
    // auto-assign the closer
}
```

**Technical dependency:** Requires AUTH-1 (completed) and AUTH-2 (completed). The auth context propagation is already wired. This is a small enhancement to CloseTask logic.  
**Parent stream:** Identity & Auth (Stream 1)  
**Relationship to REM-8 (CloseTask re-close guard):** Independent — REM-8 prevents re-closing, this adds auto-assignment. Could be implemented together since both touch CloseTask.

#### 3. Record actor identity on all mutations — Audit trail completeness

Verify that the change audit trail (Wave 2 Track B) captures the authenticated user ID on CloseTask, UpdateTask, and other mutations. AUTH-2 wired context propagation, but we should verify the change records actually include the actor ID from the C2 token, not `uuid.Nil`.

**Technical dependency:** AUTH-1 + AUTH-2 (both completed).  
**Parent stream:** Identity & Auth (Stream 1)

#### 4. `ft task ready` UX — Surface `--include-unblocked` on zero results

When `GetReadyTasks` returns 0 results and the collection has unblocked tasks in `triage`/`backlog`, print a hint: "0 ready tasks. Use `--include-unblocked` to include triage/backlog tasks with no blockers."

**Technical dependency:** None — purely CLI output formatting.  
**Parent stream:** CLI Polish (Stream 4)  
**Related bug:** c7b6188a (GetReadyTasks returns 0 for triage-stage tasks)

## How these fit into the existing task graph

### Dependency analysis

```
AUTH-1 (completed) ──→ AUTH-2 (completed)
                           │
                           ├──→ [NEW] Auto-assign on close
                           ├──→ [NEW] Verify actor ID in change records
                           └──→ AUTH-4: ft task claim --assignee override
                                    │
                                    └──→ [NEW] ft task assign shorthand
                                         (assign is claim from coordinator's
                                          perspective — same underlying mechanism)

(no dependency)      ──→ [NEW] ft task ready UX hint
```

- **Auto-assign on close** depends on AUTH-1 + AUTH-2 (both done). Can start immediately.
- **Verify actor in change records** depends on AUTH-1 + AUTH-2 (both done). Can start immediately.
- **`ft task assign` shorthand** is closely related to AUTH-4 (`ft task claim --assignee override`). They may be the same task — `assign` is `claim` from the coordinator's perspective. AUTH-4 should be expanded to include the `assign` shorthand, or they should be sibling tasks under Stream 1.
- **`ft task ready` UX hint** has no dependencies. Can start immediately.

### Do these block other work?

To determine blocking relationships, ask: "What future work would produce wrong or incomplete results without this improvement?"

| Improvement | Blocks | Rationale |
|-------------|--------|-----------|
| Auto-assign on close | Nothing critical | Safety net — nice to have but doesn't gate other features |
| Verify actor in change records | Stream 5 integrations (sync audit trail to external platforms) | If change records have `uuid.Nil` actors, synced audit data is meaningless |
| `ft task assign` shorthand | Nothing — convenience only | The underlying `ft task update --assignee` already works |
| `ft task ready` UX hint | Nothing — usability only | Doesn't affect programmatic API |

The one potential blocker is **actor identity in change records**. If we ship integrations (Linear sync, GitHub sync) that replicate change history to external platforms, the actor field needs to be correct. This should be verified before integrations go live.

### Recommended insertion into the graph

1. **Expand AUTH-4** to include the `ft task assign` shorthand (or create a sibling task under Stream 1)
2. **Create a new work-task** for auto-assign on close, parent to Stream 1, no blockers
3. **Create a new work-task** for audit actor verification, parent to Stream 1, blocks Stream 5 integrations
4. **Attach the `ft task ready` UX hint** to the existing bug c7b6188a (GetReadyTasks returns 0), parent to Stream 4

## Design principle

> Farm Table is a task runtime *for agents*. Agents are reliable at doing work and unreliable at ceremony. The tool should capture identity and state transitions automatically through auth context, not through explicit agent actions. Push assignment up to the coordinator, push audit capture down to the tool.
