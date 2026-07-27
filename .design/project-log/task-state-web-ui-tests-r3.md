# Task State Web UI — Round 3 Test Pass

Date: 2026-07-27
Branch: tests-r3
Work order: `reports/test-task-state-web-ui-r2.md` (round-2 test review)

## Summary

Closed the round-2 TEST findings. Every finding was closed by mutating the
production code it covers and watching the test go red; "it passes" was not
accepted as evidence for anything.

| | Before | After |
| --- | --- | --- |
| Vitest tests (`test/**`) | 164 | 351 |
| Vitest files | 12 | 20 |
| Suite runtime | ~9.6s | 2.44s |
| Node tests (`src/**`) | 4 scripts | 4 scripts (rank.test.ts 223 → 588 lines) |
| Mutations run | 55 (reviewer) | 61 (this round) |
| Mutations killed | 39/55 | 60/61 (1 deliberate survivor, explained) |

Three of those **survived on first run** and were killed only after the suite
was strengthened; a fourth survives *by design* and is explained below rather
than papered over. Those four are the useful part of this log.

## Production code changed

**None.** `git diff --stat` over `web/src/**` shows one file, `src/util/rank.test.ts`,
which is itself a test. The only non-test change in the branch is a
documentation section added to `web/README.md` (finding L-6, below).

Every mutation was applied to a working-tree copy with a `/tmp` backup and
restored immediately; each restore was verified with
`git diff --stat <file> | wc -l` → `0`.

## The three surviving mutations

### 1. M-R4 — the self-built oracle (the headline finding)

The rank developer's own self-critique flagged that `orderAfter()` in
`src/util/rank.test.ts` re-implemented the queue comparator instead of
importing `compareAcceptedQueueOrder`. It is worse than "might diverge": the
local oracle broke ties on the item's **source index**, while the real
comparator breaks ties on `createdAt`, then `id`. Those agree only when the
input band is already sorted by the real comparator — a precondition nothing
enforced.

Mutation: make `compareAcceptedQueueOrder` sort unranked tasks **first**
instead of last.

```
### M-R4 against the ORIGINAL rank.test.ts
rank tests passed                                    <-- SURVIVED

### M-R4 against the rewritten rank.test.ts
Error: partly ranked band (fixture violates the precondition:
band must already be in comparator order)            <-- KILLED
```

Fix: `orderAfter()` now applies the writes to real `Task` objects and sorts
with the real exported `compareAcceptedQueueOrder`. A new
`assertSourceIsInDisplayOrder()` guard runs on every fixture, so a band that
is not already in comparator order fails loudly instead of quietly agreeing
with the wrong model.

**Conditional soundness, stated plainly:** the old oracle was not producing
wrong answers today. For every non-empty write set `ranksForMove` produces,
the resulting ranks are distinct, so the tiebreak never fires and index-order
and `createdAt`-order coincide. The defect was that nothing held that
condition in place. I am recording this rather than letting "13 tests were
green, now 40 are green" imply the old tests were finding something they
weren't.

### 2. M-R6 — the unreachable no-op guard

`ranksForMove` has a defensive guard: `if (order.every((item, index) => item.id === band[index].id)) return []`.

Mutation: delete the guard.

```
### M-R6 against the suite as it stood
rank tests passed                                    <-- SURVIVED
```

The guard is unreachable through index arithmetic — after
`splice`, `toIndex !== fromIndex` always changes the id sequence. The only way
in is a band containing **duplicate ids**, which is exactly the malformed input
the guard exists for. Added a duplicate-id band test:

```
### M-R6 after adding the duplicate-id test
Error: swapping two identically-named tasks writes nothing:
expected [], got [{"id":"a","rank":2560}]            <-- KILLED
```

### 3. M-L4 — the header count that could not be wrong

The review said `queue-ordering.test.ts` asserted the header count against
`MIXED.length`, and that header and rows derive from the same array. My first
fix (assert against the *rendered rows*) was necessary but insufficient:

```
### M-L4: header counts store.allTasks.length instead of rendered rows
      Tests  5 passed (5)                            <-- SURVIVED
```

