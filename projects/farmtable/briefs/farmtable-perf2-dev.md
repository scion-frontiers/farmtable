# Brief: Perf Phase 2 — Dependency View Viewport Culling

## Critical Constraints (read first)
- Work in a dedicated git worktree (standing policy):
  `git worktree add /workspace/farmtable-perf2-dev -b perf-phase2-viewport-culling origin/main`
- **Read the full investigation report FIRST** — it contains verified code line numbers, a
  concrete implementation sketch, and a risk analysis you should validate (not
  re-derive from scratch):
  `/scion-volumes/scratchpad/projects/farmtable/reports/dependency-view-perf-investigation.md`
- This is a **rendering-path change to a heavily-used, recently-modified component**
  (`ft-dependency-view.ts` — touched by Feature 61v2, 64, 66 this session). Be careful:
  Solo mode filtering, the Feature 64 FLIP-style drag-and-drop animation, and the
  minimap all interact with the node/edge rendering path. The investigation report
  argues these compose safely with viewport culling (minimap uses `layoutNodes`/
  `layoutEdges` directly, Solo filtering happens upstream in `getVisibleTasks()`, DnD
  animations manipulate positions not visibility) — VERIFY this is actually true with
  real testing, don't just trust the report's risk assessment.
- No existing test convention in `web/` — verify manually with real screenshots/measurements.

## Context
ptone reported the Phase 1 perf fix felt less effective in Dependency View than Tree
View. Investigation confirmed why: Phase 1's two fixes (`getChildren()` cache,
`maxDepth=3` default) had **zero effect** on Dependency View — it never calls
`getChildren()` and has no depth-limiting. For a 9,284-task collection it renders
~8,000+ nodes (estimated 4,600-8,700ms render) with no scoping mechanism, and
`structureKey()` rebuilds a ~480KB string on every pan/zoom frame causing ~9-16 FPS
panning (target 60 FPS).

Layer-based scoping (Tree View's approach) doesn't fit Dependency View's semantics —
there's no single root, and hiding "deep" nodes would hide the most-blocked (most
important) tasks. Viewport culling was identified as the right fix: it eliminates
~95-99% of DOM creation with zero UX tradeoff (nodes appear seamlessly on pan), works
regardless of graph shape, and the needed pan/zoom state (`panX`, `panY`, `scale`,
`containerWidth`, `containerHeight`) already exists.

## Task
1. Implement viewport culling in `ft-dependency-view.ts`'s `render()` method: compute
   layout for ALL visible tasks (unchanged), but only create DOM (`<foreignObject>` +
   `<ft-tree-node>`) for nodes whose bounding box intersects the current viewBox. See
   the report's Section 4 implementation sketch for the exact filter logic.
2. Render edges only if at least one endpoint node is visible (per the sketch).
3. Guard `willUpdate()`/`runLayout()` to skip `runLayout()` + `computeEdgeSets()` (and
   therefore `structureKey()`) when only pan/zoom-related properties changed
   (`panX`, `panY`, `scale`, `isPanning`, `draggingNodeId`, `dragOverNodeId`) — per the
   report's sketch. Verify this doesn't break cases where a store update happens to
   coincide with a pan/zoom frame (report notes store-triggered updates produce empty
   `changedProperties` via `TaskStoreController`, so they should still trigger layout —
   confirm this is actually correct behavior in practice).
4. Fix the minor `allTasks.length === 0` → `taskCount === 0` nit in `render()` (line
   ~1343) while you're in there — trivial, avoids an unnecessary array copy.
5. **Verify interactions explicitly, don't assume**:
   a. Solo mode (Feature 61v2/66): toggle Solo on a task in a large collection, confirm
      filtering + viewport culling compose correctly (soloed nodes render, culled nodes
      don't double-hide/double-show).
   b. Minimap (Feature 54): confirm it still shows the FULL graph overview (not just the
      culled/visible subset) since it reads `layoutNodes`/`layoutEdges` directly.
   c. Feature 64 DnD FLIP animation: perform a drag-and-drop relationship change,
      confirm the choreographed animation still works correctly when the dropped/moved
      node is at the edge of or outside the current viewport (this is the highest-risk
      interaction — animations moving nodes into/out of the culled region need to not
      glitch or disappear incorrectly).
   d. Panning/zooming itself: confirm nodes appear/disappear seamlessly with no visible
      pop-in flicker, and edges crossing the viewport boundary render sensibly (don't
      need perfect partial-edge clipping — just don't let them vanish/break visually).
6. Get a REAL live measurement on a large (~9k task) collection: initial render time and
   pan FPS (or frame time), before/after comparison if feasible. Label clearly what's
   measured vs. estimated — do not present estimates as measurements (standing project
   norm).

## Deliverables
1. A PR against `main`.
2. Evidence (screenshots + real measurements where obtainable) at
   `/scion-volumes/scratchpad/projects/farmtable/reports/perf-phase2-evidence/`,
   covering the render-time/FPS improvement AND the Solo/minimap/DnD interaction checks.
3. A message to the coordinator with the PR link, the real numbers you obtained, and
   explicit pass/fail on each interaction check in step 5.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for questions or completion.
- Do not contact ptone@google.com directly.

## Termination
You MUST implement viewport culling + the pan/zoom layout guard, verify Solo/minimap/DnD
interactions for real (not by assumption), get real measurements where feasible, open the
PR, and message the coordinator with the PR link and explicit check results. Then signal
task_completed.
