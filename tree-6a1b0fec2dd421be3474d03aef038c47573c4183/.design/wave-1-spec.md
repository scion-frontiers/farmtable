# Wave 1 — Field Completeness + Platform Adapter Scaffolding

**Date:** 2026-05-03
**Input:** `.design/hardening-sprint.md` (Batch 3), code audit of current implementation gaps
**Goal:** Wire all proto-defined fields through the store and server layers. Begin GitHub Issues integration.

---

## Track A: Batch 3 Core (M1 + M2) — Single Agent

Wire the remaining proto fields through store params, Ent schema, entstore implementation, server handlers, and convert layer. This makes the API functionally complete for built-in backend workflows.

### A1. Add missing fields to Ent Task schema

**File:** `internal/store/schema/task.go`

Add these fields to the Task schema:

```go
field.JSON("labels", []string{}).Optional(),
field.String("repo").Optional().Default(""),
field.String("branch").Optional().Default(""),
field.Enum("ci_status").
    Values("unknown", "pending", "running", "passed", "failed").
    Optional().
    Nillable(),
field.JSON("pull_requests", []map[string]string{}).Optional(),
```

**Important:** After changing the schema, regenerate Ent code with `go generate ./internal/store/ent`. The Makefile may have a target for this — check `make generate` or similar. If not, run `go generate` directly.

### A2. Extend store params for dates, labels, code_context, relationships

**File:** `internal/store/store.go`

Update `CreateTaskParams`:
```go
type CreateTaskParams struct {
    // ... existing fields ...
    Labels           []string
    StartDate        *time.Time
    DueDate          *time.Time
    // Relationships to create alongside the task
    BlocksTaskIDs    []uuid.UUID
    BlockedByTaskIDs []uuid.UUID
    // Code context
    Repo             string
    Branch           string
}
```

Update `UpdateTaskParams`:
```go
type UpdateTaskParams struct {
    // ... existing fields ...
    // Date management
    StartDate      *time.Time
    ClearStartDate bool
    DueDate        *time.Time
    ClearDueDate   bool
    // Label management
    AddLabels      []string
    RemoveLabels   []string
    // Relationship management
    AddBlocks         []uuid.UUID
    AddBlockedBy      []uuid.UUID
    RemoveRelationships []uuid.UUID
    // Code context
    Repo    *string
    Branch  *string
    ClearRepo   bool
    ClearBranch bool
    AddPullRequests []PullRequestParam
    CIStatus        *string
    ClearCIStatus   bool
    // Reason (for audit trail, passed through)
    Reason *string
}

type PullRequestParam struct {
    ID     string
    URL    string
    Status string
}
```

Update `ListTasksParams`:
```go
type ListTasksParams struct {
    // ... existing fields ...
    Priority     *task.Priority
    Type         *string
    Labels       []string      // AND semantics: task must have all listed labels
    ParentTaskID *uuid.UUID
    SortField    string        // "created", "updated", "priority", "due_date"
    SortOrder    string        // "asc", "desc"
}
```

### A3. Implement store methods for new fields

**File:** `internal/store/entstore.go`

#### CreateTask — wire dates, labels, code context
Set StartDate, DueDate, Labels, Repo, Branch on the create builder when provided.

After creating the task, create Relationship records for `BlocksTaskIDs` and `BlockedByTaskIDs`:
```go
for _, targetID := range p.BlocksTaskIDs {
    _, err := s.client.Relationship.Create().
        SetSourceTaskID(t.ID).
        SetTargetTaskID(targetID).
        SetType(relationship.TypeBlocks).
        Save(ctx)
    // handle error
}
```

#### UpdateTask — wire dates, labels, code context, relationships

For dates:
```go
if p.ClearStartDate {
    update.ClearStartDate()
} else if p.StartDate != nil {
    update.SetStartDate(*p.StartDate)
}
// same pattern for DueDate
```