Root cause: all seven tasks in `MIXED` are queue-eligible, so "count the rows",
"count the fixture" and "count the whole store" are the same number. Added a
fixture holding two tasks the queue filters out:

```
### M-L4 v2 against the discriminating fixture
AssertionError: expected 'Available Queue (9)' to be 'Available Queue (7)'
      Tests  1 failed | 6 passed (7)                 <-- KILLED
```

This is the general lesson from the round: a test can name the right property
and still be structurally incapable of observing it, because the fixture makes
the right and wrong answers numerically identical.

## Findings to report — defects pinned, not fixed

These are asserted as **current behaviour** with an explicit finding label in a
comment, so the suite records them without pretending they are correct. If any
is fixed, the characterisation test will fail and must be inverted at that
point — that is intended.

| ID | Where | Behaviour |
| --- | --- | --- |
| F-1 | `rank.ts` `midpoint()` | Emits a rank **below** the documented `MIN_RANK`. Band `[{a,-5},{b,0},{c,5}]`, move `c` to index 1, yields `[{id:'c',rank:-3}]`. The interior-midpoint branch has no `MIN_RANK` floor; only the head-of-band branch does. Contradicts the developer's stated intent that hostile ranks fall through to renumber. |
| F-2 | `ft-ready-queue-view.reorder()` | The band is computed from the **filtered** `getReadyTasks()`, so reordering while a filter hides part of a band writes a rank that collides with the hidden neighbour. Duplicate ranks persist to the server. |
| F-3 | `ft-ready-queue-view.reorder()` | With no client attached, the `!this.client` early return happens **after** the optimistic store write. The row moves, nothing is persisted, no `write-error`, no toast — only a `console.warn`. A silent fake success. |
| F-4 | `ft-ready-queue-view` row badge | The availability badge has a `neutral` branch that is dead: unavailable tasks are filtered out before the row renders. A held-but-server-available task shows no hold indicator on the row at all. |
| M-1a | `ft-kanban-column` | `aria-description` is driven by `dropHint` (all three refusal causes) but `title` by `dropTooltip`, gated on `acceptsStageDrop(stage)` **alone**. A read-only board or a stage-change-incapable collection gives a screen-reader user a reason and a pointer user nothing. The two channels disagree about whether there is anything to explain. |
| F-7 | `ft-kanban-view.ts:34` `BOARD_COLUMNS` | Production duplicates production. Each lane hardcodes its `label` (`'In QA'`, `"Won't Fix"`, …) instead of reading `STAGE_LABEL`, and hardcodes `phase` instead of calling `phaseForStage`. Surfaced by M-S3: renaming `STAGE_LABEL[IN_QA]` left the board lane still saying "In QA". The existing binding test catches the divergence, so it is covered — but the duplication is real and belongs in the code, not the test. Not fixed: this round forbids refactoring. |
| F-6 | `utils/task-ready.ts` `isReady()` | Server availability is authoritative and returns before `stage` is consulted, so a `COMPLETED` task the server calls available renders in the Available Queue. Documented precedence rather than a bug, but queue membership is a pure server claim with no client-side stage sanity check. Pinned by M-L4b: adding `&& stage === ACCEPTED` to the server-availability branch turns the test red, so the precedence is genuinely observed, not assumed. |

Confirmed **working** and now proven rather than assumed:

- **F-5** — the rank write path really does reconcile from a *divergent* server
  response, not just echo its own optimistic value. Proven by teaching
  `RecordingClient` to rewrite the response (`updateTaskResponse` hook); without
  that hook, a component that discarded the response entirely passed every
  reconciliation test.

Subagent findings, same status (report, do not fix):

- `ft-dashboard-view`: an empty store renders `ft-empty-state`, not six zeroes;
  `AvailabilityReason.UNSPECIFIED` counts a task as unavailable but surfaces no
  reason anywhere; latent `TypeError` trap in `computeAvailabilityReasons`; no
  guard on the required `store` property; a `role="link"` `div`.
