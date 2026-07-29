# Brief: Phase 2 — intra-band rank drag-reorder (contract §10 Required)

## Your workspace
Your repo is mounted at `/workspace`. It is a **standalone Git clone** (not a git
worktree) on branch `rank-reorder`, forked from `task-state-web-ui-v2` @ `6c4a13f`,
with `web/node_modules` already installed.

Do NOT `git init`, re-clone, or "repair" git. If something about git looks wrong,
**message the manager instead of fixing it**. Three previous agents on this project
destroyed their own work by reinitialising a repo that was actually fine.

`origin` is a local path and resolves, so you have a real base diff:
```bash
cd /workspace
git diff origin/main...HEAD          # 7a0f220 -> 6c4a13f, 50 files
```

Commit locally on `rank-reorder`. **Never push.** The manager pushes.

## Context
Farm Table Phase 2 is the web UI migration to the new task-state contract. Phase 1
(backend/API/CLI/MCP) is merged and live in production — it is out of scope and must
not be touched or re-litigated. Go code is out of scope.

Phase 2 has been through two review rounds. Round 2's code reviewer found that a
**Required** item in the design contract was never implemented, and the coordinator
has ruled explicitly that it must be built rather than descoped. That is your task.

Authoritative contract:
`/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md`
Read **§4.6 "Priority and rank"** and **§10 "Web UI Implications"** before writing code.

