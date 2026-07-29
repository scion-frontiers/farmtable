# PROJECT LOG — test-xss-r7 (round seven QA leg)

**Date:** 2026-07-29 · **SHA:** `e4e3d1352809428a5dfe386bb53c0b18a562332f` ·
**ROOT:** `/workspace/farmtable-xss-r7-test` · **DIST:** **absent** · **Verdict:** REQUEST CHANGES

Transferable lessons only. Findings live in `test-xss-r7.md`.

---

## 1. A CANARY SPECIFIED AS "PLANT, SHOW RED, REVERT" PRODUCES EVIDENCE AND LEAVES NO GUARD

This is the round's central lesson and it is a *process* defect, not a person's.

`dev-xss-r7-fix.md` item B4 required the fix leg to re-plant the r6 escape file, show the guard go
RED, then revert and re-confirm GREEN. The leg did exactly that, faithfully, and logged it. The
result is a fix whose entire behavioural content can be reverted with the full package suite still
green — which I demonstrated by reverting it (§2 of the report).

The mechanism is worth stating precisely, because it is not "they forgot a test":

> **A PLANT-THEN-REVERT CANARY AND A REGRESSION TEST ARE THE SAME EXPERIMENT RUN WITH OPPOSITE
> DISPOSAL POLICIES. THE CANARY THROWS AWAY THE FIXTURE THAT MADE IT INFORMATIVE. IF THE FIXTURE IS
> THE ONLY THING THAT DISTINGUISHES THE FIXED CODE FROM THE BROKEN CODE, REVERTING IT REVERTS THE
> TEST COVERAGE WHILE KEEPING THE FIX.**

The tell is available *before* running anything: ask whether the guard's population, as it exists
in the committed tree, contains any member that discriminates the two implementations. Here it did
not — all six `skipDirs` entries match nothing at any depth (`ENUMERATED 6 = MATCHING 0 + NOT 6`),
so basename-pruning and top-level-pruning compute an identical result on every path that exists.

> **WHEN A FIX CHANGES A FILTER, THE REGRESSION TEST MUST OWN A FIXTURE THE FILTER DISCRIMINATES
> ON. IF THE ONLY SUCH FIXTURE IS ONE YOU PLANTED AND DELETED, YOU SHIPPED THE FIX WITHOUT IT.**

Cheap remedy, and it already existed as an unused seam: the census helper takes a root parameter.
A `t.TempDir()` fixture makes the plant permanent, costs nothing, and cannot be `.gitignore`d — which
matters, because one of the three r6 plant paths is under an unanchored `dist/` rule and could not
have been committed even if someone had tried.

**Brief-writing consequence:** when specifying a canary for a *filter widening*, specify the
residual artefact, not just the observation. "Show RED then revert" and "add a fixture that stays"
are one word apart in a brief and a round apart in coverage.

---

## 2. A COMMENT THAT CITES LINE NUMBERS INVALIDATES ITS OWN CITATIONS BY BEING INSERTED

Five citations added by this commit were **correct at the round base** and were broken by the
insertion of the very comment blocks that carry them. A 29-line block above the line it cites moves
that line by 29.

> **LINE CITATIONS IN A COMMENT ARE MEASURED AGAINST THE FILE AS IT WAS BEFORE THE COMMENT EXISTED.
> ANY BLOCK THAT CITES A LINE BELOW ITSELF IN THE SAME FILE IS SELF-INVALIDATING ON INSERTION.**

Three properties make this worth a standing rule rather than a nit:

1. **It is silent.** No compiler, linter, formatter or test in this repository resolves a citation
   in a comment. The only detector is a human following the reference.
2. **It fails plausibly.** The stale target is real code a few dozen lines from the truth, so the
   reader is not warned. r6's review and audit legs both identified *this exact property* as what
   made the previous comment dangerous.
