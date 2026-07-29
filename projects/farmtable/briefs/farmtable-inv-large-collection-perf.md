# Brief: Investigate Large-Collection (~10k task) Rendering Performance

## Critical Constraints (read first)
- Use a dedicated git worktree if you need to make any throwaway instrumentation/profiling
  changes locally (never commit these): `git worktree add
  /workspace/farmtable-inv-large-collection-perf origin/main` (standing policy). This is a
  **research/investigation task — do not implement fixes**, just measure, diagnose, and
  recommend. If you find trivial/obvious low-risk wins worth calling out, note them as
  recommendations for a follow-up dev task, don't implement them yourself.
- Local-build-first protocol applies for reproduction where practical, but a dataset this
  large may be easier to test against the live Cloud Run instance — use your judgment,
  document which environment you tested in.

## Context
ptone@google.com reported (2026-07-24): "projects with larger number of tasks (say 10k)
result a big rendering compute tax, resulting in the UI becoming unresponsive and laggy.
Good news is user interactions seem to be queued and it does eventually do the right
thing. Having the data in client seems fine - as when using the solo feature the graph
data is sliced and rendered quickly. I'm wondering if there may be a strategy to improve
performance, perhaps by rendering only part of the graph in view (if that itself can be
cheaply calculated?) or maybe only loading some initial level of depth (with a note that
some data is not rendered for performance reasons) - let's investigate options here."

Key clue: Solo mode (Feature 61/61v2 — filters to a subset of nodes) renders fast, which
suggests the bottleneck is rendering/layout COST proportional to node count, not data
fetch/transfer cost. This points toward the SVG/DOM layout and rendering pipeline in
`ft-tree-view.ts` and `ft-dependency-view.ts` (structureKey, assignLayers, or whatever the
current layout algorithm is) as the likely hot path, not the network/store layer.

There are existing large test collections you can likely reuse instead of generating a new
one from scratch — check recent decomposer test runs (mentioned in
`/scion-volumes/scratchpad/projects/farmtable/investigation-cloudsql-connections.md` and
related reports): a ~14,000-task collection was used for decomposer resume-mode testing
(root task `6a553a68`), and there have been several other large decomposer test runs
(flash-lite, Gemma, Haiku model comparisons) that may have left large collections on the
live instance. Check `ft-iap list-tasks` / collection listing to find one with ~10k+ tasks
before creating a new one.

## Task
1. **Reproduce and measure**: Load a ~10k-task collection in Tree View and Dependency View
   (live instance or local against a seeded large DB). Use browser DevTools
   Performance/Profiler (via Playwright's CDP access, or manually if you have interactive
   access) to identify:
   - Actual wall-clock time from data-loaded to first-render, and time for any subsequent
     interaction (pan/zoom/select) to respond.
   - Where time is actually spent: layout computation (assignLayers or equivalent),
     DOM/SVG node creation, browser layout/paint, or something else (e.g. a naive O(n²)
     algorithm somewhere in edge routing or dependency traversal).
   - Confirm/refute ptone's hypothesis that data transfer/client-side storage is NOT the
     bottleneck (compare data-received time vs render-complete time).
2. **Assess "render only what's in view" (viewport culling)**:
   - Is there already a concept of viewport bounds (pan/zoom state) that could cheaply
     determine which nodes are visible?
   - Would culling off-screen nodes from the DOM (while still including them in
     layout/position calculations, or even deferring their layout) meaningfully reduce
     the cost? Estimate what fraction of the cost is layout vs DOM node count.
   - Note any complications: edges connecting an on-screen node to an off-screen one,
     minimap needing full-graph awareness (Feature 54), Solo mode already doing a related
     kind of filtering (Feature 61) — could its filtering mechanism be generalized/reused?
3. **Assess "depth-limited initial load"**:
   - Would only loading/rendering the first N levels of the hierarchy by default (with an
     indicator that more exists, expandable on demand) be simpler to implement than
     viewport culling? What's the UX tradeoff (some data genuinely not visible until
     expanded, vs viewport culling being invisible to the user)?
   - Does the existing collapse/expand mechanism (if any, check Tree View features) provide
     a foundation for this?
4. **Consider other strategies** you're aware of that fit this codebase (e.g., switching
   from SVG to Canvas rendering for very large graphs, virtualized/windowed rendering
   libraries, web worker offloading of layout computation, incremental/progressive
   rendering, level-of-detail simplification when zoomed out). Don't feel limited to only
   the two options ptone suggested — if you find a clearly better approach, propose it.
5. Produce a clear recommendation: which approach(es) are worth pursuing, roughly how
   complex each would be to implement, and what the expected performance improvement would
   be (even a rough estimate, e.g. "viewport culling could cut rendered DOM nodes by ~90%
   for a typical viewport at this zoom level").

## Deliverables
1. A findings/recommendation report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/large-collection-perf-investigation.md`
   covering: reproduction results (with actual numbers — load time, render time, FPS/
   responsiveness during interaction), root-cause diagnosis, and a ranked recommendation
   of strategies with rough complexity/impact estimates.
2. A message to the coordinator summarizing the top-line finding and recommendation.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for questions or completion.
- Do not message ptone@google.com directly — the coordinator will relay findings and
  decide on next steps (e.g. dispatching an architect for a design, or going straight to
  implementation if the fix is well-scoped).

## Termination
You MUST reproduce the performance issue with real measurements, diagnose the root cause,
evaluate the proposed strategies (and any others worth considering), and produce a ranked
recommendation in the report above. Do NOT implement fixes — this is investigation only.
Then message the coordinator and signal task_completed.
