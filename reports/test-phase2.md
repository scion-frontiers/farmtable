# test-phase2 — test review, full Phase 2 web UI line

**Range:** `7a0f220..633f8f2`, branch `task-state-web-ui-v2`
**Workspace verification:** branch `task-state-web-ui-v2`, HEAD `633f8f2`, `git log --oneline 7a0f220..633f8f2 | wc -l` = **39**. All three checks agree.

## Verdict: **APPROVE**

Four surviving mutants, two of them High. **None is blocking.** Every finding is a
*missing test*, not a wrong behaviour — in all four cases I read the production
code and it is correct today. Nothing here ships a defect. They are regression
holes: real ones, with a named path by which a future change goes green while
breaking a documented contract. Same call as #195 — two High gaps, still approved
because additive.

The one thing I would ask for before the *next* change to `ft-task-card`,
`ft-kanban-column` or `ft-ready-queue-view` is F-2, because that is the change
that would walk into the hole.

Baseline re-established once, then left alone: `npm test` → 22 files, **407 passed**.
Every mutation below was applied to a clean tree and reverted to a clean tree
(`git diff --quiet` asserted before and after each run).

---

## 1. Required mutants — all five independently confirmed DEAD

I applied each mutation myself and ran both suite halves separately, because a
node-stage abort otherwise masks the vitest result. Dev claims match mine exactly.

| Mutant | node | vitest | Result |
|---|---|---|---|
| CMP-02 | exit 1 | 3 failed / 407 | **DEAD** |
| F3-05 | exit 0 | 1 failed / 407 | **DEAD** |
| RANK-09 | exit 1 | exit 0 | **DEAD** |
| ATT-01 | exit 0 | 5 failed / 407 | **DEAD** |
| ATT-02 | exit 1 | 26 failed / 407 (3 files) | **DEAD** |

**CMP-02** — `src/util/task-state-utils.ts:225`, `return a.id.localeCompare(b.id);` → `return 0;`

```
Error: the comparator must order a full rank/created_at tie by id, so a band listed in reverse id order is NOT in display order
    at assertSourceIsInDisplayOrder (.tmp-test/util/rank.test.js)
 Test Files  1 failed | 21 passed (22)
      Tests  3 failed | 404 passed (407)
   × compareAcceptedQueueOrder — expectation baseline > orders the mixed fixture by priority, rank, created-at, then id
   × ft-kanban-column — rendered ordering > renders cards in accepted-queue order, not input order
   × ft-ready-queue-view — rendered ordering > renders available rows in accepted-queue order
```

**F3-05** — `src/components/ready-queue/ft-ready-queue-view.ts:379`, `composed: true` → `false`

```
   × ft-app — a real refused gesture reaches the user as a toast > lets the refusal escape the shadow boundary to a listener outside the app
AssertionError: the refusal never left the app; is it still composed?: expected [] to have a length of 1 but got +0
 ❯ test/ft-app.write-error-seam.test.ts:239:78
```

**RANK-09** — `src/util/rank.ts:128`, `return Number.isSafeInteger(candidate) ? candidate : null;` → `return candidate;`

```
Error: M-3: tail past MAX_SAFE_INTEGER (rank 9007199254742016 must be a positive safe integer): expected true, got false
    at assertMove (.tmp-test/util/rank.test.js:100:9)
```

**ATT-01** — `src/components/task-filters.ts:64`, attention branch reduced to the plain dependency-blocked test

```
 Tests  5 failed | 402 passed (407)
   × attention filter — matchesTaskFilters > drops the task whose prerequisite is still open, despite the identical availability payload
   × attention filter — matchesTaskFilters > returns a strict subset of the dependency-blocked filter
   × attention filter — the board shows exactly the attention set > renders only the stranded task once the attention filter is applied
   × attention view — reachable end to end from the toolbar > lists exactly the stranded task after choosing Needs attention in the toolbar
   × attention view — the tile lands the user on the set it counted > clicking the tile navigates to the board showing exactly the counted tasks
```

**ATT-02** — `src/util/task-state-utils.ts:302`, `attentionBlockers()` returns `[]` unconditionally

```
 Test Files  3 failed | 19 passed (22)
      Tests  26 failed | 381 passed (407)
```

---

## 2. The near-miss fixture guard — verified, it genuinely guards

