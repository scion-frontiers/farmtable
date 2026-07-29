# Feature 54: Minimap for Tree Views with Draggable Viewport Frame

## Architecture Choice: Shared Reusable Component

**Decision:** Single shared `ft-minimap` web component used by both tree views.

**Rationale:** Both the parent-child Tree view (`ft-tree-view.ts`) and the Dependency view (`ft-dependency-view.ts`) use identical pan/zoom mechanics:
- SVG `viewBox` driven by `panX`, `panY`, `scale`, `containerWidth`, `containerHeight`
- `layoutNodes: LayoutNode[]` with `{id, x, y, width, height}` shape
- `layoutEdges` with `{from, to}` pairs
- `centerGraph()`, `centerOnNode()`, `animatePanTo()` methods

The minimap only needs these common properties. The only variation is edge rendering — the tree view uses straight-line paths while the dependency view uses cubic bezier S-curves. This is handled via an optional `edgePathFn` property.

## Component: `web/src/components/minimap/ft-minimap.ts`

**Properties:**
- `nodes` — layout nodes from the parent view
- `edges` — layout edges (from/to pairs)
- `panX`, `panY`, `scale` — current viewport state
- `containerWidth`, `containerHeight` — main viewport dimensions
- `edgePathFn` — optional custom edge path builder

**Events dispatched:**
- `minimap-pan` with `{panX, panY}` — fired during drag or click-to-jump

**Features:**
- 180x180px overlay, bottom-left corner, subtle shadow/border
- Renders all nodes as small rectangles preserving relative positions
- Renders edges using provided path function (or straight lines by default)
- Viewport frame rectangle shows current visible area
- **Drag-to-pan**: drag the frame to pan the main view
- **Click-to-jump**: click anywhere on the minimap to center the viewport there

## Edge Case Handling

- **Empty graphs (0 nodes):** Minimap renders nothing (returns empty template).
- **Small graphs (viewport covers entire graph):** Frame is always shown, even when it covers the whole minimap. This provides consistent UX — users always see their position indicator and can use drag/click to navigate.
- **Zoom extremes:** Frame scales proportionally with zoom level.
- **Animation conflict:** Both parent views call `cancelPanAnimation()` before applying minimap pan coordinates, preventing animation/drag fights.

## Files Changed

1. `web/src/components/minimap/ft-minimap.ts` — new shared minimap component
2. `web/src/components/tree/ft-tree-view.ts` — integrated minimap, added `onMinimapPan` handler
3. `web/src/components/dependency/ft-dependency-view.ts` — integrated minimap with custom bezier edge path

## Code Review

### Round 1 (8-angle, high effort)
Found 8 findings (3 correctness bugs, 2 cleanup, 3 minor). All fixed:
1. Post-drag click race condition — added `wasDragging` flag
2. Viewport frame clipping when panned far from graph — expanded viewBox bounds
3. Wheel events captured by minimap overlay — added `minimap-wheel` forwarding
4. Duplicated `minimapEdgePath` in dependency view — reuse module-level `edgePath`
5. Unnecessary `.map()` in tree view `minimapEdges` — pass `layoutEdges` directly
6. Unused `PropertyValues` import — now used by `willUpdate`, kept
7. Dead `.hidden` CSS class — removed
8. Uncached `nodeMap` rebuilt every render — added `willUpdate` with `cachedNodeMap`

### Round 2 (8-angle, high effort)
Found 5 findings. Fixed 3, 2 are pre-existing/nitpick:
1. Pre-existing: `wheelListenerAttached` flag not reset on SVG re-creation (not introduced by F54)
2. **Fixed**: Wrong zoom anchor on minimap-wheel — anchored to viewport center instead of cursor
3. **Fixed**: Same zoom anchor issue in dependency view
4. Plausible edge-case drag drift at graph boundaries — minor, not addressed
5. **Fixed**: Trivial `minimapEdges` getter passthrough removed

Stopped after Round 2 — remaining findings are pre-existing or nitpick level.

## Evidence

Screenshots saved in `feature-54-tree-minimap/`:
- `01-tree-view-with-minimap.png` — Initial tree view with minimap in bottom-left
- `02-tree-zoomed-in.png` — Zoomed in, minimap frame shows smaller viewport area
- `03-tree-panned.png` — After panning, frame accurately reflects new position
- `04-before-minimap-drag.png` — Before drag interaction
- `05-after-drag1.png` — After dragging frame to upper-left region
- `06-after-drag2.png` — After dragging frame to lower-right region
- `07-dependency-view-with-minimap.png` — Dependency view with minimap showing 6 nodes

## PR

- PR #131: https://github.com/scion-frontiers/farmtable/pull/131
- Branch: `feat/f54-tree-minimap`
- 3 commits: initial implementation + R1 fixes + R2 fixes
