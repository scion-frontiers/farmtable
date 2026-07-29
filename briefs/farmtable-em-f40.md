# Brief: Engineering Manager — Feature 40: Give the Inspector Panel Real Vertical Scroll

## Critical Constraints (read first)

- **Use a dedicated git worktree**, not the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-f40 -b feat/f40-inspector-scroll origin/main`
  (standing policy — avoids branch collisions with other in-flight work).
- **USE THE NEW LOCAL VERIFICATION PROTOCOL for your first round of verification.** Read
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md` and the new "Local
  verification protocol" section in `HANDOFF-METHODOLOGY.md` — the Go server supports
  SQLite natively (`FARMTABLE_DB_DIALECT=sqlite3`), and `ft dashboard` +
  `FARMTABLE_DB_PATH` pointed at the pre-seeded `web-test/farmtable.db` gives a fully
  working local dashboard with real data in ~60s. Verify locally FIRST — it's much faster
  than waiting for a live deploy. A live-server check will happen at deploy time as usual,
  but don't wait for that to catch a wrong fix.
- **This is the FOURTH iteration of the scroll feature.** Read the full history below
  before touching anything.
- **Only one agent runs at a time.** Never run a developer and a reviewer simultaneously.
- **You do NOT merge anything.** Push, open a PR via `gh pr create`, message the
  coordinator.
- **Reviewers must be blind** — fresh `code-reviewer` agent, `--harness claude`.
- **Exit criteria:** Round 1 fix everything (incl. nitpicks). Round 2+: stop if only
  nitpicks remain. Hard cap 5 rounds.
- **Developer harness:** `scion start farmtable-f40-dev --type developer <task>` should
  work; fall back to `--type default` if you hit the workspace-trust/"Not logged in" bug.
- **Real screenshots AND a real scroll-interaction demonstration required** (local first,
  per protocol above). This exact scroll feature has needed 3 prior iterations because
  static/incomplete verification let regressions through — be rigorous.
- **The coordinator will NOT independently re-read your diff or re-open your
  screenshots** — your own verification is what stands. Given the history, be unusually
  careful with yourself.

## History — what's already been tried

1. **Feature 36 (PR #106)**: Added per-Kanban-column scroll (wrong approach, per user).
2. **Feature 38 (PR #109)**: Fixed the app-shell layout bug (`theme.css`'s
   `ft-app { display: block }` overriding `:host { display: flex }`) so the header/Inspector
   stay fixed while `main` scrolls.
3. **Feature 39 (PR #111, commit 8dfd5b8, deployed as rev farmtable-00016-m5w)**: Removed
   Feature 36's per-column scroll CSS from `ft-kanban-view.ts`/`ft-kanban-column.ts` so
   `.main` became the ONE single scroll container for the whole main content area. Verified
   live: main scroll works, toolbar stays fixed, horizontal scroll intact.
4. **What's STILL wrong (ptone@google.com's live feedback, 2026-07-21 23:34, verbatim):**
   "the main content pane now has its own scroll bar and works as desired, but the
   inspector content has no vertical scroll capability."

   So: `main`'s scroll is now correct and should NOT be touched. The remaining gap is
   specifically the Inspector panel — when its content (task details, comments,
   relationships, etc.) is taller than the panel's visible height, it currently has no way
   to scroll at all (not even the old, wrong per-column-style scroll — it appears to have
   NO scroll mechanism), so content likely gets cut off / inaccessible.

## Feature Spec

1. Give the Inspector panel component its own `overflow-y: auto` scroll region with a
   properly bounded height, so when its content overflows vertically, IT scrolls
   independently — without affecting `main`'s scroll position, without affecting the
   toolbar, and without reintroducing document-level/page scroll.
2. Investigate why the Inspector currently has no scroll at all — check its component CSS
   (likely in the Inspector's own `.ts` file — search for the Inspector component under
   `web/src/`) and its position in the app-shell layout (from Feature 38's flex fix in
   `ft-app.ts`/`theme.css`) to see whether it's missing a bounded height, missing
   `overflow-y: auto`, or something about its content structure prevents a scroll container
   from taking effect (e.g. content inside is itself unbounded-height and the scroll
   container is on the wrong ancestor).
3. Test with an Inspector open on a task that has enough content to genuinely overflow
   (long description, many comments, or expand all sections if Feature 33's collapsible
   sections are all expanded) — don't rely on a task with too little content to prove
   anything.
4. Confirm `main`'s scroll (Feature 39) and the app-shell fixed header (Feature 38) are
   unaffected by whatever change you make.

Explicitly OUT of scope: any other layout/visual changes.

## Required Evidence (local-first, per the new protocol)

1. Run the local dashboard per `local-test-protocol.md`. Open a task in the Inspector with
   enough content to overflow the panel's height.
2. Screenshot A: Inspector at its initial scroll position (content visibly cut off at the
   bottom, proving there WAS an overflow problem before your fix — capture this on the
   `main` branch state / before your fix if convenient, or just describe the cutoff).
3. Apply your fix. Screenshot B: Inspector scrolled down (via real wheel/scroll event, not
   `element.scrollTop =`) showing content that was previously cut off is now reachable.
4. Screenshot C: confirm `main`'s independent scroll (Feature 39) still works exactly as
   before — scroll `main`, confirm toolbar and Inspector position unaffected.
5. Screenshot D: confirm scrolling the Inspector does NOT move `main`'s scroll position
   (and vice versa) — both must remain fully independent.
6. Then repeat the key check (at minimum, Inspector scroll working) against the LIVE
   deployed site once this is deployed — that verification will happen as part of the
   redeploy step, not this brief.

## Key Locations

- Repo: base off current `main` (rev farmtable-00016-m5w includes F35-39 + decomposer) —
  fresh feature branch, PR to merge.
- Frontend: `web/src/` — the Inspector panel component, `ft-app.ts` + `theme.css` (Feature
  38's app-shell flex layout), `ft-kanban-view.ts`/`ft-kanban-column.ts` (Feature 39's
  single-scroll-region fix — do not regress this).
- Prior feature logs:
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-38-independent-scroll-refinement.md`,
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-39-single-scroll-region.md`
- New local testing protocol:
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-40-inspector-scroll.md`

## Deliverables

1. Pushed branch + open PR against `main`, confirmed CLEAN/MERGEABLE.
2. The 4 screenshots from "Required Evidence" above, saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-40-inspector-scroll/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-40-inspector-scroll.md`.
4. A message to the coordinator with PR URL, summary, review outcome, and confirmation you
   used the new local-first protocol (and how it went — useful feedback for whether the
   protocol needs further refinement).

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the log/screenshots
per the exact evidence spec above, and message the coordinator. Then signal task_completed.
