# BRIEF — review-xss-r6 (CODE REVIEW)

**READ `_r6-COMMON.md` FIRST. It is binding and it contains the build fence, the tree
provenance, the cold-first ordering and the shell facts.**

- **YOUR ROOT: `/workspace/farmtable-review-xss-r6`** — yours alone.
- **SHA: `c108acbcfa2357862576092469828709bb6c4090`**, detached.
- `web/dist` in your tree **was built in your tree** at this SHA. `web/node_modules` was
  installed from the lockfile. You are the only leg for whom this is true.

## YOUR QUESTION

**Is this diff correct, and is what it claims about itself true?**

Six rounds have been spent on one axis. The round's own artefacts are unusually careful, which
is exactly the condition under which an independent read stops happening. Your job is the read
that would have happened if none of those artefacts existed.

Not a checklist. In particular I am interested in:

- **Correctness of the production change**, separately from the guard that pins it. Across the
  whole range `d305391..c108acb`, how much of the diff is production behaviour and how much is
  apparatus? A previous round in this workstream turned out to be thirteen commits around **one
  substitution**, and my brief for it described a round that did not happen.
- **Every sentence in a comment, a commit message or a project-log entry that asserts a fact
  about the code.** This project has shipped production comments that describe tests which
  cannot fail and narrowings that are not true. **A false sentence next to correct code is a
  finding**, because the next person to change the code will believe it.
- **The guard as engineering**, not as a security control — that is another leg's question.
  Is it maintainable? What happens to it when the web tree is refactored? Who has to update it,
  how would they know, and what do they see when it fires?
- **Interfaces and seams.** Whenever two branches touch adjacent policy surfaces, the seam is
  nobody's territory by construction. This branch and the markdown-sanitisation branch both
  define URL scheme policy. Where is policy actually stated in this tree, and does that
  statement match the code?
- **Anything you think matters that I have not listed.** See COMMON section 6.

## VERDICT

**APPROVE** or **REQUEST CHANGES**, stated plainly, with blocking items separated from
non-blocking ones. **Separate your verdict from your support for it** — write the verdict, then
write the evidence, and pre-register what would have changed your verdict. A reviewer who cannot
name the finding that would have flipped them has not reviewed.

## DELIVERABLES — NAMED EXACTLY

1. `/scion-volumes/scratchpad/projects/farmtable/reports/review-xss-r6.md`
2. `/scion-volumes/scratchpad/projects/farmtable/reports/review-xss-r6-project-log.md`
3. `/scion-volumes/scratchpad/projects/farmtable/reports/_prereg-review-xss-r6.md`

The report contains, in this order: **PHASE ONE (cold) findings** / **PHASE TWO (post-context)
findings, each attributed** / **VERDICT with blocking items separated** / **WHAT I DID NOT
CHECK** (a real section, it is read) / **WHERE THE BRIEF WAS WRONG** (also real).

**You MUST write all three files, message `eng-manager` your verdict and top items, and then
mark the task complete.**
