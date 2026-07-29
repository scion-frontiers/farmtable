# Feature 19: Collection Picker

## What Was Built

- Added `ft-collection-picker`, a compact Lit/Shoelace toolbar picker that receives the unscoped `FarmTableServiceClient` and current `collectionId`.
- The picker calls `client.listCollections()` when the client is first assigned or changes, keeps the options locally, and resolves the trigger label from the current URL collection ID.
- The dropdown uses `sl-dropdown`, `sl-menu`, and normal `sl-menu-item` rows with a check icon prefix on the current collection. Each row shows collection name plus platform label.
- Selecting a different collection dispatches the existing Feature 18 `collection-select` event shape: `{ collectionId }`, with `bubbles: true` and `composed: true`.
- `ft-toolbar` now accepts `.unscopedClient` and `.collectionId`, renders the picker at the left edge, and re-dispatches picker events upward.
- `ft-app` tracks `currentCollectionId`, sets it in `showBoard(collectionId)`, clears it in `showCollectionList()`, and passes it to `ft-toolbar`.
- The routing mechanism remains Feature 18's URL-driven path: `ft-app` handles `collection-select`, writes `?collection=<uuid>` with `pushState`, and calls `applyRoute()`.

## Load-Bearing Markup For Feature 20

`ft-toolbar` renders the collection control as the first child in the toolbar:

```html
<div class="collection-controls">
  <ft-collection-picker
    .client=${this.unscopedClient}
    .collectionId=${this.collectionId}
    @collection-select=${this.onCollectionSelect}
  ></ft-collection-picker>
</div>
```

The wrapper CSS is:

```css
.collection-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
```

Feature 20 can add the new-collection button as a sibling of `ft-collection-picker` inside this wrapper.

## File List

- `web/src/components/ft-collection-picker.ts` — 249 lines
- `web/src/components/ft-toolbar.ts` — 272 lines
- `web/src/components/ft-app.ts` — 395 lines
- `web/src/index.ts` — 49 lines

## Screenshots

Saved under `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-19-collection-picker/`.

- `01-picker-current-alpha.png` — `9de87b7acead8f7c040fe4103e62987a`
- `02-dropdown-open.png` — `91e9e34dc2c8749a0569312f32c9ee3b`
- `03-picker-current-beta.png` — `680e600b76c183917121e762151bbdf7`

Screenshot setup used local `ft dashboard --port 8080` plus Vite dev server at `http://127.0.0.1:5173`, with seeded local collections:

- Alpha: `4988af1f-2796-4767-8c65-7d2875680d87`
- Beta: `04023046-962d-4058-8124-1043d1726a31`

The screenshot flow loaded Alpha, opened the picker dropdown, selected Beta, and verified the final URL was:

`http://127.0.0.1:5173/?collection=04023046-962d-4058-8124-1043d1726a31`

## Verification

- `cd /workspace/farmtable/web && npx tsc --noEmit` — pass
- `cd /workspace/farmtable/web && npx vite build` — pass
- Vite emitted the existing chunk-size warning for the main JS bundle.
- Playwright used Chromium at `/usr/bin/chromium` and modules from `/scion-volumes/scratchpad/web-test/node_modules`.

## Commits

- `aef3a15 feat: add dashboard collection picker`
- `d6690af fix: address R1 review feedback for collection picker`

## Review Rounds

### Round 1: APPROVE (2 Important, 5 Suggestions — all fixed)

1. ✅ **Use `sl-button caret`** — Replaced manual `<sl-icon name="chevron-down">` with Shoelace's built-in `caret` attribute
2. ✅ **Duplicated `platformLabel`** — Extracted to `web/src/util/platform-label.ts`, updated both components
3. ✅ **Hardcoded highlight color** — Changed `rgb(239, 246, 255)` to `var(--sl-color-primary-50)` for dark mode
4. ✅ **Redundant z-index** — Removed `z-index: 30` from picker host (hoist handles popup stacking)
5. ✅ **TODO for re-fetch** — Added `// TODO: Consider re-fetching on @sl-show for freshness.`
6. ✅ **Typed CustomEvent** — Changed to `CustomEvent<{ collectionId: string }>`
7. ✅ **Redundant index.ts import** — Removed (ft-toolbar already imports the picker)

### Round 2: APPROVE (0 Critical, 0 Important, 3 nitpick/observations only)

Per review loop exit criteria: Round 2 returned only nitpick/minor findings → ship as-is.

Unaddressed R2 observations (all nitpick):
- `Platform.UNSPECIFIED` falls through to `default` case silently (correct behavior, style-only)
- Toolbar re-dispatch pattern is boilerplate but correct (observation, no change)
- `sl-dropdown::part(base__popup)` may be a no-op (harmless safety net)

## Final State

- **Branch:** `feat/collection-picker`
- **PR:** https://github.com/scion-frontiers/farmtable/pull/65
- **Commits:** 2 (feat + R1 fixes)
- **Build:** Clean (`tsc --noEmit` + `vite build` pass)
