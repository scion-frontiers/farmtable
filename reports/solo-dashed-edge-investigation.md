# Solo Dashed-Blue-Edge Bug Investigation

**Date:** 2026-07-24
**Reporter:** ptone@google.com (via Discord)
**Investigator:** Scion agent

## Summary

The dashed blue edge in Solo mode is a **distinct bug from Feature 66's fix**. Feature 66 fixed
node inclusion (the shared BFS visited-set caused downstream nodes to be missed entirely).
This bug is about **edge inclusion**: Solo mode correctly filters which NODES to display, but
then draws ALL edges between surviving nodes — including "cross-edges" that represent real
relationships but don't pass through the selected task.

## Bug Description

When task "D16-Run-Tests-1784723978..." is selected and Solo mode is active, the view
correctly shows:

- **Upstream blockers** (orange edges): Ready-03, Ready-10, Ready-15 → D16-Run-Tests
- **Downstream dependent** (purple edge): D16-Run-Tests → Deploy to production

But it also shows:

- **A dashed blue edge**: Ready-15 → Deploy to production (bypasses the selected task)

This edge should NOT be visible in Solo mode. Solo mode should show ONLY the selected task's
direct upstream/downstream chain, not cross-relationships between chain members.

## Raw Relationship Data

The live deployment requires Google IAP authentication, preventing direct API inspection.
However, the code analysis proves conclusively that a **real BLOCKED_BY relationship exists
between "Deploy to production" and "Ready-15"** in the data. The edge can only appear in
`layoutEdges` if the edge-building loop (lines 770–786) finds a BLOCKED_BY relationship on
one task whose `targetTaskId` maps to another visible node. This means "Deploy to production"
has a BLOCKED_BY entry pointing at Ready-15 (or equivalently, Ready-15 has a BLOCKS entry
pointing at Deploy to production).

This is a legitimate data relationship (Ready-15 may genuinely need to complete before
deployment), but it should not be rendered in Solo mode because it doesn't run through the
selected task.

## Root Cause (Code-Level)

### The bug is at the intersection of two code paths

#### 1. Node filtering is correct — `getVisibleTasks()` (line 624–673)

When `isolateMode` is true, `getVisibleTasks()` calls `getDirectedReachableIds()` (line 100–138)
which performs two directed BFS traversals:

- **Upstream**: follows BLOCKED_BY edges from the selected task → finds Ready-03, Ready-10, Ready-15
- **Downstream**: follows BLOCKS edges from the selected task → finds Deploy to production

The node set is correct: `{D16-Run-Tests, Ready-03, Ready-10, Ready-15, Deploy to production}`.

#### 2. Edge building is NOT filtered — `runLayout()` (lines 770–786)

```typescript
// Build edge list and node lookup map: blocker → blocked (left → right)
this.nodeMap = new Map(this.layoutNodes.map((n) => [n.id, n]));
this.layoutEdges = [];
for (const task of tasks) {
  for (const rel of task.relationships) {
    if (rel.type !== RelationshipType.BLOCKED_BY) continue;
    if (!taskSet.has(rel.targetTaskId)) continue;
    const blocker = this.store.getTask(rel.targetTaskId);
    if (!blocker || blocker.phase === TaskPhase.CLOSED) continue;
    if (this.nodeMap.has(rel.targetTaskId) && this.nodeMap.has(task.id)) {
      this.layoutEdges.push({
        from: rel.targetTaskId,
        to: task.id,
      });
    }
  }
}
```

This iterates ALL visible tasks and adds edges for ALL their BLOCKED_BY relationships
where both endpoints are visible nodes. **It performs no Solo-mode filtering.** When
"Deploy to production" is iterated, its BLOCKED_BY relationship with "Ready-15" passes
all guards because both are visible nodes — so the edge `Ready-15 → Deploy to production`
is added.

#### 3. Edge classification makes it dashed blue — `classifyEdge()` (lines 1146–1166)

