# Cyclic Graph Investigation

## Current State

Farm Table does not enforce dependency relationships as a DAG. The relationship
schema stores `source_task_id`, `target_task_id`, and an enum `type` with static
values `blocks`, `blocked_by`, `relates_to`, `duplicates`, and `duplicated_by`;
the only uniqueness constraint is `(source_task_id, target_task_id, type)`
(`internal/store/schema/relationship.go:15`, `internal/store/schema/relationship.go:40`).
The task schema has phase/stage fields and metadata such as `ci_status`, but no
gate/decision-node model and no conditional edge fields
(`internal/store/schema/task.go:21`, `internal/store/schema/task.go:51`).

Relationship creation also does not check for cycles. `CreateTask` and
`UpdateTask` only check whether an identical edge already exists before inserting
`blocks` or `blocked_by` rows (`internal/store/entstore.go:159`,
`internal/store/entstore.go:180`, `internal/store/entstore.go:497`,
`internal/store/entstore.go:518`). There is no lookup from the target back to
the source, no topological validation, and no database constraint that prevents
A -> B plus B -> A or longer cycles. The expected behavior is that circular
relationships can be persisted.

The graph RPCs are mostly cycle-tolerant:

- `GetReadyTasks` and `GetBlockedTasks` do not traverse the graph; they inspect
  direct blockers on each task and treat a non-closed blocker as blocking
  (`internal/store/entstore.go:1335`, `internal/store/entstore.go:1396`). A
  two-task cycle leaves both tasks blocked until one side is closed or the edge
  is removed.
- `GetDependencyTree` caps `max_depth` to 20 and uses a shared `visited` set, so
  cycles terminate rather than recursing forever (`internal/server/server.go:1039`,
  `internal/server/server.go:1052`, `internal/server/server.go:1061`).
- `GetCriticalPath` loads up to 500 open/in-progress/on-hold tasks, then calls
  `findLongestBlocksChain`, which has both an `onStack` cycle guard and
  `maxGraphDepth` of 50 (`internal/server/server.go:1156`,
  `internal/server/server.go:1230`, `internal/server/server.go:1232`). Cyclic
  branches are truncated, not reported as cycles.
- `GetBottlenecks` has the same 500-task load cap and counts downstream nodes
  with a `visited` set plus `maxGraphDepth` (`internal/server/server.go:1289`,
  `internal/server/server.go:1344`, `internal/server/server.go:1383`).

Verification run: `go test ./internal/store ./internal/server` passes.

## Gap Analysis

A conditional loop like "run tests; if failed, route back to rework; if passed,
deploy" is not just a directed cycle. It needs runtime routing semantics that
Farm Table does not currently model:

- A gate or decision-node concept whose result can choose the next path.
- Conditional edges with predicates such as `ci_status == failed` or `passed`.
- An execution/routing state machine that determines when an edge becomes active.
- UI/API semantics for showing the inactive branch without treating it as a live
  blocker.

Current relationship types are static dependency facts. `blocks` means one task
prevents another from becoming ready until the blocker closes; it cannot mean
"sometimes route to this task depending on test result." Adding a literal cycle
with today's `blocks` edges would likely create permanent mutual blocking rather
than a repeatable workflow loop.

## Workarounds

The stage/phase model can represent iterative work without schema changes.
Tasks can move backward through stages such as `working`, `in_review`, `in_qa`,
`blocked`, and `ready` (`internal/store/schema/task.go:24`). A coordinator or
agent can run tests, inspect the outcome, and update stages:

- If tests fail: reopen or move the implementation task back to `working`, set
  the gate/test task back to `ready` or `blocked`, and optionally create a new
  rework task linked by static relationships.
- If tests pass: close the test/gate task and unblock downstream deploy work.
- Use `ci_status` on tasks as a simple state signal for test outcomes
  (`internal/store/schema/task.go:51`).

This is viable today when the loop is operational rather than declarative. The
task graph remains an acyclic plan or a set of static blockers, while an agent or
external workflow engine performs the conditional routing by changing task
state. The trade-off is that Farm Table cannot natively visualize or validate
the loop as a first-class workflow.

## Design Options

### Option A: Allow Cycles and Harden Graph RPCs

Keep the relationship schema permissive, explicitly document that cycles are
valid, and improve graph RPC output so callers can see where traversal was
truncated due to a visited node or depth cap.

Pros: Smallest schema change; current traversal code is already guarded; useful
for generic graph visualization.

Cons: Does not solve conditional routing; direct ready/blocked semantics still
make dependency cycles operationally awkward; critical path and bottleneck
metrics become approximate unless cycles are modeled explicitly in responses.

### Option B: Add Conditional Edge Types

Extend relationships with fields such as `condition`, `condition_source`,
`active_when`, or a new relationship type like `routes_to`. Gate tasks would set
state, and graph queries would distinguish active blockers from inactive
conditional routes.

Pros: Native representation of workflow branches and loops; APIs can explain why
a route is active; UI can show gate outcomes and loopback paths.

Cons: Medium/Large change. It requires schema migration, proto/API changes,
query semantics, validation rules, UI affordances, and a condition language.
Without a clear product model for gate execution, this risks becoming a partial
workflow engine.

### Option C: Keep DAG Semantics, Model Loops via State/Re-Creation

Treat dependency edges as static blockers and keep workflow iteration in task
state transitions. On failure, reopen or recreate rework/test tasks; on success,
close the gate and advance dependents. Agents or integrations own the loop
policy.

Pros: Fits current architecture best; avoids overloading dependency edges; keeps
ready/blocked queries simple; works with existing phase/stage and `ci_status`
fields.

Cons: Loops are not visible as declarative graph edges; history may be spread
across task changes or repeated tasks; users need orchestration conventions.

## Recommendation

Recommend Option C for near-term support. Farm Table's existing model is a task
dependency and lifecycle tracker, not a workflow engine. Conditional loops are
better represented today by agent-orchestrated task state changes, using static
relationships only for real blockers. This keeps the graph useful for readiness,
critical path, and bottlenecks while still supporting iterative workflows.

If native loop visualization becomes a product requirement, start with Option A's
cycle reporting improvements before Option B. Explicit cycle metadata in graph
responses would make today's permissive schema safer and would provide a
foundation for later conditional routes.

## Open Questions

- Should Farm Table formally permit cycles in dependency relationships, or should
  creation/update reject new cycles to preserve DAG assumptions?
- Does the product need to visualize workflow loops, or is operational support
  through agents and task stage changes enough?
- What entities are allowed to evaluate gate conditions: agents, CI integrations,
  users, or Farm Table server logic?
- If conditional edges are added, should conditions be limited to known task
  fields like `ci_status` and `stage`, or support an extensible expression model?
