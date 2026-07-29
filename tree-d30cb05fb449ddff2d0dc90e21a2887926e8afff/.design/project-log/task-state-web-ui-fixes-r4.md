# Phase 2 Web UI — Round-4 Fix Pass (fixes-r4)

Date: 2026-07-27
Branch: `fixes-r4`
Base: `49e55e9 Merge fixes-r3: close F-1/F-2/F-3/M-1a from the round-3 test pass`
Input: `briefs/farmtable-dev-p2-fixes-r4.md` (six round-3 review findings)
Full report: `reports/dev-p2-fixes-r4.md`

TypeScript/Lit only. No Go changes. Phase 1 untouched.

## Commits

| Commit | Scope |
| --- | --- |
| `3ff4ccd` | I-1/MEDIUM-2 rank scope, H-1 id tiebreak, M-2 vocabulary shadows, M-3 boundary |
| `07f5392` | H-2 refusal delivery, M-1 oracle |
| `3785de3` | I-2/LOW-4 concurrency tests |

## Gate

`npm test` 382 passed (21 vitest files + 4 Node scripts) · `npx tsc --noEmit`
clean · `npx tsc -p tsconfig.test.json --noEmit` clean · `npm run build` ok ·
`find dist -name '*.map' | wc -l` → 0 · `npm audit --audit-level=low` → 0
vulnerabilities.

Test count 362 → 382. Nothing weakened or deleted.

---

## I-1 / MEDIUM-2 — availability must not scope rank arithmetic

`bandFor()` filtered the band through `isReady()`, so a task the server
currently hides — held, dependency-blocked, future start — was invisible to the
midpoint calculation while still holding a live rank. It re-enters the queue
with that rank the moment the hold lifts, and the midpoint computed without it
collides.

The derivation moved to `rankBand()` in `src/util/task-state-utils.ts` and now
keys on **stage**: terminal tasks never come back, so their ranks are dead and
counting them only forces renumbers that buy nothing. Mirrors the server's
`store.IsTerminalStage` (PR #191); contract §4.6 scopes rank to
(collection, priority band). The docstring now enumerates all three ways a task
can be off screen — view filter, availability, stage — and says which of them
may affect rank scope (only the third).

**Deviation from the brief.** The predicate is
`(!isClosedStage(candidate.stage) || isQueueMember(candidate))`, not the plain
`!isClosedStage(...)` the brief specified. `isReady()` lets server availability
outrank stage, so a COMPLETED-but-available task **is rendered and is
draggable** (pinned by an existing characterisation test). Under the strict
predicate that visible row is not in its own band, `findIndex` returns `-1`, and
the drop becomes a silent no-op — the exact failure class rounds 2 and 3
eliminated. The union clause keeps the invariant *on screen ⇒ in the band*.

Seven new tests in `test/ft-ready-queue-view.rank-adversarial.test.ts` cover
each hiding cause with a no-duplicate-rank and a relative-position assertion,
plus "same ranks whether or not the server hides the neighbour". All seven fail
against the old predicate.

## M-1 — self-built oracle

"The view and the rank module agree" rebuilt the band from the rendered rows and
was therefore asserting the I-1 defect. It now derives band and target index
from `rankBand` + `isReady`, and gained a scenario whose middle task the server
hides so the two lists actually differ. Trade-off recorded in the report: bound
to the production helper, the block can no longer catch a bug inside that
helper; the hardcoded-expectation tests above cover that half.

## I-2 / LOW-4 — overlapping reorders

New `reorderInFlight` flag, set before the write loop and cleared in a `finally`.
A second drop mid-flight is refused with the new `DROP_REFUSAL.reorderBusy`
rather than raced.

Rollback narrowed from whole-`Task` to **`rank` only**, merged onto current
store state. The writes are awaited, so a watch event can land mid-flight;
re-upserting the pre-drag snapshot would revert a concurrent rename or stage
change the view never touched, and the stale `version` it restores would fail
the next optimistic write. New file
`test/ft-ready-queue-view.concurrent-reorder.test.ts` (6 tests) pins both.

## H-1 / H-2 / M-3 — surviving mutants, now killed

- **CMP-02** (`a.id.localeCompare(b.id)` → `0`): both id-tiebreak fixtures
  listed their pair in id order, so sort stability hid the deletion. Reversed in
  `test/queue-ordering.test.ts`; in `src/util/rank.test.ts` the brief's literal
  suggestion conflicts with that file's `assertSourceIsInDisplayOrder`
  precondition, so an equivalent reversed fixture asserts the guard *throws*.
- **F3-05** (`composed: true` → `false`): refusals were only ever asserted at
  dispatch. A real cross-band drop now runs through a real `ft-app`, asserting
  the visible toast and — from a `document` listener outside the shadow root —
  that the event escapes with `composed === true`.
- **RANK-09** (tail safe-integer guard): enumerated cases at
  `MAX_SAFE_INTEGER` (must renumber) and `MAX_SAFE_INTEGER - RANK_STEP` (must
  still write a single rank).

## M-2 — vocabulary anchor

Three literals in `test/ft-app.write-error-seam.test.ts` shadowed
`DROP_REFUSAL.readOnlyQueue` / `.crossBandToast`; one had already drifted into a
truncated string no view emits. All bind the constant now, and a new
completeness test pins every one of the nine `DROP_REFUSAL` keys.

---

## Not done, and why

**Scoped out by the brief, left alone deliberately:** F-4, F-6, F-7 and their
characterisation tests; audit MEDIUM-1 (`web/src/util/markdown.ts`); audit
LOW-3, INFO-2, INFO-3; test L-1..L-5; review M-1's attention-view filter and
dashboard tile.

**Found in this pass, reported rather than fixed** (awaiting a scope ruling —
detail in the report):

1. `'Reordering the queue failed part way through — reload to see the saved
   order.'` is built inline in `ft-ready-queue-view.ts` and copied as a literal
   in the seam test. Same class as M-2, but it is a failure message rather than
   a refusal, so folding it into `DROP_REFUSAL` would widen that constant's
   meaning.
2. The M-1 oracle's coupling to `rankBand`, described above.
3. `F3-05` is a latent contract break, not a live one: `ft-app` binds
   `@write-error` on the child element itself, so the handler fires at-target
   and the toast still appears under the mutant (verified). The `composed` flag
   only matters at a shadow boundary. Whether `ft-app` *should* listen at its
   own root instead is a production change not made here.
4. The brief's literal H-1 instruction for `src/util/rank.test.ts` is not
   implementable as written; the finding is closed by an equivalent
   construction.
