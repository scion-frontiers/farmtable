# Brief: Engineering Manager — Feature 11: Keyboard Shortcut Overlay

## Critical Constraints (read first)

- **Only one agent runs at a time.** Never run a developer and a reviewer
  simultaneously.
- **You do NOT merge anything.** When ready, push the branch, open a PR with
  `gh pr create`, then message the coordinator with the PR URL and summary.
  The coordinator runs `gh pr merge --squash` itself.
- **Reviewers must be blind.** Each review round is a brand-new
  `code-reviewer` agent (`--harness claude`) with zero knowledge of prior
  review feedback — give it only the current repo/diff state.
- **Exit criteria for the review loop:**
  - Round 1: have the developer fix ALL findings (including nitpicks).
  - Round 2 onward: if the fresh review returns ONLY nitpick/minor findings
    (nothing significant/blocking), STOP — ship as-is. Otherwise fix and
    run another fresh review round.
  - Hard cap: 5 review rounds total. If round 5 still has significant
    findings, stop anyway and report the unresolved findings honestly.
- **Agent types/harnesses:**
  - Developer: `scion start farmtable-f11-dev --type developer <task>` — NO
    `--harness` flag (project default is codex).
  - Reviewer: `scion start farmtable-f11-review-rN --type code-reviewer
    --harness claude <task>` (r1, r2, r3...).
- **Keep the developer agent alive** across all fix iterations. Only delete
  it after the coordinator confirms the merge landed.
- **Quota watch:** if the developer or a reviewer stalls or errors in a way
  that looks like quota/rate-limit/"limits exceeded", do NOT keep retrying.
  Use `scion look <agent>` to check its screen and message the coordinator
  immediately with what you observed. Do not spawn a replacement.
- **Verify, don't assume.** Check the developer's actual git diff/commits
  and actual screenshots (real content, not stubs) before reporting done.
- **Watch for silent stalls.** If you nudge a child agent and it doesn't
  respond with visible progress, check its actual output/files directly
  before assuming it's stuck — it may have finished without signaling.
- **Screenshot integrity:** every screenshot you report as evidence must be
  genuinely distinct and actually capture the state it claims. Run `md5sum`
  on your own screenshots before reporting to the coordinator.

## Feature Spec

Suggested by the developer who built Feature 10 (Kanban card keyboard nav,
merged as PR #56, commit a2fcd2a): the board now supports real keyboard
navigation (Tab/Arrow keys/Enter on cards, plus Feature 9's inspector
keyboard support), but none of it is discoverable. Add a compact keyboard
shortcut overlay/cheat-sheet:

- A control in the toolbar (near existing controls like Kanban/Tree view
  toggle, "+ Add Task") that opens a shortcut reference — e.g. a "?" icon
  button, or bind it to the conventional `?` key as well if reasonable.
- The overlay should list the real, currently-implemented shortcuts only —
  do not document aspirational/unimplemented shortcuts. Pull the actual
  list from what Features 9 and 10 implemented:
  - Kanban board: Tab to focus a card, Enter/Space to open inspector,
    Arrow Up/Down within a column, Arrow Left/Right between columns,
    Home/End navigation
  - Inspector: Escape to close active editor (or the inspector itself if
    no editor is open), Tab order through editable fields
- Dismissible via Escape, click-outside, or an explicit close control —
  reuse the established dismiss patterns from Features 5/8 (consistent,
  race-free) rather than inventing a new one.
- Keep scope to this one feature — a simple modal/panel listing shortcuts.
  Do not add new keyboard shortcuts beyond what's needed to open/close the
  overlay itself.

## Key Locations

- Repo: `/workspace/farmtable`, base off current `main` (includes PRs #47-
  #56) — use a fresh feature branch, PR to merge.
- Toolbar: `web/src/components/kanban/ft-kanban-view.ts` (has the existing
  toolbar with Add Task button, Kanban/Tree toggle)
- Prior keyboard nav implementations to accurately document:
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-9-keyboard-navigation.md`,
  `feature-10-kanban-keyboard-nav.md` (read both for the exact shortcut
  list — don't guess or invent)
- Dismiss pattern precedent: `web/src/components/inspector/ft-inspector-meta.ts`
  (Feature 5's click-outside via composedPath(), Feature 8's consistency
  pass)
- Repo's own agent guide: `/workspace/farmtable/agents.md` — dev/build/test
  conventions, `farmtable-dev` skill for env setup.
- Use the project's web-launch/screenshot tooling to visually verify the
  overlay opens (showing real shortcut list), and dismisses cleanly. Real,
  distinct screenshots required.
- Prior Playwright learnings (Chromium executable path gotcha, reusable
  node_modules):
  `/scion-volumes/scratchpad/projects/farmtable/learnings/playwright-cloud-run-verification.md`
- Your scratchpad for this feature:
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-11-shortcut-overlay.md`

## Deliverables

1. A pushed feature branch + open PR (via `gh pr create`) against
   `scion-frontiers/farmtable` `main`.
2. Real, distinct screenshots showing the overlay open (with the shortcut
   list visible) and dismissed, saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-11-shortcut-overlay/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-11-shortcut-overlay.md`
   with: what was built, each review round's findings and resolutions,
   final state, unaddressed nitpicks, and the developer's optional
   suggestion for the next most logical UI/UX feature. Since this closes
   out the recent keyboard-accessibility arc (Features 9, 10, 11), ask the
   developer explicitly whether the next suggestion should return to new
   functional surface area or continue a11y/quality work.
4. A message to the coordinator with: PR URL, branch name, summary, final
   review outcome, and the developer's next-feature suggestion (if any).

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/
  quota-concern reports.
- Do not message ptone@google.com directly — that's the coordinator's job.

## Termination

You MUST get the PR opened and pushed, produce the log and screenshots at
the paths above, and message the coordinator with the summary. Then signal
task_completed. Do not delete your developer agent until the coordinator
confirms the merge landed or explicitly tells you to clean up.
