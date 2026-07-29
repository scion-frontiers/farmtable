# Feature 18: URL-Driven Collection Routing

## What Was Built

Made collection selection URL-addressable in the Farm Table dashboard. Previously, the dashboard silently auto-picked the first collection via `resolveCollectionId()`. Now:

1. **No `?collection=` in URL** → Landing view listing all collections (name + platform)
2. **Select a collection** → Navigates to `?collection=<uuid>` via `pushState`, renders board
3. **Direct URL with `?collection=<uuid>`** → Loads that collection's board directly
4. **Invalid collection ID** → Falls back to list with "Collection not found" notice

## URL/State Mechanism (Load-Bearing for Features 19/20)

| Concept | Detail |
|---------|--------|
| URL param name | `collection` (as in `?collection=<uuid>`) |
| Reading current collection | `new URLSearchParams(window.location.search).get('collection')` via `FtApp.currentCollectionIdFromUrl()` |
| Writing collection (user nav) | `window.history.pushState({}, '', url)` with `url.searchParams.set('collection', id)` |
| Removing bad collection | `window.history.replaceState({}, '', url)` with `url.searchParams.delete('collection')` |
| Route state var | `FtApp.routeView: 'landing' | 'validating' | 'board'` |
| Error message state | `FtApp.collectionErrorMessage: string` — passed to `ft-collection-list.errorMessage` |
| Unscoped client | `createGrpcFarmTableClientWithOptions({ collectionId: null, readStoredCollectionId: false })` — for ListCollections/GetCollection |
| Scoped client | `createGrpcFarmTableClientWithOptions({ collectionId, readStoredCollectionId: false })` — for task streaming |
| Navigation handler | `FtApp.onCollectionSelect` handles `collection-select` event from `ft-collection-list` |
| Back/forward | `window.addEventListener('popstate', this.onPopState)` → calls `applyRoute()` |

### How Components Read Current Collection

- `ft-app.ts`: Reads from URL in `currentCollectionIdFromUrl()`, validates via `getCollection()`, creates scoped client
- `ft-collection-list.ts`: Receives `client` (unscoped) and `errorMessage` as properties, emits `collection-select` with `{ collectionId }` detail
- Board components (kanban, tree, inspector): Receive scoped `this.client` — unchanged, they don't know about collections directly

### For Feature 19 (Collection Picker)

The picker should:
- Read current collection from URL: `new URLSearchParams(window.location.search).get('collection')`
- Navigate to a different collection: dispatch `collection-select` event or directly `pushState` + trigger `applyRoute()`
- The `unscopedClient` is available in `ft-app.ts` for fetching the collection list

### For Feature 20 (New Collection Modal)

After creating a collection, navigate to it via the same `pushState` + `?collection=<new-uuid>` mechanism.

## Files Changed

- `web/src/components/ft-collection-list.ts` (NEW, 201 lines) — Lit component for landing view
- `web/src/components/ft-app.ts` (+126 lines) — Route-based rendering with `routeView` state machine
- `web/src/gen/grpc-client.ts` (+65 lines) — `listCollections()`, `getCollection()`, `createGrpcFarmTableClientWithOptions()`, `toCollection()`
- `web/src/gen/service.ts` (+24 lines) — Interface + mock client updates
- `web/src/index.ts` (+1 line) — Component registration
- `.design/project-log/feature-18-collection-url-routing.md` — Project log

## Review Rounds

### Round 1: APPROVE (2 Important, 5 Suggestions — all fixed)

1. ✅ **ft-collection-list `updated()` guard** — Added explicit `this.client !== changedProperties.get('client')` check
2. ✅ **Mock `getCollection` name matching** — Removed `|| item.name === id` to match real server behavior
3. ✅ **Filter reset on collection switch** — Reset `phaseFilter` and `assigneeFilter` in `showBoard()`
4. ✅ **Precedence comment** — Added inline comment documenting collection ID resolution precedence
5. ✅ **ARIA verification** — Confirmed Shoelace `sl-alert` renders `role="alert"` internally, added comment

### Round 2: APPROVE (0 Critical, 0 Important, 5 minor suggestions only)

Per review loop exit criteria: Round 2 returned only nitpick/minor findings → ship as-is.

Unaddressed R2 suggestions (all minor/optional):
- `connectedCallback()` as alternative to `updated()` for initial load (style preference)
- `pageSize: 200` pagination cap (existing pattern across all list methods)
- Client-side UUID validation before `getCollection()` call (server already validates)
- `getCollection` response wrapping (noted as intentional, no change needed)
- User list re-fetch on collection switch (correct cleanup behavior)

## Final State

- **Branch:** `feat/collection-url-routing`
- **PR:** https://github.com/scion-frontiers/farmtable/pull/64
- **Commits:** 2 (feat + R1 fixes)
- **Build:** Clean (`tsc --noEmit && vite build` passes)
- **Screenshots:** 3 distinct PNGs verified via md5sum
  - `landing-no-collection.png` (dc89b15d) — Landing view, no `?collection=` param
  - `board-after-select.png` (9a3b2d33) — Board after clicking a collection
  - `board-direct-url.png` (99de6356) — Board loaded via direct URL navigation
