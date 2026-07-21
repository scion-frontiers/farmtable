# Review: feat/per-column-create

**Branch:** `feat/per-column-create` (2 commits: `fa7f020`, `5538fbf`)
**Reviewer:** Code Review Agent
**Date:** 2026-07-19

## Review Summary

**Verdict:** APPROVE

**Overview:** This PR adds per-column inline task creation to the Kanban board —
a focused, well-scoped feature. The code is clean, follows existing Lit/Shoelace
patterns, and the refactored `phaseForStage` is an improvement over the original.
No critical or blocking issues found; a handful of minor observations follow.

---

### Critical Issues

None.

### Important Issues

1. **[web/src/gen/service.ts:37–61] `phaseForStage` is exported from the service
   layer but encodes UI-domain knowledge**

   The function maps `TaskStage` to `TaskPhase`, which is a domain-level concern.
   Exporting it from `service.ts` (a file that also defines the client interface
   and mock data) couples the service contract to stage-phase mapping logic.
   Today only the mock client and the kanban view import it, but as usage grows
   this could pull UI-layer callers into the service module or vice versa.

   **Severity:** Medium (architectural, not a bug)

   **Suggested fix:** Move `phaseForStage` to a shared utility file
   (e.g., `web/src/gen/stage-utils.ts` or `web/src/gen/types-util.ts`) and
   import it from both `service.ts` and `ft-kanban-view.ts`. This keeps the
   service interface file focused on contract definitions. Not blocking for this
   PR, but worth addressing before additional callers appear.

2. **[web/src/components/kanban/ft-kanban-view.ts:183–187] Client-side stage
   override on the server response**

   ```ts
   this.store.upsert(
     e.detail.stage
       ? { ...task, stage: e.detail.stage, phase: phaseForStage(e.detail.stage) }
       : task,
   );
   ```

   This overrides the server response's `stage` and `phase` when a target stage
   was requested. While the TODO comment clearly documents the intent and the
   temporary nature, this introduces a correctness risk: if the server
   legitimately rejects or modifies the requested stage (e.g., stage transitions
   the user is not authorized to make), the client silently ignores that.

   **Severity:** Medium (correctness concern during rollout)

   **Suggested fix:** Consider comparing `task.stage !== e.detail.stage` before
   overriding, and logging a warning when the server response differs from the
   request — this way the safety net still works but discrepancies become visible
   in dev tools:

   ```ts
   if (e.detail.stage && task.stage !== e.detail.stage) {
     console.warn(
       `Server returned stage ${task.stage}, overriding to requested ${e.detail.stage}`
     );
   }
   const finalTask = e.detail.stage
     ? { ...task, stage: e.detail.stage, phase: phaseForStage(e.detail.stage) }
     : task;
   this.store.upsert(finalTask);
   ```

### Suggestions

1. **[web/src/components/kanban/ft-add-task-dialog.ts:53–57] `targetStage` and
   `targetStageLabel` are `@property` but behave as internal state**

   These properties are set imperatively via `setTarget()` and reset on dialog
   close. They are never set via HTML attributes or parent-template bindings.
   Using `@state()` instead of `@property()` would better communicate that these
   are internal reactive state, not part of the public element API.

   **Severity:** Nitpick

   ```ts
   @state()
   private targetStage: TaskStage | null = null;

   @state()
   private targetStageLabel = '';
   ```

   Note: this would require updating `setTarget()` since private fields can't be
   set from outside. Since `setTarget()` IS the public API, this is the cleaner
   contract. Alternatively, keep `@property()` and remove `setTarget()` in favor
   of direct property assignment from the view — both approaches are valid.