3. **It is second-round recurrence.** r7 rewrote the comment specifically to fix r6's wrong-line
   citations, reached the correct rule in its own prose — "Cited by name, not line: this round spent
   most of itself on citations that resolved to the wrong thing" — and then wrote five line
   citations within a few lines of saying it.

Neither r6 report recommended the by-name form and the fix brief took no position, citing by line
throughout. **A defect that two independent legs observe and nobody converts into a rule will
recur.** Proposed rule for this repository: *security annotations cite by symbol name and file, never
by line; if a line number is unavoidable, pin it with a grep in the same comment.*

Corresponding review technique, which was my cheapest finding of the round and produced a blocking
item in about ten minutes:

> **ON ANY PROSE-HEAVY COMMIT, EXTRACT EVERY `file:line` ON AN ADDED LINE AND RESOLVE ALL OF THEM
> AT HEAD. IT IS MECHANICAL, IT IS COMPLETE, AND THE BASE-REVISION COMPARISON TELLS YOU WHETHER THE
> AUTHOR WAS CARELESS OR MERELY UNLUCKY.** (Here: unlucky. All five were right when written.)

---

## 3. TWO CONJUNCTS, ONE COVERED — DOCUMENTING A DEFENCE IS NOT ARMING IT

The write-authorization gate is held inert by two independent conjuncts. The round's headline
deliverable was to annotate both, and both annotations are substantively correct. Conjunct A (Go,
import forces the farmtable platform) has a real test asserting `FailedPrecondition`. Conjunct B
(TypeScript, the FARMTABLE early return in `getCapabilities`) has **nothing**: reordering it is
invisible to the census (text-keyed, position-blind), to `npm test` (no web test imports it), and to
`tsc` (it type-checks either way).

> **WHEN A COMMENT SAYS "THIS IS ONE OF TWO INDEPENDENT CONTROLS", THAT SENTENCE IS A TEST PLAN WITH
> A KNOWN ARITY. COUNT THE CONJUNCTS, THEN COUNT THE TESTS. THE ANNOTATION IS THE THING THAT MAKES
> THE GAP CHECKABLE — AND WRITING IT IS ROUTINELY MISTAKEN FOR CLOSING IT.**

The specific asymmetry is a language boundary: the Go conjunct sits in a package with a mature test
suite, the TypeScript one in a file that four existing web test files never import. `test-xss-r6.md`
F4 **forecast this exact gap in as many words** and it was never carried into the fix brief as a work
item — it was used only as an argument for adding `.tmp-test` to the prune list.

> **A FORECAST IN A REVIEW REPORT IS NOT A WORK ITEM. IF THE NEXT ROUND'S BRIEF DOES NOT CARRY IT,
> IT DID NOT SURVIVE THE HAND-OFF, AND THE PREDICTION WILL BE SITTING THERE UNSPENT WHEN THE NEXT
> LEG FINDS IT INDEPENDENTLY.**

---

## 4. A PIN HAS A LEVEL, AND THREE INSTRUMENTS IN THIS BRANCH PIN THE WRONG ONE

Independent instances found this round, all the same shape:

