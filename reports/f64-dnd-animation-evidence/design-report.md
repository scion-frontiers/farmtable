# Feature 64: DnD Animation — Design Report

## Problem

After a drag-and-drop creates a new blocking relationship in the Dependency View,
`centerGraph()` fires and zooms out the viewport to fit the entire graph. This
disorients the user: they lose visual continuity and cannot track which node moved
where. The graph appears to "jump" rather than smoothly rearranging.

## Solution: Choreographed FLIP Animation

The implementation uses the **FLIP technique** (First, Last, Invert, Play) to
animate nodes from old positions to new positions after layout recomputation.
The animation is choreographed in two sequential phases:

1. **Node movement** (500ms) — all affected nodes smoothly interpolate to their
   new layout positions.
2. **Edge draw-in** (300ms) — the new dependency edge progressively draws from
   source to target using SVG `stroke-dasharray`/`stroke-dashoffset`.

### Key Design Decisions

#### 1. Blocking node stays visually fixed (viewport adjustment)

**Decision**: Rather than animating the blocking node (drop target), the viewport
(`panX`, `panY`) is shifted so the blocking node's screen position is preserved.
All other nodes animate relative to this anchor.

**Rationale**: The drop target is the user's visual anchor point during DnD. Moving
it would break spatial continuity. The math is:

```
screenPos = (nodeX - panX) * scale

If nodeX changes by deltaX, shifting panX by the same deltaX preserves screenPos:
  (nodeX + deltaX - (panX + deltaX)) * scale = (nodeX - panX) * scale
```

The blocking node therefore has zero movement (it starts and ends at the same screen
position), while all other nodes animate smoothly.

#### 2. Suppress `centerGraph()` only for DnD-triggered relayouts

**Decision**: `centerGraph()` is suppressed only when `dndAnimContext` is set
(i.e., the relayout was triggered by a DnD drop). All other relayout triggers
(initial load, window resize, poll updates with structural changes) continue
to use `centerGraph()` normally.

**Rationale**: `centerGraph()` is the correct behavior for initial view setup
and structural changes from external sources. Only the DnD case needs animation
because only there does the user have a mental model of "where things were."

#### 3. Single-file implementation

**Decision**: All animation logic resides in `ft-dependency-view.ts`. No changes
to `ft-app.ts`, store, poll-manager, or any other component.

**Rationale**: The animation is purely a view concern. The data flow remains
unchanged: `ft-app` dispatches the optimistic store update, the store fires
`tasks-changed`, the controller calls `requestUpdate()`, and `runLayout()` runs.
The only change is what happens *after* layout in the DnD case.

#### 4. Separate animation frame IDs

**Decision**: DnD node animation (`nodeAnimFrameId`) and edge animation
(`edgeAnimFrameId`) use their own rAF IDs, separate from the existing pan/zoom
animation's `animationFrameId`.

**Rationale**: Prevents mutual interference. Cancelling a DnD animation does not
break pan/zoom, and vice versa. Each animation system manages its own lifecycle.

#### 5. Aggressive cancellation on user interaction

**Decision**: DnD animations cancel immediately on any user interaction (pan,
zoom, wheel scroll, minimap click, node selection, another DnD). Cancellation
snaps nodes to their final positions rather than leaving them mid-animation.

**Rationale**: Animation should never block user agency. If the user wants to
interact before animation completes, their input takes priority.

#### 6. Edge draw-in uses stroke-dasharray technique

**Decision**: The new edge animates using SVG `stroke-dasharray` and
`stroke-dashoffset` to create a progressive line-drawing effect, rather than
growing the path geometry.

**Rationale**: The `stroke-dasharray` technique is the standard SVG approach for
path animation. It preserves the correct path geometry throughout (curves follow
the right trajectory from the start) and is GPU-accelerated in all modern browsers.

#### 7. No changes to structureKey hashing or poll-tick logic

**Decision**: The `structureKey()` method and poll-tick redraw logic (Feature 60)
are completely untouched.

**Rationale**: The DnD animation only affects what happens *after* layout, not
*whether* layout runs. During animation, poll ticks compute the same structure key
(the optimistic update already happened) and early-return — no interference.

## Verification Results

Evidence was captured using a Playwright automation script that:

1. Logged into the dashboard
2. Created test tasks with known IDs
3. Switched to the Dependency View
4. Performed a DnD drop (Delta → Alpha)
5. Captured 11 screenshots at precise intervals (16ms, 100ms, 200ms, ... 1000ms)
6. Verified three invariants:

| Check | Result |
|-------|--------|
| Blocking node (Alpha) screen drift | **0.00px — PASS** |
| Blocked node (Delta) movement | **1011.9 graph units — PASS** |
| Viewport scale preserved | **0.504 → 0.504 — PASS** |

## Non-Regression Confirmation

- **Feature 60 (poll-tick redraw)**: `structureKey()` and `snapshotComplete()` logic
  is untouched. `dndAnimContext` is only set in `onNodeDrop`, never by poll path.
- **Feature 61 (Solo/Focus mode)**: Entirely in `ft-tree-view.ts`, no shared state.
- **Existing pan/zoom**: Uses separate `animationFrameId`, unaffected.

## Scope

- **Files changed**: 1 (`ft-dependency-view.ts`)
- **Lines added**: ~301 (constants, interfaces, CSS, state fields, animation methods,
  render helpers, cancellation, guards)
- **Lines removed**: 3 (modified existing lines in `runLayout`, `render`, `updated`)
