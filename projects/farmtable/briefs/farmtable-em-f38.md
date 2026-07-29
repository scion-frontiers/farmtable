# Brief: Engineering Manager — Feature 38: Truly Independent Main-Content Scroll

## Critical Constraints (read first)

- **This is a REFINEMENT of Feature 36** (PR #106, "independent vertical scroll for main
  content" — `min-height: 0` + `overflow: auto` on `.board`/`.on-hold-columns` in
  `ft-kanban-view.ts`). ptone@google.com reports it's not quite right: scrolling the main
  content still moves the header and/or Inspector panel. Read PR #106's diff (`gh pr diff
  106`) and its feature log
  (`/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-36-main-content-scroll.md`)
  before touching anything — understand exactly what that fix did and why it's incomplete.
- **Only one agent runs at a time.** Never run a developer and a reviewer simultaneously.
- **You do NOT merge anything.** Push, open a PR via `gh pr create`, message the
  coordinator.
- **Reviewers must be blind** — fresh `code-reviewer` agent, `--harness claude`.
- **Exit criteria:** Round 1 fix everything (incl. nitpicks). Round 2+: stop if only
  nitpicks remain. Hard cap 5 rounds.
- **Developer harness:** `scion start farmtable-f38-dev --type developer <task>` should
  work now (the earlier provisioning bug appears resolved) — if it doesn't, fall back to
  `--type default`.
- **Real screenshots AND a real scroll-interaction demonstration required** (md5sum-
  verified, genuine interaction) — this is exactly the kind of bug where a screenshot of a
  static state can look right while the actual behavior is still wrong. Capture at least
  two screenshots at different scroll positions within main content, with the
  header/Inspector visibly in the SAME pixel position in both, to prove they didn't move.
- **The coordinator will NOT independently re-read your diff or re-open your
  screenshots** — your own verification is what stands.

## Feature Spec

**The actual requirement** (restated precisely from the user): the `main` content area
(Kanban/Tree/Dashboard/Ready Queue — whatever's currently rendered there) must scroll
**independently** — meaning:
- Scrolling within `main` must NOT move, shift, or scroll the toolbar/header.
- Scrolling within `main` must NOT move, shift, or scroll the Inspector panel (when open).
- The header and Inspector should behave as if they're in a fixed/sticky layout region,
  completely unaffected by main's internal scroll position.

**Investigate first**: Feature 36's fix added scroll behavior to the Kanban board's inner
containers specifically, but the user's report suggests the outer app-shell layout (the
relationship between `main`, the header, and the Inspector panel — likely all children of
some app-shell/grid container in `ft-app.ts`) may not actually constrain `main` to its own
scroll box — e.g. if the app shell itself is a normal flow layout without a fixed-height
container for `main`, the whole page could still scroll instead of just `main`, dragging
the header along with it even though the Kanban board's own inner overflow works correctly
in isolation.

Find and fix the root layout issue — this likely means:
- The app shell needs a proper CSS Grid or Flexbox layout with defined height regions:
  header (fixed height, no scroll), a row containing `main` + Inspector (each an
  independent scroll container within a fixed-height row), not a normal document-flow
  layout where the whole page scrolls.
- `main`'s own scroll container (from Feature 36, or wherever it ends up) needs `overflow-y:
  auto` with a constrained height (`height: 100%` of its fixed-height parent, not just
  `min-height: 0` on a flex child if the ancestor chain doesn't actually have a bounded
  height).

Explicitly OUT of scope: any other layout/visual changes. Don't touch Inspector's own
internal scroll behavior (leave it as-is unless this fix breaks it, in which case fix only
what you broke).

## Key Locations

- Repo: `/workspace/farmtable`, base off current `main` — fresh feature branch, PR to
  merge.
- Frontend: `web/src/` — the app shell (`ft-app.ts` or equivalent), Feature 36's changes
  (`ft-kanban-view.ts`), the Inspector panel component, and global layout CSS.
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-38-independent-scroll-refinement.md`

## Deliverables

1. Pushed branch + open PR against `main`, confirmed CLEAN/MERGEABLE.
2. Real screenshots/evidence proving the header and Inspector do NOT move at all while
   `main` is scrolled (see the specific evidence requirement above). Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-38-independent-scroll-refinement/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-38-independent-scroll-refinement.md`
   explaining the root layout issue found and the actual fix.
4. A message to the coordinator with PR URL, summary, review outcome.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the log/screenshots,
and message the coordinator. Then signal task_completed.
