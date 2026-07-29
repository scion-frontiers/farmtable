# `reports/r8/` — why r8 legs write here and not to `reports/`

**`reports/` IS A CROSS-LEG CONTAMINATION CHANNEL.** `audit-xss-r7` §8.0 disclosed that two
lines of `review-xss-r7.md` entered its context through a `reports/*.md` grep, and filed the
**flat layout** as the defect rather than its own grep. It is right, and the disclosure is
exactly the behaviour the independence rule is for.

**THIS IS THE SECOND INSTANCE OF ONE CAUSE, NOT TWO INCIDENTS.** The first was the mandatory
shared `_run-queue-log.md` breaking pre-registration independence (EM-245): pre-registering
into a file the other legs can read means reading the other legs' predictions. Same shape.
**Two instances from one cause makes it a LAYOUT problem, not a DISCIPLINE problem** — and a
discipline remedy aimed at a layout cause reports compliance and changes nothing.

## The rule

r8 legs write findings **only** under `reports/r8/<leg-name>.md`. A leg greps its **own**
subdirectory. A leg that greps `reports/` wholesale will pull its peers' live findings and
must disclose it, as `audit-xss-r7` did.

**THIS DIRECTORY DOES NOT MAKE THE CHANNEL SAFE — IT MAKES A WIDE GREP VISIBLE.** A leg can
still read anything on disk. The change is that doing so now requires naming a path outside
its own scope, which is auditable in a way that `grep -rn reports/` was not.
