# Brief: Engineering Manager — Feature 20: New Collection Button + Modal

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
  - Developer: `scion start farmtable-f20-dev --type developer <task>` — NO
    `--harness` flag (project default is codex).
  - Reviewer: `scion start farmtable-f20-review-rN --type code-reviewer
    --harness claude <task>` (r1, r2, r3...).
- **Keep the developer agent alive** across all fix iterations. Only delete
  it after the coordinator confirms the merge landed.
- **Before opening the PR, rebase onto latest origin/main and confirm `gh
  pr view <n> --json mergeStateStatus,mergeable` shows CLEAN/MERGEABLE.**
  Feature 19's PR hit a squash-merge rebase conflict (stale base commits
  colliding with main's squashed history) — avoid it by branching fresh
  off current main and rebasing again right before opening the PR if any
  time has passed.
- **Quota watch:** if the developer or a reviewer stalls or errors in a way
  that looks like quota/rate-limit/"limits exceeded", do NOT keep retrying.
  Use `scion look <agent>` to check its screen and message the coordinator
  immediately with what you observed. Do not spawn a replacement.
- **The coordinator will NOT independently re-read your diff or re-open
  your screenshots** (context-preservation directive from the project
  owner) — your own verification is what stands. Be rigorous: confirm real
  git diff/commits, confirm screenshots show genuine distinct UI states
  (md5sum them), and say so explicitly and specifically in your report.
- **This is feature 3 of 3 in the chained sequence (18 -> 19 -> 20).** This
  is the last feature before a coordinator-driven Cloud Run redeploy —
  make sure the build is clean and this is genuinely ready to ship.

## Feature 18/19 Handoff (use this, don't reinvent)

- URL param: `?collection=<uuid>`; route state `FtApp.routeView = 'landing'
  | 'validating' | 'board'`.
- Navigate: `pushState` with `url.searchParams.set('collection', id)` then
  call `applyRoute()`. Don't bypass this with direct state mutation.
- Client for collection RPCs (list/create, not board-scoped):
  `createGrpcFarmTableClientWithOptions({ collectionId: null })`.
- The toolbar has a `.collection-controls` wrapper div
  (`display: flex; gap: 0.5rem`) as the FIRST child of the toolbar, with
  `<ft-collection-picker>` inside it. Your new "new collection" button
  goes in as a SIBLING of `<ft-collection-picker>` inside that same
  wrapper — no layout refactor should be needed.
- `ft-collection-picker` component and its dropdown pattern (Shoelace
  `sl-dropdown`/`sl-menu`) is a good reference for consistent styling if
  you need a similar sl-* component for the modal/dialog.
- Full detail: `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-18-collection-url-routing.md`,
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-19-collection-picker.md`

## Feature Spec

Add a "new collection" button immediately to the right of the collection
picker (per the layout handoff above), which opens a modal to create a
collection:

- Button: icon/label consistent with existing toolbar button styling
  (check how other toolbar buttons, e.g. dark mode toggle or help button,
  are styled — match that convention).
- Modal: a simple form with just a **name** field (required, non-empty —
  matches the proto's `min_len = 1` validation on `Collection.name`).
  Explicitly note in the UI or your log that this modal is intentionally
  minimal and will expand later with more fields (platform, description,
  etc.) — don't build those now, out of scope.
- On submit: call the `CreateCollection` RPC (see
  `proto/farmtable.proto` — `CreateCollection`/`CreateCollectionRequest`)
  with the entered name via the unscoped client
  (`createGrpcFarmTableClientWithOptions({ collectionId: null })`).
- On successful create: close the modal and navigate to the new
  collection's board using the SAME routing mechanism as Features 18/19
  (`pushState` + `applyRoute()` with the new collection's ID) — i.e.
  creating a collection should feel like "create and switch into it."
- Handle errors (e.g. RPC failure, validation error) with a visible,
  non-blocking message in the modal — don't silently fail or crash.
- Keyboard-accessible modal (focus trap, Escape to dismiss without
  creating) consistent with existing modal/dialog patterns already in the
  codebase if one exists — check before building a new one from scratch.

Explicitly OUT of scope:
- Any field beyond `name` (platform, description, custom fields, etc.).
- Editing or deleting collections.

## Key Locations

- Repo: `/workspace/farmtable`, base off current `main` (includes PR #65)
  — use a fresh feature branch, PR to merge.
- Frontend: `web/src/` — read Feature 19's diff (`gh pr diff 65`) to see
  the exact toolbar/picker component structure and where to add the
  sibling button.
- Data model reference: `proto/farmtable.proto` — `CreateCollection`,
  `CreateCollectionRequest`, `message Collection` (name validation).
- Repo's own agent guide: `/workspace/farmtable/agents.md` — dev/build/test
  conventions, `farmtable-dev` skill for env setup.
- Prior Playwright learnings (Chromium executable path gotcha, reusable
  node_modules):
  `/scion-volumes/scratchpad/projects/farmtable/learnings/playwright-cloud-run-verification.md`
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-20-new-collection-modal.md`

## Deliverables

1. A pushed feature branch + open PR (via `gh pr create`) against
   `scion-frontiers/farmtable` `main`, confirmed CLEAN/MERGEABLE via `gh
   pr view --json mergeStateStatus,mergeable` before reporting ready.
2. Real, distinct screenshots (verified via `md5sum`, driven by genuine UI
   interaction) showing: (a) button next to the picker, (b) modal open
   with name field, (c) after successful create — new collection visible
   in picker and board switched to it. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-20-new-collection-modal/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-20-new-collection-modal.md`
   with: what was built, each review round's findings and resolutions,
   final state, unaddressed nitpicks, and the developer's optional
   suggestion for the next most logical UI/UX feature (loop will pick
   this up after the upcoming redeploy).
4. A message to the coordinator with: PR URL, branch name, summary, final
   review outcome, confirmation of CLEAN/MERGEABLE status, and the
   developer's next-feature suggestion (if any).

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/
  quota-concern reports.
- Do not message ptone@google.com directly — that's the coordinator's job.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the
log and screenshots at the paths above, and message the coordinator with
the summary. Then signal task_completed. Do not delete your developer
agent until the coordinator confirms the merge landed or explicitly tells
you to clean up.
