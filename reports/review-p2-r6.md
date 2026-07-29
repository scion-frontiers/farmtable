# review-p2-r6 — `phase2-web-ui-r5` `b429a40..4f30c4e` (5 commits) — Review

## Executive Summary

All four blocking items are fixed, and — the question that actually mattered — **every
one of the eleven new tests is capable of going red.** I proved that by mutation rather
than by reading: thirteen targeted mutations against the four fix sites, each run against
the full 422-test component suite. Twelve killed, one survived by construction and is
inherent rather than a defect in this delta. Risk: **LOW**.

**Verdict: APPROVE.**

---

## Verification performed

Cloned `/workspace/farmtable` to `/tmp/ftrev` at `4f30c4e`, copied `node_modules`, worked
only there. Canonical untouched; no `web/dist` created or deleted anywhere.

| Command | Result |
|---|---|
| `npx vitest run` (components) | **422 passed / 22 files** (was 407 pre-delta) |
| `node scripts/run-node-tests.mjs` | **4 script(s) passed** |
| `npx tsc --noEmit` | **clean, exit 0** |

`npm run build` not run, per the brief. All mutations reverted; clone verified clean
against `4f30c4e`.

---

## Per-item disposition

### H-1 — inspector attention copy is a fifth unanchored wording → **FIXED**

`ft-inspector-relationships.ts:226,228,306` now bind `ATTENTION.calloutTitle`,
`ATTENTION.calloutBody(n)` and `AVAILABILITY_REASON_LABEL[BLOCKED_BY_DEPENDENCY]`;
the constants land at `task-state-utils.ts:307,317`. The test file's transcribed
`ATTENTION_TITLE`/`PLAIN_BLOCKED_TITLE` locators (`ft-inspector-relationships.test.ts:141,142`)
now import instead, and the `Object.keys(ATTENTION)` completeness guard
(`vocabulary.contract.test.ts:430`) was extended, so a sixth entry cannot slip in unpinned.

Mutation evidence:

