# Test Review (Round 3): Farm Table Phase 2 Web UI — Task State Contract

**Verdict: APPROVE WITH FINDINGS** — merge is not blocked, but two High findings should be
closed before this suite is treated as the regression net for rank/refusal behaviour.

Branch: `task-state-web-ui-v2` @ `49e55e9`
Base: `origin/main` — `git diff origin/main...HEAD` = 69 files, +12233/-378
Review time: 2026-07-27T16:55–17:35Z
Reviewer role: test-engineer (independent; no coordination with the code reviewer or security auditor)

> **Workspace note:** the brief specified `/workspace/farmtable-test-p2-r3`, which does not
> exist. I reviewed `/workspace`, which is on `task-state-web-ui-v2` @ `49e55e9` — the stated
> commit. All mutation work was done in a throwaway `git worktree` at `/tmp/ft-mut3`. Both the
> main workspace and the worktree's `web/src` and `web/test` are byte-identical to `49e55e9`
> after the review; **nothing was modified or committed.**

---

## Executive summary

The round-3 hardening is real work. Every vacuity probe I fired was killed, the vocabulary
anchor behaves almost exactly as advertised, the drag-and-drop sequence seam is genuinely
closed, and 40,000 randomised `ranksForMove` trials found **zero** production invariant
violations. The four rewritten characterisation tests all assert the new behaviour; none was
weakened to pass.

I ran **43 mutants; 35 killed (81%); 8 survived.** The eight survivors are not evenly
distributed — they cluster on exactly the seams the brief disclosed, which is the useful
result:

> **H-1. The `id` tiebreak of `compareAcceptedQueueOrder` has two tests that both pass with
> the tiebreak deleted.** Both fixtures list their tie-participants in an order that already
> matches the id order, and `Array.prototype.sort` is stable, so the tiebreak never decides
> anything. This is a *thirteenth* instance of the seam-1 defect class — and it is in the
> tiebreak specifically, which is where the original self-built oracle diverged. **A one-line
> fixture swap turns the surviving mutant into three failing tests.**
>
> **H-2. Every `ft-ready-queue-view` refusal — including the just-fixed F-3 — is asserted only
> at the point of dispatch, never at the point of delivery.** I set `composed: false` on the
> queue's `write-error` event, which stops it at the shadow boundary so `ft-app` never toasts
> it, and all 362 tests stayed green. The kanban twin has this assertion; the queue does not.
> This is structurally the *same* split-halves defect as the round-1 `dragover`/`drop` bug that
> seam 2 exists to prevent — fixed for drag-and-drop, still open for refusal delivery.

Also of note: **seam 3 is genuinely open, and I can prove it is not an equivalent-mutant
problem.** Removing the tail-of-band safe-integer guard survives the whole suite, and my fuzz
harness then produces 2,835 invariant violations out of 28,992 moves. No enumerated case goes
near `MAX_SAFE_INTEGER`.

The thirteenth self-built oracle the brief told me to assume exists: **found, and it is a
different one from H-1** — see M-1.

---

## Harness correction (methodology note the brief should absorb)

My first mutation pass scored 26/43 with 17 survivors, nearly all in `rank.ts`. That was **my
harness's fault, not the suite's.** `web/vitest.config.ts` sets `include: ['test/**/*.test.ts']`,
so `npx vitest run` never executes the 643-line `src/util/rank.test.ts`, `src/util/task-state-utils.test.ts`,
or `src/utils/task-ready.test.ts` — those run under `scripts/run-node-tests.mjs` via
`npm run test:node`. Re-running the survivors under the full `npm test` killed 9 more.

**All numbers in this report are from the full `npm test`.** Flagging it because the split is
an easy trap: `npm run test:components` alone gives *zero* coverage of the rank arithmetic, and
any CI job or future reviewer that runs only Vitest will believe otherwise. See L-4.

Baseline reproduced in the worktree before mutating:
```
$ cd /tmp/ft-mut3/web && npx vitest run
 Test Files  20 passed (20)
      Tests  362 passed (362)
   Duration  2.84s
```

---

## Mutation testing results

Method: apply one source mutation, run `npm test` (Node scripts + Vitest), revert. Mutant
definitions and harness are reproducible at `/tmp/ft-mut3/mutants.json` and `/tmp/ft-mut3/mutate.mjs`.

