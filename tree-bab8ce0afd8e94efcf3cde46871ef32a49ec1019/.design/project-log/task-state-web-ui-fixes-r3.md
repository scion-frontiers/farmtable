# Phase 2 Web UI — Round-3 Fix Pass (fixes-r3)

Date: 2026-07-27
Branch: `fixes-r3`
Base: `b393384 Merge tests-r3: round-3 test hardening, 164 -> 351 tests, mutation-verified`
Input brief: `briefs/farmtable-dev-p2-fixes-r3.md`

The round-3 test pass (`tests-r3`) landed characterisation tests that pinned four
real defects as *current behaviour*, on purpose, so that fixing the code would
turn them red. This pass fixes the four defects and rewrites every one of those
characterisation tests to assert the correct behaviour. No characterisation test
was deleted or weakened.

## Commits

| Commit | Scope |
| --- | --- |
| `a24959b` | F-2 — compute reorder ranks over the full band, not the filtered view |
| `ce9ce82` | F-1 — keep `ranksForMove` inside the documented `MIN_RANK` floor |
| `0c868fb` | Item 5 — lift the queue drop-refusal strings into `DROP_REFUSAL` |
| `30ad443` | F-3 — refuse a clientless queue reorder before mutating the store |
| `9f2cf8b` | M-1a — give pointer users the same drop-refusal reason as screen readers |

Test count: 351 (baseline) → **362**. No test removed.

---

## F-2 — reorder under an active filter wrote duplicate ranks

**Finding.** `ft-ready-queue-view.ts:388` built the rank band from
`getReadyTasks()`, which applies the view's filters. Rank arithmetic run over a
*filtered* band cannot see the neighbours the filter hid, so a computed midpoint
could land exactly on a hidden task's rank (a duplicate) or on the wrong side of
one. Both persist silently: the write succeeds, and the queue is only visibly
wrong once the filter is cleared.

**Change.** New private `bandFor(task)` on the view returns every task in the
same rank scope — same `collectionId`, same priority band, queue-eligible —
sorted by the real `compareAcceptedQueueOrder`, with the view filters ignored
entirely. `reorder()` uses that band, and resolves the *visible* drop target to
its index in the full band:

```ts
const band = this.bandFor(dragged);
const targetIndex = band.findIndex((task) => task.id === targetTaskId);
if (targetIndex === -1) return;
```

A filter decides what is *drawn*, never what the arithmetic is computed over.
Contract §4.6 scopes rank to (collection, priority band) and says nothing about
what the viewer happens to be looking at.

**Why this preserves the drop.** Resolving the visible target to its full-band
index gives the same relative-to-target placement as the old visible-band
computation in both drag directions (upward: the dragged row lands immediately
before the target; downward: immediately after). The visible outcome of a drop
is unchanged; only the arithmetic's inputs changed. Verified concretely on the
fixture: full band `[a(1024), h(1536), b(2048), c(3072)]`, filter hides `h`,
drag `c` onto `b` → target index 2 in the full band → `midpoint(1536, 2048)` =
1792 → `h` keeps its position, visible rows are `['a','c','b']`.

**The wrong fix that looks right.** Using the full band for the arithmetic but
the *visible* target index also produces a distinct rank (1280 on this fixture),
so a duplicate-rank assertion passes — but it moves the hidden neighbour. That
variant was run as mutation M2 below and is killed by the ordering assertion,
not by the duplicate one. Disabling drag under a filter, or de-duplicating ranks
after the write, were both explicitly rejected: the input to the arithmetic is
what was wrong.

**Tests.** `ft-ready-queue-view.rank-adversarial.test.ts` now has four F-2 tests:
no duplicate rank when a filtered-out neighbour sits in the gap; the hidden
neighbour keeps its relative position *and* the drop is honoured (asserts both
the full-band order `['a','h','c','b']` and the visible order `['a','c','b']`);
the same ranks are written with and without the filter; and a same-band task in
*another collection* is ignored by the midpoint.

