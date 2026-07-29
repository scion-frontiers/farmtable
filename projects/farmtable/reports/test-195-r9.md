# test-195-r9 — independent test review, issue #195 round 9

**Verdict: REQUEST CHANGES** (test-suite work). The production posture is sound and I
verified it independently; the objection is entirely to the round's own headline new
control, which I was able to make vacuous three different ways.

| | |
|---|---|
| Tree | `/workspace`, `git rev-parse --show-toplevel` = `/workspace` |
| Branch / commit | `markdown-sanitize-r9` @ `13680c2b7d7fd64841573894e5bb1224924eefdd` |
| Reviewer | independent leg; no production code modified; nothing pushed |
| Mutants executed | **107** |
| Predictions filed before measuring | 105 scoreable; **103 hit, 2 recorded misses** |
| Predictions file | `reports/test-195-r9-evidence/predictions.md` (written before the first mutant ran) |
| Harness | `/tmp/t9lab/mut.py` — content-addressed, child exit codes, `finally` restore, `git status --porcelain` asserted empty before and after every case |

## Baseline — re-measured by me, not inherited

```
cd /workspace/web && npm test        # exit 0 — "markdown sanitizer: 79 checks passed (127 assertions)"
cd /workspace/web && npx tsc --noEmit # exit 0
cd /workspace/web && npm run build    # exit 0
cd /workspace && git status --porcelain            # empty
cd /workspace && git diff --quiet -- web/src/util/markdown.ts   # exit 0
```

This **confirms the brief's `[MEASURED]` baseline** (79/127, tsc 0, build 0, clean).
It is the brief's claim; the numbers above are my own run.

---

# §1 — the vacuity census, with a denominator

## §1a — the dev's six-row table, re-derived

Extracted the pre-fix artefact with `git show 6108017:web/src/util/markdown.test.ts`
(never retyped) and mutated it against **HEAD's** `markdown.ts` — legitimate because
`6108017` is the only commit touching `markdown.ts` in `3f6a695..13680c2`, so the two
copies are byte-identical.

| id | loop emptied (`scanned` → `scanned.slice(0, 0)`) | pred | measured |
|---|---|---|---|
| P-0 | none — control, unmutated historical file | GREEN | **GREEN** 79/127 |
| P-a | mechanism (c), sanitizer ownership | GREEN | **GREEN** |
| P-b | mechanism (b), directive indirection | GREEN | **GREEN** |
| P-c | R7 promoted, escape ban | GREEN | **GREEN** |
| P-d | R6b promoted, dynamic-import specifier | GREEN | **GREEN** |
| P-e | `BANNED_SINKS` tripwire | GREEN | **GREEN** |
| P-f | the `sinks` collection loop | RED | **RED** — `expected exactly 2 unsafeHTML call sites, found 0` |

7/7 predictions hit. **I am confirming the dev's claim** (relayed by the brief as
"five of six GREEN"), and this is my own run of it, not an inheritance. `P-0` is the
control that proves the harness was measuring the right file.

## §1b — the widened census (the deliverable the brief asked for)

Enumerated mechanically at HEAD, then mutated **every** member of each population.

### Loops — denominator 49

| | count |
|---|---|
| `for`/`forEach` loops in `markdown.test.ts` | **49** |
| mutated (iterable → `.slice(0, 0)` / empty) | **49** |
| **vacuous (suite stayed GREEN 79/127)** | **26** |
| non-vacuous (RED) | 23 |
| TSC-FAIL (measured nothing) | **0** |

Vacuous loops, by line:

```
L111 L112 L692 L702 L2391 L3477 L3480 L3484 L3509 L3512 L3591 L3600 L3606
L3672 L3677 L3708 L3762 L3769 L3775 L3921 L4179 L4257 L4265 L4272 L4285 L4292
```

Three classes:

1. **23 fixture-consumption loops** — `for (const c of ARITY_EVASIONS)`,
   `SINK_EVASIONS`, `OWNERSHIP_*`, the message-format loops, the count-pin
   perturbation loop `for (const delta of [-1, 1])` at `:3708`, etc.
2. **2 loops inside `assertNoEventHandlers`** (`markdown.test.ts:111`, `:112`) —
   see finding **F9**; this is an *assertion helper* that can be emptied without
   any test noticing.
