# Brief: Engineering Manager — Feature 60: Fix Dependency View Redraw/Re-Zoom on Poll Ticks

## Critical Constraints (read first)

- **Use a dedicated git worktree**, not the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-f60 -b fix/f60-graph-poll-redraw origin/main`
  (standing policy).
- **Use the local-first verification protocol** — read
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`. You'll need a
  writable GitHub-backed test collection in polling mode to reproduce/verify.
- **Root cause is already fully diagnosed and reproduced** — read the investigation report
  below before touching anything.
- **Only one agent runs at a time.** Never run a developer and a reviewer simultaneously.
- **You do NOT merge anything.** Push, open a PR via `gh pr create`, message the
  coordinator.
- **Reviewers must be blind** — fresh `code-reviewer` agent, `--harness claude`.
- **Exit criteria:** Round 1 fix everything (incl. nitpicks). Round 2+: stop if only
  nitpicks remain. Hard cap 5 rounds.
- **Developer harness:** `--type developer` should work; fall back to `--type default` if
  you hit the workspace-trust/"Not logged in" bug.
- **Real evidence required**: reproduce the bug before your fix (viewport resets on a poll
  tick even with no data change — use the investigation's reproduction method), then after
  your fix (viewport stays stable across multiple poll cycles with no real changes, but
  still correctly updates when there IS a real change).
- **The coordinator will NOT independently re-read your diff or re-open your
  screenshots** — your own verification is what stands.

## Root Cause (validated + reproduced — full report at
`/scion-volumes/scratchpad/projects/farmtable/reports/graph-redraw-investigation.md`)

Two defects combine to reset the Dependency view's viewport on every poll tick for
external/polling collections:

1. `structureKey()` in `ft-dependency-view.ts` (~line 439-447) does NOT sort the
   relationships array before joining into the key string. If an external platform (e.g.
   GitHub) returns relationships in a different order between API calls, the key changes
   even though the actual graph is unchanged → triggers a full re-layout → `needsCenter =
   true` → `centerGraph()` resets the viewport (pan + zoom snap back to default).
2. `snapshotComplete()` in `poll-manager.ts` (~line 137) fires unconditionally on every
   poll cycle, triggering `requestUpdate()` on all views via `TaskStoreController` — even
   when no data actually changed. Feature 55's `TaskStore.upsert()` equality check
   (PR #132) only prevents `tasks-changed` events; `snapshotComplete` bypasses that
   entirely.

The Tree view is NOT affected (its `structureKey` only uses `id:parentTaskId`, which is
order-stable). Native/streaming collections are NOT affected (`snapshotComplete` only fires
once for them). Only the Dependency view on external/polling collections is impacted.

## Task

1. **Fix 1**: add `.sort()` to the relationships array in `structureKey()` before joining,
   so the key is stable regardless of API response ordering.
2. **Fix 2**: guard `snapshotComplete()` in `PollManager.refresh()` so it only fires when
   data actually changed — have `upsert()` (or equivalent) return a boolean indicating
   whether anything changed, and track/aggregate that across the refresh loop; only call
   `snapshotComplete()` if at least one real change occurred.
3. Verify both fixes together: run a polling collection through several poll cycles with NO
   real changes on the external side — confirm the Dependency view's viewport (pan/zoom)
   stays completely stable. Then make a real change (e.g. via the write-through feature)
   and confirm the view still correctly updates/re-centers when appropriate.
4. Confirm the Tree view and native/streaming collections are unaffected (quick
   regression spot-check, not full re-verification — the investigation already confirmed
   they weren't broken, just make sure your fix doesn't change that).

## Key Locations

- Repo: base off current `main` — fresh feature branch, PR to merge.
- Frontend: `web/src/` — `ft-dependency-view.ts` (`structureKey()`), `poll-manager.ts`
  (`snapshotComplete()`, `PollManager.refresh()`), `task-store.ts` (Feature 55's `upsert()`
  equality check, for reference/reuse of the return-value pattern).
- Investigation report:
  `/scion-volumes/scratchpad/projects/farmtable/reports/graph-redraw-investigation.md`
- Local testing protocol:
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-60-graph-poll-redraw.md`

## Deliverables

1. Pushed branch + open PR against `main`, confirmed CLEAN/MERGEABLE.
2. Real before/after evidence per the verification steps above. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-60-graph-poll-redraw/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-60-graph-poll-redraw.md`.
4. A message to the coordinator with PR URL, summary, review outcome.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the log/evidence per
the spec above, and message the coordinator. Then signal task_completed.
