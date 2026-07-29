# test-xss-r3 — test review, `url-scheme-validation-r2` @ `6805daa`

Read `_xss-r3-baseline-block.md` in this directory **first, in full**, and do its
§0 open pass before you read the item list below.

Write your report to
`/scion-volumes/scratchpad/projects/farmtable/reports/test-xss-r3.md`.

Verdict: **APPROVE** or **REQUEST CHANGES** on the diff `0bc9b72..6805daa`, on
your axis.

## Your axis

Whether the tests in this diff can fail for the reason they claim. Vacuity,
mutation adequacy, coverage locality, and silent coverage loss. Correctness and
architecture belong to the review leg; exploitability to the audit leg. Label
anything outside your lane an impression, and still say it.

**This diff is unusual: most of it is test infrastructure.** The runner, the
assertion harness, the scanner, the anti-vacuity check and the fixture-note rules
are all *instruments*. Your normal question — "can this test fail?" — applies to
the instruments themselves, and the fix leg has already demonstrated that the
instruments here can be satisfied without being obeyed.

---

## The one methodological point that governs this round

**An instrument cannot be checked through itself.**

The fix leg found this the hard way, and it is the most useful result in its
report. Its consumption gate reads an assertion **count**. It then ran a mutant
that made `assert` count but never throw — holding the receipt at exactly 200
across 3 files — and the mutant **SURVIVED**. It shipped green at
`PASS: 3 test file(s), 200 assertions.`

Its own words: *"The gate reads the count, so the gate structurally cannot see
it."* It closed the hole with `web/src/util/assertions.test.ts`, which checks the
harness using a `must()` helper that throws directly and is **deliberately not
counted** — because *"a test that verified the harness through the harness would
hide the mutant inside the instrument."*

That is the right shape of answer. **Your job is to find where that reasoning was
applied once and not everywhere.**

---

## The items

### T1 — is `assertions.test.ts` itself sound, and is `must()` really outside?

- Verify that `must()` is genuinely outside the counted path — not merely named
  differently. Mutate it and see what notices.
- The harness now has: a count, a receipt, a zero-check, a no-receipt check, a
  monotonicity check (`assertionCount must advance by one per assertion`), and a
  throw-check. **Design a mutant that survives all six.** The leg's M-B2-6 shape
  was "count but do not throw." Look for the next one — e.g. something that
  throws but throws the wrong thing, or reports a passing comparison for a
  failing one in a way the monotonicity counter cannot see.
- The leg's M-B2-8 froze the counter at a plausible non-zero constant and was
  killed by the monotonicity check. Is monotonicity checked **within a file** or
  **across the suite**? Those have different blind spots.

### T2 — kill M-B6-5, or confirm it is genuinely equivalent

The leg declares one deliberate expected survivor:

> M-B6-5 — **control, expected survivor:** delete the `hostname === ''` guard
> entirely → **SURVIVED**, exit 0, 315 assertions. *"The guard really is
> unreachable today, so no fixture can pin it."*

It then rewrote the comment to say the guard is unreachable rather than claiming
it is what makes widening safe. That is honest handling.

**Try to kill it anyway.** On an earlier round of a sibling branch, a review leg
declared a mutant equivalent, the test leg killed it, and the test leg was right.
An unreachable guard is a claim about the *input space*, and input-space claims
are the ones this project keeps getting wrong. If it is genuinely unreachable,
say so with the reachability argument written out; if you can reach it, that is
a finding.

Related, and the same shape: the leg says `CURL` is a "fail-closed false
positive" in the `remote_data` key predicate. **Verify that it actually fails
closed** rather than being asserted to.

### T3 — count-neutral corruptions the leg did not run

The count-neutral bar found defects in two consecutive rounds, including inside
fixes written to satisfy the brief that imposed it. The leg ran 27 mutants. Your
value is in the cells it did **not** cover. Candidates, non-exhaustive and
possibly wrong:

- `sanitizeRemoteData` on **nested** maps, if nesting is reachable.
- `blankNonCode` on **template literals** — a Lit codebase is full of
  `` html`...${x}...` ``, and braces inside a template literal are not code
  structure. A count-neutral mutant here holds the finding count fixed while
  changing which region the scanner believes is code.
