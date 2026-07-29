# Brief: Engineering Manager — Feature 48: Drag-and-Drop Relationship Building in Dependency View

## Critical Constraints (read first)

- **Use a dedicated git worktree**, not the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-f48 -b feat/f48-dependency-view-dnd origin/main`
  (standing policy).
- **Use the local-first verification protocol** — read
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`.
- **Learn from Feature 42's history**: the Kanban board previously shipped a real
  production drag-and-drop bug (PR #111 accidentally shrank the drop-target hit area,
  creating large dead zones that a scripted mouse-drag test failed to catch — see
  `/scion-volumes/scratchpad/projects/farmtable/reports/dnd-broken-investigation.md`). When
  you verify THIS feature's drag-and-drop, use real HTML5 DnD event simulation
  (`page.dragAndDrop()` / `locator.dragTo()`), not raw `mouse.move()` sequences, and
  explicitly test dropping onto various node sizes/positions in the dependency view's
  layered layout, not just a precise center-hit.
- **Only one agent runs at a time.** Never run a developer and a reviewer simultaneously.
- **You do NOT merge anything.** Push, open a PR via `gh pr create`, message the
  coordinator.
- **Reviewers must be blind** — fresh `code-reviewer` agent, `--harness claude`.
- **Exit criteria:** Round 1 fix everything (incl. nitpicks). Round 2+: stop if only
  nitpicks remain. Hard cap 5 rounds.
- **Developer harness:** `--type developer` should work; fall back to `--type default` if
  you hit the workspace-trust/"Not logged in" bug.
- **Real screenshots/evidence required**: a genuine drag-and-drop interaction (using real
  HTML5 DnD events) showing a new relationship actually created, verified via a follow-up
  check (reload, or `ft task show`) — not just a visual "drop zone highlighted" screenshot.
- **The coordinator will NOT independently re-read your diff or re-open your
  screenshots** — your own verification is what stands.

## Feature Spec (ptone@google.com, verbatim)

"We want to add drag and drop relationship building in the blocking tree view - dropping
one task onto another indicates that the dragged task is blocked-by the drop target"

Concretely, in the Dependency Tree view (Feature 44, PR #117 — left-to-right layered DAG
showing BLOCKS/BLOCKED_BY relationships only):
1. Make each task node in this view draggable.
2. When a task node is dropped onto another task node, create a new relationship: the
   DRAGGED task becomes BLOCKED-BY the DROP-TARGET task (i.e. the drop target now blocks
   the dragged task). Reuse the relationship-creation logic/RPC from Feature 46 (the
   command-palette add-relationship flow) rather than writing new backend logic if a
   suitable call already exists.
3. After the relationship is created, the view should re-layer/re-render to reflect the
   new dependency (the dragged task may need to move to a new layer if the drop target's
   layer is now its determining blocker — reuse Feature 44's existing layering algorithm,
   it should just naturally recompute).
4. Handle edge cases sensibly:
   - Dropping a task onto itself: no-op, do nothing.
   - Dropping a task onto one of its own existing blockers (relationship already exists):
     no-op or a subtle "already exists" indication — don't error loudly, don't duplicate
     the relationship.
   - Dropping in a way that would create a cycle (A blocked-by B, then B dropped onto A):
     detect and reject with a clear indication (toast or similar — check Phase 3 of the
     write-through project for the existing toast pattern, `ft-app.ts`, and reuse it) rather
     than silently creating a broken cycle.
   - Visual feedback during drag (e.g. highlight the potential drop target) — check what
     patterns exist from the Kanban board's drag-and-drop (Feature 39/42) for consistency,
     but this is a different interaction shape (node-onto-node, not card-into-column) so
     don't force-fit the same code, just take visual cues.

## Key Locations

- Repo: base off current `main` — fresh feature branch, PR to merge.
- Frontend: `web/src/` — the Dependency Tree view component (Feature 44), the
  relationship-creation logic from Feature 46's command-palette add-relationship mode, the
  toast/error pattern from Phase 3 of the write-through project (`ft-app.ts`).
- Prior feature logs for reference:
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-44-dependency-view.md`,
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-46-relationships-add-remove.md`
- Kanban DnD bug history (read before implementing/verifying your own DnD):
  `/scion-volumes/scratchpad/projects/farmtable/reports/dnd-broken-investigation.md`
- Local testing protocol:
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-48-dependency-view-dnd.md`

## Deliverables

1. Pushed branch + open PR against `main`, confirmed CLEAN/MERGEABLE.
2. Real evidence: a genuine drag-and-drop (real HTML5 DnD events) creating a new
   blocked-by relationship, confirmed via a follow-up check; plus evidence for the
   self-drop no-op and cycle-rejection edge cases. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-48-dependency-view-dnd/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-48-dependency-view-dnd.md`
   documenting your edge-case handling choices and visual feedback approach.
4. A message to the coordinator with PR URL, summary, review outcome.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the log/evidence per
the spec above, and message the coordinator. Then signal task_completed.
