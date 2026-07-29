# Brief: Independent Review of PR #154 (Feature 67 — Tree View Layout Orientation Toggle)

## Critical Constraints (read first)
- Review only — do not modify code or push commits.
- Work in a throwaway worktree if needed:
  `git worktree add /workspace/farmtable-f67-review -b f67-review-snapshot origin/main`
  then `git fetch origin pull/154/head:pr-154 && git checkout pr-154` (or use `gh pr checkout 154`).
- The dev's initial evidence submission had a real defect (Solo-mode screenshots were
  byte-identical to full-tree screenshots because Solo requires BOTH `?solo=1` AND
  `?task=<id>` to activate, and the first attempt omitted the task param). This was
  caught and corrected — the corrected screenshots are in the evidence dir below and
  visually confirmed by the coordinator. Don't re-litigate that specific issue, but stay
  generally skeptical of any other claims in the PR description.

## Context
PR #154, "feat(tree): add TB/LR layout orientation toggle" — ptone requested the
parent-child Tree View support left-to-right layout (in addition to existing top-to-bottom)
since task nodes are wide, not tall. Adds a rotate-toggle button next to the Solo button
(CCW icon in TB mode, CW icon in LR mode), persists orientation to `?layoutdir=LR` URL
param (omitted for default TB), and rotates the Tree-view icon in the view switcher to
match. Files: `ft-app.ts` (+38/-1), `ft-toolbar.ts` (+7/-1), `ft-hierarchy-nav.ts` (+24/-0),
`ft-tree-view.ts` (+19/-2). Does NOT touch Dependency View (out of scope, has its own
layout already).

Evidence: `/scion-volumes/scratchpad/projects/farmtable/reports/f67-orientation-evidence/`

## Task
1. Read the full diff (`gh pr diff 154`).
2. Verify correctness of the state/URL persistence pattern against the existing
   `isolateMode`/`solo` pattern in `ft-app.ts` it's supposed to mirror — check for
   subtle bugs (e.g., does `layoutdir=LR` survive a page reload? Does it interact
   correctly with existing `?task=`/`?view=`/`?solo=` params — any param-ordering or
   default-omission edge cases?).
3. Check the Dagre `rankdir` wiring in `ft-tree-view.ts` — confirm the orientation state
   actually flows through to the `g.setGraph({ rankdir })` call correctly, and that
   switching orientation triggers a real re-layout (not a stale cached layout).
4. Check for regressions in code paths that might assume a TB-only flow: FLIP-animation
   logic (Feature 41's centering animation), collapse/expand, minimap (Feature 54),
   depth-limit badge (Perf Phase 1) — read the code, don't just trust the dev's
   self-report that these "still work."
5. Confirm build/typecheck: `npx tsc --noEmit` (or the project's standard check command).
6. Render a verdict: APPROVE, APPROVE WITH NITS, or REQUEST CHANGES, with specific line
   references for any issue.

## Deliverables
1. A review report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/review-pr154.md` with verdict
   and reasoning.
2. A message to the coordinator with the verdict and summary.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` with your verdict.
- Do not contact ptone@google.com.

## Termination
You MUST read the diff and relevant surrounding code, form a genuine independent verdict,
write the review report, and message the coordinator with the verdict. Then signal
task_completed.
