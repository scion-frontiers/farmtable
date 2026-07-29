# B6: UI Collection Selector Dropdown

**Date:** 2026-07-21
**Branch:** `feat/extstore-b6-collection-selector`
**Status:** Complete

## Summary

Enhanced the web dashboard collection selector to support external store
collections. The existing `ft-collection-picker` dropdown and
`ft-collection-list` landing page now display platform icons alongside
collection names and show contextual labels for external collections
(e.g. "GitHub: owner/repo").

## Changes

### `web/src/util/platform-label.ts`
- Added `platformIcon(platform)` — returns a Bootstrap Icons name for each
  platform, used with `<sl-icon>` in Shoelace components.
- Added `collectionDisplayName(name, platform, remoteId)` — builds a
  human-readable label for the collection trigger button. External
  collections with a `remoteId` render as `"GitHub: owner/repo"` instead
  of just the collection name.

### `web/src/components/ft-collection-picker.ts`
- **Trigger button** now shows the platform icon (via `<sl-icon>` prefix
  slot) and uses `collectionDisplayName()` for the label text.
- **Menu items** now render a platform icon next to the platform label
  line. External collections display both the platform name and remote
  identifier (e.g. "GitHub: owner/repo").
- New CSS classes: `.platform-icon`, `.external-badge`.

### `web/src/components/ft-collection-list.ts`
- Landing page collection cards now show a platform icon inline with the
  platform label.
- External collections display `"Platform: remoteId"` when a remote
  identifier is available.

## Acceptance Criteria

| Criterion | Status |
|---|---|
| Collection selector appears in the toolbar | Existing (ft-collection-picker in ft-toolbar) |
| Lists all collections from the server | Existing (calls `listCollections` RPC) |
| Shows platform type for each collection | Added platform icons + labels |
| Switching collection updates URL and reloads task data | Existing (ft-app `onCollectionSelect` → `applyRoute`) |
| Selected collection persists across navigation (via URL) | Existing (`?collection=<id>` URL param) |
| `go build ./...` passes | Verified |

## Architecture Notes

The collection selector dropdown was already functional prior to this
change via `ft-collection-picker`. This task focused on enhancing it for
external store support:

- **URL routing:** `ft-app.applyRoute()` reads `?collection=<id>` from
  the URL, validates the collection exists, and bootstraps the board
  view with a scoped gRPC client.
- **Event flow:** `ft-collection-picker` dispatches `collection-select`
  → `ft-toolbar` re-dispatches → `ft-app.onCollectionSelect()` updates
  URL and calls `applyRoute()`.
- **Platform utilities:** centralized in `platform-label.ts` to ensure
  consistent icon and label rendering across the picker, landing page,
  and toolbar.
