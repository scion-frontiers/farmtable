# Independent Review: PR #154 — feat(tree): add TB/LR layout orientation toggle

**Reviewer:** Independent review agent  
**Date:** 2026-07-24  
**Verdict:** APPROVE WITH NITS

---

## Summary

PR #154 adds a layout orientation toggle to the parent-child Tree View,
allowing users to switch between top-to-bottom (TB, default) and
left-to-right (LR) layout. The feature includes URL persistence via
`?layoutdir=LR`, a rotate-toggle button in the hierarchy nav bar, and
rotation of the Tree View icon in the view switcher toolbar to reflect the
current orientation.

**Files changed:** `ft-app.ts` (+38/-1), `ft-toolbar.ts` (+7/-1),
`ft-hierarchy-nav.ts` (+24/-0), `ft-tree-view.ts` (+19/-2).

The implementation is clean, correctly follows established patterns, has no
functional bugs, and builds cleanly.

---

## Detailed Analysis

### 1. State/URL Persistence Pattern -- PASS

Verified against the existing `isolateMode`/`solo` pattern in `ft-app.ts`:

| Aspect | `solo` pattern | `layoutdir` pattern | Match? |
|--------|---------------|---------------------|--------|
| State declaration | `@state() private isolateMode = false` | `@state() private layoutOrientation: 'TB' \| 'LR' = 'TB'` | Yes |
| Default omission | Solo omits `?solo=` when off | Omits `?layoutdir=` when TB | Yes |
| URL sync method | `syncSoloToUrl()` via `replaceState` | `syncLayoutDirToUrl()` via `replaceState` | Yes |
| URL restore in `applyRoute()` | `soloParam === '1'` | `layoutdirParam === 'LR' ? 'LR' : 'TB'` | Yes |
| Cleared on collection change | Yes (line 1005) | Yes (line 1007) | Yes |
| Cleared in `removeCollectionFromUrl()` | Yes (line 1020) | Yes (line 1021) | Yes |

**Reload survival:** Confirmed. `applyRoute()` reads `layoutdir` from URL on
every route application, including page load and popstate events.

**Param interaction:** No ordering or collision issues. Uses the
`URLSearchParams` API which handles params independently. `layoutdir` does not
interact with or depend on `?task=`, `?view=`, or `?solo=` params.

**Edge case -- `layoutdir` persists when not on tree view:** When the user
navigates away from tree view (e.g., to kanban), `onViewChange()` does NOT
call `applyRoute()` and does not clear `layoutdir`. This is correct -- the
orientation preference is maintained so switching back to tree view remembers
the user's choice.

### 2. Dagre `rankdir` Wiring -- PASS

**`ft-tree-view.ts` line 409:**
```ts
g.setGraph({ rankdir: this.layoutOrientation, nodesep: 40, ranksep: 60 });
```

`this.layoutOrientation` is always `'TB'` or `'LR'`, both valid Dagre
`rankdir` values. The orientation flows directly to Dagre with no
intermediate transformation.

**Cache invalidation (line 389):**
```ts
.join('|') + '||' + expanded + '||' + isolateKey + '||' + this.layoutOrientation;
```

`structureKey()` includes `this.layoutOrientation`, so changing orientation
produces a different key, which forces `runLayout()` to execute a full Dagre
re-layout rather than returning the cached layout. `needsCenter = true` is
set on re-layout (line 406), triggering a viewport re-center.

### 3. Regression Check -- PASS

Reviewed each code path that could assume TB-only layout:

| Code path | Orientation-dependent? | Assessment |
|-----------|----------------------|------------|
| **FLIP animation** (`centerOnNode`, `animatePanZoomTo`) | No -- uses Dagre-computed `node.x`/`node.y` positions, which are correct for any `rankdir`. Zoom target is based on `NODE_WIDTH` vs viewport, which is orientation-agnostic. | PASS |
| **`centerGraph()`** | No -- computes bounding box from node positions, fits to viewport using `min(sx, sy)`. Works for both wide (LR) and tall (TB) graphs. | PASS |
| **Collapse/expand** | No -- based on task ID sets (`expandedNodes`), purely structural. | PASS |
| **Minimap** (`ft-minimap.ts`) | No -- renders from `layoutNodes`/`layoutEdges` position data. Computes its own bounding box from node positions. No hardcoded orientation. | PASS |
| **Depth-limit badge** (hierarchy nav) | No -- `getMaxLevel()` walks the task tree structure (parent-child relationships), not layout positions. | PASS |
| **Pan/zoom** | No -- operates on viewport coordinates (`panX`, `panY`, `scale`), independent of layout direction. | PASS |
| **Drag-and-drop reparent** | No -- uses task IDs and `getDescendantIds()`, purely structural. | PASS |

