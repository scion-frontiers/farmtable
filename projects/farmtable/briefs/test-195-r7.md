# Brief — test-195-r7: independent test review

## Your tree

`/workspace/farmtable-195-r7-test`, detached at `7b4f6dd`.

**[MEASURED by me, just now]** The round-7 range is `86f30bc..7b4f6dd`. Do NOT use
`89306d0` as a base — it is a sibling, not an ancestor, and diffing against it invents
a 68-line "deletion". Confirm with `git merge-base --is-ancestor 86f30bc 7b4f6dd`.

**[MEASURED]** The range adds ~1060 lines to `web/src/util/markdown.test.ts` against
~94 lines of change in `web/src/util/markdown.ts`. This round is overwhelmingly test
work. **That makes you the leg that matters most this round**, and it also means the
usual risk is inverted: the danger is not missing coverage, it is 1060 lines of tests
that cannot fail.

## Your charter, stated plainly

Do not review the tests by reading them. **Mutate the production code and find out
which tests notice.** On this workstream, inspection and mutation have disagreed
repeatedly, and mutation has been right every time. Last round, on a sibling issue, two
legs read a test and confirmed it was "real, active, and passing" — all true, and all
beside the point. The third leg broke the function the test claimed to pin and the test
stayed green.

## The defect class you are hunting

> **A check that derives from the thing it is checking cannot falsify it.**

Nine confirmed instances on this workstream. Known sub-forms, all of which have
actually occurred here:

1. a check that cannot falsify what it checks;
2. a fixture that cannot express the failing input;
3. a correct check answering a question nobody meant to ask;
4. a transport that succeeds at delivering something nobody wrote;
5. a post-hoc tally (a count computed from the run, presented as a prediction);
6. a confirmed lower bound reported as a count.

Look for all six. Sub-form 5 is especially likely here: **[CLAIM — verify]** r7 says it
"pinned the assertion total, not just the check total" and reports numbers like
"75 checks passed (122 assertions)". A total that is READ OFF the run and then asserted
is not a control. A total PREDICTED from the source and then compared is. Determine
which of the two this is.

## Specific items to test, not read

1. **[CLAIM — verify]** r7 claims "fixture tables must fail closed, and cover the rules
   they range over." Fail-closed fixture tables are exactly where sub-form 2 hides.
   Check that a fixture table CAN express a failing input, by feeding it one.
2. **[CLAIM — verify]** r7 claims it made "the sunset clause and the dependency floor
   fire". Verify by making them fire. A clause documented as firing and never observed
   firing is decoration.
3. **[CLAIM — verify]** r7 claims to have "pinned the private Marked instance and the
   last unsignalled config axis". Break the config axis and confirm the pin reddens.
4. **[MEASURED]** The sink guard is regex-based and there is untested surface in its
   banned-sink list historically. Confirm each banned sink is actually exercised.
5. r7 states it made two corrections to round 6. **Corrections deserve mutation too** —
   they were written by someone who already got this area wrong once.

## Standing bars

- **Positive control before any negative claim.** A mutation harness that has never
  reported RED is worth nothing. Prove it can fail before you trust a pass.
- **Verify that a green mutation actually weakened the thing** you meant to weaken. A
  mutation that does not change behaviour teaches nothing and looks like coverage.
- **Mutations must be content-addressed, never line-addressed. Abort if the anchor is
  not unique.** Line numbers in reports on this workstream have already drifted.
- **Any harness must ABORT on a failed prerequisite** rather than continue and print a
  green. Eleven void harnesses here have produced clean, confident, wrong numbers —
  including one of mine that scored an ABORT as a PASS, and one that reported EXIT=0
  from `npm test | tail`. **Exit codes come from the child process, never through a
  pipe.**
- **Predict counts BEFORE measuring them**, from a source independent of the run
  itself — e.g. a static grep of the source, not the runner's own output.
- **Name the rule that fired, not just the colour.** "It went red" is not a finding;
  "it went red because assertion X on line Y" is.
- **Costly disclosure is the trust signal.** Name what you could not verify. Disclosing
  your own void runs is valuable — last round the test leg disclosed two of its own
  discarded experiments and that materially raised my confidence in everything else it
  said.
- **Do not push. Do not modify production code** except transiently for mutation, and
  revert every mutation. Your independence depends on it.

## Required report sections

Write to `/scion-volumes/scratchpad/projects/farmtable/reports/test-195-r7.md`:

1. **VERDICT**: APPROVE or REQUEST CHANGES.
2. **MUTATION TABLE**: mutation ID, exact content anchor mutated, what it weakened,
   predicted result, actual result, which test(s) caught it, and — for anything not
   caught — whether it is a coverage hole or a mis-attributed assertion. Those are
   different findings with different fixes.
3. **C-A — what I could not verify.**
4. **C-B — the finding you are least sure about.**
5. **VOID RUNS**: experiments you discarded and why. Do not omit these.
6. **WHERE THIS BRIEF IS WRONG**: if nothing, say so explicitly.

You MUST write that report file, commit a project-log entry in `.design/project-log/`,
and then mark the task complete. Do not stop after the analysis.
