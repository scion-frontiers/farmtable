# Brief: Engineering Manager — Feature 47: Fix Ready Queue Table Title Alignment

## Critical Constraints (read first)

- **Use a dedicated git worktree**, not the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-f47 -b fix/f47-ready-queue-alignment origin/main`
  (standing policy).
- **Use the local-first verification protocol** — read
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`.
- **Reference screenshot from ptone@google.com** (the coordinator has NOT looked at this
  image per the user's explicit instruction — you should look at it, that's your job):
  `/workspace/downloads/discord_1784726307_Screenshot_2026-07-22_at_6.12.38_AM.png`
- **Only one agent runs at a time.** Never run a developer and a reviewer simultaneously.
- **You do NOT merge anything.** Push, open a PR via `gh pr create`, message the
  coordinator.
- **Reviewers must be blind** — fresh `code-reviewer` agent, `--harness claude`.
- **Exit criteria:** Round 1 fix everything (incl. nitpicks). Round 2+: stop if only
  nitpicks remain. Hard cap 5 rounds.
- **Developer harness:** `--type developer` should work; fall back to `--type default` if
  you hit the workspace-trust/"Not logged in" bug.
- **Real before/after screenshots required** on data that actually reproduces the issue
  (tasks with badges of varying width/content in the Ready Queue) — this is a visual
  alignment bug, so the evidence must clearly show columns/titles aligned after the fix
  regardless of badge width.
- **The coordinator will NOT independently re-read your diff or re-open your
  screenshots** — your own verification is what stands.

## Feature Spec (ptone@google.com, verbatim)

"Small alignment issue on the ready-queue table, variable badge width causes title not to
be aligned - see attached screenshot"

Look at the reference screenshot above to see exactly what's misaligned. This is the Ready
Queue view (Feature 34, PR #83) — find its table/list component in `web/src/` (likely
`ft-ready-queue-view.ts`). The issue: some kind of badge (status/priority/phase badge?
check the screenshot) has variable width depending on its content, and because it's
probably in the same flex/grid cell or inline before the title without a fixed-width
container, the title column shifts left/right depending on badge width instead of staying
in a consistent aligned column.

Fix: give the badge a fixed-width (or min-width) container/column so the title always
starts at the same horizontal position regardless of badge content length — this is
typically a CSS Grid with fixed column widths, or a fixed-width flex item for the badge
slot, rather than badges and titles just flowing inline together.

## Key Locations

- Repo: base off current `main` — fresh feature branch, PR to merge.
- Frontend: `web/src/` — the Ready Queue view component (Feature 34, PR #83).
- Reference screenshot:
  `/workspace/downloads/discord_1784726307_Screenshot_2026-07-22_at_6.12.38_AM.png`
- Local testing protocol:
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-47-ready-queue-alignment.md`

## Deliverables

1. Pushed branch + open PR against `main`, confirmed CLEAN/MERGEABLE.
2. Real before/after screenshots on data with varying badge widths, showing titles
   consistently aligned after the fix. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-47-ready-queue-alignment/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-47-ready-queue-alignment.md`.
4. A message to the coordinator with PR URL, summary, review outcome.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the log/screenshots,
and message the coordinator. Then signal task_completed.
