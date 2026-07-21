# PR Review: feat/task-detail-panel — Inspector Inline Editing

**Reviewer:** Code Review Agent  
**Date:** 2026-07-19  
**Branch:** `feat/task-detail-panel` (4 commits, 8 files, +400/−44)

---

## Review Summary

**Verdict:** APPROVE

**Overview:** This PR adds inline editing for description, due date, and start date fields in the inspector panel, with optimistic-update-and-rollback wiring through `ft-app`. The changes are well-structured, follow existing patterns (mirroring the Kanban card update flow), and extract shared logic (`applyTaskUpdateFields`) to reduce duplication across three call sites. The risk level is **low** — no critical issues were found.

---

### Critical Issues

None.

---

### Important Issues

1. **[ft-inspector-desc.ts:104–106] Description trim comparison may cause silent no-op saves**

   `saveEdit()` trims the draft before comparing to `this.description`, but the original description is compared untrimmed. If a user intentionally edits a description to add/remove only leading/trailing whitespace, the trimmed result might match the original and the save is silently skipped. This is arguably correct behavior (trimming is desired), but the comparison should also trim the baseline for consistency:

   ```typescript
   // Current
   if (nextDescription === (this.description ?? '')) return;

   // Suggested (explicit about trimming both sides)
   if (nextDescription === (this.description ?? '').trim()) return;
   ```

   **Severity:** Important — edge case where a description with trailing whitespace is loaded from the server; user edits content but the trimmed result matches the trimmed original, yet differs from the stored value. Low practical impact but logically inconsistent.

2. **[ft-inspector-desc.ts:176–178] `unsafeHTML` with `renderMarkdown` — pre-existing pattern, but note the dependency**

   The `unsafeHTML(renderMarkdown(...))` usage is safe *only because* `renderMarkdown` runs DOMPurify. This was verified in `web/src/util/markdown.ts`. No new risk is introduced here — this is an existing pattern. Noting it for audit trail purposes: if `renderMarkdown` ever changes to skip sanitization, this becomes an XSS vector.

   **Severity:** Important (documentation) — no code change needed, but worth a comment at the call site or in the markdown util.

---

### Suggestions

1. **[ft-inspector-meta.ts:113] Date construction assumes UTC midnight — timezone display may surprise users**

   ```typescript
   const nextValue = this.dateDraft ? `${this.dateDraft}T00:00:00.000Z` : null;
   ```

   The `<input type="date">` yields a local-calendar date (e.g., `2026-07-20`). Appending `T00:00:00.000Z` interprets it as UTC midnight, which could display as the previous day in western-hemisphere timezones when formatted with `formatDate`. This is consistent with how dates arrive from the gRPC backend (`timestampToIso`), so it's not a regression, but worth noting for a future timezone-aware pass.

2. **[ft-inspector-meta.ts:79] Redundant `taskId` property**

   `FtInspectorMeta` receives both `.task` (which contains `task.id`) and a separate `taskId` attribute. The `taskId` is only used in `dispatchTaskUpdate` to stamp the event detail. Consider reading `this.task.id` directly instead of maintaining a separate property that must be kept in sync by the parent.

   ```typescript
   // Instead of:
   @property() taskId = '';
   // ...
   detail: { taskId: this.taskId, fields }

   // Could use:
   detail: { taskId: this.task.id, fields }
   ```

   Same applies to `ft-inspector-desc.ts` (line 73). This would eliminate a class of desync bugs where `taskId` and `.task` refer to different tasks.

3. **[ft-app.ts:149–155] Optimistic rollback restores stale object reference**

   When the server call fails, the rollback does `this.taskStore.upsert(task)` using the original snapshot. If another update arrived via the streaming connection between the optimistic write and the error, this rollback would overwrite it with a stale object. This is the same pattern used in `ft-kanban-view.ts`, so it's not a regression — but it's worth flagging as a known limitation. A version-based merge or re-fetch-on-error would be more robust.

