# BRIEF — test-xss-r6 (TEST / QA REVIEW)

**READ `_r6-COMMON.md` FIRST. It is binding and it contains the build fence, the tree
provenance, the cold-first ordering and the shell facts.**

- **YOUR ROOT: `/workspace/farmtable-test-xss-r6`** — yours alone.
- **SHA: `c108acbcfa2357862576092469828709bb6c4090`**, detached.
- `web/dist` in your tree was **COPIED**, not built here. `web/node_modules` was installed from
  the lockfile (79 entries). If any finding of yours depends on `dist` being your own build,
  rebuild it and say so.

## YOUR QUESTION

**What could break in this diff without anything going red — and who would run the thing that
went red anyway?**

Two halves, and the second is the one that keeps getting skipped:

**HALF ONE — CAN IT FAIL.** For each behavioural claim the round makes, is there an artefact
that goes red when the claim stops being true? Beware the shapes this project keeps producing:

- a **count floor** where an **absolute per-axis assertion** was needed — an aggregate that a
  count-neutral corruption walks straight through;
- a **positive control that shares a dependency with its subject** — a mirror, not a control;
- a **pin keyed on the outcome** rather than the cause, which absorbs a second defect and
  reports agreement;
- a test that passes because the fixture never exercises the path (**a vacuous row**);
- **an unrun test file is not an inert test file**, and a green from a scanner that never reads
  `_test.go` means *not scanned*, not *scanned and cleared*.

**HALF TWO — WHO RUNS IT.** A gate has two populations: **what it can see, and what invocation
path runs it, and who takes that path.** For every check this round adds, name the invoker. If
nothing invokes it, that is the finding and it outranks everything about its internals. Note
from COMMON section 7 that CI exists on the real remote `main` but not at this SHA, and that
there is a predicted, unverified merge blocker between the two web-test strategies —
**confirming or refuting that prediction is in scope and I would value it.**

## MEASUREMENT DISCIPLINE

- Mutations are permitted **in your own tree**, must be reverted, and the green must be
  re-confirmed and reported after the revert.
- **Pre-register the outcome and the arm separately, before running.** Every cell of every
  matrix carries its arm.
- **Five tests flake at ~4.5% per full-suite run.** A ~27-row single-run matrix is ~71% likely
  to contain a spurious red. Repeat before you file a red as a property. Say how many times you
  ran each row.
- Full-suite runs **need the build token**. Ask. Single targeted `-run '^TestName' -count=1`
  runs do not, but log them first with ROOT and DIST.

## DELIVERABLES — NAMED EXACTLY

1. `/scion-volumes/scratchpad/projects/farmtable/reports/test-xss-r6.md`
2. `/scion-volumes/scratchpad/projects/farmtable/reports/test-xss-r6-project-log.md`
3. `/scion-volumes/scratchpad/projects/farmtable/reports/_prereg-test-xss-r6.md`

Report order: **PHASE ONE (cold)** / **PHASE TWO, attributed** / **VERDICT, blocking separated**
/ **WHAT I DID NOT CHECK** / **WHERE THE BRIEF WAS WRONG**.

**You MUST write all three files, message `eng-manager` your verdict and top items, and then
mark the task complete.**
