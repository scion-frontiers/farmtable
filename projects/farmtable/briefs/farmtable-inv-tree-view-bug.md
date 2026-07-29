# Brief: Investigator — Tree View Infinite Vertical-Space Bug

## Critical constraints (read first)
- Read-only investigation. Do NOT modify code, do NOT commit, do NOT open a PR unless you
  find a trivial, obviously-safe one-line fix — if so, STOP and report it to the
  coordinator with the fix proposal rather than shipping it yourself (this bug report needs
  a decision on urgency/scope first).
- Do not disturb `/workspace/farmtable`'s shared checkout state if other agents are active
  there — reading files is fine.

## Context
ptone@google.com reported: "something off about the tree view - which seems to keep adding
something contributing vertical-space occupying content infinitely."

Example URL demonstrating it (live Cloud Run service):
`https://farmtable-qo7k5fvpda-uc.a.run.app/?collection=5d1e4eea-3dc7-4958-99ac-01e3372c5a0d&view=tree`

That collection ("External Store Passthrough") has a 3-level task hierarchy (3 phase-parent
tasks, each with several child leaf tasks — created by a recent design-decomposition
exercise, see `/scion-volumes/scratchpad/projects/farmtable/reports/design-passthrough-task-breakdown.md`
for the structure) — this may be relevant since it's more deeply nested than most
collections in this project, and the bug may only manifest with real hierarchical data.

Relevant recent features that touch this code path: Feature 22 added `?view=kanban|tree`
URL routing (`/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-22-view-mode-urls.md`,
PR #69). The Tree view itself predates this project's UI loop (it's an existing dashboard
view alongside Kanban) — find its actual component in `web/src/`.

## Task
1. Reproduce the bug live: open the URL above with Playwright, observe what happens over
   time (don't just take one screenshot — watch it for at least 10-15 seconds, or longer if
   the growth is slow, taking multiple screenshots/DOM snapshots to show the progression).
   Confirm concretely: what is growing? (Extra blank rows? Repeated elements? Whitespace/
   margin/padding accumulating? An infinitely-resizing container?)
2. Use browser dev tools via Playwright (`page.evaluate` for DOM inspection is fine here
   since you're diagnosing, not faking evidence — this differs from the "no page.evaluate
   screenshots" rule which is about NOT using it to fake UI interaction for feature
   verification; using it to inspect DOM state for bug diagnosis is appropriate) to find
   exactly what element(s) are being added/growing repeatedly, and how fast (e.g. DOM node
   count over time, height of the tree container over time).
3. Once you've confirmed the symptom, find the tree view component/code in
   `/workspace/farmtable/web/src/` responsible for rendering it, and identify the actual
   bug: common suspects for this kind of symptom include: a render loop re-appending
   children instead of replacing them, a recursive component rendering itself an extra
   level each cycle, a `ResizeObserver`/`MutationObserver` loop, an animation/transition
   re-triggering itself, or a WatchTasks stream update handler that appends instead of
   diffs/replaces.
4. Check whether this reproduces with OTHER collections too (e.g. the `default` collection
   in tree view) or is specific to deeply-nested hierarchies like the one in the example
   URL — this narrows down whether it's a general tree-view bug or a hierarchy-depth edge
   case.
5. Determine root cause with actual code evidence (file:line), not just symptom
   description.

## Deliverables
Write findings to:
`/scion-volumes/scratchpad/projects/farmtable/reports/tree-view-bug-investigation.md`

Must contain: reproduction steps, screenshots/evidence showing the growth over time, exact
root cause with file:line citation, whether it's general or hierarchy-depth-specific, and a
recommended fix approach (you don't need to implement it — describe it clearly enough for a
developer agent to execute).

## Direct contact
- Message the coordinator (`scion message coordinator "..."`) when done, or immediately if
  you find something urgent/safety-relevant (e.g. this could be causing real memory/perf
  issues on the live service for real users).
- Do not message ptone@google.com directly.

## Termination
You MUST produce the report at the path above and then mark the task complete.
