# PR Review: feat/add-task-ui (Round 2)

**Branch:** `feat/add-task-ui` (2 commits ahead of `main`)
**Commits:**
- `01be179` feat: add kanban task creation UI
- `71e980f` fix: address review round 1 feedback for add-task-ui

**Reviewer:** Code Review Agent
**Date:** 2026-07-19

---

## Review Summary

**Verdict:** APPROVE

**Overview:** This PR adds a "Create Task" dialog to the Lit + Shoelace Kanban dashboard, wiring it to the gRPC-Web backend via a new `createTask` client method. The second commit cleanly addresses all critical and important issues from the first review round (footer slot projection, error feedback, escape-key dismissal guard, input length limits, optimistic store insert). The code is well-structured, follows established codebase patterns, and has no blocking issues.

---

## Critical Issues

None.

## Important Issues

None.

---

## Suggestions

### 1. [Medium] Dialog focus: prefer Shoelace's `sl-initial-focus` event over manual `focus()` call
**File:** `web/src/components/kanban/ft-add-task-dialog.ts:51-55`

The `show()` method manually calls `this.nameInput.focus()` after awaiting `this.dialog.show()`. While this works because Shoelace's `show()` promise resolves after the open animation completes, it races with the dialog's built-in autofocus behaviour (Shoelace focuses the first tabbable element by default, which then gets overridden by the manual call). Using the dedicated `sl-initial-focus` event is more idiomatic and fires at exactly the right lifecycle moment.

**Current:**
```typescript
async show() {
  await this.updateComplete;
  await this.dialog.show();
  this.nameInput.focus();
}
```

**Suggested fix — handle `sl-initial-focus` in the template:**
```typescript
// In render():
<sl-dialog
  label="Add Task"
  @sl-after-hide=${this.onAfterHide}
  @sl-request-close=${this.onRequestClose}
  @sl-initial-focus=${(e: Event) => {
    e.preventDefault();
    this.nameInput.focus();
  }}
>

// Simplify show():
async show() {
  await this.updateComplete;
  await this.dialog.show();
}
```

### 2. [Low] Error message is opaque — no distinction between failure causes
**File:** `web/src/components/kanban/ft-kanban-view.ts:168-169, 179`

Both the no-client guard and the catch branch display the identical hardcoded message: `'Failed to create task. Please try again.'`. A network timeout, a validation rejection, and a missing client all look the same to the user. Consider differentiating at least the connectivity case:

```typescript
if (!this.client) {
  dialog.setError('Not connected to the server. Please check your connection.');
  return;
}
```

> **Security note:** If gRPC error messages could contain internal details (stack traces, SQL), keep the generic catch-branch message and only log specifics to the console (which the code already does correctly).

### 3. [Low] `composed: true` on the `task-create` CustomEvent is unnecessary
**File:** `web/src/components/kanban/ft-add-task-dialog.ts:87-93`

The `task-create` event is dispatched from the `FtAddTaskDialog` host element via `this.dispatchEvent()` and caught on that same element in the parent's template (`<ft-add-task-dialog @task-create=...>`). The event never crosses a shadow DOM boundary. `composed: true` is harmless but misleading — it signals to future readers that the event is designed to escape shadow roots.

```typescript
this.dispatchEvent(
  new CustomEvent<TaskCreateDetail>('task-create', {
    detail: { name, description: description || undefined },
    bubbles: true,
    // composed: true is not needed here
  }),
);
```

### 4. [Nitpick] `close()` uses `void` to fire-and-forget `hide()` — silent rejection risk
**File:** `web/src/components/kanban/ft-add-task-dialog.ts:57-59`

```typescript
close() {
  void this.dialog.hide();
}
```

`void` silences TypeScript's floating-promise lint but also swallows a rejected promise. If Shoelace's `hide()` ever throws (unlikely, but possible during rapid open/close sequences), the rejection goes unhandled. Consider:

```typescript
close() {
  this.dialog.hide().catch(console.error);
}
```

---

## What's Done Well

1. **Clean component encapsulation.** The dialog is its own `FtAddTaskDialog` component with a clear public API (`show()`, `close()`, `setCreating()`, `setError()`). The parent `FtKanbanView` owns only the side-effectful orchestration (call client, upsert store, handle errors). This follows the existing pattern established by `onStageChange` for drag-and-drop updates.

