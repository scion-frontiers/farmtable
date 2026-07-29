# audit-xss-r4 — security audit, `e6bda7160b95da96dad3f1b8cddc0e2cc9ac8ab1`

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
`/scion-volumes/scratchpad/projects/farmtable/reports/audit-xss-r4.md`

Verdict: **APPROVE** or **REQUEST CHANGES** on `6805daa..e6bda71`.
Findings classified **Critical / High / Medium / Low / Info**, each with reachability, and
each labelled **LIVE TODAY**, **LATENT**, or **INTRODUCED BY THIS DIFF**.

---

## Your axis, and what is not

You own **threat modelling, reachability, privilege boundaries, and whether a stated
mitigation actually removes the harm it names.**

Architecture is the review leg's axis; mutation adequacy is the test leg's. Label anything
outside your axis as an impression and name the axis.

**Impact before severity.** Establish whether a defect is covered indirectly before you
rate it. Severity has gone wrong on this project in **both** directions.

---

## STEP 1 — THE OPEN PASS. THIS FILE CONTAINS NOTHING ELSE, BY DESIGN.

Threat-model the diff yourself, unscoped, and write your findings down before you read my
checklist. Then read it.

**Attribute every finding `[OPEN]` or `[CHECKLIST]`.** My targeting has steered a round
away from the defect with every sentence true. Your open pass is the control on my brief.

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
4. I write `audit-xss-r4-checklist.md` into this directory and tell you. It contains
   STEP 2 (the checklist) and the required deliverables.
5. Read Part II (`_xss-r4-method-block.md`), then the checklist. Tag those findings
   `[CHECKLIST]`.

**Do not wait idle at step 3.** Reading, grepping, AST work and git archaeology are
unrestricted and I want them front-loaded. Only builds and suites need my grant.

**If I am slow, that is my failure and not a reason to skip the gate.** Ping me again.
