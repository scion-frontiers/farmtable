# LEG BRIEF — test review, #194 round 5

Read the shared brief first:
`/scion-volumes/scratchpad/projects/farmtable/briefs/farmtable-194-r5-review-shared.md`

- **Clone (yours alone):** `/workspace/farmtable-test-194`, branch
  `label-write-scope`, verified at `ea8ac39`.
- **Scratch dir (yours alone):**
  `/scion-volumes/scratchpad/projects/farmtable/salvage/r5-test-194/`
- **Report to:** `/scion-volumes/scratchpad/projects/farmtable/reports/test-194-r5.md`

The round adds ~2300 lines of test. Volume is not coverage. Your job is to find
what all of it cannot see.

## Charges

**1. Mutation-test both controls yourself. Do not accept MUT-B5/MUT-B6.**

The developer ran two mutations and reports specific kill sets, including that
collapsing the set readers back to a single tiebreak winner fails exactly 6 of 12
in each of two tests — "exactly the independently reported set." That is a
checkable claim. Check it. Content-addressed mutations, backups outside the repo,
`git status --porcelain` empty **and** sha256 against an out-of-repo pristine
copy after restore, exit codes captured from the child.

Then go past their two: mutate B1 (the label-delta gate), the `before != after`
comparison, `SameStageSet`, the prefix predicate, and the `store.go` fallback
that wraps a singular answer in a one-element set.

**2. THE PRIORITY CHARGE — what can these fixtures not express?**

The two highest-value findings of the last two rounds were both found this way
and **neither was reachable by asking "what mutation survives"**: the label-set
cardinality bypass, and the `renderMarkdown` arity bypass. In both cases the
fixture was not weak on the axis — it was *silent* on it, so no mutation could
produce a failing case because nothing ever tried one. An argument list is a
collection; a label set is a collection; **look for the next collection whose
cardinality is pinned at one.**

Concrete starting points, all from the developer's own disclosures:

- Cardinalities 3 and 4 are exercised "at the unit level only, not end to end."
  Is the end-to-end gap real, and does anything change at cardinality 3+?
- Your own round-4 finding F-3 was that **no test anywhere varies
  `LabelConfig.Stages`** — the mapper configuration was a constant every fixture
  inherited from `DefaultConfig`. B6 now varies `push_prefix`. **Does anything
  yet vary `Stages`?** The developer notes a deployment configuring custom
  terminal aliases (e.g. `shipped: completed`) must now spell them with the
  prefix, and that no such configuration exists in-tree. A configuration that
  exists only outside the tree is a fixture that cannot express the input.
- What else is held constant across the whole suite that B5/B6 just made
  load-bearing?

**3. Are any of the new tests deletable-green?** Ablation-pair the new file. A
test with no unique coverage is a maintenance cost that also inflates confidence.
Round 5 of #195 had seven such checks.

**4. Did the two inverted tests preserve coverage?** `..._IsHonouredToday` →
`..._IsNoLongerHonoured`, and the bare-`duplicate` row relocated out of
`TestPassThroughClaimTask_TerminalLabelledIssueIsNotClaimable`. The developer
says "no test was deleted, and none has no successor." Verify the *cells*, not
the test names. And check the count-pin change from 6 to 12 in
`TestUpdateTask_SwappingOneTerminalLabelForAnotherRequiresClose`: a count pin must
state what its rows can and cannot express.

**5. Verify the developer's dismissal of a failure.** A nil-pointer panic in
`TestUpdateTask_PropagatesActorID` at `identity_test.go:250` (an ignored
`CreateUser` error) appeared during their MUT-B5 run. They call it a run artefact
on the grounds that it passes 3/3 clean and the mutation does not touch that
path. **That is a dismissal of an observed failure and it needs independent
confirmation** — including whether it is a latent flake that will fire in CI.
Related: `TestWatchTasks_*` has a known pre-existing timing flake.

**6. REV9 landed as a passing regression test** whose load-bearing assumption is
that `passthrough.go` never writes `p.Phase`. It asserts `closeCalls == 0`. A
passing test that guards a future regression has no live mutation path — your
round-4 F-5 found exactly this shape (M14 survived). **Does REV9 have a tripwire,
or is it a green assertion aimed at its own future?**

**7. B3 was answered by measurement: NO**, a native Ent task cannot hold
`stage=<terminal>` with `phase=open` through any RPC, with a documented limit
that an internal caller could construct it. Verify the sweep is discriminating —
that the test would fail if phase derivation broke — rather than passing because
every path returns the same thing.

Report per the shared brief's structure. **Commit locally, do not push, do not
modify production code.** You MUST write `test-194-r5.md` and then mark the task
complete.