- `ft-inspector-relationships`: the panel throws when `task` is set without
  `store`; dangling relationships are silently dropped, producing a
  contradictory "Blocked by dependency" callout alongside "Blocked by: None";
  two visually identical callouts; dead `readOnly` guards; an unreachable
  `renderStageBadge` fallback.
- `ft-inspector-changes`: change-history values are rendered as **raw server
  strings** — never mapped through `STAGE_LABEL` / `HOLD_REASON_LABEL`. The "no
  deleted stage vocabulary" guarantee is enforced by the server, not the web
  layer. If the backend ever emits `Ready` / `Blocked` / `Backlog` in a change
  record, the UI prints it verbatim.

## Work by finding

| Finding | Status | Killing mutation |
| --- | --- | --- |
| C-2 write-error → toast seam | Closed | M-C2a/b/c (9, 5, 9 failed) |
| C-3a queue availability badge | Closed | M-C3a (2 failed / 15 passed) |
| C-3b | Closed | M-C3b (1 failed) |
| C-3c safe-url vacuous loop | Closed | M-C3c (1 failed, 21 skipped) |
| H-1 inspector-changes vocabulary | Closed | M1–M5, all killed; 9.19s → 1.15s |
| H-2 inspector header/meta availability | Closed | M1–M9, all killed (31 new tests) |
| H-3 reconcile-from-response | Closed | via `updateTaskResponse` divergence hook |
| H-4 FailedPrecondition | Closed | M-H4 (1 failed) |
| M-1/M-5 drop refusal affordances | Closed | M-K1–K4 (3, 1, 1, 2 failed) |
| M-2 safe-url returns href | Closed | M-M2 (5 failed / 17 passed) |
| M-3 | Closed | M-M3 (18 failed) |
| M-4 filter chips removable | Closed | M-M4 (2 failed / 10 passed) |
| L-1/L-2/L-3 task-card attention | Closed | M-L1 (10 failed) |
| L-4 queue header count | Closed | M-L4 v2 (see above) |
| L-6 two-runner split undocumented | Closed | README section added |
| Rank adversarial (unbriefed) | Closed | M-R1–R6, plus 500-trial property suite |
| No test file: `ft-dashboard-view` | Closed | 24 tests, 6 mutations killed |
| No test file: `ft-inspector-relationships` | Closed | 38 tests, 9 mutations killed |

## Rank-reorder adversarial work

Against the developer's own dig map, strongest first:

1. **Self-built oracle** — re-pinned against `compareAcceptedQueueOrder`, with a
   precondition guard. See M-R4 above. New tests cover the tiebreak cases the
   index oracle could not express: duplicate ranks, and bands where every rank
   is `undefined` (the state of all production data today).
2. **No real dragover→drop sequence** — fixed in the shared helper.
   `dragTaskOnto()` in `test/helpers/dom.ts` drives dragover, and drops *only
   if* the lane called `preventDefault()` — exactly the browser's rule. It
   returns `false` when the gesture was refused, and every caller asserts that
   return value, so the rule and the drop are exercised in combination rather
   than separately. A component that stopped honouring dragover can no longer
   pass a drop test.
3. **Property-based testing** — 500 trials over random bands and target indices
   (mulberry32, seed `0x5eed_1234`, so failures reproduce). Invariants: the
   resulting order equals the dropped order; no duplicate ranks; every rank is a
   safe integer `>= 1`. Plus branch-coverage assertions (`seen.noop`,
   `seen.singleWrite`, `seen.renumber` all non-zero) so the property suite
   cannot silently stop reaching the renumber path.
4. **Organic gap exhaustion** — a 40-iteration loop inserts repeatedly into one
   narrowing gap and asserts the renumber fires *on its own* (`renumbered > 0`
   and some gap reached 1), rather than constructing `[5, 6]` by hand.
5. **Hostile server ranks at component level** — floats, negatives, zero and
   `NaN` fed to the mounted queue. This is where F-1 surfaced.

Also added: a cross-check group asserting the view's `updateTaskCalls` match
real `ranksForMove` output, so the component and the rank module cannot drift
apart.

