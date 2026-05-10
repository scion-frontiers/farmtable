# GitHub GraphQL Integration — Technical Design

*Author: eng-manager (Scion agent)*
*Date: 2026-05-10*
*Status: Draft*
*Depends on: [Architecture Research](/scion-volumes/scratchpad/github-integration-architecture.md)*

---

## 1. Overview

Farm Table's GitHub adapter (`internal/platform/github/github.go`) currently uses REST API v3 via `google/go-github/v62`. This design migrates to GitHub's GraphQL API v4 to unlock sub-issues, `stateReason`, Projects v2 custom fields, and label-based state mapping — while keeping the existing REST adapter functional during the transition.

### Goals

1. **Incremental migration** — swap one adapter method at a time, REST and GraphQL coexist
2. **Two operating modes** sharing infrastructure — enhanced sync (default) and pass-through (alternative)
3. **Label-driven state mapping** — configurable `.farmtable/github.yaml` maps GitHub labels to Farm Table stages/priorities/types
4. **Sub-issue hierarchy** — parent/child relationships from GraphQL `subIssues`/`parent` connections
5. **Post-query graph computation** — derive ready/blocked/bottleneck status from the sub-issue tree

### Non-Goals

- Webhook-based real-time sync (future work)
- Cross-cutting dependency edges via GitHub (not possible without local state)
- Critical-path computation in pass-through mode (requires weighted DAG)

---

## 2. Architecture

### 2.1 Two Modes, Shared Infrastructure

```
┌─────────────────────────────────────────────────────┐
│                   platform.Adapter                  │
│          SyncCollection · PushTask · PushComment     │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────────────────────┐   ┌──────────────────────┐ │
│  │  Enhanced Sync Mode │   │  Pass-Through Mode   │ │
│  │  (default)          │   │  (--mode passthrough) │ │
│  │                     │   │                       │ │
│  │  GraphQL fetch →    │   │  GraphQL fetch →      │ │
│  │  label mapping →    │   │  label mapping →      │ │
│  │  tree computation → │   │  tree computation →   │ │
│  │  SQLite upsert      │   │  return directly      │ │
│  └─────────┬───────────┘   └──────────┬───────────┘ │
│            │                          │              │
│            ▼                          ▼              │
│  ┌─────────────────────────────────────────────────┐ │
│  │              Shared Components                   │ │
│  │  · graphqlClient (shurcooL/githubv4)             │ │
│  │  · rateLimitTransport (reused from REST)         │ │
│  │  · LabelMapper (config → stage/priority/type)    │ │
│  │  · TreeWalker (sub-issue graph computation)      │ │
│  │  · GitHubConfig (.farmtable/github.yaml parser)  │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

Both modes use the same GraphQL client, label mapper, and tree-walk algorithms. The only difference: enhanced sync persists results to the local SQLite store; pass-through returns them directly without local state.

### 2.2 Package Layout

```
internal/platform/github/
├── github.go              # GitHubAdapter (existing, REST — untouched in Phase 1)
├── github_test.go         # existing tests
├── ratelimit.go           # rateLimitTransport (reused by GraphQL client)
├── ratelimit_test.go      # existing tests
├── graphql.go             # GraphQL client setup + query/mutation methods (NEW)
├── graphql_queries.go     # Query struct definitions for shurcooL/githubv4 (NEW)
├── graphql_test.go        # GraphQL integration tests (NEW)
├── labels.go              # LabelMapper: config-driven label ↔ stage mapping (NEW)
├── labels_test.go         # LabelMapper unit tests (NEW)
├── config.go              # GitHubConfig: .farmtable/github.yaml parser (NEW)
├── config_test.go         # Config parser tests (NEW)
└── treewalk.go            # Post-query tree computation: ready/blocked/bottlenecks (NEW)
└── treewalk_test.go       # Tree computation tests (NEW)
```

---

## 3. GraphQL Client Setup

### 3.1 Library

**Primary: `shurcooL/githubv4`** — type-safe Go client using struct tags for query definition. Handles Relay-style cursor pagination natively.

**Escape hatch:** For Projects v2 field mutations where union types are unwieldy in struct tags, use raw GraphQL strings via `githubv4.NewClient`'s underlying `*http.Client` with a direct POST to the GraphQL endpoint. The `githubv4` library's internal client supports this.

### 3.2 Client Initialization

The GraphQL client reuses the existing `rateLimitTransport`. Both REST and GraphQL share the same GitHub API rate limit headers (`X-RateLimit-Remaining`, `X-RateLimit-Reset`), so the existing retry/backoff logic works unchanged.

```go
// graphql.go

