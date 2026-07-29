# dev-phase2-fixes-r5 — Phase 2 web UI round-5 fix pass

**Branch:** `attention-view` — `633f8f2` → `8fa5762` (5 commits)
**Workspace:** `/workspace`
**Date:** 2026-07-27

## Pre-flight

```
$ git branch --show-current
attention-view
$ git log --oneline -1
633f8f2 docs: log the contract §10 attention view work
$ git status --short
(clean)
```

Confirmed on `attention-view`, not `task-state-web-ui-v2`. All five commits
landed here. **Nothing pushed.**

Baseline re-established before touching anything:

```
 Test Files  22 passed (22)
      Tests  407 passed (407)
EXIT=0
```

## Summary

All five items done. Every mutation named in the brief goes SURVIVED → DEAD
with output pasted below. Test count **407 → 422**. Full gate green.

| item | mutant | before | after |
|---|---|---|---|
| 1 | H-1 drift re-introduction | 407/407 green | **10 failed / 411** |
| 2 | `DUP-DROP` | SURVIVED (407→405) | **DEAD** — 2 failed / 414 |
| 2 | `DROP-01` | SURVIVED (407→402) | **DEAD** — 3 failed / 411 |
| 3 | `WF-01` | SURVIVED (407) | **DEAD** — 1 failed / 418 |
| 3 | `WF-02` | SURVIVED (407) | **DEAD** — 1 failed / 418 |
| 4 | `M4` | SURVIVED (407) | **DEAD** — 1 failed / 419 |
| 5 | `M1` (contract suite alone) | SURVIVED | **DEAD** — 4 failed |

Every mutation was applied to a committed tree and reverted with
`git checkout <commit> -- web/`, with `git status --porcelain` verified empty
after each. Per the process note in the brief, **each fix was committed before
any mutation was run against it**, so no restore could revert my own work.

---

## Item 1 — H-1: anchor the inspector's attention copy

**Commit `d039810`.** `ATTENTION` gained `calloutTitle` and `calloutBody(n)` in
`task-state-utils.ts`; `ft-inspector-relationships.ts` binds `:224`, `:227–229`
and `:308`; the test imports the constants instead of transcribing them; the
`Object.keys()` guard is updated and four new anchor tests pin the new entries.

### The acceptance check needed reinterpreting — please read this bit

The brief asked me to re-run the deliberate-rename simulation and "show the
suite now goes RED". Run literally against the fixed tree, it goes **green**:

```
$ # rename AVAILABILITY_REASON_LABEL[BLOCKED_BY_DEPENDENCY] -> 'Blocked by prerequisite'
$ # update the anchor test to match, as the docblock instructs
$ npm test
 Test Files  22 passed (22)
      Tests  411 passed (411)
EXIT=0
```

That green is **correct**, not a missed fix. The reviewer's diff makes the
component *derive* from the constant, which eliminates the drift rather than
detecting it: after the rename the inspector renders "Blocked by prerequisite"
too, so the UI is consistent and there is nothing left to fail. A test that
went red here would be a test asserting the rename *didn't* propagate.

The experiment that actually exercises the new property is drift
**re-introduction** — rename the constant, update the anchor, and hardcode the
inspector's literals the way they were before. That is precisely the pre-fix
world, and it is the regression the fix prevents. I ran both halves.

### BEFORE — pre-fix tree (`633f8f2` files restored), rename applied

```
$ git checkout 633f8f2 -- web/src/components/inspector/ft-inspector-relationships.ts \
    web/src/util/task-state-utils.ts web/test/ft-inspector-relationships.test.ts \
    web/test/vocabulary.contract.test.ts
$ # rename the constant + update the anchor test
$ grep -n "Blocked by dependency" src/components/inspector/ft-inspector-relationships.ts
308:              Blocked by dependency          <-- component still hardcodes the old wording

$ npm test
 Test Files  22 passed (22)
      Tests  407 passed (407)
EXIT=0
```

**407/407 green with the UI internally inconsistent** — the chip reads "Blocked
by prerequisite", the inspector panel below it reads "Blocked by dependency".
`review-phase2`'s finding reproduced exactly.

### AFTER — fixed tree, same rename, inspector literals hardcoded again

