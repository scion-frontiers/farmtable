# dev-onhold-toolbar — a LIVE acceptance-criteria violation at main

You are fixing one defect that is live in production today. It is small. It is not urgent in the
sense of an outage, and it IS urgent in the sense that it currently has no path to a user at all:
it lives in a file whose other changes sit on a branch 39 commits deep, which is itself underneath
a security branch with no forecastable merge date. That is why you are cutting from main and not
from any review branch.

## 0. THE ONE INSTRUCTION THAT OUTRANKS THE REST

YOUR FIRST ACT IS TO ESTABLISH WHETHER THE DEFECT RENDERS. Not to fix it.

What is currently known is narrow and I am giving it to you at exactly its true strength:

  [MEASURED] At main (cc92735), in web/src/components/ft-toolbar.ts, a PHASE_OPTIONS array
  contains four entries including ON_HOLD.
  [NOT MEASURED] Whether that option is actually rendered into the DOM and selectable by a user.

Nobody has checked the second thing. The contract's acceptance criteria say prime on_hold must
not be selectable through the web interface. If it renders, that criterion is violated live.

COMING BACK WITH "IT DOES NOT RENDER" IS A COMPLETELY ACCEPTABLE RESULT AND IS NOT A WASTED
ROUND. It would mean the array entry is dead and the fix is a cleanup rather than a security-
adjacent correction, and it would mean the caveat currently in an owner-facing document is
correctly stated. Do not go looking for the answer that justifies the task. If it does not
render, say so plainly, say how you established it, and stop before changing behaviour.

## 1. TREE

Work in your own tree. Create it by cloning from the local path:

    git clone /workspace/farmtable /tmp/onhold/work

NEVER `cp -a`, `rsync`, `tar` or `mv` a working tree or a .git directory. That is prohibited
outright, not gated. Then verify what you got and ANNOUNCE THE TREE AT CREATION, before you
measure anything in it:

    git -C /tmp/onhold/work remote -v
    grep -c -E 'github_pat_|ghp_' /tmp/onhold/work/.git/config || true

On that grep: `grep -c` PRINTS 0 AND EXITS 1 when clean, which aborts a batched check. Use
`|| true`. NEVER write `|| echo 0` — that manufactures a zero when the command failed for an
unrelated reason. If the count is anything but 0, STOP and tell me; do not print the value, do
not fix it, do not scrub it.

Branch from cc92735. Do not push. Do not touch any other tree under /workspace.

## 2. DO NOT CREATE web/dist

The absence of that directory is a LIVE FINDING in this project and manufacturing it destroys the
evidence. I have already made that mistake in two trees today and it is why several measurements
had to be voided. If some command you want to run fails because web/dist is missing, THAT IS A
RESULT — report it as one. Do not repair it.

## 3. YOUR TEST COMMANDS DO LESS THAN THEY APPEAR TO

This is measured, today, and it bears directly on you:

  npm test DOES NOT TYPECHECK THE APPLICATION SOURCE AT ALL. web/tsconfig.test.json sets
  include: ['src/**/*.test.ts'], overriding the root include: ['src']. A planted type error
  inside an application function passes `npm test` GREEN, exit 0. Proven with paired controls.

So a green `npm test` says NOTHING about ft-toolbar.ts. If you want to know that your change
compiles, run tsc against the ROOT config explicitly and confirm which config you got:

    npx tsc --noEmit --listFiles     # then confirm ft-toolbar.ts appears in the output

`--noEmit` does not write web/dist. Confirm that remains true for anything else you run.

## 4. SCOPE

Expected to be one file. That is an expectation, not a permission boundary — if the correct fix
touches a second file, take it and say why. If it would touch shared infrastructure (the server,
the output pipeline, auth, config), STOP AND TELL ME instead of proceeding; that gets a dedicated
owner and sequencing, and a drive-by from this leg is exactly what I am trying to prevent.

Ship a regression pin that goes RED if someone puts the option back. Before you believe that pin,
BREAK IT ON PURPOSE ONCE and show me the RED — a pin nobody has seen fail is not evidence.

## 5. STAGING — ABSOLUTE, NO EXCEPTIONS

NOBODY RUNS `git add -A` OR ANY BULK STAGE ANYWHERE. That covers `git add .`, `git add -u`,
`git add` with a glob or a directory, `git stash -u`, `git stash -a`, `git commit -a`, and
`git commit` with a pathspec broader than one file. STAGE PATHS YOU TYPED IN FULL, OR STAGE
NOTHING. IF YOU CANNOT NAME EVERY FILE THE COMMAND WILL TOUCH BEFORE YOU RUN IT, DO NOT RUN IT.

The concrete reason, not a policy abstraction: one bulk add in the wrong directory stages a live
credential into a pushable repository. That credential exists on this host today.

## 6. REPORTING RULES THAT ARE BINDING THIS ROUND

- ANY SWEEP THAT RETURNS ZERO MUST DECLARE ITS ITERATION COUNT ALONGSIDE THE RESULT, emitted in
  band by the loop itself. "Zero hits over 14 items" and "zero hits over 1 item" produce the same
  output and are not the same result. I published a zero this morning that came from a loop that
  ran once because zsh does not word-split unquoted scalars; the empty output was
  indistinguishable from a clean result and the clean result was the comfortable one.
- TAG EVERY FIGURE: MEASURED / DERIVED / UNCHECKED. A measured figure is pasted from output with
  the command shown.
- THE TAG ATTACHES TO A SENTENCE, NOT A SECTION. A correct number with an inference under it
  inherits the number's authority. That is the error I made today and it nearly reached the owner.
- ANNOUNCE ANYTHING YOU CREATE IN A SPACE YOU ARE ALSO MEASURING, AT CREATION, in a place the
  measurement reads. Not recalled afterwards.
- If a partial result is all you can get, STATE THE DIRECTION OF WHAT YOU COULD NOT RUN. Partial
  results drift flattering by construction.

## 7. DELIVERABLES — ALL THREE, OR THE TASK IS NOT DONE

1. The fix and its regression pin, committed, NOT pushed, paths staged individually.
2. A report at /scion-volumes/scratchpad/projects/farmtable/reports/onhold-toolbar.md — flat path,
   that exact filename.
3. A project log entry in-tree. Developers skip this unless told; you are told.

YOU MUST WRITE ALL THREE DELIVERABLES AND THEN MARK THE TASK COMPLETE.

Report to me (farmtable-em-task-state-model-v2) when done, or immediately if you hit §4's stop
condition or anything in §1 comes back non-zero. Nothing in this brief is load-bearing until you
have measured it — including this brief. If a rule here cannot be satisfied, say so and stop.
