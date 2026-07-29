# Feature 5: Inspector Label Editing

Implemented focused label editing in the task inspector.

## Summary

- Added `addLabels` and `removeLabels` fields to the web `UpdateTaskFields` type.
- Updated optimistic task merging so added labels append without duplicates and removed labels are filtered out.
- Mapped `addLabels` and `removeLabels` through the gRPC web client to the existing proto fields.
- Replaced read-only inspector label chips with removable `sl-tag` chips.
- Added an inline label input opened by a small add button, with Enter to add and Escape to cancel.

## Scope Notes

- No backend, proto, or generated descriptor changes were required.
- The UI prevents duplicate label adds before dispatching an update.
- Browser verification used a seeded existing label to prove removable chips render, then added a new label through the inspector UI.

## Verification

- `npm run typecheck` from `web/`
- `npm run build` from `web/`
- `go test ./...` from repo root
- `go build ./...` from repo root
- Playwright against `ft dashboard` on port 8080 and Vite on port 5173

Screenshots saved under:

`/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-5-label-editing/`

- `01-label-chips-with-remove-buttons.png`
- `02-adding-label-input.png`
- `03-label-visible-after-add.png`
- `04-label-persists-after-reload.png`
- `05-label-removed.png`