For labels (requires read-modify-write since Ent doesn't have array append):
```go
if len(p.AddLabels) > 0 || len(p.RemoveLabels) > 0 {
    cur, err := s.client.Task.Get(ctx, id)
    // merge labels in Go: add new, remove old
    // set merged result on update
}
```

For relationships: create/delete Relationship records.

For code context: set repo, branch, ci_status fields. For pull_requests, read-modify-write the JSON array.

#### ListTasks — add filter and sort support

Add these predicates:
```go
if p.Priority != nil {
    q = q.Where(task.PriorityEQ(*p.Priority))
}
if p.Type != nil {
    q = q.Where(task.TypeEQ(*p.Type))
}
if p.ParentTaskID != nil {
    q = q.Where(task.ParentTaskIDEQ(*p.ParentTaskID))
}
```

For label filtering (Go-side filtering since JSON querying differs across SQLite/Postgres):
```go
// After fetching tasks, filter by labels if specified
if len(p.Labels) > 0 {
    var filtered []*ent.Task
    for _, t := range tasks {
        if hasAllLabels(t.Labels, p.Labels) {
            filtered = append(filtered, t)
        }
    }
    tasks = filtered
    // Note: total count will be approximate when label filtering is active
}
```

For sorting:
```go
switch p.SortField {
case "created":
    if p.SortOrder == "desc" {
        q = q.Order(task.ByCreatedAt(sql.OrderDesc()))
    } else {
        q = q.Order(task.ByCreatedAt())
    }
case "updated":
    q = q.Order(task.ByUpdatedAt(sql.OrderDesc()))
    // etc for priority, due_date
}
```

Check exact Ent ordering API — it may use `ent.Desc(task.FieldCreatedAt)` or `task.ByCreatedAt()` depending on version.

### A4. Wire new fields through server handlers

**File:** `internal/server/server.go`

#### CreateTask handler
Wire: labels, due_date, start_date, blocks_task_ids, blocked_by_task_ids, repo, branch from the request into CreateTaskParams.

```go
if len(req.GetLabels()) > 0 {
    p.Labels = req.GetLabels()
}
if req.GetDueDate() != nil {
    d := req.GetDueDate().AsTime()
    p.DueDate = &d
}
if req.GetStartDate() != nil {
    d := req.GetStartDate().AsTime()
    p.StartDate = &d
}
// Parse blocks_task_ids, blocked_by_task_ids as []uuid.UUID
if req.GetRepo() != "" {
    p.Repo = *req.Repo
}
```

#### UpdateTask handler
Wire: due_date, clear_due_date, start_date, clear_start_date, add_labels, remove_labels, add_blocks, add_blocked_by, remove_relationships, repo, branch, add_pull_requests, ci_status from the request.

#### ListTasks handler
Wire: priority, type, labels, parent_task_id, sort_field, sort_order from the request.

```go
if req.Priority != nil && *req.Priority != pb.TaskPriority_TASK_PRIORITY_UNSPECIFIED {
    pr := priorityFromProto(*req.Priority)
    p.Priority = &pr
}
if req.Type != nil {
    p.Type = req.Type
}
if len(req.GetLabels()) > 0 {
    p.Labels = req.GetLabels()
}
if req.ParentTaskId != nil {
    pid, err := uuid.Parse(*req.ParentTaskId)
    if err != nil {
        return nil, status.Errorf(codes.InvalidArgument, "invalid parent_task_id: %v", err)
    }
    p.ParentTaskID = &pid
}
if req.GetSortField() != pb.SortField_SORT_FIELD_UNSPECIFIED {
    p.SortField = sortFieldToString(req.GetSortField())
}
if req.GetSortOrder() != pb.SortOrder_SORT_ORDER_UNSPECIFIED {
    p.SortOrder = sortOrderToString(req.GetSortOrder())
}
```

### A5. Wire relationships and code_context in taskToProto

**File:** `internal/server/convert.go`

The `taskToProto` function needs to populate `relationships`, `labels`, and `code_context` from the Ent Task entity.

For labels:
```go
if len(t.Labels) > 0 {
    pt.Labels = t.Labels
}
```

For code_context:
```go
if t.Repo != "" || t.Branch != "" || t.CIStatus != nil || len(t.PullRequests) > 0 {
    pt.CodeContext = &pb.CodeContext{
        Repo:   stringPtr(t.Repo),
        Branch: stringPtr(t.Branch),
        // map ci_status, pull_requests
    }
}
```

For relationships: the task needs to eagerly load its source_relationships and target_relationships edges. This requires modifying the query in GetTask/ListTasks to use `.WithSourceRelationships()` and `.WithTargetRelationships()`. Then map to proto:
```go
if edges := t.Edges.SourceRelationships; len(edges) > 0 {
    for _, r := range edges {
        pt.Relationships = append(pt.Relationships, &pb.Relationship{
            Type:         relationshipTypeToProto(r.Type),
            TargetTaskId: r.TargetTaskID.String(),
        })
    }
}
```

Add a `relationshipTypeToProto` converter function.

### A6. Add sort helper functions to convert.go

```go
func sortFieldToString(f pb.SortField) string {
    switch f {
    case pb.SortField_SORT_FIELD_CREATED:
        return "created"
    case pb.SortField_SORT_FIELD_UPDATED:
        return "updated"
    case pb.SortField_SORT_FIELD_PRIORITY:
        return "priority"
    case pb.SortField_SORT_FIELD_DUE_DATE:
        return "due_date"
    default:
        return ""
    }
}

func sortOrderToString(o pb.SortOrder) string {
    switch o {
    case pb.SortOrder_SORT_ORDER_ASC:
        return "asc"
    case pb.SortOrder_SORT_ORDER_DESC:
        return "desc"
    default:
        return "asc"
    }
}
```

### A7. Tests

**File:** `internal/store/entstore_test.go` — add:
- `TestCreateTask_WithLabelsAndDates` — create task with labels, start_date, due_date, verify they persist
- `TestUpdateTask_Labels` — add and remove labels
- `TestUpdateTask_Dates` — set and clear dates
- `TestUpdateTask_Relationships` — add blocks/blocked_by, verify relationship records created
- `TestListTasks_FilterByPriority` — filter by priority
- `TestListTasks_FilterByType` — filter by type
- `TestListTasks_FilterByLabels` — filter by labels (AND semantics)
- `TestListTasks_FilterByParent` — filter by parent_task_id
- `TestListTasks_Sort` — sort by created_at asc/desc

**File:** `internal/server/server_test.go` — add:
- `TestRPC_CreateTask_WithLabels` — round-trip labels through RPC
- `TestRPC_UpdateTask_Dates` — set and clear dates through RPC
- `TestRPC_ListTasks_FilterByPriority` — filter via RPC

### Constraints
- All existing tests must continue to pass
- `go build ./...` must succeed
- Run `go generate ./internal/store/ent` after schema changes
- Do NOT modify the proto or generated proto code
- Follow existing code patterns (check entstore.go, server.go for style)

---

## Track B: Platform Adapter — GitHub Issues — Single Agent

This track is fully independent from Track A. It creates a new package with no overlap on existing files.

### B1. Define the platform adapter interface

**File:** `internal/platform/platform.go` (new)

```go
package platform

import (
    "context"

    "github.com/farmtable-io/farmtable/internal/store"
    "github.com/farmtable-io/farmtable/internal/store/ent"
    "github.com/google/uuid"
)

// Adapter defines the interface for syncing tasks with an external platform.
type Adapter interface {
    // Platform returns the platform identifier (e.g., "github", "linear").
    Platform() string

    // SyncCollection fetches tasks from the external platform and upserts them
    // into the store. Returns the number of tasks synced.
    SyncCollection(ctx context.Context, collectionID uuid.UUID, opts SyncOptions) (SyncResult, error)

    // PushTask sends a locally-created or updated task to the external platform.
    // Returns the remote ID assigned by the platform.
    PushTask(ctx context.Context, task *ent.Task) (remoteID string, err error)

    // PushComment sends a comment to the external platform.
    PushComment(ctx context.Context, comment *ent.Comment, task *ent.Task) (remoteID string, err error)
}

type SyncOptions struct {
    // FullSync forces re-sync of all items, not just changed ones.
    FullSync bool
    // Since limits sync to items modified after this time.
    Since *time.Time
}

type SyncResult struct {
    Created  int
    Updated  int
    Errors   int
}
```

### B2. Implement GitHub Issues adapter

**File:** `internal/platform/github/github.go` (new)

Implement the `platform.Adapter` interface for GitHub Issues.

**Dependencies:** Use the `github.com/google/go-github/v62/github` package and `golang.org/x/oauth2` for auth. Add to go.mod.

**Key implementation details:**

1. **Constructor:**
```go
type GitHubAdapter struct {
    client *github.Client
    store  store.Store
    owner  string
    repo   string
}

func New(token, owner, repo string, s store.Store) *GitHubAdapter {
    ts := oauth2.StaticTokenSource(&oauth2.Token{AccessToken: token})
    tc := oauth2.NewClient(context.Background(), ts)
    return &GitHubAdapter{
        client: github.NewClient(tc),
        store:  s,
        owner:  owner,
        repo:   repo,
    }
}
```

2. **SyncCollection:** Fetch issues via `client.Issues.ListByRepo()`, map each to NTO fields, call `store.CreateTask` or `store.UpdateTask`. Use `remote_data` to store the raw GitHub issue JSON. Set `remote_id` to `owner/repo#number`.

3. **Issue → NTO mapping:**
   - `issue.Title` → `Title`
   - `issue.Body` → `Description`
   - `issue.State` "open" → Phase OPEN / Stage TRIAGE; "closed" → Phase CLOSED / Stage COMPLETED
   - `issue.Labels` → `Labels` (extract label names)
   - `issue.Assignees` → first assignee only for now (store assignee_id as a deterministic UUID from GitHub user ID)
   - `issue.Milestone` → store in remote_data for now
   - `issue.CreatedAt` → store in remote_data (we use our own created_at)
   - `issue.Number` → remote_id as `"owner/repo#N"`
   - `issue.HTMLURL` → remote_url (needs to be added to Task schema — if not present, store in remote_data)

4. **PushTask:** Create or update a GitHub issue from a task. Map NTO fields back to GitHub issue fields. Use `client.Issues.Create()` or `client.Issues.Edit()`.

5. **PushComment:** Create a comment on the GitHub issue. Map comment body. Use `client.Issues.CreateComment()`.

### B3. Add issue number tracking for upsert

To support incremental sync (create vs update), the adapter needs to check if a task with a given `remote_id` already exists. Add a store helper:

**File:** `internal/store/entstore.go` — add method:
```go
func (s *EntStore) GetTaskByRemoteID(ctx context.Context, collectionID uuid.UUID, remoteID string) (*ent.Task, error) {
    // Query by collection_id and remote_data->remote_id
    // This requires remote_id to be a first-class field or querying JSON
}
```

**IMPORTANT:** This is the ONE file shared with Track A. To avoid conflicts:
- Track B should add ONLY this one method, at the END of the file
- Track B should NOT modify any existing methods

**Alternative (safer):** If remote_id is not a first-class field on the Ent schema, the adapter can maintain its own in-memory map of remote_id → task UUID during sync, fetched via ListTasks filtered by collection_id. This avoids any store.go or entstore.go changes entirely.

### B4. Tests

**File:** `internal/platform/github/github_test.go` (new)

- Test issue → NTO mapping function (unit test, no API calls)
- Test NTO → issue mapping function (unit test)
- Integration test with mock HTTP server (optional, nice-to-have)

### Constraints
- Do NOT modify proto or generated proto code
- Minimize or eliminate changes to existing files (entstore.go, server.go, store.go)
- Use the store.Store interface — don't reach into Ent client directly
- Add go-github and oauth2 dependencies to go.mod
- All existing tests must continue to pass

---

## Execution

- **Track A and Track B run in parallel** — different agents, no shared files
- Track B should use the **current** store interface (not the extended M2 one). After Track A lands, Track B can be enhanced to set labels, dates, etc.
- Both tracks must pass `go build ./...` and all tests
- After both complete: verify integration, then plan Wave 2

## Wave 2 Preview (not in scope)

After Wave 1 lands:
- **Track A:** Graph RPCs (GetReadyTasks, GetBlockedTasks, GetDependencyTree, etc.) — depends on M2 relationships
- **Track B:** M4 Change audit trail — record Change entities on each mutation
