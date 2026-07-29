# Brief: Engineering Manager — Feature 56: Zoom-to-Target-Size on Selection + More Prominent Highlight

## Critical Constraints (read first)

- **Use a dedicated git worktree**, not the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-f56 -b feat/f56-zoom-and-highlight origin/main`
  (standing policy).
- **Use the local-first verification protocol** — read
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`.
- **Applies to BOTH tree views**: the parent-child Tree view and the Dependency view
  (same scope as Feature 54's minimap — both use Feature 41's animated
  centering-on-selection mechanism).
- **Only one agent runs at a time.** Never run a developer and a reviewer simultaneously.
- **You do NOT merge anything.** Push, open a PR via `gh pr create`, message the
  coordinator.
- **Reviewers must be blind** — fresh `code-reviewer` agent, `--harness claude`.
- **Exit criteria:** Round 1 fix everything (incl. nitpicks). Round 2+: stop if only
  nitpicks remain. Hard cap 5 rounds.
- **Developer harness:** `--type developer` should work; fall back to `--type default` if
  you hit the workspace-trust/"Not logged in" bug.
- **Real screenshots required**, including a measurement-based verification (see below) —
  not just "it looks about right."
- **The coordinator will NOT independently re-read your diff or re-open your
  screenshots** — your own verification is what stands.

## Feature Spec (ptone@google.com, verbatim)

"In the graph/tree views - we need a couple changes - 1 when an item is highlighted, we
want to zoom into a set level (Not sure how to specify - but lets just say so that the
title text is somewhere in the 12-14pt font size - but that is just a guide, not how we
want to set the target measure - the other would be that on a typical screen we want the
task (which is already centered) to occupy about 20% of the overall canvas width. We also
want the active task highlight to be more prominant - lets try a slightly thicker line,
offset around the task box itself by some padded amount?"

## Interpretation (resolve ambiguity per the user's own framing)

The user explicitly says the 12-14pt font-size mention is just an intuitive guide, NOT the
actual target metric to implement against. **The real target measure is**: the selected/
centered task node's rendered width should be approximately 20% of the visible canvas
(viewport) width, on a "typical screen." Implement zoom-to-selection using THIS ratio as
the target, not a font-size calculation.

Concretely:
1. **Zoom-to-target-size on selection**: when a task is selected/highlighted (triggering
   Feature 41's animated pan-to-center in either tree view), also adjust the zoom/scale
   level as part of that same animation so that after settling, the selected task's
   rendered box width ≈ 20% of the current viewport/canvas width. This means:
   - Compute the task node's un-scaled/base width (in SVG units) — this is likely a fixed
     or near-fixed value per node in the current layout.
   - Compute the target scale: `targetScale = (0.20 * viewportWidthPx) / nodeBaseWidthUnits`
     (adjust for whatever unit system the SVG/viewBox actually uses — investigate the
     current pan/zoom implementation, likely touched by Features 41/44/48/51/54, before
     assuming this formula maps directly).
   - Apply this scale as part of the existing 750ms ease-in-out animation (Feature 41) —
     animate scale AND pan together, don't add a separate janky zoom step.
   - Clamp to sensible min/max zoom bounds so this doesn't produce absurd zoom levels for
     edge cases (e.g. an extremely wide or narrow browser window) — use judgment on bounds,
     document your choice.
2. **More prominent highlight**: increase the highlight border/outline's stroke width
   (something noticeably thicker than current — use judgment, maybe try 1.5-2x current), AND
   add an offset/padding so the highlight is a border drawn slightly OUTSIDE the task box's
   own edges (like a halo/glow outline with a small gap or padding between the box and the
   highlight line, not flush against it) rather than directly on the box boundary. Apply
   consistently to both tree views' highlight styling.

## Key Locations

- Repo: base off current `main` (through Feature 55) — fresh feature branch, PR to merge.
- Frontend: `web/src/` — Feature 41's animated centering code (likely in `ft-tree-view.ts`
  and/or a shared pan/zoom utility also used by the Dependency view), the highlight/
  selected-state styling for task nodes in both views.
- Local testing protocol:
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-56-zoom-and-highlight.md`

## Deliverables

1. Pushed branch + open PR against `main`, confirmed CLEAN/MERGEABLE.
2. Real evidence: (a) screenshots of a task being selected in both tree views, showing the
   zoom level after animation settles, WITH a measurement (e.g. via
   `page.evaluate()` reading the actual rendered bounding-box width of the selected node
   vs. the viewport width, computed and reported as a percentage) proving it's
   approximately 20%, (b) before/after screenshots of the highlight styling showing the
   thicker, offset border. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-56-zoom-and-highlight/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-56-zoom-and-highlight.md`
   documenting your zoom-calculation approach, clamp bounds, and highlight styling choices
   (exact stroke width/offset values used).
4. A message to the coordinator with PR URL, summary, review outcome.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the log/evidence per
the spec above (including the measured percentage proof), and message the coordinator.
Then signal task_completed.
