# Brief: Engineering Manager — Feature 49: Fix Missing Reciprocal Relationship Sync

## Critical Constraints (read first)

- **Use a dedicated git worktree**, not the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-f49 -b fix/f49-reciprocal-relationship-sync
  origin/main` (standing policy).
- **Use the local-first verification protocol** — read
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`.
- **Root cause is already fully diagnosed** — read the investigation report below before
  touching anything. Your job is to apply the fix and verify it, not re-diagnose.
- **Only one agent runs at a time.** Never run a developer and a reviewer simultaneously.
- **You do NOT merge anything.** Push, open a PR via `gh pr create`, message the
  coordinator.
- **Reviewers must be blind** — fresh `code-reviewer` agent, `--harness claude`.
- **Exit criteria:** Round 1 fix everything (incl. nitpicks). Round 2+: stop if only
  nitpicks remain. Hard cap 5 rounds.
- **Developer harness:** `--type developer` should work; fall back to `--type default` if
  you hit the workspace-trust/"Not logged in" bug.
- **Real evidence required**: reproduce the exact scenario from the investigation (add
  "A blocks B", immediately open B's Inspector WITHOUT reloading, confirm "Blocked by A"
  appears instantly) — the whole point of this fix is the immediate/optimistic case, so a
  screenshot after a reload doesn't prove anything.
- **The coordinator will NOT independently re-read your diff or re-open your
  screenshots** — your own verification is what stands.

## Root Cause (from investigation, already confirmed — full report at
`/scion-volumes/scratchpad/projects/farmtable/reports/reciprocal-relationship-investigation.md`)

Frontend cache invalidation bug introduced in Feature 46 (PR #123). When adding "A blocks
B":
- The optimistic update in `applyTaskUpdate()` (`ft-app.ts:547-564`) and
  `applyTaskUpdateFields()` (`service.ts:104-116`) only updates task A's relationships in
  the TaskStore. Task B is never updated with the reciprocal BLOCKED_BY entry.
- The WatchTasks event bus (`server.go:573-579`) also only publishes an event for task A,
  not B, so other connected clients don't sync either.
- The backend READ path is correct — `convert.go` synthesizes reciprocal relationships on
  read, so a full page reload or the 30s poll refresh eventually shows it correctly. This
  is purely an immediate-UI-feedback bug, not a data-integrity bug.

## Task

1. **Fix 1 (client-side immediate consistency)**: In `ft-app.ts`'s `applyTaskUpdate()`,
   after upserting the source task (A) into the TaskStore, also upsert the reciprocal
   relationship onto each target task (B) already present in the local store — so the UI
   reflects the reciprocal instantly without waiting for a server round-trip.
2. **Fix 2 (server-side event fanout)**: In `server.go`'s `UpdateTask` handler, also
   publish a `TaskEvent` for each relationship TARGET task (not just the task actually
   being mutated), so other connected clients (or the same client on a different
   view/tab) see the reciprocal without waiting for the poll interval.
3. Verify BOTH fixes together reproduce the correct behavior: add "A blocks B" via any UI
   path (command palette add, or drag-and-drop from Feature 48), immediately (no reload)
   open B's Inspector, confirm "Blocked by A" is already there.
4. Also verify the reverse direction still works if the investigation didn't already cover
   it (adding a BLOCKED_BY relationship on the correct end still shows BLOCKS on the other
   side).

## Key Locations

- Repo: base off current `main` — fresh feature branch, PR to merge.
- Frontend: `web/src/ft-app.ts` (`applyTaskUpdate()`), `web/src/service.ts` (or wherever
  `applyTaskUpdateFields()` lives).
- Backend: `server.go` (`UpdateTask` handler, `~line 573-579` for the WatchTasks event
  bus), `convert.go` (read-path reciprocal synthesis — reference only, don't need to
  touch this, it's already correct).
- Investigation report:
  `/scion-volumes/scratchpad/projects/farmtable/reports/reciprocal-relationship-investigation.md`
- Local testing protocol:
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-49-reciprocal-relationship-sync.md`

## Deliverables

1. Pushed branch + open PR against `main`, confirmed CLEAN/MERGEABLE.
2. Real evidence: immediate (no-reload) confirmation that adding a relationship shows the
   reciprocal on the other task right away. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-49-reciprocal-relationship-sync/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-49-reciprocal-relationship-sync.md`.
4. A message to the coordinator with PR URL, summary, review outcome.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the log/evidence per
the spec above, and message the coordinator. Then signal task_completed.
