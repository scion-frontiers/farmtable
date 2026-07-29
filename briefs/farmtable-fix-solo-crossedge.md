# Brief: Fix — Solo Dependency View Draws Cross-Edges Not on the Selected Task's Chain

## Critical Constraints (read first)
- Dedicated git worktree: `git worktree add /workspace/farmtable-fix-solo-crossedge -b fix-solo-crossedge origin/main`
- Read the full investigation report first — it has exact line numbers and a recommended
  fix already: `/scion-volumes/scratchpad/projects/farmtable/reports/solo-dashed-edge-investigation.md`
- This is the SAME FILE (`ft-dependency-view.ts`) touched by several recent changes this
  session (Feature 66 solo fix, the CLOSED-task solo fix, Perf Phase 2 viewport culling).
  Re-read the current state of the relevant functions rather than assuming line numbers
  from the investigation report are still exactly accurate — they may have shifted from
  the CLOSED-task fix (PR #158) or viewport culling (PR #155) merging after the
  investigation was scoped.

## Context
Bug: in Solo Dependency View, a dashed blue edge sometimes appears connecting two visible
nodes that are NOT the selected task — e.g., selecting "D16-Run-Tests" correctly shows its
direct blockers (Ready-03/10/15, orange edges) and what it blocks (Deploy to production,
purple edge), but ALSO shows a spurious dashed-blue edge directly from "Ready-15" to
"Deploy to production" that bypasses the selected task entirely.

Root cause (verified via live repro + raw relationship data): this is a REAL relationship
in the data (Ready-15 does block Deploy to production), and Solo mode's node filter
correctly includes both nodes since they're both reachable from the selected task. But
the edge-building loop draws EVERY relationship between any two visible nodes, not just
edges that are part of the selected task's direct chain. `classifyEdge()` returns `null`
for this edge (since neither endpoint is the selected task), and `null` classification
defaults to a dashed-blue style — this is a DISTINCT bug from Feature 66 (which fixed
node inclusion, not edge inclusion). Feature 66's fix actually unmasked this latent bug by
making downstream nodes visible for the first time.

## Task
1. Locate the edge-building loop in `runLayout()` and `classifyEdge()` in the current
   `ft-dependency-view.ts` (verify current line numbers, don't trust the investigation's
   numbers blindly given recent merges to this file).
2. Implement the fix: when `isolateMode` (Solo) is true, skip/exclude edges where
   `classifyEdge()` returns `null` — i.e., only render edges that are actually part of the
   selected task's direct upstream or downstream chain, not incidental relationships
   between two other chain members.
3. Verify normal (non-Solo) Dependency View is unaffected — all edges should still render
   normally when Solo is off, including cross-edges between arbitrary tasks.
4. Verify interaction with recent changes to this file:
   - Perf Phase 2 viewport culling (PR #155) — edge culling logic should compose
     correctly with this fix (an edge that's now excluded from Solo shouldn't need
     special handling in the culling filter, but confirm).
   - CLOSED-task solo fix (PR #158) — confirm a CLOSED selected task's chain still works
     correctly with this additional edge filter.
5. Reproduce the ORIGINAL bug scenario and confirm the fix: collection
   `1e0f02d1-99cd-46bc-a739-bac0fde60710`, task `717ab19c-e86f-4c51-8126-fc16a8f81ef7`,
   Solo mode — confirm the dashed blue Ready-15→Deploy-to-production edge no longer
   appears, while the legitimate orange/purple chain edges still do.
6. Run `npx tsc --noEmit`.

## Deliverables
1. A PR against `main`.
2. Before/after screenshots on the EXACT original repro (not a synthetic substitute,
   since this collection is reachable) saved to
   `/scion-volumes/scratchpad/projects/farmtable/reports/solo-crossedge-fix-evidence/`.
3. A message to the coordinator with the PR link and summary of what you verified.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for questions or completion.
- Do not contact ptone@google.com directly.

## Termination
You MUST implement the fix, verify against the exact original repro (before/after
screenshots), confirm non-Solo behavior and interactions with Perf Phase 2/CLOSED-task
fix are unaffected, open the PR, and message the coordinator with the PR link. Then
signal task_completed.
