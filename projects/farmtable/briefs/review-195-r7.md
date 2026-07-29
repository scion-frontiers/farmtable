# Brief — review-195-r7: independent code review

## Your tree

`/workspace/farmtable-195-r7-review`, detached at `7b4f6dd`.

**[MEASURED by me, just now]** The correct base for the round-7 range is `86f30bc`,
NOT `89306d0`. `89306d0` is a SIBLING commit (the r6 code-review leg's project log),
not an ancestor — `merge-base(89306d0, 7b4f6dd) = 86f30bc`. If you diff against
`89306d0` you will see a spurious 68-line "deletion" of a project-log file that was
never deleted. I hit exactly that artifact an hour ago.

So: **`git diff 86f30bc 7b4f6dd`**. Verify that ancestry claim yourself before you
trust it — `git merge-base --is-ancestor 86f30bc 7b4f6dd`.

**[MEASURED]** The range is 3 files: `web/src/util/markdown.ts` (+94/-…),
`web/src/util/markdown.test.ts` (+1060), and a project-log entry (+294).

## How to read this brief

Every claim is tagged **[MEASURED]** or **[CLAIM]**. Verify any **[CLAIM]** you rely
on. **Finding this brief wrong is a first-class deliverable.**

I need to be blunt about why. Last round, on a sibling issue, I put an unverified
premise into three review briefs. Two of the three legs read the code and reported the
premise back to me as verified. The third leg tested it by mutation and found it false.
Cross-leg agreement is the strongest signal I have — **except on premises I handed
you, where it is worth exactly zero and looks identical to real convergence.** So when
you find yourself agreeing with something I asserted, that is the moment to be
suspicious, not reassured.

## What I am asking you for

A code review: correctness, readability, architecture, and the question that only a
reader can answer — **does the code do what its comments and names say it does?**

Two other legs are running in parallel on this same tree with different charters. Do
not try to guess what they are covering and do not skip something because you assume
they have it. Overlap is cheap; a gap is not.

## Specific things worth your attention (none of these are conclusions)

1. **[CLAIM, from the r7 project-log entry — verify]** Round 7 says it made two
   corrections to round 6. Corrections to a previous round are higher-risk than new
   work: they are written by someone who already believed a wrong thing once. Check
   that each correction actually corrects, and that it does not silently narrow the
   claim it replaces.
2. `markdown.ts` gained ~94 lines against ~1060 lines of new test. **[CLAIM]** That
   ratio suggests most of the round was test work. If so, the interesting question is
   whether the production changes are adequately motivated by the tests, or whether
   tests were written to fit the code.
3. **[MEASURED]** There is a known-deferred item: the sanitizer's guard is a REGEX-based
   sink guard, and there is an open follow-up to replace it with a typescript-eslint AST
   rule. It is deliberately NOT in this round's scope. Do not request it here; if you
   find the regex approach has a concrete escape this round makes worse, that IS in
   scope and I want it loudly.
4. **[MEASURED]** There is a separate open follow-up to invert `markdown.ts` to an
   allow-list. Also deliberately out of scope for r7. Same rule as above.

## Standing bars

- **A claim you did not verify must be labelled as unverified.** A narrower true claim
  beats a broader unverified one, every time.
- **Positive control before any negative claim.** "No occurrences of X" from a grep
  that has never returned a hit is not evidence. Make it find something first, show
  that, then show the zero.
- **Exit codes come from the child process, never through a pipe.** `npm test | tail`
  reports `tail`'s status. This exact error has been made twice on this workstream.
- **Any harness must ABORT on a failed prerequisite** rather than continue and print a
  green. Eleven void harnesses on this workstream have produced confident wrong
  numbers, and every one of them looked clean. The only detector that has ever worked
  is *a number contradicting something visible*.
- **Predict counts BEFORE measuring them.** Write the prediction down first.
- **Costly disclosure is the trust signal.** If you could not verify something, name the
  limit and stop — do not reason onward from it. Carrying an unverified limit forward
  cost this workstream a wrong production-security call last week; asking would have
  cost eleven minutes.
- **Do not push. Do not modify production code.** Your independence depends on it.

## Required report sections

Write to `/scion-volumes/scratchpad/projects/farmtable/reports/review-195-r7.md`:

1. **VERDICT**: APPROVE or REQUEST CHANGES, with severity-classified findings.
2. **C-A — claims I could not verify**: everything load-bearing you had to take on
   faith, including anything in this brief. Be specific about what would falsify each.
3. **C-B — the single finding you are least sure about**, and what a second pair of eyes
   should check.
4. **WHERE THIS BRIEF IS WRONG**: if nothing, say so explicitly.

You MUST write that report file, commit a project-log entry in `.design/project-log/`,
and then mark the task complete. Do not stop after the analysis — several agents on
this workstream have finished the thinking and never written the artifact.
