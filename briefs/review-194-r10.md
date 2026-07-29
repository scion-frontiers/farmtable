# review-194-r10 — code review, `label-write-scope-r10` @ `6d8f19e`

Read `_194-r10-baseline-block.md` in this directory first, in full.

Write your report to
`/scion-volumes/scratchpad/projects/farmtable/reports/review-194-r10.md`.

Verdict: APPROVE or REQUEST CHANGES on `06f01d7..6d8f19e`.

## Your axis, and what is not

You own **correctness, architecture, readability, and whether the code says true
things about itself.** Mutation work is the test leg's axis; threat modelling is the
audit leg's. Where you suspect a test cannot fail, say so in one line and move on.

## What this round was trying to do, and the ruling it was built against

The open finding: a principal holding a bare `task:write` could durably write a label
that later becomes authoritative for lifecycle purposes, without that write ever being
priced against the narrower scope such a label should require.

The ruling the dev leg was given asked it to price a label if that label "could ever be
authoritative under any config." **The leg reported that ruling is unsatisfiable as
written** — `Stages` is `map[string]string` with arbitrary keys, so the set of labels
that could ever be authoritative under some config is the set of all labels, and
pricing that denies routine work. That report was accepted.

**The ruling has since been restated, and this is the bound the code must now meet:**

> Price a label based on whether its **suffix** matches a value that is authoritative
> under today's `Stages` / `Priorities` / `Types` configuration, **regardless of
> prefix**. `ft:stage/completed`, `ft2:stage/completed` and `anything:stage/completed`
> are priced identically, because `completed` is a known and bounded value today. The
> thing that was unbounded was the prefix, not the suffix.

The restatement post-dates the leg's work. **The leg implemented against its own
reading, not against this one.** Judging the diff against the new bound is the single
most valuable thing you can do in this round, and it is genuinely open — I have not
measured whether they coincide.

Two specific questions I want answered and have deliberately not answered myself:

1. Does the shipped code price by **suffix regardless of prefix**, or does it price a
   bounded set of prefixes? Those are different mechanisms with different failure modes
   — a prefix allow-list is an enumeration and will be incomplete; a suffix match is a
   property. The leg's summary describes "canonicalising translation of foreign
   spellings," which I cannot tell apart from either without reading the code.
2. The bound names **`Stages`, `Priorities` and `Types`**. The leg's work is described
   throughout in terms of stages — `lifecycleStageClaim`, `assertStageWriteAllowed`.
   **Are `Priorities` and `Types` in scope of the shipped check, out of scope by
   deliberate decision, or simply not considered?** I do not know which, and the three
   have quite different consequences. If they are unprotected, say whether the same
   defect reproduces on them.

**Axis 3 is explicitly NOT this round's problem.** A suffix like `shipped` that is not
in today's `Stages` map is unknowable at write time by any syntactic means, and the
remedy for it is a config-CHANGE-time control, tracked separately. Do not file the
absence of a write-time control for axis 3 as a defect. Do flag it if the code claims
to handle axis 3.

## What the diff ships, as claims to check

The leg's own summary. Treat each as a claim, not a description.

- A new `lifecycleStageClaim`, described as **a strict superset of
  `authorizationStage`, "so it can only refuse more."** This is the load-bearing safety
  claim of the whole diff. If it is not a strict superset, the fix can *allow* a write
  that was previously refused, which is a regression in the dangerous direction. Check
  it as a property, not on the examples the leg chose.
- An `asIfEnabled` **writeView reconstruction**. Relevant history: I told the leg that
  "nothing needs rebuilding," and the leg found that this was a correct fact with a
  wrong inference — `StageToLabel` is *not* toggle-blind, so the write view does need a
  rebuild. The reconstruction exists because my premise was wrong. Check that what it
  reconstructs is actually what the write path consumes.
- **`AllTerminalLabelStages` and `IssueToPhaseStage` are called UNCHANGED, with their
  guards intact**, so the demotion rule and the closed-issue rule are described as
  *inherited rather than restated*. Inheritance is the right instinct — restating a
  rule is how the two copies drift. Verify the inheritance is real: that these are the
  same code paths with the same guards, and that nothing in the new claim path
  duplicates or partially re-implements either rule.
- `assertStageWriteAllowed` now **consumes** the claim.
- **The read side is deliberately unchanged.** Is that separation clean, or does the
  write-side claim leak into read behaviour anywhere?

## The three-cause collapse, and why it matters to you architecturally

The leg measured that the defect had **three necessary contributors, none sufficient**:
`terminal_label_stages.go:198`, `terminal_label_stages.go:70`, and `labels.go:393`
(reached via the `IssueToPhaseStage` fallback). Unguarding any one alone changes
nothing; full parity appears only when all three are addressed.

I had pointed at one of those three as *the* site. That was wrong, and it is the second
time on this branch that a single-locus framing has misdirected a round.

Your architectural question: **is "three necessary contributors" a property of the
defect, or a symptom of the same policy being evaluated in three places?** If it is the
latter, the durable remedy is convergence — one place that answers "is this label
authoritative" — and I would rather hear that this diff should have converged them than
hear that it correctly patched three sites.

## The verdict vocabulary I supplied was wrong, and the leg was right to refuse it

I gave the leg a READ / WRITE / UNREACHABLE trichotomy for classifying the config
guards. The leg refused it and added a fourth value, because **six of the guards are
write-SUPPRESSION and must KEEP their guards** — not emitting labels is exactly what
the toggle is for, and making them config-blind as I instructed would make a disabled
mapper start pushing `ft:stage/` labels. One guard is DUAL and no single verdict fits
it. None are UNREACHABLE.

Two things I want from you here. First, **check that refusal on its merits** — is the
write-suppression category real, and is the guard set correctly partitioned in the
shipped code? Second, and more important architecturally: a config flag that means
"suppress writes" *and* "ignore reads" is doing two jobs under one name, and the whole
three-round history of this defect is downstream of that conflation. Say whether you
think the two meanings should be separate settings. That is a design opinion and I want
it labelled as one, but I do want it.

## Comments that make claims

This branch has a documented history of comments that state a measurement as a
property, and the sibling branch just produced a round where **six of ten findings were
a false sentence sitting on a correct measurement.** Check every comment this diff adds
or edits against what the code does. Where a comment states a property, ask whether it
is a property or a measurement wearing a property's clothes.

Specifically: commit `6798143` is titled "Correct three claims that would mislead the
next reader." Corrections are claims too, and a correction can install a new bias
wrong in the opposite direction. Check the three corrections, not just the originals.

## Method notes

- **Impact before severity.** Establish whether a defect is covered indirectly before
  you rate it.
- Prefer a **chokepoint** remedy over a checklist whenever the hazard is an open set.
- If you can close a finding by making the bad state **unrepresentable** rather than
  detected, say so — **but name the mechanism that makes it bite.** A leg on the
  sibling branch measured that my standing preference for this, applied naively, would
  have shipped a control that looks structural and is inert. A type that is not
  actually checked by the compiler is worse than no type.

## Deliverables

1. Verdict, Required separated from Suggested.
2. Your answer on **suffix-vs-prefix** and on **`Priorities` / `Types` coverage** — the
   two questions above.
3. Your verdict on the strict-superset claim for `lifecycleStageClaim`.
4. Your architectural read on the three-cause collapse: patch or converge.
5. Your labelled design opinion on splitting the two meanings of the config flag.
6. A numbered list of everywhere this brief is wrong. Required.

Do not push. You MUST write the report file and then mark the task complete.
