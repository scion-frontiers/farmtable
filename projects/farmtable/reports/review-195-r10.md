# #195 round 10 (`markdown-sanitize-r10` @ `0b52dcd`) — Code Review

Reviewer: review-195-r10 (correctness + architecture leg)
Verified position: `git rev-parse --show-toplevel` = `/workspace`;
`git rev-parse HEAD` = `0b52dcdd6a06f694378084ea3ebefa7d9c473f15`; branch
`markdown-sanitize-r10`; `git status --porcelain` empty at start and at end.

## Executive Summary

This round adds a genuinely working safety mechanism (`consumeFixtureTable`) that I
reproduced RED under mutation, and its commit messages are the most accurate I have seen
in this sequence. Risk level **LOW** in product terms — `markdown.ts` is byte-for-byte
unchanged (verified by blob SHA `4f39481a731357abd29926e95d121cf944d11a4e` at both ends) —
but I am returning **REQUEST CHANGES** on two measured false in-tree claims about the new
mechanism's own coverage, which is precisely the defect class this round exists to close.

Both Required findings are small fixes. Neither is a design objection.

---

## Method (observation vs inference separated throughout)

All gates re-run by me in a clone I installed myself (`npm ci` exit 0), not handed to me:

| gate | brief said | I measured |
|---|---|---|
| `npm test` | 0 — 83 checks / 131 assertions `[REPORTED]` | **0 — 83 checks / 131 assertions** |
| `npx tsc --noEmit` | 0 `[REPORTED]` | **0** |
| `npm run build` | 0 `[REPORTED]` | **0** |
| `git status --porcelain` | empty | **empty** |

The brief's `[REPORTED]` gate baseline is confirmed on all four rows.

Mutations were applied in-tree and reverted by `cp` from a `/tmp` snapshot
(md5 `ae0a9a8331260db9a427dba58ef83fb2`), never by `git checkout`. **Cells where the tree
was dirty after restore: 0 of 4.** Exit codes were read from the child directly, never
through a pipe.

---

## Critical

None.

---

## Required

### R1 — The loop census has a measured hole at `OWNERSHIP_EVASIONS`, and the docblock claims it does not

**File:** `web/src/util/markdown.test.ts:5142` and `:5150`; claim at `:5525–5530`.

`OWNERSHIP_EVASIONS` is the only wrapped table consumed by **two** loops. Both register the
**same** census key into the `fixtureLoopsRun` Set, so the census is satisfied by either one
alone.

**Observation (mutation M-A).** I deleted the entire second wrapped loop — the one asserting
"the owner is exempt, and only the owner", lines 5150–5155:

```
npm test -> exit 0
markdown sanitizer: 83 checks passed (131 assertions)
```

Byte-identical output to baseline. Nothing noticed.

**Positive control (mutation M-B).** A `break` in the singly-consumed `ARITY_EVASIONS` loop:

```
npm test -> exit 1
Error: 1 of 83 markdown sanitizer checks failed:
  - evasion-table loop(s) never ran to completion: ARITY_EVASIONS. ...
```

So the mechanism works as designed; the hole is specific to double consumption.

The docblock at 5525–5530 states this census "proves the loop exists at all" and that
"deleting a wrapped loop, or the check around it, leaves the table pinned and the rule
unexercised; the check total sees a deleted check() but not a deleted loop inside a
surviving one." **Measured false for this table** — that is exactly the mutation M-A
performs, and it is green.

**Inference, and I want to be precise about impact rather than inflate it.** I checked
whether the owner-exemption *behaviour* is protected elsewhere before setting severity.
Applying M-A **and** removing the exemption branch at `:3235` together goes RED (the live
tree-wide scan flags `markdown.ts` itself). So the behaviour is covered indirectly; what
M-A silently loses is the explicit per-fixture assertion across all 10 evasion spellings.
That is a narrower loss than "the rule becomes untested".

I am still calling this Required, on three grounds: the in-tree claim is measurably false;
the fix is a few lines; and the same hole will recur silently the moment anyone wraps a
second loop over an existing table — which the docblock actively invites, and which 23
remaining unwrapped loops make likely.

Related: `753cd78`'s message says the six removals keep "the magic number ... in one place".
True for five tables, false here — the literal `10` lives at both 5142 and 5150.

**Suggested fix** (two parts, second is the durable one):

