# PR Review: feat/task-detail-panel

**Branch:** `feat/task-detail-panel`
**Commits:** 5 (94020b7, 53228dc, 94d5aed, d1a04f7, 3627850)
**Files changed:** 8 (~400 lines)
**Reviewed:** 2026-07-19

---

## Review Summary

**Verdict:** APPROVE

**Overview:** This feature adds inline editing for description, due date, and start date in the inspector panel, plus extracts a shared `applyTaskUpdateFields()` helper to deduplicate optimistic update logic across `ft-app`, `ft-kanban-view`, and `MockFarmTableClient`. The code is well-structured, follows existing project patterns, and both `tsc --noEmit` and `vite build` pass cleanly. No critical issues were found.

---

### Critical Issues

None.

---

### Important Issues

**1. [Important] Optimistic rollback uses stale snapshot when concurrent edits overlap**
`web/src/components/ft-app.ts:142-155`

If a user saves a description and then immediately changes a due date, both `applyTaskUpdate()` calls run concurrently. Each captures `const task = this.taskStore.getTask(taskId)` at call time. If the first call fails, its `catch` block calls `this.taskStore.upsert(task)` with the snapshot from *before either* edit, rolling back the second edit's optimistic change too.

This is the same pattern used in `ft-kanban-view`, so it's a pre-existing design choice -- but this PR wires the inspector through the same path and makes concurrent edits more likely (description + dates are adjacent in the UI).

**Suggested Fix:** Track in-flight updates with a sequence counter or use the server response on success:
```ts
private async applyTaskUpdate(taskId: string, fields: UpdateTaskFields) {
  const task = this.taskStore.getTask(taskId);
  if (!task) return;

  const updated = applyTaskUpdateFields(task, fields);
  this.taskStore.upsert(updated);

  try {
    const serverTask = await this.client.updateTask(taskId, fields);
    // Reconcile with server truth on success
    this.taskStore.upsert(serverTask);
  } catch (error) {
    console.warn('Failed to update task; rolled back optimistic change', error);
    // Re-fetch current state instead of using stale snapshot
    const current = this.taskStore.getTask(taskId);
    if (current) {
      // Revert only the fields we changed
      const reverted = applyTaskUpdateFields(current, 
        Object.fromEntries(
          Object.keys(fields).map(k => [k, task[k as keyof Task]])
        ) as UpdateTaskFields
      );
      this.taskStore.upsert(reverted);
    }
  }
}
```

Or accept the current behavior and document it as a known limitation with a TODO -- the streaming reconciliation will correct the state within seconds.

---

### Suggestions

**2. [Suggestion] Server response discarded on successful update**
`web/src/components/ft-app.ts:150`

`this.client.updateTask()` returns the server's updated `Task` (with server-set fields like `updatedAt` and `version`), but the result is discarded. The optimistic snapshot stays in the store until the stream reconciles it. This is consistent with the kanban view's existing behavior and the stream will correct it, but using the server response would give instant consistency:

```ts
const serverTask = await this.client.updateTask(taskId, fields);
this.taskStore.upsert(serverTask);
```

**3. [Suggestion] Date picker always saves as UTC midnight -- potential user confusion**
`web/src/components/inspector/ft-inspector-meta.ts:110`

When saving a date, the code appends `T00:00:00.000Z`:
```ts
const nextValue = this.dateDraft ? `${this.dateDraft}T00:00:00.000Z` : null;
```

The `<input type="date">` displays dates in the user's local timezone. A user in UTC+13 who picks "July 20" gets a UTC timestamp for July 20 at midnight UTC, which is July 19 in most Western timezones. This is consistent with the existing `dateInputValue` helper (which extracts dates via `toISOString()`, staying in UTC) so it's internally consistent. Just noting this as a design decision worth documenting if dates become user-facing in notifications or reports.

**4. [Suggestion] Description editing doesn't guard against external updates during editing**
`web/src/components/inspector/ft-inspector-desc.ts:82-108`

If User A starts editing a description, and the streaming connection delivers an update from User B that changes the same description, the `description` property changes but `draft` keeps User A's text. When User A saves, User B's changes are silently overwritten. This is common UX behavior for short-form fields (Notion, Linear, etc. all do this), but consider adding a visual indicator when the underlying value changes during an edit session. Non-blocking.

