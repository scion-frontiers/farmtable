# Brief: Investigate — Periodic UI Flicker/Redraw During 15s Passthrough Sync

## Critical Constraints (read first)
- Use a dedicated git worktree: `git worktree add /workspace/farmtable-inv-sync-flicker -b
  explore/sync-flicker origin/main` (standing policy — farmtable-em-f54's worktree may
  still be present, this avoids collision).
- **Investigation only — do not fix anything yet.** Produce findings; the coordinator will
  decide on a fix dispatch based on scope.
- Use the local-first verification protocol
  (`/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`) to reproduce —
  you'll need a writable GitHub-backed test collection (see Phase 1's test setup,
  `scion-frontiers/scion-roadmap`, in
  `/scion-volumes/scratchpad/projects/farmtable/passthrough-write-implementation-log.md`)
  since the poll only runs for writable external collections.

## Context (ptone@google.com, verbatim)

"I think we have a periodic UI Flickr and redraw that might be happening during the 15
second sync. you shouldn't need this because it should only be in place for pass-through
storage platform options like GitHub and furthermore it should do a data sync and then emit
something like per object change events and not doing a refresh of the entire spa app
shell."

This is about the 15-second poll interval introduced in Passthrough Write-Through Phase 1
(PR #116) for writable GitHub-backed collections — see
`/scion-volumes/scratchpad/projects/farmtable/passthrough-write-implementation-log.md` for
the original design ("merge-based PollManager refresh" was explicitly built to avoid a
full-board flash, per that log — so if a flicker/redraw is happening, either that
merge-based approach has a bug, or something else entirely is causing periodic redraws).

## Task

1. **Reproduce**: open a writable GitHub-backed test collection locally, watch the UI for
   ~30-45 seconds (long enough to observe at least 2 poll cycles), and determine if there's
   a genuine visible flicker/redraw. Use Playwright to capture a screenshot sequence across
   a poll cycle boundary, or check the DOM/component re-render behavior directly (e.g. via
   browser devtools performance/rendering instrumentation if accessible, or by
   instrumenting `console.log` in relevant lifecycle methods).
2. **Confirm scope**: does this ONLY happen for writable external (GitHub) collections, or
   does it also affect native Farmtable collections (which shouldn't be polling at all)?
   Check where the 15s poll timer is set up (`PollManager` or similar, from Phase 1 — check
   `web/src/`) and confirm it's correctly gated to only writable external collections.
3. **Find the root cause of any actual redraw**: trace what happens on each poll tick —
   does it call a full re-render of the SPA app shell (e.g. re-fetching and replacing the
   whole task list, causing Lit/whatever framework to do a big diff/re-render), or does it
   correctly do a targeted merge and only touch changed objects? Check the "merge-based
   PollManager refresh" mentioned in the Phase 1 log to see if it's actually working as
   designed or if there's a gap (e.g. merging correctly. but something else — a WatchTasks
   resubscription, a full collection re-fetch on an unrelated timer, a CSS
   transition/animation retriggering — is causing the visible flicker).
4. Per the user's suggested direction: could per-object change events (rather than a full
   sync-and-diff cycle) be a cleaner architecture here? Note this as a recommendation if the
   investigation supports it, but the immediate goal is root-causing the CURRENT flicker,
   not redesigning the sync mechanism (that would be a separate, larger follow-up if
   warranted).

## Deliverables

1. A findings report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/sync-flicker-investigation.md`:
   whether a real flicker was reproduced, exact root cause (with file/line references),
   confirmation of whether it's scoped correctly to external collections only, and a fix
   recommendation with rough scope estimate.
2. A message to the coordinator with the root cause summary and recommendation.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` with findings.
- Do not message ptone@google.com directly.

## Termination
You MUST reproduce (or rule out) the issue, find the root cause, produce the report, and
message the coordinator. Then signal task_completed.
