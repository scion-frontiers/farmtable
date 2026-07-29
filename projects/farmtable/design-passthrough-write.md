# Design: Write-Through for GitHub Passthrough Collections

**Date:** 2026-07-22
**Author:** Architect agent (farmtable-architect-passthrough-write)
**Status:** Draft — pending ptone@google.com review
**Scope:** Small-Medium (3 implementation phases, ~3-5 days total)
**Predecessor:** Findings doc at `passthrough-write-current-state.md`
**Related:** `design-external-store-passthrough.md` (original Cat 1 read-only design)

---

## Problem & Goals

The External Store Passthrough (PRs #85–#104) delivered read-only passthrough for GitHub-backed collections. Users can view GitHub issues as Farmtable tasks on the dashboard, but cannot edit them — the UI enforces read-only mode via a platform check. ptone@google.com wants to relax this: writes should go to the GitHub API and be reflected in the read-through proxy.

### Success Criteria

1. A user viewing a GitHub-backed collection on the dashboard can edit task titles, descriptions, stage, priority, parent-child, and comments — and those edits are written through to the GitHub issue.
2. Edits feel instant (optimistic local update) while the write propagates to GitHub.
3. A background sweep at ≤15s interval refreshes the full task list to pick up external changes.
4. The sweep does not overwrite in-flight optimistic updates (no "flickering").
5. Operations that have no GitHub equivalent (relationships, acceptance criteria, dates) are disabled with a clear tooltip.
6. Per-collection write enablement is configurable (collections can remain read-only).
7. Write failures surface clear errors to the user (permissions, rate limits, network).

### Non-Goals

- **Webhook-based sync (Cat 4).** This design uses the passthrough's always-fresh read model with a shorter poll interval. Webhooks are a separate, larger effort.
- **Conflict detection / merge.** Last-write-wins is accepted per ptone's direction.
- **Mapping Farmtable relationships (blocks/blocked-by) to GitHub.** GitHub has no native relationship model beyond parent-child (sub-issues). The existing sub-issue support covers parent-child.
- **Mapping dates, acceptance criteria, code context to GitHub.** No GitHub issue fields exist for these.
- **WatchTasks for external collections.** Polling remains the data refresh mechanism.

---

## Proposed Design

### Architecture Overview

The write-through path piggybacks entirely on existing infrastructure:

```
User edits task title in Farmtable dashboard
    ↓
ft-app.ts: applyTaskUpdate(taskId, {title: "new title"})
    ↓ optimistic: taskStore.upsert(updatedTask) ← instant UI update
    ↓ async: client.updateTask(taskId, {title: "new title"})
    ↓
gRPC → server.UpdateTask()
    ↓
MultiStore.UpdateTask() → storeForTask() → PassThroughStore
    ↓
PassThroughStore.UpdateTask():
  1. gql.listIssues() → find issue by UUID → get node ID
  2. gql.updateIssue(nodeID, title="new title")
  3. (if stage changed) gql.removeLabels() + gql.addLabels()
  4. (if parent changed) gql.removeSubIssue() + gql.addSubIssue()
  5. return issueToTask(updatedIssue) ← fresh from GitHub
    ↓
Response → frontend receives confirmed task
    ↓ mark task as not-dirty
    ↓
Background: PollManager sweeps every 15s (full ListTasks refresh)
  → skips dirty tasks → picks up external changes
```

**Key property:** No new server-side code for the write path. The `MultiStore`, `PassThroughStore`, and server handlers already route writes correctly. The work is:
1. Frontend: flip the read-only gate and add the dirty-task guard
2. Frontend: reduce poll interval and add optimistic-sweep coordination
3. Backend (small): fix the assignee write bug and add missing write mappings
4. Frontend: disable/tooltip unmappable operations
5. Backend (small): per-collection `writable` setting

### Component 1: Frontend — Unlock Writes for External Collections

**The single gate to change:**

```typescript
// web/src/components/ft-app.ts — CURRENT (line 145-147)
private get isReadOnly(): boolean {
    return this.currentCollection !== undefined &&
           this.currentCollection.platform !== Platform.FARMTABLE;
}

// PROPOSED
private get isReadOnly(): boolean {
    if (!this.currentCollection) return false;
    if (this.currentCollection.platform === Platform.FARMTABLE) return false;
    // External collections: check per-collection writable setting
    return !this.isCollectionWritable(this.currentCollection);
}

private isCollectionWritable(coll: Collection): boolean {
    // Check remote_data for explicit writable flag
    const rd = coll.remoteData;
    if (rd && typeof rd === 'object' && 'writable' in rd) {
        return rd.writable === true;
    }
    // Default: external collections are read-only unless explicitly enabled
    return false;
}
```

**Design decision:** Default to read-only for external collections, opt-in to writable. This is safer than the inverse — a new external collection linked without write intent stays read-only. The user explicitly enables writes via `ft collection update --remote-data '{"writable": true}'` or a future UI toggle.

**Alternative considered:** Flip the default to writable for all GitHub collections. Rejected: some users may link GitHub repos purely for read-only viewing (e.g., monitoring an upstream project they don't own). The opt-in model prevents unexpected writes.

### Component 2: Optimistic Updates + Dirty-Task Guard

**The optimistic update pattern already exists** in `ft-app.ts:441-455`:

```typescript
private async applyTaskUpdate(taskId: string, fields: UpdateTaskFields) {
    const task = this.taskStore.getTask(taskId);
    if (!task) return;
    const updated = applyTaskUpdateFields(task, fields);
    this.taskStore.upsert(updated);  // ← optimistic: instant UI
    try {
        await this.client.updateTask(taskId, fields);  // ← async write
    } catch (error) {
        this.taskStore.upsert(task);  // ← rollback on failure
    }
}
```

This works as-is once the `isReadOnly` gate is removed. **However**, the `PollManager.refresh()` method does `this.store.clear()` before upserting the sweep results (line 91-94 of `poll-manager.ts`). This creates the flickering problem:

1. User edits title at T0 → optimistic update → UI shows new title
2. Sweep fires at T0+2s (write still in-flight) → `clear()` → upserts stale data → title reverts
3. Write completes at T0+3s → but store already has stale data

**Fix: Add a dirty-task guard to PollManager:**

```typescript
// web/src/store/poll-manager.ts — PROPOSED additions

export class PollManager extends EventTarget {
    // ... existing fields ...
    
    /** Task IDs with in-flight writes — sweep skips these. */
    private dirtyTasks = new Set<string>();
    
    /** Mark a task as dirty (in-flight write). */
    markDirty(taskId: string): void {
        this.dirtyTasks.add(taskId);
    }
    
    /** Clear dirty flag (write completed or rolled back). */
    clearDirty(taskId: string): void {
        this.dirtyTasks.delete(taskId);
    }
    
    async refresh(): Promise<void> {
        // ... existing guard and fetch ...
        
        const tasks = await this.client.listTasks();
        if (token !== this.pollToken) return;
        
        // CHANGED: Don't clear() — merge instead, respecting dirty tasks.
        const freshIds = new Set<string>();
        for (const task of tasks) {
            freshIds.add(task.id);
            if (!this.dirtyTasks.has(task.id)) {
                this.store.upsert(task);  // update from sweep
            }
            // else: skip — optimistic update takes precedence
        }
        
        // Remove tasks that are gone from the remote source
        // (but not dirty ones — they may have just been created)
        for (const existing of this.store.allTasks) {
            if (!freshIds.has(existing.id) && !this.dirtyTasks.has(existing.id)) {
                this.store.delete(existing.id);
            }
        }
        
        this.store.snapshotComplete();
        // ... rest unchanged ...
    }
}
```

**And update `applyTaskUpdate` to coordinate:**

```typescript
// web/src/components/ft-app.ts — PROPOSED changes to applyTaskUpdate

private async applyTaskUpdate(taskId: string, fields: UpdateTaskFields) {
    const task = this.taskStore.getTask(taskId);
    if (!task) return;

    const updated = applyTaskUpdateFields(task, fields);
    this.taskStore.upsert(updated);
    this.pollManager?.markDirty(taskId);  // ← prevent sweep from overwriting

    try {
        const confirmed = await this.client.updateTask(taskId, fields);
        // Optionally: upsert the server-confirmed task (has accurate updatedAt, etc.)
        // this.taskStore.upsert(confirmed);
    } catch (error) {
        console.warn('Failed to update task; rolled back optimistic change', error);
        this.taskStore.upsert(task);
    } finally {
        this.pollManager?.clearDirty(taskId);  // ← sweep can now update this task
    }
}
```

**Design decision:** Merge-based sweep instead of clear-and-replace. This prevents the flickering problem and also avoids a brief "empty board" flash during sweep (which `clear()` causes).

**Alternative considered:** Keep `clear()` but pause the sweep during in-flight writes. Rejected: if a user makes multiple rapid edits, the sweep could be paused for an extended period, making the board stale to external changes.

### Component 3: Poll Interval Reduction

**Current default:** 30 seconds (`PollManager.DEFAULT_INTERVAL_MS = 30_000`)
**Proposed:** 15 seconds for writable external collections.

```typescript
// web/src/components/ft-app.ts — when setting up PollManager

private switchToPolling(): void {
    this.stopStream();
    this.isPolling = true;
    this.connectionStatus = 'polling';

    // Shorter interval for writable collections (user expects to see their changes quickly)
    const interval = this.isReadOnly
        ? PollManager.DEFAULT_INTERVAL_MS
        : 15_000;

    this.pollManager = new PollManager(this.client, this.taskStore, interval);
    // ... rest unchanged
}
```

**Rate limit math (15s sweep):**

| Repo Size | Pages/sweep | Sweeps/hr | API calls/hr (sweep only) | Budget remaining (of 5000) |
|-----------|-------------|-----------|---------------------------|----------------------------|
| ≤200 issues | 1 | 240 | 240 | 4760 |
| 500 issues | 3 | 240 | 720 | 4280 |
| 1000 issues | 5 | 240 | 1200 | 3800 |
| 2000 issues | 10 | 240 | 2400 | 2600 |

At 2000+ issues the sweep alone consumes ~50% of the hourly budget. For very large repos, the system should dynamically increase the interval. The implementation should watch GitHub's `X-RateLimit-Remaining` response header and back off when budget is low (e.g., double the interval when remaining < 1000).

### Component 4: Disable Unmappable Operations with Tooltips

For operations that have no GitHub equivalent, the UI should show controls as disabled with a tooltip explaining why. This requires a more granular capability model than a single `readOnly` boolean.

**Proposed: Per-operation capability flags on the collection:**

```typescript
// web/src/gen/types.ts or a new capabilities.ts

interface CollectionCapabilities {
    canEditTitle: boolean;        // GitHub: ✅
    canEditDescription: boolean;  // GitHub: ✅
    canChangeStage: boolean;      // GitHub: ✅ (via labels)
    canChangePriority: boolean;   // GitHub: ✅ (via labels)
    canChangeAssignee: boolean;   // GitHub: ✅ (after fix)
    canChangeParent: boolean;     // GitHub: ✅ (via sub-issues)
    canAddComment: boolean;       // GitHub: ✅
    canCloseTask: boolean;        // GitHub: ✅
    canCreateTask: boolean;       // GitHub: ✅
    canDeleteTask: boolean;       // GitHub: ❌ "GitHub does not support deleting issues"
    canEditDates: boolean;        // GitHub: ❌ "No native date fields on GitHub issues"
    canEditAcceptance: boolean;   // GitHub: ❌ "No acceptance criteria field on GitHub issues"
    canEditRelationships: boolean; // GitHub: ❌ "GitHub only supports parent-child, not blocks/blocked-by"
    canEditCodeContext: boolean;  // GitHub: ❌ "Not available for GitHub collections"
    canDragReorder: boolean;      // GitHub: ❌ "GitHub issues have no ordering"
}

function getCapabilities(collection: Collection): CollectionCapabilities {
    if (collection.platform === Platform.FARMTABLE) {
        return ALL_ENABLED;
    }
    if (collection.platform === Platform.GITHUB) {
        return {
            canEditTitle: true,
            canEditDescription: true,
            canChangeStage: true,
            canChangePriority: true,
            canChangeAssignee: true,
            canChangeParent: true,
            canAddComment: true,
            canCloseTask: true,
            canCreateTask: true,
            canDeleteTask: false,
            canEditDates: false,
            canEditAcceptance: false,
            canEditRelationships: false,
            canEditCodeContext: false,
            canDragReorder: false,
        };
    }
    return ALL_DISABLED; // unknown platforms default to read-only
}
```

Components that currently check `this.readOnly` would check the specific capability instead, with disabled controls showing a tooltip. The `readOnly` prop remains for the aggregate case (all capabilities disabled).

**Alternative considered:** Keep the single `readOnly` boolean and just enable everything that GitHub supports. Rejected: this would show edit controls for dates, acceptance criteria, and relationships that would silently fail when the server returns `ErrNotImplemented` (or worse, succeed but do nothing). Explicit capability flags prevent user confusion.

**Load-bearing decision:** The capability model is the right abstraction. When/if Linear or Jira passthrough is added, each platform will have a different capability set. Hard-coding platform checks throughout the UI doesn't scale.

### Component 5: Backend — Fix Assignee Write Bug

**Current bug** in `passthrough.go:369-371`:
```go
if p.AssigneeID != nil {
    _ = s.gql.updateIssueAssignees(ctx, issueID, nil)  // clears! doesn't set
}
```

**Fix:** Build a reverse lookup from Farmtable user UUID → GitHub login. The passthrough store already fetches all issues (which include assignee logins) to resolve the task UUID. We can build the map from that data:

```go
// passthrough.go — PROPOSED addition to UpdateTask

if p.AssigneeID != nil {
    // Build UUID → login map from current issue data
    var loginToSet string
    for _, issue := range issues {
        for _, a := range issue.Assignees.Nodes {
            if s.userUUID(string(a.Login)) == *p.AssigneeID {
                loginToSet = string(a.Login)
                break
            }
        }
        if loginToSet != "" { break }
    }
    if loginToSet != "" {
        _ = s.gql.updateIssueAssignees(ctx, issueID, []string{loginToSet})
    }
}
```

This reuses the same deterministic UUID mapping (`github:user:{login}` → SHA1 UUID) that the read path uses. The reverse lookup scans already-fetched issue data — no extra API call.

**Limitation:** Only assignees who appear on existing issues in the repo can be set. If the user wants to assign someone who has never been assigned to any issue in this repo, the reverse lookup will fail. This is acceptable for v1 — the workaround is to assign them on GitHub directly.

### Component 6: Backend — Per-Collection Writable Setting

The Collection entity already has a `remote_data` JSON field. Add `writable` as a recognized key:

```go
// Interpretation of collection.remote_data["writable"]
//
// Absent or null  → default (read-only for external collections)
// true            → writes enabled (UI unlocks write controls)
// false           → explicitly read-only (even if the platform supports writes)
```

**CLI surface:**

```bash
# Enable writes for a GitHub collection
ft collection update <id> --set-remote-data '{"writable": true}'

# Disable writes
ft collection update <id> --set-remote-data '{"writable": false}'
```

No schema changes needed — `remote_data` is already a JSON field. The server doesn't enforce this flag — it's purely a UI hint consumed by `isCollectionWritable()`. The PassThroughStore accepts writes regardless; the gating is in the frontend.

**Alternative considered:** A server-side guard that rejects writes to non-writable collections. Rejected: the CLI passthrough mode should always allow writes (it's the user's own terminal, their own token). The guard is a UI concern, not a server concern.

### Component 7: Write Feedback UX

**Toolbar badge update:**

```typescript
// CURRENT: "🔒 Read-only"
// PROPOSED for writable GitHub collections:
// "↔ GitHub" (or a GitHub icon) — indicates writes go to GitHub
```

When a write is in-flight, show a subtle spinner or status indicator near the task card or in the toolbar.

**Error handling:**

When a write fails (the optimistic rollback path), show a toast/snackbar:

| Error | Message |
|---|---|
| 403 Forbidden | "GitHub rejected this edit — your token may not have write access to this repo" |
| 404 Not Found | "This issue no longer exists on GitHub" |
| 422 Unprocessable | "GitHub rejected this change — the issue may have been locked" |
| Rate limit (429 / X-RateLimit-Remaining: 0) | "GitHub API rate limit reached — try again in N minutes" |
| Network error | "Could not reach GitHub — your change was not saved" |

The error messages should be platform-specific so the user knows WHERE the failure is (GitHub, not Farmtable).

---

## Alternatives Considered

### Alternative 1: Server-Side Write Guard (Reject writes at the gRPC layer)

**What:** Add a platform check in the server's `UpdateTask`, `CreateTask`, `CloseTask`, `AddComment` handlers that rejects writes for external collections unless a `writable` flag is set.

**Why rejected:** The MultiStore already routes writes correctly to the PassThroughStore. Adding a server-side guard means the CLI passthrough mode (which should always allow writes) would also be blocked. The frontend is the right place for this gate — it's a UX decision, not a security boundary.

### Alternative 2: Write-Through via GitHubAdapter (Sync Path)

**What:** Instead of using the PassThroughStore for writes, sync the task to the local DB first, then use the `GitHubAdapter.PushTask()` method to push the change to GitHub asynchronously.

**Why rejected:** This introduces local state for a collection that is otherwise stateless (passthrough). The passthrough's simplicity (no local cache, always-fresh reads) is its main advantage. Adding local state turns this into a Cat 3/Cat 4 hybrid without the benefits of either.

### Alternative 3: Immediate Full Refresh After Every Write

**What:** After every write, immediately trigger a full `ListTasks` refresh instead of relying on the 15s sweep.

**Why rejected:** Adds latency to every write operation (the refresh blocks UI responsiveness). The optimistic update already provides instant feedback. An immediate refresh also doubles the API calls per write. The 15s sweep catches external changes without per-write overhead.

---

## Migration / Rollout

This feature is entirely additive. No existing behavior changes:

1. **Existing farmtable-platform collections:** Completely unaffected. The `isReadOnly` getter still returns `false` for them via the `platform === Platform.FARMTABLE` check.
2. **Existing external collections:** Remain read-only by default. Write enablement requires an explicit `remote_data.writable = true` setting.
3. **CLI passthrough mode:** Continues to work as before. The CLI doesn't use the frontend, so the `isReadOnly` gate is irrelevant.
4. **The PollManager merge-based refresh** replaces the current `clear()`-based refresh. This is a strict improvement even for read-only collections (eliminates the brief "empty board" flash during refresh).

**Rollout sequence:**
- Phase 1 lands the core write-through and can be deployed immediately.
- Phase 2 (capabilities/tooltips) can follow in a separate PR.
- Phase 3 (polish) can be spread across multiple PRs.

---

## Open Questions

1. **Assignee picker UI.** When the user clicks "Add assignee" on a GitHub collection, what dropdown should appear? For native collections, it shows all Farmtable users. For GitHub, it should ideally show GitHub collaborators — but that requires an additional API call (`GET /repos/{owner}/{repo}/collaborators`). For v1, the picker could be hidden (assignee changes via drag or existing assignee tap only), or show assignees who appear on other issues in the collection.

2. **Create Task UI.** When creating a new task in a GitHub collection, should the "Add Task" button in the kanban column create a GitHub issue? The PassThroughStore's `CreateTask` already does this. The main question is whether the create form should hide fields that don't map to GitHub (acceptance criteria, dates, code context) or show them disabled.

3. **"View on GitHub" link prominence.** When writes are enabled, should the "View on GitHub" link be more prominent? The user may want to verify their change on GitHub after editing in Farmtable.

4. **Rate limit visibility.** Should the dashboard show the GitHub API rate limit budget somewhere (e.g., "4200/5000 remaining")? This would help power users manage their budget, especially for large repos with 15s sweep.

---

## Implementation Phases

### Phase 1: Core Write-Through (MVP)

**Summary:** Unlock writes for writable GitHub collections. Optimistic updates with dirty-task guard. 15s sweep. Per-collection `writable` flag.

**Scope:**
- `web/src/components/ft-app.ts` — Change `isReadOnly` getter to check `remote_data.writable`. Remove the `if (this.isReadOnly) return` guard from `onTaskUpdate`. Pass writable state to child components.
- `web/src/store/poll-manager.ts` — Add `dirtyTasks` set, `markDirty`/`clearDirty` methods. Change `refresh()` from clear-and-replace to merge-based (skip dirty tasks, delete removed tasks).
- `web/src/components/ft-app.ts` — Coordinate `applyTaskUpdate` with `pollManager.markDirty/clearDirty`. Accept poll interval parameter based on writable state (15s for writable external, 30s for read-only external).
- `web/src/components/ft-toolbar.ts` — Change read-only badge: show "↔ GitHub" (or similar) for writable external collections instead of "🔒 Read-only".
- `internal/platform/github/passthrough.go` — Fix assignee handling in `UpdateTask`: build UUID→login reverse map from issue data, call `updateIssueAssignees` with the resolved login.

**Deliverable:** Editing a task title on the dashboard for a `writable: true` GitHub collection updates the GitHub issue. Board refreshes within 15s to show the change.

### Phase 2: Capability-Based UI Gating

**Summary:** Replace the binary `readOnly` prop with per-operation capability flags. Disable unmappable operations with tooltips.

**Scope:**
- `web/src/gen/types.ts` (or new `capabilities.ts`) — Define `CollectionCapabilities` interface with per-operation booleans. Define `getCapabilities(collection)` function with platform-specific capability sets.
- `web/src/components/ft-app.ts` — Compute capabilities from current collection. Pass to child components alongside or instead of `readOnly`.
- `web/src/components/inspector/ft-inspector-meta.ts` — Check `canEditDates` before showing date edit controls. Check `canEditRelationships` before showing relationship controls. Show tooltip on disabled controls: "Not available for GitHub collections".
- `web/src/components/inspector/ft-inspector-desc.ts` — Check `canEditDescription` (always true for GitHub, but the pattern generalizes).
- `web/src/components/kanban/ft-kanban-column.ts` — Check `canDragReorder` for drag-and-drop within a column (reordering, not stage change). Stage-change drag uses `canChangeStage`.
- `web/src/components/tree/ft-tree-view.ts` — Check `canChangeParent` for hierarchy drag operations.
- `web/src/components/kanban/ft-kanban-view.ts` — Check `canCreateTask` for "Add Task" button.

**Deliverable:** Unmappable operations show as disabled with clear tooltips. Mapped operations work normally.

### Phase 3: Polish + Error Handling

**Summary:** Write error feedback, rate limit awareness, UX refinements.

**Scope:**
- `web/src/components/ft-app.ts` — Add toast/snackbar component for write error feedback. Map gRPC error codes to user-friendly messages (403 → "token lacks write access", rate limit → "GitHub rate limit reached").
- `web/src/store/poll-manager.ts` — Read `X-RateLimit-Remaining` from GitHub API responses (if exposed through gRPC metadata). Dynamically increase sweep interval when rate budget is low.
- `web/src/components/ft-toolbar.ts` — Optional: show rate limit indicator for GitHub collections.
- `internal/platform/github/passthrough.go` — Add missing write mappings: type label swap in `UpdateTask`, generic label add/remove in `UpdateTask`.
- Documentation: update the `web/src/components/ft-collection-list.ts` or relevant help text to explain the `writable` setting.

**Deliverable:** Write failures show clear, actionable errors. Rate limits are handled gracefully.

---

## Acceptance Criteria

### Phase 1 (Core Write-Through)
1. A GitHub collection with `remote_data.writable = true` renders with write controls enabled (no "Read-only" badge).
2. Editing a task title in the Inspector updates the GitHub issue title within 5 seconds.
3. Editing a task description in the Inspector updates the GitHub issue body.
4. Moving a card between kanban columns (stage change) adds/removes the appropriate label on the GitHub issue.
5. Changing priority in the Inspector adds/removes the appropriate priority label.
6. Adding a comment in the Inspector creates a comment on the GitHub issue.
7. Creating a task via "Add Task" creates a new GitHub issue.
8. Closing a task closes the GitHub issue with the appropriate reason.
9. Reparenting a task in tree view updates sub-issue relationships on GitHub.
10. Setting an assignee updates the GitHub issue assignee (for users who appear on existing issues).
11. After a write, the optimistic update is visible immediately — no flicker from the background sweep.
12. A GitHub collection WITHOUT `remote_data.writable` remains read-only (no regression).
13. Existing farmtable-platform collections are completely unaffected.
14. Background sweep interval is ≤15s for writable external collections.

### Phase 2 (Capability-Based UI Gating)
1. Date edit controls are disabled with tooltip "Not available for GitHub collections".
2. Acceptance criteria edit is disabled with tooltip.
3. Blocks/blocked-by relationship controls are disabled with tooltip.
4. Code context fields are disabled with tooltip.
5. Task deletion is disabled with tooltip "GitHub does not support deleting issues".
6. Within-column drag reorder is disabled (stage-change drag between columns still works).
7. All enabled operations continue to work correctly.

### Phase 3 (Polish + Error Handling)
1. A write failure due to 403 shows a toast: "GitHub rejected this edit — your token may not have write access".
2. A write failure due to rate limit shows a toast with remaining wait time.
3. The optimistic update rolls back visually on write failure.
4. Sweep interval dynamically increases when GitHub rate budget is low.
5. Type label changes work via write-through.
6. Generic label add/remove works via write-through.
