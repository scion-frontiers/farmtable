# Brief: Feature 62 — Routable/Shareable URLs to a Specific Task

## Critical Constraints (read first)
- Use a dedicated git worktree: `git worktree add /workspace/farmtable-f62-task-urls -b
  feature/f62-task-deep-links origin/main` (standing policy).
- Local-build-first Playwright verification protocol applies.
- **Investigate existing URL routing FIRST before designing anything new.** This project
  already has URL-driven routing from earlier features — don't duplicate or conflict with
  it:
  - Feature 18: "URL-driven collection routing" (collection selection reflected in URL)
  - Feature 22: "Reachable URLs for Kanban/Tree views" (view-mode reflected in URL)
  Find the actual router/URL-state code (likely in `web/src/` — check `ft-app.ts` and
  related routing files) and understand the current URL shape (path segments vs query
  params, what's already encoded) before adding to it.
- **Real evidence required**: this project has a strict evidence bar. Test the actual
  round-trip — load a constructed URL fresh (not just click-through navigation) and
  confirm the resulting state (view active, correct task selected/zoomed, inspector open)
  matches what the URL specified. Screenshots of before/after with the URL bar visible,
  plus confirm it works via direct navigation (paste URL / reload), not just SPA
  client-side routing during a session.

## Context
ptone@google.com requested (2026-07-23): "we want issues to have routable URLs in the
view - so I should be able to have a URL that brings me to a zoomed task, in a specific
view - inspector open."

Breaking this down into concrete requirements:
1. A URL should encode: collection, view mode (Tree/Dependency/Kanban/Ready
   Queue/whichever views support this), and a specific task ID.
2. Loading that URL (fresh page load, not just in-session navigation) should result in:
   a. The correct collection loaded.
   b. The correct view mode active.
   c. The specified task selected AND the view zoomed/centered/scrolled to it — reuse the
      existing pan-to-selection animation logic (Feature 41/56/58: `centerOnNode`,
      zoom-to-target-size) for Tree/Dependency views; for Kanban, scroll-to-card is
      probably the equivalent (check Feature 37's "scroll/frame-to-item on navigation"
      work for existing scroll-to-item logic to reuse, don't reinvent it).
   d. The Inspector panel open, showing that task's details.
3. This should be a genuinely shareable/bookmarkable URL — copy it, send it to someone
   else (or reload the page), and it reproduces the exact same state.

## Task
1. Investigate current routing code and URL shape (see Constraints above). Document what
   you find briefly in your final report so future agents don't have to rediscover it.
2. Design the URL extension: decide whether task ID + inspector-open state fit better as
   additional path segments or query params, matching the existing scheme's conventions
   (don't invent a wildly different pattern than what's already there).
3. Implement:
   a. URL → state: parsing the task ID (and inspector-open flag, if you decide that needs
      to be explicit rather than implied by "a task ID is present") on load/navigation,
      driving selection + view centering + Inspector open.
   b. State → URL: when a user manually selects a task and/or opens the Inspector via
      normal UI interaction, the URL should update to reflect it (so the "current state"
      is always shareable, not just a one-way deep-link consumer) — check how Feature 18/22
      already do this for collection/view-mode and follow the same pattern.
4. Make sure this works across the views that support it — at minimum Tree View and
   Dependency View (given the "zoomed task" framing, these are the primary targets); Kanban
   support is a bonus if straightforward, but don't let it block Tree/Dependency View
   working correctly.

## Deliverables
1. PR against `main` implementing task-level deep-linking.
2. Real evidence: construct a URL by hand (or by copying it from the address bar after
   manual navigation), load it FRESH (new tab / hard reload), and screenshot/confirm the
   resulting state matches (correct view, correct task selected+centered, Inspector open
   showing correct task details). Do this for at least Tree View and Dependency View.
3. Confirm the reverse direction works too: manually navigate/select/open-inspector in the
   UI, confirm the URL updates to reflect it.
4. A brief report summarizing the URL scheme you landed on (document it for future
   reference/consistency).

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for review requests, questions, or
  completion.
- Do not message ptone@google.com directly — if the URL scheme design has a genuine
  ambiguity ptone should weigh in on, relay the question through the coordinator rather
  than guessing on something that affects the shareable-link format long-term.

## Termination
You MUST investigate existing routing, implement task-level deep-linking (URL→state and
state→URL) for at least Tree View and Dependency View, verify with real evidence including
a fresh-load round-trip test, open a PR, and message the coordinator with the PR link,
evidence summary, and a description of the URL scheme. Then signal task_completed.
