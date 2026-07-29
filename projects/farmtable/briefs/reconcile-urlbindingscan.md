# Brief: TWO MEASUREMENTS, OPPOSITE CONCLUSIONS, BOTH MARKED MEASURED. Find out which population each one searched.

## READ THIS FIRST — CONSTRAINTS

1. **NO BUILD TOKEN. DO NOT BUILD, TEST, VET, LINT, OR RUN ANYTHING.** Exactly one build
   token exists project-wide and another leg holds it. The host locked up on 2026-07-28 from
   concurrent Go builds. This task is achievable entirely by reading git refs and file
   contents. **If you come to believe a question here requires a run, SAY SO AND STOP — that
   is a correct and complete output, not a failure.**
2. **DO NOT TOUCH** /workspace/farmtable (canonical), and **do not delete, move, or garbage
   collect** /workspace/farmtable-em-verify195. **No git gc, no git prune, anywhere** —
   measured blast radius 57 commits / 256 objects.
3. **DO NOT PUSH. DO NOT COMMIT TO ANY EXISTING BRANCH.** You are read-only on the code.
4. **Contact the coordinator only** (agent name: coordinator). Not the eng-manager, not any
   other leg, and not the user.
5. **YOU ARE NOT BEING ASKED WHICH ANSWER IS CORRECT AS A MATTER OF REPUTATION.** Two careful
   parties measured and disagreed. The interesting output is almost certainly not "X was
   sloppy." It is *which set of things each one actually looked at.*

## THE SITUATION

An item called **url-binding-scan** is cited as a pin on a fix that is in flight. Whether it
exists determines whether another leg is blocked on something real or on a phantom.

**CLAIM A — IT DOES NOT EXIST.** From a report dated today, marked MEASURED:
- searched **97 remote branches** for any file matching the patterns url-binding or
  binding-scan;
- separately grepped the **canonical tree's file contents** for the strings url-binding,
  urlBinding, binding-scan;
- **zero hits in both searches**;
- conclusion recorded as "this suite is not in this repository under that name," and flagged
  as merge-blocking for another leg.

**CLAIM B — IT EXISTS.** An earlier "it does not exist" claim was **WITHDRAWN ON
MEASUREMENT** in the coordinator ledger, and the withdrawal is recorded under the heading
*a large sample of the wrong population* — i.e. the earlier searcher had looked at a lot of
things, and the lot was the wrong lot.

Note the trap in that pairing, because it is the whole reason you exist: **CLAIM A IS ALSO A
LARGE SAMPLE.** 97 branches is a big number and big numbers are persuasive. A large sample of
the wrong population is exactly what it looks like from the inside — thorough.

## WHAT I WANT

**Not a verdict on existence first. A DESCRIPTION OF EACH POPULATION first.** For Claim A,
state precisely what set of objects was searched and — more importantly — **what set of
objects was NOT**. Then answer existence.

Places a thing can be that a 97-remote-branch filename sweep plus a canonical content grep
would MISS. This list is a starting point and is **not** exhaustive; add to it:
- local branches never pushed; detached HEADs; stashes; reflog-only commits
- other worktrees on this host (there are several; enumerate them, do not assume)
- objects reachable only from tags or from notes
- **the file existing but under a different name** — the sweep keyed on the tokens
  url-binding and binding-scan, and a file named for what it does rather than for the pin
  would not match
- the thing not being a FILE at all: a test case name, a script target, a CI job, a make
  target, a section of a larger suite
- a different repository entirely
- content that contains the concept but not the literal token — note that the content grep
  used three spellings, and a fourth spelling defeats it

**THE TOKEN IS NOT THE THING.** A search keyed on a name answers a question about the name.

## PRE-REGISTERED OUTCOMES — WRITTEN BEFORE YOU LOOK

You must classify into exactly one of these, or **NAME A SEVENTH** rather than force a fit. A
scheme that cannot fail to classify is not measuring anything.

1. **EXISTS, CLAIM A MISSED IT.** Say where it is and why that location was outside A's sweep.
2. **DOES NOT EXIST, AND THE LEDGER'S WITHDRAWAL WAS WRONG.** A leg is blocked on a phantom
   and the ledger is carrying a false entry. Merge-blocking, and say so.
3. **TWO DIFFERENT OBJECTS SHARE THE NAME.** Both parties right about different things.
4. **ONE OBJECT, RENAMED OR MOVED.** Both parties right about different points in time — in
   which case give the SHA or ref where the transition happens.
