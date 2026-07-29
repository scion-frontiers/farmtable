# Feature 50: Scrollable Collection List Landing Page + New Project Button

## Summary

Made two changes to the landing page (collection-selection view shown when no `?collection=` param is present):

1. **Scrollable collection list** — the landing page now scrolls when collections overflow the viewport.
2. **New Project button** — a primary "New Project" button in the header opens the existing `ft-new-collection-dialog` modal, allowing users to create collections from the landing page.

## Files Changed

### `web/src/components/ft-app.ts`
- Added `.landing` CSS class (`flex: 1; overflow: auto; min-height: 0`) to create a bounded scroll container.
- Wrapped the `<ft-collection-list>` element in a `<div class="landing">` wrapper in the non-board render path.
- The validating spinner placeholder remains outside the wrapper (it's small and doesn't need scrolling).

### `web/src/components/ft-collection-list.ts`
- **Removed `min-height: 100vh`** from `:host` — this was preventing the parent scroll container from constraining the element's height.
- **Added `ft-new-collection-dialog` import** and the `NewCollectionDialog` type alias (same pattern as `ft-toolbar.ts`).
- **Added `@query` decorator** for the dialog element.
- **Restructured the header** — wrapped the `h1` and lede text in a `.header` flex container with a `.header-text` child, placing the "New Project" `sl-button` to the right.
- **Added `onNewProjectClick()`** — opens the dialog.
- **Added `onCollectionCreate()`** — handles the `collection-create` event from the dialog, calls `client.createCollection()`, then dispatches `collection-select` to navigate to the new board. Error handling and loading state management match the toolbar's pattern exactly.

## Design Decisions

- Reused the existing `ft-new-collection-dialog` component rather than creating a new one — it already handles name input, validation, creating/error states.
- The `onCollectionCreate` handler dispatches `collection-select` with the new collection's ID, which bubbles up to `ft-app` and triggers navigation via URL param update — same flow as selecting an existing collection.
- The dialog is placed inside the `<main class="shell">` element to keep it scoped within the component's shadow DOM.

## Verification

- `npm run build` passes (TypeScript compilation + Vite build) with no errors.
- No `any` casts or type workarounds needed.
