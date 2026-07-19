# Feature 18: URL-Driven Collection Routing

## What Was Built

- Added `ft-collection-list`, a simple Lit landing component that calls `FarmTableServiceClient.listCollections()` and displays each collection's name and platform.
- Added public collection methods to the web client contract:
  - `listCollections(): Promise<Collection[]>`
  - `getCollection(id: string): Promise<Collection>`
- Added `ListCollections` and `GetCollection` wrappers to `GrpcFarmTableClient`.
- Updated `ft-app` so the dashboard no longer starts task streaming when `?collection=` is absent.
- Added invalid collection handling: failed `GetCollection` validation falls back to the collection list with a small notice.

## URL And State Mechanism

- URL parameter: `collection`
- URL format: `?collection=<uuid>`
- `FtApp.currentCollectionIdFromUrl()` reads the current collection from `new URLSearchParams(window.location.search).get('collection')`.
- `FtApp.routeView` drives the top-level render state:
  - `'landing'`: show `ft-collection-list`
  - `'validating'`: show loading spinner while validating `?collection=`
  - `'board'`: show toolbar, filters, kanban/tree, and inspector
- `FtApp.collectionErrorMessage` is passed to `ft-collection-list.errorMessage` for invalid collection notices.
- `FtApp.unscopedClient` is created with:
  - `createGrpcFarmTableClientWithOptions({ collectionId: null, readStoredCollectionId: false })`
  - Used for `listCollections()` and `getCollection()` validation.
- `FtApp.client` is replaced with a scoped client only after validation:
  - `createGrpcFarmTableClientWithOptions({ collectionId, readStoredCollectionId: false })`
  - This scoped client is passed to toolbar, board views, inspector, and `StreamManager`.
- `FtApp.onCollectionSelect` handles the `collection-select` event from `ft-collection-list`, writes the selected ID with `window.history.pushState({}, '', url)`, then calls `applyRoute()`.
- `FtApp.onPopState` calls `applyRoute()` so browser back/forward replays URL state.
- `FtApp.removeCollectionFromUrl()` uses `window.history.replaceState({}, '', url)` after invalid collection validation fails, leaving the user on the landing view without preserving the bad URL.

## Design Decisions

- The legacy `createGrpcFarmTableClient()` behavior is preserved for non-dashboard callers. The new `createGrpcFarmTableClientWithOptions()` entry point lets the dashboard explicitly opt out of stored collection IDs.
- `resolveCollectionId()` still retains its old auto-pick fallback for existing scoped task API callers. The dashboard avoids calling task APIs until a URL collection is selected and validated.
- The landing view intentionally has no persistent picker chrome, create action, or board toolbar. Those are reserved for later features.
- Collection validation uses `GetCollection` before starting `StreamManager`, preventing bad URLs from creating an infinite loading or reconnect loop.
