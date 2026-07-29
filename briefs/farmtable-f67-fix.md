# Brief: Feature 67 Fix Round — Toolbar Icon Collision in LR Mode

## Critical Constraints (read first)
- Work in the same worktree/branch as PR #154 if still available, or a fresh one off the
  PR branch: `gh pr checkout 154` (creates/updates a local branch tracking the PR).
- Small, targeted fix only — do not touch anything else in the PR.
- Push directly to the PR branch so it updates PR #154 (don't open a new PR).

## Context
Independent review of PR #154 (Feature 67, Tree View TB/LR layout toggle) returned
APPROVE WITH NITS. Two of the three nits are being accepted as-is (design consistency
with the Solo pattern; icon-only button is an accepted toolbar convention elsewhere).
One nit requires a fix before merge:

**Nit 1 (`ft-toolbar.ts` lines ~349-351 and ~356):** When `layoutOrientation === 'LR'`,
the Tree View icon becomes `diagram-3` rotated 90deg — but the Dependencies View icon is
ALREADY permanently `diagram-3` rotated 90deg. In LR mode, these two icons in the view
switcher become visually identical (differentiated only by which one is
selected/highlighted), which is a real usability problem, not just a cosmetic quibble —
a user glancing at the switcher can't tell Tree and Dependencies apart.

Full review report: `/scion-volumes/scratchpad/projects/farmtable/reports/review-pr154.md`
Evidence showing the collision: screenshots 03 vs 04 in
`/scion-volumes/scratchpad/projects/farmtable/reports/f67-orientation-evidence/`

## Task
1. Fix the icon collision. Use your judgment on the cleanest approach — options include:
   - Use a distinct icon for the Tree view in LR mode (e.g. a different Shoelace icon
     entirely, rather than relying on rotation to differentiate).
   - Keep the Tree view icon un-rotated regardless of orientation (rotation state is
     already reflected by the dedicated toggle button next to Solo — the view-switcher
     icon rotating was a "nice to have" per ptone's original request, but not at the cost
     of two icons becoming indistinguishable).
   - Any other approach that results in the Tree and Dependencies icons being visually
     distinguishable in ALL orientation states.
   Pick whichever is simplest and cleanest given the actual Shoelace icon set already in
   use in this file.
2. Verify visually: capture updated screenshots of the view switcher in both TB and LR
   modes showing the Tree and Dependencies icons are now clearly distinct.
3. Confirm `npx tsc --noEmit` still passes.

## Deliverables
1. Commit pushed to the PR #154 branch.
2. Updated screenshot(s) showing the fix, saved to
   `/scion-volumes/scratchpad/projects/farmtable/reports/f67-orientation-evidence/`
   (new filenames, don't overwrite existing ones).
3. A message to the coordinator confirming the fix and referencing the new screenshot(s).

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` on completion or if blocked.
- Do not contact ptone@google.com.

## Termination
You MUST fix the icon collision, verify visually with real (not reused) screenshots,
push to the PR branch, and message the coordinator confirming completion. Then signal
task_completed.