Both premises the attention tests rest on are load-bearing and both are pinned.
I broke each one and confirmed red.

**FIX-A** — `test/attention-view.test.ts:72`, `OPEN_BLOCKER` stage `WORKING` → `CANCELLED`
(destroys the one-from-two split):

```
 Tests  9 failed | 398 passed (407)
 FAIL  attention filter — matchesTaskFilters > is built on a fixture the real predicate splits one-from-two
AssertionError: expected [ 'stranded', 'waiting' ] to deeply equal [ 'stranded' ]
```

The guard fires **first** and names the problem precisely. That is the right design.

**FIX-B** — `WAITING.availability.reasons` gains `HELD` (destroys the byte-identical payload):

```
 Tests  1 failed | 406 passed (407)
   × attention filter — matchesTaskFilters > drops the task whose prerequisite is still open, despite the identical availability payload
```

No note here beyond: this is the strongest piece of test design in the line.

---

## 3. The fifteenth self-built oracle — **not found**

I swept all 26 test files, 3 helpers and `setup.ts` against the exported surface
of `task-state-utils.ts`, `rank.ts`, `safe-url.ts`, `task-ready.ts`,
`task-filters.ts`, `inspector-stage-utils.ts` and `grpc-error.ts`.

**No test file defines a local re-implementation of any production export.** Every
locally-defined function is a shadow-DOM query, an event synthesiser, a fixture
builder, or a text scraper. `rank.test.ts:88` even carries a docblock recording
the removal of a prior hand-written comparator.

Reported as a clean negative, not as an absence of effort. The one adjacent thing
worth knowing is in F-2 below — it is a different defect class, not this one.

---

## 4. Findings

### F-1 (High, additive) — `WRITE_FAILURE.partialRenumber` is an unbound sink

`src/components/ready-queue/ft-ready-queue-view.ts:490-493`

This is the exact shape the brief asked me to hunt, and it is the one place in
Phase 2 where it is live. **Deleting the message entirely leaves the suite green.**

Mutant **WF-01** — remove the `message` key from the `write-error` detail:

```
>>> WF-01: ***SURVIVED*** (vitest=0 node=0)       Tests  407 passed (407)
```

Mutant **WF-02** — `writes.length > 1` → `> 0` (send the renumber message for
single writes too, which is wrong by the constant's own docblock):

```
>>> WF-02: ***SURVIVED*** (vitest=0 node=0)       Tests  407 passed (407)
```

Root cause: the producer path *is* executed — `test/ft-ready-queue-view.rank.test.ts:154`
drives a real partial renumber failure — but it asserts only `feedback.sawFeedback()`,
which is `writeErrors.length > 0 || toasts().length > 0` (`test/helpers/feedback.ts:39`).
It never inspects `detail.message`. The one test that names the constant against a
mounted component, `test/ft-app.write-error-seam.test.ts:315-329`, **synthesises the
event itself** via `dispatchWriteError(view, { …, message: WRITE_FAILURE.partialRenumber })`.
That binds `ft-app`'s prefer-message-over-error branch — which is a genuine and
valuable r4 test — but it does not bind the queue's emission.

Worth flagging to the author: commit `3fb65f2` is titled *"anchor the partial-renumber
failure message"*. It anchored the **constant** and left the **emission** unbound.
The half that was hardest to get right is the half with no test.

**Recommendation:** in `ft-ready-queue-view.rank.test.ts:154`, assert the captured
`write-error` detail's `message` equals `WRITE_FAILURE.partialRenumber`, and add a
single-write failure case asserting `message` is absent. Two assertions; kills both mutants.

### F-2 (High, additive) — derived-loop tests shed their own cases; `DUPLICATE` is unprotected everywhere

Two test files build their case list by filtering a stage list through the very
predicate under test:

- `test/ft-task-card.attention.test.ts:55` — `NATIVE_STAGE_OPTIONS.filter(isUnsuccessfulTerminalStage)`
- `test/ft-inspector-relationships.test.ts:30` — `NATIVE_STAGES.filter(isUnsuccessfulTerminalStage)`

The intent is documented and good: *widen* the predicate and the loop covers the
new stage automatically. But the pattern is asymmetric — it protects against
widening and is blind to **narrowing**. Remove a stage and the test for that stage
does not fail; it *ceases to exist*, and the runner reports green on a smaller number.

The guard at `ft-task-card.attention.test.ts:57` only asserts `length > 0` and that
`COMPLETED` is false, so it does not pin the set.

Mutant **ATT-03** — drop `TaskStage.DUPLICATE` from `isUnsuccessfulTerminalStage`
(`src/util/task-state-utils.ts:177`):

```
>>> ATT-03: ***SURVIVED*** (vitest=0 node=0)       Tests  405 passed (405)
```

407 → 405. The two vanished tests are exactly:

```
ft-task-card — needs-attention badge > shows "Needs attention" when blocked by a DUPLICATE prerequisite
ft-inspector-relationships — dependency attention callout > warns that a Duplicate prerequisite is still blocking the task
```

Narrowing to a *single* stage is caught (`ATT-05` → WONT_FIX only: 14 failed;
`ATT-06` → CANCELLED only: 7 failed), because other fixtures hardcode `CANCELLED`
and `WONT_FIX`. **Nothing anywhere in the suite hardcodes `DUPLICATE` as an
attention blocker.** That is the whole gap.

The same shape recurs on `acceptsStageDrop`. Mutant **DROP-01** — make the
Duplicate lane accept drops (`src/util/task-state-utils.ts:98`):

```
>>> DROP-01: ***SURVIVED*** (vitest=0 node=0)       Tests  402 passed (402)
```

407 → 402. Five tests silently vanish:

```
cancels dragover on the DUPLICATE lane so the browser still fires drop
emits exactly the terminalLaneToast text for the Duplicate lane
gives visible feedback when a card is dropped on the DUPLICATE lane
refuses out loud when a card is dropped on the Duplicate lane
reports a refusal for a full drag gesture onto the DUPLICATE lane
```

`DROP-02` (the same mutation on `WONT_FIX`) is killed — 4 failures. Again, only
`DUPLICATE` is exposed.

DROP-01 is the higher blast radius of the two. `task-state-utils.ts:91-95` states
that `duplicate` "carries semantics a drag gesture cannot express (a reason, a
duplicate target)" and that the board "refuses drops onto them". Under DROP-01 the
board would accept the drag and issue a stage change to `DUPLICATE` with no
duplicate target — the precise outcome the docblock forbids — with a green suite.

