# Brief: Engineering Manager — Feature 28 (URGENT, XS): Fix Tree View Infinite Growth Bug

## Critical Constraints (read first)

- **THIS IS URGENT.** A confirmed bug is causing a live perf issue on the deployed Cloud
  Run service RIGHT NOW for any user viewing the Tree view — an infinite resize/re-render
  feedback loop growing the page ~250px/second and firing ~300 `requestUpdate()` calls per
  5 seconds. Move as fast as correctness allows; don't gold-plate this.
- Root cause is already fully diagnosed — see
  `/scion-volumes/scratchpad/projects/farmtable/reports/tree-view-bug-investigation.md`.
  Do NOT re-investigate from scratch; verify the diagnosis quickly, apply the fix, verify
  it resolves the issue, ship it.
- **Only one agent runs at a time.** Never run a developer and a reviewer simultaneously.
- **You do NOT merge anything.** Push, open a PR via `gh pr create`, message the
  coordinator immediately — the coordinator will prioritize merging this over anything else
  in flight and will redeploy promptly after.
- **Reviewer**: still use a fresh blind `code-reviewer` agent (`--harness claude`) — even
  for a 1-line fix, a second pair of eyes catches "did this actually fix it without side
  effects" fast. But given the tiny, well-diagnosed scope: if round 1 comes back clean
  (APPROVE, no findings or only trivial nitpicks), ship immediately — don't manufacture a
  second round for a fix this size.
- **Agents:** Developer `scion start farmtable-f28-dev --type developer <task>` (no
  `--harness`, default codex). Reviewer `scion start farmtable-f28-review-r1 --type
  code-reviewer --harness claude <task>`.
- **The coordinator will NOT independently re-read your diff or re-open your
  screenshots/measurements** — your own verification is what stands. Be rigorous: actually
  confirm the growth stops (measure page height or DOM node count over ~10s before and
  after the fix, same method the investigator used), don't just assert it.

## Feature Spec

Per the investigation report: `web/src/components/tree/ft-tree-view.ts` has an `<svg>`
element that defaults to `display: inline`, which adds baseline-descender spacing on every
render. A `ResizeObserver` on the canvas container detects this height change, calls
`requestUpdate()`, which re-renders with a taller viewBox, re-triggering the observer —
an infinite feedback loop. Confirmed to affect ALL collections in tree view, not just
deeply-nested ones.

**The fix**: add `display: block` to the SVG's CSS rule (investigator found this at line 65
of `ft-tree-view.ts` — confirm the exact current line number yourself since line numbers
may have shifted since the investigation, don't blindly trust a stale line number).

Verify:
1. The fix actually stops the growth — reproduce the bug first (confirm you see it), apply
   the fix, confirm the growth stops using the same measurement approach as the
   investigation report (page/container height or DOM node count sampled over ~10s).
2. No visual regression — the tree view should still render and look correct (nodes,
   connectors, labels all still visible and positioned sensibly) after the fix, not just
   "stopped growing." A screenshot showing a normal, stable tree view is sufficient (you
   don't need the full screenshot-per-state rigor of a UI feature — this is a bug fix, one
   good "it looks right and it's stable" screenshot is enough).
3. Check whether any other SVG elements in the same component (or sibling tree/graph
   components, if any exist) have the same `display: inline` default gap issue, since this
   is a class of bug that could recur elsewhere — fix here is scoped to `ft-tree-view.ts`
   only, but note anywhere else you spot the same pattern in your feature log for a
   possible follow-up (don't fix unrelated files in this PR).

## Key Locations

- Repo: `/workspace/farmtable`, base off current `main` (includes PR #75) — fresh feature
  branch, PR to merge. Given the urgency and small size, working directly in
  `/workspace/farmtable` (not a separate worktree) is fine — check `scion list`/`git status`
  first to confirm no other agent has it checked out to a different branch at the moment.
- Bug investigation (full diagnosis, don't redo): `/scion-volumes/scratchpad/projects/farmtable/reports/tree-view-bug-investigation.md`
- Component: `web/src/components/tree/ft-tree-view.ts`
- Reproduction URL used by the investigator (works for any collection per the findings,
  but this one is confirmed): `https://farmtable-qo7k5fvpda-uc.a.run.app/?collection=5d1e4eea-3dc7-4958-99ac-01e3372c5a0d&view=tree`

## Deliverables

1. A pushed feature branch + open PR against `scion-frontiers/farmtable` `main`, confirmed
   CLEAN/MERGEABLE.
2. Before/after growth measurement (numbers, not just "it works") proving the fix resolves
   the infinite loop, plus one screenshot of a stable, correctly-rendered tree view
   post-fix. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-28-tree-view-fix/`
3. A short log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-28-tree-view-fix.md`.
4. A message to the coordinator with PR URL, before/after measurements, and review outcome
   — flagged as urgent so it gets merged promptly.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` — mark urgent, this should jump the
  queue ahead of other in-flight work for merge priority.
- Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the measurements and
log at the paths above, and message the coordinator with the summary. Then signal
task_completed. Do not delete your developer agent until the coordinator confirms the merge
landed.
