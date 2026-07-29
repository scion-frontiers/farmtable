# Brief: Engineering Manager — Feature 10: Kanban Card Keyboard Navigation

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
  - Developer: `scion start farmtable-f10-dev --type developer <task>` — NO
    `--harness` flag (project default is codex).
  - Reviewer: `scion start farmtable-f10-review-rN --type code-reviewer
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
  on your own screenshots before reporting to the coordinator and confirm
  none are accidental duplicates — the coordinator checks this and will
  bounce the PR back if it doesn't hold up (happened on Feature 8).

## Feature Spec

Suggested by the developer who built Feature 9 (keyboard-first inspector
navigation, merged as PR #55, commit 64225d1): extend the same
keyboard-accessibility rigor to the Kanban board's task cards, so board
navigation and inspector navigation feel consistent end to end.

1. **Keyboard shortcuts / focusability**: task cards should be focusable
   and activatable via keyboard (Tab to a card, Enter/Space to open it —
   check whether `task-select` from Feature 4 already supports this or
   only responds to click).
2. **Roving focus / arrow-key navigation**: within a column (or across the
   board), arrow keys should move focus between cards in a predictable way
   (e.g. Up/Down within a column, Left/Right between columns) — this is
   the standard "roving tabindex" pattern for grid/list widgets. Don't
   over-engineer full ARIA grid semantics if it's not already close to that
   pattern; a reasonable, working roving-focus implementation is the goal,
   not a full WAI-ARIA authoring-practices grid.
3. **Visible focus styling** on cards, consistent with the focus ring
   pattern established in Feature 9 (reuse `inspector-shared-styles.ts`'s
   token approach if applicable, or establish an equivalent for
   `ft-kanban-column.ts`/card rendering).
4. Verify this doesn't regress existing drag-and-drop or click-to-open
   behavior on cards.
5. Do NOT add new fields, editors, or unrelated UI. This is purely a
   keyboard/a11y consistency pass on the Kanban board, mirroring Feature 9.

## Key Locations

- Repo: `/workspace/farmtable`, base off current `main` (includes PRs #47-
  #55) — use a fresh feature branch, PR to merge.
- Kanban components: `web/src/components/kanban/ft-kanban-view.ts`,
  `ft-kanban-column.ts`, `ft-task-card.ts` (has existing card editing from
  Feature 3, `task-select` event from Feature 4)
- Feature 9's focus-ring/keyboard pattern to mirror:
  `web/src/components/inspector/inspector-shared-styles.ts`,
  `web/src/components/inspector/ft-inspector.ts` (Escape scoping pattern)
  — read Feature 9's log for the exact approach:
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-9-keyboard-navigation.md`
- Repo's own agent guide: `/workspace/farmtable/agents.md` — dev/build/test
  conventions, `farmtable-dev` skill for env setup.
- Use the project's web-launch/screenshot tooling to visually verify:
  keyboard focus visibly moving between cards via Tab/arrow keys, and
  Enter/Space opening the inspector on a focused card. Real, distinct
  screenshots required.
- Prior Playwright learnings (Chromium executable path gotcha, reusable
  node_modules):
  `/scion-volumes/scratchpad/projects/farmtable/learnings/playwright-cloud-run-verification.md`
- Your scratchpad for this feature:
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-10-kanban-keyboard-nav.md`

## Deliverables

1. A pushed feature branch + open PR (via `gh pr create`) against
   `scion-frontiers/farmtable` `main`.
2. Real, distinct screenshots showing focus ring on a card and/or focus
   having moved between cards via keyboard, saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-10-kanban-keyboard-nav/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-10-kanban-keyboard-nav.md`
   with: what was built, each review round's findings and resolutions,
   final state, unaddressed nitpicks, and the developer's optional
   suggestion for the next most logical UI/UX feature.
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