**43 valid mutants · 35 killed · 8 survived · 0 malformed · score 81%.**

| Area | Mutants | Killed | Survived |
|---|---|---|---|
| F-3 clientless reorder | 5 | 4 | 1 (`F3-05`) |
| M-1a pointer refusal | 7 | 6 | 1 (`M1a-07`) |
| `rank.ts` arithmetic | 15 | 11 | 4 (`RANK-09/11/12/13`) |
| `compareAcceptedQueueOrder` | 5 | 4 | 1 (`CMP-02`) |
| Vocabulary anchor | 6 | 6 | 0 |
| Vacuity probes | 2 | 2 | 0 |
| DnD sequence | 3 | 2 | 1 (`DND-03`) |

### Representative kills — evidence the suite is real

```
KILLED  F3-01  move the clientless guard back AFTER the optimistic store write
KILLED  F3-02  guard bails early but silently (revert to console.warn)
KILLED  F3-03  refuse with the wrong reason string (readOnlyQueue)
KILLED  F3-04  refuse on the wrong channel (reason 'rank-change-failed')
KILLED  M1a-01 revert to no tooltip at all
KILLED  M1a-02 restore the OLD gating exactly (terminal lanes only)
KILLED  M1a-03 drop the `nothing` gating (title="" on accepting lanes)
KILLED  M1a-04 channels disagree — title gets a generic string
KILLED  RANK-01 remove the MIN_RANK floor from isUsableRank
KILLED  RANK-15 MIN_RANK 1 -> 0
KILLED  RANK-10 splice at the wrong index (result order != dropped order)
KILLED  CMP-03  unranked tasks sort FIRST instead of last
```

**The four rewritten characterisation tests are not weakened.** `F3-01` is the decisive one: I
restored the *exact* original bug ordering (guard after the optimistic write) while keeping the
refusal, and the split-test design caught it — precisely the failure signal the commit message
said the split was for. `M1a-02` restores the old `dropTooltip` gating verbatim and dies on the
read-only and capability cases. F-1 and F-2 I re-confirmed independently (`RANK-01`, `RANK-15`).

### Vacuity — both probes killed decisively

```
KILLED  VAC-01  ft-ready-queue-view.render() returns null   -> 50 of 362 tests fail
KILLED  VAC-02  ft-kanban-column.render() returns null      -> 54 of 362 tests fail
```
No absence-assertion survives a dead render in either component. Seam 4 is closed for these two.

### Vocabulary anchor — seam 5 behaves as designed

Rewording each `DROP_REFUSAL` constant fails **exactly one** test, in `vocabulary.contract.test.ts`,
and nothing else:

```
VOCAB-01 readOnlyQueue        -> 1 failed / 361 passed  (states the read-only reason in queue terms)
VOCAB-02 reorderNotConnected  -> 1 failed / 361 passed  (says the order was not saved when there is no client)
VOCAB-03 readOnlyBoard        -> 1 failed / 361 passed  (states the read-only reason and what it means)
VOCAB-04 crossBandToast       -> 1 failed / 361 passed  (names the task and the destination band)
VOCAB-06 reorderUnsupported   -> 1 failed / 361 passed  (states the unsupported-reorder reason)
VOCAB-05 curly-apostrophe drift in STAGE_LABEL[WONT_FIX] -> 4 failed
```
The design goal — "rewording a constant fails exactly one test rather than none" — **holds.**
`VOCAB-05` failing four is correct and desirable: it is the exact drift class the file was
created to catch, and it is caught. The one caveat is M-2 below: the *claim* that this is the
only file with these literals is false.

### Seam 2 (drag-and-drop sequence) — genuinely closed

```
KILLED  DND-01  queue row dragover stops calling preventDefault  -> killed
KILLED  DND-02  kanban lane bails before preventDefault on refusing lanes (the round-1 bug) -> 11 tests fail
```
`test/helpers/dom.ts:191` — `dragTaskOnto()` returns `false` unless `dragOverOn().defaultPrevented`,
then fires the drop. The combined sequence is exercised at
`ft-kanban-view.contract.test.ts:396,416,428` and `ft-ready-queue-view.rank-adversarial.test.ts:95,112,129`.
Reintroducing the round-1 bug kills 11 tests. **Verified closed.**

