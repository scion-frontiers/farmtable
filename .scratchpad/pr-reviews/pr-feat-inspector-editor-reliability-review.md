# Code Review: feat/inspector-editor-reliability

**Branch:** `feat/inspector-editor-reliability`
**Commit:** `47be602 fix: reset inspector editor state on task switches`
**Files changed:** 3 files, +146 / -8 lines
**Reviewer:** Code Review Agent
**Date:** 2026-07-19

---

## Review Summary

**Verdict:** REQUEST CHANGES

**Overview:** This PR adds two missing behaviors to the inspector editors: (1) resetting edit state when the user switches tasks, and (2) click-outside-to-dismiss for all five editor types. The implementation is clean and consistent across the three components, with proper lifecycle management and idiomatic Lit usage. However, there is one important race condition in the priority editor where the capture-phase dismiss listener interacts badly with Shoelace's hoisted `sl-select` popup, causing priority selections to be silently dropped.

---

## Critical Issues

None.

---

## Important Issues

### 1. Hoisted `sl-select` popup race condition — priority selections silently dropped

**File:** `web/src/components/inspector/ft-inspector-header.ts`
**Lines:** 187-191 (dismiss handler), 217 (hoist attribute), 221-222 (sl-change / sl-after-hide)

**Description:**

The `sl-select` uses the `hoist` attribute (line 217), which moves its dropdown popup to `document.body` via Shoelace's floating-UI integration. This means the popup is **outside** the `ft-inspector-header` element's DOM tree.

When the user clicks a dropdown option:

1. `pointerdown` fires → the capture-phase document listener runs first
2. `e.composedPath().includes(this)` returns `false` because the hoisted popup is not a descendant of `this`
3. `onPriorityBlur()` fires → `isEditingPriority = false` → Lit queues a re-render (microtask)
4. After the `pointerdown` handler returns, the microtask queue runs → Lit re-renders → the `sl-select` is removed from the DOM
5. `mouseup` / `click` fire, but the select is detached → `sl-change` never fires
6. The user's priority selection is silently lost

This is exactly the blur/click race that Feature 5 R2 discovered, reintroduced through a different mechanism.

**Failure scenario:** User opens the priority dropdown, clicks "High" → the dropdown closes but the priority remains unchanged. No error is shown.

**Suggested Fix — Option A (minimal, recommended):** Exclude the hoisted popup from the "outside" check by querying the select's popup element:

```typescript
private onDocumentPointerDown = (e: PointerEvent) => {
  if (!this.isEditingPriority) return;
  const path = e.composedPath();
  if (path.includes(this)) return;

  // The hoisted popup lives in document.body, not in our shadow DOM.
  // Check whether the click landed inside the select's dropdown.
  const select = this.renderRoot.querySelector<HTMLElement & { popup?: { popup?: HTMLElement } }>(
    'sl-select.priority-select',
  );
  const popupBody = select?.popup?.popup;
  if (popupBody && path.includes(popupBody)) return;

  this.onPriorityBlur();
};
```

**Suggested Fix — Option B (simpler but less defensive):** Don't add the document dismiss listener for the priority editor at all. Shoelace's `sl-select` already handles outside-click dismissal natively — the `@sl-after-hide` handler (line 222) already calls `onPriorityBlur()`. Combined with `resetEditState()` in `willUpdate` for task switches, this covers all dismissal scenarios without the document listener:

```typescript
private async startPriorityEdit(e: Event) {
  e.stopPropagation();
  this.isEditingPriority = true;
  // Don't call this.addDismissListener() — sl-select handles its own outside-click
  await this.updateComplete;
  // ...
}
```

Option B is cleaner but creates an inconsistency with the other editors. Option A preserves the uniform pattern.

---

## Suggestions

### 2. Inconsistent task-identity detection pattern between desc and header/meta

**Files:** `ft-inspector-desc.ts:82-86` vs `ft-inspector-header.ts:124-132` / `ft-inspector-meta.ts:122-130`

**Description:**

`ft-inspector-desc` watches the `taskId` string property directly:
```typescript
if (changedProps.has('taskId')) {
  this.resetEditState();
}
```

`ft-inspector-header` and `ft-inspector-meta` watch the `task` object with a `prevTaskId` guard:
```typescript
if (!changedProps.has('task')) return;
const nextTaskId = this.task?.id ?? '';
if (nextTaskId !== this.prevTaskId) { ... }
```

The two patterns are **correct for their respective property types** (string primitive vs. object reference), but the differing approaches are worth a brief inline comment explaining why, for future maintainers. In particular, the header/meta pattern is necessary because Lit's `===` dirty check on object properties would fire `willUpdate` on every store refresh (new immutable object, same task ID), and the `prevTaskId` guard prevents unnecessary resets.

No code change required — just a documentation suggestion.

### 3. Consider `requestAnimationFrame` deferral as an alternative to popup-path check

**File:** `ft-inspector-header.ts:187-191`

If Option A above feels too coupled to Shoelace internals, an alternative is to defer the dismiss check by one animation frame. This lets the `sl-change` event fire on the same tick before the editor closes:

```typescript
private onDocumentPointerDown = (e: PointerEvent) => {
  if (!this.isEditingPriority) return;
  if (e.composedPath().includes(this)) return;
  // Defer to let sl-change fire first if the click was on a dropdown option.
  requestAnimationFrame(() => {
    if (this.isEditingPriority) {
      this.onPriorityBlur();
    }
  });
};
```

The `if (this.isEditingPriority)` guard inside the rAF ensures that if `onPriorityChange` already handled the selection (setting `isEditingPriority = false`), the deferred dismiss is a no-op. This avoids coupling to Shoelace's internal DOM structure, but introduces a one-frame delay before the dismiss visually takes effect (imperceptible to users).