**Killing mutations.**

M1 — revert the band to the filtered view (`this.getReadyTasks()`):

```
 × writes no duplicate rank when a filtered-out neighbour sits in the gap
   → ranks are [["a",1024],["c",1536],["h",1536],["b",2048]]: expected 3 to be 4
 × keeps a hidden neighbour in its relative position and honours the drop
   → expected [ 'a', 'c', 'h', 'b' ] to deeply equal [ 'a', 'h', 'c', 'b' ]
 × writes exactly the same ranks whether or not the filter hides the neighbour
   → expected [ { id: 'c', rank: 1536 } ] to deeply equal [ { id: 'c', rank: 1792 } ]
```

M2 — full band, but the target index taken from the *visible* list:

```
 × keeps a hidden neighbour in its relative position and honours the drop
   → expected [ 'a', 'c', 'h', 'b' ] to deeply equal [ 'a', 'h', 'c', 'b' ]
 × writes exactly the same ranks whether or not the filter hides the neighbour
   → expected [ { id: 'c', rank: 1280 } ] to deeply equal [ { id: 'c', rank: 1792 } ]
```

M3 — drop the `collectionId` check from `bandFor`:

```
 × ignores a same-band task from another collection when computing the midpoint
   → expected [ { id: 'c', rank: 1792 } ] to deeply equal [ { id: 'c', rank: 1536 } ]
```

---

## F-1 — `ranksForMove` could emit a rank below `MIN_RANK`

**Finding.** `singleWrite` guarded its anchors with `Number.isSafeInteger` alone.
Zero and negatives are safe integers, so a hostile band read back from the
server — e.g. `[-5, 0, 5]` — sailed past the guard and the interior-midpoint
branch handed out `-3`, below the floor the module documents.

**Change.** `MIN_RANK` is now exported, and a new predicate replaces the bare
safe-integer test:

```ts
function isUsableRank(rank: number | undefined): rank is number {
  return Number.isSafeInteger(rank) && (rank as number) >= MIN_RANK;
}
```

An out-of-range rank is now treated exactly like a float or a NaN: not a usable
anchor, so the whole band falls through to `renumber()` and comes back inside
the invariant. The fix is at the *guard*, not in the arithmetic: with every
anchor `>= MIN_RANK`, the interior midpoint is provably `> before >= MIN_RANK`,
so an extra floor clamp in `midpoint()` would be unreachable dead code. The
precondition is documented on `midpoint()` instead.

**Ordering was not regressed.** The old emitted `-3` was in the *right position*
— the bug was the range, not the order. The rewritten test asserts both: every
written and every stored rank is `>= MIN_RANK`, *and* `rowIds(view)` is still
`['a','c','b']`.

**Tests.** The `rank.test.ts` characterisation block became three blocks: a
negative band renumbers (with the ordering assertion retained), a zero at the
head renumbers, and a `MIN_RANK`-anchored positive control that must still be a
*single* midpoint write. The component-level test in
`ft-ready-queue-view.rank-adversarial.test.ts` was rewritten the same way.
Zero/negative cases were deliberately given their own in-display-order fixtures
rather than being added to the existing `hostile` loop — a `rank: 0` in a middle
position would violate that loop's documented comparator-order precondition and
would have been testing an impossible input.

**Killing mutations.**

MA — drop the range half of `isUsableRank` (mutating the body, not the call
site, so `noUnusedLocals` does not fail the compile first):

```
Error: F-1: negative-ranked band (rank -3 must be a positive safe integer): expected true, got false
```

MB — off-by-one low (`>= MIN_RANK - 1`, i.e. zero becomes usable):

```
Error: F-1: a zero rank must renumber, got [{"id":"c","rank":1024}]
```

MC — off-by-one high (`>= MIN_RANK + 1`, i.e. over-eager renumbering):