import (
    "github.com/shurcooL/githubv4"
    "golang.org/x/oauth2"
)

type graphqlClient struct {
    v4     *githubv4.Client
    owner  string
    repo   string
    config *GitHubConfig
}

func newGraphQLClient(token, owner, repo string, cfg *GitHubConfig) *graphqlClient {
    ts := oauth2.StaticTokenSource(&oauth2.Token{AccessToken: token})
    httpClient := oauth2.NewClient(context.Background(), ts)
    httpClient.Transport = newRateLimitTransport(httpClient.Transport)

    return &graphqlClient{
        v4:     githubv4.NewClient(httpClient),
        owner:  owner,
        repo:   repo,
        config: cfg,
    }
}
```

### 3.3 Integration with GitHubAdapter

The adapter struct grows a `gql` field. During the migration, both clients coexist:

```go
type GitHubAdapter struct {
    client *gh.Client      // REST (existing)
    gql    *graphqlClient  // GraphQL (new, nil in Phase 1 until enabled)
    store  store.Store
    owner  string
    repo   string
    config *GitHubConfig
}
```

The `New()` constructor gains an optional `GitHubConfig` parameter. If config is present and contains GraphQL settings, the GraphQL client is initialized. Otherwise the adapter falls back to REST-only behavior (backward compatible).

---

## 4. GraphQL Query Designs

### 4.1 SyncCollection Query

This is the highest-value GraphQL migration — a single query replaces the REST `Issues.ListByRepo` call and adds sub-issues, `stateReason`, labels, and Projects v2 fields.

```go
// graphql_queries.go

type syncCollectionQuery struct {
    Repository struct {
        Issues struct {
            Nodes []issueNode
            PageInfo struct {
                HasNextPage githubv4.Boolean
                EndCursor   githubv4.String
            }
        } `graphql:"issues(first: 100, orderBy: {field: UPDATED_AT, direction: DESC}, after: $cursor, filterBy: $filter)"`
    } `graphql:"repository(owner: $owner, name: $repo)"`
}

type issueNode struct {
    ID          githubv4.ID
    Number      githubv4.Int
    Title       githubv4.String
    Body        githubv4.String
    State       githubv4.String       // OPEN, CLOSED
    StateReason githubv4.String       // COMPLETED, NOT_PLANNED, REOPENED, null
    CreatedAt   githubv4.DateTime
    UpdatedAt   githubv4.DateTime
    URL         githubv4.String

    Labels struct {
        Nodes []struct {
            Name githubv4.String
        }
    } `graphql:"labels(first: 20)"`

    Assignees struct {
        Nodes []struct {
            Login githubv4.String
        }
    } `graphql:"assignees(first: 10)"`

    Milestone *struct {
        Title githubv4.String
    }

    Parent *struct {
        Number githubv4.Int
        Title  githubv4.String
    }

    SubIssues struct {
        Nodes []struct {
            Number githubv4.Int
            Title  githubv4.String
            State  githubv4.String
        }
    } `graphql:"subIssues(first: 50)"`

    ProjectItems struct {
        Nodes []projectItemNode
    } `graphql:"projectItems(first: 5)"`
}