---

## Findings

### H-1 (High) — the `id` tiebreak is asserted twice and pinned by neither

**Mutant:** `CMP-02` — `src/util/task-state-utils.ts:183`, `return a.id.localeCompare(b.id);`
→ `return 0;`

**Result: SURVIVED — 362/362 passed.**

Two tests claim to cover this tiebreak:

- `test/queue-ordering.test.ts:18,21` — fixture comment: *"two tasks separated only by id"*.
- `src/util/rank.test.ts:378-383` — comment: *"the comparator's last resort is `id`"*.

Both are defeated by sort stability. In each fixture the tie-participants are already listed in
id order (`e-normal-2a` at index 1 before `f-normal-2b` at index 4; `aa` before `zz`), and
`Array.prototype.sort` is stable, so a comparator returning `0` reproduces the same output as
one returning `-1`. The assertion cannot distinguish them.

This matters more than a generic gap: the brief identifies the tiebreak as **exactly where the
original self-built oracle diverged** ("source index vs createdAt then id"). The oracle was
rebound to production, but the test that is supposed to hold the tiebreak still cannot see it.

**Reproduction — and the fix, proven:**
```bash
cd /tmp/ft-mut3/web
perl -0pi -e "s/  return a\.id\.localeCompare\(b\.id\);/  return 0;/" src/util/task-state-utils.ts
npx vitest run test/queue-ordering.test.ts
#   ✓ test/queue-ordering.test.ts (7 tests)      <-- mutant survives

# swap the two id-tie participants so array order != id order
perl -0pi -e "s/(task\(\{ id: 'e-normal-2a'.*?\n)(.*?)(task\(\{ id: 'f-normal-2b'.*?\n)/\3\2\1/s" test/queue-ordering.test.ts
npx vitest run test/queue-ordering.test.ts
```
```
× compareAcceptedQueueOrder — expectation baseline > orders the mixed fixture by priority, rank, created-at, then id
  → expected [ 'B', 'A', 'D', 'C', 'F', 'E', 'G' ] to deeply equal [ 'B', 'A', 'D', 'C', 'E', 'F', 'G' ]
× ft-kanban-column — rendered ordering > renders cards in accepted-queue order, not input order
× ft-ready-queue-view — rendered ordering > renders available rows in accepted-queue order
```

**Root cause:** a stable-sort fixture that encodes the expected output in its input order.
**Recommended fix:** in `test/queue-ordering.test.ts` list `f-normal-2b` before `e-normal-2a`;
in `src/util/rank.test.ts:379-382` list `zz` before `aa`. Two lines, and the mutant dies three
times over. A comment noting *why* the order is deliberately adversarial would stop it
regressing.

---

### H-2 (High) — queue refusals are asserted at dispatch, never at delivery

**Mutant:** `F3-05` — `src/components/ready-queue/ft-ready-queue-view.ts`, `reportRefusal()`,
`composed: true` → `composed: false`.

**Result: SURVIVED — 362/362 passed.**

With `composed: false` the `write-error` event does not cross the shadow boundary, `ft-app`
never receives it, and **no toast reaches the user** for any queue refusal: `readOnlyQueue`,
`reorderUnsupported`, `crossBandToast`, and the newly-added `reorderNotConnected`. The user
gets a row that snaps back with no explanation — the exact silent-no-op class this workstream
exists to eliminate.

**Why the suite cannot see it.** `test/helpers/feedback.ts:29` attaches its listener to the
target it is handed, and every queue test calls `collectFeedback(view)` — the very element that
dispatches. The listener fires whether or not the event is `composed`, because it never needs
to escape. The kanban side does not have this hole:

```ts
// test/ft-kanban-view.contract.test.ts:190,197 — listener on document.body, outside the boundary
document.body.addEventListener('write-error', (e) => events.push(e as CustomEvent));
expect(events[0].composed).toBe(true);
```
`grep -rn "composed" test/*.test.ts | grep expect` returns five sites; **none is the queue.**

