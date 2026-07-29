# Brief: Investigate Recurring Dashed-Blue-Edge Bug in Solo Dependency View

## Critical Constraints (read first)
- This is an **investigation only** — produce root-cause findings + a recommendation, do
  NOT implement a fix yet.
- **Do not assume this is the same bug as Feature 66's fix (commit 045a0c2, shared BFS
  visited-set bug).** ptone reports "still SOMETIMES seeing" this after that fix already
  shipped (deploy-46) — treat the earlier fix as a hypothesis to verify, not something
  that definitely addresses this. The visual symptom (a dashed blue edge appearing where
  it shouldn't in Solo mode) may share a root cause with Feature 66, or may be a distinct
  bug that produces a similar-looking symptom (e.g., edge STYLING logic being separate
  from edge/node INCLUSION logic).
- Screenshot: `/scion-volumes/scratchpad/projects/farmtable/bug-report-solo-dashed-blue-edge-recurrence.png`

## User Report (verbatim, from ptone@google.com, via Discord)
"We are still sometimes seeing a dashed blue line when a selected item is solo'd in
dependency view. For example this view: [URL below] shows what is in the attached
screenshot"

## Repro URL
`https://farmtable-qo7k5fvpda-uc.a.run.app/?collection=1e0f02d1-99cd-46bc-a739-bac0fde60710&view=dependencies&task=717ab19c-e86f-4c51-8126-fc16a8f81ef7&solo=1`

## What the Screenshot Shows
Selected/soloed task: "D16-Run-Tests-1784723978..." (thick blue border, center).
- Solid ORANGE edges from "Ready-10" and "Ready-15" into the selected task (blocker
  relationships — expected, this is the upstream chain).
- Solid PURPLE edge from the selected task to "Deploy to production" (blocked-by-selected
  relationship — expected, downstream chain).
- A DASHED BLUE curved edge going directly from "Ready-15" to "Deploy to production" —
  this edge bypasses the selected task entirely and should NOT be visible in Solo mode
  (Solo mode is supposed to show ONLY the selected task's direct upstream/downstream
  chain, not a side relationship between two OTHER tasks in that chain).

## Task
1. Reproduce live. Confirm the exact edge(s) present, their color/style, and which two
   tasks they connect.
2. Inspect the raw relationship data for "Ready-15" and "Deploy to production" via the
   API directly — is there an actual BLOCKS/BLOCKED_BY relationship between them? If so,
   what type? This determines whether the edge represents REAL data (and the bug is in
   what Solo mode chooses to display) or the edge is being drawn incorrectly from data
   that doesn't actually connect them.
3. Read `ft-dependency-view.ts`'s edge-building and edge-styling logic in full — likely
   candidates:
   - `computeEdgeSets()` or similar — determines which edges are "on the critical path"
     (solid, colored by direction) vs "other" (dashed, blue — possibly a generic
     "context" or "cross-edge" category for relationships not on the direct solo chain).
   - The Solo-mode filtering logic fixed in Feature 66 (`getDirectedReachableIds()`,
     `getVisibleTasks()`) — confirm whether it filters NODES only, or also filters which
     EDGES get drawn between the nodes that survive the node filter. If Solo mode filters
     nodes correctly (only shows nodes on the direct chain) but then draws ALL edges
     between whatever nodes ended up visible (including edges that aren't part of the
     direct chain but happen to connect two chain-adjacent nodes), that would explain
     this exact symptom.
4. Determine: is "Ready-15 -> Deploy to production" a real, legitimate relationship in
   the data that simply shouldn't be rendered when Solo-viewing "D16-Run-Tests" (because
   it doesn't run through the selected task), or is this a data/rendering bug of some
   other kind?
5. Identify the precise root cause with code references and recommend a fix.

## Deliverables
1. A findings doc at
   `/scion-volumes/scratchpad/projects/farmtable/reports/solo-dashed-edge-investigation.md`
   with raw relationship data, code-level root cause, and recommended fix.
2. A message to the coordinator with a one-paragraph summary.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` with questions or the final
  summary.
- Do not contact ptone@google.com directly.

## Termination
You MUST reproduce the bug live, inspect raw relationship data, identify the precise
root cause (edge inclusion vs. edge styling vs. something else) with code references, and
recommend a fix. Then message the coordinator and signal task_completed.
