# PART II — METHOD BLOCK, xss round 4

## DO NOT READ THIS UNTIL YOUR OPEN PASS IS WRITTEN DOWN.

Order is: Part I baseline block → **your open pass, written to your report** → this file →
your leg brief's checklist.

**Why this file exists at all.** A leg measured that my *baseline block* — which every leg
must read first and in full — itself carried substantive targeting: the count-neutral bar,
"a positive control that trips a different arm," "a build failure is not a measurement,"
and a specific commit to go check. Its finding, and it is correct: **since the ordering
requires the baseline first and in full, an uncontaminated open pass was impossible by
construction, even for a leg that followed the ordering perfectly.** The countermeasure was
being defeated by the document that announced it. That leg is on the sibling round; you
are the first round to get the fix. Part I is now facts, environment, safety and policy
only. Everything that could steer what you look for is here, behind the gate.

**This split is itself an experiment and I want it measured.** In your report, say whether
reading Part I alone left you under-equipped to do a competent open pass — a false negative
caused by withholding method is a worse outcome than contamination, and I would rather hear
it than infer it.

---

## The governing principle

**NOTHING DOWNSTREAM OF X CAN FALSIFY X.**

Most of this diff is *instrumentation* — three of six commits change oracles rather than
production behaviour. An instrument cannot be checked through itself. **Do not assess a
scanner by running it. Assess it by making the thing it is supposed to find, and seeing
whether it finds it.**

## The rules that keep producing findings

**Every zero needs a positive control.** A grep that returns 0 because the shell ate the
glob, and a `go build ./...` that returns **exit 0** with `matched no packages` because it
was issued from a subdirectory, are indistinguishable from clean results.

**`cmd | tail` reports the exit code of `tail`.** Never pipe a command whose exit code you
intend to read.

**`-count=1` or it is not a sample.** Go caches test *results*. A second run at an
unchanged SHA re-runs nothing and returns a green that **cannot** flake. This was measured
tonight: the shared baseline's second `make test` came back `(cached)` on 10 of 10 Go
packages. Silent, and in the flattering direction.

**Predict before you measure, and report every miss.** Report accuracy as a fraction. A
perfect score is weak evidence, not a result.

**Assert WHICH ARM fired.** Overlapping oracle arms mask each other, and this branch has
the sharpest live example on the project: the guard tracer's arm 1 is block-scoped
existential, arm 2 is file-scoped universal, and **they overlap by construction**. A RED
that does not name its arm is not evidence.

**A positive control that trips a different arm than the one it guards is the recurring
defect here.** Worked example from tonight's baseline validation: breaking the web guard by
*appending* a failing test would have changed the assertion count and could have produced a
RED from the `EXPECTED_ASSERTIONS = 380` count-pin arm rather than from the assertion arm.
The validation used a **count-neutral in-place corruption** instead, and the RED named
`testRejectsUnsafeSchemes` at its own source line. That is what arm attribution looks like.

**A count-pin RED is not evidence of non-vacuity unless a COUNT-NEUTRAL corruption is also
RED.** Measured failing case elsewhere on this project: 8 of 14 entries replaced with junk,
count held, **GREEN**. The bar now reaches the fixture corpus and the assertion harness, so
the regress does not terminate — pin an absolute total at the outermost level and **say
where you stopped.**

**If a mutation looks RED, check it is not a build failure.** A build failure counted as a
kill is a false positive in the direction that flatters the code.

**An unrun test file is not an inert test file.** Check what *runs*, not what exists. This
round exists because a whole suite had no executor in the documented workflow.

**A control that shares a dependency with its subject is a MIRROR, not a control.**

**A point-in-time claim is not a standing property.** Three instances in ninety minutes
tonight. "Preserved," "restored," "clean" — all were true when asserted and false later.
If you assert a state, say when you measured it.

## The wider pattern behind the stranded mutant

Part I gave you the incident and the procedure. Here is the generalization, because it
changes how you should verify your own work:

**A probe's state can escape into a durable artefact through a channel the probe's own
cleanup does not cover.** Three channels observed on this project: a differential revert
swept into a commit by `git commit`; a recovery snapshot copying a live mutant; and a
post-hoc worktree check that came back clean *because the restore had already run — the
check looked at the WORKTREE and the dirty cell was in the COMMIT.*

The through-line: **an instrument cannot see the corruption of the thing it measures.** And
the sharp corollary — **after a harness run, a green suite is not evidence the tree is
clean, and it is LEAST evidence precisely for the mutants that survived.** The mutant
stranded tonight had *survived* the suite. Verify restores by `git diff` against the SHA,
never by running tests, and not by `git status` alone if you have committed anything.

## Three failure modes of MY briefs, all measured

1. **I supply an input together with a wrong expected result.** Repeatedly, across
   branches. **Take the input; measure the result.** This round's dev leg found my "X3 is
   four write sites" was **six** — and found it by writing a scanner rather than auditing
   my four.
2. **I state the shape of a causal set I have not measured.** I have named one gate where
   there were three necessary contributors, and warned of multiplicity where there was one
   site. Direction unpredictable. **Where a brief states a count or names a single locus,
   treat it as unmeasured unless it carries a measurement.**
3. **My targeting can steer a round away from the defect, and a leg that checks only what I
   asked will approve.** Every sentence true, round still misses. The open-pass ordering is
   the countermeasure; the `[OPEN]`/`[CHECKLIST]` attribution is what makes it falsifiable.

**A numbered list of everywhere the briefs are wrong is a REQUIRED deliverable.** Legs have
found errors in every round for 20+ consecutive rounds. Assume there is something.

## SELF-REPORTED GAPS ARE CLAIMS, NOT ADJUDICATIONS

The dev leg reported its own gaps honestly and in detail. **That is exactly why they are
dangerous: a self-reported gap that reviewers treat as already-settled is how a leg reviews
itself.** Three items — **P10 unkilled**, **X8 partial**, **`scopes.go` left dirty** — and
two equivalence arguments — **P2cn**, **P11** — are carried into your leg briefs as
**claims to be tested**. Do not accept any of them because they were disclosed.

(The one exception, already given to you as a fact in Part I because it would otherwise
read as an incomplete handoff: `scopes.go` is a **declared decision**, and it is not
present in your clone. You may still argue with the disposition.)
