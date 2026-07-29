# Brief: Investigate Large-Collection Performance in Dependency View

## Critical Constraints (read first)
- This is an **investigation only** — produce findings + a recommendation, do NOT
  implement a fix.
- Read the existing investigation first, don't duplicate its work:
  `/scion-volumes/scratchpad/projects/farmtable/reports/large-collection-perf-investigation.md`
  It already covers Tree View in depth (Dagre = dominant bottleneck, ~13s/10k nodes) and
  has a short "Non-Issue: Dependency View" section you should treat as a hypothesis to
  verify, not settled fact — ptone (the actual user) reports the Dependency View
  performance improvement from Perf Phase 1 is "less obvious" than Tree View's, so
  something is still slow there.
- Work in a read-only worktree or the shared checkout — no code changes.

## Context
Perf Phase 1 (PR #149, deployed as deploy-45) shipped two fixes:
1. `TaskStore.getChildren()` O(n²)→O(1) via a Map cache — this is used by BOTH Tree View
   and Dependency View (shared store), so it should already help Dependency View somewhat.
2. A default depth limit (maxDepth=3) for collections >500 tasks — this was added
   specifically to `ft-tree-view.ts` / `ft-hierarchy-nav.ts`. **Dependency View
   (`ft-dependency-view.ts`) did NOT get an equivalent default-scoping treatment.**

The original investigation's "Non-Issue" reasoning: Dependency View uses its own
`computeLayers()` algorithm (O(V*R), not Dagre's O(n^1.7) crossing-minimization), and
also filters out CLOSED tasks by default, which was assumed to keep node counts down.
That reasoning did NOT account for: (a) large collections with many OPEN tasks and many
BLOCKS/BLOCKED_BY relationships still producing large R (relationship density), (b) DOM
creation cost (10k SVG foreignObject + LitElement instances) applying identically
regardless of which layout algorithm computed the positions, (c) whether `computeLayers()`
itself has its own hidden O(n²) hotspot analogous to the old `getChildren()` bug.

## Task
1. Read `ft-dependency-view.ts` in full — specifically `computeLayers()` and the render
   method. Identify:
   - Big-O complexity of `computeLayers()` as actually implemented (not just as described
     in the prior report — verify it).
   - Whether it has its own O(n²)-or-worse hotspot analogous to the old `getChildren()`
     bug (e.g. repeated linear scans per node for relationship lookups).
   - How many DOM nodes get created for a large (~10k task) collection with realistic
     relationship density in Dependency View specifically.
2. Find a real large collection on the live instance (check collections used for prior
   perf testing — deploy-45's evidence dir, or decomposer test collections referenced in
   the original investigation) and open it in Dependency View. Measure actual load/render
   time to interactive. Compare against Tree View's measured 2,999ms (post-fix, from
   deploy-45 evidence) for the same collection if possible.
3. Determine whether an analogous "default-scoping" strategy makes sense for Dependency
   View, and if so what it should scope BY, since Dependency View isn't a single-rooted
   depth hierarchy the way Tree View is (it's potentially many independent BLOCKS chains).
   Consider options like: limit to N largest/most-relevant chains by default with an
   "N tasks with no rendered relationships hidden" indicator, viewport culling (Strategy C
   from the original report), or a Web Worker to unblock the main thread during layout
   (Strategy D) if `computeLayers()` itself turns out to be the bottleneck rather than DOM
   creation.
4. Recommend ONE concrete, scoped fix (not a menu of options) with a complexity estimate,
   matching the rigor of the original investigation (Priority 1/2, LOW/MEDIUM/HIGH
   complexity, expected impact with real numbers where possible).

## Deliverables
1. A findings + recommendation doc at
   `/scion-volumes/scratchpad/projects/farmtable/reports/dependency-view-perf-investigation.md`
   — must include real measured numbers where feasible (label anything estimated vs.
   measured, per this project's standing evidence-verification norm).
2. A message to the coordinator with the one-paragraph summary of the root cause and
   recommended fix.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` with questions or the final
  summary.
- Do not contact ptone@google.com directly — the coordinator relays.

## Termination
You MUST verify (not just repeat) the prior investigation's "Non-Issue: Dependency View"
claim against real code and, ideally, real measurement, produce the findings doc with ONE
concrete recommended fix, and message the coordinator with the summary. Then signal
task_completed.
