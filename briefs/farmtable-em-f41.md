# Brief: Engineering Manager — Feature 41: Animated Tree-View Centering on Task Selection

## Critical Constraints (read first)

- **Use a dedicated git worktree**, not the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-f41 -b feat/f41-tree-center-animation origin/main`
  (standing policy — avoids branch collisions with other in-flight work).
- **Use the local-first verification protocol** for your first round of verification —
  read `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md` and the "Local
  verification protocol" section in `HANDOFF-METHODOLOGY.md`. Go server supports SQLite
  natively; `ft dashboard` + `FARMTABLE_DB_PATH` against the seeded `web-test/farmtable.db`
  gives a working local dashboard with real data in ~60s. A live-server check will happen
  separately at deploy time — verify locally first for faster iteration.
- **Only one agent runs at a time.** Never run a developer and a reviewer simultaneously.
- **You do NOT merge anything.** Push, open a PR via `gh pr create`, message the
  coordinator.
- **Reviewers must be blind** — fresh `code-reviewer` agent, `--harness claude`.
- **Exit criteria:** Round 1 fix everything (incl. nitpicks). Round 2+: stop if only
  nitpicks remain. Hard cap 5 rounds.
- **Developer harness:** `scion start farmtable-f41-dev --type developer <task>` should
  work; fall back to `--type default` if you hit the workspace-trust/"Not logged in" bug.
- **Real screenshots/video of the actual animation required.** A static before/after
  screenshot pair does NOT prove an animation exists or that its timing/easing is right —
  see "Required Evidence" below.
- **The coordinator will NOT independently re-read your diff or re-open your
  screenshots** — your own verification is what stands.

## Context

Feature 37 (PR #108) already implemented "frame/zoom to node" behavior for the Tree view
when a task is navigated to (from the Inspector's Relationships tab, command palette, or
any other "jump to task X" trigger) — check
`/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-37-scroll-to-item.md`
for exactly what it built (likely an instant/non-animated pan-and-zoom of the SVG/canvas
viewport to center the target node). This feature ADDS smooth animation to that existing
mechanism — it is not a new selection/navigation feature.

## Feature Spec (ptone@google.com, verbatim)

"for sheer UX polish - lets add some animation to the tree canvas when we switch the
highlighted task (by whichever select mechanism -- clicking related in inspector - choosing
through fast search, clicking on task - etc) - lets start with a 750ms ease-in ease-out
translation of the canvas to center the item."

Concretely:
1. Find the Tree view's existing canvas-centering/pan logic (from Feature 37, likely in
   `ft-tree-view.ts` — check for whatever function currently repositions the SVG/canvas
   viewport to bring a selected node into view/center).
2. Wherever that repositioning currently happens instantly (a direct assignment of
   transform/viewBox/scroll position), replace it with an animated transition:
   - Duration: 750ms.
   - Easing: ease-in-out (CSS `cubic-bezier` equivalent of `ease-in-out`, or a JS
     requestAnimationFrame-driven easing function if the pan is done via JS/canvas
     transforms rather than CSS transitions — check how the Tree view is actually
     rendered, e.g. `ft-tree-view.ts` mentioned in Feature 37's brief as being implemented
     with SVG, in which case a CSS `transition: transform 750ms ease-in-out` on the
     transformed group/container is likely the simplest correct approach).
   - The animation should apply for EVERY trigger source that causes tree-view centering:
     clicking a related task in the Inspector's Relationships tab, selecting via the
     command palette, clicking a task node directly in the tree, and any other path that
     currently triggers Feature 37's centering behavior. Don't special-case one trigger and
     miss others — find the single shared function/method that does the centering and
     animate it there so all callers get the animation for free.
3. If the user rapidly selects multiple tasks in succession (e.g. arrow-keys through
   search results), decide sensibly what happens if a new animation starts before the
   previous one finishes (e.g. the new animation should smoothly take over from wherever
   the canvas currently is, not jump or queue up) — use judgment, document your choice.

Explicitly OUT of scope: changing WHAT gets centered/framed (Feature 37's logic for
determining position/zoom level), or adding animation to anything other than tree-view
centering (e.g. don't touch Kanban/Dashboard/Ready-Queue scroll behavior).

## Required Evidence

Static screenshots cannot prove an animation's existence or timing. Do the following:
1. Use Playwright to trigger a tree-view centering (e.g. click a related task in the
   Inspector). Capture a short sequence of screenshots at fixed intervals during the
   transition (e.g. every ~100-150ms across the 750ms window) showing the canvas
   progressively moving toward the target position — NOT just start and end states. This
   sequence is your primary proof the animation is real and roughly the right duration.
2. Alternatively/additionally, if your Playwright setup can capture video or use
   `page.video()`, that's even better evidence — include it if feasible, but the screenshot
   sequence above is the minimum bar.
3. Verify all trigger sources (Inspector Relationships click, command palette selection,
   direct tree-node click) all produce the animation, not just one.
4. Confirm no regression to Feature 37's underlying centering accuracy (the node still ends
   up correctly centered/framed, just now animated getting there).

## Key Locations

- Repo: base off current `main` (rev farmtable-00017-wnn includes through Feature 40) —
  fresh feature branch, PR to merge.
- Frontend: `web/src/` — `ft-tree-view.ts` (Feature 37's centering logic), the Inspector's
  Relationships tab click-through, the command palette selection handler.
- Feature 37's log for reference:
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-37-scroll-to-item.md`
- Local testing protocol:
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-41-tree-center-animation.md`

## Deliverables

1. Pushed branch + open PR against `main`, confirmed CLEAN/MERGEABLE.
2. The screenshot-sequence (or video) evidence from "Required Evidence" above, saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-41-tree-center-animation/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-41-tree-center-animation.md`
   documenting your rapid-reselection-during-animation design choice.
4. A message to the coordinator with PR URL, summary, review outcome.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the log/evidence per
the spec above, and message the coordinator. Then signal task_completed.
