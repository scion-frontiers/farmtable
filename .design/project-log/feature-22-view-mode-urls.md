# Feature 22: View Mode URL Routing

## What Was Built

- Added URL-addressable dashboard view mode routing with `?view=kanban` and `?view=tree`.
- Direct navigation to `?view=tree` now renders the Tree view on initial dashboard load.
- URLs without `?view=` continue to default to Kanban.
- Invalid or unrecognized `?view=` values fall back to Kanban without blocking collection routing.
- Browser back/forward now restores the view mode through the existing `popstate` to `applyRoute()` flow.

## Files Changed

- `web/src/components/ft-app.ts`
  - Added `currentViewFromUrl()` as a companion to `currentCollectionIdFromUrl()`.
  - Updated `applyRoute()` to read `view` on every route application.
  - Updated `onViewChange()` to write the current view to the URL with `window.history.pushState()`.

## URL Param Mechanism

- Read path:
  - `currentViewFromUrl()` reads `new URLSearchParams(window.location.search).get('view')`.
  - It returns `'tree'` only for the exact `tree` value.
  - All other cases, including absent, empty, or invalid values, return `'kanban'`.
- Write path:
  - `onViewChange()` reads the toolbar event detail, sets `url.searchParams.set('view', view)`, pushes the URL with `window.history.pushState({}, '', url)`, then updates `currentView` directly.
  - It intentionally does not call `applyRoute()` so changing view mode does not revalidate or reload the selected collection.
- Back/forward path:
  - The existing `popstate` listener still calls `applyRoute()`.
  - Because `applyRoute()` now reads both collection and view state, browser navigation restores the selected view mode.

## Extension Of Feature 18

Feature 18 introduced URL-driven collection routing with `?collection=<uuid>`, `currentCollectionIdFromUrl()`, `pushState()` on collection selection, and `popstate` replay through `applyRoute()`.

Feature 22 extends the same mechanism with a second orthogonal query parameter. `collection` continues to control which collection is validated and scoped into the dashboard, while `view` controls whether the board renders Kanban or Tree. Both parameters coexist in the same query string, for example:

```text
?collection=<uuid>&view=tree
```

Collection fallback behavior remains unchanged: invalid collections are removed from the URL with `replaceState()`. View fallback is local and non-destructive: invalid view values render Kanban while preserving the rest of the URL.
