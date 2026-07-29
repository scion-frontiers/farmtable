# review-194-r11 — code review, `2cbbd9288c70dc81f9a07d1bdc4c1fc96e2d0c6e`

**Read `_194-r11-baseline-block.md` in this directory FIRST, in full.** It has your
tree, your inputs, the gate table, the environment I built by hand, and the rules.

Write your report to
`/scion-volumes/scratchpad/projects/farmtable/reports/review-194-r11.md`

Verdict: **APPROVE** or **REQUEST CHANGES** on `6d8f19e..2cbbd92`.

---

## Your axis, and what is not

You own **correctness, architecture, readability, and whether the code says true things
about itself.**

Mutation adequacy and test vacuity are the test leg's axis. Threat modelling and
exploitability are the audit leg's. Where you suspect a test cannot fail, say so in one
line, label it as an impression, and move on — do not build the matrix.

---

## STEP 1 — THE OPEN PASS. DO THIS BEFORE READING SECTION 2.

Read the diff `6d8f19e..2cbbd92` and form your own view. Write it down — an actual list,
in your report, before you look at my checklist below. Then read section 2.

This ordering is not ceremony. Last round my targeting named one locus for an item whose
real behaviour lived in three places, and implementing my item literally would have
broken a superset invariant on 40 of 80 cells. The leg caught it by exploring. **Your
open pass is the control on my brief.**

**Attribute every finding in your report to `[OPEN]` or `[CHECKLIST]`.** That makes the
countermeasure falsifiable instead of merely well-intentioned. If the open pass finds
nothing my list did not, say so plainly — a measured null is a result, and the dev leg
reported one honestly last round.

**If any message I send you contradicts this ordering, the brief wins and tell me.**

---

## STEP 2 — What this round was trying to do

**The open finding, one sentence:** a principal holding a bare `task:write` could durably
write a label that later becomes authoritative for lifecycle purposes, without that write
ever being priced against the narrower scope such a label should require.

**Round 10 fixed it and reopened it from the other side** — its remedy priced so widely
that it denied legitimate work, and a review leg measured a `task:write` holder closing a
task **for free** at `DefaultConfig`. Round 11 is the fix for round 10.

**The ruling round 11 was built against:**

> Price a label based on whether its **suffix** matches a value that is authoritative
> under today's `Stages` / `Priorities` / `Types` configuration, **regardless of prefix**
> — with pricing keyed on a recognised category-segment marker.

**Axis 3 is explicitly NOT this round's problem.** A suffix like `shipped` that is not in
today's `Stages` map is unknowable at write time by any syntactic means; its remedy is a
config-CHANGE-time control, tracked separately. Do not file the absence of a write-time
control for axis 3 as a defect. **Do** flag it if the code claims to handle axis 3.

---

## The claims to check. Each is the dev leg's, restated as a claim.

### C1 — B1, the Critical. "Monotone by construction."

The shape shipped: floor BEFORE at the read side's answer, and make AFTER a **union**.

```go
before  = s.currentLifecycleStages(t, t.Labels)                  // base, byte for byte
rawAfter := applyLabelDelta(t.Labels, addLabels, removeLabels)   // delta FIRST
after   = unionStages(
    s.currentLifecycleStages(t, rawAfter),
    writeView.claimedStages(..., canonicalAdditions(rawAfter, t.Labels, addLabels)),
)
```

The leg's argument for monotonicity: *"BEFORE is fixed at base, AFTER contains base's
AFTER as an operand, so `writePrice ⊇ readPrice` is a theorem about a cross product with
a fixed left factor and a monotonically growing right factor."*

**Check that argument as an argument, not as a conclusion.** Specifically:

- Is `before` genuinely the read side's answer, or a *reimplementation* of it? A floor
  computed by a second copy of the policy is not a floor, it is a race between two
  copies. Name the function the read path actually calls and say whether this is it.
- Does the price function actually consume `(before, after)` as a difference, and is
  containment of the AFTER set sufficient for containment of the resulting **scope set**?
  Growing an input set only grows the output if the mapping is monotone too. Is it?