```
$ git checkout d039810 -- web/
$ # rename the constant + update the anchor test + re-hardcode :226 and :306
$ sed -n '226p;306p' src/components/inspector/ft-inspector-relationships.ts
          Dependency attention needed
              Blocked by dependency

$ npm test
   × ft-inspector-relationships — dependency attention callout > warns that a Won't Fix prerequisite is still blocking the task
   × ft-inspector-relationships — dependency attention callout > warns that a Duplicate prerequisite is still blocking the task
   × ft-inspector-relationships — dependency attention callout > warns that a Cancelled prerequisite is still blocking the task
   × ft-inspector-relationships — dependency attention callout > counts the blockers when more than one prerequisite needs attention
   × ft-inspector-relationships — dependency attention callout > shows the plain blocked notice instead of the warning when the prerequisites are healthy
   × ft-inspector-relationships — dependency attention callout > shows the plain blocked notice when the blocking prerequisite is not in the store
   × ft-inspector-relationships — dependency attention callout > renders neither notice without a BLOCKED_BY_DEPENDENCY availability reason
   × ft-inspector-relationships — dependency attention callout > removes the blocking relationship from the callout action
   × ft-inspector-relationships — dependency attention callout > asks to rewire the prerequisite as a BLOCKED_BY addition
   × ft-inspector-relationships — dependency attention callout > still explains the problem read-only, but offers no actions

AssertionError: expected null not to be null

 Test Files  1 failed | 21 passed (22)
      Tests  10 failed | 401 passed (411)
EXIT=1
```

**407/407 green → 10 failed.** The drift is now loud.

---

## Item 2 — M-2 / F-2 / ATT-03: pin the derived-loop cardinality

**Commit `e67bae4`.** All **four** loops across three files, per the brief's
grep (the code review named two; fixing only those would have left `DROP-01`
live). Derived loops kept for the widening signal; an explicit membership
assertion added beside each.

### `DUP-DROP` — drop `TaskStage.DUPLICATE` from `isUnsuccessfulTerminalStage`

Before (from `review-phase2` and `test-phase2`, independently): **0 dead**,
suite 407 → 405 reporting green.

After:

```
$ sed -n '177p' src/util/task-state-utils.ts
  return stage === TaskStage.WONT_FIX || stage === TaskStage.CANCELLED;

$ npm test
   × ft-task-card — needs-attention badge > treats exactly the three contract §11 outcomes as unsuccessful terminal
   × ft-inspector-relationships — dependency attention callout > warns for exactly the three contract §11 outcomes

 FAIL  test/ft-inspector-relationships.test.ts > ... > warns for exactly the three contract §11 outcomes
AssertionError: expected [ 13, 15 ] to deeply equal [ 13, 14, 15 ]

- Expected
+ Received

  [
    13,
-   14,
    15,
  ]

 FAIL  test/ft-task-card.attention.test.ts > ... > treats exactly the three contract §11 outcomes as unsuccessful terminal
AssertionError: expected [ 13, 15 ] to deeply equal [ 13, 14, 15 ]

 Test Files  2 failed | 20 passed (22)
      Tests  2 failed | 412 passed (414)
EXIT=1
```

**SURVIVED → DEAD.** Note the total is 414 not 422: the two derived loops still
shed a case each under narrowing, which is inherent to the pattern. The point
is that the shedding is no longer *silent* — the membership assertions fail.

### `DROP-01` — make the Duplicate lane accept drops

Before: **0 dead**, suite 407 → 402 reporting green. This is the higher blast
radius one — the board would accept a drag onto the Duplicate lane and issue a
stage change with no duplicate target.

After:

```
$ sed -n '98p' src/util/task-state-utils.ts
  return !isClosedStage(stage) || stage === TaskStage.COMPLETED || stage === TaskStage.DUPLICATE;

$ npm test
   × ft-kanban-view — dropping a card back on its own lane > refuses drops on exactly the three lanes a drag gesture cannot express
   × ft-kanban-view — refusals must be visible > requires visible feedback on exactly the three refusing lanes
   × ft-kanban-view — refusing lanes must still accept the drop gesture > keeps the drop gesture alive on exactly the three refusing lanes

 Test Files  2 failed | 20 passed (22)
      Tests  3 failed | 408 passed (411)
EXIT=1
```

**SURVIVED → DEAD**, and all three `acceptsStageDrop` loop sites fire — which
confirms the brief's count of four loops was right and two would not have been
enough.

---

## Item 3 — M-3 / F-1: bind the partial-renumber emission

