# dev-p2-fixes-r3 — fix the rank-path defects surfaced by the round-3 test pass

## Context

Phase 2 of the task-state-model web UI. Phase 1 is merged, deployed and LIVE in
production — do not touch it, do not redeploy it. Go code is out of scope.

Your workspace is a clone at `/workspace/farmtable-p2-fixes-r3`, branch
`fixes-r3`, based on `task-state-web-ui-v2` @ `b393384`.

The round-3 test engineer took the suite from 164 to 351 tests with a 60/61
mutation score and made **zero production changes** — by design. Where it found
a production defect it wrote a *characterisation test pinning the current, wrong
behaviour* rather than silencing or "fixing" it. That was the right call and it
is why these bugs are now precisely specified.

Your job is to fix four of those defects and flip the tests that pin them.

**The characterisation tests currently assert the BUGGY behaviour. When you fix
the production code those tests will fail. That is expected. You must rewrite
each one to assert the CORRECT behaviour — do not delete them, and do not weaken
them to make them pass.**

## Ownership

You own `web/src/**` and `web/test/**` for the files below. Nobody else is
working in this tree right now.

Explicitly: **ownership restricts WRITES, never reads.** Import any production
module you need in a test. Testing against a real exported symbol always beats
re-implementing it locally — the round-3 pass removed twelve local
re-implementations, so do not add a thirteenth.

## The work, in priority order

### 1. F-2 — reorder under an active filter persists duplicate ranks (MOST IMPORTANT)

`web/src/components/ready-queue/ft-ready-queue-view.ts:388`:

```ts
const band = this.getReadyTasks().filter((task) => priorityRank(task.priority) === bandPriority);
```

`getReadyTasks()` applies `matchesTaskFilters`. So when a view filter is active,
tasks in the same priority band that are *hidden* are absent from `band`, and
the midpoint arithmetic in `ranksForMove` never sees them. It can therefore
assign the moved task a rank equal to a hidden neighbour's, or place it on the
wrong side of one. The write is silent and persists.

This is triggered by an ordinary user action — apply a filter, drag a row — so
treat it as the priority item.

**Required semantics.** Rank arithmetic must run over the FULL band; only the
drop *target* is identified visually. Concretely:

- Build the band from all tasks in the same collection and priority band that
  are queue-eligible, **ignoring the view filter**, ordered by the real
  `compareAcceptedQueueOrder`.
- Resolve the visible drop target to its index in that full band.
- The dropped task must land immediately before the visible target row in the
  full band, so hidden neighbours keep their relative positions.

Do not "solve" this by disabling drag while a filter is active, and do not
deduplicate ranks after the fact. Fix the input to the arithmetic.

### 2. F-1 — `ranksForMove` can emit a rank below `MIN_RANK`

`web/src/util/rank.ts`. The interior-midpoint branch has no floor; the
head-of-band branch does. Verified empirically:

```
band [{a,-5},{b,0},{c,5}], move c -> index 1   =>  [{"id":"c","rank":-3}]
```

`MIN_RANK` is documented as the floor and the module comment says "Ranks stay
positive integers", so `-3` violates a stated invariant. `Number.isSafeInteger`
lets negatives and zero through the `singleWrite` guard, which is why the
rank developer's stated intent (hostile ranks fall through to renumber) does not
hold.

Fix so that any band containing out-of-range ranks falls through to `renumber()`
and comes back inside the invariant, rather than producing another out-of-range
value. Ordering must stay correct — note that today the emitted `-3` *is* in the
right position, so do not regress ordering while fixing the range.

### 3. F-3 — no-client reorder is a silent fake success

Same file, ~396-407. The optimistic store write happens at 396-402, and the
`if (!this.client)` guard returns at 404 with only a `console.warn`. The row
moves, nothing persists, and the user is told nothing.

In production `ft-app` always assigns `client` (`private client!:` plus
assignments), so this is a defensive branch rather than a live user-facing bug —
which is why it is third and not first. Fix the ordering anyway: either bail
before mutating the store, or surface the same `write-error` event the failure
path uses. Do not leave a path that mutates the view and reports nothing.

### 4. M-1a — refusal reason reaches screen readers but not pointer users

`aria-description` covers all three drop-refusal causes; `title` is gated on
`acceptsStageDrop` alone. A read-only or capability refusal therefore gives a
screen-reader user a reason and a pointer user nothing. Make the two consistent.

### 5. Lift the ready-queue refusal strings into `DROP_REFUSAL`

The kanban half of the drop-refusal seam binds to exported constants; the queue
half cannot, because its strings are inline. Export them alongside the existing
`DROP_REFUSAL` vocabulary and have the queue view use them, so the seam test can
bind to production on both sides.

Respect the anchor split the round-3 pass established: user-visible copy is
pinned as literals in exactly one place, `web/test/vocabulary.contract.test.ts`,
and binding tests derive from the constant everywhere else. If you add or rename
a user-visible string, update that anchor file — it is the only place a literal
belongs.

## Explicitly OUT of scope — do not fix these

Already triaged and filed separately. Leave their characterisation tests as they
are:

- **F-4** dead `neutral` branch / missing hold indicator on the queue row
- **F-6** `isReady()` consults server availability before stage — this touches
  contract semantics (whether the client may override server-computed
  availability) and is with the coordinator
- **F-7** `BOARD_COLUMNS` hardcodes lane labels instead of reading `STAGE_LABEL`
  / `phaseForStage` — a refactor, deliberately deferred

## Acceptance criteria

- All four defects fixed; every characterisation test that pinned the old
  behaviour rewritten to assert the new behaviour.
- **For each fix, a real mutation test.** Break the fix deliberately, paste the
  actual failing output, restore it, confirm green. Report the real console
  output, not a claim — "verified" without output will be sent back. This is the
  standard on this workstream.
- F-2 specifically needs a test with a filter active AND a hidden same-band
  neighbour, proving no duplicate rank is written and the hidden neighbour keeps
  its relative position.
- No test weakened or deleted to make anything pass. If an existing assertion
  fails and you believe it was wrong, say so in your report and pin the new
  behaviour — do not silently change it.
- Full gate green, run and pasted:
  `npm test`, `npx tsc --noEmit`, `npx tsc -p tsconfig.test.json --noEmit`,
  `npm run build`, `find dist -name '*.map' | wc -l` (must be 0),
  `npm audit --audit-level=low`.

## Deliverables — all required

1. Commits on branch `fixes-r3` in `/workspace/farmtable-p2-fixes-r3`.
2. A project log entry at
   `.design/project-log/task-state-web-ui-fixes-r3.md`, including a
   "Not done, and why" section.
3. A report back to me covering: each fix, its killing mutation with real
   output, and anything you found that you did NOT fix.

**Do not push. Committing locally is correct; the manager does all pushing.**

If you find a fifth defect while in here, do not silently fix it and do not
silently skip it — report it and let me scope it.

You MUST commit your work, write the project log entry, and then mark the task
complete.