`test/ft-app.write-error-seam.test.ts` does test `ft-app`'s half — but it dispatches *synthetic*
events, so the two halves are verified separately and never joined. That is structurally
identical to the round-1 `dragover`/`drop` defect: each half covered, the sequence never
exercised. Seam 2 was closed for drag-and-drop; the same shape is still open one layer up.

**Reproduction:**
```bash
cd /tmp/ft-mut3/web
# in reportRefusal(), change composed: true -> composed: false
npm test   # 362 passed
```
**Recommended fix:** one test per view that attaches to `document.body` and asserts
`composed === true` on a real refusal — mirroring `ft-kanban-view.contract.test.ts:183-197`.
Better still, an end-to-end test that mounts `ft-app`, triggers a *real* queue refusal, and
asserts a toast appears; that would close the split and subsume the dispatch-side assertions.

---

### M-1 (Medium) — the thirteenth self-built oracle: a hand-rolled `bandFor()`

`test/ft-ready-queue-view.rank-adversarial.test.ts:542-563`. The block's docstring claims it
"binds the component's writes to `ranksForMove` itself rather than to a transcription". It does
import the real `ranksForMove` — but feeds it a **locally reconstructed band**:

```ts
const visible = rowIds(view);                        // rendered rows = FILTERED
const expected = ranksForMove(
  visible.map((id) => store.getTask(id)!),           // local band reconstruction
  scenario.moved,
  visible.indexOf(scenario.onto),                    // local target-index resolution
);
```

Production (`ft-ready-queue-view.ts:296-305, 417-421`) uses `bandFor()`, which filters on
`collectionId`, filters on `priorityRank`, and **deliberately ignores view filters**. The test's
private oracle reproduces none of those three. Three concrete divergences:

1. **Filter scope is inverted** — `rowIds(view)` reads the *filtered* rows. `bandFor()` ignores
   filters. That is precisely finding **F-2**, fixed in `a24959b`. The oracle still encodes the
   **pre-fix, buggy** definition of "the band".
2. **No priority-band scoping** — the queue renders all bands; add a task of another priority to
   any scenario and the oracle silently goes wrong.
3. **No collection scoping** — the sibling test at lines 397-420 exists because that scoping is
   load-bearing, and it uses a hardcoded expectation instead.

They agree today only because all three scenarios are single-collection, single-priority,
unfiltered and fully visible. What the test actually pins is
`ranksForMove(reconstructed_band) === view_writes`, and the reconstruction is the part most
likely to be wrong. **Severity is Medium, not High, because it is currently correct** — but it
re-encodes a just-fixed bug in a test that advertises itself as the binding to production.

**Recommended fix:** derive the band the way production does, or fall back to the hardcoded
expectations the rest of the file uses (which are honest about being literals).

---

### M-2 (Medium) — the vocabulary anchor's "only place" claim is false, and one copy has already drifted

`test/vocabulary.contract.test.ts:23` states it is *"the ONLY place these strings appear as
literals"*. It is not:

| Site | Literal | Shadows |
|---|---|---|
| `test/ft-app.write-error-seam.test.ts:120,124` | `'This queue is read-only — the order is not saved.'` | `DROP_REFUSAL.readOnlyQueue` |
| `test/ft-app.write-error-seam.test.ts:196` | `'Drag reordering works within one priority band.'` | `DROP_REFUSAL.crossBandToast` — **truncated; no view emits this string** |

`DROP_REFUSAL` is already imported in that file, and the immediately preceding test (line 109)
correctly uses `DROP_REFUSAL.readOnlyBoard`. The queue twin was missed when `0c868fb` lifted the
queue strings into `DROP_REFUSAL`.

These are tautological rather than divergent — the test dispatches the literal and asserts the
same literal, so they cannot go red. **That is the failure mode.** Line 196 is already a
truncated transcription, which is the identical bug the file's own comment at 178-182 says was
fixed for `terminalLaneToast` one array element above it. The fix for the sibling did not reach
the sibling.

**Recommended fix:** use `DROP_REFUSAL.readOnlyQueue` and `DROP_REFUSAL.crossBandToast(...)` at
those three sites; where an arbitrary payload is genuinely wanted, use an obviously-synthetic
string like the `'refusal text'` already used at line 131.

---

### M-3 (Medium) — seam 3 is open: no enumerated case reaches the safe-integer boundary