4. **[ft-inspector-meta.ts:117] Type assertion on computed property name**

   ```typescript
   this.dispatchTaskUpdate({ [field]: nextValue } as UpdateTaskFields);
   ```

   The `as UpdateTaskFields` cast is necessary because TypeScript can't narrow a computed property key. This is fine and idiomatic, but a helper like `dateUpdateFields(field, value)` returning a properly typed `UpdateTaskFields` object would avoid the cast.

5. **[ft-inspector-desc.ts:89] Input cast uses `HTMLInputElement` for `sl-textarea`**

   ```typescript
   this.draft = (e.currentTarget as HTMLInputElement).value;
   ```

   `sl-textarea` is a Shoelace component, not a native `HTMLTextAreaElement` or `HTMLInputElement`. The `.value` property works in practice because Shoelace exposes it, but the cast is technically incorrect. Consider `(e.currentTarget as { value: string }).value` or the Shoelace type `SlTextarea`.

6. **[ft-inspector-meta.ts:234–250] Labels row is now always rendered even when empty**

   The original code conditionally hid the labels row when `t.labels.length === 0`. The new code always renders it with a "None" placeholder. This is a deliberate UX improvement for consistency with the date rows, but differs from the assignees row which also shows "Unassigned". Consistent behavior — good call.

---

### What's Done Well

- **`applyTaskUpdateFields` extraction** is excellent. Three call sites (Kanban, App, MockClient) now share one function for the nullable-field-aware merge logic. This eliminates a class of inconsistency bugs where one site handles `null` parentTaskId but not `null` dates.

- **Null date semantics in grpc-client.ts** correctly maps `null` → `clearDueDate`/`clearStartDate` booleans, following the established `clearParent` pattern. This is the right way to express "unset" in proto3 where fields can't be truly nullable.

- **Keyboard shortcuts** (Cmd+Enter to save, Escape to cancel) in the description editor are a nice UX touch that follows platform conventions.

- **Event bubbling with `composed: true`** on the `task-update` CustomEvent correctly crosses shadow DOM boundaries, allowing `ft-app` to handle events dispatched from deeply nested components.

- **Optimistic update pattern** is consistent with the existing Kanban implementation. The code captures the pre-mutation task, applies locally, then rolls back on error. Clear, predictable behavior.

- **The design log** (`.design/project-log/feature-4-task-detail-panel.md`) documents scope decisions (assignee/label editing deferred) and verification steps. Good project hygiene.

---

### Verification Story

- **Tests reviewed:** No new frontend tests added. The project has no existing component test infrastructure for the Lit web components — this is consistent with prior features. Backend tests pass (`go test ./...` — all OK).
- **Build verified:** Yes. `npm run typecheck` and `npm run build` (Vite) both pass cleanly.
- **Lint/static analysis clean:** TypeScript strict mode passes with no errors.
- **Security checked:** Yes. The `unsafeHTML` usage is guarded by DOMPurify via `renderMarkdown()`. No new unescaped user input paths. Date inputs are validated via native `<input type="date">` constraints plus `Date.parse` / `Number.isNaN` guards. No credential exposure.

---

### Summary of Changes by File

| File | Change |
|------|--------|
| `web/src/gen/service.ts` | Widen `UpdateTaskFields` to allow `null` for `dueDate`/`startDate`; extract `applyTaskUpdateFields()` |
| `web/src/gen/grpc-client.ts` | Map `null` date fields to `clearDueDate`/`clearStartDate` proto fields |
| `web/src/components/ft-app.ts` | Wire `@task-update` from inspector through `applyTaskUpdate` with optimistic rollback |
| `web/src/components/inspector/ft-inspector.ts` | Pass `taskId` attribute to `ft-inspector-meta` and `ft-inspector-desc` |
| `web/src/components/inspector/ft-inspector-desc.ts` | Add edit/view mode for description with save/cancel/keyboard shortcuts |
| `web/src/components/inspector/ft-inspector-meta.ts` | Add date editing/clearing with inline date picker; always show labels row |
| `web/src/components/kanban/ft-kanban-view.ts` | Refactor to use shared `applyTaskUpdateFields()` |
| `.design/project-log/feature-4-task-detail-panel.md` | Feature log and scope documentation |
