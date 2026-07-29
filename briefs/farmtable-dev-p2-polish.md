# Brief: Phase 2 — round-2 review fixes (code review + security audit)

## Your workspace
Your repo is mounted at `/workspace`. It is a **standalone Git clone** (not a git
worktree) on branch `polish-r2`, forked from `task-state-web-ui-v2` @ `6c4a13f`, with
`web/node_modules` already installed.

Do NOT `git init`, re-clone, or "repair" git. If something about git looks wrong,
**message the manager instead of fixing it**. Three previous agents on this project
destroyed their own work by reinitialising a repo that was actually fine.

`origin` is a local path and resolves:
```bash
cd /workspace
git diff origin/main...HEAD    # 7a0f220 -> 6c4a13f, 50 files
```

Commit locally on `polish-r2`. **Never push.** The manager pushes.

## Context
Farm Table Phase 2 is the web UI migration to the new task-state contract. Phase 1
(backend/API/CLI/MCP) is merged and live in production — out of scope, do not touch.
Go code is out of scope except for reading.

Round 2 of review is in. The work is in good shape: the security auditor **APPROVED**
(the round-1 HIGH XSS is genuinely closed) and the code reviewer confirmed all three
round-1 code findings closed with structural fixes. You are closing the remaining
findings so we can get a clean round 3.

Read these — you are implementing from them, so read the actual reports, not just
this summary:
- `/scion-volumes/scratchpad/projects/farmtable/reports/review-task-state-web-ui-r2.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/audit-task-state-web-ui-r2.md`

Authoritative contract (§10 governs the UI):
`/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md`

A second developer (`dev-p2-rank`) is building the intra-band rank drag-reorder on
branch `rank-reorder` **in parallel with you**. That is code-review blocker #2 and it
is NOT yours. See file ownership below — it is strict.

---

## Work item 1 (BLOCKER) — `showWriteError` misattributes in the mirror direction
`web/src/components/ft-app.ts:830-834`

Round 1 found that a Farm Table permission error was being blamed on GitHub. The fix
for that stopped asserting "GitHub" without evidence — but the branch it routes to
makes an equally confident claim in the *other* direction:

```ts
if (isServerRejection(error)) {
  message = `Farm Table rejected this change: ${raw}`;
}
```

`isServerRejection` returns true for **any** `PermissionDenied`/`FailedPrecondition`
whose text lacks `/github/i`. So a real GitHub 403 relayed by the adapter as
`PermissionDenied("403 Forbidden writing issue")` is now reported as "Farm Table
rejected this change". Same bug, mirrored.

The branch *order* is correct and the "textual evidence beats the `platform` field"
reasoning is correct — **do not change either**. Only the wording is wrong:

```ts
if (isServerRejection(error)) {
  // The rejection reached us from the Farm Table server, but it may have
  // originated in a platform adapter. Report the reason, not the culprit.
  message = `The change was rejected: ${raw}`;
}
```

`web/test/ft-app.write-error.test.ts:58` asserts
`toMatch(/farm ?table rejected this change/i)` and must be updated with it. **Keep**
the adjacent `not.toMatch(/github/i)` and `not.toMatch(/token/i)` assertions at
`:74-77` — those carry the actual round-1 guarantee. Update the test to assert the
new neutral wording *and* that the server reason still reaches the user.

## A note on test scope — read before you start

The round-2 **test review** also returned REQUEST CHANGES, on the basis of real
mutation testing (55 mutants, 71% killed). It found several more coverage gaps than
the one below. **Those are not yours.** A dedicated test-engineer runs after you and
`dev-p2-rank` merge, and will close them against the combined branch.

Your only test work is:
- **Work item 2** below (the `dragover` coverage), because it is inseparable from the
  production code you are touching; and
- the one-assertion update in `ft-app.write-error.test.ts` required by work item 1.

Do not go after the other test gaps — you will collide with the test engineer. If you
notice something else broken in `web/test/`, **write it in your log** and it will be
routed. Do not fix it.

## Work item 2 (SHOULD FIX) — the `dragover` fix has zero regression coverage

The headline fix of round 2 was removing an early return from `onDragOver`
(`web/src/components/kanban/ft-kanban-column.ts:210-213`) — a `drop` event only fires
if `dragover` called `preventDefault()`, so bailing early made refusals a silent
no-op. **Reverting that fix today leaves all 135 tests green.** `dropTaskOn`
(`web/test/helpers/dom.ts:150-166`) synthesises a bare `drop` and never exercises
`dragover` at all.

Add coverage to `web/test/ft-kanban-view.contract.test.ts`. The reviewer supplied a
working snippet — see Important Issue #3 in the code review report. Cover the
terminal lanes plus the read-only and `canChangeStage: false` variants.

