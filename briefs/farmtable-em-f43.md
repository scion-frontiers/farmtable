# Brief: Engineering Manager — Feature 43: Tree View Shows Parent-Child Only

## Critical Constraints (read first)

- **Use a dedicated git worktree**, not the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-f43 -b feat/f43-tree-parent-child-only origin/main`
  (standing policy — this is explicitly a separate parallel workstream from the ongoing
  GitHub-passthrough-write implementation, per ptone@google.com's instruction).
- **Use the local-first verification protocol** for your first round of verification —
  read `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`. A live-server
  check will happen separately at deploy time.
- **Only one agent runs at a time.** Never run a developer and a reviewer simultaneously.
- **You do NOT merge anything.** Push, open a PR via `gh pr create`, message the
  coordinator.
- **Reviewers must be blind** — fresh `code-reviewer` agent, `--harness claude`.
- **Exit criteria:** Round 1 fix everything (incl. nitpicks). Round 2+: stop if only
  nitpicks remain. Hard cap 5 rounds.
- **Developer harness:** `--type developer` should work; fall back to `--type default` if
  you hit the workspace-trust/"Not logged in" bug.
- **Real screenshots required** — before/after comparison showing the extra relationship
  lines are gone and only parent-child hierarchy lines remain, on a collection/task set
  that actually has non-parent-child relationships (blocked-by/blocking, etc.) set up, so
  the fix is genuinely demonstrated (not just shown on data that never had extra lines to
  begin with).
- **The coordinator will NOT independently re-read your diff or re-open your
  screenshots** — your own verification is what stands.

## Feature Spec (ptone@google.com, verbatim)

"i want the current tree view to only show top down parent child structure. i think it
currently tries to show other relationships with other lines."

Concretely:
1. Investigate `ft-tree-view.ts` (or wherever the Tree view renders its graph/canvas) to
   find how edges/lines are currently drawn. Determine what relationship types it currently
   visualizes — likely parent/child (the intended hierarchy) PLUS other relationship types
   from the data model (blocked-by/blocking, from Feature 25's Relationships tab work; check
   `proto/farmtable.proto` or wherever relationship types are defined for the full list).
2. Remove rendering of all non-parent-child relationship lines from the Tree view. The Tree
   view should show ONLY the top-down parent→child hierarchy — a clean tree structure, no
   additional edges for blocked-by/blocking or other relationship types.
3. Confirm Feature 41's animated centering (750ms ease-in-out pan on task selection) still
   works correctly after this change (it's in the same file/component — don't regress it).
4. If other relationship types are genuinely useful to see somewhere, that's out of scope
   here — the Inspector's Relationships tab (Feature 25) already shows those; this feature
   is specifically about simplifying the Tree view's canvas to pure hierarchy. Don't add
   any replacement UI for the removed lines unless it's trivial and obviously expected.

## Key Locations

- Repo: base off current `main` (through Feature 42's DnD fix, rev farmtable-00019-w8z) —
  fresh feature branch, PR to merge.
- Frontend: `web/src/` — `ft-tree-view.ts` (the Tree view's rendering logic, edge-drawing
  code, and Feature 41's centering animation to preserve).
- Data model reference: `proto/farmtable.proto` or `internal/store/schema/` for the full
  set of relationship types that might currently be drawn.
- Local testing protocol:
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-43-tree-parent-child-only.md`

## Deliverables

1. Pushed branch + open PR against `main`, confirmed CLEAN/MERGEABLE.
2. Real before/after screenshots on data with actual non-parent-child relationships,
   proving those extra lines are gone and only hierarchy lines remain. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-43-tree-parent-child-only/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-43-tree-parent-child-only.md`.
4. A message to the coordinator with PR URL, summary, review outcome.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the log/screenshots,
and message the coordinator. Then signal task_completed.
