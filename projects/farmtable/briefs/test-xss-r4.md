# test-xss-r4 — test review, `e6bda7160b95da96dad3f1b8cddc0e2cc9ac8ab1`

**READ `_xss-r4-baseline-block.md` (PART I) IN THIS DIRECTORY FIRST, IN FULL.**
It has your tree, your inputs, the gate table, the environment I built by hand, the
stranded-mutant safety procedure, and the **binding dispatch policy — you are on a
shared machine that crashed tonight, and you must ASK ME before running any build or
suite.**

**THEN WRITE YOUR OPEN PASS. ONLY THEN read `_xss-r4-method-block.md` (PART II).**
**THE CHECKLIST IS NOT IN THIS FILE — see "HOW YOU GET THE CHECKLIST" at the bottom.** Part I is facts; Part II is method and targeting. The split is new
this round: a leg measured that putting method in the mandatory-first document made an
uncontaminated open pass impossible by construction. If you find Part I alone left you
under-equipped, say so — that is a result I need.

Write your report to
`/scion-volumes/scratchpad/projects/farmtable/reports/test-xss-r4.md`

Verdict: **APPROVE** or **REQUEST CHANGES** on `6805daa..e6bda71`.

---

## Your axis, and why it is the deciding one this round

You own **test adequacy, vacuity, mutation, and whether an assertion can fail for the
reason it claims.**

Architecture is the review leg's. Exploitability is the audit leg's. Label anything
outside your axis as an impression and name the axis.

**This round is almost entirely your axis.** Round 3's verdict was *"the measurements are
right and the sentences above them are wrong."* Round 4 went after the instruments — and
found that **two of the three meta-oracles this branch relies on had measured fail-opens
of exactly the class the round was convened to eliminate.** So the question in front of
you is not "are there enough tests." It is:

> **Can this branch's oracles fail?** And for each one: **what is the level above it that
> would notice if it stopped working — and if there is none, say so.**

**NOTHING DOWNSTREAM OF X CAN FALSIFY X.** You cannot check a scanner by running it. You
check it by *making the thing it is supposed to find* and watching it find it.

---

## STEP 1 — THE OPEN PASS. THIS FILE CONTAINS NOTHING ELSE, BY DESIGN.

Look at what this diff tests, what it cannot test, and where its oracles terminate. Write
your own list down in your report **before** you read my checklist.

**Attribute every finding `[OPEN]` or `[CHECKLIST]`.** That makes the countermeasure
falsifiable. A measured null is a result.

**If any message I send you contradicts this ordering, the brief wins and tell me.**

---

---

## HOW YOU GET THE CHECKLIST

**Your checklist does not exist on disk yet. I am holding it in my own container.**

Why: a sibling leg measured, tonight, that my previous brief said *"do this before
reading section 2"* and then put section 2 **fourteen lines below, in the same file.**
Opening the file reads it. Its open pass was contaminated and the cause was structural,
not the leg's fault. That leg's remedy — *"ship the checklist as a SEPARATE file,
released after the open pass is filed"* — is what you are looking at. **This is the third
level at which this same defect has been found: dispatch-vs-brief, then Part-I-vs-method,
now within-brief.** I would rather pay a message round-trip than hand you another
impossible instruction.

So:

1. Read Part I (`_xss-r4-baseline-block.md`).
2. Write your open pass into your report file, on disk, tagged `[OPEN]`.
3. Message me: `scion message farmtable-em-task-state-model-v2 "OPEN PASS FILED"` — plus, if you want, the
   list of runs you will need, so I can queue them while you read.
4. I write `test-xss-r4-checklist.md` into this directory and tell you. It contains
   STEP 2 (the checklist) and the required deliverables.
5. Read Part II (`_xss-r4-method-block.md`), then the checklist. Tag those findings
   `[CHECKLIST]`.

**Do not wait idle at step 3.** Reading, grepping, AST work and git archaeology are
unrestricted and I want them front-loaded. Only builds and suites need my grant.

**If I am slow, that is my failure and not a reason to skip the gate.** Ping me again.