### 4. Event Propagation Chain -- PASS

The orientation toggle follows a clean event dispatch chain:

```
ft-hierarchy-nav (onOrientationToggle)
  --> dispatches 'layout-orientation-toggle' (bubbles: true, composed: true)
    --> ft-tree-view (onLayoutOrientationToggle)
      --> re-dispatches 'layout-orientation-toggle' (bubbles: true, composed: true)
        --> ft-app (onLayoutOrientationToggle)
          --> sets this.layoutOrientation
          --> calls syncLayoutDirToUrl()
```

This mirrors the existing `isolate-toggle` event chain. The re-dispatch in
`ft-tree-view.ts` (lines 562-571) is necessary because the event originates
inside the tree view's shadow DOM.

### 5. Build/Typecheck -- PASS

```
$ node_modules/.bin/tsc --noEmit
(exit 0, no output)
```

Clean compilation with no type errors.

### 6. Evidence Screenshots -- VERIFIED

Reviewed all 10 evidence screenshots in
`f67-orientation-evidence/`. Key observations:

- **01 vs 02:** TB shows horizontal spread, LR shows vertical spread. Dagre
  layout is clearly different. Confirmed not byte-identical.
- **03 vs 04:** Tree view icon is upright in TB, rotated 90deg in LR.
- **05 vs 06:** Hierarchy nav shows orientation toggle button (CCW icon when
  TB, CW icon when LR, active/highlighted state in LR).
- **07 vs 08:** Solo mode works correctly in both orientations. The solo
  subtree (Epic + 2 subtasks) renders TB-style in 07 and LR-style in 08.
  These are genuinely different screenshots (not the byte-identical issue
  noted in the brief).
- Minimap correctly reflects the layout in both orientations.

---

## Nits

### Nit 1: Identical icons in LR mode (cosmetic)

**File:** `ft-toolbar.ts` lines 349-351 and 356

When `layoutOrientation === 'LR'`, the Tree View icon becomes `diagram-3`
with `transform: rotate(90deg)`. The Dependencies View icon (line 356) is
permanently `diagram-3` with `style="transform: rotate(90deg)"`. In LR
mode, these two icons look visually identical, which could confuse users.

Visible in evidence screenshots 03 vs 04 -- the 3rd and 4th view-switcher
icons become indistinguishable in LR mode (differentiated only by
selected/unselected state).

**Suggestion:** Consider using a different icon for the Tree view when in LR
mode (e.g., `diagram-3-fill` or adding a small orientation indicator), or
keep the Tree icon un-rotated and instead indicate LR mode through a
different visual cue.

### Nit 2: Layout orientation reset on collection change (design choice)

**File:** `ft-app.ts` line 1007

`layoutdir` is deleted from the URL when switching collections. The comment
says "task IDs are scoped to a collection" -- but layout orientation is a UI
preference, not task-scoped. This is consistent with how Solo mode is
handled (Solo is also cleared), but layout preference is arguably something
that should survive collection changes.

This is a deliberate design choice mirroring the Solo pattern, so it's
consistent. Just noting it as a potential UX improvement for a future
iteration.

### Nit 3: No text label on orientation button (UX)

**File:** `ft-hierarchy-nav.ts` lines 238-245

The Solo button has a text label ("Solo"), but the orientation toggle is
icon-only. For discoverability, a short text label (e.g., "TB"/"LR") could
help new users understand the button's purpose without relying on the
tooltip.

---

## Verdict

**APPROVE WITH NITS**

The implementation is well-structured, correctly mirrors the established
`isolateMode`/`solo` pattern, has no functional bugs, introduces no
regressions in existing features (FLIP animation, collapse/expand, minimap,
depth-limit), and passes TypeScript type-checking cleanly. The three nits
above are all cosmetic/UX suggestions that do not block merging.