```
Error: MIN_RANK is a usable anchor, so this is still a single midpoint write:
  expected [{"id":"c","rank":1024}],
  got [{"id":"a","rank":1024},{"id":"c","rank":2048},{"id":"b","rank":3072}]
```

---

## F-3 — a clientless reorder was a silent fake success

**Finding.** The no-client guard sat *after* the optimistic store write and did
nothing but `console.warn`. A reorder with no client moved the row, left the
store holding ranks the server had never seen, and told the user nothing.

**Change.** The guard moved ahead of the optimistic write and now reports a
refusal on the same seam as every other refusal in this view:

```ts
const writes = ranksForMove(band, draggedId, targetIndex);
if (writes.length === 0) return;

if (!this.client) {
  this.reportRefusal(DROP_REFUSAL.reorderNotConnected);
  return;
}
```

`ft-app` always assigns a client, so this is a defensive path rather than a live
one — but a reorder that cannot be saved must refuse out loud.

**Tests.** The single characterisation test became two, sharing a
`mountClientlessQueue()` helper: one asserts the store and the visible order are
untouched (`c` still at rank 3072, rows `['a','b','c']`), the other asserts the
user is told (a `write-error` with reason `rank-change-refused` whose message is
exactly `DROP_REFUSAL.reorderNotConnected`). Splitting them means a fix that
silences the mutation but re-introduces the store write is still caught.

**Killing mutations.**

MD — put the guard back after the optimistic write:

```
 × leaves the store and the visible order untouched (finding F-3)
   → expected 1536 to be 3072
```

ME — bail early, but `console.warn` instead of reporting:

```
 × tells the user the order was not saved (finding F-3)
   → write-error events: []; toasts: []: expected false to be true
```

---

## M-1a — the pointer tooltip disagreed with the accessible description

**Finding.** In `ft-kanban-column.ts`, `aria-description` was bound to
`dropHint`, which covers all three drop-refusal causes, while `title` was bound
to a separate `dropTooltip` getter gated on `acceptsStageDrop(this.stage)`
*alone*. On a read-only board or a collection that cannot change stage, a screen
reader user got a reason and a pointer user got nothing.

**Change.** The `dropTooltip` getter is deleted; both attributes now come from
`dropHint`, still `|| nothing`-gated so an accepting lane carries neither
attribute (an empty `aria-description` is worse than none — it can suppress the
fallback a screen reader would otherwise announce).

**Tests.** The two hand-named characterisation tests were folded into the
existing three-case `refusing` table loop as two more assertions per case, so
all three refusal causes are now covered on both channels and a fourth cause
cannot be added to one channel only.

**Killing mutations.**

MF — restore the `acceptsStageDrop`-only gate on `title`: **4 failed | 22 passed**

```
 × explains the refusal in the pointer tooltip too when the board is read-only
   → expected null to be 'This board is read-only — stage chang…'
 × explains the refusal in the pointer tooltip too when the collection cannot change stage
   → expected null to be 'This collection does not support stag…'
 (+ the two matching "says exactly the same thing in both channels" cases)
```

MG — remove the `|| nothing` gating (`title=${dropHint}`): **1 failed | 25 passed**

```
 × omits the tooltip and accessible description entirely on an accepting lane
   → expected true to be false
```

---

## Item 5 — the queue refusal strings are now in `DROP_REFUSAL`

Four entries added: `readOnlyQueue`, `reorderUnsupported`, `crossBandToast(name,
bandLabel)` and `reorderNotConnected`. `ft-ready-queue-view.ts` uses the
constants, and the three loose `toContain` assertions in
`ft-ready-queue-view.rank.test.ts` became exact equality against them, so the
seam test binds to production on both sides.

