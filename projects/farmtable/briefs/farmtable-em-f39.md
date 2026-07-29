# Brief: Engineering Manager — Feature 39: Independent Main + Inspector Scroll (v3 fix)

## Critical Constraints (read first)

- **Use a dedicated git worktree**, not the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-f39 -b feat/f39-independent-scroll-v3 origin/main`
  (standing policy as of 2026-07-21 — avoids branch collisions with other in-flight work).
- **This is the THIRD iteration of the same underlying feature.** Read this whole brief
  before touching anything — it explains exactly what the first two attempts got wrong so
  you don't repeat their mistakes.
- **Only one agent runs at a time.** Never run a developer and a reviewer simultaneously.
- **You do NOT merge anything.** Push, open a PR via `gh pr create`, message the
  coordinator.
- **Reviewers must be blind** — fresh `code-reviewer` agent, `--harness claude`.
- **Exit criteria:** Round 1 fix everything (incl. nitpicks). Round 2+: stop if only
  nitpicks remain. Hard cap 5 rounds.
- **Developer harness:** `scion start farmtable-f39-dev --type developer <task>` should
  work; fall back to `--type default` if you hit the workspace-trust/"Not logged in" bug.
- **Real screenshots AND a real scroll-interaction demonstration required.** This exact
  feature has failed verification twice already because static screenshots looked right
  while the actual scroll structure was wrong. See "Required Evidence" below — it is
  more specific than usual, follow it exactly.
- **The coordinator will NOT independently re-read your diff or re-open your
  screenshots** — your own verification is what stands. Given the history here, be
  unusually rigorous with yourself.

## History — what's already been tried and why it's still wrong

1. **Feature 36 (PR #106)**: Added `overflow: auto` + `min-height: 0` to the Kanban board's
   inner column containers (`ft-kanban-view.ts`, `.board`/`.on-hold-columns`). Result: each
   Kanban column got scrollable internally, but the app-shell layout itself still let the
   whole page scroll, dragging the header/Inspector along with it.
2. **Feature 38 (PR #109, commit 50b51ba)**: Found the real app-shell bug — `theme.css` had
   `ft-app { display: block }` which was overriding the Shadow DOM's `:host { display: flex
   }` (CSS specificity: external light-DOM rule beat the component's own `:host` rule).
   Fixed by changing it to `display: flex`, plus defensive CSS (`overflow: hidden` on
   `:host`, `min-height: 0` on `.content`, `min-width: 0` on `.main`). This DID fix the
   header/Inspector staying fixed while "main" scrolls — verified with pixel-position
   screenshots and just deployed (rev farmtable-00015-65p).
3. **What's STILL wrong (ptone@google.com's live feedback, 2026-07-21 21:41, verbatim):**
   "the vertical scroll fix still needs work - this added a vertical scrollbar PER kanban
   column - but what I really need are independent vertical scroll bars for the whole of
   the main and inspector content - so that they both are vertically scrollable, but scroll
   independently."

   In other words: Feature 36's per-column scroll containers (inside `ft-kanban-view.ts`)
   are still the active scroll mechanism for Kanban — each column scrolls on its own. The
   user does NOT want that. They want exactly TWO scroll regions total on the page:
   - The entire `main` content area (whatever view is active — Kanban board as a whole,
     Tree, Dashboard, Ready Queue) is ONE scrollable region with its own single vertical
     scrollbar — not one scrollbar per column/section within it.
   - The Inspector panel is a SEPARATE scrollable region with its own independent vertical
     scrollbar.
   - Scrolling one must not move or affect the other (this part already works per F38 — do
     not regress it).

## Feature Spec

1. **Remove/replace the per-column scroll behavior** added in Feature 36
   (`ft-kanban-view.ts` `.board`/`.on-hold-columns` `overflow: auto` + `min-height: 0`) —
   the Kanban board's columns should lay out normally (however tall their content makes
   them) and NOT each have their own independent scrollbar.
2. **Give the `main` container itself (the ancestor that wraps whichever view is active —
   Kanban/Tree/Dashboard/Ready Queue) exactly one scroll region**: `overflow-y: auto` on
   the `main` element/container with a bounded height (from Feature 38's flex fix), so the
   WHOLE main content area scrolls together as a single unit when its content overflows
   vertically — e.g. a tall Kanban board scrolls as a whole, not column-by-column.
   - Horizontal scroll (for wide Kanban boards with many columns) should still work as
     before — don't regress that.
3. **Give the Inspector panel its own independent `overflow-y: auto` scroll region** (check
   if it already has one — Feature 25/33 may have set this up; if so, verify it's genuinely
   independent of `main`'s new single scroll container, not accidentally nested inside it
   or sharing a scroll ancestor).
4. **Verify Feature 37's scroll/frame-to-item and Feature 38's fixed header/Inspector
   behavior both still work** after this change (both depend on the scroll-container
   structure you're modifying).

Explicitly OUT of scope: any other layout/visual changes.

## Required Evidence (do exactly this, in this order)

1. Open a Kanban view with a collection that has enough tasks in at least one column to
   overflow vertically (find/create one — the point is total main-content height clearly
   exceeds viewport height).
2. Screenshot A: initial state, scrolled to top.
3. Scroll the `main` area down using mouse wheel / `page.mouse.wheel()` or equivalent
   (not `element.scrollTop =` — that doesn't prove real scroll wiring the way a real wheel
   event does). Screenshot B: main scrolled down. Confirm: (a) only ONE scrollbar was used
   to do this (not per-column), (b) toolbar/header position unchanged vs Screenshot A, (c)
   Inspector (if open) position/content unchanged vs Screenshot A.
4. Open the Inspector on a task with enough content to overflow vertically (or artificially
   confirm its scroll container independently). Scroll the Inspector's content.
   Screenshot C: Inspector scrolled. Confirm: (a) `main`'s scroll position is UNCHANGED
   from wherever it was, (b) only the Inspector's own content moved.
5. Screenshot D: with a wide Kanban board (many columns), confirm horizontal scroll on
   `main` still works (scrolled sideways).
6. Save all 4+ screenshots and describe exactly what each proves in your feature log.

## Key Locations

- Repo: base off current `main` (which already includes F35-F38 + the decomposer merge,
  rev `farmtable-00015-65p` on Cloud Run) — fresh feature branch, PR to merge.
- Frontend: `web/src/` — `ft-kanban-view.ts` (Feature 36's per-column scroll CSS to
  remove/replace), `ft-app.ts` + `theme.css` (Feature 38's app-shell flex fix — the
  ancestor chain your new `main`-level scroll container depends on), the Inspector
  component (check its existing scroll setup).
- Prior feature logs for full context:
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-36-main-content-scroll.md`,
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-38-independent-scroll-refinement.md`
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-39-single-scroll-region.md`

## Deliverables

1. Pushed branch + open PR against `main`, confirmed CLEAN/MERGEABLE.
2. The 4+ screenshots from "Required Evidence" above, saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-39-single-scroll-region/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-39-single-scroll-region.md`
   explaining exactly what changed and why, referencing this brief's history section.
4. A message to the coordinator with PR URL, summary, review outcome.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the log/screenshots
per the exact evidence spec above, and message the coordinator. Then signal task_completed.