type projectItemNode struct {
    Project struct {
        Title githubv4.String
    }
    FieldValues struct {
        Nodes []projectFieldValueNode
    } `graphql:"fieldValues(first: 20)"`
}
```

**Query variables:**
- `$owner`: `githubv4.String`
- `$repo`: `githubv4.String`
- `$cursor`: `*githubv4.String` (null for first page)
- `$filter`: `githubv4.IssueFilters` (state, since, labels)

**Pagination:** Relay-style cursor pagination. The `shurcooL/githubv4` library handles this natively — call `client.Query()` in a loop, advancing `$cursor` to `PageInfo.EndCursor` until `HasNextPage` is false.

**Estimated cost:** ~15-30 points per 100-issue page (within the 5,000 points/hr budget).

### 4.2 PushTask Mutations

#### Create Issue

```go
type createIssueMutation struct {
    CreateIssue struct {
        Issue issueNode
    } `graphql:"createIssue(input: $input)"`
}

// Input: githubv4.CreateIssueInput{
//     RepositoryID: repoNodeID,
//     Title:        title,
//     Body:         &body,
//     LabelIDs:     &labelNodeIDs,
//     AssigneeIDs:  &assigneeNodeIDs,
// }
```

#### Update Issue

```go
type updateIssueMutation struct {
    UpdateIssue struct {
        Issue issueNode
    } `graphql:"updateIssue(input: $input)"`
}
```

#### Close / Reopen Issue

```go
type closeIssueMutation struct {
    CloseIssue struct {
        Issue issueNode
    } `graphql:"closeIssue(input: $input)"`
}

type reopenIssueMutation struct {
    ReopenIssue struct {
        Issue issueNode
    } `graphql:"reopenIssue(input: $input)"`
}
```

#### Add/Remove Sub-Issue

```go
type addSubIssueMutation struct {
    AddSubIssue struct {
        Issue issueNode
    } `graphql:"addSubIssue(input: $input)"`
}
```

### 4.3 PushComment Mutation

```go
type addCommentMutation struct {
    AddComment struct {
        CommentEdge struct {
            Node struct {
                ID        githubv4.ID
                Body      githubv4.String
                CreatedAt githubv4.DateTime
            }
        }
    } `graphql:"addComment(input: $input)"`
}
```

### 4.4 Label Management Mutations

```go
type addLabelsMutation struct {
    AddLabelsToLabelable struct {
        Labelable struct {
            Labels struct {
                Nodes []struct{ Name githubv4.String }
            } `graphql:"labels(first: 20)"`
        }
    } `graphql:"addLabelsToLabelable(input: $input)"`
}

type removeLabelsMutation struct {
    RemoveLabelsFromLabelable struct {
        Labelable struct {
            Labels struct {
                Nodes []struct{ Name githubv4.String }
            } `graphql:"labels(first: 20)"`
        }
    } `graphql:"removeLabelsFromLabelable(input: $input)"`
}
```

---

## 5. Label Management

### 5.1 Config File Format

**Location:** `.farmtable/github.yaml` in the repository root.

The full format is specified in the architecture research (section 3.8). Key fields:

```yaml
github:
  labels:
    enabled: true          # master switch
    stages: { ... }        # GitHub label → Farm Table stage
    priorities: { ... }    # GitHub label → Farm Table priority
    types: { ... }         # GitHub label → Farm Table type
    push_prefix: "ft:"     # prefix for labels written by ft
    auto_create_labels: true
```

### 5.2 Config Go Struct

```go
// config.go

type GitHubConfig struct {
    GitHub struct {
        Owner  string      `yaml:"owner"`
        Repo   string      `yaml:"repo"`
        Labels LabelConfig `yaml:"labels"`
    } `yaml:"github"`
}

type LabelConfig struct {
    Enabled          bool              `yaml:"enabled"`
    Stages           map[string]string `yaml:"stages"`
    Priorities       map[string]string `yaml:"priorities"`
    Types            map[string]string `yaml:"types"`
    PushPrefix       string            `yaml:"push_prefix"`
    AutoCreateLabels bool              `yaml:"auto_create_labels"`
}

