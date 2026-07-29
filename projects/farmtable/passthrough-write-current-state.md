# Findings: Write-Through Support for GitHub Passthrough

**Date:** 2026-07-22
**Author:** Architect agent (farmtable-architect-passthrough-write)
**Status:** Investigation complete — ready for discussion with ptone@google.com
**Scope:** Exploration of what's involved in extending the GitHub passthrough from read-only to read-write

---

## Executive Summary

**The backend write path already exists.** The `GitHubPassThroughStore` (CLI passthrough mode) already implements full write-through to GitHub's GraphQL API for all core operations: creating issues, editing them, changing labels (stage/priority), managing parent-child relationships via sub-issues, closing issues, and adding comments. The `MultiStore` router already routes write operations to the passthrough store without blocking them. The `PlatformResolver` lazily constructs the store from `LinkedAccount` credentials.

**The only barrier is the frontend's B7 read-only enforcement** — a single `isReadOnly` getter in `ft-app.ts` that checks `collection.platform !== Platform.FARMTABLE` and propagates `readOnly=true` to all child components.

**The real design questions are not "can we do this?" but rather:**
1. Which operations should be enabled first?
2. What UX should accompany writes (feedback, error handling, latency)?
3. How do we handle the cases where the PassThroughStore's write mappings don't cover Farmtable's full field model?
4. What PAT scope requirements and permission checks are needed?
5. How does this interact with the poll-on-interval refresh (seeing your own writes reflected)?

---

## 1. Current Read Path Architecture

```
User opens dashboard → selects GitHub collection
    ↓
ft-app.ts: ListTasks(collectionId=X)
    ↓
gRPC → server.ListTasks()
    ↓
MultiStore.ListTasks() → storeForCtx(collectionID)
    ↓
lazyResolve(): GetCollection() → platform=github
               ListLinkedAccounts() → PAT token
               PlatformResolver() → NewPassThroughStore(token, owner, repo, collectionID)
               Cache in platforms map
    ↓
GitHubPassThroughStore.ListTasks()
    ↓
gql.listIssues(ctx, states, labels, limit=200)
    ↓
GitHub GraphQL API → issues response
    ↓
issueToTask() mapping for each issue:
  - issue.Number    → deterministic UUID (SHA1 of "github:owner/repo#N")
  - issue.Title     → Task.Title
  - issue.Body      → Task.Description
  - issue.State     → Task.Phase + Task.Stage (via LabelMapper)
  - issue.Labels    → Task.Priority, Task.Type, Task.Labels, Task.Stage
  - issue.Assignees → Task.AssigneeID (first only, deterministic UUID)
  - issue.Parent    → Task.ParentTaskID (sub-issues → parent-child)
  - issue metadata  → Task.RemoteData (remote_url, node_id, sub_issues, etc.)
  - issue.UpdatedAt → Task.Version (Unix timestamp as CAS key)
    ↓
[]*ent.Task → taskToProto() → gRPC response → frontend TaskStore → Board render
```

**Key architectural properties of the current read path:**
- **Always-fresh:** Every board load fetches from GitHub API. No local cache to invalidate.
- **No WatchTasks:** Server returns `codes.Unimplemented` for external collections. Frontend falls back to poll-on-interval (configurable, default 60s) or manual refresh button.
- **Ephemeral SQLite for graph queries:** `GetReadyTasks`/`GetBlockedTasks` load all issues into a throwaway in-memory SQLite EntStore, run existing graph query SQL against it, then discard. Reuses all existing graph query code.
- **Deterministic UUIDs:** Task, comment, and user IDs are generated from `uuid.NewSHA1(uuid.NameSpaceURL, "github:...")`. This means the same issue always gets the same UUID — no ID mapping table needed.

---

## 2. Existing Write Implementations in PassThroughStore

The `GitHubPassThroughStore` already implements these write operations via GitHub's GraphQL mutations:

### 2a. CreateTask (→ Create GitHub Issue)
**File:** `internal/platform/github/passthrough.go:246-301`

