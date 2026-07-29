# Brief: Engineering Manager — URGENT Fix: Kanban Drag-and-Drop Dead Zones (Feature 42)

## Critical Constraints (read first)

- **THIS IS URGENT — production drag-and-drop is broken for real users right now.** Move
  quickly but don't skip verification; a 1-line CSS fix still needs to be proven correct.
- **Use a dedicated git worktree**: `git worktree add /workspace/farmtable-f42 -b
  fix/f42-kanban-dnd-deadzone origin/main` (standing policy).
- **Use the local-first verification protocol** — read
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`. Verify locally
  first for speed, but ALSO verify on the live deployed site is out of scope for you — the
  coordinator will dispatch a deploy agent to do that after merge.
- **The root cause and exact fix are already known** — see below. Your job is to apply it
  correctly, verify with REAL drag semantics (not the mistake the first investigation made
  — see "Verification" section), and get it reviewed/merged fast.
- **Only one agent runs at a time.** Never run a developer and a reviewer simultaneously.
- **You do NOT merge anything.** Push, open a PR via `gh pr create`, message the
  coordinator immediately when it's ready — don't wait, this is urgent.
- **Reviewer must be blind** — fresh `code-reviewer` agent, `--harness claude`. Given the
  urgency and the small, well-understood scope, ONE review round should suffice unless it
  finds something real.
- **The coordinator will NOT independently re-read your diff or re-open your
  screenshots** — your own verification is what stands.

## Root Cause (from investigation, already confirmed)

PR #111 (commit `8dfd5b8`, Feature 39's single-scroll-region fix) removed `flex: 1` from
the `.cards` CSS rule in `web/src/components/kanban/ft-kanban-column.ts` (around line 103).
This shrunk the drop-target div from filling the entire column's height down to only
covering its actual card content. Since Kanban columns stretch to match the tallest
column's height, this creates large dead zones — up to 95% of a mostly-empty column's
visible area — where a real user's drop lands outside the actual (now-tiny) `.cards` drop
target and silently fails. Verified live via Playwright CSS injection: adding `flex: 1`
back to `.cards` fixes it.

Full investigation report:
`/scion-volumes/scratchpad/projects/farmtable/reports/dnd-broken-investigation.md`

**IMPORTANT — do not just blindly re-add `flex: 1` without checking for a regression to
Feature 39.** Feature 39 intentionally removed some CSS from this file to eliminate
per-column scrollbars (the previous, wrong behavior). Check the diff of PR #111
(`gh pr diff 111`) to understand exactly what was removed and why, and confirm that adding
`flex: 1` back to `.cards` does NOT reintroduce per-column scrolling (i.e. `.cards` filling
height via `flex: 1` should be fine as long as it doesn't ALSO get `overflow: auto` back —
the drop-target-height fix and the scroll-region fix are two different properties and
should not conflict, but verify this explicitly, it's the most important regression risk
here).

## Feature Spec

1. Add back whatever CSS makes `.cards` fill its column's full height as a drop target
   (likely `flex: 1`, per the investigation) in `ft-kanban-column.ts`, WITHOUT reintroducing
   per-column `overflow: auto`/scrolling (Feature 39's fix must remain intact).
2. Verify drag-and-drop works correctly across the FULL visible area of a column,
   including mostly-empty columns where the dead zone was largest — not just a precise hit
   on card content (that's exactly what let the bug slip through review the first time).

## Verification (do this correctly — a prior investigation got a false negative here)

- Use Playwright's proper HTML5 drag-and-drop simulation (`page.dragAndDrop()` /
  `locator.dragTo()`, or manually dispatch `dragstart`/`dragover`/`drop` events) — NOT bare
  `mouse.move()` sequences, which can succeed even when the underlying drop-target sizing
  is broken (this is exactly how the original bug was missed).
- Test drops at multiple points across a column's visible height, INCLUDING near the
  bottom of a short/empty column (previously dead zone) — not just the center of existing
  cards.
- Confirm Feature 39's main-content single-scroll-region behavior still works (scroll
  `main`, confirm no per-column scrollbars reappear) — this is the specific regression risk
  called out above.
- Confirm Feature 38's fixed toolbar and Feature 40's independent Inspector scroll are
  unaffected (quick spot-check, not a full re-verification).
- Real screenshots/evidence for: (a) successful drop in what was previously dead zone, (b)
  main scroll still single-region, no per-column scrollbars.

## Key Locations

- Repo: base off current `main` (rev farmtable-00018-jmx, through Feature 41) — fresh
  feature branch, PR to merge.
- Frontend: `web/src/components/kanban/ft-kanban-column.ts` (the fix), `ft-kanban-view.ts`
  (Feature 39's related changes, for context/regression-checking).
- Investigation report:
  `/scion-volumes/scratchpad/projects/farmtable/reports/dnd-broken-investigation.md`
- Local testing protocol:
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-42-kanban-dnd-fix.md`

## Deliverables

1. Pushed branch + open PR against `main`, confirmed CLEAN/MERGEABLE.
2. Evidence per "Verification" above, saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-42-kanban-dnd-fix/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-42-kanban-dnd-fix.md`.
4. A message to the coordinator with PR URL, summary, review outcome — message immediately
   when ready given the urgency, don't batch with other work.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the log/evidence, and
message the coordinator immediately. Then signal task_completed.