3. **1 loop in `lineOf`** (`:2391`) — a reporting helper.

**The round's scope was 6 of the 49.** The filed-and-fixed class was five loops; the
same mutation applied tree-wide yields 26. The brief said "assume mine is 40%
complete"; measured, the round's tree-wide scope covers **5 of 26 vacuous loops =
19%** of the class it names.

### Tables — denominator 25

| | count |
|---|---|
| named fixture tables / source-list constants | **25** (17 `fixtureTableViolation`-guarded + 8 unguarded) |
| mutated (emptied) | **25** |
| **vacuous** | **0** |
| TSC-FAIL | **0** |

Every one of the 25 is RED under emptying, **including all 8 unguarded tables**
(`REQUIRED_SINKS`, `INERT_EXTENSIONS`, `EXTRA_SCANNED_FILES`, `ARITY_SOUND_SOURCE`,
`RAW_DIRECTIVES`, `SINK_BINDINGS`, `SANITIZER_DEPENDENCIES`, `SOUND_SINK_FILE`) —
each is protected by a downstream count or content pin rather than by the guard.
**The T-4 repair is complete at the table level.** That is a clean result and I am
reporting it as one.

### Scanners

All 5 tree-wide scanner call sites and the 3 per-file scanners were mutated as part
of §2 and §3. Results are in those sections.

## §1c — attacking the definition (the thing the brief asked me to attack)

> "A loop is non-vacuous exactly when something asserts its result for an input whose
> answer is known in advance."

**The definition is false as stated, and the census is the counterexample.** Every one
of the 23 fixture-consumption loops *does* assert its result for inputs whose answers
are known in advance — that is precisely what a fixture table is — and all 23 are
vacuous under emptying. The loop over `ARITY_EVASIONS` asserts, for 17 known inputs,
a known answer; empty it and nothing moves.

The property that actually separates `P-f` from the other 48 is narrower:

> **A loop is non-vacuous under emptying exactly when some assertion requires a
> POSITIVE outcome from it** — a non-zero count, a specific offender, a named result.
> A loop whose assertion only ever *permits* an empty result cannot fail when emptied,
> because empty is the expected answer.

`P-f` is the only tree-wide loop whose product feeds a positive requirement
(`sinkCountViolation`: "expected exactly 2"). This is also why all 25 tables are RED
while 26 loops are GREEN: a table's emptiness is checked positively by
`fixtureTableViolation`; a loop's productivity is not checked at all.

This matters for the repair. `scanTreeWide` implements exactly the corrected
criterion for the five tree-wide loops (a planted probe forces a positive outcome) —
which is the right shape — but the criterion applies verbatim to the other 21 vacuous
loops and no equivalent exists for them. See **F4**.

## §1d — recorded prediction miss

**`L2660`** (per-file R6 relative-specifier loop): predicted GREEN, measured **RED**.
I was reasoning from the loop's shape rather than from what its consumer requires;
its output feeds a positive requirement I had not traced. Recorded per the brief's bar.

---

# §2 — auditing the vacuity detector (the headline findings)

`scanTreeWide` is at `markdown.test.ts:3156-3167`; `treeWideScanViolation` at
`:3178-3198`; the five call sites at `:3251`, `:3303`, `:3338`, `:3356`, `:3385`, each
followed by `if (vacuous !== null) throw new Error(vacuous);` at `:3265`, `:3329`,
`:3346`, `:3364`, `:3400`.

**Answer to the brief's question: yes, it can be vacuous — in three independent ways.**

