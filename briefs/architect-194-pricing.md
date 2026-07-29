# RULING BRIEF: #194 WRITE PRICING SEMANTICS

## YOU ARE DECIDING, NOT ADVISING
Eleven review rounds have proposed remedies and adopted none. Three reviewers
proposed three prices and argued for an hour. The project does not need a
fourth opinion; it needs a decision with authority behind it. YOU HAVE THAT
AUTHORITY. Rule, even if the ruling is imperfect. An imperfect adopted price
beats a twelfth round.

## THE QUESTION, IN ONE SENTENCE
What should a label write cost when it removes a stage, given that the union
can push the after-state back to exactly the before-state, which currently
costs nothing and is therefore a live authorization bypass?

## THE DEFECT, ALREADY ESTABLISHED - DO NOT RE-LITIGATE IT
The monotonicity theorem in the LabelDeltaLifecycleStages docblock is false.
The consumer at internal/server/server.go:847 guards the cross-product price
behind an equality test on the stage set, and equality is not monotone. The
theorem quantifies over the inner loop; the defect is in the outer if. Measured
twice under quarantine from a clean base, 24 named failing subtests, exploit
path traced. This is settled. You are not re-deriving it.

## THE ONE CONSTRAINT THE ROUNDS DID ADOPT - IT BINDS YOU
The gate must not price against a baseline that no execution path produces.
Any remedy you rule for must satisfy this.

## WHAT TO PRODUCE
ONE PAGE at /scion-volumes/scratchpad/projects/farmtable/ruling-194-pricing.md:
1. The chosen price - RM-1, RM-2, RM-3, or a fourth of your own.
2. Why, in under 200 words, against the adopted constraint.
3. Why each rejected option loses, one sentence each.
4. What a correct implementation must satisfy, as conditions a test can check.
No survey, no options matrix, no rationale sections. A ruling.

## ESCALATE TO ME, ONLY ON THIS TRIGGER
If the candidate prices differ in what a LEGITIMATE USER CAN OR CANNOT DO -
i.e. one of them blocks edits that should be allowed, or allows edits that
should be blocked, in a way a user would notice - stop and tell me. That is an
owner decision and I will take it to him. If they differ only in internal
mechanics, rule it yourself and do not escalate.

## REPORTING
You now report to farmtable-em-hardening, not to the task-state EM. Format:
STATUS / BLOCKER / NEXT ACTION, under 20 lines.

## CONSTRAINTS
- Never stage with a directory or glob pathspec. Name every file.
- Never print, log or commit a credential; no bare git remote listing.
- Do not build a frontend anywhere.

You MUST write ruling-194-pricing.md with a single chosen price, then mark the
task complete.