Maps Farmtable `CreateTaskParams` to `createIssue` GraphQL mutation:
- `Title` → issue title
- `Description` → issue body
- `Stage` → label (via `mapper.StageToLabel()` — e.g., "ready" → label "ready")
- `Priority` → label (via `mapper.PriorityToLabel()` — e.g., "high" → label "high")
- `Labels` → additional labels
- `ParentTaskID` → `addSubIssue()` mutation (links as GitHub sub-issue)

After creation, returns `issueToTask(createdIssue)` — the fresh issue mapped back to a Farmtable task.

### 2b. UpdateTask (→ Update GitHub Issue)
**File:** `internal/platform/github/passthrough.go:307-397`

Maps Farmtable `UpdateTaskParams` to multiple GitHub mutations:
1. **Title/Description** → `updateIssue()` mutation (title + body)
2. **Stage change** → `StageLabelSwap()`: removes old stage labels, adds new stage label
3. **Priority change** → `PriorityLabelSwap()`: removes old priority labels, adds new priority label
4. **Assignee** → `updateIssueAssignees()` (currently clears assignees, doesn't set new ones — **bug or limitation**)
5. **Parent change** → `removeSubIssue()` on old parent + `addSubIssue()` on new parent
6. **ClearParent** → `removeSubIssue()` only

**Not mapped (silently ignored):** `AcceptanceCriteria`, `DueDate`, `StartDate`, `Type`, `Repo`, `Branch`, `CIStatus`, `Labels` (add/remove), `Reason`, `RemoteData`. These have no GitHub issue equivalent or the mapping isn't implemented.

### 2c. ClaimTask (→ Stage transition to "working")
**File:** `internal/platform/github/passthrough.go:453-492`

- Applies `StageLabelSwap(currentLabels, StageWorking)` — swaps labels to indicate "working" stage
- Does **not** set the GitHub assignee (the store method ignores `assigneeID`)
- Re-fetches the issue to return fresh state

### 2d. CloseTask (→ Close GitHub Issue)
**File:** `internal/platform/github/passthrough.go:494-521`

- Maps terminal stage to GitHub close reason:
  - `StageCompleted` → `IssueClosedStateReasonCompleted`
  - `StageWontFix` / `StageCancelled` → `IssueClosedStateReasonNotPlanned`
- Calls `gql.closeIssue()` mutation

### 2e. AddComment (→ Add Issue Comment)
**File:** `internal/platform/github/passthrough.go:558-592`

- Resolves task UUID → issue node ID
- Calls `gql.addComment()` mutation with the comment body
- Returns mapped comment with deterministic UUID

### 2f. DeleteTask (→ NOT IMPLEMENTED)
Returns `ErrNotImplemented` — GitHub doesn't support deleting issues.

---

## 3. What the MultiStore Already Does for Writes

**File:** `internal/store/multistore.go`

The MultiStore routes ALL write operations to the platform-specific store when the task belongs to an external collection:

```go
func (m *MultiStore) CreateTask(ctx context.Context, p CreateTaskParams) (*ent.Task, error) {
    return m.storeForCtx(ctx, p.CollectionID).CreateTask(ctx, p)  // → PassThroughStore.CreateTask
}

func (m *MultiStore) UpdateTask(ctx context.Context, id uuid.UUID, p UpdateTaskParams, actorID uuid.UUID) (*ent.Task, error) {
    s, err := m.storeForTask(ctx, id)  // resolves to PassThroughStore
    return s.UpdateTask(ctx, id, p, actorID)
}

func (m *MultiStore) ClaimTask(...)  // → PassThroughStore.ClaimTask
func (m *MultiStore) CloseTask(...)  // → PassThroughStore.CloseTask
func (m *MultiStore) AddComment(...) // → PassThroughStore.AddComment
```

**There is no server-side guard that blocks writes to external collections.** The server's gRPC handlers call `s.store.CreateTask()` etc. and the MultiStore routes to the passthrough store transparently. The `eventBus.Publish()` calls in the server handlers will still fire after a successful write — but since WatchTasks is disabled for external collections, these events are effectively no-ops (no subscribers for external collection events).

---

## 4. Frontend Read-Only Enforcement (The Single Gate)

**The entire read-only enforcement flows through one getter:**

```typescript
// web/src/components/ft-app.ts:145-147
private get isReadOnly(): boolean {
    return this.currentCollection !== undefined &&
           this.currentCollection.platform !== Platform.FARMTABLE;
}
```

This propagates `readOnly` to every child component:
- **ft-toolbar.ts:260** — shows "🔒 Read-only" badge
- **ft-kanban-view.ts:295** — hides "Add Task" button
- **ft-kanban-column.ts:184-218** — disables drag-and-drop
- **ft-task-card.ts:186-276** — blocks title/priority inline editing, disables drag
- **ft-inspector-header.ts:208** — blocks priority editing
- **ft-inspector-desc.ts:109** — blocks description editing
- **ft-inspector-meta.ts:466-590** — blocks assignee/label/date editing
- **ft-inspector-comments.ts:223** — hides comment form
- **ft-tree-view.ts:521-601** — blocks parent assignment, hierarchy changes
- **ft-tree-node.ts:198** — sets `draggable=false`

**Architecture insight:** Changing the `isReadOnly` getter is the single lever. Once it returns `false` for a GitHub collection, all UI controls unlock automatically. No per-component changes needed for the basic unlock.

---

## 5. Design Challenges for Write-Through

### 5a. Field Mapping Gaps (Farmtable → GitHub)

The PassThroughStore's `UpdateTask` doesn't map all Farmtable fields. Some fields have no GitHub equivalent:

| Farmtable Field | GitHub Mapping | Status |
|---|---|---|
| Title | Issue title | ✅ Implemented |
| Description | Issue body | ✅ Implemented |
| Stage | Labels (via LabelMapper) | ✅ Implemented |
| Priority | Labels (via LabelMapper) | ✅ Implemented |
| Parent/Child | Sub-issues | ✅ Implemented |
| Comments | Issue comments | ✅ Implemented |
| Close (completed/won't-fix) | Close issue with reason | ✅ Implemented |
| Assignee | Assignees | ⚠️ Partial — clears but doesn't set |
| Type | Labels (via LabelMapper) | ⚠️ Not in UpdateTask (only read mapping) |
| Labels (add/remove) | Issue labels | ⚠️ Not in UpdateTask (only stage/priority labels) |
| Acceptance Criteria | — | ❌ No GitHub equivalent |
| Start Date / Due Date | — | ❌ No native GitHub equivalent (milestone?) |
| Code Context (repo/branch/CI) | — | ❌ No GitHub equivalent |
| Relationships (blocks/blocked-by) | — | ❌ GitHub has no native relationship model beyond sub-issues |

**Key question for ptone:** Which of these gaps matter? The core editing operations (title, description, stage, priority, parent-child, comments, close) are already implemented. The gaps are in auxiliary fields that may not be relevant for the passthrough use case.

### 5b. Assignee Handling

The current `UpdateTask` implementation has a bug/limitation at line 369-371:
```go
if p.AssigneeID != nil {
    _ = s.gql.updateIssueAssignees(ctx, issueID, nil) // clears assignees!
}
```
This clears assignees but doesn't set the new one. The issue is that Farmtable uses a `uuid.UUID` for assignee (a Farmtable user ID), but GitHub needs a GitHub login. There's no reverse mapping from Farmtable user UUID → GitHub login.

**Fix approach:** The deterministic UUID is `SHA1("github:user:{login}")`. We can't reverse a SHA1 hash. Options:
1. Store the GitHub login in the user's `RemoteData` or a lookup table
2. When fetching issues, build a transient `uuid→login` map from the issue data
3. Accept that assignee changes in the Farmtable UI can't propagate to GitHub (document as limitation)

### 5c. Conflict Handling

The passthrough is always-fresh for reads — but writes introduce a window for conflicts:
1. User views task at T0 (fetched from GitHub API)
2. Someone edits the issue on GitHub at T1
3. User edits the task in Farmtable at T2 (using stale state from T0)

The current `UpdateTask` implementation doesn't check versions before writing. It calls `updateIssue()` which is a last-write-wins mutation. GitHub's GraphQL mutations don't support conditional writes (no `If-Match` / ETag).

**Mitigation options:**
- **Last-write-wins (current behavior):** Accept it. For most single-user workflows (which is the primary use case), conflicts are rare.
- **Optimistic check:** Before writing, re-fetch the issue and compare `updatedAt` against the task's `Version` field. If they differ, warn the user. This adds one extra API call per write.
- **Version in UI:** Show the user when they're editing stale data (e.g., "This task was updated 5 minutes ago on GitHub").

### 5d. GitHub API Rate Limits for Writes

GitHub allows 5000 requests/hour with a PAT. Writes are typically low-volume (a few per minute at most). The main concern is the `UpdateTask` implementation which fetches the full issue list (200 issues) to resolve task UUID → issue node ID before making the mutation. That's 2 API calls per write operation.

For a workspace with 200 issues, each write costs:
- 1 `listIssues` call (to resolve UUID)
- 1-3 mutation calls (updateIssue + optional label mutations + optional sub-issue mutations)

At ~4 calls per write and a budget of 5000/hour, the limit is ~1250 write operations per hour — more than sufficient.

### 5e. PAT Scope Requirements

A GitHub PAT needs `repo` scope to write to issues. The `repo` scope implies:
- Read/write access to issues (create, edit, close, comment)
- Read/write access to labels
- Read/write access to sub-issues

**If the linked account's PAT was created with only read scopes** (e.g., `public_repo` for public repos, or a fine-grained PAT with only "Issues: read"), writes will fail with a 403. The system should:
1. Check scopes on the PAT (if stored in LinkedAccount)
2. Surface a clear error when a write fails due to insufficient permissions
3. Guide the user to create a PAT with the required scope

The `LinkedAccount` Ent schema already has a `Scopes` field (`[]string`) that could store the PAT's granted scopes.

### 5f. EventBus / WatchTasks Interaction

Since WatchTasks is disabled for external collections, the eventBus events from write operations are effectively no-ops. The user's own writes won't be reflected immediately via streaming — they'll see the update on the next poll-on-interval refresh (default 60s) or manual refresh.

**UX improvement options:**
1. **Immediate local update:** After a successful write, the frontend can optimistically update the TaskStore with the returned task proto — no need to wait for the next poll.
2. **Trigger immediate refresh:** After a write, the frontend can trigger an immediate `ListTasks` poll to refresh the board.
3. **Both:** Optimistic local update for instant UI feedback, then a background refresh to pick up any other concurrent changes.

### 5g. Operations That Can Never Work via Passthrough

Some Farmtable concepts have no GitHub equivalent:
- **Relationships (blocks/blocked-by):** GitHub has sub-issues (parent-child) but no "blocks" concept. Farmtable's relationship model is richer.
- **Acceptance criteria:** No GitHub field for this.
- **Code context (repo/branch/CI):** Ironic — GitHub is a code platform, but these fields are Farmtable-specific task metadata, not issue fields.
- **Task deletion:** GitHub doesn't support deleting issues. (Already returns `ErrNotImplemented`.)
- **InsertTasksAfter:** No ordering/position concept in GitHub issues. (Already returns `ErrNotImplemented`.)

---

## 6. Scope Assessment: What Could Be Enabled and When

### Tier 1 — Low-Hanging Fruit (backend already works, frontend unlock only)
1. **Edit title** — PassThroughStore.UpdateTask already handles this
2. **Edit description** — Same
3. **Change stage** (move card between columns) — Label swap already works
4. **Change priority** — Label swap already works
5. **Add comments** — AddComment already works
6. **Close task** (mark completed/won't-fix) — CloseTask already works
7. **Create task** (new issue) — CreateTask already works
8. **Change parent** (reparent sub-issue) — Sub-issue mutations already work

### Tier 2 — Needs Backend Fixes (small)
1. **Set assignee** — Fix the UpdateTask assignee handling (need UUID→login reverse lookup)
2. **Type change** — Add type label swap to UpdateTask (read mapping exists, write mapping missing)
3. **Label management** (add/remove) — Add generic label add/remove to UpdateTask

### Tier 3 — UX / Polish
1. **Optimistic updates** — Frontend local update after write success
2. **Immediate refresh** — Trigger poll after write
3. **Error handling** — Surface GitHub API errors (403 for scope issues, rate limits)
4. **Scope validation** — Check PAT scopes on collection link
5. **Read-only badge → write-enabled badge** — Visual indicator that writes go to GitHub
6. **"Powered by GitHub" indicator** — Remind users that writes go to the external platform

### Tier 4 — Not Feasible (acknowledge as limitations)
1. Farmtable relationships (blocks/blocked-by) beyond parent-child
2. Acceptance criteria
3. Code context fields
4. Start/due dates (unless mapped to milestones, which is a stretch)
5. Task deletion
6. Bulk ordering/positioning

---

## 7. Interaction with Existing Passthrough Infrastructure

| Component | Impact of Enabling Writes |
|---|---|
| **MultiStore** | No changes needed — already routes writes |
| **PlatformResolver** | No changes needed — PassThroughStore already has write methods |
| **WatchTasks guard** | No changes needed — stays disabled for external collections |
| **Poll-on-interval (B8)** | Needs UX adjustment — trigger immediate refresh after writes |
| **Ephemeral SQLite (C3)** | No impact — graph queries are read-only |
| **LinkedAccount** | May need scope validation on link |
| **GrpcError (passthrough fix)** | No interaction |
| **Collection selector** | No changes needed |
| **View in GitHub link** | May want to make this more prominent when writes are enabled |

---

## 8. Estimated Implementation Effort

**If ptone wants the minimum viable write-through:**
- Frontend: Change one getter (`isReadOnly`) to allow writes for GitHub collections → ~30 minutes of code
- Add optimistic local updates and immediate refresh after writes → ~2-4 hours
- Fix assignee handling bug → ~1-2 hours
- Error handling for write failures → ~2-4 hours
- **Total: ~1-2 days for a usable MVP**

**For a polished write-through experience:**
- All of the above
- Scope validation on LinkedAccount
- Type/label write mapping
- UX indicators (write-enabled badge, "changes go to GitHub" messaging)
- Conflict detection (optional)
- **Total: ~3-5 days**

This is dramatically smaller than the original read-only passthrough project (21 tasks, ~2.5 hours) because the hard infrastructure work (MultiStore, LinkedAccount, PlatformResolver, PassThroughStore, GraphQL mutations) already exists.

---

## Open Questions for Discussion with ptone@google.com

1. **Which operations matter first?** The Tier 1 operations (title, description, stage, priority, comments, close, create, reparent) are all ready. Is this sufficient for the initial use case?

2. **Is eventual consistency acceptable?** After a write, the user may need to wait up to 60s (poll interval) to see their change reflected — unless we add optimistic updates or immediate refresh. Which approach is preferred?

3. **What about operations that can't map to GitHub?** Should the UI show those controls as disabled with a tooltip ("Not available for GitHub collections"), or hide them entirely?

4. **Conflict tolerance?** For a single-user workflow, last-write-wins is fine. If multiple people edit both in Farmtable and GitHub, conflicts are possible. Is this a concern?

5. **PAT scope enforcement?** Should we validate scopes at link time, or just surface clear errors when writes fail?

6. **Should this be collection-level configurable?** e.g., a collection setting `"writable": true/false` so users can choose to keep some external collections read-only?
