# Brief: Engineering Manager — Feature 51: Dependency View Layout Fixes (Layer 0 Alignment + Edge Anchoring)

## Critical Constraints (read first)

- **Use a dedicated git worktree**, not the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-f51 -b fix/f51-dependency-view-layout origin/main`
  (standing policy).
- **Use the local-first verification protocol** — read
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`.
- **Reference screenshot from ptone@google.com** — the coordinator has NOT looked at this
  image (explicit instruction to preserve coordinator context) — you should look at it,
  that's your job: `/workspace/downloads/discord_1784742074_Screenshot_2026-07-22_at_10.36.09_AM.png`
- **Only one agent runs at a time.** Never run a developer and a reviewer simultaneously.
- **You do NOT merge anything.** Push, open a PR via `gh pr create`, message the
  coordinator.
- **Reviewers must be blind** — fresh `code-reviewer` agent, `--harness claude`.
- **Exit criteria:** Round 1 fix everything (incl. nitpicks). Round 2+: stop if only
  nitpicks remain. Hard cap 5 rounds.
- **Developer harness:** `--type developer` should work; fall back to `--type default` if
  you hit the workspace-trust/"Not logged in" bug.
- **Real screenshots required** on data that reproduces both issues (multiple genuinely
  unblocked tasks, and at least one task with multiple incoming/outgoing edges to prove
  edge anchoring is correct in a non-trivial layout).
- **The coordinator will NOT independently re-read your diff or re-open your
  screenshots** — your own verification is what stands.

## Feature Spec (ptone@google.com, verbatim)

"A few blocking graph layout changes to make: examples reference attached screenshot
(remember to relay, do not look at screenshots yourself to preserve context). - All
unblocked items should appear left justified together - regardless from layer distance of
their first blocked item. eg Ready-03 and Ready-08 here should be in the same left vertical
column as Ready-01 - edges should always connect to the right and left edges of a task, not
top or bottom - to keep lines from drawing under tasks. eg the connections from ready-09
should emit from the right edge, and attach to the left edges of the connected nodes."

This is about the Dependency View (Feature 44, PR #117 — left-to-right layered DAG showing
BLOCKS/BLOCKED_BY relationships; layer 0 = unblocked tasks, layer N = 1 + max(blocker
layers)).

## Two distinct bugs to investigate and fix

### Bug 1: Some genuinely-unblocked tasks aren't in the leftmost column

Per Feature 44's own layering algorithm (`assignLayers()` in `ft-dependency-view.ts` or
wherever it lives), layer 0 should be ALL tasks with no non-closed blockers — this should
already put every truly-unblocked task in the same leftmost column. The user's report
implies some unblocked tasks (their examples: Ready-03, Ready-08) are appearing further
right than layer 0, presumably still lined up with/near whatever they're near in the graph
rather than pinned to the leftmost column. Investigate:
- Look at the actual screenshot to see the exact broken layout.
- Check the layering algorithm's actual behavior on the current live/test data that
  reproduces this — is the bug in the layer ASSIGNMENT (some unblocked tasks are
  incorrectly computed as layer > 0), or in the RENDERING/positioning (layers are computed
  correctly but the X-coordinate/column placement logic doesn't consistently align same-
  layer nodes to the same X position)?
- Fix whichever layer it's in. The invariant should be: ALL layer-0 nodes render at
  identical X position (leftmost column), regardless of how "deep" other parts of the graph
  extend.

### Bug 2: Edges should anchor to left/right edges of nodes, not top/bottom

Currently edges likely connect using default top/bottom anchor points (common in SVG graph
layout libraries), which can route lines UNDER/THROUGH other task boxes in a dense
left-to-right layout. Fix: edges should always emit from the RIGHT edge of the
upstream/leftward node and attach to the LEFT edge of the downstream/rightward node (since
this is a strictly left-to-right layered layout, the "upstream" node — the blocker — is
always in an earlier/more-left layer than the "downstream" node — the blocked task).
Concretely: `ready-09`'s outgoing connections should emit from ready-09's right edge and
attach to the left edges of whatever it's connected to (i.e. ready-09 is a blocker further
left; its edges should exit the right side toward blocked tasks further right).
- Find the SVG edge-drawing code (likely in the same `ft-dependency-view.ts` from Feature
  44/48) and change the anchor point calculation from whatever it currently uses (probably
  node center, or top/bottom) to right-edge-of-source → left-edge-of-target.
- Confirm this doesn't break Feature 48's drag-and-drop relationship creation (which reads/
  writes to this same view) — spot-check after your fix.

## Key Locations

- Repo: base off current `main` (through Feature 50) — fresh feature branch, PR to merge.
- Frontend: `web/src/` — the Dependency View component (Feature 44/48's home — search for
  `ft-dependency-view.ts` or similar), its `assignLayers()` layering logic, and its SVG
  edge-drawing code.
- Reference screenshot:
  `/workspace/downloads/discord_1784742074_Screenshot_2026-07-22_at_10.36.09_AM.png`
- Prior feature logs:
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-44-dependency-view.md`,
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-48-dependency-view-dnd.md`
- Local testing protocol:
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-51-dependency-view-layout-fixes.md`

## Deliverables

1. Pushed branch + open PR against `main`, confirmed CLEAN/MERGEABLE.
2. Real screenshots: (a) before/after showing all unblocked tasks aligned to the same
   leftmost column, (b) before/after showing edges anchored to left/right edges rather than
   top/bottom, ideally on data with enough complexity to show a line that would previously
   have crossed under a task box. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-51-dependency-view-layout-fixes/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-51-dependency-view-layout-fixes.md`
   documenting the actual root cause of Bug 1 (layer-assignment vs. rendering) and your
   edge-anchoring implementation approach.
4. A message to the coordinator with PR URL, summary, review outcome.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the log/screenshots
per the spec above, and message the coordinator. Then signal task_completed.
