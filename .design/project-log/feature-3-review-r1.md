# Feature 3 Review: Inline Kanban Card Editing

**Date:** 2026-07-19
**Commit:** `e2ce803` on `feat/inline-card-edit`
**Reviewer:** Code Review Agent (R1)

---

## Review Summary

**Verdict:** APPROVE

**Overview:** This is a clean, well-structured addition of inline editing for task title and priority on Kanban cards. The implementation correctly follows the established optimistic-update pattern from `onStageChange`, handles edge cases (empty title, same-value no-op, Escape cancel, edit-mode drag suppression), and the event propagation boundaries are carefully managed. TypeScript compiles clean. No critical issues found.

---

## Findings

### Important Issues

#### 1. `priorityLabel` fallback removed — `undefined` rendered for unknown enum values

**File:** `web/src/components/kanban/ft-task-card.ts:318`

The old code had `PRIORITY_LABEL[t.priority ?? TaskPriority.UNSPECIFIED] ?? ''` with a `?? ''` fallback, and the badge was conditionally rendered only when `priorityLabel` was truthy. The new code uses `PRIORITY_LABEL[priority]` without a fallback, and `renderPriorityBadge` is called unconditionally. If a task arrives with a priority value outside the known enum (e.g., server adds a new priority level before the frontend is updated), `priorityLabel` will be `undefined` and the badge will render the literal text "undefined".

**Impact:** Low probability (requires proto enum drift), but visible UI corruption.

**Suggested Fix:**

```typescript
// line 318
const priorityLabel = PRIORITY_LABEL[priority] ?? 'Unknown';
```

Or add `UNSPECIFIED` to `PRIORITY_VARIANT` too so the full lookup chain is symmetric:

```typescript
const PRIORITY_VARIANT: Record<number, string> = {
  [TaskPriority.UNSPECIFIED]: 'neutral',   // ← add
  [TaskPriority.URGENT]: 'danger',
  ...
};
```

---

### Suggestions

#### 2. Title input lacks `maxlength` constraint

**File:** `web/src/components/kanban/ft-task-card.ts:337–346`

The `<sl-input>` for title editing has no `maxlength` attribute. A user could paste an extremely long string that would be submitted to the server. The card already truncates display to `MAX_TITLE_LEN` (80 chars), but the edit path bypasses this.

**Suggested Fix:** Add a reasonable `maxlength` to the input, or validate in `saveTitleEdit()`:

```html
<sl-input
  class="title-input"
  size="small"
  maxlength="200"
  value=${this.titleDraft}
  ...
></sl-input>
```

#### 3. Silent rollback on save failure — no user feedback

**File:** `web/src/components/kanban/ft-kanban-view.ts:173–176`

When `client.updateTask()` throws, the handler silently rolls back the optimistic update with `this.store.upsert(task)`. The user sees a brief flicker and has no idea the save failed. This follows the existing `onStageChange` pattern (line 148–149), so it's consistent, but both paths would benefit from a toast notification.

**Impact:** UX concern — users may believe edits were saved when they weren't.

**Suggested Fix:** Add a toast or snackbar notification on rollback. This applies to `onStageChange` too but is out of scope for this PR. Consider filing a follow-up issue.

#### 4. Minor: `Number()` cast on priority value has no NaN guard

**File:** `web/src/components/kanban/ft-task-card.ts:252`

```typescript
const nextPriority = Number((e.currentTarget as HTMLInputElement).value) as TaskPriority;
```

If `sl-select` somehow emits a non-numeric value, `Number(...)` returns `NaN`, which would be dispatched as the priority. In practice this can't happen because the `<sl-option>` values are all stringified integers, but a defensive check costs nothing:

```typescript
const raw = Number((e.currentTarget as HTMLInputElement).value);
if (Number.isNaN(raw)) return;
const nextPriority = raw as TaskPriority;
```

#### 5. Consider `@sl-after-hide` instead of `@sl-blur` for priority select cleanup

**File:** `web/src/components/kanban/ft-task-card.ts:284`