**Verify the test bites:** re-add `if (this.isDropRefused) return;` to `onDragOver`
locally, confirm your new test goes RED, then remove it again. A test that stays green
when the fix is reverted is worse than no test. Say in your log that you did this.

## Work item 3 (SHOULD FIX) — `UpdateTaskFields` guard is half a guard
`web/src/gen/service.ts:28`

`phase` is excluded but `availability` — the other server-computed projection — is
not, and `applyTaskUpdateFields` spreads `...rest` straight over the task. Add
`'availability'` to the `Omit` list. (Leave `id`/`version`/`createdAt`/`collectionId`/
`platform` alone — pre-existing, out of scope.)

## Work item 4 (SHOULD FIX) — finish the phase→stage migration in the dependency view
`web/src/components/dependency/ft-dependency-view.ts`

`ft-app.isTaskVisibleInCurrentView` was migrated to `isClosedStage(task.stage)` for the
dependencies view, but the component rendering that same view still compares
`TaskPhase.CLOSED` at lines 126, 188, 665, 671, 678, 697, 721, 747, 807, 856. Not a
live bug (the predicates agree today) but two sources of truth for one view, and the
contract makes `stage` asserted and `phase` derived.

Replace them with `isClosedStage(task.stage)` from `util/task-state-utils.js`, and fix
the stale deleted-vocabulary comment at `:653` ("including ON_HOLD tasks in the
'blocked' stage" — `blocked` is not a stage any more).

## Work item 5 (AUDIT LOW-1) — dev-gate the `http:` localhost carve-out
`web/src/util/safe-url.ts`

The loopback exception is compiled into production, so attacker-influenced task data
can render a clickable link to a service on the victim's own machine — and WHATWG
normalisation means `http://0x7f000001/`, `http://2130706433/`, `http://127.1/`,
`http://0177.0.0.1/` and fullwidth `http://127．0．0．1/` all reach it. Gate it behind
`import.meta.env.DEV` exactly as the token fallback is gated, so production is
https-only. Exact recommended code is in the audit report under [LOW-1].

Add tests for the obfuscated-IPv4 forms asserting they are rejected in a production
build.

## Work item 6 (AUDIT LOW-2) — reject embedded credentials
`web/src/util/safe-url.ts:34`

`safeExternalUrl('https://github.com@evil.example/')` currently passes, and both call
sites render *static* link text, so the user's only cue is the status bar — the classic
userinfo confusion pattern. Add `if (url.username || url.password) return null;` and
add `https://user:pass@evil.example/` and `https://ok.example@evil.example/` to
`web/src/util/safe-url.test.ts` as rejected cases.

## Work item 7 (AUDIT LOW-3) — stop shipping production sourcemaps
`web/vite.config.ts`

The 2.5 MB `.js.map` is embedded into the server binary via `//go:embed all:web/dist`
and served by `mux.Handle("/", http.FileServer(assets))` with **no auth middleware** —
the manager verified this independently. No live secrets are in it, but it hands out
the complete unminified client including every comment explaining which paths are
security-relevant.

Set `sourcemap: false`. **Do not use `'hidden'`** — the audit points out it still
leaves the `.map` inside `dist/` and therefore inside the Go embed, which does not fix
anything. Confirm afterwards that `web/dist/assets/` contains no `.map` file.

---

## Work item 8 — Observations to fold in

These are all cheap. Details and exact line numbers are in the code review report's
Observations section; read them there.

- **Obs 1** — `ft-app.ts:519-522` passes four filter properties to `ft-tree-view`,
  which declares no filter properties at all (`grep -rn "Filter" web/src/components/tree/`
  returns nothing). **Drop the dead bindings.** Do not wire them up — that is a feature,
  and silently doing nothing is the current behaviour either way. Note it in your log
  so it can be filed as a follow-up.
- **Obs 2** — refusal strings are duplicated between `ft-kanban-column.dropHint` and
  `ft-kanban-view.reportRefusal` call sites, and two of three are byte-identical.
  Export them from `util/task-state-utils.ts` next to `acceptsStageDrop()`.
- **Obs 3 / audit INFO-3** — `ft-kanban-view.ts:149-158`: the read-only and capability
  refusals fire *before* the `store.getTask(taskId)` lookup, so dropping arbitrary
  external content (text dragged from another window) onto a read-only board raises a
  spurious "This board is read-only" toast. Hoist the lookup above the refusal checks.
- **Obs 4 (part)** — `ft-kanban-column.ts:361` binds `title=${dropHint}` and `dropHint`
  returns the read-only string unconditionally, so a read-only board shows a native
  tooltip on all ten lanes at all times. Gate the `title`. **Leave the
  `aria-description` → `aria-describedby` change alone** — the manager is filing that
  as a separate accessibility follow-up.
- **Obs 6** — `ft-dashboard-view.ts:206-226` renders under "Unavailable Reasons" but
  iterates reasons for *all* tasks including available ones. Add
  `if (task.availability?.available !== false) continue;`.
- **Obs 7** — `ft-dashboard-view.ts:146` counts held tasks by testing whether a
  presentation helper returns a non-empty label. Test the enum directly instead.
- **Obs 8** — `web/src/utils/task-ready.ts:21` tests `task.holdReason !== undefined`
  without normalising `UNSPECIFIED`, unlike `task-filters.ts:34` and
  `task-state-utils.ts:100`. One-line hardening; this line is now live because the
  delta populates `holdReason` from the wire.
- **Obs 9** — `ft-kanban-view.columnsForStage` (`:380-383`) is vestigial; `onColumnNav`
  can use `BOARD_COLUMNS` directly.
- **Obs 10** — delete the two-symbol `inspector-stage-utils.ts` re-export shim and
  re-point `ft-inspector-header.ts:8` and `ft-inspector-relationships.ts:7` at
  `util/task-state-utils.js`. **Leave `ft-tree-node.ts:6-30`'s private copy alone** —
  its abbreviated labels are deliberate. Correct the "STAGE_COLOR unified" claim in
  `.design/project-log/task-state-web-ui-fixes.md` to match reality.
- **Obs 11** — `src/util/task-state-utils.test.ts` and `src/utils/task-ready.test.ts`
  print nothing on success, unlike `safe-url.test.ts`. Add a one-line `console.log` to
  each so a green run shows they actually executed.

### Explicitly NOT in your scope
- **Obs 5 (padlock semantics)** — whether the lock icon should mean "blocked by
  dependency" or "unavailable" is a product decision. The manager is filing it. Do not
  change it.
- The `aria-description` → `aria-describedby` change (see Obs 4 above).
- Code-review blocker #2 (rank reorder) — `dev-p2-rank` owns it.

If you disagree with any of the above triage, **say so in your log and message the
manager** — do not silently expand scope, and do not silently skip an item either.

---

## File ownership — STRICT, another agent is working in parallel

**Yours:** everything you need for the items above, specifically
`ft-app.ts` (**except lines 489-501**), `gen/service.ts`, `gen/grpc-client.ts`,
`util/safe-url.ts`, `util/safe-url.test.ts`, `util/task-state-utils.ts`,
`util/task-state-utils.test.ts`, `util/grpc-error.ts`, `utils/task-ready.ts`,
`utils/task-ready.test.ts`, `components/kanban/*`, `components/dependency/*`,
`components/ft-dashboard-view.ts`, `components/inspector/*`, `vite.config.ts`,
all existing files under `web/test/`, and
`.design/project-log/task-state-web-ui-polish.md` (new).

**NOT yours — `dev-p2-rank` owns these and edits will collide:**
- `web/src/components/ready-queue/*`
- `web/src/util/rank.ts`, `web/src/util/rank.test.ts`
- `web/test/ft-ready-queue-view.rank.test.ts`
- **`ft-app.ts` lines 489-501** — the `case 'ready-queue':` template block. Do not
  touch those lines. Everything else in `ft-app.ts` is yours.

Before you finish, run `git diff --name-only origin/main...HEAD` and confirm nothing
outside your list appears. If you think you need a file outside it, **message the
manager and wait.**

## Acceptance criteria
- [ ] `npm run build` exits 0 (`tsc --noEmit` clean).
- [ ] `npm test` and `npm run test:node` fully green.
- [ ] `npm audit --audit-level=low` → 0 vulnerabilities.
- [ ] `web/dist/assets/` contains no `.map` file after a build.
- [ ] The new `dragover` test is verified to go RED when the fix is reverted.
- [ ] Every work item above is either done or explicitly explained in the log.
- [ ] No file outside your ownership list is modified.
- [ ] Committed on `polish-r2`. Not pushed.

## Deliverables
1. Commits on `polish-r2`. Small, logically-scoped commits, not one giant one.
2. **A project log at `.design/project-log/task-state-web-ui-polish.md`.** Required.
   Must have an explicit **"Not done, and why"** section. The round-2 reviewer
   spot-checked the previous log's "Not done" claims against the code and found them
   all accurate — that is why this project's logs are trusted. Maintain it. Do not
   claim anything you have not verified by running it.
3. Message the manager with a per-item status table (item → done / not done / why),
   your test output pasted as real output rather than summarised, and any
   disagreements with the triage above.

## Termination
You MUST commit your work, write
`.design/project-log/task-state-web-ui-polish.md`, message the manager, and then mark
the task complete. Do not stop after analysis without writing the log file — agents on
this project have done exactly that before.