1. Give each loop a distinct census key and list both in `EXPECTED_FIXTURE_LOOPS` (→ 7
   entries), e.g. `'OWNERSHIP_EVASIONS (attacker paths)'` and
   `'OWNERSHIP_EVASIONS (owner exempt)'`; hoist the size to one
   `const OWNERSHIP_EVASIONS_N = 10` used by both call sites.
2. Make `consumeFixtureTable` **throw on duplicate registration** of a name. That converts
   this entire class from a silent hole into a loud failure for the 23 loops still to be
   wrapped, and it costs three lines.

### R2 — The freshly-corrected docblock replaces a false rationale with a differently false one

**File:** `web/src/util/markdown.test.ts:3350–3356`.

The comment now reads: the trailing `yielded !== expected` arm "is kept because it is
reachable from a `throw` inside the loop body caught upstream — it is not what catches an
abandoned loop, and the census is."

**Observation.** I replicated `consumeFixtureTable` exactly and instrumented the arm:

| consumer behaviour | outcome | tail arm reached | name recorded |
|---|---|---|---|
| normal full iteration | completed | **false** | true |
| early `break` | completed | **false** | false |
| **`throw` in body, caught upstream** | completed | **false** | false |
| `return` from enclosing fn in body | completed | **false** | false |
| table shorter than expected | throws (length arm) | false | false |

A `throw` inside a `for…of` body triggers IteratorClose → `generator.return()`, exactly as a
`break` does; execution never resumes past the `yield`. **The stated reason the arm is kept
is false.**

**Positive control** (the arm is not syntactically dead): mutating the table mid-iteration
(`t.length = 1` inside the body) *does* reach it — `TAIL ARM REACHED`. Explicit
`generator.throw()` does not. So the arm's only real reachability is mid-iteration table
mutation, which no call site performs and which `readonly T[]` discourages at compile time.

