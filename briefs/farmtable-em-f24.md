> **FREEZE IN FORCE 2026-07-29 — NO DELETION, PRUNING, TIDYING OR SAFE-TO-DELETE CLASSIFICATION OF ANY TREE, WORKTREE, REGISTRATION OR STORE UNTIL THE COORDINATOR LIFTS IT. THIS FILE CONTAINS INSTRUCTIONS THAT PREDATE THE FREEZE AND MUST NOT BE FOLLOWED.**

# Brief: Engineering Manager — Feature 24: Inspector Date-Field 2x2 Layout

## Critical Constraints (read first)

- **THIS FEATURE RUNS IN PARALLEL WITH FEATURE 25** (inspector tabs +
  Relationships tab), which touches the SAME Inspector component area.
  The coordinator expects a real chance of merge conflict between the two
  — that's an accepted, anticipated risk, not a sign something's wrong.
  Use your own worktree:
  ```
  cd /workspace/farmtable
  git fetch origin
  git worktree add /workspace/farmtable-f24-date-layout -b feat/inspector-date-grid origin/main
  ```
  Do ALL work from `/workspace/farmtable-f24-date-layout`. See
  `/scion-volumes/scratchpad/projects/farmtable/reports/worktree-experiment.md`
  for the validated pattern. Clean up the worktree after merge confirmation.
- **Keep your diff as narrow as possible** — only touch the date-field
  rendering/markup, not the surrounding Inspector structure or content
  ordering. Feature 25 is wrapping the existing Inspector content in tab
  containers concurrently; the less you touch outside the date fields
  themselves, the less likely a real conflict is when one of you rebases
  onto the other's merge.
- **Before opening the PR, rebase onto latest origin/main and confirm `gh
  pr view <n> --json mergeStateStatus,mergeable` shows CLEAN/MERGEABLE.**
  If Feature 25 has already merged by the time you're ready, you WILL
  likely need to resolve a conflict — that's expected. Follow the
  precedent from Feature 19 (rebase onto latest main, resolve conflicts by
  hand, re-verify build, confirm CLEAN/MERGEABLE before reporting ready).
  Do not guess at resolution if a conflict touches Feature 25's tab
  structure — read what Feature 25 actually built (`gh pr diff` on its
  merged PR) before resolving.
- **Only one agent runs at a time within THIS feature's own cycle** (dev
  OR reviewer). Feature 25 running concurrently in its own worktree is
  expected.
- **You do NOT merge anything.** Push, open a PR via `gh pr create`,
  message the coordinator. The coordinator merges (and will sequence the
  two merges deliberately if both come in around the same time, to reduce
  conflict pain — that's the coordinator's call, not yours).
- **Reviewers must be blind** — fresh `code-reviewer` agent per round.
- **Exit criteria:** Round 1 fix everything (incl. nitpicks). Round 2+:
  stop if only nitpicks remain. Hard cap 5 rounds.
- **Agents:** Developer `scion start farmtable-f24-dev --type developer
  <task>` (no `--harness`, default codex). Reviewer `scion start
  farmtable-f24-review-rN --type code-reviewer --harness claude <task>`.
- **The coordinator will NOT independently re-read your diff or re-open
  your screenshots** — your own verification is what stands.

## Feature Spec

In the Inspector panel, currently `start_date`/`due_date` and
`created_at`/`updated_at` are laid out however Feature 4 originally put
them (likely each on its own line/row). Change this to a 2x2 grid for
tighter alignment:

- Row 1: Start Date | Due Date
- Row 2: Created | Updated

- Start Date / Due Date remain editable (per Feature 4's existing inline
  date-editing behavior) — do not remove or regress that editing capability,
  just change the layout/alignment.
- Created / Updated are read-only timestamps (if they're not currently
  shown in the Inspector at all, add them as read-only in this grid —
  check first whether they're already displayed somewhere and just need
  re-laying-out, vs. not shown at all).
- Keep it responsive/sane at the Inspector's typical width — a simple CSS
  grid (`grid-template-columns: 1fr 1fr`) is likely sufficient; don't
  over-engineer this into a new general-purpose table component.
- Preserve existing keyboard-nav/focus-order conventions (Features 9-11) —
  changing visual layout shouldn't scramble tab order.

Explicitly OUT of scope:
- Any other Inspector field's layout.
- The tab restructuring (Feature 25's job).

## Key Locations

- Work in `/workspace/farmtable-f24-date-layout` (your own worktree).
- Frontend: `web/src/components/inspector/` — find the date-rendering
  markup from Feature 4 (`gh pr diff 50` for reference) and any
  subsequent inspector-reliability changes (Feature 8, `gh pr diff 54`).
- Worktree pattern reference:
  `/scion-volumes/scratchpad/projects/farmtable/reports/worktree-experiment.md`
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-24-date-grid-layout.md`

## Deliverables

1. Pushed branch + open PR against `main`, confirmed CLEAN/MERGEABLE
   right before reporting ready.
2. Real, distinct screenshots (md5sum-verified) showing the 2x2 grid with
   all four fields visible and start/due date still editable.
   Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-24-date-grid-layout/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-24-date-grid-layout.md`
   with what was built, review rounds, any conflict/rebase encountered
   with Feature 25, and worktree experience notes.
4. A message to the coordinator with PR URL, summary, review outcome, and
   explicit note on whether a Feature-25 conflict was encountered.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/
  conflict/quota reports.
- Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the
log/screenshots, clean up your worktree post-merge, and message the
coordinator. Then signal task_completed.