| id | mutation | pred | measured |
|---|---|---|---|
| **D-1** | all five call sites hand the shared loop **51 entries with real `rel`s and `view: ''`** | GREEN | **GREEN 79/127** |
| D-2 | R7 call site only, `view: ''` | GREEN | **GREEN** |
| D-2b | mechanism (c) only, `view: ''` | GREEN | **GREEN** |
| D-2c | `BANNED_SINKS` only, `view: ''` | GREEN | **GREEN** |
| D-2d | all five sites handed 51 duplicates of `scanned[0]` | GREEN | **RED** *(miss — see below)* |
| D-3 | probe appended **FIRST** instead of last, loop intact | GREEN | **GREEN** |
| D-3b | probe FIRST **and** `runTreeWide` truncated to `entries[0]` | RED | **RED**, 5 of 79, `visited 1 entr(ies), not 51` |
| D-3c | probe LAST **and** truncated to `entries[0]` | RED | **RED**, 5 of 79, *identical message* |
| D-3d | `visited` arm disabled + truncated + probe **FIRST** | — | **GREEN** |
| D-3e | `visited` arm disabled + truncated + probe **LAST** | — | **RED**, 5 of 79, `the planted <tree-wide-probe> offender produced 0 report(s), expected exactly 1` |
| **D-5** | `treeWideScanViolation` body → `return null` | GREEN | **GREEN** |
| D-6 | R7's `if (vacuous !== null) throw` disarmed | GREEN | **GREEN** |
| D-7 | **all five** throws disarmed | GREEN | **GREEN** |
| D-8 | control run drops the probe entirely | RED | **RED**, 5 of 79, `produced 0 report(s), expected exactly 1` |
| D-9 | `visited: control.visited - 1` | GREEN | **GREEN** — equivalent mutant, not a finding |

### Answers to the brief's three specific questions

**"Is `EXPECTED_SOURCE_FILES` derived from the same enumeration it is checking?"**
**No — clean.** `markdown.test.ts:1201` is a hand-written literal `const
EXPECTED_SOURCE_FILES = 51;`, independent of the walk that produces `scanned`. The
circularity the brief was worried about does not exist. Reported as a clean result.

**"If a predicate short-circuits, does the visit count still reach
`EXPECTED_SOURCE_FILES`?"** **Yes.** `runTreeWide` (`:3149-3151`) does `visited += 1`
*before* calling the predicate, so predicate behaviour cannot suppress the count.
But note the count is of **iterations**, not of **distinct files** — which is exactly
the hole D-1 and D-2d walk through.

**"The probe is appended last; does anything depend on that position?"** **On the
shipped tree, no.** D-3b and D-3c produce byte-identical failures: under any
truncating mutation the `visited` arm fires first and the probe's position is never
consulted. The position becomes load-bearing only in the counterfactual where the
`visited` arm is also removed — D-3d (FIRST) **GREEN** vs D-3e (LAST) **RED** is the
pair that makes the docblock's "LAST on purpose" claim precise. It is defence in
depth with a currently-unreachable arm. See **F5**. This partially **contradicts a
premise in the brief**, which presents the two arms as co-equal ("requires the visit
count to equal ... **and** the planted entry to produce exactly one offender"): on
the shipped tree the second arm is unreachable through the first.

### Recorded prediction miss

**D-2d** (51 duplicates of `scanned[0]`): predicted GREEN, measured **RED**. The
failure attribution is `the sanitizer exclusively owns its own dependencies:
sanitizer configuration is reachable from another file:` — i.e. it was caught by the
*rule's own content check*, not by the detector. So D-2d does not rescue the
detector; it shows one rule happens to be content-sensitive enough to notice. D-1
(empty views) is the case that defeats all five.

---

# §3 — the two admitted gaps

## T8-4 — the per-file R7 pin, and how to make it discriminate on purpose

**Gap reproduced.** `G-0`: running the per-file R7 over the strings-KEPT view at
`markdown.test.ts:2600` is **GREEN**. This **confirms the dev's claim** (relayed by
the brief), measured by me. The gap is honestly recorded in-tree at
`markdown.test.ts:2698-2703`.

**Yes — it can be made to discriminate on purpose, with no production change and one
added fixture line.** Extend the existing false-positive control `fixture: a string
literal naming the sink identifiers is not a violation`
(`markdown.test.ts:3963-3976`) with a line whose escape lives inside a string:

```ts
"export const GLYPH = '\\u2611\\uFE0E';\n"
```