The second half of the sentence ("it is not what catches an abandoned loop, and the census
is") is **true**, and the self-test at 4567–4583 correctly asserts the real behaviour. The
defect is confined to the reachability clause.

This matters more than a stray comment normally would: the project log at lines 97–105 names
"a false rationale in the commit that was correcting a false rationale" as the recurring
three-round-old failure, and lists this very `break` claim as one it caught. It caught the
first error and shipped a second in the same sentence. `753cd78`'s **commit message** is
correctly scoped ("UNREACHABLE from a break"); only the in-tree docblock over-reaches.

**Suggested fix.** State the measured truth, or delete the arm:

> The arm is unreachable from any `for…of` consumer — `break`, a body `throw`, and an early
> `return` all invoke the generator's `return()`. It is reachable only if the table is
> mutated during iteration. Retained as a guard against that; the census, not this arm, is
> what catches an abandoned loop.

---

## Nit / Optional

### O1 — The remainder (23 of 29) is disclosed at the wrong end

The scope limit is stated honestly and prominently at `:3363–3368`, and I verified the
residual risk is real: neutering an unwrapped mirror loop
(`ARITY_LEGITIMATE.slice(0, 0)`, `:755`) is **green at 83/131** (mutation M-C).

The disclosure is at the *definition*, so it is discoverable from the protected path. A
reader who opens an unwrapped loop first sees nothing. Answering the brief's question
directly: a partially-applied mechanism is **not** worse than none here, because the scope
paragraph exists and is unusually explicit — but it is doing the job by prose alone, in a
file whose entire thesis is that prose claims need pins.

**Consider:** pin the remainder in the house style — a count of *unwrapped* fixture loops
that must be edited downward when one is wrapped. That makes the remainder visible, forces
it to trend to zero, and cannot silently drift. Leaving 23 unwrapped is defensible
engineering; leaving 23 unwrapped *and* uncounted is the part I would change.

### O2 — Name the extraction: this file has become a program

5583 lines, 82 `check()` call sites, and roughly thirty of them now test the harness rather
than the sanitizer. Answering the brief's question plainly: **no, I could not add a rule to
this suite without reading a large fraction of it** — I would not know which of the four
pins I owe an edit to, and the file tells me only if I find the right docblock.

The author writing self-tests for the detector is a healthy response to a real gap, not a
warning sign in itself. The warning sign is that there is no module boundary for those
self-tests to live behind.

**The extraction, named not designed:** move the scanning/harness layer — `scanTreeWide`,
`stripInertText`, `literalBlindView`, `fixtureTableViolation`, `consumeFixtureTable`,
`assertTreeWideScanSound`, `check`/`assert*` and the two censuses — into its own module.
`markdown.test.ts` then holds rules and fixtures only, and the harness self-tests become an
ordinary `test-harness.test.ts` testing an ordinary module. That dissolves the "a test file
that needs its own tests" recursion into two unremarkable files, and it is the only change I
can see that reduces the concept count rather than relocating it.

### N1 — Self-test sentinels leak into the production census diagnostic

Observed in the M-B failure output:

```
saw INDIRECTION_EVASIONS / ESCAPE_EVASIONS / DYNAMIC_IMPORT_EVASIONS /
    Y (loop pin self-test, sound) / SINK_EVASIONS / OWNERSHIP_EVASIONS
```

`Y (loop pin self-test, sound)` is test scaffolding appearing in a real diagnostic. Make the
census Set an injectable parameter of `consumeFixtureTable` defaulting to the module global;
the self-test then passes its own Set and the leak disappears.

### N2 — The self-test's "NEUTERED" case does not exercise a distinct mutation

`:4560` passes `LIVE_TABLE.slice(0, 0)` with `expected = LIVE_TABLE.length`. Mechanically
that is identical to the "SHORTENED" case at `:4552` — both hand the length arm an array
shorter than `expected`. The mutation it is named for (a loop bypassing the wrapper
entirely) is caught by the census, not by this arm. Not wrong, just not the extra coverage
the comment implies.

---

## FYI

- **F1 — 82 vs 83 is fully reconciled and is not a discrepancy.** There are **82 static
  `check()` call sites** (`grep -cE "^ *check\("`), of which one — `:3818`, inside the
  `REQUIRED_SINKS` loop — runs twice. `REQUIRED_SINKS.length = 2`, so
  `EXPECTED_CHECKS = 82 + (2 − 1) = 83`, and 83 run. The baseline block invited a finding
  here; there is none.
- **F2 — the in-tree count recipe verifies exactly.** Anchored
  `grep -c "^      fixtureTableViolation('"` = **17**. Unanchored `fixtureTableViolation(`
  = **24**, decomposing as 4 sentinels (4505/4512/4515/4518) + 1 declaration (3311) +
  2 prose (3358/4459) → 24 − 7 = 17. The claim at `:4479–4481` is correct in every term.
- **F3 — project log says "Fourteen commits"; the range holds 15** (the log commit itself is
  the fifteenth). It also says "One file touched", where the round touched two.
  Self-referential and harmless, but this project counts things for a living.
- **F4 — the test file is inside the production container build's type-check surface.**
  `tsconfig.json` has `"include": ["src"]` and `build` is `tsc --noEmit && vite build`,
  which `Dockerfile`, `Dockerfile.server` and `Makefile:17` all run. A type error in this
  5583-line test file breaks the image build. **Pre-existing and unchanged by this round**
  (the diff adds no imports — verified), so out of scope, but the exposed surface grew by
  1071 lines. A one-line `"exclude": ["src/**/*.test.ts"]` is the follow-up.
- **F5 — the brief's inference about what runs this suite is CORRECT**, and I tested it
  rather than the fact. No CI exists (`.github` holds only `PULL_REQUEST_TEMPLATE.md` and
  `ISSUE_TEMPLATE/bug_report.md`; the only in-repo YAML is `buf.gen.yaml` / `proto/buf.yaml`
  — positive control: `find` does return those). Nothing in `Makefile`, `Dockerfile`,
  `Dockerfile.server` or `package.json` invokes `npm test`; positive control, the same grep
  finds `npm run build` in `Dockerfile.server:6` and `Makefile:17`. **This suite runs only
  when a human types it** — which bears directly on O1 and on item 5 below.
- **F6 — nothing in the sanitizer rules got worse.** Answering the brief's
  `[UNVERIFIED SUGGESTION]`: `markdown.ts` is byte-identical, so no rule regressed. The two
  open product-side gaps are honestly filed rather than quietly dropped — the P10
  property-bag gap (`ffb79da`, deferred with a stated reason: closing it needs an expression
  parser) and `BANNED_SINKS` remaining an enumeration. Neither was left *unexamined*; both
  are labelled in-tree. I found no rule that was skipped while the plumbing was built.

---

## Positive Feedback

Not manufactured — these are specific and I verified each.

- **`e510d40` is correct and its message is exact.** It moves `assertTreeWideScanSound`
  ahead of the offender throw at all five sites (I counted five, matching
  `EXPECTED_TREE_WIDE_CONTROLS.length`), and updates both the docblock and the census
  message from "must end in" to "must call … BEFORE it throws". The ordering claim in the
  message is what the diff implements. The reasoning is also right on the merits: an
  offender list from an unsound scan is not evidence in either direction.
- **The core mechanism genuinely works.** M-B produced a RED with a diagnostic that names
  the table, lists the expected set, shows what was seen, and says what to do. That is a
  better failure message than most production error paths in this repo.
- **The commit messages are exemplary** — I spot-checked four (`753cd78`, `e510d40`,
  `d9c2f92`, `13558bc`) against their diffs and all four describe what they do, including
  `753cd78` volunteering that its own first draft was refuted by measurement, and `13558bc`
  correcting an undercount *upward* against the author's interest.
- **The six `fixtureTableViolation` removals are real.** `BANNED_SINK_POSITIVES` (15→19) and
  `BANNED_SINKS` (8→12) appear as `-` lines but are modifications from `d9c2f92`; the
  genuine removals are exactly the six evasion tables, and none reappears.

---

## Deliverable 2 — where the fixture-size magic number now lives

**Method:** for each of the six wrapped tables, enumerate every textual site holding the
expected size, by grepping each call site and every prose occurrence of the literal.

| table | enforcing sites | prose copies |
|---|---|---|
| `ARITY_EVASIONS` (17) | 1 — `:745` | 0 |
| `INDIRECTION_EVASIONS` (17) | 1 — `:4174` | 0 |
| `ESCAPE_EVASIONS` (4) | 1 — `:4189` | 0 |
| `DYNAMIC_IMPORT_EVASIONS` (5) | 1 — `:4402` | 0 |
| `SINK_EVASIONS` (27) | 1 — `:5065` | 1 — `:3330` |
| `OWNERSHIP_EVASIONS` (10) | **2 — `:5142`, `:5150`** | 0 |

**Answer: one place for four tables, two for `OWNERSHIP_EVASIONS`, and one place plus one
prose copy for `SINK_EVASIONS`** — seven enforcing sites across six tables.

`EXPECTED_FIXTURE_LOOPS` carries **names only, no numbers**, and the `run()` census uses
`.length`, not per-table sizes. The brief's premise that the number lives in four places
(declared length, call-site argument, `EXPECTED_FIXTURE_LOOPS`, census) is wrong — see brief
error 3 below.

The `:3330` prose `27` is a dated historical measurement ("Round 10, measured at this
branch's head"), so it is a record rather than a live claim; I count it separately and do
not treat it as a defect. The author's "one place" claim therefore holds for five of six
tables and fails only at `OWNERSHIP_EVASIONS`.

---

## Deliverable 3 — should this sequence continue? (brief item 5)

**Plainly: stop the meta-hardening after R1 and R2 are closed. Do not run a round 11 on this
axis.**

The yield is not zero — this round found five controls that were green when they should have
been red, and that is real. But every one of those five defects was in the *test harness*,
not in the sanitizer. `markdown.ts` has not changed in several rounds. The suite is now
being hardened against its own reviewers rather than against attackers, and the honest
evidence is the shape of the remaining backlog: 23 loops to wrap, a census that nothing
pins, and a self-test layer that has begun needing a self-test layer. Each of those is
answerable, and answering them will not make the product safer by one byte.

Two things make me confident rather than merely suspicious:

1. **Nothing runs this suite automatically** (F5). Its marginal protective value is bounded
   by how often a human types `npm test`. Adding a tenth layer of pin to a suite with no
   trigger is investment in the wrong place — wiring `npm test` into `Makefile:17` and the
   Dockerfiles would buy more safety than wrapping all 23 loops.
2. **The remaining product risk is named in the log itself** (line 113): `BANNED_SINKS` is
   an enumeration, not a proof of absence, and `d9c2f92` moved it from eight spellings to
   twelve while explicitly moving the class not at all. The audit leg keeps finding entries
   for it because an enumeration will always have a next entry.

**The axis with actual remaining yield is #18 — the allow-list inversion** — which converts
that open-ended enumeration into a closed one. It is out of scope for this review, and it
is where I would put round 11. Recommend closing #195 after this round's two fixes rather
than extending it.

---

## Test Coverage

New code paths are the harness's own, and coverage of them is good: the round adds
self-tests for `fixtureTableViolation` (4503) and `consumeFixtureTable` (4531), which is the
gap R9 blocked on. The `consumeFixtureTable` self-test covers sound / shortened / neutered /
lengthened / abandoned, and correctly asserts that the abandoned case does **not** throw.

Two gaps, both filed above: the census's double-registration hole (R1) and the fact that
N2's "neutered" case duplicates "shortened". The 23 unwrapped loops (O1) are a known,
documented remainder rather than a coverage gap I am discovering.

## Backward Compatibility

Not applicable. No wire format, no exported API, no production code. `markdown.ts` blob SHA
identical at both ends of the range.

---

## Final Verdict

**REQUEST CHANGES** — on R1 and R2 only.

Both are small, specific, and confined to a new mechanism and its comment. Everything else
here is an improvement I would merge as-is, and the O1/O2/N1/N2 items are for a cleanup pass
or a follow-up ticket, not this merge. If the author fixes R1 and R2 and re-runs the four
gates, this lands.

I did not review: the `url-scheme-validation` branch, the `#18` allow-list inversion, task
#100, the absent CSP (#85), or any Go workstream.

---

## Deliverable 5 — every place my brief is wrong

Numbered, as required. Items 1–2 concern an error the EM self-corrected by message at
09:54:15Z, after I had already measured it independently.

1. **`markdown.test.ts +1169` was wrong** (baseline "The change", brief §axis). Measured
   `git diff --numstat 13680c2..0b52dcd`: **1071 insertions, 98 deletions**. 1169 is
   `--stat`'s changed-line total. *I found this before the correction arrived; the EM
   flagged it concurrently, so I claim it as confirmed rather than novel.*
2. **The EM's own correction is still not right for the sentence it fixes.** The brief says
   the file "is now 1169 lines longer" and "1169 added lines". Substituting the corrected
   `+1071` fixes the second phrasing but not the first: **"lines longer" is net = 973**
   (5583 − 4610), not 1071. Three different numbers — 1169 churn, 1071 added, 973 net — and
   the brief's two phrasings need two different ones.
3. **Brief item 1 overcounts the sources of truth.** It says "each table has a declared
   length, an `expected` argument at the call site, an entry in `EXPECTED_FIXTURE_LOOPS`,
   and a census in `run()`", inviting the answer "four". `EXPECTED_FIXTURE_LOOPS` holds
   **names only**, and the census uses `.length`; neither carries a per-table size. And for
   the six wrapped tables the "declared length" and the "call-site argument" are the same
   number, because the `fixtureTableViolation` entries were removed. The real answer is
   one per table, except `OWNERSHIP_EVASIONS`.
4. **The baseline's 82/83 "discrepancy" does not exist.** It says "if you cannot reconcile
   82 with 83, that discrepancy is itself worth a line". They reconcile exactly and the code
   states the derivation on the line above (`EXPECTED_CHECKS = EXPECTED_CHECK_CALL_SITES +
   (REQUIRED_SINKS.length - 1)`). This is a brief inviting a finding where the tree is
   already correct — the inverse of the usual failure, and worth naming as such.
5. **"Six of twenty-nine loops wrapped; twenty-three left" miscounts by conflating tables
   with loops.** Six *tables* are wrapped, but **seven loops** are, because
   `OWNERSHIP_EVASIONS` is consumed twice. Counting loops, it is 7 wrapped and 22 remaining.
   The brief, the commit message and the project log all use 6/23. This is not pedantry:
   the double-consumption the miscount hides is exactly finding R1.
6. **Brief item 3's premise is that the correction succeeded.** It says the author
   "corrected the comment, and made the self-test assert the real behaviour", then asks me
   to check the comment. The self-test half is true; the comment half is **still false** on
   its reachability clause (R2). The brief was right to ask, but its own summary of the
   state of the tree is wrong.
7. **Brief item 1's framing that a >1 count would make "the commit message wrong about its
   own central design decision" overstates the consequence.** The count is >1 (two sites),
   but the commit message's claim is wrong for **one of six** tables, not for the design.
   The design does keep the number in one place; one call site pair escaped it.
8. **The `[REPORTED]` gate baseline was correct on all four rows** — flagged not as an error
   but because the brief asked me to treat it as unverified, and it turned out to need no
   correction. Recording it so the tag's accuracy can be tracked.

**Claims in the brief I checked and found correct:** the HEAD SHA and branch; the two-file
`+1187 / −98` total; `markdown.ts` byte-identical; 15 commits; no `node_modules`/`dist` in
the clone; `origin/main` does not resolve (confirmed: "ambiguous argument"); `package.json`
`test` invokes `node .tmp-test/util/markdown.test.js`; `tsconfig.test.json` includes
`markdown.test.ts`; the Makefile's two `npm` invocations; `Dockerfile.server` running
`npm ci` and `npm run build`; no CI anywhere; and the inference that nothing automatically
invokes `npm test`.
