# test-xss-r4 — CHECKLIST (STEP 2) + DELIVERABLES

**Released to you because your open pass is on disk. Findings from here are
`[CHECKLIST]`, not `[OPEN]`.** Read Part II (`_xss-r4-method-block.md`) first if
you have not.

---

## STEP 2 — the instruments, as claims

### T1 — X1: does `make test` actually gate?

The whole round exists because a test suite had **no executor in the documented
workflow**. The fix wires the web suite into `make test` and both Dockerfiles.

**PART OF THIS IS ALREADY DONE AND YOU MUST NOT REDO IT.** Because the shared baseline is
a measurement produced by the instrument under review, the gate was validated as a
*precondition of publication*, by me, at 23:57Z. Section V of
`reports/_xss-r4-baseline-measurement.md` has the full method and output. Summary: a
**count-neutral** in-place corruption of one `safe-url.test.ts` row (count-neutral on
purpose, so the RED could not come from the `EXPECTED_ASSERTIONS = 380` arm) produced
`make test` exit **2**, with the failure naming `testRejectsUnsafeSchemes` at its own
source line; restore returned exit **0** and `PASS: 4 test file(s), 380 assertions`.

**Read that section, including its stated limits, and then attack what it does NOT
establish.** It shows only that a failing assertion *inside an already-enumerated file*
propagates to a non-zero exit. It says nothing about:

1. **Discovery.** Is a NEW or RENAMED test file picked up, or is the file list fixed? A
   suite that runs four files because four are hard-coded is one rename away from silently
   running three. This is the same defect class the round was convened about, one level up.
2. **Compile failure vs test failure.** What does the runner do with a `.test.ts` that does
   not compile — RED, or skipped-and-green? Skipped-and-green is a fail-open.
3. **The Go arm.** My validation broke the *web* half only. Break the Go half and confirm
   `make test` goes non-zero too, so you know both arms are live and neither masks the
   other. Note `test: test-go test-web` runs in order.
4. **`node_modules`.** I hand-copied 120M of it into your tree. A gate that silently no-ops
   when it is absent is off in exactly the environment that most needs it. Determine what
   `make test` does with no `node_modules` — errors, skips, or passes — and **say which**.
   *"Passes with 0 test files" is the defect this round was convened about.*
5. **The Dockerfiles.** Does `npm test` run before the artefact is produced, and does its
   failure abort the image?

**Read `$?` DIRECTLY for every one of these — do not pipe.** These are runs: **batch them
into one request and ask me before you start.**

### T2 — X4: `EXPECTED_ASSERTIONS = 380` is a COUNT PIN

Read Part II's count-pin rule. Then:

