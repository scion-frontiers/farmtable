## Review Summary

**Verdict:** APPROVE

**Overview:** This is a clean, well-scoped feature that wires the previously inert Phase and Assignee toolbar dropdowns to filter the Kanban board client-side. The data flow (toolbar → app → kanban-view) is sound, the filtering logic handles all declared combinations correctly, and the build passes with no type errors. One important behavioral gap (tree view not receiving filters) and a few minor suggestions are noted below.

---

### Critical Issues

None.

---

### Important Issues

**1. [ft-app.ts:122-128] Filters are not passed to `ft-tree-view` — inconsistent UX when switching views**

When a user applies Phase or Assignee filters in the toolbar and then switches to the Tree view, the toolbar dropdowns remain visually populated but the tree view shows unfiltered data. This creates a confusing state where the UI implies filters are active but the content doesn't reflect them.

```typescript
// Current: tree view receives no filter props
<ft-tree-view
  .store=${this.taskStore}
  .client=${this.client}
  selected-task-id=${this.selectedTaskId ?? ''}
  @task-select=${this.onTaskSelect}
></ft-tree-view>
```

**Recommended fix (choose one):**
- **(A)** Wire `.phaseFilter` and `.assigneeFilter` to `ft-tree-view` and implement filtering there (preferred — full feature parity).
- **(B)** Clear the filter state when switching to tree view, or disable/hide the filter dropdowns in tree view mode.
- **(C)** If this is intentionally deferred, add a code comment and consider disabling the dropdowns when `currentView === 'tree'`.

**2. [ft-toolbar.ts:72-76, 180-183] Toolbar mutates properties it receives from parent — dual ownership of filter state**

The toolbar receives `phaseFilter` and `assigneeFilter` as `@property()` bindings from `ft-app`, but also directly mutates them in the change handlers before dispatching the event upward:

```typescript
private onPhaseFilterChange(e: Event) {
    const value = this.selectValue(e);
    this.phaseFilter = value ? Number(value) as TaskPhase : null;  // local mutation
    this.dispatchFilterChange();  // then tells parent
}
```

This creates two owners of the same state. The parent updates its own copies, which flow back down as properties, causing a redundant render cycle. Lit will no-op the second render since the values match, so this is not a correctness bug, but it's an anti-pattern that could cause subtle issues if the parent ever needs to reject or modify a filter value (e.g., validation, analytics gating).

**Suggested fix:** Remove the local property mutations; let the event be the only communication channel and let the parent own the state:

```typescript
private onPhaseFilterChange(e: Event) {
    const value = this.selectValue(e);
    const phase = value ? Number(value) as TaskPhase : null;
    this.dispatchFilterChange(phase, this.assigneeFilter);
}

private onAssigneeFilterChange(e: Event) {
    const value = this.selectValue(e);
    const assigneeId = value || null;
    this.dispatchFilterChange(this.phaseFilter, assigneeId);
}

private dispatchFilterChange(phase: TaskPhase | null, assigneeId: string | null) {
    this.dispatchEvent(
        new CustomEvent<TaskFilterChangeDetail>('filter-change', {
            detail: { phase, assigneeId },
            bubbles: true,
            composed: true,
        }),
    );
}
```

Since the parent passes the updated values back down as properties, the toolbar's `value` bindings will reflect the correct state on the next render.

---

### Suggestions

**3. [ft-toolbar.ts:159-178] No user-visible feedback on `listUsers()` failure**

When `listUsers()` fails, the assignee dropdown silently shows only the "Unassigned" option. The user has no way to distinguish between "no users exist in the system" and "the API call failed." A subtle loading or error state would improve UX.

```typescript
// Option A: Show a disabled placeholder option while loading
@state()
private usersLoading = false;

private async loadUsers() {
    const token = ++this.userLoadToken;
    if (!this.client) { this.users = []; return; }
    this.usersLoading = true;
    try {
        const users = await this.client.listUsers();
        if (token === this.userLoadToken) { this.users = users; }
    } catch (error) {
        if (token === this.userLoadToken) { this.users = []; }
        console.warn('Failed to load toolbar assignee filters', error);
    } finally {
        if (token === this.userLoadToken) { this.usersLoading = false; }
    }
}
```

**4. [ft-toolbar.ts:8-13] Consider adding a comment explaining why `UNSPECIFIED` is excluded from `PHASE_OPTIONS`**

`TaskPhase.UNSPECIFIED = 0` exists in the proto-generated enum but is intentionally omitted from the dropdown. A one-line comment would prevent a future developer from "fixing" this by adding it.

```typescript
// TaskPhase.UNSPECIFIED (0) is a protobuf default, not a user-selectable state.
const PHASE_OPTIONS = [
  { value: TaskPhase.OPEN, label: 'Open' },
  ...
```

**5. [ft-kanban-view.ts:153-158] `onHoldTotal` getter calls `getColumnTasks()` per column — redundant filter passes**

The `onHoldTotal` getter reduces over `ON_HOLD_STAGES`, calling `getColumnTasks()` for each stage, which in turn calls `store.getByStage()` then `matchesFilters()`. These same calls happen again during `render()` when the on-hold columns are expanded. This means filtered task lists for on-hold stages are computed twice per render cycle.

This is not a performance problem at typical task counts (hundreds), but if you want to optimize later, consider memoizing `getColumnTasks()` results or computing them once per render in `render()` and passing them to both the count and the column template.

---

### What's Done Well

1. **Staleness token pattern in `loadUsers()`** — The `userLoadToken` is a clean, lightweight guard against stale async responses. Incrementing on each call and comparing on resolution correctly handles rapid client changes and concurrent loads without needing AbortController.

2. **Clean shared types module** — `task-filters.ts` is minimal and purpose-built: one sentinel constant and one interface. It avoids coupling the toolbar to the kanban view while providing type safety for the event detail.

3. **Thorough `matchesFilters()` logic** — The method correctly handles all five filter combinations: no filters, phase-only, assignee-only, unassigned-only, and combined AND. The early return on phase mismatch avoids unnecessary assignee checks.

4. **Defensive `selectValue()` helper** — Handling both `string` and `string[]` return types from `sl-select` is good defensive coding that won't break if someone accidentally adds `multiple` to a select in the future.

5. **Proper custom event composition** — Using `bubbles: true, composed: true` ensures the `filter-change` event crosses shadow DOM boundaries correctly in the Lit component tree.

6. **`hoist` attribute on `sl-select`** — Adding `hoist` to the dropdowns ensures the option popovers render outside the toolbar's overflow context, preventing clipping.

---

### Verification Story

- **Tests reviewed:** No tests were added or modified in this PR. The existing codebase does not appear to have component tests for the web layer (there's a `TODO(test-coverage)` comment in `ft-kanban-view.ts`). Given the simplicity of the logic, this is acceptable for this PR, but `matchesFilters()` would benefit from unit tests as a follow-up.
- **Build verified:** Yes — `tsc --noEmit && vite build` passes cleanly with no type errors and no warnings beyond an existing chunk-size notice.
- **Lint/static analysis clean:** No lint script configured in the project.
- **Security checked:** Yes — no injection vectors. The `UNASSIGNED_FILTER_VALUE` sentinel is a hardcoded string constant compared with `===`; user IDs flow through property bindings, not innerHTML. `user.name` and `user.email` are rendered via Lit's template literals which auto-escape. No credential exposure. The `listUsers()` call uses the existing authenticated gRPC client.
