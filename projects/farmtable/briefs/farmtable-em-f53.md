# Brief: Engineering Manager — Feature 53: Remove Redundant "Relations" Section from Inspector General Tab

## Critical Constraints (read first)

- **Use a dedicated git worktree**, not the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-f53 -b fix/f53-remove-general-tab-relations
  origin/main` (standing policy).
- **Use the local-first verification protocol** — read
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`.
- **Only one agent runs at a time.** Never run a developer and a reviewer simultaneously.
- **You do NOT merge anything.** Push, open a PR via `gh pr create`, message the
  coordinator.
- **Reviewers must be blind** — fresh `code-reviewer` agent, `--harness claude`.
- **Exit criteria:** Round 1 fix everything (incl. nitpicks). Round 2+: stop if only
  nitpicks remain. Hard cap 5 rounds.
- **Developer harness:** `--type developer` should work; fall back to `--type default` if
  you hit the workspace-trust/"Not logged in" bug.
- **Real before/after screenshots required** on a task that has relationships set up (so
  the "Relations" section on General would actually have content to show before removal).
- **The coordinator will NOT independently re-read your diff or re-open your
  screenshots** — your own verification is what stands.

## Feature Spec (ptone@google.com, verbatim)

"there should be no 'relations' section on the general tab of the inspector when we have an
entire tab for that"

## Context

The Inspector has a dedicated "Relationships" tab (Feature 25, PR #71, since extended by
Features 46/48/49 with add/delete/drag-and-drop and reciprocal sync). A prior investigation
(`/scion-volumes/scratchpad/projects/farmtable/reports/f46-missing-investigation.md`) noted
in passing that the General tab ALSO has an older "Relations" section (read-only, likely
predating the dedicated tab) — this is redundant now that the Relationships tab is fully
featured, and is a likely source of user confusion (a user reported not seeing Feature 46's
new UI, and it turned out they may have been looking at this old General-tab section
instead of the Relationships tab).

## Task

1. Find the "Relations" section in the Inspector's General tab (likely in the same
   Inspector component file(s) touched by Features 25/46/49 — check `web/src/`).
2. Remove it entirely from the General tab. Confirm the dedicated Relationships tab is
   unaffected and remains the sole place relationships are shown/managed.
3. Check for any now-unused code (helper functions, styles) that only existed to support
   the General-tab section, and clean those up too if trivially safe to do so.

## Key Locations

- Repo: base off current `main` — fresh feature branch, PR to merge.
- Frontend: `web/src/` — the Inspector component's General tab and Relationships tab.
- Prior investigation for context:
  `/scion-volumes/scratchpad/projects/farmtable/reports/f46-missing-investigation.md`
- Local testing protocol:
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-53-remove-general-tab-relations.md`

## Deliverables

1. Pushed branch + open PR against `main`, confirmed CLEAN/MERGEABLE.
2. Real before/after screenshots on a task with relationships, showing the General tab no
   longer has a Relations section while the Relationships tab still works fully. Saved
   under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-53-remove-general-tab-relations/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-53-remove-general-tab-relations.md`.
4. A message to the coordinator with PR URL, summary, review outcome.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the log/screenshots,
and message the coordinator. Then signal task_completed.
