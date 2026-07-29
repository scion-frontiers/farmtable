# Brief: Engineering Manager — Feature 36: Independent Vertical Scroll for Main Content

## Critical Constraints (read first)

- **Only one agent runs at a time.** Never run a developer and a reviewer simultaneously.
- **You do NOT merge anything.** Push, open a PR via `gh pr create`, message the
  coordinator.
- **Reviewers must be blind** — fresh `code-reviewer` agent, `--harness claude`.
- **Exit criteria:** Round 1 fix everything (incl. nitpicks). Round 2+: stop if only
  nitpicks remain. Hard cap 5 rounds.
- **Developer harness:** try `scion start farmtable-f36-dev --type developer <task>` first.
  The `developer` template had a serious provisioning bug earlier today (workspace-trust
  dialog + permanent "Not logged in"). If you hit that, delete and retry once with `--type
  default` instead (same capabilities). Reviewer: `--harness claude` as always.
- **Real screenshots required** (md5sum-verified, genuine interaction) — this is a visible
  layout change, and layout/scroll bugs are easy to get subtly wrong, so be rigorous about
  demonstrating the actual scroll behavior, not just a static screenshot.
- **The coordinator will NOT independently re-read your diff or re-open your
  screenshots** — your own verification is what stands.

## Feature Spec

The main content area (the Kanban/Tree/etc. view area, as distinct from the toolbar and any
side panel like the Inspector) currently has its own horizontal scroll (for wide Kanban
boards with many columns) but relies on the page/document scrolling vertically for tall
content — which means a tall Kanban column's cards push the whole page down, potentially
scrolling other fixed UI (like an open Inspector panel) out of view.

**The ask**: give the main content area its OWN vertical scroll (in addition to the
existing horizontal scroll it already has), so:
- A tall Kanban column (many cards) scrolls WITHIN the main content area.
- The Inspector panel (when open) and the toolbar stay fixed/visible while the user scrolls
  through a tall column's cards.
- This should work consistently across the different views this project has added (Kanban,
  Tree, Dashboard, Ready Queue — check Features 22, 29, 32, 34 for what views currently
  exist) — investigate whether this is a single shared container fix or needs to be applied
  per-view.

Investigate the current CSS/layout structure first (`web/src/` — the app shell, main
content container, existing horizontal-scroll CSS) before making changes, so the fix is a
clean addition to the existing scroll setup rather than a conflicting one.

Explicitly OUT of scope: any other layout/visual changes, changing the Inspector panel's
own scroll behavior (it may already have one — leave it alone unless it's broken by this
change, in which case fix only what you broke).

## Key Locations

- Repo: `/workspace/farmtable`, base off current `main` — fresh feature branch, PR to
  merge.
- Frontend: `web/src/` — the app shell/layout component (likely `ft-app.ts` or similar),
  the Kanban board container's existing horizontal-scroll CSS, and each view component
  (Kanban, Tree, Dashboard, Ready Queue) to check if the fix needs to be per-view or can be
  a shared container-level fix.
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-36-main-content-scroll.md`

## Deliverables

1. Pushed branch + open PR against `main`, confirmed CLEAN/MERGEABLE.
2. Real, distinct screenshots showing: (a) a tall Kanban column scrolled partway down
   within the main content area while the toolbar/Inspector stay visible, (b) the existing
   horizontal scroll still works (wide board, scrolled sideways), (c) at least one other
   view (Dashboard or Ready Queue) confirmed not regressed. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-36-main-content-scroll/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-36-main-content-scroll.md`.
4. A message to the coordinator with PR URL, summary, review outcome, and which developer
   template ended up working.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the log/screenshots,
and message the coordinator. Then signal task_completed.
