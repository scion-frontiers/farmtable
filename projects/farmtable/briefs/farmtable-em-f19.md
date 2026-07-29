# Brief: Engineering Manager — Feature 19: Collection Picker (Top-Left)

## Critical Constraints (read first)

- **Only one agent runs at a time.** Never run a developer and a reviewer
  simultaneously.
- **You do NOT merge anything.** When ready, push the branch, open a PR with
  `gh pr create`, then message the coordinator with the PR URL and summary.
  The coordinator runs `gh pr merge --squash` itself.
- **Reviewers must be blind.** Each review round is a brand-new
  `code-reviewer` agent (`--harness claude`) with zero knowledge of prior
  review feedback — give it only the current repo/diff state.
- **Exit criteria for the review loop:**
  - Round 1: have the developer fix ALL findings (including nitpicks).
  - Round 2 onward: if the fresh review returns ONLY nitpick/minor findings
    (nothing significant/blocking), STOP — ship as-is. Otherwise fix and
    run another fresh review round.
  - Hard cap: 5 review rounds total.
  - If the broker/infra genuinely fails to start a review agent after
    3-4 retries with brief waits, it's acceptable to ship on a single
    thorough, clean review round — document the failure explicitly.
- **Agent types/harnesses:**
  - Developer: `scion start farmtable-f19-dev --type developer <task>` — NO
    `--harness` flag (project default is codex).
  - Reviewer: `scion start farmtable-f19-review-rN --type code-reviewer
    --harness claude <task>` (r1, r2, r3...).
- **Keep the developer agent alive** across all fix iterations. Only delete
  it after the coordinator confirms the merge landed.
- **Quota watch:** if the developer or a reviewer stalls or errors in a way
  that looks like quota/rate-limit/"limits exceeded", do NOT keep retrying.
  Use `scion look <agent>` to check its screen and message the coordinator
  immediately with what you observed. Do not spawn a replacement.
- **The coordinator will NOT independently re-read your diff or re-open
  your screenshots** (context-preservation directive from the project
  owner) — your own verification is what stands. Be rigorous: confirm real
  git diff/commits, confirm screenshots show genuine distinct UI states
  (md5sum them), and say so explicitly and specifically in your report.
- **This is feature 2 of 3 in a chained sequence (18 -> 19 -> 20).**
  Feature 18 (merged, PR #64, commit 948aef7) added URL-driven collection
  routing. You MUST build on its exact mechanism (below) — do not
  reinvent routing/state handling. Feature 20 (new-collection modal) will
  sit immediately to the right of the picker you build here, so keep your
  markup/layout easy to extend with a sibling button.

## Feature 18 Handoff — URL/State Mechanism (use this, don't reinvent)

- URL param: `?collection=<uuid>`
- Route state: `FtApp.routeView = 'landing' | 'validating' | 'board'`
- Read current: `new URLSearchParams(window.location.search).get('collection')`
- Write/navigate: `pushState` with `url.searchParams.set('collection', id)`
  followed by calling `applyRoute()`
- Unscoped client (for listing collections): `createGrpcFarmTableClientWithOptions({ collectionId: null })`
- Scoped client (for the board): `createGrpcFarmTableClientWithOptions({ collectionId })`
- Back/forward: a `popstate` listener calls `applyRoute()`
- Full detail + review history: `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-18-collection-url-routing.md`

## Feature Spec

Add a persistent collection picker to the dashboard's top-left, so users
don't have to go back to the Feature 18 landing view to switch collections
once they're on a board.

- Placement: top-left of the toolbar/header (left of the "Farm Table"
  title, or immediately after it — use judgment based on existing header
  layout, but it must be the leftmost interactive control).
- Shows the current collection's name; clicking opens a dropdown/menu
  listing all collections (via `ListCollections`, same unscoped-client
  pattern as Feature 18's landing view).
- Selecting a different collection in the dropdown must use the SAME
  navigation mechanism as Feature 18 (`pushState` + `applyRoute()`) so
  URL, browser history, and board content all stay consistent — do not
  bypass routing with a direct state mutation.
- Only visible/relevant when a board is showing (`routeView === 'board'`);
  not needed on the Feature 18 landing view itself (that IS the picker in
  full-page form already).
- Keep it keyboard-accessible (the codebase already has keyboard-nav
  patterns from Features 9-11 — reuse those conventions, don't invent a
  new focus-management approach).
- Leave clear, obvious space/structure for Feature 20's "new collection"
  button to sit immediately to the right of this picker — you don't need
  to build that button, just don't make the layout awkward to extend.

Explicitly OUT of scope:
- Creating new collections (Feature 20).
- Any change to the Feature 18 landing view itself, beyond what's needed
  to keep both entry points consistent.

## Key Locations

- Repo: `/workspace/farmtable`, base off current `main` (includes PR #64)
  — use a fresh feature branch, PR to merge.
- Frontend: `web/src/` — Feature 18's diff (`git show` on commits 4274f72,
  7fee9ce, or `gh pr diff 64`) shows exactly where routing/state lives;
  read that before designing so you match the existing pattern.
- Repo's own agent guide: `/workspace/farmtable/agents.md` — dev/build/test
  conventions, `farmtable-dev` skill for env setup.
- Prior Playwright learnings (Chromium executable path gotcha, reusable
  node_modules):
  `/scion-volumes/scratchpad/projects/farmtable/learnings/playwright-cloud-run-verification.md`
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-19-collection-picker.md`

## Deliverables

1. A pushed feature branch + open PR (via `gh pr create`) against
   `scion-frontiers/farmtable` `main`.
2. Real, distinct screenshots (verified via `md5sum`, driven by genuine UI
   interaction) showing: (a) picker showing current collection name on a
   board, (b) dropdown open listing multiple collections, (c) after
   selecting a different one, board + URL updated to match. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-19-collection-picker/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-19-collection-picker.md`
   with: what was built, exact component/markup structure (load-bearing
   for Feature 20's button placement), each review round's findings and
   resolutions, final state, unaddressed nitpicks.
4. A message to the coordinator with: PR URL, branch name, summary
   (including where/how Feature 20 should add its button, in a couple
   sentences), and final review outcome.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/
  quota-concern reports.
- Do not message ptone@google.com directly — that's the coordinator's job.

## Termination

You MUST get the PR opened and pushed, produce the log and screenshots at
the paths above, and message the coordinator with the summary (including
the layout/handoff note for Feature 20). Then signal task_completed. Do
not delete your developer agent until the coordinator confirms the merge
landed or explicitly tells you to clean up.
