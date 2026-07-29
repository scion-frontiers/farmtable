# LEG BRIEF — code review, #194 round 5

Read the shared brief first:
`/scion-volumes/scratchpad/projects/farmtable/briefs/farmtable-194-r5-review-shared.md`

- **Clone (yours alone):** `/workspace/farmtable-review-194`, branch
  `label-write-scope`, verified at `ea8ac39`.
- **Scratch dir (yours alone):**
  `/scion-volumes/scratchpad/projects/farmtable/salvage/r5-review-194/`
- **Report to:** `/scion-volumes/scratchpad/projects/farmtable/reports/review-194-r5.md`

The change is **3092 insertions across 11 files**. Reviewability is itself in
scope — see charge 2.

## Charges

**1. Comment and claim accuracy. This is the charge I care most about.**

This workstream's signature defect is *a property that holds for one consumer,
stated as if it held for all*. Round 4 shipped two false comments and I walked
past both because I grepped for claims about the fix instead of claims about its
neighbours.

`labels.go` gained this comment on `TerminalLabelStage`:

> "Callers on a privilege path use AllTerminalLabelStages instead; the remaining
> single-answer sinks are sequenced separately (#194 round 5)."

Check it against **every actual caller**, not against intent. Note that
`store.LifecycleStage` (singular) → `TerminalLabelStage` is still live at
`passthrough.go:612` (`issueUnavailableForClaim`, the claim path) and
`passthrough.go:974`. Is the comment true? If it is defensible — e.g. because
those callers ask a boolean "is anything terminal?" where the identity of the
winner cannot change the answer — **is that reasoning written down anywhere, or
is it load-bearing and unstated?**

Then do the same sweep across every comment and doc-block the round touched, and
the log entry's "Sinks covered" table. Also: that parenthetical says "#194 round
5" for work that is round 6. Trivial, but comment accuracy is the charge.

**2. Is this one coherent reviewable change, or three?**

I offered the developer an explicit escape hatch to hand B6 back to round 6 if
B1+B5+B6 stopped being reviewable together. They kept it. Was that the right
call? If your honest answer is that this should have been split, say so — it is
a finding about my sequencing, not about them, and I would rather learn it now
than at merge.

**3. Two fenced files were edited on the developer's judgment. Adjudicate.**

`labels.go` and `authz_terminal_reopen_test.go` were both fenced off by earlier
addenda. The developer edited both, disclosed both, and gave reasons: the
`labels.go` fence was read as covering only the fail-open tiebreak loop, and the
fenced test was one Addendum 3 explicitly ordered inverted. I have verified the
tiebreak loop is untouched. **Were the edits within what was authorized, and do
they create a collision risk with the round-6 work on those same files?**

**4. The new seam.** `store.go` gains `LifecycleStageSetStager` plus
`LifecycleStages` / `LabelDeltaLifecycleStages` / `SameStageSet`, with
`multistore.go` routing. Assess the abstraction: is the fallback at
`store.go:139` / `multistore.go:256` (wrap the singular answer in a one-element
set) correct for every store, including native Ent? Can a store implement one
interface and not the other and get a silently wrong answer?

**5. The two inverted tests.** `..._UnprefixedTerminalLabelIsHonouredToday` →
`..._IsNoLongerHonoured`, and the bare-`duplicate` row moved out of
`TestPassThroughClaimTask_TerminalLabelledIssueIsNotClaimable`. **Did the
inversion preserve coverage, or did a cell quietly vanish?** A rename that drops
an assertion is a test that disappeared instead of failing.

**6. Empty-prefix semantics.** The developer ruled that an empty `push_prefix`
means the default `ft:`, **not** "no prefix required," reasoning that
`StageToLabel` writes `ft:stage/...` under an empty config. Is that consistent
across every reader and writer? An empty config that required no prefix would
make the deployment that writes our labels the one that also honours everyone
else's.

**7. `applyLabelDelta` case-folding.** GitHub resolves add and remove through a
lowercased name→node-ID index, so the developer made the delta match
case-insensitively and reports 2 of 3 probed spellings live with the third
over-predicting (fails closed, logged). Verify the over-prediction really does
fail closed and cannot deny legitimate work.

Report per the shared brief's structure. **Commit locally, do not push, do not
modify production code.** You MUST write `review-194-r5.md` and then mark the
task complete.
