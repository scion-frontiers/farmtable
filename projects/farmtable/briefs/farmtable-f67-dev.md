# Brief: Feature 67 — Tree View Layout Orientation Toggle (Top-Down / Left-Right)

## Critical Constraints (read first)
- Work in a dedicated git worktree (standing policy):
  `git worktree add /workspace/farmtable-f67-dev -b feature-67-tree-orientation origin/main`
- Scope is the **parent-child Tree View ONLY** (`ft-tree-view.ts` / `ft-hierarchy-nav.ts`).
  Do NOT touch the Dependency View — it already has its own dedicated left-to-right
  layered layout from Feature 44 and is unrelated to this request.
- Follow the existing `isolateMode`/`solo` URL-state pattern in `ft-app.ts` exactly (state
  declaration, `applyRoute()` parsing, a `syncXToUrl()` method using `replaceState`) —
  don't invent a new state-persistence mechanism.
- This repo has no test convention in `web/` — don't add a test framework, but do your own
  manual verification with real screenshots (before/after, both orientations).

## User Request (verbatim, from ptone@google.com)
"Let switch the layout of the parent child tree to be left to right instead of top to
bottom - task nodes are inherently wide, not tall. The view selector icon should also be
rotated. To preserve the top to bottom as an option, there could be a little rotate button
next to the solo button. It should show a clockwise rotate when in left->right mode, and a
CCW rotation when in top->bottom mode, basically allowing a toggle between the two
layouts."

## Key Locations (from codebase scouting — verify before use, code may have shifted)
1. **Dagre rankdir**: `web/src/components/tree/ft-tree-view.ts` ~line 405:
   `g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 60 });` — currently hardcoded.
2. **View switcher icon**: `web/src/components/ft-toolbar.ts` ~lines 343-347 — Tree view's
   `<sl-radio-button>` renders a static `<sl-icon name="diagram-3">`. The Dependencies
   view icon right after it already uses `style="transform: rotate(90deg)"` for visual
   distinction — a useful reference for how to apply a rotation transform.
3. **Toolbar for the new rotate button**: `web/src/components/tree/ft-hierarchy-nav.ts`
   ~lines 189-221 — toolbar with level dropdown, depth badge, and the Solo button
   (~212-221). Add the new rotate-toggle button adjacent to Solo here.
4. **State/URL pattern to mirror**: `web/src/components/ft-app.ts` —
   `@state() private isolateMode` (~line 153), URL parsing in `applyRoute()`
   (~lines 796-822 handles `?solo=1`), and `syncSoloToUrl()` (~lines 1023-1031). Event
   flow: child component fires a CustomEvent, `ft-app.ts` has a handler
   (`onIsolateToggle`, ~773-776) that updates state and calls the sync method.

## Task
1. Add a `layoutOrientation: 'TB' | 'LR'` state, defaulting to `'TB'` (preserve current
   behavior for existing users/links).
2. Wire it through to `ft-tree-view.ts`'s `g.setGraph({ rankdir: ... })` call.
3. Add a rotate-toggle button in `ft-hierarchy-nav.ts` next to the Solo button. Per
   ptone's spec: shows a clockwise-rotate icon when currently in LR mode, CCW-rotate icon
   when currently in TB mode (i.e., the icon reflects current state, not the target
   state — use your judgment on exact icon choice from the existing Shoelace icon set
   already in use elsewhere in this file, e.g. check what's available alongside
   `fullscreen-exit`/`funnel`).
4. Persist orientation to a URL query param (e.g. `?layoutdir=LR`) following the
   `syncSoloToUrl()` pattern — omit the param when it's the default (`TB`), consistent
   with how `solo` is only present when true.
5. Make the Tree-view icon in `ft-toolbar.ts`'s view switcher rotate to reflect the
   current orientation (per ptone's request) — needs the orientation state to be
   accessible/passed down to `ft-toolbar.ts` (check how `ft-app.ts` currently passes state
   to the toolbar, e.g. `@property()` bindings, and follow that pattern).
6. Verify visually: check that node positioning, edge routing/arrows, and any
   collapse/expand or FLIP-animation logic (Feature 41, Feature 64) that assumes a
   vertical (TB) flow still works sensibly in LR mode — flag anything that looks broken
   or was clearly written assuming TB-only, but don't over-engineer a fix for edge cases
   ptone didn't ask about (e.g. don't touch Dependency View's FLIP animation).
7. Regression check: Solo mode, minimap (Feature 54), depth-limit badge (Perf Phase 1),
   and default depth-limit behavior all still work in both orientations.

## Deliverables
1. A PR against `main` with the implementation.
2. Screenshots (both orientations, toggle button in both states, rotated view-switcher
   icon) saved to
   `/scion-volumes/scratchpad/projects/farmtable/reports/f67-orientation-evidence/`.
3. A message to the coordinator with the PR link and a summary of what you verified.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for questions or on completion.
- Do not contact ptone@google.com directly.

## Termination
You MUST implement the toggle end-to-end (state, Dagre rankdir wiring, toolbar button,
view-switcher icon rotation, URL persistence), verify it visually with real screenshots in
both orientations, open the PR, and message the coordinator with the PR link. Then signal
task_completed.