**Commit `3b7ce98`.** Two new tests drive the real `reorder()` and assert the
emitted `write-error` detail on both sides of the threshold.

### A real finding while writing this test

The obvious construction is `client.rejectUpdateWith`, which is what the
existing tests use. It rejects from call **one** — so nothing is ever
persisted, the scenario is *not* the part-way failure the message describes,
and `updateTaskCalls.length` is 1 even though `writes.length` is 3. My first
draft used it and my own premise assertion caught it:

```
AssertionError: expected a renumber, not a single write: expected 1 to be greater than 1
```

The multi-write test now fails the **second** write via `updateTaskResponse`,
producing a genuine partial renumber with an earlier rank already on the
server. Worth flagging: the pre-existing test named *"rolls the whole band back
when a renumber fails part way through"* has this same weakness — it fails on
write one, so it is not really exercising "part way through". Left alone as out
of scope; logged as a follow-up.

### `WF-01` — remove the `message` key from the detail

Before: **SURVIVED**, `Tests 407 passed (407)`.

After:

```
   × ft-ready-queue-view — server rejection > attaches the partial-renumber message when a renumber wrote more than once

AssertionError: expected undefined to be 'Reordering the queue failed part way …' // Object.is equality
- Expected:
"Reordering the queue failed part way through — reload to see the saved order."

 Test Files  1 failed | 21 passed (22)
      Tests  1 failed | 417 passed (418)
EXIT=1
```

**SURVIVED → DEAD.**

### `WF-02` — `writes.length > 1` → `> 0`

Before: **SURVIVED**, `Tests 407 passed (407)`.

After:

```
$ sed -n '491p' src/components/ready-queue/ft-ready-queue-view.ts
          ...(writes.length > 0

   × ft-ready-queue-view — server rejection > omits the partial-renumber message when only one rank was written

AssertionError: nothing was saved, so "reload to see the saved order" would be wrong: expected 'Reordering the queue failed part way …' to be undefined
- Expected:
undefined

 Test Files  1 failed | 21 passed (22)
      Tests  1 failed | 417 passed (418)
EXIT=1
```

**SURVIVED → DEAD.** Both halves of the threshold are now bound.

---

## Item 4 — audit L-1: pin the toast's HTML escaping

**Commit `9bc5e2c`.** The auditor's supplied test, adapted to this file's
existing `mountAppShowing` / `dispatchWriteError` / `toasts()` helpers so it
routes through a real `ft-app` and a real child view rather than a bare
fixture.

### `M4` — `document.createTextNode(message)` → `insertAdjacentHTML('beforeend', message)`

Before: **SURVIVED**, `Tests 407 passed (407)`.

After:

```
$ grep -n "insertAdjacentHTML" src/components/ft-app.ts
877:    alert.append(icon); alert.insertAdjacentHTML('beforeend', message);

$ npm test
   × ft-app — the four write-error reasons are each surfaced > renders a refusal message as text, never as markup

AssertionError: the message was parsed as HTML: expected <img src="x" …(1)></img> to be null
- Expected:
null

 Test Files  1 failed | 21 passed (22)
      Tests  1 failed | 419 passed (418+1)
EXIT=1
```

**SURVIVED → DEAD.** The `<img>` was parsed into a real DOM node and caught.
The test asserts three things: the markup is not parsed, the text is visible
verbatim, and nothing executed.

---

## Item 5 — audit L-2: three credential rows on the safe-url contract table

**Commit `8fa5762`.** The auditor's three rows, verbatim.

### `M1` — remove the embedded-credential check, run the contract suite alone