## Re-implementation sweep

The manager's instruction was to treat any test asserting against a local
re-implementation of production logic as in scope. A full read-only audit of
the suite found twelve instances. All are now fixed.

**One had already drifted.** `test/ft-app.write-error-seam.test.ts` hardcoded
the terminal-lane refusal sentence with a **curly** apostrophe where
`STAGE_LABEL` uses a straight one, and with the trailing clause "rather than by
dragging" missing entirely. It passed anyway, because the assertion was a loose
substring match. That is the defect class the manager asked me to hunt,
caught in the wild.

Fixed:

| Site | Now uses |
| --- | --- |
| `src/util/rank.test.ts` | real `compareAcceptedQueueOrder` (M-R4) |
| `test/ft-app.write-error-seam.test.ts` ×2 | `DROP_REFUSAL.readOnlyBoard`, `DROP_REFUSAL.terminalLaneToast(STAGE_LABEL[…])` |
| `src/utils/task-ready.test.ts` | real `phaseForStage`; added the missing `snapshotComplete()` seam |
| `src/util/task-state-utils.test.ts` | real `phaseForStage`; ditto |
| `test/helpers/fixtures.ts` `NATIVE_STAGES` | derived from `NATIVE_STAGE_OPTIONS` |
| `test/ft-task-card.attention.test.ts` | `isUnsuccessfulTerminalStage`, `availabilityLabel`, both label maps |
| `test/ft-filter-chips.test.ts` | `STAGE_LABEL`, `HOLD_REASON_LABEL`, `AVAILABILITY_REASON_LABEL` |
| `test/ft-kanban-view.contract.test.ts` ×2 | refusing lanes derived from `acceptsStageDrop` |
| `test/ft-toolbar.contract.test.ts` | `AVAILABILITY_REASON_LABEL` for option labels |
| `test/ft-kanban.drop-refusal-affordances.test.ts` | terminal lanes derived, not transcribed |
| `test/ft-ready-queue-view.rank.test.ts` | shared `dragOverOn` helper |

### The cost of deriving, and how it is paid

Deriving has a failure mode of its own, and I want it on the record rather than
buried. Once a test says
`expect(emitted).toBe(DROP_REFUSAL.terminalLaneToast(STAGE_LABEL[stage]))`,
rewording the constant moves **both sides of the assertion together** and
nothing fails. I proved this rather than assuming it:

```
### M-S1: terminalLaneToast drops its trailing clause
      Tests  23 passed (23)                          <-- SURVIVED, by design
```

That is the correct behaviour for a *binding* test — its job is "the view uses
the constant and passes the right label", not "the constant says these words".
But it leaves the user-visible copy unpinned, so a rename could ship silently.

The fix is a **single anchor**: `test/vocabulary.contract.test.ts` (21 tests) is
now the only place in the suite where these strings appear as literals. Every
other test derives. So a reword fails in exactly one file — a decision point
instead of an accident — and a transcription can no longer drift, because there
are no transcriptions left.

Evidence that the split works, each mutation hitting only what it should:

```
### M-S1 v3: reword terminalLaneToast (vocabulary change)
   x DROP_REFUSAL — the refusal vocabulary itself > explains in the toast ...
      Tests  1 failed | 26 passed (27)               <-- anchor fired, alone

### M-S2: the view emits its own literal instead of the constant (binding break)
   x emits exactly the terminalLaneToast text for the Won't Fix lane
   x emits exactly the terminalLaneToast text for the Duplicate lane
   x emits exactly the terminalLaneToast text for the Cancelled lane
      Tests  3 failed | 24 passed (27)               <-- binding tests fired

### M-S3: STAGE_LABEL[IN_QA] renamed to 'QA'
   x ft-kanban-view > labels every lane with its canonical stage label
   x STAGE_LABEL ... > labels stage 6 as "In QA"
      Tests  2 failed | 349 passed (351)

### M-S4: AVAILABILITY_REASON_LABEL[BLOCKED_BY_DEPENDENCY] reworded
   x AVAILABILITY_REASON_LABEL ... > labels availability reason 4
      Tests  1 failed | 350 passed (351)
```

