# dev-p2-fixes-r4 — Phase 2 web UI, round-4 fix pass

Date: 2026-07-27
Branch: `fixes-r4` (base `49e55e9`)
Brief: `briefs/farmtable-dev-p2-fixes-r4.md`
Pushed: **no** — three local commits, manager pushes.

| Commit | Scope |
| --- | --- |
| `3ff4ccd` | Item 1 (I-1/MEDIUM-2/M-1 scope half), item 3 (H-1), item 5 (M-2), item 6 (M-3) |
| `07f5392` | Item 4 (H-2), item 1 (M-1 oracle half) |
| `3785de3` | Item 2 (I-2/LOW-4) tests |

All six items are fixed. All three named mutants are killed, with the real
failing output pasted below. No test was weakened or deleted; the suite went
from 362 to 382 tests.

---

## Gate

Every command run from `/workspace/web` on the final tree.

```
$ npm test
Compiling 4 Node test script(s) with tsconfig.test.json…
rank tests passed
safe-url tests passed
task-state-utils tests passed
task-ready tests passed
4 Node test script(s) passed.
 Test Files  21 passed (21)
      Tests  382 passed (382)

$ npx tsc --noEmit
(clean, exit 0)

$ npx tsc -p tsconfig.test.json --noEmit
(clean, exit 0)

$ npm run build
dist/index.html                   1.12 kB │ gzip:   0.57 kB
dist/assets/index-DATgx8W6.css   36.32 kB │ gzip:   6.53 kB
dist/assets/index-CjKmybP1.js   841.44 kB │ gzip: 214.48 kB
[vite-plugin-static-copy] Copied 2053 items.
✓ built in 7.39s

$ find dist -name '*.map' | wc -l
0

$ npm audit --audit-level=low
found 0 vulnerabilities
```

The 500 kB chunk-size warning is pre-existing and unrelated to this pass.

---

## Item 1 — `bandFor()` must not scope rank arithmetic by availability

**I-1 / MEDIUM-2 / M-1. Top priority.**

`bandFor()` filtered candidates through `this.isReady(candidate)`, so the rank
arithmetic saw only the rows the server currently calls available. A held,
dependency-blocked or not-yet-started task in the same band was invisible to the
midpoint calculation while still holding a live rank — and it walks straight
back into the queue the moment the hold lifts, carrying that rank. The midpoint
computed without it collides.

Membership now turns on **stage**, not availability. `web/src/util/task-state-utils.ts`:

```ts
export function rankBand(
  task: Task,
  candidates: readonly Task[],
  isQueueMember: (candidate: Task) => boolean,
): Task[] {
  const bandPriority = priorityRank(task.priority);
  return candidates
    .filter(
      (candidate) =>
        candidate.collectionId === task.collectionId &&
        priorityRank(candidate.priority) === bandPriority &&
        (!isClosedStage(candidate.stage) || isQueueMember(candidate)),
    )
    .sort(compareAcceptedQueueOrder);
}
```

`bandFor()` is now a one-line delegation. The docstring moved with the code and
was rewritten to name **all three** ways a task can be off screen, and to say
which of them is allowed to affect rank scope:

1. the view filter (search / stage / availability-reason) — presentational, ranks live;
2. server availability (held, blocked, future start) — temporary, ranks live;
3. a closed stage — terminal, ranks dead; mirrors `store.IsTerminalStage` (PR #191).

Contract §4.6 scopes rank to (collection, priority band), which is exactly what
the function now computes.

### Deliberate deviation from the brief: the union clause

The brief said to replace `isReady(candidate)` with `!isClosedStage(candidate.stage)`.
I used `(!isClosedStage(candidate.stage) || isQueueMember(candidate))` instead.

The strict form introduces a new silent no-op. `isReady()` treats
server-reported availability as authoritative and returns before it looks at
stage, so **a COMPLETED task the server still reports available is rendered in
the Available Queue and is draggable** — pinned by an existing characterisation
test, `queue-ordering.test.ts` "renders a closed task the server still reports
as available". Under the strict predicate that visible, draggable row is not in
its own band, `findIndex` returns `-1`, and `reorder()` returns early with no
write and no refusal: the row snaps back and says nothing. That is precisely the
failure mode rounds 2 and 3 were spent eliminating.

The union clause keeps the brief's intent — dead ranks excluded — while holding
the invariant *if it is on screen and draggable, it is in the band*. Covered by
two tests: "ignores a same-band task at a closed stage" and "can still reorder a
closed task the server reports as available".

### Regression tests (new)

`test/ft-ready-queue-view.rank-adversarial.test.ts`, new describe block
"reordering while availability hides part of the band". Band fixture
`a=1024, h=1536, b=2048, c=3072` where `h` is hidden; gesture drops `b` onto `c`.
Correct behaviour writes `b → 1792`; the pre-fix code wrote `1536`, colliding
with `h`.

Three hidden-neighbour causes, each with a no-duplicate-rank test and a
relative-position test:

| Cause | Fixture |
| --- | --- |
| held | `holdReason: WAITING_FOR_INPUT` + `AvailabilityReason.HELD` |
| blocked by a dependency | `BLOCKED_BY` relationship + `AvailabilityReason.BLOCKED_BY_DEPENDENCY` |
| future start | `startDate: '2099-01-01'` + `AvailabilityReason.FUTURE_START_DATE` |

Plus "writes exactly the same ranks whether or not the server hides the
neighbour" — the property that makes availability irrelevant to rank, stated
directly.

Verified against the defect by restoring the old predicate in `rankBand`:

```
 × writes no duplicate rank when the neighbour in the gap is held
   → ranks are [["a",1024],["c",1536],["h",1536],["b",2048]]: expected 3 to be 4
 × keeps a neighbour that is held in its relative position
   → expected [ 'a', 'c', 'h', 'b' ] to deeply equal [ 'a', 'h', 'c', 'b' ]
 × writes no duplicate rank when the neighbour in the gap is blocked by a dependency
   → ranks are [["a",1024],["c",1536],["h",1536],["b",2048]]: expected 3 to be 4
 × keeps a neighbour that is blocked by a dependency in its relative position
   → expected [ 'a', 'c', 'h', 'b' ] to deeply equal [ 'a', 'h', 'c', 'b' ]
 × writes no duplicate rank when the neighbour in the gap is starting in the future
   → ranks are [["a",1024],["c",1536],["h",1536],["b",2048]]: expected 3 to be 4
 × keeps a neighbour that is starting in the future in its relative position
   → expected [ 'a', 'c', 'h', 'b' ] to deeply equal [ 'a', 'h', 'c', 'b' ]
 × writes exactly the same ranks whether or not the server hides the neighbour
   → expected [ { id: 'c', rank: 1536 } ] to deeply equal [ { id: 'c', rank: 1792 } ]
      Tests  7 failed | 23 passed (30)
```

The duplicate rank is visible in the failure message itself: `c` and `h` both at
1536.

### M-1 — the thirteenth self-built oracle

`test/ft-ready-queue-view.rank-adversarial.test.ts` "the view and the rank
module agree" rebuilt the band from `rowIds(view)` — the rendered rows — and
took `targetIndex` from that list. That is a second implementation of the thing
under test, and a wrong one, because the view ranks against the full band. It
happened to agree only because every fixture in that block was fully visible; in
other words the oracle was quietly asserting the I-1 defect.

Both inputs now come from production:

```ts
const band = rankBand(store.getTask(scenario.moved)!, store.allTasks, (candidate) =>
  isReady(candidate, store),
);
const targetIndex = band.findIndex((task) => task.id === scenario.onto);
```

A fourth scenario, "a band whose middle task the server hides", was added so the
block contains at least one case where "the band" and "the rows on screen" are
genuinely different lists.

**Reported honestly:** binding the oracle to `rankBand` means it can no longer
detect a bug *inside* `rankBand` — mutating the predicate mutates both sides
equally, and I confirmed the block stays green under that mutant. That is
inherent to the "import the real thing" option the brief offered, and it is the
correct trade here: this block's job is to assert *view ↔ module agreement*,
while band-scope correctness is asserted by the seven hardcoded-expectation
tests above (the brief's other option). The two halves are complementary and
both are present.

---

## Item 2 — overlapping reorders

**I-2 / LOW-4.**

`drop` ends the gesture as soon as it hands off to `reorder()`, but `reorder()`
keeps awaiting its writes, so nothing stopped a second drag starting mid-flight.

Added `private reorderInFlight = false` (not `@state()` — it changes no rendered
output), set immediately before the `try`, cleared in a new `finally`. The guard
sits with the other refusals and uses the same channel:

```ts
if (this.reorderInFlight) {
  this.reportRefusal(DROP_REFUSAL.reorderBusy);
  return;
}
```

New vocabulary entry `DROP_REFUSAL.reorderBusy`, anchored in
`test/vocabulary.contract.test.ts`. That file also gained a completeness test
listing all nine `DROP_REFUSAL` keys, so the next refusal cannot be added
unpinned.

### Rollback scope — reasoning, as requested

**Changed to rank-only.** Was:

```ts
for (const original of originals) this.store.upsert(original);
```

Now:

```ts
for (const original of originals) {
  const current = this.store.getTask(original.id);
  this.store.upsert(current ? { ...current, rank: original.rank } : original);
}
```

The writes are `await`ed, so the store can legitimately change underneath them —
a watch event carrying a rename, a stage change, a `version` bump. Re-upserting
the whole pre-drag snapshot reverts all of it, silently undoing server state
this view never touched. Worse, it puts back a **stale `version`**, so the next
optimistic write anywhere in the app fails with a conflict the user has no way
to explain. The reorder changed exactly one field; the rollback should undo
exactly one field. The `: original` fallback keeps the behaviour correct for a
task that has since been deleted from the store.

This is also why the in-flight guard is a *refusal* rather than a queue: even
with rank-only rollback, two reorders compute their bands from different
starting states, and serialising them silently would still land the user's
second gesture somewhere they did not aim it.

### Tests (new file `test/ft-ready-queue-view.concurrent-reorder.test.ts`)

A `GatedClient` extends `RecordingClient` and holds `updateTask`'s result open,
starting the real call first so an *issued* write is distinguishable from one
that never happened. Six tests: second gesture refused with no writes then or
later; the refusal carries `DROP_REFUSAL.reorderBusy` and reason
`rank-change-refused`; the guard is released on the success path; the guard is
released on the failure path; rank-only rollback preserves a concurrent rename
and version; plain rollback still restores the rank.

Verified against both defects. Guard removed (`if (false)`):

```
 × refuses the second gesture instead of interleaving its writes
   → the second reorder must not have written anything:
     expected [ { id: 'c', rank: 1536 }, …(1) ] to deeply equal [ { id: 'c', rank: 1536 } ]
 × tells the user why the second gesture did nothing
   → write-error events: []; toasts: []: expected false to be true
      Tests  2 failed | 4 passed (6)
```

Rollback reverted to whole-snapshot:

```
 × keeps a rename that arrived while the failing write was on the wire
   → the concurrent rename must survive the rollback: expected 'c' to be 'Renamed by someone else'
      Tests  1 failed | 5 passed (6)
```

---

## Item 3 — mutant `CMP-02` (`a.id.localeCompare(b.id)` → `return 0`)

**H-1. KILLED.**

Both fixtures listed their id-tiebreak pairs in id order, so `Array.prototype.sort`'s
stability produced identical output with the tiebreak deleted.

`test/queue-ordering.test.ts`: `f-normal-2b` moved to index 1, `e-normal-2a` to
index 4, with a comment naming the finding and saying not to tidy it back.
`EXPECTED_ORDER` is unchanged.

`src/util/rank.test.ts`: the brief's literal suggestion — list `zz` before `aa`
in the existing `assertMove` fixture — **is not implementable as written**. That
file guards every fixture with `assertSourceIsInDisplayOrder()`, and a band
listed in reverse id order is by definition not in display order, so the change
would fail against *correct* production code. Same intent, different shape: a
separate reversed-order fixture asserts that the precondition guard **throws**.
Correct code rejects it; `return 0` makes the guard accept it. Comment added.

```
$ npx vitest run test/queue-ordering.test.ts
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  test/queue-ordering.test.ts > compareAcceptedQueueOrder — expectation baseline
       > orders the mixed fixture by priority, rank, created-at, then id
AssertionError: expected [ 'B', 'A', 'D', 'C', 'F', 'E', 'G' ]
             to deeply equal [ 'B', 'A', 'D', 'C', 'E', 'F', 'G' ]
 ❯ test/queue-ordering.test.ts:42:20

 FAIL  test/queue-ordering.test.ts > ft-kanban-column — rendered ordering
       > renders cards in accepted-queue order, not input order
AssertionError: expected [ 'B', 'A', 'D', 'C', 'F', 'E', 'G' ]
             to deeply equal [ 'B', 'A', 'D', 'C', 'E', 'F', 'G' ]
 ❯ test/queue-ordering.test.ts:60:22

 FAIL  test/queue-ordering.test.ts > ft-ready-queue-view — rendered ordering
       > renders available rows in accepted-queue order
      Tests  3 failed | 4 passed (7)

$ npm run test:node
▶ .tmp-test/util/rank.test.js
Error: the comparator must order a full rank/created_at tie by id, so a band
       listed in reverse id order is NOT in display order
    at assertTrue (file:///workspace/web/.tmp-test/util/rank.test.js:17:15)
    at run (file:///workspace/web/.tmp-test/util/rank.test.js:325:9)
```

---

## Item 4 — mutant `F3-05` (`composed: true` → `false` in `reportRefusal`)

**H-2. KILLED.**

Every `write-error` test synthesised the event by hand, so `reportRefusal()` —
the code that decides the event's flags — was asserted nowhere.

`test/ft-app.write-error-seam.test.ts` gained a describe block driving a **real
cross-band drop** through a real `ft-app`; `mountAppShowing()` now accepts seed
tasks. Two tests:

1. the `<sl-alert>` the user actually sees carries `DROP_REFUSAL.crossBandToast(...)`
   and is `open`;
2. a listener on `document` — outside the app's shadow root — receives the
   refusal, with `composed === true`, `bubbles === true`, reason
   `rank-change-refused`.

```
$ npx vitest run test/ft-app.write-error-seam.test.ts
 FAIL  ft-app — a real refused gesture reaches the user as a toast
       > lets the refusal escape the shadow boundary to a listener outside the app
AssertionError: the refusal never left the app; is it still composed?:
               expected [] to have a length of 1 but got +0
- Expected
+ Received
- 1
+ 0
 ❯ test/ft-app.write-error-seam.test.ts:239:78
      Tests  1 failed | 11 passed (12)
```

### Discrepancy with the round-3 finding — reported, not papered over

The finding is worded as though `composed: false` breaks toast delivery. It does
not, in the current wiring. `ft-app` binds `@write-error=${this.onWriteError}`
**on the child view element itself** (`ft-app.ts:503/535/555`), so the handler
fires in the at-target phase, where `composed` is irrelevant. I confirmed this
empirically: under `F3-05` the end-to-end **toast test passes**; only the
`document`-listener test fails.

So `F3-05` is a latent contract break, not a live user-visible one. `composed`
is part of the event's published contract (`ft-kanban-view.contract.test.ts`
pins its twin) and becomes load-bearing the moment anyone listens above the app
or wraps the view in another component — but a test claiming the toast dies
without it would be asserting something false. Both tests are kept and the split
is documented in the file, so the next reader gets the accurate model.

---

## Item 5 — vocabulary anchor "only place" claim

**M-2. Fixed.**

`test/ft-app.write-error-seam.test.ts:120,124,196` shadowed
`DROP_REFUSAL.readOnlyQueue` and `.crossBandToast` with literals; the 196 copy
was already truncated to the bare first sentence, pinning a string no view
emits, and the 120/124 pair was tautological — the test dispatched a string and
asserted the same string. All three now bind the constant, each with a comment
explaining what the literal was hiding.

The anchor's "only place" claim is now true for `DROP_REFUSAL`, and the new
completeness test in `vocabulary.contract.test.ts` keeps it true.

---

## Item 6 — mutant `RANK-09` (tail safe-integer guard removed)

**M-3. KILLED.**

Two enumerated boundary cases in `src/util/rank.test.ts`, one either side of the
guard:

- tail neighbour at `Number.MAX_SAFE_INTEGER` — `MAX_SAFE_INTEGER + RANK_STEP`
  is not representable, so the move must fall back to a renumber:
  `[{ b: 1024 }, { a: 2048 }]`;
- tail neighbour at `MAX_SAFE_INTEGER - RANK_STEP` — the last input for which
  the increment *is* safe, so the single write `[{ a: MAX_SAFE_INTEGER }]` must
  still be produced. Without it, "always renumber" would also pass.

```
$ npm run test:node
▶ .tmp-test/util/rank.test.js
Error: M-3: tail past MAX_SAFE_INTEGER (rank 9007199254742016 must be a
       positive safe integer): expected true, got false
    at assertEqual (file:///workspace/web/.tmp-test/util/rank.test.js:6:15)
    at assertMove (file:///workspace/web/.tmp-test/util/rank.test.js:100:9)
    at run (file:///workspace/web/.tmp-test/util/rank.test.js:537:24)
```

9007199254742016 is `MAX_SAFE_INTEGER + 1024` after float rounding — the exact
unsafe value the guard exists to reject.

---

## Found but not fixed — please scope

Per the brief: reported, not silently fixed and not silently skipped.

### 1. `'Reordering the queue failed part way through — reload to see the saved order.'` is not in `DROP_REFUSAL`

`ft-ready-queue-view.ts` builds this message inline in the partial-renumber
failure path, and `test/ft-app.write-error-seam.test.ts:231` pins it as a
literal. It is the same class of defect as M-2 — user-facing vocabulary living
outside the anchor, with a test copy free to drift — but it is a *failure*
message rather than a *refusal*, so moving it into `DROP_REFUSAL` would widen
that constant's meaning. Left alone; wanted a scope ruling before renaming or
extending the anchor.

### 2. The oracle/`rankBand` coupling described under item 1

Bound to the production helper as instructed, which by construction removes its
ability to catch a bug inside that helper. Mitigated by the hardcoded-expectation
tests, but worth a reviewer's eye on whether that division of labour is what was
wanted.

### 3. `F3-05`'s reachability, described under item 4

`composed` is currently not load-bearing for toast delivery. If the intent is
that it *should* be — i.e. `ft-app` should listen at its own root rather than
binding per child — that is a production change I did not make.

### 4. `src/util/rank.test.ts` cannot host the brief's literal H-1 change

Explained under item 3. The finding is closed by an equivalent construction, but
the brief's text will not apply verbatim if it is reused.

---

## Explicitly not touched

As scoped out by the brief: F-4, F-6, F-7 and their characterisation tests;
audit MEDIUM-1 (`web/src/util/markdown.ts`); audit LOW-3, INFO-2, INFO-3; test
L-1..L-5; review M-1's attention-view filter/dashboard-tile suggestion. No Go
code was changed. Phase 1 was not touched.