| Mutation | Killed |
|---|---|
| Re-hardcode the callout title in the inspector | **8 tests** |
| Revert the callout body to the old ternary | **5 tests** |
| Drift `ATTENTION.calloutTitle` away from `label` | **1** (`vocabulary.contract.test.ts:276`) |
| Replace `calloutBody` with the old "is still blocking" wording | **3** |
| Rename `AVAILABILITY_REASON_LABEL[BLOCKED_BY_DEPENDENCY]` (the review's own r4 simulation, which was green at 407/407) | **1** — and the inspector test correctly stays green, because it now follows the constant |

That last row is the specific thing H-1 asked for and it now behaves correctly: the rename
fails exactly one test, in the file that owns the vocabulary, and the panel follows the
chip instead of diverging from it.

One residual, reported below as FYI, not as a blocker: re-hardcoding the *availability*
label back into the inspector (`:306` → the literal `Blocked by dependency`) leaves the
suite at **422/422 green**, because the literal and the constant are the same string. No
assertion can distinguish `${CONST}` from a matching literal; only the grep-style guard the
phase-2 review floated at `review-phase2.md:337` retires that class. Out of scope here.

### M-2 / F-2 / ATT-03 — `DUPLICATE` clause unpinned (narrowing-blind derived loops) → **FIXED**

Four explicit cardinality pins added next to the four derived loops:
`ft-task-card.attention.test.ts:70`, `ft-inspector-relationships.test.ts:458`,
`ft-kanban-view.contract.test.ts:239` and `:351`,
`ft-kanban.drop-refusal-affordances.test.ts:259`.

| Mutation | Before (phase-2 report) | Now |
|---|---|---|
| `DUP-DROP` — drop `DUPLICATE` from `isUnsuccessfulTerminalStage` | **0 killed**, total 407→405 | **2 killed** |
| Drop `CANCELLED` from the same predicate | 14 incidental | **16 killed**, incl. both new pins |
| Make the `DUPLICATE` lane start accepting drops (`acceptsStageDrop` widened) | n/a | **3 killed** — all three new kanban pins |

The live mutant is dead. Note the pins also cover the second predicate
(`acceptsStageDrop`), which the original finding only implied.

### M-3 / F-1 — partial-renumber threshold unpinned → **FIXED**

Both halves of the seam are now pinned from the producer side, at
`ft-ready-queue-view.rank.test.ts:182` and `:210`.

| Mutation on `ft-ready-queue-view.ts:491` | Before | Now |
|---|---|---|
| `writes.length > 1` → `> 0` (the original `WF-THRESHOLD`) | **0 killed** | **1 killed** — the "omits" case |
| `writes.length > 1` → never attach | n/a | **1 killed** — the "attaches" case |

The two tests are complementary, not redundant: each kills a different direction of the
threshold. The "attaches" test is the one that took real care — it fails the *second* write
via `updateTaskResponse` rather than the first via `rejectUpdateWith`, which is the only
construction that produces the genuine part-way state the message describes.

### Audit L-1 — toast HTML-escaping unpinned on a user-controlled path → **FIXED**

`ft-app.write-error-seam.test.ts:345`. Mutating `document.createTextNode(message)` to
`insertAdjacentHTML('beforeend', message)` — the exact mutant that survived 407/407 in the
phase-2 audit — now **kills 1 test**. The load-bearing assertion is
`alert.querySelector('img')` plus the verbatim-text check; the `globalThis.__xss` assertion
is decorative under jsdom (see FYI-3).

### Audit L-2 — safe-url contract table has no credential case → **FIXED**

Three rows at `safe-url.contract.test.ts:376-378`. Deleting the check at `safe-url.ts:63`
now **kills 4** contract-suite tests (was 0). The defence no longer rests on the plain-Node
runner alone.

---

## "What would make this fail?" — one line per new/modified test

| Test | Goes red when |
|---|---|
| `vocabulary.contract.test.ts:276` heads the callout with the same two words | `ATTENTION.calloutTitle` stops being `'Needs attention'`, or stops equalling `label` |
| `:281` reads naturally for a single | the singular `calloutBody(1)` string changes by one character |
| `:289` counts and pluralises | the plural `calloutBody(n)` string or its `${n}` interpolation changes |
| `:303` conveys permanence in both forms | **nothing reachable that `:281`/`:289` do not already catch** — see FYI-1 |
| `:430` pins every entry in `ATTENTION` | a sixth `ATTENTION` key is added without pinning it |
| `ft-inspector-relationships.test.ts:458` warns for exactly three | `isUnsuccessfulTerminalStage` or `NATIVE_STAGES` narrows or widens |
| `:471,:480,:592` (modified body assertions) | the inspector stops rendering `calloutBody(n)` — reverting to the old ternary kills all three |
| `ft-task-card.attention.test.ts:70` treats exactly three | same predicate narrows/widens |
| `ft-kanban-view.contract.test.ts:239` / `:351` | `acceptsStageDrop` starts accepting, or refusing, a different set of lanes |
| `ft-kanban.drop-refusal-affordances.test.ts:259` | ditto, off `NATIVE_STAGE_OPTIONS` |
| `ft-ready-queue-view.rank.test.ts:182` attaches | the queue stops attaching `WRITE_FAILURE.partialRenumber` on a genuine multi-write failure, or the renumber path collapses to a single write (premise assertion) |
| `:210` omits | the threshold loosens to `> 0`, so a single failed write falsely claims a partial save |
| `ft-app.write-error-seam.test.ts:345` renders as text | the toast sink parses its message as markup |
| `safe-url.contract.test.ts:376-378` | the embedded-credential rejection at `safe-url.ts:63` is removed or weakened |

**One test cannot go red on its own** — `vocabulary.contract.test.ts:303`. It is subsumed,
not false; details in FYI-1.

---

## Critical

None.

## Required

None.

## Nit / Optional

**N-1 — `ATTENTION`'s header docblock is now stale (`task-state-utils.ts:277-283`).**
It still reads *"One phrase, four places: the card badge, the Availability filter option,
the active-filter chip, and the dashboard tile."* This delta makes the inspector callout the
fifth, and the new `calloutTitle` docblock says so two lines below. The header is the first
thing the next author reads. *Fix:* say five places and name the callout. **Nit.**

**N-2 — the "omits" test's premise assertion is weaker than its comment
(`ft-ready-queue-view.rank.test.ts:225-227`).** The comment claims it proves
`ranksForMove` took the single-write path; `expect(client.updateTaskCalls).toHaveLength(1)`
actually only proves the loop made one call before `rejectUpdateWith` threw — it would read
`1` even if `writes.length` were 3. No false pass is possible today (the outcome assertion
still binds the threshold, proven by the `> 0` mutant), so this is a comment that overstates
its assertion rather than a hole. *Fix:* either soften the comment or assert the emitted
write count the way the sibling test does. **Optional.**

**N-3 — `updateTaskResponse` is being used off-label as a failure injector
(`ft-ready-queue-view.rank.test.ts:190`).** Its docblock (`helpers/fixtures.ts:129-141`)
says it exists to make responses *diverge*; throwing from it works, but the next reader of
the helper will not expect it. *Fix:* add a documented `failUpdateAfter(n)` to
`RecordingClient` and use it, or extend the existing docblock to sanction the throw.
**Optional.**

**N-4 — copy inconsistency between `explanation` and `calloutBody`.** `explanation` uses
`"won't be fixed"`, `calloutBody` uses `"will not be fixed"`; and in the plural form,
*"3 prerequisites were cancelled … so nothing will clear it on its own"* leaves `it` with
no clear antecedent. This is the reviewer's own suggested wording adopted verbatim, so I
am not going to relitigate it — flagging only so it is a decision rather than an accident.
**Nit.**

## FYI

**FYI-1 — `vocabulary.contract.test.ts:303` ("conveys permanence in both plural forms")
cannot fail independently.** It checks `calloutBody(1)` and `calloutBody(2)` contain two
substrings, but `:281` and `:289` already pin the full singular and plural strings
character-for-character, and `calloutBody(2)` and `calloutBody(3)` take the same branch.
Any mutation that breaks `:303` breaks one of those first — the mutation run confirms it:
the "drop permanence" mutant killed all three together, never `:303` alone. It is
documentation of *why* the strings are what they are, and reads well as that. No action;
I mention it only because the EM asked for an exhaustive answer to "what would make this
fail" and this is the one row where the honest answer is "nothing the others miss."

**FYI-2 — anchoring itself is unenforceable by assertion.** Re-hardcoding the literal
`Blocked by dependency` at `ft-inspector-relationships.ts:306` leaves the suite fully green
(422/422 verified). This is inherent — the literal and the constant are the same string —
and the phase-2 review already named the grep-based guard as the class-level remedy
(`review-phase2.md:337`). H-1's *concrete* drift is gone; the *category* is not, and cannot
be closed by anything in this delta.

**FYI-3 — the `globalThis.__xss` assertion in the toast test is decorative.** jsdom does
not load subresources, so `<img onerror>` never fires whether or not the sink is safe. The
two assertions either side of it (`querySelector('img')` is null, and the text appears
verbatim) are the ones that actually killed the mutant. Harmless, and arguably good
documentation of intent; just do not count it as coverage. Also note it writes a key onto
`globalThis` with no cleanup — currently a no-op, but it would leak across tests in the file
if it ever did fire.

## Positive Feedback

Three things are genuinely above the bar here.

- **The `> 1` threshold test picks the right failure mode.** Failing the second write rather
  than the first is the difference between testing the message and testing the message's
  *precondition*. The comment at `:190-193` explains exactly why `rejectUpdateWith` would
  have been the wrong tool. That is the distinction the original finding was about, and the
  author got it rather than writing the easy version.
- **The cardinality pins name the asymmetry they fix.** Each of the four docblocks states
  that derivation protects against widening and is blind to narrowing. That is the actual
  root cause from the phase-2 report, restated where the next author will hit it — not just
  a test bolted on to close a finding.
- **The kanban pins cover a predicate the finding did not ask about.** M-2 was raised
  against `isUnsuccessfulTerminalStage`; the author noticed the same narrowing-blindness in
  `acceptsStageDrop` and pinned that too. The `M2c` mutant I ran only dies because of that
  extra work.

## Test Coverage

Complete for the delta. Both production changes are covered: the inspector's three bindings
by five killed mutants, and the `ATTENTION` additions by four vocabulary tests plus the
completeness guard. Net +15 tests, +2 in the node suite path (unchanged there). No new
uncovered branch: `calloutBody`'s `n === 1` and `n > 1` arms are both pinned, and `n === 0`
is unreachable (the callout only renders when `blockers.length >= 1`).

## Backward Compatibility

None at risk. No wire format, no exported signature removed. `ATTENTION` gains two keys;
it is `as const` and consumed internally only. The inspector's rendered copy changes, which
is the point of the fix — one user-visible string change, deliberate and pinned.

## SURFACED-NOT-CHASED

- The `ATTENTION` docblock's "four places" count (N-1) suggests nobody greps for surface
  counts when a fifth consumer is added; there may be similar stale enumerations on the
  other vocabulary anchors. One-line note only; not investigated.

## Final Verdict

**APPROVE.** Four items fixed, twelve of thirteen mutants killed, no test that cannot go
red on a reachable change. N-1 through N-4 are non-blocking and can ride a cleanup pass or
be dropped with a one-line disposition.
