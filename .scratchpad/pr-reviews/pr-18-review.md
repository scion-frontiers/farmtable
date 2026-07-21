# PR Review: Feature 18 — URL-Driven Collection Routing

## Review Summary

**Verdict:** APPROVE

**Overview:** This is a well-structured feature that makes collection selection URL-addressable. The routing logic is clean, the race-condition guards (route tokens) are correctly applied, resource cleanup on route transitions is thorough, and the new component follows established project patterns. No critical or important issues were found; only minor suggestions for robustness.

---

### Critical Issues

None.

### Important Issues

None.

### Suggestions

#### 1. `ft-collection-list` initial load relies on `updated()`, not `connectedCallback()`

**File:** `web/src/components/ft-collection-list.ts:104-108`

The component loads collections via `updated()` when `client` changes. On first render, `updated()` fires with `changedProperties.get('client')` returning `undefined` (the property's prior value). This works because `this.client` (the new value) is truthy while `undefined` (the old value) is not, so the `!==` check passes. However, this is a fragile pattern — if the parent ever sets `client` to the same reference twice in rapid succession (e.g. during a re-render), the guard would skip the load.

A more robust alternative is to also trigger in `connectedCallback()`:

```typescript
connectedCallback() {
  super.connectedCallback();
  if (this.client) {
    void this.loadCollections();
  }
}
```

This is a minor style point since the current code works correctly in the existing usage.

#### 2. `listCollections` hardcodes `pageSize: 200` with no pagination

**File:** `web/src/gen/grpc-client.ts:137`

The `listCollections` call uses `pageSize: 200` and doesn't follow up with pagination. For the current product this is fine — no user will have 200+ collections — but it matches the existing pattern for `listTasks` which has the same limitation. Worth a follow-up if the collection count grows.

#### 3. `collectionId` passed to `getCollection` is not UUID-validated client-side

**File:** `web/src/components/ft-app.ts:286`

The value from `?collection=` is passed directly to `getCollection()` without format validation. This is safe because:
- Lit's template engine auto-escapes all interpolated values (no XSS).
- The server will reject an invalid UUID with an error, which the `catch` block handles correctly.

However, a lightweight client-side UUID regex check before the network call would provide a faster UX for obviously invalid values (e.g. `?collection=hello`):

```typescript
private static UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

private async applyRoute() {
  const token = ++this.routeToken;
  const collectionId = this.currentCollectionIdFromUrl();

  if (!collectionId) {
    this.showCollectionList('');
    return;
  }

  if (!FtApp.UUID_RE.test(collectionId)) {
    this.removeCollectionFromUrl();
    this.showCollectionList('Invalid collection ID. Choose an available collection.');
    return;
  }
  // ... rest unchanged
}
```

This is optional — the current catch-all behavior is functionally correct.

#### 4. `getCollection` response passed to `toCollection()` without wrapping

**File:** `web/src/gen/grpc-client.ts:142-143`

```typescript
async getCollection(id: string): Promise<Collection> {
  const response = await this.unary(methods.getCollection, { id });
  return toCollection(response);
}
```

`getCollection`'s RPC is defined with response type `'Collection'` (not a wrapper like `GetCollectionResponse`), so `response` here IS the collection record directly. This is correct and consistent with how `createTask` returns `'Task'` directly. Just noting this design is intentional and verified.

#### 5. Minor: `showCollectionList` resets `users` to `[]`

**File:** `web/src/components/ft-app.ts:302`

When navigating back to the landing view, `this.users = []` is reset. This is correct for resource cleanup. However, if the user navigates back and forth, users are re-fetched each time. If this becomes a perf concern, the user list could be cached. Low priority — the current behavior is correct.

---

### What's Done Well

1. **Race-condition handling:** Both `FtApp.routeToken` and `FtCollectionList.loadToken` use monotonic token counters to guard async operations against stale results. This is the correct pattern and is applied consistently across all async boundaries (`applyRoute`, `loadCollections`, `loadUsers`).

2. **Clean resource lifecycle:** `stopStream()` properly removes the event listener, stops the stream, and clears the reference before creating a new `StreamManager` in `showBoard()`. This prevents leaked event listeners and phantom reconnect loops when switching collections.

3. **Backwards compatibility:** `createGrpcFarmTableClient()` is preserved as a thin wrapper around `createGrpcFarmTableClientWithOptions()`, so existing non-dashboard callers are unaffected.

4. **URL state management:** The use of `pushState` for collection selection and `replaceState` for invalid-collection cleanup is correct. `pushState` creates a browser history entry (back button works), while `replaceState` silently removes the bad URL without polluting history.

5. **`popstate` handler:** Listening for `popstate` and calling `applyRoute()` ensures browser back/forward buttons correctly transition between collection views without a page reload.

6. **Unscoped vs scoped client separation:** Creating `unscopedClient` with `{ collectionId: null, readStoredCollectionId: false }` for validation and listing, then a separate scoped client for the board, is a clean architectural decision that prevents the dashboard from accidentally inheriting a stored collection ID.

7. **Mock client completeness:** `MockFarmTableClient` was updated to implement both `listCollections()` and `getCollection()`, keeping the mock in sync with the interface.

8. **Accessible collection buttons:** The collection list uses native `<button>` elements with `type="button"`, proper `:focus-visible` outlines, semantic `<main>` landmark, and `<h1>` heading hierarchy. The `overflow-wrap: anywhere` on `.name` handles long collection names gracefully.

9. **Error UX:** Two distinct error states — `errorMessage` (from the parent for invalid collection URL) and `loadError` (from failed list fetch) — provide clear, distinct feedback. The `sl-alert` variants (`warning` vs `danger`) visually differentiate the error types.

---

### Verification Story

- **Tests reviewed:** No automated tests exist for the web frontend in this project (no `.test.*` or `.spec.*` files found). This is consistent with the existing codebase — the web layer has no test infrastructure yet. The mock client was updated correctly.
- **Build verified:** Yes — `npm run build` completes cleanly with no errors.
- **Lint/static analysis clean:** Yes — TypeScript compilation passes (Vite build completes). No new type errors introduced.
- **Security checked:** Yes — no XSS vectors (Lit auto-escapes), no credential exposure, no open redirects. Collection IDs from URL params are validated server-side via `getCollection()` before use. The token/auth flow is unchanged.
