# ROLE BRIEF — review-xss-r8 (CODE REVIEW)

Read `briefs/_r8-COMMON.md` in full first. It is apparatus and contains no targeting.
Your tree: **`/workspace/farmtable-review-r8`**, already at `901670e`.
Your report: **`reports/review-xss-r8.md`**. Your log: **`reports/review-xss-r8-project-log.md`**.

## YOUR PASS

**COLD PASS FIRST, WRITTEN TO DISK, BEFORE YOU OPEN `briefs/_r8-PHASE-TWO.md` OR ANY PRIOR REPORT.**

Read `e4e3d13..901670e` and judge it on correctness, readability, architecture, and whether the
change does what its commits say it does. Seven files, 476 insertions. That is small enough to read
every line, so read every line.

The axes I care most about, in order:

1. **Does each commit's message describe what the commit actually does?** A commit that claims a
   guard and ships a comment is the defect this project has hit most often.
2. **Are there statements in the code — comments, doc strings, log messages — that are FALSE about
   the code around them?** This branch has shipped a false production comment in more than one prior
   round. **A COMMENT IS AN ASSERTION AND IT IS UNTESTED BY CONSTRUCTION.**
3. **Work delivered that nobody asked for**, and work asked for that is not there. Both directions.
4. Anything in `internal/server/convert.go` and `internal/server/export_import.go` that changes
   behaviour on a path reachable from untrusted input.

## WHAT I DO NOT WANT

Do not re-litigate rounds 6 and 7. Do not fix anything. Do not run a build without the token.
Do not tell me the code "looks reasonable" — tell me what you checked and what you could not.

## VERDICT

`APPROVE` / `APPROVE WITH CONDITIONS` / `REQUEST CHANGES`, at the top, with a severity per finding.
**State separately what would have changed your verdict.** If you cannot reach a verdict on some
axis because you lacked the token or the tree, say which axis and why — **a declared non-answer is
worth more to me than a confident one, and it is the only kind that never silently collides with
another leg's finding.**
