# Brief: Investigate Recurring Periodic UI Redraw

## Critical Constraints (read first)
- This is a RESEARCH/DIAGNOSIS task — reproduce and diagnose first, don't guess-and-fix.
  If you find the root cause and it's a small, clear fix, you may implement it (this is a
  bug investigation+fix brief, not investigation-only), but understand the actual cause
  before touching code.
- Use a dedicated git worktree: `git worktree add
  /workspace/farmtable-inv-periodic-redraw-v2 origin/main` (standing policy).
- Local-build-first Playwright verification protocol applies, but this may need live
  Cloud Run verification too since polling behavior/timing could differ.
- Real, saved evidence required if you make a fix — save to
  `/scion-volumes/scratchpad/projects/farmtable/reports/periodic-redraw-v2-evidence/`.

## Context
ptone@google.com reported (2026-07-24): "There is still some sort of UI redraw happening
at some periodic frequency."

This project has hit this exact class of bug twice before and fixed it:
- Feature 55: poll-sync flicker (refresh spinner + redundant `tasks-changed` events) — fix
  was a `TaskStore.upsert()` equality check to skip redundant events when poll data is
  identical to existing state.
- Feature 60: dependency-view redraw/re-zoom on poll ticks — a different manifestation in
  the Dependency View specifically.

Given the timing, this report came in during a busy day of changes that could plausibly
have reintroduced or newly introduced a related issue:
- Feature 65 (Dashboard ready count, PR #148, deployed as deploy-44): new Dashboard stat
  card computed from `this.store.allTasks` — worth checking if it interacts with the poll
  cycle in a way that causes a redraw.
- Feature 66 (Solo state sticky, PR #150, NOT YET merged/deployed): lifted `isolateMode`
  state from per-view-component to `ft-app.ts` — a significant reactive-state change that
  could plausibly cause extra re-renders if not implemented carefully.
- Performance Phase 1 (PR #149, NOT YET merged/deployed): rebuilds a `Map<parentId,
  Task[]>` cache "incrementally on upsert/delete/clear" — if this cache rebuild triggers
  unnecessary reactivity/re-renders on every poll tick (even when data is unchanged), that
  would be a new instance of the exact bug class Feature 55 fixed.

**Important**: Features 66 and Perf Phase 1 are NOT yet deployed (still in
review/merge-conflict-resolution) — so if ptone is observing this against the LIVE
instance, it must be caused by something already deployed (up through deploy-44 / Feature
65), not those two. If ptone is testing a local/preview build with those changes, factor
that in. Confirm which environment they're likely observing this in if you can (default to
assuming live, since that's their normal usage).

## Task
1. Reproduce: open the live instance (or local build matching the live deployed commit)
   in each of the main views (Kanban, Tree, Dependency, Dashboard, Ready Queue) and watch
   for a redraw/flicker over at least 2-3 poll cycles (30-45+ seconds, poll interval is
   15s). Use DevTools/Playwright to capture whether re-render is happening (e.g. via a
   MutationObserver counting DOM churn, or checking for visible flicker/redraw of
   elements that shouldn't change when data hasn't changed).
2. Identify the specific view(s) and specific trigger. Check:
   - Is `TaskStore.upsert()`'s equality check (Feature 55 fix) still working correctly, or
     has something changed that causes it to always see "different" data even when
     nothing changed (e.g. a new field with a changing timestamp/nondeterministic value
     that breaks equality)?
   - Is the NEW Dashboard Ready count (Feature 65, deployed) triggering any redraw beyond
     its own stat card (e.g. via a shared reactive controller that over-notifies)?
   - Any other recently-deployed change (Features 62/63/64) that touches poll-driven
     reactive state?
3. If you find a clear, well-scoped root cause, fix it. If the cause is ambiguous or
   would require a larger investigation, stop and report your findings clearly rather than
   guessing at a fix.

## Deliverables
1. If fixed: PR against `main`, with real before/after evidence (e.g. DOM mutation counts
   or screenshots across a poll cycle showing the redraw is gone) saved to the evidence
   directory above.
2. If not fixed (investigation only): a clear report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/periodic-redraw-v2-investigation.md`
   describing what you found, which view(s) are affected, and what you'd recommend as a
   next step.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for questions or completion.
- Do not message ptone@google.com directly.

## Termination
You MUST reproduce and diagnose the periodic redraw issue. If you find and fix a clear
root cause, verify with real evidence and open a PR. If the cause requires further
investigation, produce a clear findings report instead of guessing. Then message the
coordinator and signal task_completed.
