# PR Review: Feature 18 — URL-Driven Collection Routing

**Branch:** `feat/collection-url-routing`
**Commit:** `4274f72 feat: add URL-driven collection routing`
**Files changed:** 6 (445 additions, 8 deletions)

---

## Review Summary

**Verdict:** APPROVE

**Overview:** This is a well-structured feature that adds URL-driven collection routing to the Farm Table dashboard. The implementation introduces clean state-machine routing (`landing → validating → board`), correct race-condition handling via monotonic tokens, and proper cleanup of streaming resources on route transitions. The code is clean and follows established project patterns with no blocking issues.

---

### Critical Issues

None.

---

### Important Issues

1. **[`web/src/components/ft-collection-list.ts:104-108`] Initial load fires on every `client` property reassignment, including the initial `undefined → real` transition and any subsequent identity-equal reassignments**

   The `updated()` lifecycle hook triggers `loadCollections()` whenever the `client` property key appears in `changedProperties`, but it does not check whether the value actually changed. In `ft-app.ts`, `showCollectionList()` assigns `this.client = this.unscopedClient` (line 299) even if it's already the same reference, which re-renders `ft-collection-list` with the same `.client` property. While Lit's default `hasChanged` for `@property({ attribute: false })` uses strict identity (`===`), so same-reference reassignment won't trigger `updated()`, this is fragile — any refactor that creates a wrapper or new client object would silently cause double-fetches.

   **Suggested fix:** Add a guard in `updated()`:
   ```ts
   protected updated(changedProperties: Map<PropertyKey, unknown>) {
     if (changedProperties.has('client') && this.client !== changedProperties.get('client')) {
       void this.loadCollections();
     }
   }
   ```
   This makes the intent explicit and is defensive against future changes. Low severity since Lit's default check already prevents the double-fire today.

2. **[`web/src/gen/service.ts:394`] `MockFarmTableClient.getCollection` matches by `id || name`, but `GrpcFarmTableClient.getCollection` matches by `id` only**

   ```ts
   // Mock:
   const collection = MOCK_COLLECTIONS.find((item) => item.id === id || item.name === id);
   // Real:
   const response = await this.unary(methods.getCollection, { id });
   ```

   The mock accepts collection names as IDs, which the real server does not. This mismatch could mask bugs in development (e.g., accidentally passing a name where an ID is expected).

   **Suggested fix:** Remove the `|| item.name === id` clause from the mock:
   ```ts
   const collection = MOCK_COLLECTIONS.find((item) => item.id === id);
   ```

---

### Suggestions

1. **[`web/src/components/ft-app.ts:282-283`] `collectionErrorMessage` is cleared on every `applyRoute()` validating transition, which briefly flashes the error away if the user triggers rapid navigation**

   This is correct behavior since `routeView` immediately goes to `'validating'` (which shows the spinner, not the error), so the user wouldn't see a flash. The token-based staleness guard also ensures only the latest navigation wins. No change needed, but worth noting the flow is intentionally correct.

2. **[`web/src/gen/grpc-client.ts:137`] `listCollections` uses `pageSize: 200` without pagination, consistent with every other `list*` method in this file**

   This is an existing pattern across `listTasks`, `listUsers`, `listComments`, and `listChanges`. The collection list landing view doesn't add a new pagination gap — it inherits the same `pageSize: 200` cap. If the project later addresses pagination holistically, this method should be included, but it's not a regression.

3. **[`web/src/components/ft-collection-list.ts:116-120`] The `errorMessage` and `loadError` alerts are both rendered but serve different purposes — consider adding ARIA `role="alert"` or `aria-live` to ensure screen readers announce them**

   The `<sl-alert>` component from Shoelace already includes ARIA attributes internally, so this is likely handled. Worth confirming if the Shoelace version in use includes `role="alert"` on `<sl-alert>`.

4. **[`web/src/gen/grpc-client.ts:341-347`] The collection ID resolution logic in `createGrpcFarmTableClientWithOptions` is multi-layered but clear**

   The precedence is: explicit `options.collectionId` (null = force undefined) > URL param > stored config. This is correct and well-structured. Consider adding a brief inline comment documenting the precedence for future maintainers:
   ```ts
   // Precedence: explicit option > URL ?collection= param > stored global/localStorage
   ```

5. **[`web/src/components/ft-app.ts:308-323`] `showBoard()` creates a new `StreamManager` on every collection switch without resetting `phaseFilter` or `assigneeFilter`**

   When switching from one collection's board to another (via back → select), the filter state from the previous collection carries over. If the new collection doesn't have matching assignees or phases, the board will appear empty until the user clears filters. This may be intentional (preserve user preferences), but it's worth noting. A potential improvement:
   ```ts
   private showBoard(collectionId: string) {
     this.stopStream();
     this.phaseFilter = null;
     this.assigneeFilter = null;
     // ... rest
   }
   ```

---

### What's Done Well

- **Race-condition handling is thorough.** The `routeToken` pattern in `FtApp.applyRoute()` (lines 274-294) and the `loadToken` pattern in `FtCollectionList.loadCollections()` (lines 147-166) both correctly guard against stale async results from superseded navigations. This is a common source of bugs in SPAs and it's handled correctly here.

- **Clean resource lifecycle management.** The `stopStream()` method (lines 326-329) properly removes the event listener, stops the stream, and nulls the reference. This prevents leaked timers and reconnect loops from `StreamManager` when the user navigates away from a board view.

- **`disconnectedCallback` cleanup is complete.** Both the `popstate` listener and the document `keydown` listener are properly removed (lines 102-107), preventing memory leaks if the component is unmounted.

- **URL state management is well-considered.** Using `pushState` for user-initiated navigation (line 340) and `replaceState` for error recovery (line 351) is the correct pattern — invalid URLs don't pollute the history stack.

- **The `unscopedClient` / scoped `client` separation is clean architecture.** The unscopedClient is used for cross-collection operations (list, validate), while a scoped client is created only after validation succeeds. This prevents task-streaming APIs from being called with an invalid collection ID.

- **The new `ft-collection-list` component is well-encapsulated.** It receives its dependencies via properties, emits a custom event for selection, and handles its own loading/error states. It follows the same Lit patterns used throughout the project.

- **Backward compatibility is preserved.** The existing `createGrpcFarmTableClient()` function now delegates to `createGrpcFarmTableClientWithOptions()` with defaults (line 324-326), ensuring no breakage for other callers.

---

### Verification Story

- **Tests reviewed:** No new tests were added. The mock client was updated to include `listCollections()` and `getCollection()` methods, which is correct for keeping the mock in sync with the interface. The project does not appear to have component-level tests for Lit elements currently, so the absence of tests is consistent with existing patterns.
- **Build verified:** Yes — `npm run build` passes cleanly with no errors.
- **Lint/static analysis clean:** Yes — TypeScript compilation succeeds with no type errors.
- **Security checked:** Yes. The collection ID from the URL is validated server-side via `getCollection()` before being used. Lit's template system auto-escapes all rendered values, preventing XSS. The `errorMessage` string is static (not user-controlled), so the `sl-alert` rendering is safe. The `collection` URL parameter is passed through `URLSearchParams` (which handles encoding) and validated before use.