- The theorem is about a **cross product**. Is the price really a cross product, or does
  some cell short-circuit — an empty set, a same-set collapse, a terminal-stage special
  case?

**This is taxonomy form (13) territory and that form was named on this branch: a TRUE
property of a predicate does not bound a gate that consumes a DIFFERENCE of two
evaluations.** The leg hit exactly this and reported it (their "Violation 2": a wider
AFTER is fail-CLOSED for entering a stage and fail-OPEN for **leaving** one). They say
the union removes it. Verify that it removes it *for all shapes*, not for the shape they
measured.

### C2 — `canonicalAdditions`, and the ordering claim

The leg found that canonicalising the caller's additions **before** applying the delta
lets a `remove_labels` entry cancel an addition the real write still performs. So
canonicalisation now happens after the delta, and rewrites **only entries the caller
genuinely contributes** — keys already on the task are excluded, "because rewriting those
is the round-10 Critical itself."

Questions I want answered:

- Is "keys already on the task" the right exclusion set, or is the right set "keys the
  caller did not name"? Those differ when the caller re-adds a label that is already
  present, and re-adding an existing label is a completely ordinary API call.
- `canonicalLifecycleLabels` **replaces a claimed label wholesale**, which the leg
  measured destroys any priority/type meaning the same label also carried. They measured
  it harmless *for pricing* because the canonicalised set feeds stage computation only.
  **Is that a property of the code or a property of today's call graph?** If a second
  consumer of that set appears, does anything stop it?

### C3 — the superset invariant, and where the marker rule is applied

Measured by the leg: `authorizationStage` honours **80 authoritative cells** under
`DefaultConfig` (10 keys × 8 accepted segment sequences), **40 of which carry no `stage/`
segment at all**, and only 10 of which are spellings `StageToLabel` ever emits.

Consequence they drew: applying the ruling's marker requirement to the *whole* claim
would make the claim set NARROWER than the read set on 40 of 80 cells — fail-open. So the
marker requirement is applied **only to the prefix-VALUE-blind branch**; the today's-
config branch is untouched and is what holds the superset invariant up.

**This is the load-bearing structural decision of the diff. Check the branch structure
itself**, not the test that pins it. Two branches with different rules is a shape that
drifts. Ask: what makes a future edit land in the right branch? Is there anything beyond
a comment and a test?

### C4 — B4, constraining `push_prefix` in `Validate()`

The delimiter class the claim recognises is now enforced at config validation. The
coordinator's zero-operational-cost ruling is cited **and scoped to this deployment in
the comment**.

- This turns a previously-accepted config into a **load-time error**. Is the failure mode
  at load fail-closed and legible? What happens to a running deployment whose config was
  legal yesterday?
- `TestPushPrefixDelimiterClass_MatchesWhatTheClaimRecognises` is said to drive **both**
  directions, making "every legal prefix is recognised" true by construction. Check that
  the two directions are driven from **one** source of the delimiter class, not two
  copies that agree today.
- The comment scopes the ruling to this deployment. Good instinct — verify it does not
  read as a general claim anywhere else it is echoed.

### C5 — B5, B8, B9: the three structural fixes

- **B5** — the write view is built eagerly in `NewLabelMapper`, so `LabelMapper` is
  immutable again "which is why there is no mutex rather than a mutex someone has to
  remember." **Verify the immutability is real** — no remaining write to any field after
  construction, on any path. An immutability claim with one surviving writer is worse than
  a mutex.
- **B8** — `assertStageWriteAllowed` refuses when `s.mapper == nil`, **at the gate and not
  in the predicate**, on the stated ground that a predicate answering "not a stage" for a
  nil mapper is answering a question it cannot answer. Assess that placement on its
  merits; it is a good principle and I want to know if it is applied consistently.