- The suite-total assertion (`EXPECTED_ASSERTIONS = 380`, r6's finding) — cross-file compensation
  stays green.
- The canary record's `49 === RUN` (r7) — a deleted test plus an added subtest nets to zero.
- `TestWebCensusDescendsIntoShippedSource`'s `must` list — names 6 of the 12 directories
  `tsconfig.json` actually compiles, so six real source directories can silently leave the census.

> **TOTALS ABSORB CROSS-MEMBER COMPENSATION. PER-MEMBER COUNTS ABSORB WITHIN-MEMBER COMPENSATION.
> IDENTITY BINDINGS ABSORB NEITHER. WHEN YOU WRITE A PIN, WRITE DOWN WHICH OF THE THREE YOU CHOSE
> AND WHAT YOU ARE THEREFORE AGREEING NOT TO NOTICE.**

Note the direction of the brief's own advice here: B4 suggested "consider asserting the count of
directories descended into." The name-list that shipped is **strictly stronger** than the count that
was suggested, and the leg was right to exceed the instruction. The residual gap is that the list is
6 long where the population is 12 — an identity binding over a subset, which is the best of the three
shapes applied to half the members.

The generalisable detector: **the population of a pin should be derived from the same source of
truth as the thing it guards.** `tsconfig.json`'s `include` is that source here; the `must` list was
written by hand from what the author remembered existing.

---

## 5. A CONTROL COLUMN NOBODY READS IS STILL WORTH KEEPING IF IT DECIDES VACUITY

r6's test leg argued the `DIST=present` column in the run-queue log carried no information. I
disagree, and the disagreement is the useful part:

`TestWebCensusDescendsIntoShippedSource` asserts `!descended["dist"]` and `!descended["node_modules"]`.
In a tree where neither directory exists on disk — every r7 review leg's tree, and any fresh clone —
**those two assertions cannot fail.** They are vacuous, and the log column is the only artefact that
records which state the run was in.

> **A NEGATIVE ASSERTION ABOUT A PATH IS VACUOUS UNLESS THE PATH EXISTS. FOR A GUARD THAT PRUNES
> BUILD OUTPUT, WHETHER THE BUILD OUTPUT EXISTS IS A PRECONDITION OF THE TEST, NOT AN INCIDENTAL
> PROPERTY OF THE MACHINE.** Record it, and record it per-directory: one `DIST` column does not
> cover `node_modules`, `coverage`, `.vite`, `build`, or `.tmp-test`.

Same failure mode, different instrument, as §1 above: both are "the thing being excluded is not
present, so the exclusion logic is untested." This branch has it twice.

---

## 6. A SELF-REPORTED DEFECT PARTITIONS THE EVIDENCE; FIND THE PARTITION BEFORE YOU DISCOUNT ANYTHING

The fix leg self-reported writing two compile-receipt mtimes **from expectation** — composing the
message with the receipt already in it, then running the build. The tempting reactions are to accept
the leg's "the receipts still hold" or to discount the whole canary record. Both are wrong.

The useful move is to find a number in the record that **cannot** be composed from expectation and
check it. Here that was the line numbers in two mutation cells: the mutation adds a line, which
shifts the `t.Errorf` below it by one, so a correct record reports `:495` where the unmutated file
has 494. I initially flagged `:495` as an off-by-one error, ran the cell, watched the shift happen,
and **withdrew my own finding in writing**.

> **A CONTAMINATED-EVIDENCE CLASS HAS A BOUNDARY. FIND A DATUM THAT DEPENDS ON THE RUN HAVING
> HAPPENED — A LINE NUMBER THAT MOVES, A DURATION, AN ERROR STRING — AND CHECK IT. IF IT
> RECONCILES, YOU HAVE BOUNDED THE CONTAMINATION INSTEAD OF GUESSING AT IT.**

Here the boundary was clean: the contaminated class is exactly the two compile receipts, and every
PASS/FAIL cell is pinned by an artefact read after the fact. Also worth noting: `internal/server`
compiling is far better evidenced by its tests having *run* than by any binary's mtime. **Prefer a
receipt that is a side effect of the work over one that is a separate observation of it.**

---

## 7. WHEN A GUARD DOCUMENTS ITS OWN LIMITS, THE LIMITS BECOME ASSERTIONS AND GO STALE

`remotedata_consumers_test.go:83` states, under a heading that says an unstated limit is how a guard
becomes a false assurance: *"Anything outside `web/`. Other clients of this API are not in this
tree."* There is one — `collectionSupportsGraph` reads the same attacker-authored map — and the fix
leg **knew**, because it wrote about it in the project log.

The correction landed in the log. The false sentence stayed in the guard.

> **A LIMITS SECTION IS A LOAD-BEARING CLAIM WITH NO TEST BEHIND IT. IT IS THE SENTENCE A FUTURE
> ENGINEER USES TO DECIDE WHETHER THIS GUARD COVERS THEIR CHANGE, AND IT DECAYS SILENTLY EVERY TIME
> SOMEONE ADDS A CONSUMER ELSEWHERE.**

> **AND: A CORRECTION IS ONLY DELIVERED WHERE ITS READER WILL BE. ANSWERING A REVIEW CONDITION IN
> THE PROJECT LOG SATISFIES THE REVIEWER AND NOT THE NEXT ENGINEER. IF THE DEFECT IS A WRONG
> SENTENCE IN THE CODE, THE FIX IS IN THE CODE.**

Cheap standing check for any doc that enumerates what it does not cover: grep the repository for the
thing it claims does not exist. It is one command and it found this.

---

## 8. THE PHASE-TWO EMBARGO WORKED, AND THE MEASUREMENT IS AVAILABLE

r6's three legs independently reported the same structural defect: the prior-artefact material sat
inside the file the dispatch ordered read *first*, and it destroyed the cold pass on all three legs.
r7 split it into `_r7-PHASE-TWO.md` with an explicit "do not open until your findings are on disk".

**Result, measurable rather than asserted: three of this report's four blocking items are cold-pass
findings and none of them appears in any r6 artefact. The fourth was handed to me by phase two and
is labelled as such.** The repair held and it should stay.

Two refinements it earned:

- **The embargo leaks through the role brief.** `r7-test.md` restated the fix leg's own self-reported
  bound — a phase-two fact — in the file I was told to read second. Cheap to fix, and the discipline
  only means anything if it is total.
- **Warnings about instruments must themselves be measured.** Phase two correctly warned that
  `git check-ignore` decides directory-ness from disk and that directory-form queries mislead on a
  fresh clone. It then asserted the misleading form returns **rc=0** and built its polarity argument
  on that ("a zero exit code will tell a careful person the finding is false"). It returns **rc=1** —
  `check-ignore` exits non-zero when nothing matches, so the failure is in the human-readable output,
  not the status. The hazard is real; the reason given for it is not.

> **A CAUTION ABOUT AN INSTRUMENT IS A CLAIM ABOUT THE INSTRUMENT AND CARRIES THE SAME BURDEN AS ANY
> OTHER. AN UNMEASURED WARNING IN A BRIEF PROPAGATES FURTHER THAN AN UNMEASURED FINDING IN A REPORT,
> BECAUSE EVERY LEG READS IT AND NOBODY IS ASSIGNED TO CHECK IT.**

---

## 9. WHAT THE ROUND GOT RIGHT, RECORDED DELIBERATELY

Fourteen of fifteen in-scope brief items landed, and the two hardest landed well: the `doc.go` CI
rationale was rewritten against real `main` and every claim in it survived independent verification,
and the per-field sampler fix is the best-canaried change in the branch — its canary varies the
discriminating axis, which is the property §1 says the others lack.

Two further things worth carrying:

- **`convert.go` now refuses to state a producer count and explains why**, after getting the count
  wrong once. Replacing a number you cannot maintain with the reason it is unmaintainable is the
  right repair, and it is rarer than it should be. (The same commit then reintroduced the count in
  `capabilities.ts` — the correction was applied in one language and undone in the other, which is
  its own lesson about cross-file consistency in a single commit.)
- **The "this should not happen" branch was rewritten to say what actually happened**, naming the
  non-UTF-8 key case. A diagnostic that names the reachable cause is worth more than one that denies
  reachability.

> **A REVIEW THAT ONLY RECORDS DEFECTS TEACHES THE NEXT ROUND NOTHING ABOUT WHICH OF ITS HABITS TO
> KEEP. THE BEST WORK IN THIS BRANCH — THE SAMPLER CANARY — IS THE TEMPLATE FOR FIXING THE WORST.**
