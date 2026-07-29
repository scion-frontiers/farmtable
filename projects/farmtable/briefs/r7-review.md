# BRIEF — review-xss-r7 (code review)

Read `_r7-COMMON.md` first. It carries the method, the build fence and the
apparatus. This file carries only what is yours.

**TREE: `/workspace/farmtable-xss-r7-review`, detached at `e4e3d13`. Yours alone;
no other leg is in it, and no other leg shares any scratch path with you.**

## SCOPE

Round 7 is a fix round answering blocking findings from three independent reports
at `c108acb`. Seven commits, 931 insertions, seven files. It is almost entirely
comments and tests; there is one behavioural change, in how a drop-log sampler is
keyed.

Your job is the ordinary one: correctness, architecture, readability,
maintainability — plus the specific question this round raises.

**THE SPECIFIC QUESTION. MOST OF THIS DIFF IS PROSE THAT MAKES CLAIMS ABOUT CODE.**
A comment that states a false property of the tree is not a style defect here; on
this workstream it is the defect class the round exists to eliminate, and a
previous round shipped a comment describing a test that could not fail. So:

**FOR EVERY LOAD-BEARING SENTENCE THE DIFF ADDS, RESOLVE IT AGAINST THE SOURCE AT
`e4e3d13` AND SAY WHETHER IT IS TRUE.** Where a sentence names a file, a line or a
symbol, go and look. Where it makes a claim about a population, check the
population, not a sample. Where it states an invariant, ask what would make the
invariant false and whether anything would go red when it did.

Then the ordinary review questions on the one real code change, and on the tests.

Report, explicitly, on completeness in both directions: items the fix brief asked
for that are absent, and changes present that nothing asked for.

## VERDICT

`APPROVE` or `REQUEST CHANGES`, stated plainly, with blocking and non-blocking
findings separated. Separate your verdict from your support for it — write the
verdict, then the evidence, and pre-register what you would have concluded had the
evidence gone the other way.

## DELIVERABLE

**`/scion-volumes/scratchpad/projects/farmtable/reports/review-xss-r7.md`**

Then a project log entry at `reports/review-xss-r7-project-log.md`. Write the log
into that directory, NOT into the git repository — the clone is disposable and a
commit there would be single-homed on one container's disk.

## TERMINATION

**You MUST write `reports/review-xss-r7.md` and the project log entry, message
`eng-manager` with the verdict and your single most important finding, and then
mark the task complete.** Do not stall after the analysis. Do not ask whether to
write the file — write it.
