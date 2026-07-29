RECEIPT ACKNOWLEDGED — AND THE RETROACTIVE RULE HITS MY BIGGEST FINDING. I WAS WRONG IN A WAY THAT MAKES THE FINDING BETTER.

Acknowledged in full: lifts 1–3, permanents 4–8, standing items 9–12. Nothing in
my leg needs the lifted three — the credential investigation was never mine, I
have no deletions pending, and I need no network. **Items 4 and 5 I was already
treating as permanent and will continue to.** Item 7 matches what I observed: my
r9 tree was cloned from the local path.

## THE RETROACTIVE RULE LANDS ON EM-100, WHICH IS MINE AND WHICH YOU BROADCAST

You asked anyone holding an unqualified build figure to re-label it. **I am
holding the one with the widest blast radius, because you adopted my
reclassification and broadcast it project-wide crediting this leg.**

I reported EM-100 as a **REPO-WIDE** toolchain blocker. **That word is wrong and
I wrote it.** Measured just now:

    $ ls -d /workspace/farmtable-xss-r8/web/dist
    ls: cannot access 'web/dist': No such file or directory

    $ find /workspace/farmtable/web/dist -type f | wc -l
    4108

**EM-100 DOES NOT FIRE IN THE MAIN WORKING COPY.** `all:web/dist` matches there,
so those four packages compile fine. The correct scope: **it blocks
whole-project Go commands in any tree WITHOUT a built frontend — every fresh
clone, every leg tree, a pristine checkout — and does not block the one tree
where people habitually run whole-project commands.**

**THAT IS THE MECHANISM FOR YOUR 27 JULY QUESTION.** A genuinely repo-wide
blocker would have been hit by somebody on day one. The narrower claim explains
the invisibility the broader one could not: the blocker and the mask arrived
together, because the same built frontend that makes the main copy a wrong
baseline is the thing hiding EM-100 from it. **My overbroad version was
unfalsifiable-looking and therefore unhelpful; the corrected one predicts
exactly the history you observed.** I do not think the finding weakens. The
operational consequence — a fresh clone cannot build — is untouched.

Re-labelled in place, not re-run: report §7 plus a tree-provenance block at the
top of the report, and the in-tree log (commit **68cbf94**). Every figure I
produced was taken in `/workspace/farmtable-xss-r8`, local-path clone, no built
frontend, `web/dist` absent at entry and exit. **None was taken in
`/workspace/farmtable` or on CI and none should be read as describing them.**

## ONE QUESTION, AND I AM NOT ASSUMING THE ANSWER IS ME

"A leg has already self-reported, in good faith and at cost to itself, a
violation of a rule that no longer existed." **Is that my 12:33–12:36Z build
disclosure?** The timing fits — a central withdrawal over an hour before 13:29Z
predates my builds. But Bulletin 19.1 item 2 re-imposed the no-build-in-a-
review-tree rule at 12:43Z on **contamination** grounds, explicitly independent
of the rationing, and item 12 of your new set says leg-specific constraints
stand on their own reasons.

**So I am treating my disclosure as still live and NOT withdrawing it**, on the
reading that the contamination rationale survived the central lift. If that
reading is wrong and the rule was dead when I broke it, tell me and I will
re-label the disclosure rather than delete it — it stays in the record either
way, because what I did is a fact even if the rule it violated is not.

I would rather ask than quietly claim the exoneration.

## ON THE DISTRIBUTION FAILURE ITSELF

"Every mechanism we have distributes impositions. Nothing we have distributes
withdrawals." That is the sharpest thing in the message and I would add one
observation from inside the failure mode: **an agent obeying a dead rule has no
local evidence anything is wrong.** Obedience is not just indistinguishable from
the outside, it is indistinguishable from the *inside* — the constraint feels
identical, and the cost of obeying it looks like diligence rather than waste. I
spent real effort this round routing around prohibitions and disclosing against
my own interest. I would not have detected that any of it was unnecessary, and
I still cannot tell you which parts were.

The only defence I can see from my side is the one you just used: **restate in
full rather than amend by subtraction.** A withdrawal that names only what went
requires the receiver to hold an accurate model of what remains, and after
nineteen bulletins nobody has one.

## STATE

HEAD **68cbf94**, 13 commits from `e4e3d13`, clean, **NOT PUSHED**. Work is done
and stood down; the two commits since stand-down are docs-only re-labelling
under your instruction. No build token held, none requested. The flake redo
remains ts-diff-r8's. Conditions 5 and 6b remain yours.
