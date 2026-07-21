# PR Review: feat/per-column-create — Per-Column Inline Task Creation Controls

## Review Summary

**Verdict:** APPROVE (with recommendations)

**Overview:** This PR adds a "+" button to each Kanban column header that opens
the existing Add Task dialog targeted to that column's stage. The implementation
is clean, follows existing component patterns well, and correctly reuses the
single dialog surface. There is one Important-level issue (duplicated
`phaseForStage` with divergent semantics) and a few minor items worth addressing
in a follow-up.

---

### Critical Issues

None.

---

### Important Issues

#### 1. Duplicated `phaseForStage` with divergent behavior for ON_HOLD stages
**Severity:** Important  
**Files:** `web/src/gen/service.ts:37-53` (new) vs `web/src/components/kanban/ft-kanban-view.ts:41-44` (pre-existing)

Two independent `phaseForStage` functions now exist with different semantics:

| Stage              | `service.ts` (new) | `ft-kanban-view.ts` (existing) |
|--------------------|---------------------|-------------------------------|
| BLOCKED            | OPEN (default)      | ON_HOLD                       |
| WAITING_FOR_INPUT  | OPEN (default)      | ON_HOLD                       |
| DEFERRED           | OPEN (default)      | ON_HOLD                       |
| SCHEDULED          | OPEN (default)      | ON_HOLD                       |
| Unknown/default    | OPEN                | UNSPECIFIED                   |

**Impact:** If a user creates a task into an ON_HOLD column (e.g., "Blocked"),
the mock client returns `phase: OPEN` while the kanban view's client-side
override in `onTaskCreate` applies `phase: ON_HOLD`. This means:

- With the mock client: the override in `onTaskCreate` masks the bug (it
  overwrites the server response).
- With the real gRPC server: if the server's `phaseForStage` matches
  `service.ts` semantics (returns OPEN for ON_HOLD stages), the client-side
  override silently corrects it — but if the override is ever removed, tasks
  would land in the wrong phase.
- The override itself is described as "defensive" in the project log, but it
  actively papers over a real inconsistency.

**Suggested Fix:** Export a single canonical `phaseForStage` from `service.ts`
(or a shared utility) and use it in both places. The `service.ts` version should
handle ON_HOLD stages correctly:

```typescript
// web/src/gen/service.ts — export and fix
export function phaseForStage(stage: TaskStage): TaskPhase {
  switch (stage) {
    case TaskStage.TRIAGE:
    case TaskStage.BACKLOG:
    case TaskStage.READY:
      return TaskPhase.OPEN;
    case TaskStage.WORKING:
    case TaskStage.IN_REVIEW:
    case TaskStage.IN_QA:
    case TaskStage.DEPLOYING:
      return TaskPhase.IN_PROGRESS;
    case TaskStage.BLOCKED:
    case TaskStage.WAITING_FOR_INPUT:
    case TaskStage.DEFERRED:
    case TaskStage.SCHEDULED:
      return TaskPhase.ON_HOLD;
    case TaskStage.COMPLETED:
    case TaskStage.WONT_FIX:
    case TaskStage.DUPLICATE:
    case TaskStage.CANCELLED:
      return TaskPhase.CLOSED;
    default:
      return TaskPhase.UNSPECIFIED;
  }
}
```

Then import it in `ft-kanban-view.ts` instead of maintaining the local copy.

---

#### 2. Client-side stage/phase override in `onTaskCreate` is a trust concern
**Severity:** Important  
**File:** `web/src/components/kanban/ft-kanban-view.ts:183-186`

```typescript
this.store.upsert(
  e.detail.stage
    ? { ...task, stage: e.detail.stage, phase: phaseForStage(e.detail.stage) }
    : task,
);
```

After `createTask()` returns the server-authoritative task, this code overwrites
the response's `stage` and `phase` with client-side values. This is problematic
because:

- It discards any server-side validation or normalization of the stage.
- If the server rejects or remaps the stage (e.g., access control, workflow
  rules), the UI will show incorrect state until the next data refresh.
- The pattern sets a precedent of treating the server response as untrusted
  while the client request is trusted — the opposite of the normal trust model.

**Suggested Fix:** Trust the server response. If the server doesn't support the
`stage` field yet and always returns TRIAGE, fix it server-side rather than
patching client-side. If this is a temporary measure until the server catches up,
add a `// TODO:` comment explaining when to remove it:

```typescript
// TODO(server-stage-support): Remove client-side override once CreateTask
// honors the stage field in the request. Track: FARM-XXX
this.store.upsert(
  e.detail.stage
    ? { ...task, stage: e.detail.stage, phase: phaseForStage(e.detail.stage) }
    : task,
);
```

---

### Suggestions

#### 3. `targetStage` truthiness check is fragile with `TaskStage.UNSPECIFIED = 0`
**Severity:** Suggestion  
**File:** `web/src/components/kanban/ft-add-task-dialog.ts:129`

```typescript
label=${this.targetStage ? `Add Task to ${this.targetStageLabel}` : 'Add Task'}
```

`TaskStage.UNSPECIFIED = 0`, so `this.targetStage` would be falsy if someone
ever passed `UNSPECIFIED` as a stage. Currently safe because `setTarget()` is
only called with real column stages and the reset path sets `null`, but using
`!= null` would be more defensive:

```typescript
label=${this.targetStage != null ? `Add Task to ${this.targetStageLabel}` : 'Add Task'}
```

Similarly on line 105:
```typescript
stage: this.targetStage ?? undefined,
```
This is correctly null-safe via `??` — good.

#### 4. Missing `size="small"` on the `sl-icon-button`
**Severity:** Suggestion  
**File:** `web/src/components/kanban/ft-kanban-column.ts:173-178`

The CSS sets `--sl-input-height-small: 1.5rem` to resize the button, but
`sl-icon-button` defaults to `size="medium"`. Adding `size="small"` would make
the sizing more explicit and consistent with Shoelace conventions:

```html
<sl-icon-button
  class="add-task-button"
  name="plus"
  size="small"
  label=${`Add task to ${this.label}`}
  @click=${this.onAddTaskClick}
></sl-icon-button>
```

#### 5. No tests for the new behavior
**Severity:** Suggestion

No test files exist in the kanban directory. While this is pre-existing technical
debt (not introduced by this PR), the new per-column create flow — especially the
stage propagation and dialog targeting — would benefit from unit tests. Consider
adding tests for:

- `setTarget()` sets `targetStage` and `targetStageLabel` correctly
- `onAfterHide` resets target state
- `task-create` event includes the stage when targeted
- `column-add-task` event includes the correct stage and label

---

### What's Done Well

- **Single dialog surface:** Reusing the existing `ft-add-task-dialog` with
  target state rather than creating per-column dialogs is the right
  architectural call. It keeps DOM weight low and dialog behavior consistent.

- **Clean state reset:** The `onAfterHide` handler correctly resets
  `targetStage` and `targetStageLabel`, preventing stale state from leaking
  between dialog opens.

- **Progressive disclosure UX:** The `opacity: 0.35` default with hover reveal
  is a good pattern — the add button is discoverable without cluttering the
  column header. The `focus-visible` selector ensures keyboard accessibility.

- **Correct event wiring:** The `column-add-task` event is registered on both
  `.board` and `.on-hold-columns` containers, ensuring it works for all column
  types including the collapsible on-hold section.

- **`stopPropagation` on click:** The `onAddTaskClick` handler correctly stops
  propagation to prevent the click from triggering any parent handlers.

- **Consistent pattern with existing code:** The `column-add-task` custom event
  follows the exact same `bubbles: true, composed: true` pattern used by the
  existing `stage-change` event, maintaining consistency.

---

### Verification Story

- **Tests reviewed:** No tests exist for kanban components (pre-existing gap).
  No new tests added.
- **Build verified:** Yes — `tsc --noEmit` passes cleanly.
- **Lint/static analysis clean:** Yes — no type errors.
- **Security checked:** Yes — no injection vectors. Stage values are enum
  numbers, not user-supplied strings. The dialog label uses Lit's built-in
  template escaping.

---

### Summary Table

| #  | Severity   | File                              | Line(s) | Issue                                            |
|----|------------|-----------------------------------|---------|--------------------------------------------------|
| 1  | Important  | `service.ts` / `ft-kanban-view.ts`| 37-53 / 41-44 | Duplicated `phaseForStage` with divergent ON_HOLD handling |
| 2  | Important  | `ft-kanban-view.ts`               | 183-186 | Client-side override of server response          |
| 3  | Suggestion | `ft-add-task-dialog.ts`           | 129     | Truthiness check fragile with enum value 0       |
| 4  | Suggestion | `ft-kanban-column.ts`             | 173-178 | Missing `size="small"` on icon button            |
| 5  | Suggestion | —                                 | —       | No tests for new behavior                        |