Round-2 code review (read Important Issue #2 for the finding):
`/scion-volumes/scratchpad/projects/farmtable/reports/review-task-state-web-ui-r2.md`

## The gap

Contract §10 lists under **Required changes**:

> - accepted work queue sorted by priority, then rank, then stable fallback.
> - drag/drop normally reorders within a priority band.

(The *cross-band* case — "dropping into another priority band changes priority and
re-ranks in the target band" — is explicitly marked **optional convenience**. It is
NOT in your scope. See "Out of scope" below.)

The read half exists: `rank` arrives on the wire (`gen/grpc-client.ts:463`), is sorted
on (`util/task-state-utils.ts:117-129`), and is displayed
(`ready-queue/ft-ready-queue-view.ts:352`, `inspector/ft-inspector-meta.ts:647`).

The write half does not. `gen/grpc-client.ts:253` sets `request.rank` and **has no
caller**. No gesture or control anywhere writes a rank.

## What to build

Drag-to-reorder within a priority band, in the accepted/available work queue
(`web/src/components/ready-queue/ft-ready-queue-view.ts`).

### Rank semantics — read §4.6 first, it constrains you
- Rank scope is **(collection, priority band)**. Ranks are only comparable within one
  band of one collection.
- Ordering is: priority band (`urgent`, `high`, `normal`, `low`, unspecified last),
  then `rank` within the band, then stable fallback `created_at` then task id.
- The server takes an **absolute integer rank per task** and does no re-ranking of
  its own (`internal/server/server.go:600-602` — for your information only, do not
  edit Go). Computing the ordering is the client's job.
- §4.6 says dense integers are acceptable *only* "if the code paths and tests
  acknowledge write amplification on reorder", and that **"the design must not depend
  on dense ranks"**.

**Therefore: use sparse integers.** Space ranks widely (e.g. steps of 1024). To place
a card between two neighbours, take the midpoint of their ranks. When the gap between
neighbours is exhausted (midpoint collides with an endpoint), renumber that one band
back to even spacing and write the affected tasks.

Put this logic in a **new pure module** `web/src/util/rank.ts` with no DOM and no
network dependencies, so it is unit-testable in isolation. Suggested shape (adapt as
you see fit — the signature is yours, the properties are not):

```ts
/** Ranks to write so that `movedId` sits at `targetIndex` within `band`. */
export function ranksForMove(
  band: readonly { id: string; rank?: number }[],
  movedId: string,
  targetIndex: number,
): { id: string; rank: number }[];
```

Required properties of that function, which your tests must pin:
- returns the **minimum** set of writes in the common case (one entry — just the
  moved task) and only renumbers the band when there is genuinely no gap;
- is correct when tasks have **no rank yet** (`rank === undefined` — this is the
  current state of essentially all production data, so it is the *primary* case, not
  an edge case);
- is correct at both ends of the band (move to first, move to last);
- is a no-op returning `[]` when the move does not change the order;
- never produces duplicate ranks within the returned set, and never produces an
  ordering different from the one the user just dropped.

### Gesture and write path
Follow the existing stage-change gesture in
`web/src/components/kanban/ft-kanban-view.ts:158-190` as your model. It is the
house pattern and it was just reviewed and approved. Specifically:

1. Optimistic update to the store first, so the row moves immediately.
2. `await this.client.updateTask(taskId, { rank })` — **`rank` only**. Do not send
   `phase` (it is a compile error now, and that is deliberate). Do not send
   `priority`.
3. Reconcile from the server response with `this.store.upsert(updated)`.
4. **On failure, roll back the optimistic update AND surface a visible error.** Silent
   failure is not acceptable here — a silently-refused drag was the single worst bug
   of round 1 and the coordinator made visible rejection a standing requirement. Use
   the same `write-error` event channel `ft-kanban-view` uses.
5. If multiple tasks need writing (the renumber case), make the failure handling
   coherent — decide and **document in a comment** what happens on a partial failure.
   Re-fetching or rolling the whole band back are both defensible; silently leaving a
   half-renumbered band is not.

### Refusals must be visible, not silent
Refuse, with a visible toast explaining why (same channel as above):
- dropping onto a **different priority band** (that is the optional cross-band
  feature; refuse it explicitly rather than silently ignoring the gesture);
- when the board is read-only or the collection lacks the write capability.

**Read `web/src/components/kanban/ft-kanban-column.ts:176-213` and its comments before
implementing `dragover`.** There is a non-obvious trap that cost this project a whole
review round: a `drop` event only fires if `dragover` called `preventDefault()`. If
you bail out of `dragover` early on a lane you intend to refuse, the browser never
fires `drop`, your refusal handler never runs, and the gesture dies silently looking
like a UI freeze. Refusing lanes must **accept** the dragover and refuse at drop time.
Round 2 flagged that this fix shipped with zero test coverage — do not repeat that.

### Plumbing you will need
`ft-ready-queue-view` currently has **no** `client`, no `readOnly`, and no capability
properties (`grep '@property' web/src/components/ready-queue/ft-ready-queue-view.ts`).
You will need to add them and bind them from `ft-app.ts` at the `case 'ready-queue':`
template, currently **lines 489-501**. Mirror how `ft-kanban-view` is bound in the
same `switch`.

## File ownership — STRICT, another agent is working in parallel

A second developer is fixing review findings on branch `polish-r2` at the same time.
Last round this exact discipline produced a zero-conflict merge. Keep it.

**Yours to edit:**
- `web/src/util/rank.ts` (new)
- `web/src/util/rank.test.ts` (new, Node-style like `web/src/util/safe-url.test.ts`)
- `web/src/components/ready-queue/ft-ready-queue-view.ts`
- `web/test/ft-ready-queue-view.rank.test.ts` (new)
- `.design/project-log/task-state-web-ui-rank.md` (new)
- `web/src/components/ft-app.ts` — **ONLY the `case 'ready-queue':` template block at
  lines 489-501.** Nothing else in this file, not one other line.

**Do NOT touch** (the other agent owns them, and edits will collide):
`ft-app.ts` outside 489-501, `gen/service.ts`, `gen/grpc-client.ts`,
`util/task-state-utils.ts`, `util/safe-url.ts`, `util/grpc-error.ts`,
`components/dependency/*`, `components/kanban/*`, `components/ft-dashboard-view.ts`,
`utils/task-ready.ts`, `vite.config.ts`, `web/test/helpers/*`, and **any existing file
under `web/test/`**.

If you believe you need a file outside your list, **message the manager and wait** —
do not take it. That is a coordination call, not yours to make.

`gen/grpc-client.ts:253` already sends `rank` correctly; you should not need to change
it. If you find you do, message the manager first.

## Out of scope
- Cross-band drag (changing priority by dropping into another band) — contract-optional.
- `holdReason` write plumbing (`grpc-client.ts:251`, also unreachable) — the manager
  is handling that separately.
- Go/backend, Phase 1, the kanban board, and every review finding other than this one.
- Reordering in any view other than the accepted/available queue.

## Testing
Two layers, both required:
1. **`web/src/util/rank.test.ts`** — pure unit tests of `ranksForMove`, picked up by
   `npm run test:node` (the runner globs; see `web/scripts/run-node-tests.mjs`). Cover
   every property listed above, especially the all-`undefined`-ranks case. End the file
   with a `console.log('rank tests passed')` so a green run shows it actually ran.
2. **`web/test/ft-ready-queue-view.rank.test.ts`** — component tests in the Vitest +
   jsdom harness (see `web/test/ft-kanban-view.contract.test.ts` and
   `web/test/helpers/dom.ts`). Must cover: the payload is exactly `{ rank }`
   (`expect(Object.keys(fields)).toEqual(['rank'])` — the house pattern), optimistic
   reorder, rollback + visible error on server rejection, cross-band refusal toast,
   read-only refusal, and **`dragover` `defaultPrevented === true` on a row that will
   refuse** (the regression the round-2 reviewer specifically called out as missing;
   there is a working snippet in that report).

Write a test that **fails before your change and passes after**. Then sanity-check the
inverse: revert your fix locally and confirm the test actually goes red. A test that
stays green when the feature is removed is worse than no test.

## Acceptance criteria
- [ ] `npm run build` exits 0 (`tsc --noEmit` clean).
- [ ] `npm test` and `npm run test:node` fully green, including your new tests.
- [ ] Reordering within a band persists across a reload (writes reach the server).
- [ ] The payload is `{ rank }` only — verified by an exact-key assertion.
- [ ] Every refusal and every server rejection is visible to the user; nothing is a
      silent no-op.
- [ ] `dragover` behaviour is covered by a test asserting `defaultPrevented`.
- [ ] No file outside your ownership list is modified — check with
      `git diff --name-only origin/main...HEAD` before you finish.
- [ ] Project log written (see below).
- [ ] Work committed on `rank-reorder`. Not pushed.

## Deliverables
1. Commits on branch `rank-reorder`.
2. **A project log entry at `.design/project-log/task-state-web-ui-rank.md`.** Required,
   not optional. It must include: the rank algorithm you chose and *why*; how you
   handle no-rank-yet data; your partial-failure policy for the renumber case; and an
   explicit **"Not done, and why"** section. The round-2 reviewer spot-checked the last
   log's "Not done" section against the code and found it accurate — that honesty is
   why this project's logs are trusted. Maintain it. Do not claim anything you have not
   verified by running it.
3. Message the manager with: what you built, the rank algorithm in two sentences, your
   test results pasted as real output (not summarised), and anything you deliberately
   left undone.

## Termination
You MUST commit your work, write `.design/project-log/task-state-web-ui-rank.md`,
message the manager, and then mark the task complete. Do not stop after analysis
without writing the log file — agents on this project have done exactly that before.
