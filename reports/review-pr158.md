# Independent Review: PR #158 — fix(dependency): show CLOSED task relationships in Solo mode

**Reviewer:** Independent review agent  
**Date:** 2026-07-24  
**Verdict:** **APPROVE**

---

## Summary

PR #158 fixes a bug where selecting and soloing a CLOSED task in Dependency View
showed "No dependency relationships" despite the task having real BLOCKS
relationships visible in Tree View. The root cause was four independent CLOSED
filters in `ft-dependency-view.ts` that unconditionally excluded CLOSED tasks —
including the explicitly-selected one — preventing BFS traversal, layer
computation, and edge drawing from functioning.

The fix is **surgical and correct**. Only the single explicitly-selected CLOSED
task is exempted from filtering, only when Solo mode is active. All other
unrelated CLOSED tasks remain hidden. Non-solo behavior is completely unchanged.

---

## Analysis of the Four Modification Points

### 1. `getDirectedReachableIds()` — BFS start node (line 126)

**Change:** `task.phase === TaskPhase.CLOSED` → `task.phase === TaskPhase.CLOSED && id !== taskId`

**Assessment: Correct.**
The BFS needs to start from the selected task even when it's CLOSED. The guard
`id !== taskId` exempts only the start node; all other CLOSED nodes encountered
during traversal are still filtered. This prevents the graph from pulling in
unrelated closed tasks transitively.

### 2. `getVisibleTasks()` — involvedIds and phase filter (lines 695-722)

**Change:** Two additions:
- **Solo-mode exception block** (lines 695-711): When `isolateMode && selectedTaskId`
  and the selected task is CLOSED, adds the selected task and its direct
  relationship targets (both BLOCKS and BLOCKED_BY) to `involvedIds`.
- **Phase filter** (lines 716-722): `isExemptClosed(t)` allows only the single
  selected CLOSED task through the phase filter; all other CLOSED tasks are
  still excluded.

**Assessment: Correct.**
The exception block seeds `involvedIds` so the downstream BFS has nodes to work
with. Crucially, even though the exception block adds direct targets to
`involvedIds` regardless of their phase, the phase filter at line 718-722 only
exempts the selected task (`this.isolateMode && this.selectedTaskId === t.id`).
Any other CLOSED targets are added to `involvedIds` but blocked by the phase
filter — no leakage.

### 3. `computeLayers()` — blocker filter (lines 186-191)

**Change:** `blocker.phase === TaskPhase.CLOSED` → `blocker.phase === TaskPhase.CLOSED && !exemptClosedIds?.has(rel.targetTaskId)`

**Assessment: Correct. This is the fix the original investigation missed.**

The investigation assumed that once the CLOSED task made it into the task list,
layer computation would "just work." This assumption was wrong because
`computeLayers()` has its OWN internal CLOSED filter when computing
`maxBlockerLayer` — it skips CLOSED blockers. Without this fix, the CLOSED task
would be in the task list but would not be recognized as a blocker of its
downstream tasks, causing all tasks to land at Layer 0 (no layering, no useful
graph structure).

The `exemptClosedIds` parameter is computed as a `Set` containing only the
selected CLOSED task's ID (lines 803-811), and only when `isolateMode` is active
and the selected task is actually CLOSED. When `isolateMode` is false or the
selected task is not CLOSED, `exemptClosedIds` is `undefined`, making the
optional-chaining `!exemptClosedIds?.has(...)` evaluate to `!undefined` = `true`,
which preserves the original `blocker.phase === TaskPhase.CLOSED` behavior
exactly.

### 4. Edge building in `runLayout()` — blocker filter (lines 854-859)

**Change:** Identical pattern to `computeLayers()` — same `exemptClosedIds` guard.

**Assessment: Correct. Also missed by the original investigation.**

Same root cause: the edge-building loop has its own CLOSED filter. Without this
fix, even with the CLOSED task having a layout node and correct layer, edges
from/to it would be silently dropped, producing a graph with nodes but no
connecting edges.

