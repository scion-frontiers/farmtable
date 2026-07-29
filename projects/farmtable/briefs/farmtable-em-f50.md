# Brief: Engineering Manager — Feature 50: Scrollable Collection List Landing Page + New Project Button

## Critical Constraints (read first)

- **Use a dedicated git worktree**, not the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-f50 -b feat/f50-landing-page-scroll-newproject
  origin/main` (standing policy).
- **Use the local-first verification protocol** — read
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`.
- **This project has a long, hard-won history with scroll bugs** (Features 36, 38, 39, 40 —
  four iterations to get Kanban/Inspector scroll right, see
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-39-single-scroll-region.md`
  and `feature-40-inspector-scroll.md`). Learn from that history: verify with a genuinely
  overflowing list (enough collections that the list exceeds viewport height), use a real
  scroll interaction (wheel event, not `element.scrollTop =`), and don't just eyeball a
  static screenshot.
- **Only one agent runs at a time.** Never run a developer and a reviewer simultaneously.
- **You do NOT merge anything.** Push, open a PR via `gh pr create`, message the
  coordinator.
- **Reviewers must be blind** — fresh `code-reviewer` agent, `--harness claude`.
- **Exit criteria:** Round 1 fix everything (incl. nitpicks). Round 2+: stop if only
  nitpicks remain. Hard cap 5 rounds.
- **Developer harness:** `--type developer` should work; fall back to `--type default` if
  you hit the workspace-trust/"Not logged in" bug.
- **Real evidence required**: (a) a real scroll interaction on a list with enough
  collections to overflow, proving the list scrolls, (b) the new project button visible and
  functional (creates a new collection, matches Feature 20's existing create flow if
  reusable).
- **The coordinator will NOT independently re-read your diff or re-open your
  screenshots** — your own verification is what stands.

## Feature Spec (ptone@google.com, verbatim)

"the root page that shows the collection list needs to be scrollable, and should have a
new project button"

Concretely: this is the LANDING page shown when no `?collection=` is selected (the
collection-selection page users see before picking/entering a collection — distinct from
the top-left collection PICKER dropdown inside the app, Feature 19). Investigate first to
confirm you've got the right component — search `web/src/` for the landing/collection-list
page component.

1. **Make the list scrollable**: if it currently isn't (e.g. it's unbounded height causing
   page-level scroll, or it's cut off with no scroll at all), give it a proper scroll
   container consistent with this app's established scroll patterns (check Feature 38/39's
   app-shell flex approach for how bounded-height scroll regions are done elsewhere in this
   codebase — don't reinvent a different pattern).
2. **Add a "New Project" button** to this landing page. Check Feature 20 (PR #66, "new
   collection button + modal") — it's very likely this already exists as a
   button+modal INSIDE the app (post-collection-selection), and this feature just needs the
   same capability added to (or reused on) the landing page itself, so a user can create a
   new collection/project without first having to select an existing one. Reuse Feature
   20's existing modal component if at all possible rather than building a new one.

## Key Locations

- Repo: base off current `main` — fresh feature branch, PR to merge.
- Frontend: `web/src/` — the landing/collection-selection page component, Feature 19's
  collection picker (PR #65) and Feature 20's new-collection modal (PR #66) for reference/
  reuse, Feature 38/39's app-shell scroll patterns (`ft-app.ts`, `theme.css`) for
  consistency.
- Local testing protocol:
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-50-landing-scroll-newproject.md`

## Deliverables

1. Pushed branch + open PR against `main`, confirmed CLEAN/MERGEABLE.
2. Real evidence: scroll interaction on an overflowing collection list, and the new project
   button creating a collection successfully. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-50-landing-scroll-newproject/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-50-landing-scroll-newproject.md`.
4. A message to the coordinator with PR URL, summary, review outcome.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the log/evidence, and
message the coordinator. Then signal task_completed.