func LoadConfig(path string) (*GitHubConfig, error) { ... }

func DefaultConfig() *GitHubConfig {
    return &GitHubConfig{...}  // enabled: true, push_prefix: "ft:", auto_create: true
}
```

### 5.3 LabelMapper

The `LabelMapper` is a bidirectional translation layer between GitHub labels and Farm Table stages/priorities/types.

```go
// labels.go

type LabelMapper struct {
    config    LabelConfig
    // Precomputed reverse maps for push direction
    stageToLabel    map[task.Stage]string
    priorityToLabel map[task.Priority]string
}

func NewLabelMapper(cfg LabelConfig) *LabelMapper { ... }

// Pull direction: GitHub labels → Farm Table state
func (m *LabelMapper) MapLabelsToStage(labels []string) (task.Stage, bool)
func (m *LabelMapper) MapLabelsToPriority(labels []string) (*task.Priority, bool)
func (m *LabelMapper) MapLabelsToType(labels []string) (string, bool)

// Push direction: Farm Table state → GitHub labels
func (m *LabelMapper) StageToLabel(s task.Stage) string
func (m *LabelMapper) PriorityToLabel(p task.Priority) string

// Label lifecycle
func (m *LabelMapper) StageLabelSwap(currentLabels []string, newStage task.Stage) (add []string, remove []string)
func (m *LabelMapper) PriorityLabelSwap(currentLabels []string, newPriority task.Priority) (add []string, remove []string)
```

### 5.4 Matching Rules

1. **Case-insensitive** — GitHub label "In Review" matches config key `"in review"`
2. **Exact match** — no substring or fuzzy matching
3. **Custom overrides extend defaults** — labels exactly matching a Farm Table stage name (e.g., `blocked`) are auto-mapped unless suppressed
4. **First match wins** — custom mappings take precedence over defaults

### 5.5 Mutual Exclusion & Precedence

When an issue has multiple labels mapping to different stages, apply the highest-precedence stage:

```
blocked > working > in_review > in_qa > deploying > ready > 
scheduled > waiting_for_input > backlog > triage > 
completed > wont_fix > duplicate > cancelled > deferred
```

Rationale: a task that is both "ready" and "blocked" is blocked (the more constraining state wins).

### 5.6 Auto-Creation of Labels

On first sync (or when `auto_create_labels: true` and a needed label doesn't exist), the adapter creates `ft:stage/*` and `priority:*` labels on the GitHub repo via `createLabel` mutation. Labels are created with consistent colors:

| Category | Color |
|----------|-------|
| `ft:stage/triage..ready` | Blue shades |
| `ft:stage/working..deploying` | Green shades |
| `ft:stage/blocked..waiting_for_input` | Red/orange |
| `ft:stage/completed..cancelled` | Gray |
| `priority:*` | Yellow/red gradient |

### 5.7 Enhanced State Mapping

The current `issueStateToPhaseStage()` is a 2-value function (open→triage, closed→completed). The new version uses labels + `stateReason`:

```go
func (m *LabelMapper) IssueToPhaseStage(state, stateReason string, labels []string) (task.Phase, task.Stage) {
    // 1. Check stateReason for closed issues
    if state == "CLOSED" {
        switch stateReason {
        case "NOT_PLANNED":
            return task.PhaseClosed, task.StageWontFix
        case "COMPLETED":
            // Check if a more specific terminal stage label exists
            if stage, ok := m.MapLabelsToStage(labels); ok && isTerminalStage(stage) {
                return task.PhaseClosed, stage
            }
            return task.PhaseClosed, task.StageCompleted
        }
    }

    // 2. Check labels for stage
    if stage, ok := m.MapLabelsToStage(labels); ok {
        return stageToPhase(stage), stage
    }

    // 3. Fallback to binary mapping
    if state == "CLOSED" {
        return task.PhaseClosed, task.StageCompleted
    }
    return task.PhaseOpen, task.StageTriage
}
```

---

## 6. Post-Query Tree Computation

### 6.1 Data Structures

```go
// treewalk.go

type IssueTree struct {
    Issues map[int]*IssueTreeNode  // keyed by issue number
}

type IssueTreeNode struct {
    Number      int
    Title       string
    State       string            // "OPEN" or "CLOSED"
    Stage       task.Stage        // derived from labels
    Labels      []string
    Children    []*IssueTreeNode  // sub-issues
    ParentNum   *int              // parent issue number
}

type ReadyResult struct {
    Issue  *IssueTreeNode
    Reason string  // "leaf task, marked ready" | "all N sub-issues closed"
}

type BlockedResult struct {
    Issue       *IssueTreeNode
    Reason      string
    BlockedBy   []*IssueTreeNode  // open children or blocked children
}

type BottleneckResult struct {
    Issue          *IssueTreeNode
    OpenChildCount int
    MaxDepth       int
}
```

### 6.2 Ready Computation

```go
func (t *IssueTree) ComputeReady() []ReadyResult {
    var results []ReadyResult
    for _, node := range t.Issues {
        if node.State != "OPEN" {
            continue
        }
        hasOpenChildren := false
        for _, child := range node.Children {
            if child.State == "OPEN" {
                hasOpenChildren = true
                break
            }
        }

        if node.Stage == task.StageReady && !hasOpenChildren {
            reason := "marked ready, no open sub-issues"
            if len(node.Children) == 0 {
                reason = "leaf task, marked ready"
            }
            results = append(results, ReadyResult{Issue: node, Reason: reason})
        }
    }
    return results
}
```

### 6.3 Blocked Computation

```go
func (t *IssueTree) ComputeBlocked() []BlockedResult {
    var results []BlockedResult
    for _, node := range t.Issues {
        if node.State != "OPEN" {
            continue
        }

        // Explicitly blocked via label
        if node.Stage == task.StageBlocked {
            results = append(results, BlockedResult{
                Issue:  node,
                Reason: "explicitly blocked (label)",
            })
            continue
        }

        // Implicitly blocked by open children
        var openChildren []*IssueTreeNode
        for _, child := range node.Children {
            if child.State == "OPEN" {
                openChildren = append(openChildren, child)
            }
        }
        if len(openChildren) > 0 {
            results = append(results, BlockedResult{
                Issue:     node,
                Reason:    fmt.Sprintf("blocked by %d open sub-issues", len(openChildren)),
                BlockedBy: openChildren,
            })
            continue
        }

        // Transitively blocked (a child is blocked)
        for _, child := range node.Children {
            if child.Stage == task.StageBlocked {
                results = append(results, BlockedResult{
                    Issue:     node,
                    Reason:    fmt.Sprintf("transitively blocked: #%d is blocked", child.Number),
                    BlockedBy: []*IssueTreeNode{child},
                })
                break
            }
        }
    }
    return results
}
```

### 6.4 Bottleneck Approximation

```go
func (t *IssueTree) ComputeBottlenecks(limit int) []BottleneckResult {
    var results []BottleneckResult
    for _, node := range t.Issues {
        if node.State != "OPEN" || len(node.Children) == 0 {
            continue
        }
        openCount := 0
        for _, child := range node.Children {
            if child.State == "OPEN" {
                openCount++
            }
        }
        if openCount > 0 {
            results = append(results, BottleneckResult{
                Issue:          node,
                OpenChildCount: openCount,
                MaxDepth:       t.maxDepth(node),
            })
        }
    }
    sort.Slice(results, func(i, j int) bool {
        return results[i].OpenChildCount > results[j].OpenChildCount
    })
    if limit > 0 && len(results) > limit {
        results = results[:limit]
    }
    return results
}
```

### 6.5 Query Cost

All tree computation is client-side (zero additional API calls). The only cost is the initial GraphQL fetch:
- ~15-30 points per 100-issue page
- Supports ~150-300 `ft task ready` invocations per hour within the 5,000 points/hr budget

---

## 7. Migration Plan

### Phase 1: GraphQL Client + Config Infrastructure

**What changes:**
- Add `shurcooL/githubv4` dependency to `go.mod`
- New files: `graphql.go`, `config.go`, `labels.go` with their tests
- `GitHubAdapter` struct gains optional `gql` and `config` fields
- `.farmtable/github.yaml` parser and `LabelMapper` are implemented and tested
- No behavior changes to the adapter — REST continues to handle all operations

**Backward compatibility:** Full. The adapter works exactly as before if no config file exists.

**Deliverables:**
1. `graphql.go` — client initialization, reusing `rateLimitTransport`
2. `config.go` — YAML parser for `.farmtable/github.yaml`
3. `labels.go` — `LabelMapper` with pull/push direction mapping
4. Unit tests for config parsing, label mapping, precedence rules

### Phase 2: SyncCollection via GraphQL

**What changes:**
- `SyncCollection()` switches from REST `Issues.ListByRepo` to the GraphQL `repository.issues` query
- The `IssueToCreateParams`/`IssueToUpdateParams` functions accept `issueNode` (GraphQL) instead of `*gh.Issue` (REST)
- Label-based stage/priority/type mapping is applied during sync
- `stateReason` is used for closed issue stage derivation
- Sub-issue parent/child relationships populate `ParentTaskID` in `CreateTaskParams`
- Sub-issue data stored in `RemoteData` for tree computation

**Backward compatibility:** The adapter output (tasks in SQLite) is richer but compatible. Existing tasks gain more accurate stage values on next sync.

**Deliverables:**
1. `graphql_queries.go` — `syncCollectionQuery` struct definition
2. Updated `SyncCollection()` method using GraphQL
3. New `graphqlIssueToCreateParams()` / `graphqlIssueToUpdateParams()` converting `issueNode` to store params
4. Integration test with mock GraphQL server

### Phase 3: PushTask + PushComment via GraphQL Mutations

**What changes:**
- `PushTask()` switches from REST `Issues.Create`/`Issues.Edit` to GraphQL `createIssue`/`updateIssue` mutations
- Label management on push: `StageLabelSwap()` and `PriorityLabelSwap()` via `addLabelsToLabelable`/`removeLabelsFromLabelable`
- `PushComment()` switches to `addComment` mutation
- Sub-issue creation via `addSubIssue` when `ParentTaskID` is set
- Auto-creation of `ft:stage/*` / `priority:*` labels on first push (if `auto_create_labels: true`)

**Backward compatibility:** Push behavior is functionally identical but now also manages labels on the GitHub side.

**Deliverables:**
1. Mutation struct definitions in `graphql_queries.go`
2. Updated `PushTask()` and `PushComment()` methods
3. Label auto-creation logic
4. `treewalk.go` — tree computation algorithms for ready/blocked/bottlenecks
5. Integration tests for mutations + label management

### Phase 4: REST Removal + Pass-Through Mode

**What changes:**
- Remove `google/go-github/v62` dependency
- Remove REST-specific code paths from `GitHubAdapter`
- `New()` constructor only creates GraphQL client
- (Optional) Implement `GitHubPassThroughStore` satisfying the `Store` interface for pass-through mode
- `rateLimitTransport` continues unchanged (same HTTP headers)

**Backward compatibility:** Breaking for callers that directly imported `go-github` types from this package (none exist outside the adapter).

**Deliverables:**
1. Remove REST client code
2. Clean up `go.mod`
3. Pass-through store implementation (if pursued)
4. Full test suite migration

---

## 8. Data Model Changes

### 8.1 Proto Changes

No proto schema changes are required. The existing `Task` message already has:
- `parent_task_id` (string, UUID) — maps to GraphQL `parent.number` via the remote ID
- `remote_data` (Struct) — carries sub-issue data, `stateReason`, project field values
- `labels` (repeated string) — carries GitHub labels
- Phase/stage/priority enums — already comprehensive enough for all label mappings

### 8.2 RemoteData Enrichment

The `remote_data` JSON blob grows with GraphQL-sourced fields:

```json
{
  "remote_id": "acme/repo#42",
  "node_id": "I_kwDOABCD1234",
  "html_url": "https://github.com/acme/repo/issues/42",
  "number": 42,
  "state_reason": "COMPLETED",
  "created_at": "2026-01-15T10:00:00Z",
  "updated_at": "2026-05-10T14:30:00Z",
  "milestone": "v2.0",
  "labels": ["bug", "ft:stage/working", "priority:high"],
  "sub_issues": [
    {"number": 43, "title": "Sub-task A", "state": "CLOSED"},
    {"number": 44, "title": "Sub-task B", "state": "OPEN"}
  ],
  "parent_number": 40,
  "project_fields": {
    "Status": "In Progress",
    "Priority": "High",
    "Sprint": "2026-W20"
  }
}
```

### 8.3 Config Structures

New config file at `.farmtable/github.yaml` (section 5.2). Not a proto/store change — lives alongside the existing `.farmtable/farmtable.db`.

---

## 9. Testing Strategy

### 9.1 Unit Tests

| Component | Test File | What's Tested |
|-----------|-----------|---------------|
| Config parser | `config_test.go` | YAML parsing, defaults, env var override, missing file |
| LabelMapper | `labels_test.go` | Pull mapping (labels→stage), push mapping (stage→label), precedence, case insensitivity, mutual exclusion swap |
| TreeWalker | `treewalk_test.go` | Ready computation, blocked computation, bottleneck ranking, edge cases (no children, all closed, cyclic references impossible in trees) |
| Query structs | `graphql_test.go` | JSON unmarshal of sample GraphQL responses into query structs |

### 9.2 Mock GraphQL Server

Use `net/http/httptest` with a handler that returns canned GraphQL JSON responses. This follows the existing test pattern in `github_test.go` (which tests mapping functions directly without a mock server) but extends to cover the GraphQL query/response cycle.

```go
func newMockGraphQLServer(t *testing.T, responses map[string]string) *httptest.Server {
    return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        var req struct {
            Query     string          `json:"query"`
            Variables json.RawMessage `json:"variables"`
        }
        json.NewDecoder(r.Body).Decode(&req)
        // Match query to response based on operation name or query substring
        for pattern, response := range responses {
            if strings.Contains(req.Query, pattern) {
                w.Header().Set("Content-Type", "application/json")
                fmt.Fprint(w, response)
                return
            }
        }
        http.Error(w, "unexpected query", 400)
    }))
}
```

### 9.3 Integration Tests

Integration tests use the mock server to test the full adapter flow:

1. **SyncCollection integration:** Mock returns 3 issues (one with sub-issues, one closed with `stateReason=NOT_PLANNED`, one with stage labels). Verify correct phase/stage/priority mapping and parent-child linkage in the store.
2. **PushTask integration:** Push a task with stage=working, verify the mutation includes `addLabelsToLabelable` for `ft:stage/working` and `removeLabelsFromLabelable` for the previous stage label.
3. **Label auto-creation:** Push to a repo where `ft:stage/working` doesn't exist yet. Verify `createLabel` mutation is called first.
4. **Tree computation end-to-end:** Fetch issues, build tree, compute ready/blocked. Verify results match expected output.

### 9.4 Rate Limit Testing

The existing `ratelimit_test.go` covers the transport layer. No changes needed — GraphQL uses the same HTTP transport and rate limit headers.

---

## 10. Open Decisions

These are scoped to Phase 1-2 and should be resolved during implementation:

1. **Projects v2 field mapping priority.** If both a label (`ft:stage/working`) and a Projects v2 "Status" field ("In Progress") are present, which takes precedence? **Proposed:** Projects v2 field wins, as it's more intentionally set. Configurable via `github.yaml`.

2. **Sub-issue depth.** Phase 2 fetches one level of sub-issues. Recursive depth (epic→story→task) requires additional queries. **Proposed:** Start with depth=1, add configurable `max_sub_issue_depth` in Phase 3.

3. **Auto-promotion.** When all sub-issues close, should `ft` automatically label the parent as `ft:stage/ready`? **Proposed:** No auto-promotion in Phase 2. Add as opt-in config (`auto_promote_ready: true`) in Phase 3.

---

## 11. Phased Work Breakdown

### Phase 1 Tasks (GraphQL Client + Config + Labels)

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 1.1 | Add `shurcooL/githubv4` to `go.mod` and verify build | S | — |
| 1.2 | Implement `config.go` — YAML parser for `.farmtable/github.yaml` with `LoadConfig()`, `DefaultConfig()` | M | — |
| 1.3 | Implement `labels.go` — `LabelMapper` with pull/push mapping, precedence, swap logic | M | 1.2 |
| 1.4 | Implement `graphql.go` — client initialization reusing `rateLimitTransport` | S | 1.1 |
| 1.5 | Write unit tests for config, labels, and client setup | M | 1.2, 1.3, 1.4 |
| 1.6 | Wire `GitHubAdapter.New()` to optionally load config and init GraphQL client | S | 1.2, 1.4 |

### Phase 2 Tasks (SyncCollection Migration)

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 2.1 | Define `syncCollectionQuery` struct in `graphql_queries.go` | M | Phase 1 |
| 2.2 | Implement `graphqlIssueToCreateParams` / `graphqlIssueToUpdateParams` using `LabelMapper` + `stateReason` | M | Phase 1 |
| 2.3 | Replace `SyncCollection()` to use GraphQL query with cursor pagination | L | 2.1, 2.2 |
| 2.4 | Add sub-issue parent-child linking during sync (populate `ParentTaskID`) | M | 2.3 |
| 2.5 | Implement mock GraphQL server and integration tests | M | 2.3 |
| 2.6 | Implement `treewalk.go` — ready/blocked/bottleneck computation | M | 2.3 |

### Phase 3 Tasks (Mutations + Label Push)

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 3.1 | Define mutation structs for create/update/close/reopen/addComment | M | Phase 2 |
| 3.2 | Replace `PushTask()` with GraphQL mutations + label swap | L | 3.1 |
| 3.3 | Replace `PushComment()` with `addComment` mutation | S | 3.1 |
| 3.4 | Implement label auto-creation on push | M | 3.2 |
| 3.5 | Add `addSubIssue` support when `ParentTaskID` is set | M | 3.2 |
| 3.6 | Integration tests for mutations | M | 3.2, 3.3 |

### Phase 4 Tasks (REST Removal + Optional Pass-Through)

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 4.1 | Remove `google/go-github/v62` dependency and REST code paths | M | Phase 3 |
| 4.2 | Update `New()` constructor to GraphQL-only | S | 4.1 |
| 4.3 | (Optional) `GitHubPassThroughStore` implementation | XL | Phase 3 |

---

## Appendix: Key References

| Resource | Location |
|----------|----------|
| Architecture research | `/scion-volumes/scratchpad/github-integration-architecture.md` |
| Current GitHub adapter | `internal/platform/github/github.go` |
| Rate limit transport | `internal/platform/github/ratelimit.go` |
| Platform adapter interface | `internal/platform/platform.go` |
| Store interface | `internal/store/store.go` |
| Task enums (phase/stage/priority) | `internal/store/ent/task/task.go` |
| Proto source of truth | `proto/farmtable.proto` |
| shurcooL/githubv4 docs | https://github.com/shurcooL/githubv4 |