2. **Correct footer slot projection.** The `<div class="actions" slot="footer">` is a direct child of `<sl-dialog>`, not nested inside the `<form>`. This ensures Shoelace's slot projection works correctly — buttons render in the dialog's sticky footer with proper padding and separation from scrollable content.

3. **Robust double-submit prevention.** The `isCreating` flag disables all interactive elements (both inputs, Cancel button, Create button), shows a loading spinner on Create, and blocks dialog dismissal via the `onRequestClose` handler (covering Escape key, overlay click, and the close button). All dismiss vectors are covered.

4. **Proper form validation.** The `onSubmit` handler trims input, writes the trimmed value back to the input element, then calls `reportValidity()` — ensuring the `required` constraint is checked against the cleaned value, not raw whitespace. `maxlength="255"` and `maxlength="10000"` enforce client-side length limits mirroring server constraints.

5. **Correct gRPC client plumbing.** The `createTask` method correctly registers as `unaryMethod('CreateTask', 'CreateTaskRequest', 'Task')` — matching the proto definition where `CreateTask` returns `Task` directly (not wrapped in a response message). The `toTask(response)` call correctly handles this unwrapped shape, unlike `getTask` which unwraps `response.task`.

6. **Optimistic store insert.** `onTaskCreate` calls `this.store.upsert(task)` with the server response before closing the dialog. This ensures the new task appears on the board immediately, regardless of the watch stream's polling interval. The `MockFarmTableClient` also mutates its shared array with `unshift()`, ensuring local-dev consistency.

7. **Clean state reset lifecycle.** All cleanup is centralized in `onAfterHide` (clear `isCreating`, `errorMessage`, input values). This fires after any hide — success close, user cancel, or programmatic dismiss — ensuring the dialog always resets cleanly for the next open.

8. **Interface-driven design.** `CreateTaskFields` is added to the shared `FarmTableServiceClient` interface, and both `GrpcFarmTableClient` and `MockFarmTableClient` implement it. The proto request construction conditionally sets `description` only when defined, avoiding empty-string pollution of optional proto fields.

9. **Proper Shoelace imports.** All new Shoelace component dependencies (`dialog`, `input`, `textarea`, `button`, `icon-button`) are registered in `index.ts` following the established side-effect-import pattern. The `ft-add-task-dialog` component import is ordered before `ft-kanban-view` (which depends on it).

---

## Verification Story

- **Tests reviewed:** No unit tests exist for any web components in this project. No new tests were added. This is a pre-existing gap, not introduced by this PR.
- **Build verified:** Yes — `tsc --noEmit` (via `npm run typecheck`) passes cleanly with zero errors.
- **Lint/static analysis clean:** TypeScript strict-mode compilation is clean. No new warnings.
- **Security checked:** Yes.
  - No XSS risk: all dynamic values rendered via Lit template literals are auto-escaped. `errorMessage` is hardcoded, not derived from user input or server responses.
  - No credential exposure: `collectionId` is resolved via the existing auth-aware `resolveCollectionId()` helper. No tokens appear in the new code paths.
  - Input validation: name is `required` + `maxlength="255"` + trimmed; description is `maxlength="10000"`. Server-side proto validation (`buf.validate`, `min_len = 1`) provides defense-in-depth.
  - No new dependencies introduced.

---

## Round 1 Issues — Resolution Status

All issues from the first review round have been addressed in commit `71e980f`:

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| 1 | Critical | Footer slot projection — buttons in body, not footer | **Fixed** — footer div is now a direct child of `sl-dialog` |
| 2 | High | No user-visible error feedback | **Fixed** — `errorMessage` state + `sl-alert` rendering added |
| 3 | High | Escape/overlay can dismiss dialog mid-creation | **Fixed** — `@sl-request-close` handler prevents close when `isCreating` |
| 4 | Medium | No input length limits | **Fixed** — `maxlength="255"` on name, `maxlength="10000"` on description |
| 5 | Medium | Created tasks don't appear on board (mock + real) | **Fixed** — `this.store.upsert(task)` called after successful create |
| 6 | Low | Duplicate `isCreatingTask` state | **Fixed** — removed from kanban view, dialog owns creating state |
