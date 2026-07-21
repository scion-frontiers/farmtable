# PR Review: Feature 20 — New Collection Button + Modal (R2)

**Branch:** `feat/new-collection-modal`  
**Commits:** `4d0e353` + `d622196` on top of `18657ee` (main)  
**Reviewer:** Code Review Agent  
**Date:** 2026-07-19  
**Review round:** 2 (post-feedback fixes)

---

## Review Summary

**Verdict:** APPROVE

**Overview:** This is a low-risk, well-scoped UI feature that adds a "New Collection" button and creation dialog to the toolbar. The second commit cleanly addresses all actionable suggestions from R1 (removed redundant `minlength`, added null guard for `unscopedClient`, removed duplicate index.ts import). The implementation is a faithful application of the established `ft-add-task-dialog` pattern with correct client scoping, error handling, and navigation integration.

---

### Critical Issues

None.

### Important Issues

None.

### Suggestions

1. **[ft-toolbar.ts:201] `CollectionCreateDetail` type not imported from dialog**  
   The toolbar types the event as `CustomEvent<{ name: string }>` inline, while the dialog exports `CollectionCreateDetail` for exactly this purpose. The kanban view imports and uses `TaskCreateDetail` from `ft-add-task-dialog.ts` in the analogous spot. Importing the exported type would keep the two patterns fully symmetric and ensure the toolbar stays in sync if the detail shape changes.

   This is cosmetic — the structural types are identical and TypeScript catches any mismatch. No action required.

2. **[ft-collection-picker.ts] Picker won't reflect the newly created collection**  
   After `createCollection` succeeds, the toolbar dispatches `collection-select`, which navigates via `pushState` + `applyRoute()`. The app reconfigures the scoped client for the new `collectionId`, but the `unscopedClient` reference doesn't change, so `ft-collection-picker` won't re-fetch its list. If the user opens the picker dropdown after creating a collection, the new entry is missing until a full page reload.

   This is a pre-existing limitation of the picker (it only re-fetches when the `client` reference changes) and is out of scope for this PR. Noting it as a follow-up candidate.

---

### What's Done Well

- **All R1 feedback addressed cleanly.** The `minlength="1"` was removed, the `unscopedClient!` non-null assertion was replaced with a proper guard + user-facing error message, and the redundant index.ts import was removed. Each fix is minimal and targeted.

- **Excellent pattern fidelity.** The dialog component is structurally identical to `ft-add-task-dialog`: same Shoelace type aliases, same form submission flow (`requestSubmit` → `onSubmit` → `dispatchEvent`), same `onRequestClose` guard during creation, same `onAfterHide` cleanup, same imperative `setCreating`/`setError` API. This makes the codebase predictable.

- **Correct client scoping.** Uses `unscopedClient` for `createCollection` — the gRPC method does not call `resolveCollectionId()`, which is the right semantic for a cross-collection operation.

- **Clean navigation reuse.** Dispatches the existing `collection-select` custom event, which `ft-app.ts` handles via `pushState` + `applyRoute()`. Zero new routing logic.

- **Robust error handling.** The `try/catch/finally` ensures `isCreating` always resets. The early return for missing `unscopedClient` prevents runtime crashes in edge cases (component rendered in isolation). Errors are both displayed to the user (sl-alert) and logged (console.warn).

- **Proper accessibility.** The icon button has `label="New collection"` for assistive technology. The Shoelace dialog provides built-in focus trap, Escape-to-close, and the component focuses the name input after the dialog show animation completes.

- **Input validation is appropriate.** `required` + `maxlength="255"` + `.trim()` before validation catches empty/whitespace-only names and bounds input length. Server-side validation provides the second layer.

- **Mock implementation is complete.** `MockFarmTableClient.createCollection` generates a UUID, defaults to `Platform.FARMTABLE`, uses `unshift` (consistent with `createTask`), and returns a copy. This keeps the mock functional for development and testing.

---

### Verification Story

- **Tests reviewed:** No tests added or modified. The feature is UI-only with no complex logic — the gRPC call and navigation rely on existing tested infrastructure. The mock client method enables manual testing. Acceptable for this scope.
- **Build verified:** ✅ `tsc --noEmit` passes. `npm run build` produces a clean production bundle (no new errors or warnings).
- **Lint/static analysis clean:** ✅ TypeScript strict mode passes with no errors.
- **Security checked:** ✅ Input bounded by `maxlength="255"`. Name sent to gRPC service for server-side validation. No credential exposure, injection vectors, or XSS surfaces introduced.
- **R1 feedback incorporated:** ✅ All three actionable suggestions addressed in commit `d622196`.

---

### Files Reviewed

| File | Status | Notes |
|------|--------|-------|
| `web/src/components/ft-new-collection-dialog.ts` | NEW | Dialog component — clean pattern match, `minlength` removed per R1 |
| `web/src/components/ft-toolbar.ts` | MODIFIED | Button + dialog integration — null guard added per R1 |
| `web/src/gen/grpc-client.ts` | MODIFIED | `createCollection` method — correct, unscoped |
| `web/src/gen/service.ts` | MODIFIED | Interface + mock — complete |
| `web/src/index.ts` | MODIFIED | Redundant import removed per R1 |
| `.design/project-log/feature-20-new-collection-modal.md` | NEW | Accurate log entry |
