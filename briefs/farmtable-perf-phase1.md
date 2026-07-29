# Brief: Performance Phase 1 — getChildren() Fix + Default Depth Limit

## Critical Constraints (read first)
- Use a dedicated git worktree: `git worktree add /workspace/farmtable-perf-phase1 -b
  fix/perf-phase1-getchildren-depth origin/main` (standing policy).
- Local-build-first Playwright verification protocol applies, but you'll need a large
  (~10k task) collection to verify the performance improvement — check for an existing
  large collection on the live instance first (several were created during recent
  decomposer model-comparison testing — gemma/flash/haiku-decomposer runs, and a
  ~14,000-task collection with root task `6a553a68` mentioned in earlier Cloud SQL
  investigation work) before generating a new one from scratch.
- Full investigation report (read this first, don't re-derive):
  `/scion-volumes/scratchpad/projects/farmtable/reports/large-collection-perf-investigation.md`
- Real, saved evidence required — actual before/after timing measurements (not just "it
  feels faster"), saved to
  `/scion-volumes/scratchpad/projects/farmtable/reports/perf-phase1-evidence/`.

## Context
An investigation found that Tree View rendering for large collections (~10k tasks) takes
17-25 seconds, dominated by Dagre layout computation (~13s) — that's Phase 2, tracked
separately and NOT in scope here. This is Phase 1: two independent, well-scoped, low-risk
fixes that together should bring render time down to ~1-2 seconds without touching the
layout algorithm itself:

1. **`getChildren()` O(n²) → O(1)**: currently, for each of n rendered nodes,
   `getChildren(parentId)` does `this.allTasks.filter(t => t.parentTaskId === parentId)` —
   a full array scan per call, making the overall render path O(n²). At 10k nodes this
   costs ~620ms. Fix: build a `Map<parentId, Task[]>` once per data-load/update (not per
   render call), then `getChildren()` becomes an O(1) map lookup.
2. **Default depth limit**: the hierarchy nav already has a depth-limiting dropdown
   (used in Solo mode's level selector work from Feature 61/61v2's nitpick fixes) — set a
   sensible default (~3 levels) for large collections so the initial render doesn't
   attempt to lay out the entire 10k-node tree at once. Per the investigation, this alone
   gives a ~98% node reduction for typical collections. Make sure there's a clear
   indicator/affordance that more depth exists and can be expanded (don't silently hide
   data with no way to reveal it).

## Task
1. Implement the `getChildren()` caching fix — find the actual method (likely in
   `ft-tree-view.ts` or a shared task-store utility) and convert the linear scan to a
   cached Map, invalidated/rebuilt whenever the underlying task list changes (don't let it
   go stale after task creation/deletion/reparenting).
2. Implement the default depth limit for large collections — decide on the exact
   threshold and default (the investigation suggests ~3 levels; use your judgment on
   whether this should apply universally or only above some node-count threshold, e.g.
   only limit depth by default for collections above ~500-1000 tasks, to avoid changing
   behavior for small/medium collections that don't need it).
3. Measure actual before/after render time on a ~10k-task collection (or as large as you
   can find/construct) — this is the core evidence requirement, get real numbers.
4. Confirm no regression to existing depth-selector UX, Solo mode, or other Tree View
   features that depend on `getChildren()` or the depth-limiting mechanism.

## Deliverables
1. PR against `main`.
2. Real evidence: before/after render-time measurements on a large collection (ideally
   ~10k tasks), plus confirmation the depth-limit default doesn't silently break existing
   behavior for smaller collections. Saved to the evidence directory above.
3. A brief report on the actual measured speedup achieved.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for review requests, questions, or
  completion.
- Do not message ptone@google.com directly.

## Termination
You MUST implement both fixes, measure real before/after performance on a large
collection, confirm no regressions, open a PR, and message the coordinator with the PR
link and measured speedup. Then signal task_completed.
