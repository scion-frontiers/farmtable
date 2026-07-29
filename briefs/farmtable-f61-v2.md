# Brief: Feature 61 v2 — Fix Un-Solo Bug + Extend Solo to Dependency View

## Critical Constraints (read first)
- Use a dedicated git worktree: `git worktree add /workspace/farmtable-f61-v2 -b
  feature/f61-v2-fixes origin/main` (standing policy).
- Local-build-first Playwright verification protocol applies (see
  `local-test-protocol.md` / `HANDOFF-METHODOLOGY.md`).
- **Real evidence required** — quantitative node-count evidence, not just screenshots,
  same bar as the original Feature 61 work. Several past features got sent back for
  fabricated/insufficient evidence.
- This is a v2 fix on top of already-merged/deployed Feature 61 work (PRs #140, commits
  4fb7f43/0cf1f4b). Read that history before starting — don't re-litigate settled
  decisions (e.g. the "Solo" naming, the descendants-only semantics for Tree View).

## Context
ptone@google.com reported (2026-07-23) two issues with the live Solo feature:
1. **Bug**: "un-soloing does not return to the full view" — toggling Solo off in the Tree
   View does not restore the full tree.
2. **Feature request**: "we want to add this feature to the dependency tree view as well
   (any traversable nodes from selected one)."

Relevant code from Feature 61 (Tree View, `web/src/components/tree/ft-hierarchy-nav.ts`
and `web/src/components/ft-tree-view.ts`):
- `isolateMode` (`@state()`) toggles Solo mode; `getDescendantIds()` does a BFS from the
  selected task to compute descendants; `effectiveRootId` picks between the isolated
  root and `focusRootId` based on `isolateMode`.
- Round 2 fix (commit 42e1266) added: auto-disable `isolateMode` when `selectedTaskId`
  becomes null (via an `updated()` lifecycle check), to close a UX gap flagged in review.
  **This auto-disable logic is the prime suspect for the reported bug** — investigate
  whether toggling Solo off (not via deselection, but via clicking the button again)
  interacts badly with that lifecycle check, or whether `structureKey`/layout caching
  isn't invalidating correctly on toggle-off, or something else entirely. Don't assume
  the cause — reproduce it first, then fix the actual root cause.

## Task — Part 1: Fix the un-solo bug
1. Reproduce: select a mid-hierarchy task in Tree View, toggle Solo ON (confirm filtered
   view), toggle Solo OFF (click the button again) — confirm whether the full tree
   actually returns. Also test toggling off via other paths if there are multiple (e.g.
   does deselecting also count as "un-soloing" per ptone's report, or specifically the
   button toggle?).
2. Identify root cause (don't guess — trace `effectiveRootId`, `structureKey`, and
   `getVisibleTasks()` to see where the "still filtered" state is coming from) and fix it.
3. Verify the fix with real evidence: full tree node count → Solo ON node count → Solo
   OFF node count (should match the original full-tree count exactly).

## Task — Part 2: Extend Solo mode to Dependency View
1. Add an equivalent Solo toggle to the Dependency View (`ft-dependency-view.ts` /
   `structureKey()` / `assignLayers()` — check Feature 44/51/60 history for this
   component's architecture).
2. **Traversal semantics are DIFFERENT from Tree View**: ptone explicitly asked for "any
   traversable nodes from selected one" — meaning the FULL set of nodes reachable from
   the selected node by traversing BLOCKS/BLOCKED_BY edges in EITHER direction
   (upstream blockers AND downstream blocked-by chains, transitively) — i.e. the
   selected node's full connected component in the dependency graph, NOT just
   descendants/one direction like the Tree View's descendants-only rule. Implement a
   bidirectional BFS/graph-traversal (with a cycle guard, same pattern as the Tree
   View's `getDescendantIds`) to compute this set.
3. Reuse the "Solo" naming/button pattern from Tree View for consistency (same label,
   similar icon/placement) unless the Dependency View's existing controls layout makes
   that awkward — use your judgment, but stay consistent unless there's a good reason
   not to.
4. Same interaction requirements as Tree View: survives poll ticks, works with
   pan/zoom/minimap/highlight, re-filters on selection change, correctly un-solos back to
   full graph (make sure you don't reintroduce the Part 1 bug here).

## Deliverables
1. PR against `main` with both the bug fix and the Dependency View extension.
2. Real evidence for BOTH parts:
   - Part 1: full tree count → Solo ON count → Solo OFF count, confirming OFF exactly
     matches the original full count (this is the specific regression being fixed).
   - Part 2: full dependency graph count → Solo ON count (with the specific set of nodes
     included — should include both upstream and downstream connected nodes, not just
     one direction) → Solo OFF count, plus survival through a poll tick.
3. A brief report confirming both fixes work as described.

## Task — Part 3: Edge color-coding on selection (Dependency View only, added mid-flight)
ptone requested (2026-07-23, added after this brief was first dispatched): when a node is
selected in the Dependency View, color-code its edges:
- Edges to nodes BLOCKING the selection → red (e.g. `#D55E00`-ish, red-orange)
- Edges to nodes BLOCKED BY the selection → distinct purple (e.g. `#7B3FF2`/`#6A5ACD`-ish,
  blue-purple)
- Use colorblind-accessible colors (Okabe-Ito style palette) — avoid a straight red/green
  pairing, verify the two chosen colors are distinguishable under deuteranopia/
  protanopia/tritanopia (hue + luminance separation, not just hue).
- This only applies to the Dependency View, not the Tree View.
- Verify with a screenshot showing a selected node with both edge colors visible (or just
  one color if the node only has edges in one direction).

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for review requests, questions, or
  completion.
- Do not message ptone@google.com directly.

## Termination
You MUST fix the un-solo bug, extend Solo to the Dependency View with bidirectional
traversal semantics, add the edge color-coding on selection, verify all three with real
evidence, open a PR, and message the coordinator with the PR link and evidence summary.
Then signal task_completed.