**Mutant:** `RANK-09` — `src/util/rank.ts`, tail-of-band branch,
`return Number.isSafeInteger(candidate) ? candidate : null;` → `return candidate;`

**Result: SURVIVED — 362/362 passed.**

I built a property harness (`/tmp/ft-mut3/fuzz.mjs`) over the four invariants the brief names —
result order equals dropped order, no duplicate ranks, ranks are safe integers ≥ 1, plus
read-back through the *real* comparator — and ran 40,000 randomised bands.

**Against production, the answer is reassuring:**
```
trials=40000  moves-producing-writes=28992  failures=0
```
`ranksForMove` is genuinely correct across the space, including bands at `MAX_SAFE_INTEGER`.
This is a real strength and should be recorded as such.

**Against the surviving mutant, it proves the guard is load-bearing and simply untested:**
```
########## RANK-09 (tail safe-integer guard removed) ##########
trials=40000 moves-producing-writes=28992 failures=2835
by kind: { "P3 rank out of range": 2835 }

--- EXAMPLE ---
band   : [{"id":"c","rank":7},{"id":"d","rank":1023},{"id":"b","rank":1024},
          {"id":"a","rank":9007199254740479}]
moved  : c -> index 3
writes : [{"id":"c","rank":9007199254741504}]     <-- exceeds Number.MAX_SAFE_INTEGER
```
So this is **not** an equivalent mutant: 9.8% of moves violate the invariant once the guard
goes, and the suite notices none of them. The enumerated cases do not cover the space.

**Recommended fix:** add the property test. ~30 lines against the exported `ranksForMove` would
have killed `RANK-09` on the first run, and would guard `RANK-11/12/13` (below) for free.

---

### L-1 (Low) — refusal-cause precedence is unpinned

**Mutant:** `M1a-07` — reorder `dropHint` so the terminal-lane hint wins over `readOnly`.
**Result: SURVIVED.**

The three refusal cases in `ft-kanban.drop-refusal-affordances.test.ts:57-77` are mutually
exclusive (`readOnly` alone; `ALL_DISABLED` alone; `WONT_FIX` alone). No fixture combines two
causes, so which reason a read-only *terminal* lane reports is unspecified. Cosmetic — the user
gets *a* correct reason either way — but the M-1a fix is precisely about the two channels
agreeing, and precedence is the one property left unstated. A fourth case with
`{ readOnly: true, stage: WONT_FIX }` would pin it.

### L-2 (Low) — `RANK-11/12/13` survive; two are effectively equivalent

- `RANK-13` (head-of-band always halves instead of claiming a full `RANK_STEP`) — **0 fuzz
  failures.** Order stays correct; only the *spacing quality* degrades, which no invariant
  covers. Worth an assertion only if the sparse-spacing contract is considered load-bearing.
- `RANK-12` (drop `Math.trunc` in `clamp`) — **0 fuzz failures.** Equivalent w.r.t. the stated
  invariants.
- `RANK-11` (non-finite `targetIndex` snaps to the end rather than the start) — unreachable from
  the view, since `targetIndex` comes from `findIndex`. Defensive-only; documented behaviour
  that no test states.

Grouped as Low deliberately: these are the *defensible* survivors, and I would not spend the
round on them.

### L-3 (Low) — `dropEffect` coverage is asymmetric between the two views

**Mutant:** `DND-03` — queue row `dragover` no longer sets `dataTransfer.dropEffect = 'move'`.
**Result: SURVIVED.** The kanban side has `sets dropEffect to move rather than leaving it none`
(`ft-kanban-view.contract.test.ts`); the queue has no equivalent, even though
`test/helpers/dom.ts:167-170` deliberately seeds `dropEffect: 'none'` so a test *can* tell an
explicit `'move'` from an untouched default. The helper was built for this assertion and the
queue never makes it. Consequence is a wrong drag cursor, not data loss.

### L-4 (Low) — the two-runner split is a coverage trap

`npm run test:components` (Vitest) executes **none** of `src/util/rank.test.ts` (643 lines),
`src/util/task-state-utils.test.ts`, `src/utils/task-ready.test.ts`, or `src/util/safe-url.test.ts`.
Only the composite `npm test` runs both halves. I walked into this myself and it cost a full
mutation pass. The "362 tests" figure is Vitest-only and excludes the Node scripts. Recommend a
one-line note in `web/README.md` and a check that CI invokes `npm test`, not `vitest run`.