### 4. `resetEditState()` in meta clears `availableUsers` but not `userCache` — add a comment

**File:** `ft-inspector-meta.ts:299-307`

`resetEditState()` clears `this.availableUsers = []` (the rendered list) but preserves `this.userCache` (the fetched data). This is intentionally correct — the cache avoids refetching on the next assignee pick. A brief comment would prevent a future maintainer from "fixing" this:

```typescript
private resetEditState() {
  this.editingDate = null;
  this.dateDraft = '';
  this.addingLabel = false;
  this.labelDraft = '';
  this.pickingAssignee = false;
  this.availableUsers = []; // Clear rendered list; intentionally keep userCache for next pick
  this.removeDismissListener();
}
```

### 5. Extract dismiss-listener pattern into a shared mixin

**Files:** All three inspector components

The same pattern (arrow-function handler, `addDismissListener`, `removeDismissListener`, `disconnectedCallback` cleanup, `composedPath` check) is repeated verbatim across all three components. If more inspector editors are added, consider extracting into a Lit reactive mixin:

```typescript
// util/dismiss-mixin.ts
type Constructor<T> = new (...args: any[]) => T;

export const DismissListenerMixin = <T extends Constructor<LitElement>>(superClass: T) => {
  class DismissMixin extends superClass {
    private _onDocPointerDown = (e: PointerEvent) => {
      if (e.composedPath().includes(this)) return;
      this.onOutsideClick(e);
    };

    protected addDismissListener() {
      document.addEventListener('pointerdown', this._onDocPointerDown, { capture: true });
    }
    protected removeDismissListener() {
      document.removeEventListener('pointerdown', this._onDocPointerDown, { capture: true });
    }
    protected onOutsideClick(_e: PointerEvent) { /* override in subclass */ }

    override disconnectedCallback() {
      super.disconnectedCallback();
      this.removeDismissListener();
    }
  }
  return DismissMixin as Constructor<InstanceType<T>> & T;
};
```

This is an optional future improvement — the current inline approach is fine for three components.

---

## What's Done Well

1. **Arrow-function event handlers** (`onDocumentPointerDown = (e) => {...}`) ensure stable function references for `addEventListener`/`removeEventListener` pairing. This avoids the classic "can't remove listener" leak.

2. **`composedPath().includes(this)`** is the correct Shadow DOM-aware technique for inside/outside detection. It correctly crosses shadow boundaries, which `event.target.closest()` would not.

3. **Capture-phase listeners** (`{ capture: true }`) ensure the dismiss handler fires before any `stopPropagation()` calls in child elements, which is critical for Shoelace components that aggressively stop propagation.

4. **`removeDismissListenerIfIdle()` in meta** is a well-designed guard for the multi-editor component. It prevents removing the listener while another editor is still active, without requiring reference counting. The `hasActiveEditor()` predicate is clear and easy to extend.

5. **`willUpdate` lifecycle hook** is the correct Lit choice for this use case — it fires before `render()`, has access to `changedProps`, and doesn't cause a redundant re-render (unlike `updated` which would need `requestUpdate()`).

6. **`prevTaskId` guard in header/meta** correctly handles the immutable-store pattern where object references change but identity doesn't. This prevents unnecessary state resets on store refreshes.

7. **Thorough cleanup in `disconnectedCallback`** — all three components properly call `super.disconnectedCallback()` and remove their document-level listeners, preventing memory leaks when the inspector is closed.

8. **meta's `disconnectedCallback` consolidation** — moving it from mid-file (base branch) to sit next to `willUpdate` improves readability and ensures the keydown listener cleanup (pre-existing) and the new pointerdown listener cleanup are visually co-located.

---

## Verification Story

- **Tests reviewed:** No test files exist for the inspector components (`find web/src -name '*.test.*' -o -name '*.spec.*'` returned empty). This is a pre-existing gap, not introduced by this PR.
- **Build verified:** Not run (web frontend — would require `npm install` + `npm run build`).
- **Lint/static analysis clean:** Not run.
- **Security checked:** Yes — no new external inputs, no credential exposure, no unsanitized content. The `unsafeHTML` usage in desc.ts is pre-existing and guarded by DOMPurify (per inline comment).
- **Memory leak check:** All document-level listeners have matching removal in every code path (save, cancel, task switch, component disconnect). No leaks identified.
- **Race condition check:** One race condition found (Important Issue #1 — hoisted popup). No blur/click race reintroduction for the other four editor types.

---

## Edge Cases Evaluated

| Scenario | Behavior | Verdict |
|---|---|---|
| Task property set to same object reference, same ID | `changedProps.has('task')` may be false (Lit `===` check) → `resetEditState` does not fire → edit state preserved | Correct |
| Task property set to new object, same ID | `prevTaskId` guard prevents reset | Correct |
| Task property set to null/undefined | `this.task?.id ?? ''` defaults to `''`, differs from previous → reset fires | Correct |
| Initial render (prevTaskId `''`, first task) | `resetEditState` fires, all state already default → no-op | Correct (harmless) |
| Two meta editors open simultaneously (e.g., date + label) | `removeDismissListenerIfIdle` keeps listener until both close | Correct |
| `startAssigneePick` throws (listUsers fails) | `pickingAssignee` stays true, dismiss listener active, UI shows empty picker, user can dismiss | Correct |
| Description changed externally while editing | `taskId` unchanged → `resetEditState` does NOT fire → draft preserved | Correct |

---

**Final recommendation:** Fix Important Issue #1 (hoisted dropdown race) before merge. The remaining items are suggestions for improved maintainability and can be addressed in a follow-up.
