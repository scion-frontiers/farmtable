# Wave 2 — Graph RPCs + Change Audit Trail

**Date:** 2026-05-03
**Input:** Wave 1 completion, proto definitions for Graph RPCs and Change entity
**Goal:** Implement graph intelligence queries and automatic change tracking on mutations.

---

## Track A: Graph RPCs — Single Agent

Implement the 5 graph query RPCs currently stubbed as Unimplemented in `internal/server/server.go`. These queries use the Relationship entity (source_task_id, target_task_id, type) wired in Wave 1.

### A1. GetReadyTasks

**Proto:** `GetReadyTasksRequest` → `GetReadyTasksResponse` (repeated `ReadyTask`)

A "ready" task is one that:
- Has stage = READY (or optionally TRIAGE/BACKLOG if `include_unblocked_open` is true)
- Has NO unresolved blockers (no "blocked_by" relationships pointing to non-closed tasks)

**Implementation approach:**

1. Query tasks in the appropriate stages
2. For each task, check its "blocked_by" relationships (via `target_relationships` edge where type = "blocked_by", or `source_relationships` where type = "blocks" pointing TO this task)
3. A blocker is "resolved" if the blocking task's phase is CLOSED
4. Filter to tasks where all blockers are resolved (or no blockers exist)
5. Populate `blockers_resolved` count on each ReadyTask

**Store method:** Add `GetReadyTasks(ctx, GetReadyTasksParams) ([]*ReadyTaskResult, int, error)` to the Store interface and implement in entstore.go.

```go
type GetReadyTasksParams struct {
    CollectionID       *uuid.UUID
    AssigneeID         *uuid.UUID
    Unassigned         bool
    MinPriority        *task.Priority
    IncludeUnblockedOpen bool
    Limit              int
    Offset             int
}

type ReadyTaskResult struct {
    Task              *ent.Task
    BlockersResolved  int
}
```

**Filter support:** `collection_id`, `assignee` ("none" for unassigned, UUID for specific), `min_priority`.

**Server handler:** Replace the stub in server.go. Wire request params, call store, convert results to proto.

### A2. GetBlockedTasks

**Proto:** `GetBlockedTasksRequest` → `GetBlockedTasksResponse` (repeated `BlockedTask` with `BlockerInfo`)

A "blocked" task has at least one "blocked_by" relationship pointing to a non-closed task.

**Implementation:**

1. Query non-closed tasks that have "blocked_by" relationships
2. For each, load the blocking tasks and filter to non-closed ones
3. Return the task + list of `BlockerInfo` (task_id, name, phase, stage)

**Store method:** `GetBlockedTasks(ctx, GetBlockedTasksParams) ([]*BlockedTaskResult, int, error)`

```go
type GetBlockedTasksParams struct {
    CollectionID *uuid.UUID
    AssigneeID   *uuid.UUID
    Unassigned   bool
    Limit        int
    Offset       int
}

type BlockerInfoResult struct {
    TaskID uuid.UUID
    Name   string
    Phase  task.Phase
    Stage  task.Stage
}

type BlockedTaskResult struct {
    Task     *ent.Task
    Blockers []BlockerInfoResult
}
```

### A3. GetDependencyTree

**Proto:** `GetDependencyTreeRequest` → `GetDependencyTreeResponse` (recursive `DependencyNode`)

Given a task ID, traverse the relationship graph up to `max_depth` (default 5, max 20).

**Implementation:**

1. Load the root task
2. Recursively follow "blocks" relationships (tasks this task blocks) for downstream
3. Recursively follow "blocked_by" relationships for upstream
4. Respect `direction` param: UP (only blocked_by), DOWN (only blocks), BOTH
5. Use a visited set to prevent cycles
6. Cap at `max_depth`

**Store method:** This is better implemented at the server layer since it's a graph traversal algorithm that calls GetTask and queries relationships iteratively. The store just needs the existing relationship queries.

**Server implementation:**
```go
func (s *FarmTableService) GetDependencyTree(ctx context.Context, req *pb.GetDependencyTreeRequest) (*pb.GetDependencyTreeResponse, error) {
    // Parse task ID
    // Set maxDepth (default 5)
    // Build DependencyNode recursively
    // Track visited set to prevent cycles
}
```

### A4. GetCriticalPath

**Proto:** `GetCriticalPathRequest` → `GetCriticalPathResponse` (repeated `CriticalPathNode` + `Bottleneck`)

The critical path is the longest chain of blocking dependencies. Starting from a root task (or scanning all tasks in a collection), find the longest sequence of `blocks` relationships where tasks are not yet closed.

**Implementation:**

1. If `root_task_id` is provided, start from that task; otherwise scan all non-closed tasks in the collection
2. For each starting task, follow "blocks" edges (downstream) using DFS
3. Track the longest path
4. Identify the bottleneck: the task on the critical path with the highest fan-out

**Server implementation:** Build on the same graph traversal pattern as GetDependencyTree.

### A5. GetBottlenecks

**Proto:** `GetBottlenecksRequest` → `GetBottlenecksResponse` (repeated `BottleneckTask`)

Find tasks with the highest fan-out — tasks that block the most other tasks (directly and transitively).

**Implementation:**

1. Query all non-closed tasks in the collection that have "blocks" relationships
2. For each, count direct dependents (tasks directly blocked by this task)
3. For each, count transitive downstream count (all tasks reachable via "blocks" chains)
4. Sort by downstream_count descending
5. Return top N (per `limit`, default 10)

### A6. Tests

