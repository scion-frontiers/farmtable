# PR Review: Feature 20 — New Collection Button + Modal

**Branch:** `feat/new-collection-modal`  
**Commit:** `4d0e353` on top of `18657ee` (main)  
**Reviewer:** Code Review Agent  
**Date:** 2026-07-19

---

## Review Summary

**Verdict:** APPROVE

**Overview:** This PR adds a "New Collection" button (plus-circle icon) next to the collection picker in the toolbar, which opens a Shoelace dialog to create a collection via gRPC, then navigates to the new collection's board. The implementation closely mirrors the established `ft-add-task-dialog` pattern, correctly uses the unscoped client for the create call, and re-uses the existing `collection-select` custom event for navigation — resulting in a clean, minimal, and well-integrated feature.

---

### Critical Issues

None.

### Important Issues

None.

### Suggestions

1. **[ft-toolbar.ts:206] Non-null assertion on `unscopedClient!`**  
   The `this.unscopedClient!.createCollection(...)` call uses a non-null assertion. While in practice `unscopedClient` is always set by `ft-app.ts` in `connectedCallback()` before the toolbar can be interacted with, a guard would prevent a confusing runtime crash if the component were ever rendered in isolation (e.g., Storybook, tests).

   **Suggested fix:**
   ```typescript
   private async onCollectionCreate(e: CustomEvent<{ name: string }>) {
     const dialog = this.newCollectionDialog;
     if (!this.unscopedClient) {
       dialog.setError('Service not available. Please reload.');
       return;
     }
     dialog.setError('');
     dialog.setCreating(true);
     try {
       const collection = await this.unscopedClient.createCollection(e.detail.name);
       // ...
   ```
   Note: The existing `ft-collection-picker` also receives the unscoped client without a guard, so this is consistent with the current codebase. Up to the author whether to address it here or leave it as a systemic improvement.

2. **[ft-new-collection-dialog.ts:119] `minlength="1"` is redundant with `required`**  
   The add-task-dialog pattern uses `required` without `minlength`. After `.trim()` is applied to the value and set back, `required` alone catches empty input via `reportValidity()`. The `minlength="1"` is harmless but inconsistent with the reference pattern.

3. **[index.ts:29] Redundant top-level import**  
   `ft-new-collection-dialog.ts` is already imported by `ft-toolbar.ts` (line 8), so the import at `index.ts:29` double-registers the side-effect. However, `ft-add-task-dialog` follows the same pattern (imported by its parent component AND by index.ts), so this is consistent. If it's an intentional convention to ensure all components are registered even if the parent tree changes, it's fine.

4. **[ft-toolbar.ts:10-15] Duplicated type alias**  
   The `NewCollectionDialog` structural type in ft-toolbar.ts duplicates the public API of `FtNewCollectionDialog`. Importing the class directly and using `instanceof`/the class type would provide compile-time safety if the dialog's API changes. However, this matches the existing Lit pattern in the codebase where Shoelace types are also structurally aliased, and importing the class would create a tighter coupling. Acceptable as-is.

---

### What's Done Well

- **Excellent pattern adherence.** The dialog component is a near-exact structural copy of `ft-add-task-dialog` — same Shoelace type aliases, same form submission flow, same `onRequestClose` guard, same `onAfterHide` cleanup, same `setCreating`/`setError` imperative API. This makes the codebase predictable and easy to maintain.

- **Correct client scoping.** Uses `unscopedClient` (created with `collectionId: null`) for `createCollection`, and the gRPC method correctly does NOT call `resolveCollectionId()`. This is the right semantic choice — creating a collection is a cross-collection operation.

- **Clean navigation integration.** Re-uses the existing `collection-select` custom event, which `ft-app.ts` already handles via `pushState` + `applyRoute()`. No new routing logic needed — the new collection appears in the URL and the app transitions to the board view automatically.

- **Proper accessibility.** The icon button has a descriptive `label="New collection"` for screen readers. The `sl-dialog` provides built-in focus trap and Escape-to-close. The `onRequestClose` handler correctly prevents accidental dismiss during in-flight creation.

- **Robust error handling.** Errors are caught, displayed in an `sl-alert variant="danger"` (matching the existing pattern), logged to console for debugging, and the `finally` block ensures `isCreating` is always reset even on error. The error message is also cleared on new attempts and on dialog close.

- **Input validation.** `required`, `maxlength="255"`, and `autocomplete="off"` are all appropriate. The `.trim()` before validation prevents whitespace-only names from being submitted.

- **Minimal and focused.** The dialog collects only a name, which is documented as intentional with a note about future expansion. The gRPC request sends only `{ name }`, letting the server set defaults for platform and other fields.

---

### Verification Story

- **Tests reviewed:** No tests added or modified. This is a UI-only change with no complex logic — the critical path (gRPC call, navigation) relies on existing tested infrastructure. Acceptable for this scope.
- **Build verified:** Yes — `npx tsc --noEmit` passes cleanly. `npm run build` produces a successful production bundle.
- **Lint/static analysis clean:** Yes — TypeScript strict mode passes with no errors.
- **Security checked:** Yes — input is bounded by `maxlength="255"`. The name is sent directly to the gRPC service which handles server-side validation. No credential exposure or injection vectors introduced.

---

### Files Reviewed

| File | Status | Notes |
|------|--------|-------|
| `web/src/components/ft-new-collection-dialog.ts` | NEW | Dialog component — clean pattern match |
| `web/src/components/ft-toolbar.ts` | MODIFIED | Button + dialog integration — well placed |
| `web/src/gen/grpc-client.ts` | MODIFIED | `createCollection` method — correct |
| `web/src/gen/service.ts` | MODIFIED | Interface + mock — complete and correct |
| `web/src/index.ts` | MODIFIED | Registration import — consistent with pattern |
| `.design/project-log/feature-20-new-collection-modal.md` | NEW | Log entry — clear and accurate |