Before (auditor's run): contract suite fully green, 22 passed — the check was
caught only by the plain-Node suite.

After:

```
$ sed -n '63p' src/util/safe-url.ts
  // MUTATION M1: credential check removed

$ npx vitest run test/safe-url.contract.test.ts
   × safeExternalUrl > maps "https://github.com@evil.example/" to null
   × safeExternalUrl > maps "https://user:pass@evil.example/" to null
   × safeExternalUrl > maps "https://:pass@evil.example/" to null
   × safeExternalUrl > never returns a value whose scheme is not http(s)

 Test Files  1 failed (1)
```

**SURVIVED → DEAD in the contract suite alone.** Four failures, including the
`accepted.length` invariant — the auditor predicted these rows would strengthen
it, and they do.

---

## Regression check — the five previously-dead mutants stay dead

Three of these kill the **node** runner, which aborts `npm test` before vitest
runs, so I ran both halves separately (same reason `test-phase2` did).

| mutant | node | vitest | result |
|---|---|---|---|
| `CMP-02` | exit 1 | 3 failed / 422 | **DEAD** |
| `F3-05` | exit 0 | 1 failed / 422 | **DEAD** |
| `RANK-09` | exit 1 | exit 0 | **DEAD** |
| `ATT-01` | exit 0 | 5 failed / 422 | **DEAD** |
| `ATT-02` | exit 1 | 26 failed / 422 | **DEAD** |

Every count matches `test-phase2`'s original run, scaled to the new total.

```
# CMP-02 node half
Error: the comparator must order a full rank/created_at tie by id, so a band listed in reverse id order is NOT in display order

# RANK-09 node half
Error: M-3: tail past MAX_SAFE_INTEGER (rank 9007199254742016 must be a positive safe integer): expected true, got false

# ATT-02 node half
Error: attention workflow finds unsuccessful terminal prerequisites: expected [cancelled-blocker], got []
# ATT-02 vitest half
 Test Files  3 failed | 19 passed (22)
      Tests  26 failed | 396 passed (422)
```

**One process note that matters.** My first regression sweep reported `ATT-02`
as SURVIVED. It had not survived — my `sed '302s/...'` was a stale line number
from before item 1 added ~25 lines to `task-state-utils.ts`, so the mutation
landed harmlessly inside a docblock and never applied. Re-run against the real
function body it is DEAD, as above. Flagging it because a line-number-addressed
mutation on a file you have edited is a live way to manufacture a false
negative, and the failure mode looks exactly like a real finding.

---

## Full gate

```
$ npm test
 Test Files  22 passed (22)
      Tests  422 passed (422)
EXIT=0

$ npx tsc --noEmit
tsc --noEmit EXIT=0

$ npx tsc -p tsconfig.test.json --noEmit
tsc -p tsconfig.test.json EXIT=0

$ npm run build
✓ built in 2.80s
build EXIT=0

$ find dist -name '*.map' | wc -l
0

$ npm audit --audit-level=low
found 0 vulnerabilities
audit EXIT=0

$ go build ./...
go build EXIT=0
```

Exit codes captured by redirecting to a file and checking `$?` directly, not
read off the end of a pipeline.

Test count **407 → 422** (+15). Sourcemap count **0**, as expected on this
branch.

Final state:

```
$ git status --porcelain
(empty)
$ git log --oneline 633f8f2..HEAD
8fa5762 test(web): cover embedded credentials in the safe-url contract table
9bc5e2c test(web): pin the error toast's HTML escaping
3b7ce98 test(web): bind the queue's partial-renumber emission
e67bae4 test(web): pin the cardinality of all four derived stage loops
d039810 fix(web): anchor the inspector's attention callout copy
```

**Not pushed.**

---

## No self-built oracle added

Every new test binds to a real exported symbol: `ATTENTION.calloutTitle` /
`calloutBody`, `AVAILABILITY_REASON_LABEL`, `TaskStage` enum members,
`WRITE_FAILURE.partialRenumber`, `safeExternalUrl`. The item-1 change actively
*removes* two transcriptions that were standing in for production constants.
Nothing re-implements a production predicate.

The membership assertions in item 2 do name the three stages literally — that
is deliberate and is the whole point: a literal is the only thing that can
detect narrowing, and deriving the expectation from the predicate under test is
exactly the defect being fixed.

---

## Found but not fixed

- **The pre-existing "fails part way through" rank test rejects on write one**,
  so it does not exercise a genuine part-way failure despite its name. It still
  pins the rollback it asserts, and the new multi-write test now covers the real
  case. Follow-up, described in item 3.
- Everything the brief listed as out of scope remains out of scope and is
  itemised with reasons in the project log's "Not done, and why" section:
  M-4, M-5, L-1/L-3, L-2, L-4, the `matchesTaskFilters` refactor,
  `REL_GROUP_LABEL`/`REL_GROUP_ORDER`, audit I-1/I-2, test F-3/F-4, and the two
  Go-side items.

**Nothing High or Critical was found this round.** No reason to stop and
escalate.

## Deliverables

1. Five commits on `attention-view`, `633f8f2` → `8fa5762`. Not pushed.
2. Project log entry: `.design/project-log/phase2-fixes-r5.md`.
3. This report.