**Recommendation:** keep the derived loops, and add one length assertion per loop
pinning the expected cardinality (`expect(attentionStages).toHaveLength(3)` /
`expect(refusingStages).toHaveLength(3)`), or assert the derived set equals a
literal stage list. A literal list restores the narrowing signal without giving up
the widening signal. Cheapest possible fix for both instances.

### F-3 (Medium, additive) — numeric availability reasons never exercised through a component

`src/components/task-filters.ts:67-73`. Every component-level filter test uses
`'available'`, `'unavailable'` or `'attention'`. No test mounts any component with
a numeric `AvailabilityReason` as `availabilityFilter`, so that branch is bound only
by direct unit calls. Reasoned about, not mutation-proven — I did not spend a run
on it because the branch is simple and the consequence is a filter showing too many
rows, not a wrong write.

### F-4 (Low, additive) — queue + attention combination has no test

`test/ft-ready-queue-view.availability.test.ts:66` pins a generic `'All clear!'`,
but nothing pins the specific *"Needs attention" selected on the Available Queue*
combination discussed as deferred item 3. If you accept that behaviour (I do — see
below), it should have a test that says so, otherwise the next person to see it
will read it as a bug.

---

## 5. Judgements on the four deferred items

**1. `ft-inspector-relationships.ts` unanchored copy — follow-up, not a blocker.**
The literal at `:308` is genuinely independent of `AVAILABILITY_REASON_LABEL`; the
component does not read the map, so this is a latent drift risk rather than a live
disagreement. Both strings read `'Blocked by dependency'` today. Ship it, fix it next.

One thing the dev did not report and I would add to that follow-up:
`REL_GROUP_LABEL` / `REL_GROUP_ORDER` (`inspector-stage-utils.ts`) are pinned
**nowhere** in `vocabulary.contract.test.ts`. Their only anchor is the literal
`SECTION_LABELS` at `test/ft-inspector-relationships.test.ts:27` — which is
deliberate and correct as a test (a literal is the right oracle for a label table),
but it means the anchor's "only place" claim has a fourth exception. Worth folding
into the same follow-up rather than filing separately.