Uses the same `exemptClosedIds` set computed once at lines 803-811, ensuring
consistency between layer computation and edge building.

---

## Edge Case Analysis

### CLOSED task's relationships point to another CLOSED task

If the selected CLOSED task A blocks another CLOSED task E:
- `getVisibleTasks()`: E is added to `involvedIds` (line 709) but filtered out
  by the phase check (line 718-722) since `isExemptClosed(E)` returns false.
- `getDirectedReachableIds()`: BFS starts from A (exempted), but skips E
  during traversal (`task.phase === CLOSED && id !== taskId`).
- **Result:** E does not appear. Only A and its non-closed connections show.
  This is sensible behavior — the user sees the selected CLOSED task and the
  open work it connects to. No crash or error.

### Toggling Solo on/off repeatedly

- `isolateMode` is a Lit reactive property. Changes trigger `willUpdate()` →
  `runLayout()`.
- `structureKey()` includes `isolateKey` (`iso:${selectedTaskId}` when Solo is
  ON, empty string when OFF), forcing layout recomputation on toggle.
- All solo-mode exceptions are purely conditional on `this.isolateMode` — no
  persistent state is mutated. No stale state risk.
- **When Solo is OFF:** `isExemptClosed` returns false, `exemptClosedIds` is
  `undefined`, the BFS solo filter doesn't run → CLOSED tasks are fully hidden.
  Confirmed by "after-normal-no-closed.png" evidence screenshot.

### Interaction with Perf Phase 2 viewport culling

Viewport culling (lines 1450-1461) operates purely on node coordinates vs.
viewBox intersection. It doesn't inspect task phases. A solo'd CLOSED task's
small subgraph (typically 2-5 nodes) would be fully within the viewport after
`centerGraph()` runs. No interaction issues.

---

## Non-Solo Behavior Verification

Traced through all four modification points with `isolateMode = false`:

| Point | Guard | Behavior when Solo OFF |
|-------|-------|----------------------|
| `getVisibleTasks()` exception block | `this.isolateMode && ...` → false | Block skipped entirely |
| `isExemptClosed()` | `this.isolateMode && ...` → false | Always returns false |
| `exemptClosedIds` (line 803) | `this.isolateMode && ...` → false | `undefined` |
| `computeLayers()` filter | `!undefined?.has(...)` = `true` | Original behavior preserved |
| Edge building filter | Same as above | Original behavior preserved |
| `getDirectedReachableIds()` | Not called (line 727 guard) | N/A |

**Non-solo view is completely unchanged.** Confirmed by evidence screenshot
showing B, C, D as disconnected Layer-0 nodes with no CLOSED task visible.

---

## TypeScript Check

```
$ cd web && npx tsc --noEmit
(zero errors)
```

---

## Evidence Screenshots Reviewed

1. **before-solo-closed-task.png**: Solo mode on CLOSED "Task A - The Blocker"
   → "No dependency relationships" empty state. Bug confirmed.
2. **after-solo-closed-task.png**: Same task after fix → Task A at Layer 0 with
   "Done" badge, Tasks B/C/D at Layer 1, all edges drawn. Fix confirmed.
3. **after-normal-no-closed.png**: Normal (non-solo) view after fix → CLOSED
   Task A hidden, B/C/D as disconnected nodes. Non-solo behavior preserved.

---

## Verdict: APPROVE

The fix is genuinely surgical — it exempts only the explicitly-selected CLOSED
task, only in Solo mode, at exactly the four points where CLOSED filtering
occurs. The expanded scope (fixing `computeLayers()` and edge building in
addition to the originally-anticipated `getVisibleTasks()` and
`getDirectedReachableIds()`) was necessary and correctly handled. The original
investigation's assumption that these two points would "just work" was wrong
because both have independent CLOSED filters that need the same exemption.

No nits. Clean, well-commented, consistent approach across all four points.
