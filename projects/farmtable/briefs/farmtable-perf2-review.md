# Brief: Independent Review of PR #155 (Perf Phase 2 — Dependency View Viewport Culling)

## Critical Constraints (read first)
- Review only — do not modify code or push commits.
- Work in a throwaway worktree: `gh pr checkout 155` (or checkout the branch manually).
- This is a rendering-path change to `ft-dependency-view.ts`, a component touched by
  several recent features (Solo mode, Feature 64 DnD FLIP animation, Feature 54 minimap).
  Treat it as moderate-risk — verify claims by reading code, don't just trust the PR
  description or evidence report.

## Context
PR #155 implements viewport culling for the Dependency View: layout is computed for all
tasks, but DOM is only created for nodes/edges intersecting the current viewBox (with a
220px margin to avoid pop-in). Also adds a `willUpdate()` guard that skips
`runLayout()`/`structureKey()` recomputation on pan/zoom-only property changes, and a
minor `allTasks.length===0` → `taskCount===0` fix.

This went through one round already: the dev's first evidence submission used a synthetic
200-node test and verified Solo-mode/DnD-animation interactions via code analysis only
(not actual testing). The coordinator sent it back requiring real measurements on a larger
collection and real interactive testing. The redo (now in the PR) added:
- A 3,800-task/3,699-relationship local test collection with real measurements (98.2%
  culling ratio, layout-guard call counts confirmed via monkey-patch, per-frame savings).
- Real Puppeteer-driven Solo mode and drag-and-drop interaction tests with screenshots
  (verified by the coordinator directly — genuinely distinct before/after screenshots,
  not reused/identical).
- An honestly-disclosed remaining limitation: at high edge density (~1,500 visible edges
  in the 3,800-node test), SVG edge rendering causes ~1,100ms pan frames — a pre-existing
  cost not introduced by this PR, since edges are only culled by "at least one endpoint
  visible." Filed as GitHub issue #156 for follow-up, not blocking this PR.

Full evidence: `/scion-volumes/scratchpad/projects/farmtable/reports/perf-phase2-evidence/evidence-report.md`

## Task
1. Read the full diff (`gh pr diff 155`).
2. Verify the viewport culling filter logic in `render()` — check the AABB intersection
   math and margin handling for correctness (off-by-one/edge cases at viewport boundaries).
3. Verify the `willUpdate()` pan/zoom guard — confirm it correctly distinguishes
   pan/zoom-only changes from changes that require a real layout recompute (store updates,
   Solo toggle, task selection, etc.). This is the highest-risk part of the change — a bug
   here could cause the graph to silently fail to update on real data changes.
4. Check interactions with:
   - Solo mode (`getVisibleTasks()` filtering) — confirm it composes correctly with
     culling (sequential filters, no double-hide/double-show).
   - Feature 64 DnD FLIP animation — confirm animated node positions are correctly
     reflected in the culling filter frame-by-frame (an animating node should appear/
     disappear based on its CURRENT interpolated position, not a stale one).
   - Minimap (Feature 54) — confirm it still receives full `layoutNodes`/`layoutEdges`,
     not the culled subset.
5. Confirm `npx tsc --noEmit` passes.
6. Render a verdict: APPROVE, APPROVE WITH NITS, or REQUEST CHANGES, with specific line
   references for any issue.

## Deliverables
1. A review report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/review-pr155.md`.
2. A message to the coordinator with verdict and summary.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` with your verdict.
- Do not contact ptone@google.com.

## Termination
You MUST read the diff and relevant surrounding code, form a genuine independent verdict
(pay particular attention to the willUpdate() guard correctness), write the review report,
and message the coordinator with the verdict. Then signal task_completed.