**One structural change worth flagging.** The brief names
`web/test/vocabulary.contract.test.ts` as the single place a user-visible
literal may live, but the `DROP_REFUSAL` wording was actually anchored in a
`describe` block at the bottom of
`ft-kanban.drop-refusal-affordances.test.ts`. Rather than create a *second*
anchor site, that block was moved verbatim into `vocabulary.contract.test.ts`
and the four new queue literals were appended to it. This is a move, not a
weakening: every assertion that existed still exists, in one file, and the repo
now matches the invariant the brief states.

**Killing mutations.**

M1 — swap `readOnlyQueue` for `readOnlyBoard` at the queue call site:

```
 × Expected: "This queue is read-only — the order is not saved."
   Received: "This board is read-only — stage changes are not saved."
```

M2 — reword `reorderUnsupported` in production: **2 failed | 43 passed** — the
binding test and the vocabulary anchor both fire, which is the point of having
the two layers.

---

## Verification

Run from `/workspace/web` on `9f2cf8b`:

| Gate | Result |
| --- | --- |
| `npm test` | **362 passed (362)**, 20 files |
| `npx tsc --noEmit` | clean |
| `npx tsc -p tsconfig.test.json --noEmit` | clean |
| `npm run build` | ✓ built in 2.61s |
| `find dist -name '*.map' \| wc -l` | **0** |
| `npm audit --audit-level=low` | found 0 vulnerabilities |

---

## Not done, and why

**F-4 — dead `neutral` branch / missing hold indicator.** Out of scope per the
brief. Its characterisation test is left pinning current behaviour, unchanged.

**F-6 — `isReady()` consults server availability before stage.** Out of scope
per the brief. Characterisation test left as-is. Note that `bandFor()` (F-2)
calls `isReady()`, so it inherits whatever F-6 decides; the band is defined as
"queue-eligible" by the same predicate the view already uses to draw rows, so
fixing F-6 later moves both together and needs no change here.

**F-7 — `BOARD_COLUMNS` hardcodes lane labels.** Out of scope per the brief.
Characterisation test left as-is.

**No floor clamp inside `midpoint()`.** Deliberate. With `isUsableRank`
enforcing the floor on every anchor, an interior midpoint cannot fall below
`MIN_RANK`, so a clamp would be unreachable and untestable. The precondition is
documented on `midpoint()` instead of being defended twice.

**Zero/negative ranks not added to the `hostile` fixture loop in
`rank.test.ts`.** That loop's fixtures must be in comparator display order; a
`rank: 0` in a middle slot would sort to the head and violate the precondition,
so the case would have been testing an input the function is never handed. The
out-of-range cases got their own correctly-ordered fixtures instead.

## Found but not fixed — needs scoping

**Possible fifth defect: a cross-*collection* drop is now a silent no-op.**
`reorder()` contains `if (targetIndex === -1) return;`. Before F-2 that branch
was effectively unreachable, because the target row was by definition in the
visible band the index was computed over. Now the index is resolved against
`bandFor(dragged)`, which is filtered to `dragged.collectionId` — so a drop
whose target lives in a *different* collection returns silently, mutating
nothing and saying nothing. That is the same bug class as F-3.

It is not reachable in the current UI: the store holds one collection at a time,
so no such target can be rendered. Per the brief's instruction to report a fifth
defect rather than silently fix or skip it, it is reported here and left for the
manager to scope. Fixing it would mean either a `reportRefusal` on that branch
or an explicit assertion that the case cannot occur.

## Process note

Partway through the item-5 mutation runs I restored two production files with
`git checkout` while their changes were still **uncommitted**, which reverted
them to `HEAD` and wiped the `DROP_REFUSAL` extension and the queue call-site
rewrite. Detected immediately (`git status --short` showed only test files
modified; `git stash list` was empty), and both edits were re-applied by hand
and re-verified with both `tsc` configs and the full suite before committing.
No work is missing from the final tree. For the remainder of the pass, mutation
backups were taken with `cp` to `/tmp` and restored with `cp`.