- **B9** — `type writeView struct{ *LabelMapper }` with `claimedStages` declared only on
  `writeView`, so `s.mapper.claimedStages(...)` does not compile. The comment claims the
  receiver type is **genuinely checked by the compiler**. **Verify that by trying it** —
  write the call, confirm it fails to compile, then remove it. A structural control that
  is not actually checked is worse than no control, and we shipped exactly that once
  before on a sibling branch. Report it as a compile result, not as a reading.

### C6 — comments that make claims

This branch has a documented history of comments stating a **measurement** as a
**property**, and a sibling round where **six of ten findings were a false sentence
sitting on a correct measurement.** B7 corrects six such comments.

**Corrections are claims too, and a correction can install a new bias wrong in the
opposite direction — that is now a recorded, measured lesson on this project, and its
cost is a FALSE NEGATIVE.** Check the six corrections, not just the originals.

Two specific ones:

- The axis-2 comment now says **NARROWED, not CLOSED**, and names the forced residue
  inline with its measurement. Is the residue statement accurate and is it the *whole*
  residue?
- The leg says: *"'The write predicate recognises more, therefore it charges more' is
  false in both directions and I had written the comment asserting it."* Confirm no
  surviving comment still asserts it, anywhere in the package.

### C7 — the repair commit

`93ae124` claims to restore three files to their `e993b4a` content **byte-for-byte**,
with no new work smuggled in. **I have not checked this.** It is one command. A repair
commit is the easiest place in a series to hide an unreviewed change, and it is the one
commit whose stated content is "nothing new."

### C8 — architecture: patch, or converge?

Carried forward from round 10 and still open. The defect had **three necessary
contributors, none sufficient**: `terminal_label_stages.go:198`,
`terminal_label_stages.go:70`, and `labels.go:249` (reached via the `IssueToPhaseStage`
fallback). The round-11 log re-ran that arm table from scratch in a throwaway worktree and
**every row reproduced** — D is 5/8, E is 7/8, no proper subset sufficient.

*(Note: earlier documents cited `labels.go:393` for `MapLabelsToStage`. That is
`StageLabelSwap` and is not on the price path at all. I propagated the wrong citation into
two briefs. `labels.go:249` is correct at base `06f01d7`. Verify at `2cbbd92` yourself.)*

**Your architectural question, and it is the one I most want an opinion on:** is "three
necessary contributors" a property of the defect, or a symptom of the same policy being
evaluated in three places? If the latter, the durable remedy is **convergence** — one
place that answers "is this label authoritative" — and round 11 has now added a *fourth*
evaluation site in the write view rather than converging. I would rather hear that this
diff should have converged them than hear that it correctly patched around them.

Say plainly whether you think this branch is now at the point where the next round should
be a convergence refactor rather than another fix round. That is a scheduling
recommendation and I will treat it as one.

---

## Method notes

- **Impact before severity.** Establish whether a defect is covered indirectly before you
  rate it.
- Prefer a **chokepoint** remedy over a checklist whenever the hazard is an open set —
  **but name the mechanism that makes it bite.** A leg measured that this preference,
  applied naively, would have shipped a control that looks structural and is inert.
- If you can close a finding by making the bad state **unrepresentable** rather than
  detected, say so, with the mechanism.
- Separate **Required** from **Suggested**. Required means I hold the merge.

---

## Deliverables — all required

1. **Verdict**, with Required separated from Suggested.
2. Your **open pass**, written before the checklist, with every finding attributed
   `[OPEN]` or `[CHECKLIST]`.
3. Your verdict on **C1**: is the monotonicity a theorem, or is it true on the cells they
   tried?
4. Your **compile result** for C5/B9 — did you write the illegal call and watch it fail?
5. Your check of **C7**, the repair commit, as a diff result.
6. Your **architectural opinion on C8**: patch or converge, and should the next round be a
   convergence refactor. Label it as an opinion.
7. Your **prediction accuracy** as a fraction, with the misses.
8. **A numbered list of everywhere this brief is wrong.** Required. There is something.

Do not push. Do not modify production code. **You MUST write the report file at the
absolute path above and then mark the task complete.**
