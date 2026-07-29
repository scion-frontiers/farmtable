# Brief: Feature 61 Round 2 — Address Review Nitpicks + Naming Options

## Critical Constraints (read first)
- This is a fix round on the EXISTING PR #140, not a new feature. Check out the same
  branch in a fresh worktree: `git worktree add /workspace/farmtable-f61-fixes -b
  <existing-branch-name> origin/<existing-branch-name>` (find the exact branch name via
  `gh pr view 140 --json headRefName` or REST equivalent if GraphQL rate-limited), then
  push your fixes as additional commits to that same branch/PR — do NOT open a new PR.
- Local-build-first Playwright verification protocol still applies for re-testing.

## Context
PR #140 (isolate/solo mode for tree view) got an independent blind review:
APPROVE WITH NITPICKS (verdict text: "ship it," but per this project's standing rule, ALL
reviewer findings — blocking or not — get addressed before merge, not skipped). Full
review is summarized below; you don't need to re-derive it.

Separately, ptone@google.com asked (2026-07-23) whether the feature could use a different
name than "Isolate" — open to alternatives, wants options considered.

## Task — Part 1: Fix the 4 nitpicks
1. **Binding consistency**: change `?isolateMode` (attribute binding) to `.isolateMode`
   (property binding) on the relevant element in `ft-tree-view.ts` (~line 725) to match
   the pattern used for `.selectedTaskId` on the same element.
2. **Deselection UX gap**: when `selectedTaskId` becomes null while `isolateMode` is true,
   either (a) auto-disable `isolateMode` when selection clears, OR (b) keep the toggle
   button clickable (remove the disabled-when-no-selection guard) so the user can turn it
   off without re-selecting first. Pick whichever is simpler/more consistent with the rest
   of the UI and document your choice.
3. **Redundant guard**: remove the redundant `if (!this.selectedTaskId) return` in
   `onIsolateClick` (harmless but dead code since the button is already disabled in that
   state) — only remove it if you keep the disabled-button approach from fix #2; if you
   go with option (b) above this guard becomes load-bearing, so use your judgment.
4. **Level selector during isolate mode**: `getMaxLevel()` in `ft-hierarchy-nav.ts`
   currently computes from `focusRootId` (full tree), not the isolated root, so the level
   dropdown can show depths that don't exist in the isolated subtree. Fix it to compute
   the max level relative to the isolated root when isolate mode is active.

## Task — Part 2: Naming options
The current label/name is "Isolate." Propose 2-3 alternative names for the
feature/button/mode (e.g., candidates like "Focus," "Solo View," "Subtree Focus," "Zoom to
Branch" — feel free to come up with better ones). Don't commit to a rename in code unless
one option is clearly superior and trivial to apply — if so, apply your top pick (it's a
one-string change, easy to revert/adjust later) and note it clearly in your report so the
coordinator can confirm with ptone. List all options considered either way.

## Deliverables
1. Fixes for all 4 nitpicks pushed to PR #140's branch, with brief re-verification
   (doesn't need the full evidence suite again — just confirm nothing broke, e.g. isolate
   toggle still works, level selector shows correct range when isolated).
2. A short list of 2-3 naming alternatives (with your recommendation), and note if you
   applied one already.
3. A message to the coordinator confirming all 4 fixes are pushed, plus the naming
   options/recommendation.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"`.
- Do not message ptone@google.com directly — the coordinator will relay naming options.

## Termination
You MUST push all 4 fixes to PR #140, re-verify basic functionality, propose naming
options, and message the coordinator with confirmation + the naming shortlist. Then
signal task_completed.