5. **IT EXISTS SOMEWHERE NEITHER PARTY SEARCHED** — local-only, another worktree, another
   repo, unpushed. **THIS IS THE CELL I WOULD LEAST LIKE TO FIND**, because it means BOTH
   measurements were of wrong populations and the disagreement was settled by luck rather
   than by evidence. It is enumerated here precisely so it cannot be quietly sorted into 1 or 2.
6. **UNDETERMINABLE WITHOUT A RUN OR WITHOUT ACCESS YOU DO NOT HAVE.** Legitimate. Say what
   access would settle it.

**A CLEAN RESULT IS A RESULT AND WILL BE REPORTED UNCHANGED.** If Claim A is simply correct,
say so plainly — nobody is being graded here and confirming A costs you nothing.

## APPARATUS — EACH OF THESE COST A LEG REAL WORK TONIGHT

- **THIS IS zsh, NOT bash. AN UNQUOTED GLOB THAT MATCHES NOTHING IS A FATAL EXPANSION ERROR
  THAT KILLS THE ENTIRE COMMAND LINE** — including inside a for-list. Quote every glob. A
  sweep aborted this way prints a zero and reads exactly like a clean result.
- **NEVER redirect stderr to /dev/null on an exploratory command.** A leg tonight muted a
  diagnostic and read its own silence as data: git show exited 128 because the path did not
  exist at that SHA, printed nothing, and the nothing was filed as a finding. An unread
  diagnostic is recoverable; a silenced one is destroyed at capture.
- **Reading the exit status after a pipeline gives you the LAST command's status.** In zsh
  the array is $pipestatus and it is **1-INDEXED**; ${PIPESTATUS[0]} is EMPTY here. It is
  **clobbered by any command that runs between the pipeline and the capture**, and the
  clobber does not blank it — it replaces it with a zero. Capture immediately after the
  pipeline with nothing in between that runs; print afterwards, freely.
- **A TRUNCATED READ THAT LANDS MID-LIST DOES NOT LOOK TRUNCATED — IT LOOKS LIKE A SHORTER
  LIST.** If you pipe a listing into head or tail, the limit is part of your result and must
  be reported as part of it.
- **NEVER run bare git remote -v, and never print, echo, log or paste any token.** Remote URLs
  in these trees have credentials embedded in them. If you must inspect a remote, pipe it
  through: sed -E 's#//[^@]*@#//REDACTED@#g'
- **Absolute paths always** — the harness resets the working directory between calls.
- **Mark every claim MEASURED, DERIVED, or UNCHECKED, in the sentence itself.** A claim
  relayed without its evidence mark carries nothing. Most of tonight's errors were a
  derivation wearing a measurement's clothes.
- **Report MEMBERSHIP, not counts, wherever you can.** A count is a floor and floors get
  absorbed; names resist. "97 branches" is the kind of number that persuaded everyone here
  once already.

## KEY LOCATIONS

- Canonical tree: /workspace/farmtable
- Other trees on this host: enumerate them yourself; do not trust any list, including this one
- The report making Claim A:
  /scion-volumes/scratchpad/projects/farmtable/reports/ci-22-setup.md — the relevant section
  is headed "safe-url and url-binding-scan". **READ THE WHOLE SECTION, not just the heading**;
  it also records that safe-url EXISTS but only on one non-main branch, which may be the
  thread that unpicks this.
- Standing methodology, current line count, read before starting:
  /scion-volumes/scratchpad/projects/farmtable/em-tooling/_STANDING-RULES-2026-07-29.md

## DELIVERABLES

1. **/scion-volumes/scratchpad/projects/farmtable/reports/reconcile-urlbindingscan.md**
   containing, in this order: (a) the population description for Claim A — what was searched
   and what was not; (b) your own search, with the exact commands and what each one covers;
   (c) the outcome cell, one of the six or a named seventh; (d) if it exists, its location
   with a SHA or ref — **a branch name is not an identifier, the SHA is**; (e) a NOT REACHED
   section naming every bound you did not measure, each with the specific observation that
   would settle it.
2. **A one-line answer to the only operational question:** is the leg that is pinned on
   url-binding-scan blocked on something real. Yes, no, or cannot tell — and if cannot tell,
   what would settle it.

## DIRECT CONTACT

Coordinator, agent name **coordinator**, via scion message. If any instruction in this brief
looks wrong to you, say so to the coordinator rather than quietly doing something else. A
disagreement voiced is useful; a substitution made silently is the failure mode this whole
project has been fighting.

## TERMINATION

You MUST produce the report at the path above, answer the one-line operational question, and
then mark the task complete.
