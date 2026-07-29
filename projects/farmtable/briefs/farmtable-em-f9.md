# Brief: Engineering Manager — Feature 9: Keyboard-First Inspector Navigation

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
  - Developer: `scion start farmtable-f9-dev --type developer <task>` — NO
    `--harness` flag (project default is codex).
  - Reviewer: `scion start farmtable-f9-review-rN --type code-reviewer
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
- **Screenshot integrity (important — this bit us on Feature 8):** every
  screenshot you report as evidence must be genuinely distinct and must
  actually capture the state it claims to show (e.g. an "open" screenshot
  must show the editor actually open, a "dismissed" one must show it
  actually gone). Before reporting to the coordinator, run `md5sum` on your
  own screenshots and confirm none are accidental duplicates. The
  coordinator WILL check this and will bounce the PR back if screenshots
  don't hold up — verify it yourself first to save a round trip.

## Feature Spec

Suggested by the developer who built Feature 8 (inspector editor
reliability pass, merged as PR #54, commit 51a833c): improve keyboard
navigation and accessibility across the inspector panel's editors
(description, dates, labels, assignees, priority — all added across
Features 4, 5, 6, 7, and hardened in Feature 8).

1. **Predictable Tab order**: ensure tabbing through the inspector visits
   controls in a sensible visual order (fields top-to-bottom, edit
   affordance before/with its field, save/cancel buttons reachable via Tab
   when an editor is open).
2. **Visible focus styling**: edit affordances (pencil icons, "+" buttons,
   chips, priority badge) should show a clear focus ring/outline when
   focused via keyboard, not just on mouse hover. Check for any
   `outline: none` or similar suppressions that should be replaced with a
   visible focus style instead of removed silently.
3. **Scoped Escape**: when multiple things could respond to Escape (e.g. an
   editor is open AND the inspector panel itself could close), Escape
   should close only the innermost active control first (the open editor),
   not cascade to closing the whole inspector. Verify this doesn't regress
   the Escape-to-cancel behavior added in Feature 8.
4. Do NOT add new fields or editing capabilities. This is purely a
   keyboard/a11y consistency pass across the existing inspector editors.

## Key Locations

- Repo: `/workspace/farmtable`, base off current `main` (includes PRs #47-
  #54) — use a fresh feature branch, PR to merge.
- Inspector components: `web/src/components/inspector/ft-inspector-desc.ts`,
  `ft-inspector-meta.ts`, `ft-inspector-header.ts`, `ft-inspector.ts`
- Feature 8's state-switch and dismiss-key handling (Escape semantics) is
  the most relevant recent precedent — read its log before starting:
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-8-editor-reliability.md`
- Repo's own agent guide: `/workspace/farmtable/agents.md` — dev/build/test
  conventions, `farmtable-dev` skill for env setup.
- Use the project's web-launch/screenshot tooling to visually verify: Tab
  order through the inspector, visible focus rings on key controls, and
  that Escape with an editor open only closes the editor (inspector stays
  open). Real, distinct screenshots required per the integrity note above.
- Prior Playwright learnings (Chromium executable path gotcha, reusable
  node_modules):
  `/scion-volumes/scratchpad/projects/farmtable/learnings/playwright-cloud-run-verification.md`
- Your scratchpad for this feature:
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-9-keyboard-navigation.md`

## Deliverables

1. A pushed feature branch + open PR (via `gh pr create`) against
   `scion-frontiers/farmtable` `main`.
2. Real, distinct screenshots showing: focus ring visible on at least one
   edit affordance, and Escape closing only the innermost editor (inspector
   still open behind it), saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-9-keyboard-navigation/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-9-keyboard-navigation.md`
   with: what was fixed, each review round's findings and resolutions,
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