**2. Seven positional parameters with a required `store` — right call.** I checked
all four production call sites (`ft-app.ts:384`, `ft-app.ts:680`,
`ft-kanban-view.ts:124`, `ft-ready-queue-view.ts:286`); every one passes the real
`taskStore`. The dev's reasoning is sound and I would go further: a required store
is the reason F-1 and F-2 are the *only* silent-wrong-answer paths I found. An
optional store would have added a third and made it unfindable. Deferring the
object-collapse until after the deploy is also right.

**3. "Needs attention" on the Available Queue shows "All clear!" — ship it.**
Here is the second opinion asked for. Attention tasks are dependency-blocked by
definition, so the queue is *correct* to list none; the alternative is a queue that
lies about availability to make one filter feel better. It is identical to the
existing `unavailable`/`Held` behaviour, so a special case would make attention the
one filter that behaves differently in that control — which is exactly the kind of
inconsistency that makes a UI hard to predict. The tile routes to the board, so the
affordance never lands a user there. Do not special-case. Do add F-4's test.

**4. The `ft-task-card` scope exception — correct, and it had to be done.**
Purely literal→constant, and leaving it would have falsified the anchor's central
claim on the day it was written. Right call to take the small scope overrun.

---

## 6. Coverage gaps by blast radius

| Gap | Would let a real defect ship? | Class |
|---|---|---|
| F-2 `DUPLICATE` unprotected in both derived loops | **Yes** — a drop onto the Duplicate lane issuing a stage change with no duplicate target, green suite | Blocking-adjacent, but not blocking *this* line: production is correct today |
| F-1 `WRITE_FAILURE.partialRenumber` unbound | Yes — a partial renumber failing silently or with the wrong wording | Additive |
| F-3 numeric availability reasons | Marginal — over-broad filter, no write consequence | Additive |
| F-4 queue + attention | No | Additive |
| `ft-dependency-view.ts` has no test file (10 `isReady`/`isClosedStage` sites) | Pre-existing, not introduced by Phase 2 | Out of scope, worth tracking |
| `store/stream-manager.ts` has no test file | Pre-existing | Out of scope, worth tracking |

Two notes that are neither findings nor Phase 2's fault:

- `src/util/safe-url.test.ts:60` pins `LOCAL_HTTP_LINKS_ENABLED` false under plain
  Node, while `test/ft-inspector-code.safe-url.test.ts:73` asserts a localhost link
  **is** rendered under vitest (`import.meta.env.DEV === true`). The two halves pin
  opposite branches of the same flag and nothing pins the production-build
  (`DEV === false`) behaviour at the component sinks. Not a defect — but if #195's
  hardening lands near this flag, that is the interaction to check.
- `RANK_STEP`, `MIN_RANK`, `RankedItem`, `RankWrite`, `LOCAL_HTTP_LINKS_ENABLED` are
  exported but consumed only by tests. Harmless.

---

## 7. What I verified by execution vs. reasoned about

**Executed** (mutation applied, suite run, tree reverted clean each time):
CMP-02, F3-05, RANK-09, ATT-01, ATT-02, ATT-03, ATT-05, ATT-06, DROP-01, DROP-02,
WF-01, WF-02, NAV-01, ATT-04, PARSE-01, WERR-01, TILE-01, DASH-COMP, FIX-A, FIX-B.
Twenty mutants; four survived (WF-01, WF-02, ATT-03, DROP-01).

Killed novel mutants worth recording as positive evidence — these seams *are*
covered: `NAV-01` (dropping `@filter-change` from the dashboard binding, 1 failure),
`ATT-04` (ignoring relationship type in `attentionBlockers`, 1), `PARSE-01`
(toolbar dropping the `'attention'` case, 3), `WERR-01` (r4's prefer-message branch
disabled, 6), `TILE-01` (tile rendered at zero count, 3), `DASH-COMP` (tile's
`filter-change` un-composed, 1). The r4 × attention-view interaction the brief
pointed at is genuinely bound in both directions.

**Reasoned about, not executed:** F-3; the four deferred-item judgements; the
`safe-url` DEV-flag observation; blast-radius rankings.

**Did not re-establish:** the green baseline, `tsc`, the build, `npm audit` — taken
from your gate run, as instructed. I ran `npm test` once to confirm 407 before
mutating.

No production code was modified. The working tree is clean at `633f8f2`.
