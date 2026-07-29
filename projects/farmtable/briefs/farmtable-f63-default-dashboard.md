# Brief: Feature 63 — Default to Dashboard View + Reorder View Switcher

## Critical Constraints (read first)
- Use a dedicated git worktree: `git worktree add /workspace/farmtable-f63-default-dashboard
  -b feature/f63-default-dashboard origin/main` (standing policy).
- Local-build-first Playwright verification protocol applies.
- **Real, SAVED evidence required** — screenshots + a written log saved to
  `/scion-volumes/scratchpad/projects/farmtable/reports/f63-default-dashboard-evidence/`.
  This project has a strict evidence bar (the "Simulation Trap") — claims of test coverage
  without saved, checkable artifacts are not accepted. Save actual PNG screenshots and a
  structured log/JSON of what was checked, not just a prose summary in your final message.
- **Heads up**: PR #145 (Feature 62, task deep-linking) just merged to `main` and also
  touched `web/src/components/ft-app.ts`. Rebase onto latest `main` before starting so you
  don't miss it, and be prepared for a possible trivial merge conflict if your changes land
  near the same lines — should be easy to resolve since the concerns are different (task
  deep-linking vs. default-view/view-switcher-order).

## Context
ptone@google.com requested (2026-07-23): "when first navigating to a collection, it should
default to the dashboard view - which should use the 'grid' icon and also be the left most
in the view selector, to the left of kanban."

Existing relevant features:
- Feature 29: Icon-based view mode switcher (the UI control that lets users pick
  Kanban/Tree/Dependency/Ready-Queue/Dashboard view — find this component, likely near
  `ft-app.ts` or a dedicated view-switcher component).
- Feature 32: Dashboard/summary view, minimal (the Dashboard view itself already exists).

## Task
1. Find the current default-view logic (what view loads when you first navigate to a
   collection with no `?view=` param in the URL — check how Feature 22's URL routing
   handles a missing/absent view param) and the view-mode switcher's icon/ordering config.
2. **Change the default**: when a collection is loaded with no explicit view specified in
   the URL, default to Dashboard (not whatever it currently defaults to — investigate and
   note what that was, for your report).
3. **Reorder the view switcher**: Dashboard should be the leftmost/first option, before
   Kanban. Check the current order and adjust.
4. **Icon**: Dashboard's icon in the switcher should be a "grid" icon (a 2x2 or NxN grid
   glyph) — check what icon set/library this project already uses for the other view icons
   (consistency matters) and pick the closest grid-style icon from that same set/library
   rather than introducing a new icon dependency, unless there's no reasonable option.
5. Confirm this doesn't break explicit `?view=` URLs (Feature 22/62) — e.g. a URL with
   `?view=kanban` should still load Kanban directly, this only changes the DEFAULT when no
   view is specified.

## Deliverables
1. PR against `main`.
2. Real, saved evidence: screenshot of the reordered/re-iconed view switcher, and
   screenshot(s) showing that navigating to a collection URL with no `?view=` param lands
   on Dashboard. Also confirm an explicit `?view=kanban` (or another view) URL still works
   correctly (not overridden by the new default).
3. A brief report noting what the previous default view was, and confirming the icon
   choice matches the existing icon set.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for review requests, questions, or
  completion.
- Do not message ptone@google.com directly.

## Termination
You MUST implement the default-view change and switcher reorder/re-icon, verify with real
saved evidence, open a PR, and message the coordinator with the PR link and evidence
directory path. Then signal task_completed.
