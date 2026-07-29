# test-195-r9 — predictions, written BEFORE any mutation was run

Tree: `/workspace`, branch `markdown-sanitize-r9`, HEAD `13680c2`, `git status --porcelain` empty.
Baseline re-measured by me, not inherited: `npm test` exit 0, `markdown sanitizer: 79 checks
passed (127 assertions)`.

Harness: `/tmp/t9lab/mut.py`. Content-addressed (a line mutation aborts unless the line matches
byte-for-byte; a substring mutation aborts unless it occurs exactly once). Exit code from
`subprocess.run(["npm","test"])`, never through a pipe. Output containing `error TS` is flagged
`TSC-FAIL(measured-nothing)`. Tree restored in a `finally` and `git status --porcelain` asserted
empty before and after every case.

## Oracle-first (brief's bar: ask what the oracle can discriminate before what the inputs vary)

The suite's oracles are exactly four:

1. `failures` non-empty → non-zero exit (per-check throws).
2. `checks !== EXPECTED_CHECKS` (79).
3. `assertions !== EXPECTED_ASSERTIONS` (127) — **only reported when `failures` is empty**.
4. process-level throw (an uncaught error outside a `check`).

Everything else — every fixture table, every loop — reaches the outside world only through one of
those four. So my prior for a loop mutation is: **RED iff emptying the loop either (a) removes an
`assert*` call, (b) removes a `check()` call, or (c) makes some rule's output disagree with a
number that is pinned independently.** A loop whose only product is "a list of offenders that is
supposed to be empty" cannot be red under emptying, because empty is the expected answer.

That predicts the fixture-consumption loops are **all vacuous**, which is a much larger class than
the six tree-wide loops this round measured.

## §1a — re-derivation of the dev's six-row table at `6108017` (pre-T-9-fix)

Extracted with `git show 6108017:web/src/util/markdown.test.ts`, never retyped.

| id | loop emptied | my prediction |
|---|---|---|
| P-a | mechanism (c), sanitizer ownership | GREEN (vacuous) |
| P-b | mechanism (b), directive indirection | GREEN (vacuous) |
| P-c | R7 promoted, escape ban | GREEN (vacuous) |
| P-d | R6b promoted, dynamic-import specifier | GREEN (vacuous) |
| P-e | BANNED_SINKS tripwire | GREEN (vacuous) |
| P-f | the `sinks` collection loop | RED (`sinkCountViolation`) |

## §1b — widened census, at HEAD

49 `for`/`forEach` loops exist in `markdown.test.ts` (enumerated mechanically). 25 named data
tables/source fixtures exist. I mutate **all 49 loops** and **all 25 tables**.

Loop predictions (L<line>): RED for 1206, 1289, 1366, 1960, 2233, 2350, 2399, 2567, 2608, 2623,
2726, 2770, 2864, 2874, 2876, 3056, 3149, 3206, 3235, 3283, 3284, 747.
GREEN (vacuous) predicted for 111, 112, 692, 702, 2391, 2660, 3477, 3480, 3484, 3509, 3512, 3591,
3600, 3606, 3672, 3677, 3708, 3762, 3769, 3775, 3921, 4179, 4257, 4265, 4272, 4285, 4292.

That is a predicted **27 vacuous of 49**.

Table predictions: the 17 `fixtureTableViolation`-guarded tables all RED. Of the 8 unguarded:
REQUIRED_SINKS RED (scope pin), EXTRA_SCANNED_FILES RED (file count), INERT_EXTENSIONS ?,
ARITY_SOUND_SOURCE RED, RAW_DIRECTIVES RED, SINK_BINDINGS RED, SANITIZER_DEPENDENCIES RED,
SOUND_SINK_FILE RED.

## §2 — can the vacuity detector itself be vacuous?

`treeWideScanViolation` pins two things: the real run's **cardinality** (`visited ===
EXPECTED_SOURCE_FILES`) and the predicate's **sensitivity** (the planted probe yields exactly one
offender). It pins **nothing about the content of the views handed in**. Prediction:

| id | mutation | prediction |
|---|---|---|
| D-1 | every tree-wide call site passes `view: ''` (51 entries, real `rel`s, empty bodies) | **GREEN 79/127** — the detector cannot see it. If GREEN, the repair pins the loop and the predicate but not the input, and the five loops are still vacuous with respect to their input. |
| D-2 | R7 call site only, `view: ''` | GREEN |
| D-3 | probe appended FIRST instead of last | GREEN — the docblock says "LAST on purpose", but nothing depends on it under the *unmutated* loop; the position only matters in combination with a truncating mutation, i.e. it is a defence, not a pinned property. Positive control D-3b below. |
| D-3b | probe FIRST **and** `runTreeWide` truncated to `entries[0]` | GREEN — the truncation escapes detection because the probe is now at index 0 and `visited` is taken from the *real* run only... predicted **RED** on `visited 1, not 51`. Stated both ways because I am unsure which arm fires; the point of the case is that `visited` is the arm that saves it, not the probe's position. |
| D-4 | `EXPECTED_SOURCE_FILES` is a hand-written literal, not derived | not a mutation — read off the source, `= 51` at :1201. Predicted: **not** derived from the enumeration it checks. |
| D-5 | `treeWideScanViolation` body replaced with `return null` | RED — 5 of 79? No: it would go **GREEN**, because the function only ever *adds* failures. Predicted GREEN — the detector has no self-test. |

D-5 is the rule-15 question in its sharpest form: **who checks the checker?** `fixtureTableViolation`
got a self-test in round 8 (`fixtureTableViolation('X', [1], 2) === null` must be a miss).
`treeWideScanViolation` has no equivalent. Predicting GREEN.

## §3 — the two admitted gaps

- **T8-4**: I predict I can make the per-file R7 discriminate on purpose by adding a fixture to
  `SINK_EVASIONS` (or a dedicated table) whose `replace` puts an escape *inside a string literal*
  and asserting the strings-blanked view is the one used. Prediction: a fixture-level control is
  possible without touching production code; the reason it does not exist is that today's tree
  supplies the discriminator by accident.
- **C7-p**: predicted honest bookkeeping *but* mis-labelled — a fixture that cannot be planted in
  the live tree is a fixture for the *scanner*, not for the *bypass*, and `ARITY_EVASIONS`'s
  docblock claims the table is the set of live widenings. Predicted finding: LOW/INFO.

## §5 — expected-clean

Predicted clean on all three (no weakened test, no shrunken table, every new control throws).
Method: `git diff 3f6a695..13680c2 -- web/src/util/markdown.test.ts` filtered to removed lines
containing `assert`, `check(`, `throw`, and a numeric diff of every `fixtureTableViolation`
third argument between the two revisions.
