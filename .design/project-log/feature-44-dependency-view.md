# Feature 44: Dependency Tree View

**Date:** 2026-07-22
**Author:** dev-f44-dependency-view (developer agent)

## Summary
Added a new "Dependencies" view to the Farm Table dashboard. This view renders a left-to-right layered DAG showing only BLOCKS/BLOCKED_BY relationships between tasks, providing a clear visualization of blocking dependency chains.

## Changes
- **New file:** `web/src/components/dependency/ft-dependency-view.ts` (619 lines)
  - LitElement component using dagre with `rankdir: 'LR'` for left-to-right layout
  - Layer 0 = unblocked tasks (same definition as Ready Queue's `isReady()`)
  - Layer N = 1 + max(layer of direct blockers) — longest-path DAG layering
  - Dashed indigo edges between blocked tasks and their blockers
  - Pan/zoom (mouse wheel 0.3x–3x, mouse drag) and 750ms ease-in-out animated centering on selection
  - Cycle detection with MAX_LAYER_DEPTH cap (50) and console warning
  - CLOSED tasks excluded from the view entirely
- **Modified:** `web/src/components/ft-app.ts`
  - Added import for new dependency view component
  - Added `'dependencies'` to `currentView` type union
  - Added `'dependencies'` to `VALID_VIEWS` set and type cast in `applyRoute()`
  - Added `case 'dependencies'` in `renderMainView()` switch
  - Added `'dependencies'` to `onViewChange()` type cast
  - Added `isTaskVisibleInCurrentView()` logic for the dependencies view
- **Modified:** `web/src/components/ft-toolbar.ts`
  - Added Dependencies radio button with 90° rotated `diagram-3` icon
  - Updated `currentView` type union to include `'dependencies'`
  - Updated `filtersDisabled` check to include the dependencies view

## Architecture Decision
New component rather than mode flag on existing tree view — the layout algorithm (LR DAG vs TB hierarchy), data model (BLOCKED_BY only vs parentTaskId), and interaction model (no expand/collapse, no drag-drop) are sufficiently different to warrant a clean separation.

## Testing
- Created test data with 4-layer blocking chain (A→B→C→D), fan-in (E,F→G), and mixed-layer dependencies (J blocked by I in layer 1 and E in layer 0 → J in layer 2)
- Verified both web build (`tsc --noEmit && vite build`) and Go build pass
- Captured verification screenshots demonstrating multi-layer rendering, multiple blocker lines, view switcher icon, and animated centering
