# Brief: Feature 64 — Choreographed Animation for Dependency View Drag-and-Drop

## Critical Constraints (read first)
- Use a dedicated git worktree: `git worktree add /workspace/farmtable-f64-dnd-animation
  -b feature/f64-dnd-animation origin/main` (standing policy).
- Local-build-first Playwright verification protocol applies.
- **This is an acknowledged-challenging animation feature.** Take time to understand the
  existing layout/animation code before writing new code — read Feature 44 (dependency
  view creation), Feature 48 (drag-and-drop relationship building), Feature 51 (layout
  fixes), and Feature 60 (poll-tick redraw fix) history/code first. Don't reinvent
  positioning logic that already exists (`assignLayers`, `structureKey`, layout
  computation in `ft-dependency-view.ts`).
- **Evidence for animations is hard to fake convincingly, but also hard to verify from a
  single screenshot.** For this feature specifically: capture a SEQUENCE of screenshots
  at short intervals during the animation (or a short screen recording / GIF if your
  tooling supports it) showing the blocking node NOT moving, the blocked node moving from
  drop location to final position, and the edge appearing after node movement completes.
  Also log actual computed positions (x/y coordinates) of key nodes at each animation
  phase — numbers are harder to fake than pictures and let the reviewer verify the
  choreography without needing to watch a video.

## Context
ptone@google.com described the current problem and desired behavior (2026-07-24):

> "in the dependency tree view after a drag and drop event the tree redraws and scales
> out making it hard to track the node that just changed. We want to try and do an
> animation where the new blocking node the drop target stays exactly where it was and
> the new blocked node moves. It's animated from the location where it was when the drop
> event occurred and animates into the position where it will be mapped in the new graph,
> other nodes move as needed, and then the edge is drawn as a sequence so that the user
> can keep track of how things just changed."

Breaking this into a precise choreography (confirm this matches your understanding before
implementing, or ask via the coordinator if genuinely ambiguous):

1. **Trigger**: user drags one task node onto another in the Dependency View, creating a
   new BLOCKS/BLOCKED_BY relationship (existing DnD mechanism from Feature 48).
2. **Current (broken) behavior**: the whole graph recomputes layout and the view
   redraws/rescales (zooms out) to fit everything, losing visual continuity — the user
   loses track of which node just changed.
3. **Desired behavior** (a FLIP-style animation — First/Last/Invert/Play — is the standard
   technique for this class of problem, but you don't have to use that exact
   implementation pattern if you find a better fit for this codebase's rendering approach,
   e.g. SVG vs Canvas):
   a. The **blocking node** (the drop target — the node now blocking the dragged one)
      stays visually fixed at its current screen position. It should NOT jump or animate
      away, even if the underlying layout algorithm would normally reposition it.
   b. The **blocked node** (the one that was dragged) animates smoothly FROM the exact
      screen position where the drop occurred TO its final computed position in the new
      layout (which may be a different layer/column depending on the new dependency
      structure).
   c. **Other affected nodes** (anything whose layer/position shifts as a result of the
      new edge) animate smoothly to their new positions too — not an instant snap, and
      not part of a full-canvas rescale/re-zoom.
   d. **The new edge is drawn AFTER node movement completes**, as a distinct animation
      step (e.g. a line/path animating in, or a simple fade/draw-in) — not simultaneously
      with node movement. This lets the user visually parse "node moved here" before
      "now they're connected."
4. **Scope**: Dependency View only (not Tree View — Tree View's DnD, if any, is a
   different interaction and out of scope here).

## Task
1. Investigate the current DnD-drop → layout-recompute → redraw pipeline in
   `ft-dependency-view.ts` (or wherever Feature 48's drop handler and Feature 44/51's
   layout algorithm live). Understand: what triggers the full rescale/zoom-out today, and
   where node positions are computed (`assignLayers` or equivalent).
2. Design and implement the choreographed animation per the breakdown above. Likely
   approach: capture "before" positions of all nodes right before layout recompute,
   compute the "after" layout, then animate each node's transform from before→after using
   CSS transitions or a JS animation loop (check what's already used for the existing
   pan/zoom-to-selection animation in Tree View for a consistent technique/timing —
   Feature 41/56/58 used a 750ms-ish ease-in-out, matching that feel is probably good for
   consistency, but use your judgment on exact duration for this different kind of
   animation).
3. Ensure the "blocking node stays fixed" requirement holds even if the layout algorithm
   would normally reposition it — you may need to special-case anchoring it, or adjust the
   layout algorithm to treat the DnD target as a pinned anchor point when computing the
   new layout for this specific interaction.
4. Sequence the edge draw-in to occur after node animation completes (e.g. `await` the
   node animation's completion, or use a timeout/animation-end event, before starting the
   edge draw-in).
5. Make sure this doesn't reintroduce the poll-tick redraw bug fixed in Feature 60 — this
   new animation should only trigger on an actual DnD-drop event, not on background poll
   refreshes.

## Deliverables
1. PR against `main`.
2. Real evidence: a sequence of screenshots (or recording) showing the before/during/after
   states of a DnD-drop, PLUS a logged set of computed node coordinates at each phase
   proving: (a) the blocking node's position is unchanged, (b) the blocked node's
   trajectory goes from drop-location to final-position, (c) the edge appears after node
   movement settles (timestamp/sequencing evidence). Save all of this to
   `/scion-volumes/scratchpad/projects/farmtable/reports/f64-dnd-animation-evidence/`.
3. Confirm no regression to the poll-tick redraw fix (Feature 60) or existing Solo mode
   (Feature 61/61v2) in the Dependency View.
4. A brief report describing the animation approach taken and any design decisions made
   where the request was ambiguous.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for review requests, questions, or
  completion. If the choreography has a genuine ambiguity affecting the end-user
  experience significantly (e.g., exact timing/easing preferences), relay through the
  coordinator rather than guessing on something that affects feel long-term — but use
  reasonable judgment for minor implementation details.
- Do not message ptone@google.com directly.

## Termination
You MUST implement the choreographed DnD animation per the breakdown above, verify with
real evidence (screenshots/recording + logged coordinates proving the specific
choreography), confirm no regressions, open a PR, and message the coordinator with the PR
link and evidence summary. Then signal task_completed.