```typescript
private classifyEdge(fromId: string, toId: string): 'blocking' | 'blocked' | null {
  // ...
  // Upstream path: edges where BOTH endpoints are upstream or selected
  const fromIsUpOrSel = fromId === sel || this._upstreamIds.has(fromId);
  const toIsUpOrSel   = toId === sel   || this._upstreamIds.has(toId);
  if (fromIsUpOrSel && toIsUpOrSel) return 'blocking';

  // Downstream path: edges where BOTH endpoints are downstream or selected
  const fromIsDownOrSel = fromId === sel || this._downstreamIds.has(fromId);
  const toIsDownOrSel   = toId === sel   || this._downstreamIds.has(toId);
  if (fromIsDownOrSel && toIsDownOrSel) return 'blocked';

  return null;
}
```

For the edge `Ready-15 → Deploy to production`:
- `Ready-15` is in `_upstreamIds` (blocker of selected task)
- `Deploy to production` is in `_downstreamIds` (blocked by selected task)
- Neither "both upstream" nor "both downstream" matches → returns `null`

A `null`-classified edge gets the `.edge-dependency` CSS class:

```css
.edge-dependency {
  stroke: var(--sl-color-primary-500, #6366f1);  /* blue/indigo */
  stroke-width: 1.5;
  fill: none;
  stroke-dasharray: 6 3;                          /* dashed */
}
```

**This produces the dashed blue edge visible in the screenshot.**

## Relationship to Feature 66

Feature 66 (commit `045a0c2`) fixed a completely different bug: `getDirectedReachableIds()`
used a shared `ids` set for cycle detection across both BFS passes. The upstream BFS added
the start node to `ids`, so the downstream BFS immediately skipped it and never followed
any BLOCKS edges — Solo mode showed only upstream nodes.

The fix gave each BFS its own `visited` set. This correctly fixed NODE inclusion.

**The current bug is orthogonal**: it was always present (or at least present whenever the
data had cross-edges between upstream and downstream chain members), but may have been
masked before Feature 66 because the downstream nodes weren't even visible (so there were
no cross-edges to accidentally render). Feature 66 unmasked this latent edge-inclusion bug.

## Why It's Intermittent ("still SOMETIMES seeing")

The bug only manifests when:
1. Solo mode is active, AND
2. Two nodes on the directed chain (one upstream, one downstream of the selected task)
   also have a DIRECT blocking relationship between them that doesn't pass through the
   selected task.

Many task configurations won't have such cross-edges, so the bug appears intermittent.

## Recommended Fix

**Option A (Minimal — filter in render):** In the render method's edge loop (line 1383–1406),
when `isolateMode` is true, skip edges where `classifyEdge()` returns `null`:

```typescript
// In the render method, inside this.layoutEdges.map():
const classification = this.classifyEdge(e.from, e.to);
// In Solo mode, only show edges that are on the directed path
if (this.isolateMode && classification === null) return null;
const edgeClass = classification === 'blocking'
  ? 'edge-dependency edge-blocking'
  : classification === 'blocked'
    ? 'edge-dependency edge-blocked'
    : 'edge-dependency';
```

**Option B (Structural — filter in runLayout):** Add edge filtering in `runLayout()` after
building edges (line 786), to avoid even storing cross-edges in `layoutEdges` when in Solo mode.
This would require `computeEdgeSets()` to run before edge building, or a separate directed-path
check.

**Recommendation:** Option A is simpler, safer, and lower-risk. It requires a 1-line guard
addition in the render loop. Option B is architecturally cleaner but requires reordering
the layout pipeline.

Both options correctly preserve cross-edges in non-Solo mode (where dashed blue "context"
edges are a valid visual).

## Files Involved

| File | Lines | Role |
|------|-------|------|
| `web/src/components/dependency/ft-dependency-view.ts` | 770–786 | Edge building (no solo filter) |
| `web/src/components/dependency/ft-dependency-view.ts` | 1146–1166 | Edge classification (returns null for cross-edges) |
| `web/src/components/dependency/ft-dependency-view.ts` | 1383–1406 | Edge rendering (applies default dashed blue to null-classified edges) |
| `web/src/components/dependency/ft-dependency-view.ts` | 224–229 | CSS `.edge-dependency` class (dashed blue style) |
| `web/src/components/dependency/ft-dependency-view.ts` | 100–138 | `getDirectedReachableIds()` — node filtering (correct) |
| `web/src/components/dependency/ft-dependency-view.ts` | 624–673 | `getVisibleTasks()` — solo node filter (correct) |