- The **witness path** list in the anti-vacuity check: a walk that reaches all
  three witnesses and the right file count but skips a whole other directory.
  (The leg ran M-B5-2, which skipped one directory and padded back to 52 — check
  whether the *padding* was itself detectable, i.e. whether the mutant was
  killed by the witnesses or by an artefact of how it was built.)
- The receipt: a test file that emits a plausible `#assertions` line **without**
  importing the harness.

Design your own. Do not just run mine — see §5 mode 2 of the baseline block, I am
guessing at the shape of a set I have not measured.

### T4 — silent coverage loss in the harness migration

`d92ae5e` removed three files' local `assert` implementations and pointed them at
the shared harness.

Silent coverage loss is a third failure axis on this project, alongside false
positive and false negative: **a correctly-declined non-answer never collides
with anything.** So:

- Count assertions **per file, before and after** the migration. Did any check
  disappear in the rewrite?
- The suite now reports 315 assertions across 4 files. What was the *equivalent*
  number at `0bc9b72`, counted the same way? If it cannot be counted the same
  way, say why, and find another way to bound the loss.
- `src/utils/task-ready.test.ts` changed by 6 lines and now reports 10
  assertions with no `ok` line. Is it whole?

### T5 — the flake, and what it does to every table this project has produced

Recorded methodology finding: `TestWatchTasks` flakes at ~8% per sequential
full-suite run, so **every single-run mutation matrix on this project carries
~1-in-12 odds of a spurious RED.**

I measured `go test ./...` exit **0** this session. The fix leg measured 0 three
times plus `-count=5` on `TestWatchTasks`.

**Establish a better bound.** Run the full suite enough times to say something
honest — whether the flake still reproduces, at what rate, and whether the rate
is low enough that single-run matrices are now acceptable or still are not. State
your sample size. A null result ("did not reproduce in N runs, which bounds it
below X%") is exactly the deliverable.

This is not a detour. If the flake is gone, a standing caveat on every mutation
table in this project's history can be retired; if it is not, this round's tables
need the same caveat.

### T6 — the scanner's new recall rules

`457886d` added `Object.assign`, seven attributes/properties, three imperative
navigation calls, and a ban on `setAttribute` with a non-literal first argument.
The leg killed one mutant per rule.

- One mutant per rule proves the rule **can** fire. It does not bound the rule's
  recall. For each rule, find the nearest shape it does **not** catch, and say
  whether that gap matters.
- The `setAttribute` ban is a *ban*, not a detection — it will fire on innocent
  code. Is there existing innocent code it would fire on, and if not, is that
  because the tree happens not to contain any today?
- These are recall mutants, so the leg correctly inverted the count-neutral
  question. Check its inversion: does adding a binding while the finding count
  from existing files stays at zero really go red for the right reason, or does
  it go red because it is the *only* finding?

### T7 — the `base_dependent` markers

The leg made the markers measured rather than annotated:
`testBaseDependenceMarkersAreAccurate()` sets each input as the `href` of a real
anchor in two real JSDOM documents and fails in **both** directions. It marked
**six** fixtures, and charged my brief with saying four.

- Verify the six, independently, and verify the *definition* under which six is
  the answer. The leg gives three definitions yielding 2, 3, and 6.
- Its positive control (M-B6-7) is that a probe ignoring its `base` argument gets
  caught. Is there a mutant where the probe honours the base but the *comparison*
  is wrong?
- The leg reports the audit's source table mixed real fixtures with the auditor's
  own invented probes — two of four rows were not in the fixture file at all.
  **Check that claim.** If it holds it is a finding about how evidence tables get
  read, not just about this round.

---

## Deliverables

1. §0 open pass, written first.
2. A mutation table: every row run in this tree this session, with **which
   mutants held which count fixed**, and results. Include the ones that were
   killed — a green control is a result.
3. Findings attributed **OPEN PASS / ITEM LIST / BOTH**, with severity.
4. An explicit verdict on each of T1–T7, including where you agree.
5. Your bound on the `TestWatchTasks` flake, with sample size (T5).
6. A numbered list of everywhere this brief is wrong (§5 of the baseline block).
7. Overall APPROVE / REQUEST CHANGES.
8. **Dirty cells at the end** — revert by snapshot restore, not `git checkout`,
   and show `git status --porcelain` empty.

Do not push. Do not modify production code outside a mutant you revert. You MUST
write the report file and then mark the task complete.