M-S3 failing in **two** places is itself a finding — see F-7.

## Notes on test design

- **Negatives now carry positives.** Every `not.toMatch` / `toBe(false)`
  assertion about an absent badge is preceded by an assertion that *something*
  rendered. Six assertions in `ft-task-card.attention.test.ts` were passing on
  a card that rendered no badges at all.
- **Divergent-response fakes.** `RecordingClient` echoes by default, which makes
  "reconciled from the response" and "kept its own optimistic value"
  indistinguishable. The `updateTaskResponse` hook exists so reconciliation
  assertions are real.
- **Fixture discrimination.** As M-L4 showed, a fixture where the right and
  wrong sources produce the same number defeats a correctly-worded assertion.

## Not done, and why

- **F-1 through F-6 and M-1a are not fixed.** This was a test pass; production
  changes needed a reason and none of these is a test-blocking defect. They are
  pinned as characterisation tests and reported for the manager to triage.
- **Cross-band drag, padlock semantics, `aria-describedby`, keyboard
  reordering, ready-queue rename** — settled scope, tracked as issues #180–#187.
  Not reopened.
- **Out-of-enum wire values** (`holdReason: 99`, `reasons: [42]`) hitting the
  `?? String(reason)` fallbacks in `task-state-utils.ts` are not pinned. They
  are unreachable through the typed `Task` contract without a cast, and pinning
  a stringified enum number as user-visible text would enshrine a degradation
  rather than a requirement. Recommend a contract-level decision instead.
- **`ft-inspector-header` read-only mode** is untested for state badges. In
  `readOnly` the priority badge becomes a direct child of `.badges` and would
  enter the badge-list assertions; rather than weaken the selector for every
  test, the scope was kept to the editable default and documented in-place.
- **`hasAvailabilityReason`** is not exercised by the inspector components at
  all — it belongs to `attentionBlockers` / `ft-task-card`. No coverage added
  under this round's scope.
- **Hold-reason old→new change rendering** is tested for the render path only;
  it derives its fixture from `HOLD_REASON_LABEL`, so a label rename cannot fail
  it. Vocabulary anchoring for hold reasons comes from the mock-history test,
  which killed M4. Flagged rather than dressed up as vocabulary coverage.
- **`src/utils/` and `src/util/`** are two sibling directories with confusingly
  similar names (`utils/task-ready.ts` vs `util/task-state-utils.ts`). Not
  renamed — that is a refactor, and this round forbids them. Recommend
  consolidating.
- **Shared-worktree hazard.** Concurrent mutation runs against the same
  production files can cross-contaminate. My runs were serialised per file and
  every restore verified, but this is a real risk if the pattern is repeated
  with parallel agents.
- **F-7 (`BOARD_COLUMNS` duplicating `STAGE_LABEL` / `phaseForStage`) is not
  fixed.** It is a production-side instance of exactly the defect class I was
  asked to remove from the tests, and the one-line fix is tempting — but it is
  a refactor, and this round forbids them. Covered by a binding test; flagged
  for the manager to schedule.
- **Ready-queue refusal strings are inline literals** in
  `ft-ready-queue-view.ts:368,381,435` rather than exported constants, so the
  seam test has nothing to import for that path. The kanban half of the seam
  test is now bound to `DROP_REFUSAL`; the queue half cannot be until the
  strings are lifted. That lift is a production change, so it is a
  recommendation, not something I did.
- **One mutation survives deliberately** (M-S1 against a binding test). This is
  a property of derived expectations, not a coverage hole — the vocabulary
  anchor covers what it cannot. I am reporting it as a survivor rather than
  quietly excluding it from the denominator.

## Verification

```
cd web
npm test                                # Tests 351 passed (351), 4 Node scripts passed
npx tsc --noEmit                        # clean
npx tsc -p tsconfig.test.json --noEmit  # clean
npm run build                           # exit 0
find dist -name '*.map' | wc -l         # 0
npm audit --audit-level=low             # found 0 vulnerabilities
```
