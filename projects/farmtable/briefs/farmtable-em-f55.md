# Brief: Engineering Manager — Feature 55: Fix Poll-Sync Flicker (Refresh Spinner + Redundant Change Events)

## Critical Constraints (read first)

- **Use a dedicated git worktree**, not the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-f55 -b fix/f55-poll-sync-flicker origin/main`
  (standing policy).
- **Use the local-first verification protocol** — read
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`. You'll need a
  writable GitHub-backed test collection to observe the poll cycle (see
  `/scion-volumes/scratchpad/projects/farmtable/passthrough-write-implementation-log.md`
  for the test repo setup pattern used in Phase 1).
- **Root cause is already fully diagnosed** — read the investigation report below before
  touching anything.
- **Only one agent runs at a time.** Never run a developer and a reviewer simultaneously.
- **You do NOT merge anything.** Push, open a PR via `gh pr create`, message the
  coordinator.
- **Reviewers must be blind** — fresh `code-reviewer` agent, `--harness claude`.
- **Exit criteria:** Round 1 fix everything (incl. nitpicks). Round 2+: stop if only
  nitpicks remain. Hard cap 5 rounds.
- **Developer harness:** `--type developer` should work; fall back to `--type default` if
  you hit the workspace-trust/"Not logged in" bug.
- **Real evidence required**: observe a poll cycle boundary (screenshot sequence or
  documented DOM-mutation count) before and after the fix, showing the Refresh button no
  longer shows a spinner on background polls (but still does on manual clicks), and confirm
  the manual refresh button still works correctly.
- **The coordinator will NOT independently re-read your diff or re-open your
  screenshots** — your own verification is what stands.

## Root Cause (from investigation, already confirmed — full report at
`/scion-volumes/scratchpad/projects/farmtable/reports/sync-flicker-investigation.md`)

The visible flicker is the toolbar Refresh button briefly showing a Shoelace loading
spinner every 15s — `isRefreshing` toggles true→false on every `PollManager.refresh()`
cycle (background poll), causing DOM mutations in the button, even though nothing in the
kanban board itself is actually flickering (Lit's diffing handles that fine).

Secondary issue: `TaskStore.upsert()` fires `tasks-changed` events unconditionally (no
equality check), causing unnecessary render cascades (7+ `requestUpdate()` calls per poll
cycle even when nothing changed) — currently invisible due to Lit batching, but wasted
work.

The 15s poll is confirmed correctly gated to writable external (GitHub) collections only —
native Farmtable collections use streaming and are unaffected. No scope-gating fix needed.

## Task

1. **Fix 1**: In `ft-app.ts`, don't show the loading spinner on background poll refreshes —
   only show it when the user manually clicks the Refresh button. You'll likely need to
   distinguish "background poll tick" from "manual refresh click" at the call site (e.g. a
   parameter/flag passed into the refresh function, or checking the trigger source) and
   only toggle `isRefreshing` for the manual case.
2. **Fix 2**: In `task-store.ts`'s `TaskStore.upsert()`, add an equality check before firing
   `tasks-changed` — skip the event entirely if the incoming data is identical to what's
   already stored (a deep-equal or field-by-field comparison, whichever is simpler and
   correct given the Task shape).
3. Verify both fixes together: watch a poll cycle with a writable GitHub collection where
   nothing actually changed on GitHub between polls — confirm the Refresh button doesn't
   flicker and no unnecessary re-renders happen. Also verify a poll cycle where something
   DID change still updates correctly (don't break real sync).
4. Confirm manual refresh (clicking the button) still shows the spinner as expected.

## Key Locations

- Repo: base off current `main` (through Feature 54) — fresh feature branch, PR to merge.
- Frontend: `web/src/ft-app.ts` (`isRefreshing` / `PollManager` integration), `web/src/`
  wherever `task-store.ts`'s `TaskStore.upsert()` lives.
- Investigation report:
  `/scion-volumes/scratchpad/projects/farmtable/reports/sync-flicker-investigation.md`
- Local testing protocol:
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-55-poll-sync-flicker.md`

## Deliverables

1. Pushed branch + open PR against `main`, confirmed CLEAN/MERGEABLE.
2. Real evidence per the verification points above. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-55-poll-sync-flicker/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-55-poll-sync-flicker.md`.
4. A message to the coordinator with PR URL, summary, review outcome.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the log/evidence per
the spec above, and message the coordinator. Then signal task_completed.
