# Brief: Feature 67 Tweak — LR Default + Remove Button Highlight

## Critical Constraints (read first)
- Dedicated git worktree: `git worktree add /workspace/farmtable-f67-tweak -b feature-67-tweak-default-lr origin/main`
- **Evidence discipline note**: this exact feature area (Feature 67) had TWO separate
  evidence problems already this session — reused/byte-identical screenshots submitted as
  if they showed different states. Take an extra beat before submitting evidence: actually
  look at each screenshot you capture and confirm it shows what you claim, don't just trust
  that a different filename means a different state.
- Check the existing default-omission URL logic carefully (see Task step 2 below) — don't
  just flip a hardcoded string comparison, make sure the underlying logic is generically
  correct for "omit param when it equals the current default."

## User Request (verbatim, from ptone@google.com)
"small tweak to the prior tree view left->right feature. The left->right should be the
default. The arrow direction in the rotate button is enough to signify state - we don't
need it to also highlight or change color."

## Context
Feature 67 (deployed as deploy-48) added a TB/LR orientation toggle to the parent-child
Tree View: `layoutOrientation` state in `ft-app.ts` (defaulted to `'TB'`), a rotate button
in `ft-hierarchy-nav.ts` (icon changes CCW/CW, previously also changed background/border
color when active — this tweak removes that visual highlight), and URL persistence via
`?layoutdir=LR` (present when LR, omitted when TB, since TB was the default).

## Task
1. Change the default `layoutOrientation` from `'TB'` to `'LR'` in `ft-app.ts`.
2. Update the Dagre `rankdir` wiring in `ft-tree-view.ts` if it has its own hardcoded
   default separate from the app-level state (verify — it may already just read the
   passed-down property, in which case no change needed there beyond the app-level default).
3. **Fix the URL persistence logic to be generically correct, not just flipped**: the
   param should be OMITTED when `layoutOrientation` equals the CURRENT default (now `LR`),
   and PRESENT (`?layoutdir=TB`) when it differs from default. Read the actual
   `syncLayoutToUrl()` (or equivalently named) method in `ft-app.ts` and confirm it's
   comparing against a default constant/variable, not a hardcoded `=== 'TB'` check that
   would need inverting. Fix it properly either way — verify by testing: default LR with
   no URL param should behave identically to explicit `?layoutdir=LR`.
4. Remove the active-state color/highlight styling on the rotate-toggle button in
   `ft-hierarchy-nav.ts` (likely a CSS class toggle similar to the Solo button's `.active`
   class, but applied to the orientation button specifically) — keep the icon direction
   change (CCW/CW) as the only visual state indicator. Do NOT touch the Solo button's own
   active-highlight styling, which should stay as-is.
5. Verify manually with real, distinct screenshots:
   - Fresh page load with no URL params: confirm default is now LR.
   - Toggle to TB: confirm URL now shows `?layoutdir=TB`, button icon changes, NO
     background/border color change on the button itself.
   - Reload with `?layoutdir=TB` in URL: confirm it loads correctly as TB.
   - Toggle back to LR: confirm URL param is removed (back to default, omitted).
6. Regression check: Solo button's own highlight styling still works (unaffected), Perf
   Phase 2 (viewport culling, if already deployed) unaffected since this doesn't touch
   Dependency View.

## Deliverables
1. A PR against `main`.
2. Screenshots (default LR state, toggled-to-TB state showing NO button highlight, URL
   param behavior) saved to
   `/scion-volumes/scratchpad/projects/farmtable/reports/f67-tweak-evidence/` — each
   screenshot must be visually distinct and actually show the claimed state (see evidence
   discipline note above).
3. A message to the coordinator with the PR link and summary of what you verified.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for questions or completion.
- Do not contact ptone@google.com directly.

## Termination
You MUST flip the default to LR, fix the URL persistence logic generically (not just
inverted), remove the button color highlight while keeping the icon-direction signal,
verify with real distinct screenshots, open the PR, and message the coordinator with the
PR link. Then signal task_completed.