### L-5 (Low) — `PRIORITY_LABEL` / `PRIORITY_VARIANT` are the anchor file's blind spot

`src/util/priority-utils.ts` is user-visible vocabulary derived by
`test/ft-dashboard-view.test.ts:429-454`, `test/ft-ready-queue-view.rank.test.ts:209` and
`test/ft-inspector-header.availability.test.ts:74`, but pinned as a literal nowhere. Renaming
`'Urgent'` or `'No priority'` changes what users read and fails no test — the mirror image of
the drift `vocabulary.contract.test.ts` exists to prevent. Five lines to close.

---

## Out-of-scope items — are their pinning tests wrong?

As instructed I am not re-reporting F-4/F-6/F-7 (#188/#189/#190). I did read their pinning
tests, and **they are sound.**

`test/ft-ready-queue-view.availability.test.ts:110-146` is the strongest of them: it pins the
*consequence* ("a rendered queue row can only ever show the success badge") rather than the
mechanism, and it does so with **presence** assertions — `toEqual(['success'])`,
`toEqual(['Available'])` — not just absence ones, including a server-contradicts-itself fixture
(`available: true` with populated `reasons`). If someone later makes unavailable tasks visible,
this fails and points straight at the never-exercised branch. That is a correctly-built
characterisation test. The `VAC-01` probe killed 50 tests in this file, so none of it is vacuous.
No change recommended.

---

## Answers to the five disclosed seams

| # | Seam | Status |
|---|---|---|
| 1 | Self-built oracle rebound to production | **Partially closed.** The `compareAcceptedQueueOrder` binding is real, but a thirteenth oracle exists (**M-1**) and the tiebreak it originally diverged on is still unpinned (**H-1**). |
| 2 | `dragover` + `preventDefault` + `drop` sequence | **Closed.** `dragTaskOnto()` enforces the sequence; reintroducing the round-1 bug kills 11 tests. |
| 3 | No property-based testing on `ranksForMove` | **Open** (**M-3**). Production is provably correct over 40k trials, but the enumerated cases miss the safe-integer boundary — proven load-bearing, not equivalent. |
| 4 | Vacuity | **Closed** for the two components probed; both dead-render mutants killed 50 and 54 tests. |
| 5 | Vocabulary anchor split | **Closed in mechanism, inaccurate in claim** (**M-2**). Rewording fails exactly one test as designed; the "only place" claim is false at three sites, one already drifted. |

**Fixes to attack:** F-1 and F-2 re-confirmed killed independently. **F-3's rewritten test is
correctly split and catches the exact original bug ordering** — but its delivery half is
untested (**H-2**). **M-1a's rewrite is a genuine strengthening**: folding both channels into
the shared three-case table means a fourth cause cannot be wired to one channel only, and I
could not weaken it except on precedence (**L-1**). No assertion in any of the four was quietly
softened to pass.

---

## Recommended priority

- **Critical:** none.
- **High:** H-1 (two-line fixture swap, kills the mutant three times over); H-2 (assert
  `composed` on the queue, or better, one real end-to-end refusal through `ft-app`).
- **Medium:** M-1 (band oracle re-encodes the pre-F-2 definition); M-2 (three literal sites, one
  already drifted); M-3 (add the property test — ~30 lines, closes four survivors).
- **Low:** L-1 precedence case; L-2 accept or document; L-3 queue `dropEffect`; L-4 README/CI
  note on the two-runner split; L-5 anchor `PRIORITY_LABEL`.

H-1, H-2, M-2 and L-1 are together well under half a day. M-3 is the one with lasting value.

---

## Artifacts

- Mutant definitions: `/tmp/ft-mut3/mutants.json` (43 mutants)
- Harness: `/tmp/ft-mut3/mutate.mjs`
- Raw results: `/tmp/ft-mut3/results.json`
- Property harness: `/tmp/ft-mut3/fuzz.mjs` (40,000 trials; 0 production failures)

Reviewed `49e55e9`. Main workspace and mutation worktree both verified byte-identical to the
reviewed commit afterwards — no files were modified or committed.