Using `@sl-blur` to exit priority-editing mode is pragmatic and works with the current Shoelace version. However, when `hoist` is set, the dropdown popup is teleported to the document body. In some edge cases (e.g., user scrolls the board while the dropdown is open), focus management can be unpredictable. Shoelace's `@sl-hide` event fires more reliably when the popup dismisses. Worth monitoring in manual QA.

---

### What's Done Well

1. **Edit-mode drag suppression is thorough.** The `draggable` attribute is dynamically set to `"false"` during editing (line 328), AND `onDragStart` has a belt-and-suspenders `e.preventDefault()` guard (lines 167–170). This prevents both drag initiation and the drag ghost image during inline editing.

2. **Blur/Escape race condition is correctly handled.** The `saveTitleEdit()` guard `if (!this.isEditingTitle) return` (line 207) prevents double-dispatch when Escape fires `cancelTitleEdit()` (setting `isEditingTitle = false`) and the subsequent DOM removal triggers a blur event that calls `saveTitleEdit()`. This is a common Lit footgun and it's handled correctly here.

3. **Event propagation is carefully managed.** `stopCardInteraction` prevents mousedown/click on edit controls from bubbling up to the card's click-to-select and drag handlers. Keyboard events (`onTitleKeyDown`) also call `stopPropagation()` to prevent parent keyboard handlers from interfering. The coverage is comprehensive across all interaction points.

4. **The `onTaskUpdate` handler correctly follows the established `onStageChange` pattern** — optimistic store update, async client call, rollback on error. The `parentTaskId` handling (null = delete, undefined = no-op, string = set) mirrors the `MockFarmTableClient.updateTask` logic exactly.

5. **Mock client fix is correct and minimal.** Changing `find` → `findIndex` + `MOCK_TASKS[taskIndex] = updated` is the right fix. The `-1` case is handled by the existing `if (!task) throw` guard since `MOCK_TASKS[-1]` is `undefined`.

6. **Good accessibility.** The pencil button has `label="Edit title"` for screen readers, the priority button has `title="Edit priority"`, and the priority button has a `:focus-visible` outline style with proper offset. The edit button is revealed on hover AND keyboard focus (`:focus-visible`).

---

### Verification Story

| Check                        | Result | Notes                                                |
|------------------------------|--------|------------------------------------------------------|
| TypeScript (`tsc --noEmit`)  | ✅ Pass | No type errors                                       |
| Tests                        | N/A    | No component tests exist yet (per TODO on line 11)   |
| Lint/static analysis         | ✅ Pass | tsc clean                                            |
| Security (XSS)               | ✅ Pass | Lit auto-escapes template text; no `unsafeHTML` used  |
| Pattern consistency          | ✅ Pass | Follows `onStageChange` optimistic-update pattern     |
| Event propagation            | ✅ Pass | All edit-mode interactions stop propagation correctly  |
| Keyboard handling            | ✅ Pass | Enter saves, Escape cancels, blur saves              |
| Drag suppression             | ✅ Pass | Both `draggable` attr and `onDragStart` guard present |

---

### Summary Table

| # | Severity   | File                          | Line | Description                                         |
|---|------------|-------------------------------|------|-----------------------------------------------------|
| 1 | Important  | ft-task-card.ts               | 318  | `priorityLabel` can be `undefined` for unknown enum |
| 2 | Suggestion | ft-task-card.ts               | 337  | Title input lacks `maxlength`                       |
| 3 | Suggestion | ft-kanban-view.ts             | 173  | Silent rollback — no user-visible error feedback    |
| 4 | Suggestion | ft-task-card.ts               | 252  | `Number()` cast has no NaN guard                    |
| 5 | Suggestion | ft-task-card.ts               | 284  | `@sl-blur` vs `@sl-hide` for hoisted select        |

**Verdict: APPROVE** — The single Important finding (#1) is a cosmetic edge case with very low probability. The code is well-structured, follows established patterns, and handles interaction edge cases correctly. Suggestions are quality-of-life improvements that can be addressed in a follow-up.
