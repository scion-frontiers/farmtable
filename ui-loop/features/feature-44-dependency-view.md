# Feature 44: Dependency Tree View — Design Log

## Design Choices

### New Component vs. Parameterized Existing
Created a new `ft-dependency-view.ts` component (619 lines) in `web/src/components/dependency/` rather than adding a mode flag to the existing `ft-tree-view.ts`. Reasons:
- Different layout algorithm: LR layered DAG vs TB parent-child tree
- Different data model: uses BLOCKED_BY relationships only, no parentTaskId hierarchy
- Different node selection logic (no expand/collapse, no drag-drop reparenting)
- Cleaner separation of concerns; existing tree view is already 628 lines
- Different edge semantics: all edges are dependency edges (dashed indigo), no hierarchy edges

### View Name
"Dependencies" — clear, descriptive, matches the `?view=dependencies` URL parameter.

### Completed Task Handling
CLOSED tasks do not appear in this view. The `isReady()` function (reused from Ready Queue logic) ignores closed blockers, so a completed task is neither an "unblocked" Layer 0 task nor an active blocker. This keeps the view focused on actionable work.

### Layer Assignment Algorithm
Standard longest-path DAG layering:
- Layer 0: Tasks that are OPEN/IN_PROGRESS and have no non-closed blockers (same as Ready Queue "ready" definition)
- Layer N: `1 + max(layer of each direct blocker)` — if blocked by tasks in layers 0 and 2, the task goes in layer 3
- Only OPEN/IN_PROGRESS tasks appear; CLOSED tasks are excluded from all layers

### Cycle Detection
Layer depth is capped at MAX_LAYER_DEPTH (50). The `assignLayers()` method uses a `visited` Set to detect cycles during recursive computation. If a cycle is detected or depth exceeds the cap, a `console.warn` is emitted and the task is placed at the cap layer. The view will not crash or infinite-loop.

### Edge Style
Reused the existing tree view's dependency edge style: dashed indigo lines (`var(--sl-color-primary-500, #6366f1)`, `stroke-width: 1.5`, `stroke-dasharray: 6 3`) for visual consistency with the existing tree view's BLOCKS relationship rendering.

### Pan/Zoom and Animated Centering
Copied from the existing tree view:
- Mouse-wheel zoom (0.3x–3x range)
- Mouse-drag pan
- 750ms ease-in-out animated centering on task selection (via `animatePanTo()`)
- Fit-to-view on initial load (via `centerGraph()`)

### View Switcher Icon
Reused the existing Tree view's `diagram-3` Shoelace icon with CSS `transform: rotate(90deg)` applied inline. This visually rotates the top-to-bottom tree icon into a left-to-right orientation, matching the view's layout direction without needing a new icon asset.

### Filter Behavior
The Dependencies view disables phase/assignee filters (same as the Tree view and Dashboard), since the view's scope is determined by blocking relationships rather than individual task attributes.
