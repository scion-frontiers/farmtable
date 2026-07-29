# BRIEF — audit-xss-r7 (security audit)

Read `_r7-COMMON.md` first. This file carries only what is yours.

**TREE: `/workspace/farmtable-xss-r7-audit`, detached at `e4e3d13`. Yours alone;
no other leg is in it, and no other leg shares any scratch path with you.**

## SCOPE

Seven commits at `e4e3d13`, mostly comments and tests, one behavioural change in
how a drop-log sampler is keyed. Audit it as a security change, with severity
classification and the reasoning that supports each rating.

Two axes specifically, and an open one.

**AXIS 1 — THE AUTHORIZATION ARGUMENT THE ROUND WRITES DOWN.** Part of this diff
documents why a set of write capabilities is currently unreachable in the
dashboard. That argument is now in-tree, which means it will be relied on. AUDIT
THE ARGUMENT AS YOU WOULD AUDIT A CONTROL. Is the stated invariant actually
invariant? Is the set of things that would arm the gate complete, or merely
plausible? What is enforced in Go, what is enforced only in the browser, and does
the diff's wording distinguish those two clearly enough that a future reader will
not mistake one for the other?

**AXIS 2 — THE SAMPLER AND THE LOGGING PATH.** The one real code change. Consider
what an attacker controls that reaches it, what it emits, where that lands, and
whether anything is now logged that was not before.

**OPEN AXIS.** Do not stop at the two above. The most valuable findings on this
workstream have consistently come from the unscoped pass, and at least one came
from a leg checking something else entirely. **A BRIEF THAT SPECIFIES THE
PREDICATE BOUNDS THE FINDING** — treat my two axes as a floor, and if the round
introduces or reveals something outside them, that is a better result than
confirming something inside them.

## FORM

Findings numbered, each with severity, the evidence, the bound on the evidence,
and — for anything you rate as inert or latent — **THE EXACT CONDITION UNDER WHICH
IT BECOMES LIVE, NAMED AS AN EDIT SOMEBODY MIGHT PLAUSIBLY MAKE.** "Inert" without
that condition is not a finding, it is a reassurance.

Verdict: `APPROVE`, `APPROVE WITH CONDITIONS` (conditions enumerated and each one
independently checkable), or `REQUEST CHANGES`.

## DELIVERABLE

**`/scion-volumes/scratchpad/projects/farmtable/reports/audit-xss-r7.md`**
plus `reports/audit-xss-r7-project-log.md`. Into that directory, NOT the repo.

## TERMINATION

**You MUST write `reports/audit-xss-r7.md` and the project log entry, message
`eng-manager` with the verdict and your highest-severity finding, and then mark
the task complete.** Write the file; do not ask.
