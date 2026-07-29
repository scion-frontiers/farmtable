# Brief: URGENT — Investigate Drag-and-Drop Broken Everywhere (Real User Regression)

## Critical Constraints (read first)
- Use a dedicated git worktree: `git worktree add /workspace/farmtable-inv-dnd -b
  explore/dnd-broken-investigation origin/main` (standing policy).
- **This contradicts a prior investigation** (`farmtable-inv-triage-dnd`,
  `/scion-volumes/scratchpad/projects/farmtable/reports/triage-dnd-investigation.md`) which
  used a scripted Playwright mouse-drag and found DnD working fine. ptone@google.com has
  now clarified (2026-07-22 01:18, verbatim): "I could see it moved some items - but for
  sure I can't. Its not just that project - drag and drop is broken for me everywhere - ...
  I've done a hard reload and DND busted everywhere for me." This means the PRIOR
  investigation's synthetic mouse-based drag simulation likely does NOT exercise the same
  code path a real browser user-drag does (e.g. if the app uses native HTML5 drag-and-drop
  events — `dragstart`/`dragover`/`drop` — rather than pure mouse-move-based dragging, a
  Playwright `page.mouse.move()` sequence can succeed without ever triggering the actual
  handlers a real user's drag fires). Do not repeat the same mouse-simulation approach and
  conclude "works fine" again — it demonstrably does not match the user's real experience.
- **This is investigation only — do not fix anything or open a PR** unless it's trivial and
  you're highly confident; otherwise hand findings to the coordinator for a fix dispatch.
- This is user-facing broken CORE functionality, everywhere, after a hard reload — treat as
  urgent/high priority.

## Context
Prior investigation (task complete ~01:12) reproduced a successful drag using Playwright
mouse events on collection `f7351b20`, found `isReadOnly=false` everywhere, no console/gRPC
errors, and concluded no bug existed. The user's follow-up makes clear that conclusion was
wrong — real drag-and-drop is broken globally for them, in their actual browser, even after
a hard reload (ruling out client-side cache/stale-JS as the cause — it's really the deployed
code).

The user explicitly suggested two useful debugging approaches — use both:
1. "add some front-end console logging for DND events to debug"
2. "look for changes over the last few hours that could be effecting it"

## Recent deploy timeline (last few hours) — start here for approach #2
Check each of these for anything that could plausibly interfere with drag-and-drop
(especially CSS changes to overflow/position/pointer-events/z-index on containers the
Kanban cards/columns live in, since 3 of the last 4 merges touched exactly that area):
- PR #111 (Feature 39, commit `8dfd5b8`... wait, actually 8dfd5b8 was the earlier merge —
  double check via `git log`): removed per-column `overflow`/`min-height` CSS from
  `ft-kanban-view.ts`/`ft-kanban-column.ts` so `.main` became the single scroll container.
  **This is the most likely suspect** — changing `overflow` values on the exact containers
  that hold the draggable cards can break drag-and-drop (e.g. `overflow: hidden`/`auto` on
  an ancestor can clip/prevent drag ghosting, change scroll-during-drag behavior, or a
  `min-height: 0` change could collapse a container drag detection depends on).
- PR #112 (Feature 40): CSS changes to `ft-inspector.ts` (flex height chain, Shoelace
  tab-group). Less likely to affect Kanban DnD directly but check for shared/global CSS
  touched.
- PR #113 (Feature 41): tree-view centering animation, `ft-tree-view.ts` only — unlikely
  to affect Kanban DnD, but confirm it's fully isolated (no shared drag-related utility
  module touched).
- PR #109 (Feature 38): `theme.css` `ft-app` display flex change + defensive CSS
  (`overflow: hidden` on `:host`, `min-width: 0` on `.main`) — also worth checking, this
  changed the app-shell's overflow behavior broadly.
Run `git log --oneline -p -- web/src/components/kanban/ web/src/theme.css` (or wherever the
Kanban/drag code + shared CSS actually live) across this range to see the literal diffs.

## Task
1. **Reproduce with REAL drag semantics.** Determine how the Kanban board actually
   implements drag-and-drop (search for `draggable=`, `dragstart`, `dragover`, `drop`,
   `dragend` listeners, or a drag library import in `web/src/components/kanban/` or
   similar). Then reproduce using Playwright's proper HTML5 DnD simulation — dispatch real
   `dragstart`/`dragover`/`drop` events via `page.dispatchEvent` or use Playwright's
   built-in `dragTo()` API (which correctly simulates native HTML5 DnD, unlike raw
   `mouse.move()` sequences) — on the LIVE site, current rev (check `gcloud run services
   describe` for the current revision first).
2. Add temporary console logging (or check existing logging) around the DnD event handlers
   to see which events fire and which don't when a drag is attempted — this directly
   implements the user's suggestion. You can do this via `page.on('console', ...)` +
   `page.evaluate()` to inject listeners, without needing to modify and redeploy source.
3. Bisect the CSS/JS changes from PRs #109, #111, #112, #113 — try reverting or overriding
   the most suspicious CSS property changes (via Playwright's ability to inject CSS
   overrides on a live page, `page.addStyleTag()`) to see if drag-and-drop starts working
   again with any of them reverted. This is a fast way to isolate the culprit without a
   full local rebuild per candidate.
4. If you find the exact commit/CSS property responsible, say so precisely (file, property,
   before/after value).

## Deliverables
1. Updated/new findings report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/dnd-broken-investigation.md`:
   root cause (specific commit/file/property if found), evidence (console log output
   showing which DnD events do/don't fire, screenshots/video if useful), and a clear
   recommendation for the fix.
2. A message to the coordinator with the root cause and recommendation — be explicit about
   whether this needs an urgent EM fix dispatch and roughly how large the fix looks (a CSS
   property revert vs. something more involved).

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination
You MUST determine the actual root cause (using real HTML5 DnD simulation, not plain mouse
events), produce the findings report, and message the coordinator. Then signal
task_completed.