| id | state | measured |
|---|---|---|
| G-1 | as shipped (strings blanked) | **GREEN** |
| G-2 | with `{ strings: true }` at `:2600` (strings KEPT) | **RED** — `fixture: a string literal naming the sink identifiers is not a violation: string blanking regressed — the guard now rejects a correct sink file: src/components/inspector/sound-fixture.ts:6 — an escape outside a string …` |
| T8-3 | **cross-axis positive control**: tree-wide R7 over strings-KEPT | **RED** (independent axis, as the brief's verification bar requires) |
| T8-1b | per-file R7 delegation removed | **RED** — confirms the per-file half has unique coverage |

That is a one-line, fixture-only close. Handed to the developer as a recommendation,
not applied (§"collect discrepancies, don't fix them").

## C7-p — fixture-only, and where the bookkeeping lives

**Measured myself, not inherited.** Planted the C7-p payload live in
`markdown.ts:218`:

```
npm test → exit 2, output contains "error TS"
TS2345: Argument of type 'string' is not assignable to parameter of type '(x: string) => string'
```

→ **measured nothing.** This confirms the brief's `tsc`/TS2345 claim with my own run.

Cross-axis controls that DO compile, to prove the scanner is not merely inert here:

| id | payload | measured |
|---|---|---|
| G-4 | C7-n | **RED**, 1 of 79 |
| G-5 | C7-o | **RED**, 1 of 79 |
| G-6 | C7-q | **RED**, 1 of 79 |

**Answer to the brief's question: honest bookkeeping in the report, absent from the
tree.** The `ARITY_EVASIONS` entry at `markdown.test.ts:1830-1838` carries no note
that it has no live-tree counterpart. Contrast T8-4, which *is* recorded in-tree at
`:2698-2703`. Reports get archived; the tree is the next round's input. See **F7**.

---

# §4 — the count pins and the two-units ruling

## The pins, with my own RED evidence

Every pin below was re-derived by mutating `markdown.ts:218` (the production file,
reverted immediately; `git diff --quiet` re-asserted after each).

| pin | mutation | before (`3f6a695` test file) | after (HEAD test file) |
|---|---|---|---|
| **MUST 1 / A-D1** | `md: string \| \`)\`` + defaulted 2nd param | **GREEN 78 checks / 123 assertions** | **RED, 1 of 79** — `renderMarkdown accepts exactly one parameter: src/util/markdown.ts: renderMarkdown declares 2 parameters: (md: string \| \`)\`, opts: { inline?: boolean } = {})` |
| **MUST 1 / A-D4** | `md: string \| \`(\`` | **GREEN 78/123** | **RED, 1 of 79** |
| A-D2 (cross-axis control) | `md: string \| ")"` bare string | RED, 1 of 78 | RED, 1 of 79 |
| **MUST 2 / B3a** | revert to process-global singleton, `const purifier = createDOMPurify;` | — | **RED, 1 of 79** — message quotes the exploit verbatim: `found "onerror" in "<p><img src=\"x\" onerror=\"alert(1)\"><script>alert(2)</script></p>\n"`; `npx tsc --noEmit` exit 0 (so the mutant compiled and really measured) |

Both blockers are genuinely closed. A-D2 is a same-payload-class control that was RED
*before* the fix too, which is why A-D1/A-D4 (GREEN→RED) is the evidence that matters.

## The provenance series — re-derived over all 42 commits, not the sampled ones

I did not sample; I walked every commit touching `markdown.test.ts` with `git show`
and counted `check(` call sites, `EXPECTED_CHECKS`, and derived checks-run.

| rev | `check(` call sites | `EXPECTED_CHECKS` | derived checks run | assertions |
|---|---|---|---|---|
| 7084880 | 49 | 49 | 49 — **coincident** | — |
| 849a9da | 51 | 52 | 52 — **divergence begins**; this is the commit that introduces `for (const rel of REQUIRED_SINKS)` | — |
| 951ee89 | 53 | 54 | 54 | — |
| 615a355 | 58 | 59 | 59 | — |
| 14468da | 60 | 61 | 61 (first commit at 61) | — |
| 3b5312b | 60 | 61 | 61 | — |
| fc2b947 / 86f30bc | 68 | derived | 69 | — |
| 7b4f6dd | 74 | derived | 75 | 122 |
| 3f6a695 | 77 | derived | 78 | 123 |
| 13680c2 | 78 | derived | **79** | **127** |

**The ruling is correct and I am confirming it with my own walk.** `61 → 69` is
checks-run → checks-run (no unit switch); the unit switch happens at `68 → 74`; the
two units have differed by exactly `REQUIRED_SINKS.length - 1 = 1` continuously since
`849a9da`, and coincided at 49 only because `REQUIRED_SINKS` did not yet exist as a
loop. The brief's framing — coincidental equality at a series origin — is confirmed.
**I do not think the ruling is wrong.**

Unit markers in-tree are on `:4331` (54→59 CHECKS RUN), `:4338` (59→61 CHECKS RUN),
`:4344` (61→69 CHECKS RUN), `:4387` (68→74 CHECK() CALL SITES), `:4404` (74→77),
`:4411` (77→78). **Six markers, all on the right entries.** Clean.

---

# §5 — expected-clean checks (all three clean, reported as required)

| check | result |
|---|---|
| No test weakened, skipped, or assertion removed | **CLEAN.** `git diff 3f6a695..13680c2 -- web/src/util/markdown.test.ts`: **0** `assert*` calls removed, **4** added — all four inside `renderMarkdown does not use the process-global DOMPurify singleton` at `:925-960`, exactly matching 123 → 127. **0** `check(` call sites removed, **1** added, matching 77 → 78. **0** `.skip` / `xit` / `TODO` / early-return markers added. Three `throw new Error` lines removed, all three re-emitted at new indentation inside the `scanTreeWide` restructure (net 0). |
| No fixture table shrank | **CLEAN.** `ARITY_EVASIONS` 13→17, `ARITY_LEGITIMATE` 8→11, `SINK_EVASIONS` 24→27, plus four new tables (`OWNERSHIP_LEGITIMATE` 4, `OWNERSHIP_LAUNDERING` 3, `OWNERSHIP_INERT_ASSETS` 2, `SINK_CALL_LEGITIMATE` 8). Guarded fixture tables 13 → 17. No table lost an entry. |
| Every new control throws | **CLEAN**, and independently corroborated: `EXPECTED_ASSERTIONS` moved exactly +4 and I located exactly 4 added `assert*` calls. |

Also clean: `markdown.ts` change over `3f6a695..13680c2` is **comment-only** — verified
by filtering the diff to non-comment, non-blank added/removed lines, which is empty.
**Confirming the brief's `[MEASURED]` claim with my own filter.** And: there is no
`.github/workflows`; **confirming the brief's "no CI" claim.**

---

# Findings, severity-rated

### F1 — HIGH — the tree-wide loops are still vacuous *with respect to their input*
`web/src/util/markdown.test.ts:3156-3167` (`scanTreeWide`), `:3178-3198`
(`treeWideScanViolation`); call sites `:3251`, `:3303`, `:3338`, `:3356`, `:3385`.

**Evidence D-1: GREEN 79/127** with all five call sites feeding the shared loop 51
entries carrying real `rel`s and `view: ''`. `scanTreeWide` pins loop **cardinality**
and predicate **sensitivity** to a synthetic probe, but nothing about the **content**
of the real views. A regression in `stripInertText` / `literalBlindView` that blanked
everything — which is the exact class of bug T-3 through T-8 were about — would ship
green through all five tree-wide rules.

*Recommendation (not applied):* have `scanTreeWide` also assert a **canary drawn from
the real tree** — e.g. that the entry whose `rel` is `src/util/markdown.ts` has a view
containing `renderMarkdown` — or minimally require `entries.every(e => e.view.length > 0)`.

### F2 — HIGH — the vacuity detector has no self-test
`web/src/util/markdown.test.ts:3178-3198`.

**Evidence D-5: GREEN** with the whole body replaced by `return null`. This is the
rule-15 shape the brief named: the fix that proves other controls are not vacuous is
itself unproven. There is a precedent *in this same file*: `fixtureTableViolation`
received exactly such a self-test in round 8 —
`fixture: the table-size pin fires on a changed table length` at `:3823`.
`treeWideScanViolation` needs the equivalent.

### F3 — MEDIUM — the detector's five call sites are unpinned
`web/src/util/markdown.test.ts:3265`, `:3329`, `:3346`, `:3364`, `:3400`.

**Evidence D-6 GREEN** (disarm R7's throw) and **D-7 GREEN** (disarm all five). A
fixture asserts a *predicate*; nothing asserts the predicate is *invoked*. A future
refactor can delete a `if (vacuous !== null) throw` and the suite will not notice.

*Recommendation:* a module-level counter of detector invocations pinned in `run()`, in
the style of `EXPECTED_CHECK_CALL_SITES`.

### F4 — MEDIUM — 21 vacuous loops outside the round's scope
`web/src/util/markdown.test.ts:692`, `:702`, `:3477`, `:3480`, `:3484`, `:3509`,
`:3512`, `:3591`, `:3600`, `:3606`, `:3672`, `:3677`, `:3708`, `:3762`, `:3769`,
`:3775`, `:3921`, `:4179`, `:4257`, `:4265`, `:4272`, `:4285`, `:4292`.

26 of 49 loops are vacuous under the identical mutation the round used; the round
repaired 5. These are fixture-consumption loops, and the corrected criterion in §1c
applies to them verbatim.

*Recommendation:* one helper, `scanFixtureTable(name, table, expectedLen, fn)`, that
pins the table length **and** counts visits — collapsing `fixtureTableViolation` plus
its loop the same way `scanTreeWide` collapsed the five tree-wide loops. Same repair,
one level over. Note `:3708` is the count-pin perturbation loop `for (const delta of
[-1, 1])` — emptying it silently disables the control that proves the count pins fire.

### F5 — LOW — the "probe appended LAST" rationale has an unreachable arm
`web/src/util/markdown.test.ts:3118-3119` (docblock), `:3163` (the append).

D-3b (probe FIRST + truncate) and D-3c (probe LAST + truncate) produce byte-identical
failures — the `visited` arm always fires first on the shipped tree. The rationale
becomes true only under D-3d/D-3e, where the `visited` arm is also removed. The
docblock states the property as if it were load-bearing today; it is defence in depth.
This is an accuracy defect in a rationale comment — the same defect class round 9
itself corrected twice in `markdown.ts`.

### F6 — LOW — the fixture-table count recipe re-instantiates the defect it documents
`web/src/util/markdown.test.ts:3804-3811`, occurrences at `:3804` and `:3806`.

The round-9 correction (`1ec4a7b`, "the fixture-table count recipe was counting
itself") says the naive recipe is **off by one** because the comment contains the
string it greps for. Measured at HEAD:

```
grep -c "fixtureTableViolation('"        → 23
grep -c "^      fixtureTableViolation('" → 17   (the true count)
```

Non-anchored lines: `:3804`, `:3806`, `:3825`, `:3832`, `:3835`, `:3838`. The naive
recipe minus the four `'X'` self-test calls gives **19**, i.e. **off by two**, not one.
At `6108017` (before the correction) it was 22/17 → 18, off by one — correct as
written *then*. The correction added a **second** occurrence of the greppable string
and therefore re-created the defect at double the stated magnitude. Magnitude 2, not 1.

### F7 — LOW — C7-p's fixture-only status is not recorded in the tree
`web/src/util/markdown.test.ts:1830-1838`.

The status is documented in `reports/dev-195-r9.md`, which is honest, but the
`ARITY_EVASIONS` entry itself carries no note that this row has no live-tree
counterpart (TS2345). The in-tree precedent is T8-4 at `:2698-2703`. One comment line.

### F8 — INFO / actionable — T8-4 is closable now, one fixture line
`web/src/util/markdown.test.ts:3963-3976`. Patch and G-1/G-2 evidence in §3 above.
Severity is INFO only because the gap is already recorded in-tree; the point is that
the "expiry date" the brief worried about can be removed today.

### F9 — INFO — `assertNoEventHandlers` has no positive control
`web/src/util/markdown.test.ts:109-118`.

Both of its loops (`:111`, `:112`) can be emptied with the suite GREEN, because no
fixture in the suite ever hands it HTML that actually contains an event handler. It
is the only `assert*` helper containing a scanning loop, and it is unproven. One
fixture asserting that it *throws* on `<img onerror=…>` closes it.

---

# Why REQUEST CHANGES rather than APPROVE

The security work is **approved on the merits and verified independently**: both
blockers are genuinely closed (A-D1/A-D4 GREEN→RED, B3a RED with a verbatim exploit
string), no test was weakened, no table shrank, all 25 tables are non-vacuous, the
units ruling holds, and the count pins are sound.

The objection is narrow and specific: **the round's own new control fails the round's
own stated rule.** `scanTreeWide` was introduced to prove other controls are not
vacuous, and I made it vacuous three ways (D-1 input-blind, D-5 neutered, D-7 call
sites removed), each with the suite reporting a clean 79/127. Round 8 set the
precedent by giving `fixtureTableViolation` a self-test; round 9's analogue does not
have one. F1 and F2 are the blocking items. F3–F9 are non-blocking.

---

# Every place this brief was wrong

Per the brief's required deliverable. Four items; none of them change any verdict, and
two are pedantic-but-load-bearing given that §4 is a section *about* unit confusion.

1. **§4, "`EXPECTED_CHECKS` 78→79"** — *imprecise in exactly the way §4 warns about.*
   `EXPECTED_CHECKS` is not a stored number that moved; it has been the unchanged
   derived expression `EXPECTED_CHECK_CALL_SITES + (REQUIRED_SINKS.length - 1)` since
   `fc2b947`. What moved 78→79 is its **value**, as a consequence of
   `EXPECTED_CHECK_CALL_SITES` 77→78. `git show c331abf` changes exactly two literals:
   `EXPECTED_CHECK_CALL_SITES` 77→78 and `EXPECTED_ASSERTIONS` 123→127. In a section
   whose whole subject is two units sharing a name, describing a derived value as if
   it were an edited constant is the same slip one level up.

2. **§2, the two arms presented as co-equal** — "requires the visit count to equal
   `EXPECTED_SOURCE_FILES` **and** the planted entry to produce exactly one offender."
   On the shipped tree the second arm is **unreachable**: every mutation that could
   trip it trips the `visited` arm first (D-3b ≡ D-3c, byte-identical messages).
   Reaching the probe arm requires disabling the `visited` arm (D-3e). See F5.

3. **§4, "The check-total pin *fired* at 79-vs-78 when the B3a check was added"** —
   this is a claim about the developer's working session that **cannot be verified
   from the tree**, and the tree evidence is neutral-to-contrary: `c331abf` updates the
   pin and adds the check in the *same* commit, so no commit in history exhibits the
   firing state. I can confirm the pin *would* fire (reverting
   `EXPECTED_CHECK_CALL_SITES` to 77 at HEAD is RED), which is a different statement.
   Not an error, but tagged `[MEASURED]` when it is at best `[MEASURED-BY-dev]`.

4. **§1, "the filed list was 40% complete; assume mine is too"** — the arithmetic is
   right (2 of 5) but the implied scale is a substantial under-estimate. Measured
   against the population the definition actually covers, the round's scope is **5 of
   26 = 19%**, and the census denominator is 49 loops + 25 tables, not 6.

**Checked and found correct** (so that the absence of a finding is itself measured):
the tree/branch/commit identifiers; the baseline 79/127, tsc 0, build 0, clean tree;
"`markdown.ts` changed comment-only" (verified by comment-filtered diff); "no CI"
(no `.github/workflows`); "five of six loops stayed GREEN" (P-a..P-f, 7/7);
"attribution is by the probe's own `rel`, not a bare count" (D-8 message names
`<tree-wide-probe>`); T8-4's GREEN and its in-tree recording; C7-p's TS2345;
guarded fixture tables 13→17; the two units coinciding at 49 and diverging after;
the units ruling itself.

---

# Discipline / integrity record

- **107 mutants**, 105 scoreable predictions, **103 hit, 2 misses recorded**
  (`L2660` predicted GREEN measured RED; `D-2d` predicted GREEN measured RED). Both
  kept on the record with the reasoning error named.
- **0 TSC-FAIL mutants counted as evidence.** Every mutant's output was scanned for
  `error TS`; the one payload that failed to compile (C7-p live) is reported as
  "measured nothing", not as a result.
- Exit codes taken from `subprocess.run(["npm","test"])` on the child; never through
  a pipe.
- Historical artefacts extracted with `git show`, never retyped.
- `git status --porcelain` asserted empty before and after **every one of the 107**
  cases; tree restored in a `finally`.
- **No production code modified.** Post-run: `git diff --quiet -- web/src/util/markdown.ts`
  exit 0; `git status --porcelain` empty; `npm test` 0 (79/127); `npx tsc --noEmit` 0;
  `npm run build` 0.
- **Nothing pushed.**

Evidence: `reports/test-195-r9-evidence/predictions.md` (pre-measurement), harness
`/tmp/t9lab/mut.py`, specs/results `/tmp/t9lab/spec-*.json` + `res-*.json`.