**File:** `internal/server/server_test.go` — add:
- `TestRPC_GetReadyTasks` — create tasks with and without blockers, verify only unblocked ones returned
- `TestRPC_GetBlockedTasks` — create task blocked by another, verify blocker info
- `TestRPC_GetDependencyTree` — create A blocks B blocks C, verify tree structure
- `TestRPC_GetReadyTasks_ResolvedBlockers` — close a blocker, verify blocked task becomes ready
- `TestRPC_GetBottlenecks` — create task blocking multiple others, verify fan-out count

### Constraints
- Add new store methods at the END of store.go and entstore.go (Track B modifies existing methods)
- All existing tests must pass
- Use existing relationship edge loading patterns from Wave 1
- Do NOT modify proto or generated code

---

## Track B: Change Audit Trail (M4) — Single Agent

Record Change entities automatically when task fields are mutated. The Change schema already exists with task_id, author_id, field_name, old_value, new_value, created_at.

### B1. Add a recordChanges helper

**File:** `internal/store/entstore.go`

Add a helper that compares old and new task states and creates Change records:

```go
func (s *EntStore) recordChanges(ctx context.Context, taskID, authorID uuid.UUID, old, new *ent.Task) error {
    changes := diffTask(old, new)
    for _, c := range changes {
        _, err := s.client.Change.Create().
            SetTaskID(taskID).
            SetAuthorID(authorID).
            SetFieldName(c.Field).
            SetOldValue(c.OldValue).
            SetNewValue(c.NewValue).
            Save(ctx)
        if err != nil {
            return fmt.Errorf("recording change for %s: %w", c.Field, err)
        }
    }
    return nil
}

type fieldChange struct {
    Field    string
    OldValue string
    NewValue string
}

func diffTask(old, new *ent.Task) []fieldChange {
    var changes []fieldChange
    if old.Title != new.Title {
        changes = append(changes, fieldChange{"title", old.Title, new.Title})
    }
    if old.Description != new.Description {
        changes = append(changes, fieldChange{"description", old.Description, new.Description})
    }
    if old.Phase != new.Phase {
        changes = append(changes, fieldChange{"phase", string(old.Phase), string(new.Phase)})
    }
    if old.Stage != new.Stage {
        changes = append(changes, fieldChange{"stage", string(old.Stage), string(new.Stage)})
    }
    // ... priority, assignee_id, type, native_label, parent_task_id, etc.
    return changes
}
```

Compare all meaningful fields: title, description, phase, stage, native_label, type, priority, assignee_id, parent_task_id, start_date, due_date, repo, branch, ci_status.

For pointer/nullable fields, handle nil vs non-nil transitions (e.g., priority set vs cleared).

### B2. Integrate into UpdateTask

**File:** `internal/store/entstore.go` — `UpdateTask` method

Read the task state BEFORE the update (already done in the version-empty path; need to also read in the version-provided path). After the update succeeds, read the new state (already done via `getTaskWithEdges`). Call `recordChanges` between old and new.

```go
func (s *EntStore) UpdateTask(ctx context.Context, id uuid.UUID, p UpdateTaskParams) (*ent.Task, error) {
    // Read old state FIRST (needed for both CAS and change tracking)
    old, err := s.client.Task.Get(ctx, id)
    if err != nil { ... }

    // ... existing update logic ...

    // After update succeeds, read new state
    result, err := s.getTaskWithEdges(ctx, id)
    if err != nil { return nil, err }

    // Record changes (use a zero UUID for author since we don't have auth context yet)
    _ = s.recordChanges(ctx, id, uuid.Nil, old, result)

    return result, nil
}
```

Note: author_id is uuid.Nil for now since C2 (agent identity from auth context) is deferred. This is fine — the field exists and will be populated once auth context is wired.

### B3. Integrate into ClaimTask

Record changes for: phase (→ in_progress), stage (→ working), assignee_id (→ new assignee).

```go
// In ClaimTask, after successful update:
_ = s.recordChanges(ctx, id, assigneeID, old, result)
```

Here we DO have the assigneeID from the claim request, so use it as the author.

### B4. Integrate into CloseTask

Record changes for: phase (→ closed), stage (→ completed/wont_fix/etc.), closed_at.

```go
// In CloseTask, after successful update:
_ = s.recordChanges(ctx, id, uuid.Nil, old, result)
```

### B5. Tests

**File:** `internal/store/entstore_test.go` — add:
- `TestUpdateTask_ChangesRecorded` — update a task's title and stage, verify Change records created with correct old/new values
- `TestClaimTask_ChangesRecorded` — claim a task, verify phase/stage/assignee changes recorded
- `TestCloseTask_ChangesRecorded` — close a task, verify phase/stage/closed_at changes recorded
- `TestListChanges_FieldFilter` — verify filtering by field_name works

**File:** `internal/server/server_test.go` — add:
- `TestRPC_UpdateTask_AuditTrail` — update via RPC, then ListChanges, verify records

### Constraints
- Only modify EXISTING methods in entstore.go (UpdateTask, ClaimTask, CloseTask) + add new helpers
- Do NOT add new methods to the Store interface (recordChanges is internal to EntStore)
- Do NOT modify server.go (ListChanges RPC already works)
- Use uuid.Nil for author_id where auth context is not available
- Audit trail recording should not fail the mutation — use best-effort (log errors but don't return them to caller)
- All existing tests must pass

---

## Coordination

- **Track A and Track B run in parallel** — Track A adds NEW methods at end of files, Track B modifies EXISTING methods
- Track A: touches server.go (replace stubs), store.go (new interface methods), entstore.go (new methods at end)
- Track B: touches entstore.go (modify UpdateTask/ClaimTask/CloseTask, add helpers), entstore_test.go (new tests)
- Overlap in entstore.go is minimal: Track A appends new methods, Track B modifies existing ones and adds helpers
- Both must pass `go build ./...` and all tests
