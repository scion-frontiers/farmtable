# Feature 28 Tree View Infinite Growth Fix

## Summary

Applied the urgent tree view CSS fix in `web/src/components/tree/ft-tree-view.ts`.

## Implementation

- Added `min-height: 0` to `.canvas-container` to prevent flex layout from forcing unbounded growth.
- Added `display: block` to the `svg` rule to remove inline SVG baseline spacing from size calculations.

## Verification

- `cd /workspace/farmtable/web && npm run build`
- Result: passed.
- Build warning: Vite reported that one output chunk is larger than 500 kB after minification.

## Commit

- `fix: add display:block to tree view SVG to stop infinite resize loop`
