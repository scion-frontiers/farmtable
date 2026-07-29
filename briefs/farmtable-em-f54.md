# Brief: Engineering Manager — Feature 54: Minimap for Tree Views with Draggable Viewport Frame

## Critical Constraints (read first)

- **Use a dedicated git worktree**, not the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-f54 -b feat/f54-tree-minimap origin/main`
  (standing policy).
- **Use the local-first verification protocol** — read
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`.
- **This project has a documented DnD verification pitfall** (Feature 42's dead-zone bug —
  see `/scion-volumes/scratchpad/projects/farmtable/reports/dnd-broken-investigation.md`):
  when verifying the drag-to-pan interaction on the minimap frame, use real mouse-down/
  mouse-move/mouse-up sequences that actually exercise the same code path a real user's
  drag does, and test dragging the frame to multiple distinct regions, not just a single
  easy case.
- **Only one agent runs at a time.** Never run a developer and a reviewer simultaneously.
- **You do NOT merge anything.** Push, open a PR via `gh pr create`, message the
  coordinator.
- **Reviewers must be blind** — fresh `code-reviewer` agent, `--harness claude`.
- **Exit criteria:** Round 1 fix everything (incl. nitpicks). Round 2+: stop if only
  nitpicks remain. Hard cap 5 rounds.
- **Developer harness:** `--type developer` should work; fall back to `--type default` if
  you hit the workspace-trust/"Not logged in" bug.
- **Real evidence required**: screenshots showing the minimap rendering the full graph
  overview, the frame indicator accurately reflecting the current viewport, and a real
  drag interaction that pans the main view to match where the frame was dragged.
- **The coordinator will NOT independently re-read your diff or re-open your
  screenshots** — your own verification is what stands.

## Feature Spec (ptone@google.com, verbatim)

"add a minimap the the tree views in the bottom left with a frame indicator you can drag to
a region of the tree"

## Context

"the tree views" (plural) means BOTH:
1. The parent-child Tree view (Feature 28/37/38/39/40/41/43 — the original tree, now
   showing only hierarchy after Feature 43's fix, with Feature 41's animated centering).
2. The Dependency view (Feature 44/48/51 — the left-to-right layered BLOCKS graph, now with
   correct layer-0 alignment and left/right edge anchoring after Feature 51).

Both are SVG-based pan/zoom canvases. A minimap is a small scaled-down rendering of the
ENTIRE graph (all nodes, positioned proportionally) shown in a fixed corner (bottom-left,
per the ask), with a rectangular "frame" overlay showing what portion of the full graph is
currently visible in the main viewport. Dragging the frame should pan the main view to
show whatever region the frame was dragged to.

## Task

1. **Investigate the existing pan/zoom implementation** in both views — how is the current
   viewport/transform tracked (viewBox, pan offset, zoom level)? Feature 41 already
   animates pan-to-center; Feature 51 reworked the dependency view's layout — understand
   both before building on top of them.
2. **Build a reusable minimap component** if practical (shared between both tree views
   rather than two separate implementations, since the core mechanic — scaled overview +
   draggable viewport frame — is identical; only the underlying graph data differs). Use
   your judgment on whether a shared component or two separate but similar
   implementations is cleaner given the codebase's existing patterns; document your choice.
3. **Minimap rendering**: a small (roughly 150-200px, use your judgment for what reads
   well) fixed-position overlay in the bottom-left corner of each tree view, showing all
   nodes scaled down to fit, preserving relative positions.
4. **Frame indicator**: an outlined rectangle on the minimap showing the current main-view
   viewport's position/size relative to the full graph. Update it live as the user
   pans/zooms the main view (via scroll, drag, or Feature 41's animated centering).
5. **Drag-to-pan interaction**: dragging the frame rectangle should pan the main view's
   viewport to follow, proportionally mapped from minimap coordinates to full-graph
   coordinates. Consider also allowing a click (not just drag) on the minimap to jump the
   viewport there — use your judgment, document your choice, drag-to-pan is the explicit
   ask so prioritize that.
6. Handle edge cases: very small graphs (fewer nodes than fit in the main viewport — minimap
   may not need to show a meaningful frame, or the frame could cover the whole minimap;
   use judgment), empty graphs (hide the minimap or show an empty state).

## Key Locations

- Repo: base off current `main` (through Feature 53, once merged — check `main` status,
  base off whatever's there) — fresh feature branch, PR to merge.
- Frontend: `web/src/` — the Tree view (`ft-tree-view.ts` or similar, Feature 41's
  animation code) and the Dependency view (Feature 44/48/51's component) for their
  pan/zoom/viewport tracking.
- Local testing protocol:
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`
- DnD verification pitfall reference:
  `/scion-volumes/scratchpad/projects/farmtable/reports/dnd-broken-investigation.md`
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-54-tree-minimap.md`

## Deliverables

1. Pushed branch + open PR against `main`, confirmed CLEAN/MERGEABLE.
2. Real screenshots/evidence: minimap rendering on both tree views, frame indicator
   reflecting an actual scrolled/panned viewport state, and a real drag interaction panning
   the main view to a new region (before/after). Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-54-tree-minimap/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-54-tree-minimap.md`
   documenting your architecture choice (shared vs. separate components) and any edge-case
   handling decisions.
4. A message to the coordinator with PR URL, summary, review outcome.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the log/evidence per
the spec above, and message the coordinator. Then signal task_completed.
