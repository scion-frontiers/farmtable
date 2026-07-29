# Brief: Engineering Manager — Feature 46: Relationships Tab — Delete + Quick-Add via Command Palette

## Critical Constraints (read first)

- **Use a dedicated git worktree**, not the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-f46 -b feat/f46-relationships-add-remove
  origin/main` (standing policy).
- **Use the local-first verification protocol** — read
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`. Live-server check
  happens separately at deploy time.
- **Extend the existing command palette component — do NOT duplicate it.** This is an
  explicit instruction from ptone@google.com. Feature 31 (PR #82) built the command
  palette/global search (`ft-command-palette.ts` or similar — find the actual file). Add a
  mode/variant to that SAME component rather than building a second quick-find UI.
- **Only one agent runs at a time.** Never run a developer and a reviewer simultaneously.
- **You do NOT merge anything.** Push, open a PR via `gh pr create`, message the
  coordinator.
- **Reviewers must be blind** — fresh `code-reviewer` agent, `--harness claude`.
- **Exit criteria:** Round 1 fix everything (incl. nitpicks). Round 2+: stop if only
  nitpicks remain. Hard cap 5 rounds.
- **Developer harness:** `--type developer` should work; fall back to `--type default` if
  you hit the workspace-trust/"Not logged in" bug.
- **Real screenshots required**, including a genuine before/after showing a relationship
  actually removed via the trash icon, and a genuine add-relationship flow via the
  quick-find "+" button showing a new relationship actually created — not just UI-present
  screenshots. This project's history has repeatedly caught features that looked right in
  a static screenshot but didn't actually work end-to-end; don't repeat that.
- **The coordinator will NOT independently re-read your diff or re-open your
  screenshots** — your own verification is what stands.

## Feature Spec (ptone@google.com, verbatim)

"For the relationships tab in the inspector we want to make the following improvements:
have a small trash can icon per relationship to remove a relationship - and a '+' glyph on
the relationship section heading - which opens a quick find box - but where the action is
add instead of open (we should modify and extend our quickfind box - not duplicated it)"

Concretely:
1. **Delete icon per relationship row**: In the Inspector's Relationships tab (Feature 25,
   PR #71 — find the actual component, likely `ft-inspector.ts` or a dedicated
   relationships sub-component), add a small trash-can icon next to each listed
   relationship (parent/child/blocks/blocked-by/etc — whatever's currently listed there).
   Clicking it removes that specific relationship (call whatever RPC/mutation already
   exists for relationship removal — check if one exists from Feature 25's original
   implementation, or if you need to add a `RemoveRelationship`-equivalent call). Confirm
   before destructive removal if that matches this app's existing UX patterns elsewhere (check
   how task deletion or other destructive actions are confirmed, if at all), otherwise a
   simple undo-via-toast or direct removal is fine — use judgment, document your choice.
2. **"+" button on the Relationships section heading**: Add a small "+" icon/button in the
   Relationships tab's section header. Clicking it opens the EXISTING command
   palette/quick-find component (Feature 31, PR #82) but in a different MODE: instead of
   its normal behavior (select a task → navigate/open it), this mode's selection ACTION is
   "add a relationship between the current Inspector's task and the selected task" instead
   of "open the selected task." You'll likely need to:
   - Add a `mode`/`action` prop or similar to the command palette component (e.g.
     `mode: 'navigate' | 'add-relationship'`, defaulting to `'navigate'` for all existing
     call sites so you don't break Feature 31's normal behavior).
   - When in `'add-relationship'` mode, selecting a task should call whatever
     relationship-creation logic exists (check Feature 25/what backs the Relationships
     tab) instead of navigating, and probably also needs a way to pick WHICH relationship
     type to add (parent/child/blocks/blocked-by) — check how the existing Relationships
     tab distinguishes these and design a sensible minimal UI for specifying type (could be
     as simple as a small type selector shown alongside the quick-find results, or tabs/
     buttons for "Add as blocker" vs "Add as blocked-by" etc — use judgment, this wasn't
     fully specified, document your choice and keep it simple for a first pass).
   - Exclude the current task itself from the quick-find results (can't relate a task to
     itself).

## Key Locations

- Repo: base off current `main` — fresh feature branch, PR to merge.
- Frontend: `web/src/` — the Inspector's Relationships tab component (Feature 25, PR #71),
  the command palette component (Feature 31, PR #82).
- Backend: check `proto/farmtable.proto` and `internal/` for existing
  Add/RemoveRelationship-style RPCs before assuming you need to add new ones.
- Local testing protocol:
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-46-relationships-add-remove.md`

## Deliverables

1. Pushed branch + open PR against `main`, confirmed CLEAN/MERGEABLE.
2. Real screenshots/evidence: (a) removing a relationship via the trash icon, confirmed
   gone afterward (e.g. via a second screenshot or `ft task show`), (b) adding a
   relationship via the "+" → quick-find flow, confirmed present afterward. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-46-relationships-add-remove/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-46-relationships-add-remove.md`
   documenting your relationship-type-selection UI choice and any confirm-before-delete
   decision.
4. A message to the coordinator with PR URL, summary, review outcome.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the log/evidence per
the spec above, and message the coordinator. Then signal task_completed.