2. **[web/src/components/kanban/ft-kanban-view.ts:161–166] Optional chaining on
   `dialog` without fallback**

   ```ts
   const dialog = this.renderRoot.querySelector<FtAddTaskDialog>('ft-add-task-dialog');
   dialog?.setTarget(stage, label);
   await dialog?.show();
   ```

   If `querySelector` returns `null` (shouldn't happen in normal operation since
   the dialog is always in the template), the function silently no-ops. This
   matches the existing pattern in `openAddTaskDialog()`, so it's consistent.
   However, a defensive `console.warn` or early return would make debugging
   easier if the dialog element is ever missing.

   **Severity:** Nitpick

3. **[web/src/components/kanban/ft-kanban-column.ts:153–162] `e.stopPropagation()`
   on the MouseEvent is correct but worth a brief comment**

   The `stopPropagation()` prevents the click from reaching any future header
   click handlers. A one-line comment explaining why would help future readers:

   ```ts
   private onAddTaskClick(e: MouseEvent) {
     // Prevent click from propagating to any header-level handlers.
     e.stopPropagation();
   ```

   **Severity:** Nitpick

4. **[web/src/components/kanban/ft-kanban-view.ts:10] TODO for test coverage**

   The `// TODO(test-coverage)` comment is appreciated — it's honest about the
   gap. Consider filing a tracked task for this so it doesn't get lost.

   **Severity:** Low

### What's Done Well

- **Exhaustive `phaseForStage` switch.** The refactored function in `service.ts`
  is a clear improvement over the old `Array.find()` approach. It now correctly
  maps `WONT_FIX`, `DUPLICATE`, and `CANCELLED` to `TaskPhase.CLOSED` instead
  of falling through to `UNSPECIFIED`. The `default: return TaskPhase.UNSPECIFIED`
  handles future enum extensions gracefully.

- **Clean event architecture.** The `column-add-task` custom event follows the
  same `{ bubbles: true, composed: true }` pattern as the existing `stage-change`
  event. The column dispatches, the view listens — no coupling between siblings,
  no shared mutable state.

- **Dialog state lifecycle.** Target stage state is set before `show()` and
  cleaned up in `onAfterHide()`. This prevents stale state from leaking between
  dialog invocations (e.g., opening via the column "+" then later via the global
  "Add Task" button).

- **Defensive client-side override.** The `TODO(server-stage-support)` pattern
  is well-documented and clearly scoped for removal. The `e.detail.stage ?` check
  ensures the global "Add Task" path (no target stage) is completely unaffected.

- **Accessibility.** The `sl-icon-button` includes a descriptive `label` attribute
  (`Add task to ${this.label}`), which provides proper screen-reader context for
  each column's button.

- **Progressive disclosure CSS.** The `opacity: 0.35` default with hover
  transitions keeps the "+" button discoverable without cluttering the column
  headers. The `:focus-visible` rule ensures keyboard users also see the control.

- **gRPC client change is minimal and correct.** The single-line addition in
  `grpc-client.ts` (`if (fields.stage !== undefined) request.stage = fields.stage`)
  follows the exact same guarded-optional pattern as the existing
  `fields.description` line.

### Verification Story

- **Tests reviewed:** No test files exist in the web project. The TODO comment
  acknowledges the gap. No regressions possible against an existing suite.
- **Build verified:** Yes. `npm run typecheck` (`tsc --noEmit`) passes cleanly
  with zero errors.
- **Lint/static analysis clean:** No lint tooling is configured in `package.json`.
  TypeScript strict mode serves as the primary static check — passes.
- **Security checked:** Yes. No user-controlled strings reach `innerHTML` or
  unsafe sinks. The dialog label uses Lit's template auto-escaping. Stage values
  are numeric enums, not arbitrary strings. The gRPC client only forwards the
  stage when explicitly provided.

---

**Final Verdict: APPROVE**

The change is well-structured, correctly implemented, and follows existing
project patterns. The two medium-severity observations (service-layer placement
of `phaseForStage` and the silent server-response override) are worth tracking
for follow-up but are not blocking. The feature works correctly for both the
column-specific and global "Add Task" flows.