**5. [Suggestion] Arrow-function allocations in `renderDateRow` template**
`web/src/components/inspector/ft-inspector-meta.ts:184-192`

The `@click=${() => this.startDateEdit(field)}` and `@click=${() => this.clearDateEdit(field)}` closures create new function objects on every render. Lit's event binding diffing will re-attach the listener each time. For a detail panel that re-renders infrequently this is negligible, but for consistency with the project's method-binding pattern elsewhere, consider using bound methods or a data attribute approach:

```ts
// Alternative: use data attributes
@click=${this.onEditClick}
// ...
private onEditClick(e: Event) {
  const field = (e.currentTarget as HTMLElement).dataset.field as EditableDateField;
  this.startDateEdit(field);
}
```

**6. [Nitpick] Double cast through `unknown` in `onDraftInput`**
`web/src/components/inspector/ft-inspector-desc.ts:90`

```ts
this.draft = (e.currentTarget as unknown as { value: string }).value;
```

Shoelace's `sl-textarea` isn't a standard `HTMLTextAreaElement`, justifying the cast. A typed Shoelace import or a comment explaining why would help future readers. Minor.

---

### What's Done Well

1. **Clean extraction of `applyTaskUpdateFields()`** -- The shared helper in `service.ts` eliminates three copies of the null-aware field merge logic. The `null` = delete, `undefined` = no-op, `value` = set tri-state pattern is clean and idiomatic for partial update semantics.

2. **Correct `null` date handling in `grpc-client.ts`** -- The `clearDueDate` / `clearStartDate` mapping matches the existing `clearParent` pattern exactly. The `if (=== null)` / `else if (!== undefined)` branching is correct and reads clearly.

3. **`UpdateTaskFields` type widening** -- `Omit<Partial<Task>, 'dueDate' | 'startDate'> & { dueDate?: string | null; startDate?: string | null }` is the right way to extend the type to support nullable dates without breaking existing call sites. Type-safe and backwards-compatible.

4. **Keyboard shortcuts on editors** -- Escape to cancel, Cmd/Ctrl+Enter to save for textarea, Enter to save for date input. Good accessibility defaults.

5. **Consistent event plumbing** -- `bubbles: true, composed: true` on all `task-update` events ensures they cross shadow DOM boundaries correctly. The inspector doesn't need to re-dispatch.

6. **XSS protection on description** -- The `renderMarkdown()` function uses DOMPurify before `unsafeHTML`, and the comment on line 177 of `ft-inspector-desc.ts` makes this explicit for reviewers. Good security practice.

7. **Labels row always visible now** -- Showing "None" instead of hiding the labels row creates visual consistency with the editable date rows. Nice UX touch.

---

### Verification Story

- **Tests reviewed:** No component tests exist for these UI components (pre-existing gap). The project log mentions Playwright verification against the live app.
- **Build verified:** Yes -- `tsc --noEmit` and `vite build` both pass cleanly.
- **Lint/static analysis clean:** Yes -- typecheck passes with zero errors.
- **Security checked:** Yes -- `unsafeHTML` usage is guarded by DOMPurify via `renderMarkdown()`. No raw user input injected into DOM. Date inputs are validated through `Number.isNaN(date.getTime())` guard. No credential exposure.

---

### Files Reviewed

| File | Lines | Role |
|------|-------|------|
| `web/src/gen/service.ts` | +31 | `UpdateTaskFields` type + `applyTaskUpdateFields()` helper |
| `web/src/gen/grpc-client.ts` | +12/-2 | Null date -> `clearDueDate`/`clearStartDate` mapping |
| `web/src/components/ft-app.ts` | +22/-1 | `onTaskUpdate` + `applyTaskUpdate` optimistic flow |
| `web/src/components/inspector/ft-inspector.ts` | +4/-2 | Wire `taskId` + `@task-update` |
| `web/src/components/inspector/ft-inspector-desc.ts` | +108/-5 | Description edit/view mode |
| `web/src/components/inspector/ft-inspector-meta.ts` | +143/-20 | Date edit/clear controls |
| `web/src/components/kanban/ft-kanban-view.ts` | +2/-8 | Refactor to use `applyTaskUpdateFields` |
| `.design/project-log/feature-4-task-detail-panel.md` | +35 | Feature documentation |
