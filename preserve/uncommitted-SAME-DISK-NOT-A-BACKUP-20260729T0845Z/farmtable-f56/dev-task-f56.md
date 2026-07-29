# Feature 56: Zoom-to-Target-Size on Selection + More Prominent Highlight

## Your Task

You are implementing Feature 56 in the farmtable web dashboard. You must make two changes that apply to BOTH tree views (parent-child Tree view and Dependency view):

### Change 1: Zoom-to-Target-Size on Selection

When a task node is selected (triggering the existing 750ms animated pan-to-center), also animate the zoom/scale level so that the selected node's rendered width ≈ 20% of the viewport width.

**Current state (what exists):**
- `ft-tree-view.ts` (parent-child): panX, panY, scale state (lines ~106-108). `centerOnNode()` at ~line 204 triggers `animatePanTo()` at ~line 217 with 750ms ease-in-out. Only animates pan, not zoom.
- `ft-dependency-view.ts`: Same pattern, `centerOnNode()` at ~line 305, `animatePanTo()` at ~line 288.
- Both use NODE_WIDTH = 220 SVG units, NODE_HEIGHT = 80.
- Scale clamped 0.3x–3x in wheel handler.
- ViewBox-based rendering: `viewBox="${this.panX} ${this.panY} ${containerWidth / this.scale} ${containerHeight / this.scale}"`

**What to implement:**
- In `centerOnNode()` in BOTH views, compute the target scale: `targetScale = (0.20 * containerWidthPx) / NODE_WIDTH`
  - containerWidthPx = the pixel width of the SVG container element
  - NODE_WIDTH = 220 (the base width in SVG units)
  - This makes the node occupy ~20% of the visible viewport width after zoom
- Clamp targetScale to sensible bounds (suggest 0.3–3.0, matching existing wheel zoom bounds)
- Animate BOTH scale AND pan together in the existing 750ms animation loop (in `animatePanTo()` or a renamed version)
  - Interpolate scale from current to target using the same easing function
  - Recalculate pan target accounting for the new scale (since centering depends on scale: `targetPanX = node.x - (containerWidth / targetScale) / 2`)
  - IMPORTANT: The pan calculation must use the interpolated scale at each animation frame, not a fixed scale, to avoid jumpy/janky animation
- Update the SVG viewBox rendering which already uses `containerWidth / this.scale`

**Document your clamp bounds choice** in the project log.

### Change 2: More Prominent Highlight

Make the selected task node's highlight border more visually prominent.

**Current state (in ft-tree-node.ts):**
- `.node.selected` (line ~79): `border-color: var(--sl-color-primary-500); box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.4);`
- Default border: `2px solid var(--node-stage-color, #6b7280)`

**What to implement:**
- Increase the border width for selected nodes to ~3px (was 2px)
- Add an OFFSET highlight: use box-shadow to create a second outline drawn OUTSIDE the node box with a visible gap/padding. Something like: `box-shadow: 0 0 0 3px transparent, 0 0 0 5px rgba(99, 102, 241, 0.5);` (inner transparent ring creates the gap, outer colored ring creates the highlight). Or use CSS outline + outline-offset. Use your judgment on exact values for a clean, prominent appearance.
- The highlight should look like a "halo" around the node with some padding/gap between the node edge and the highlight ring.
- Apply consistently — ft-tree-node.ts is used by BOTH views, so one change covers both.

## Verification Requirements

After implementing, you MUST verify with real screenshots AND measurements:

1. Build and run the local dashboard:
```bash
cd /workspace/farmtable-f56
cd web && npm ci --prefer-offline && npm run build && cd ..
go build -o ft ./cmd/ft
cp /scion-volumes/scratchpad/web-test/farmtable.db ./localtest.db
FARMTABLE_DB_PATH=./localtest.db ./ft dashboard --port 9876 > dashboard.log 2>&1 &
sleep 3
curl -s http://localhost:9876/ | head -3
```

2. Create a Playwright verification script that:
   - Opens the Tree view, clicks a task to select it
   - Waits for the animation to settle (at least 1s after click)
   - Measures the selected node's rendered width as % of viewport using page.evaluate()
   - Takes a screenshot showing the zoom level + highlight
   - Repeats for the Dependency view
   - Takes before/after screenshots showing highlight styling difference
   - Saves all to /scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-56-zoom-and-highlight/
   - Use: `export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` and pass executablePath in launch options
   - Viewport: 1440x900
   - Run from: `cd /scion-volumes/scratchpad/web-test && node /workspace/farmtable-f56/verify-f56.mjs`

3. Report the measured percentages in your commit message AND in the project log.

## Deliverables

1. **Code changes**: Committed on branch `feat/f56-zoom-and-highlight` in /workspace/farmtable-f56
2. **Verification screenshots**: Saved to /scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-56-zoom-and-highlight/
3. **Project log**: Write to /scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-56-zoom-and-highlight.md with:
   - Zoom calculation approach and formula
   - Clamp bounds and rationale
   - Highlight styling choices (exact CSS values)
   - Measured percentages from verification
4. **Commit** all code changes (but do NOT push)

## Important Notes

- Do NOT push to remote — only commit locally
- Use port 9876 for the dashboard to avoid conflicts
- Clean up the dashboard process when done: `pkill -f 'ft dashboard' 2>/dev/null || true`
- Both views have DUPLICATED pan/zoom code — you must make equivalent changes in BOTH files
- The animation must be smooth — interpolate scale and pan together on each frame