- **A count-pin RED is not evidence of non-vacuity unless a COUNT-NEUTRAL corruption is
  also RED.** Measured failing case on this project: 8 of 14 entries replaced with junk,
  count held, **GREEN**. Do the equivalent here — hold 380 fixed and corrupt the
  *identity* of what is asserted (delete one real assertion and add one trivially-true
  one; swap a fixture's payload for junk of the same shape). Report red or green.
- **Say where you stopped the regress.** The count-neutral bar reaches the fixture corpus
  and the harness itself and does not terminate. The convention is to pin an absolute
  total at the outermost level and **state the stopping point explicitly**.
- Is 380 **derived** or hand-maintained? If a developer's normal response to a red count
  pin is to edit the constant, the pin trains people to defeat it. Is there anything
  besides a comment stopping that?
- The 380 decomposes as assertions 9 / safe-url 204 / url-binding-scan 157 / task-ready 10
  **[EM-MEASURED]**. Is the *decomposition* asserted, or only the total? A total-only pin
  permits assertions to migrate between files, which is how a file goes to zero unnoticed.

### T3 — X2/X5/X7a: the guard tracer, and the arm problem

Four measured fail-opens in one oracle. The one that matters most for you:

> **Arm 1 is block-scoped existential; arm 2 is file-scoped universal. They OVERLAP BY
> CONSTRUCTION.** The leg's fixtures assert the arm **by message**.

**Overlapping oracle arms mask each other, and this is the sharpest live example on the
project.** So:

- **Every fixture must assert WHICH ARM fired.** A RED that does not name its arm is not
  evidence. Verify the message-based arm assertion is present in **every** negative
  fixture, not in a helper some rows skip.
- Asserting by **message string** is itself a fragile oracle: it passes when the message
  text is right and the logic is wrong, and it *fails spuriously* when someone rewords.
  Say whether a structural arm identifier would be better, and whether the messages are
  currently unique across arms — **check for a prefix collision**, where arm 2's message is
  a superstring of arm 1's and a `contains`-based assertion accepts either.
- **X7a: "two assertions were passing for the wrong reason."** Two were found. **Sweep for
  more.** For each assertion in the guard-tracer suite, ask: if the tracer returned its
  degenerate/empty answer, would this assertion still pass? Every assertion for which the
  answer is yes is the same bug. **Report the count you swept and the count you found**, and
  a zero here needs a positive control like any other zero.
- **X5: `sourceFiles()` was `.ts`-only.** Now widened. Is the extension set **derived** from
  the project's actual source set, or a second hard-coded list? If a `.tsx`/`.mts`/`.svelte`
  file appears tomorrow, does the tracer notice or silently exclude it? A silently-shrinking
  universal quantifier is taxonomy form (1): a check that cannot falsify what it checks.
  **Test it: add a file in an unlisted extension containing a violation, and see whether the
  guard goes red.** Then remove it.
- **The walk identity check.** Confirm it binds the node the assertion consumes. Then break
  it — make the walk return a sibling node — and confirm red.

### T4 — X6: the adapter-key scanner, and the empty-answer problem

The old regex scanner returned `nested=[]` under `map[string]interface{}{`, and for
`server.go` returned **`top=[] nested=[]`** — no keys at all, for a file that has them.

**An empty answer that means "clean" and an empty answer that means "I could not parse"
are the same value.** That is why this survived. Your items:

- **Positive control for the new AST scanner**: construct the exact
  `map[string]interface{}{…}` shape that defeated the regex, and confirm the AST scanner
  finds it. Then construct a file that **does not parse** and say what the scanner returns —
  if it returns empty, the fail-open is preserved through the rewrite and that is a finding.
- Confirm the scanner is exercised over **`server.go` specifically** in a test, with a
  non-empty expected key set, since that is the file whose emptiness was the tell.
- Keys that are **not string literals** — a constant, a concatenation, a variable. What does
  the AST scanner do? Silently skip is a fail-open; explicitly report-unknown is not. Say
  which ships.
- **X7b, `noteDeclaresBaseDependence` negation-awareness.** Enumerate what it handles
  (`!x`, `x == false`, `!(x)`, negation on a prior line, `unless`-style inversion) and what
  it accepts silently. **A source-text predicate with partial negation awareness is a
  predicate that is wrong in a direction nobody has measured.** Measure the direction: does
  an unhandled negation form make it over- or under-report?

### T5 — X3: the recursion and the six write sites

The production-behaviour commit, and the only place with real user-visible stakes.

- `TestSanitizeAndImportAgreeAtEveryDepth` over **63 generated maps**. 63 is a product of a
  small basis. **What is the basis, and what shape is outside it?** Specifically: arrays of
  maps, maps inside arrays inside maps, `null`, empty string keys, non-UTF8, and a value at
  depth greater than the recursion bound. **Ask what the 64th map would have been.**
- What does the recursion do **at its bound** — drop, truncate, or pass through? Pass
  through at the bound is a fail-open, and it needs a test at exactly bound and bound+1.
- **`TestEveryRemoteDataWriteSiteSanitizes` found SIX write sites where my brief said
  four** (`export_import.go:139` and `:332` were the new ones). **This is the best
  instrument in the diff and I want it attacked properly:** is the enumeration **derived**
  (does it go red when a seventh site appears?) or is it six assertions? **Prove it: add a
  seventh unsanitized write site in your clone, run the test, confirm RED, revert.** If it
  does not go red, that is the finding of the round.
> **[CORRECTED 00:49Z — FALSE AS WRITTEN, AND YOU ARE THE LEG THAT REFUTED IT. ORIGINAL BELOW,
> STRUCK, NOT DELETED.]**
>
> The exemption is keyed by exact source **TEXT**, not line number:
> `exempt[strings.TrimSuffix(strings.TrimSpace(line), ",")]`. **Inserting a blank line above it
> does nothing.** You measured the true behaviour under G-7:
> - **R10** — changing the exempted STATEMENT (receiver `p` -> `proj`) produced **exit 2** and
>   named the site. It fails **CLOSED** on edit, the OPPOSITE direction from my claim.
> - **R7** — a NEW FILE containing a byte-identical line was **silently exempted, GREEN**. The
>   real fail-open is **DUPLICATION ACROSS A PACKAGE-GLOBAL SCAN ROOT**
>   (`filepath.Join("..","..","internal","server")`, every non-test `.go` file), not drift.
>
> **My instruction would have produced a GREEN result and I would have read that green as
> "control healthy."** It was not merely a wrong premise, it was a wrong premise with a
> predictable green — the exact shape I keep telling legs to distrust. The experiment that
> found the truth (R7) was **yours, not mine**, and it was not on my list.

**[ORIGINAL TEXT, FALSE, RETAINED FOR THE RECORD:]**
- ~~**`server.go:661` is exempt, keyed by EXACT SOURCE LINE.** Move the exemption's target by
  inserting a blank line above it and see what happens. A line-number-keyed exemption is a
  decaying control whose failure is silent and permissive.~~

### T6 — THE THREE SURVIVING MUTANTS. THESE ARE CLAIMS, NOT ADJUDICATIONS.

The leg reported all three itself and hid none. **That honesty is exactly why they are
dangerous to you: a self-reported gap treated as already-settled is how a leg reviews
itself.** All three are yours.

- **P10 — "GENUINELY UNKILLED."** The leg's account: it is **the outermost anti-vacuity
  floor in the Go suite, with no level above it to notice its deletion**, and *"the Go
  suite has no analogue on this branch."* **Test the claim, do not accept it.** Is P10
  really the outermost level, or is there a level above that nobody looked for? Is the
  absence of an analogue a fact about the branch or about the search? **What would an
  analogue look like, and what does it cost?** This is the terminus of the regress and the
  honest answer may be "it cannot be killed from inside" — but that answer must be
  *derived* here, not inherited. If it is genuinely unkillable from inside, say what
  external mechanism (a CI-side count, a review checklist item, an absolute pin one level
  out) would cover it, and size it.
- **P2cn — claimed EQUIVALENT.** An equivalence argument must not be self-certified.
  **Attack it as a mutant**: find an input that distinguishes mutant from original, or
  demonstrate that none can exist. "The suite cannot tell" is evidence of equivalence only
  if the suite is adequate — which is the thing under review. If you cannot distinguish it,
  say **"I could not distinguish it,"** not "it is equivalent."
- **P11 — claimed a REDUNDANT GUARD.** *"Redundant" is a claim that the other guard is
  total.* Name the partner guard, characterise its coverage, and find the input where the
  partner does not fire. If the partner is total today, is the redundancy still worth
  keeping — and is there a test that goes red if someone simplifies the partner? Defence in
  depth without a pin is defence in depth someone deletes next quarter.

### T7 — the differential, and the honest limit

- Build a differential where you can: hold r4 tests constant, revert production files to
  `6805daa`, and enumerate failing **subtest names — names, not counts.**
- **A build failure is not a measurement.** If reverting makes a package fail to compile,
  that arm produces no evidence, and you must say so rather than counting it.
- **RE-READ PART II'S STRANDED-MUTANT SECTION BEFORE YOU BUILD ANY DIFFERENTIAL.**
  Two instances tonight of a probe's state escaping into a durable artefact through a
  channel the probe's own cleanup did not cover — one into a commit, one into a preserve
  ref. Verify your restore with `git diff` against `e6bda71`, **not** by running tests, and
  not by `git status` alone. **After a harness run, a green suite is not evidence the tree
  is clean, and it is LEAST evidence precisely for the mutants that survived.**

### T8 — your own method

- **The flake: five `TestWatchTasks_*` at ~4.5%, CI [2.39%, 8.33%].** A 27-row single-run
  matrix is ~71% likely to contain a spurious RED, **and a spurious RED reads as a kill, so
  the bias flatters the suite.** Run every mutation row at least twice. **Six legs are
  running right now and the flake is load-sensitive** — the load is mine. Say how you
  controlled for it.
- **Predict before you measure.** Report accuracy as a fraction with the misses. A perfect
  score is weak evidence.
- **Check every apparent RED is not a build failure.** A build failure counted as a kill is
  a false positive in the flattering direction.
- **Report the number of cells you left dirty after restore.**

---

## What I want you suspicious of, stated plainly

The branch's argument is: *three scanners plus a count pin plus a runner gate make the URL
property enforced.* **Two of those three scanners were measured broken this round, by
inspection.** So the base rate for "this instrument works" on this branch is not good, and
the instruments were checked by a party who also wrote them.

**The single most valuable output you can produce is not another mutant. It is: for each
oracle in this stack, the level above it that would notice if it silently stopped working —
or the statement that there is none.** Give me that as a table.

---

## Deliverables — all required

1. **Verdict**, Required separated from Suggested.
2. Your **open pass**, before the checklist, findings attributed `[OPEN]`/`[CHECKLIST]`.
3. **T1**: `make test` as a gate — the broken-test exit code you measured, and its
   behaviour with no `node_modules`.
4. **T2**: your **count-neutral corruption** result on `EXPECTED_ASSERTIONS = 380`, and
   where you stopped the regress.
5. **T3**: your swept count and found count for "assertions passing for the wrong reason,"
   plus the unlisted-extension test result.
6. **T5**: the **seventh write site** experiment — red or not — and, **[AMENDED 00:49Z, the
   original asked for a line-shift result that measures nothing]**, the two experiments that
   do bear on the exemption: **R10** (mutate the exempted STATEMENT — does it fail closed?)
   and **R7** (a byte-identical line in a DIFFERENT FILE — is it silently exempted?). Report
   the scan ROOT you measured, not the exemption's line number.
7. **T6**: independent verdicts on **P10**, **P2cn**, **P11**. For P2cn and P11, either a
   distinguishing input or the words "I could not distinguish it." For P10, what an
   analogue would cost.
8. **The oracle table**: every oracle in the stack, and the level above it that would
   notice its silent failure — or "none."
9. **Your method's controls**: how you handled the flake, and how many cells you left dirty.
10. Your **prediction accuracy** as a fraction, with the misses.
11. **A numbered list of everywhere this brief is wrong.** Required.

Do not push. Do not modify production code — restore every cell and verify by `git diff`
against the SHA. **You MUST write the report file at the absolute path above and then mark
the task complete.**
