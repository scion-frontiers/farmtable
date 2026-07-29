# Feature 20 — New Collection Button + Modal

## What Was Built

A "New Collection" button (⊕ plus-circle icon) next to the collection picker in the toolbar. Clicking it opens a Shoelace `sl-dialog` modal with a single required Name field. On submit, it calls the `CreateCollection` gRPC RPC via the unscoped client, closes the modal, and navigates to the new collection's board using the existing `pushState` + `applyRoute()` routing mechanism from Features 18/19.

## Files Changed

- `web/src/components/ft-new-collection-dialog.ts` — New dialog component following `ft-add-task-dialog` pattern exactly
- `web/src/components/ft-toolbar.ts` — Added button in `.collection-controls` div + dialog integration + handlers
- `web/src/gen/grpc-client.ts` — Added `createCollection` method to methods object and `GrpcFarmTableClient` class
- `web/src/gen/service.ts` — Added `createCollection` to `FarmTableServiceClient` interface and `MockFarmTableClient`
- `web/src/index.ts` — No change needed (toolbar imports the dialog)
- `.design/project-log/feature-20-new-collection-modal.md` — Project log entry

## Design Decisions

- **Modal is intentionally minimal**: Only a Name field. Platform, description, and other fields are out of scope and will be added in a future iteration.
- **Pattern match**: Component follows `ft-add-task-dialog.ts` exactly — same Shoelace type aliases, same form submission flow, same `onRequestClose` guard, same `onAfterHide` cleanup, same imperative API.
- **Client scoping**: Uses `unscopedClient` (collectionId: null) for createCollection — correct for cross-collection operations.
- **Navigation**: Reuses existing `collection-select` custom event, which ft-app.ts handles via pushState + applyRoute(). Zero new routing logic.

## Review Rounds

### Round 1 — APPROVE (4 suggestions, all fixed)
1. Added null guard for `unscopedClient` (removed `!` assertion)
2. Removed redundant `minlength="1"` (inconsistent with reference pattern)
3. Removed redundant import from `index.ts`
4. Structural type alias left as-is (consistent with codebase pattern)

### Round 2 — APPROVE (2 nitpick-only findings, shipped as-is)
1. Cosmetic: inline type vs importing `CollectionCreateDetail` — nitpick
2. Pre-existing: picker won't show newly created collection until reload — out of scope

## Unaddressed Nitpicks

- Could import `CollectionCreateDetail` type from the dialog component instead of inline `CustomEvent<{ name: string }>` in the toolbar handler. Cosmetic only — TypeScript catches any mismatch.
- Collection picker won't refresh its list to show the new collection without a page reload. Pre-existing picker limitation, out of scope for this feature.

## Screenshots

Saved to `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-20-new-collection-modal/`:
- `01-toolbar-new-collection-button.png` — Button visible next to picker (md5: 1dcc85e3)
- `02-new-collection-modal.png` — Modal open with Name field (md5: 87b1e3dc)
- `03-new-collection-created.png` — After creation, board switched to new collection (md5: 47bf6400)

All 3 distinct and verified.

## Next Feature Suggestion

**Collection settings/edit modal** — allow users to edit the collection name, description, and platform after creation. This would complement the create flow and address the "name only" limitation naturally.

## PR

https://github.com/scion-frontiers/farmtable/pull/66
Branch: `feat/new-collection-modal`
Status: CLEAN/MERGEABLE
