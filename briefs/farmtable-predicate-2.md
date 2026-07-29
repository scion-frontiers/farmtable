# BRIEF: farmtable-predicate-2 — AN INDEPENDENT SECOND PREDICATE

## READ THIS BLOCK BEFORE ANYTHING ELSE. THE ORDER OF YOUR ACTIONS IS THE DELIVERABLE.

You are being run as a **blind second instrument**. Another agent has already swept this corpus
twice for the same objective and found zero. Its own assessment, which is why you exist:

    WIDENING A POPULATION IS THE CHEAP AXIS AND I HAVE DONE IT TWICE. THE EXPENSIVE AXIS IS A
    SECOND INDEPENDENT PREDICATE, AND I HAVE NOT PRODUCED ONE. I CANNOT — BOTH OF MINE CAME OUT
    OF THE SAME HEAD.

Your value is **entirely** in your independence. A result from you that was influenced by its
method is worth nothing at all — worse than nothing, because it will read as corroboration.

### FIVE HARD CONSTRAINTS

1. **DO NOT READ ANY OF THESE UNTIL PHASE 3.** Not to "get oriented", not to "check the format":
   - `briefs/_BRIEF-RULES.md`
   - `/workspace/farmtable/.eng-manager-state.md`
   - any file under `reports/` whose name contains: sweep, hazard, banner, hedge, polarity
   - any file whose first screen announces itself as a rules, standards or methodology document
   If you open one by accident, **say so in your report**. An admitted contamination is
   recoverable; a silent one destroys the whole exercise.

2. **YOU ARE READ-ONLY.** Do not create, modify, move or delete anything in the corpus. Write
   only to your own two output files, named below.

3. **A HOST-WIDE FREEZE IS IN FORCE.** No `git gc`, no `git prune`, no `git repack`, no
   `git worktree prune`, no `git reflog expire`, no deletion of any file, tree, worktree or
   directory, anywhere, for any reason.
   You have no reason to run any git write command at all.

3a. **NO OPERATION THAT CAPTURES FILES INTO GIT BY ANY CRITERION OTHER THAN A PATH YOU TYPED IN
   FULL.** Covers, non-exhaustively, **and the non-exhaustiveness is the point**: `git add -A`,
   `git add .`, `git add -u`, `git add` with a glob or a directory, `git stash -u`, `git stash -a`,
   `git commit -a`, `git commit` with a pathspec broader than one file. **IF YOU CANNOT NAME EVERY
   FILE THE COMMAND WILL TOUCH BEFORE YOU RUN IT, DO NOT RUN IT.** This replaces an earlier
   two-spelling ban that `git stash -u` walked straight through — it had already captured agent
   scratch wholesale three times before anyone noticed. Full statement and evidence:
   `briefs/_BRIEF-RULES.md` §32.1.

4. **NEVER print, echo, log, cat or paste a credential value.** If you encounter something that
   looks like a token, key or password, report its **file path and its sha256 first 16 chars
   only**. Never the value. Do not test whether it works — a validity test is an authentication
   attempt.

5. **Do not contact any other agent.** If you need something, message the coordinator (below).
   Other agents have been instructed not to answer you. This is deliberate.

---

## THE OBJECTIVE, STATED WITHOUT VOCABULARY

Somewhere in a corpus of project documents there may be **text which, if a competent agent read it
and did what it said, would destroy something that cannot be got back.**

That is the whole objective. It is stated as an *outcome* on purpose. **You must not be given a
word list, and you must not ask for one.** Deciding what to look for IS the task.

Some things that may help you think about what "cannot be got back" means here, without telling you
how to search: work that exists in only one place; a record of why a decision was made; evidence
that something happened in a particular order; the only remaining copy of an input. Something can be
unrecoverable without being a file, and a file can be deleted without anything being lost.

## PHASES — DO THEM IN THIS ORDER, AND DO NOT LOOK AHEAD

### PHASE 1 — PRE-REGISTER YOUR PREDICATE, BEFORE YOU SEARCH

Having seen **only a directory listing** of the corpus paths below — not the contents of any file —
write `PREDICATE.md`. It must contain:

- **What you are looking for**, in your own words, as a property of text.
- **The exact mechanism** you will use to find it: every command, pattern, flag and threshold,
  written out. Not a description of a mechanism — the mechanism.
- **Your declared population**: how many files your mechanism will examine, and the rule that
  decides membership. State what your mechanism CANNOT see and why.
- **Your prediction**: how many genuine instances you expect to find. A number. Commit to it.
- **What result would tell you your own instrument is broken.**

Then message the coordinator that Phase 1 is complete, in one line. **Do not wait for a reply.**
Proceed straight to Phase 2. The file's existence before your results is the point; a delay is not.

### PHASE 2 — RUN IT

Run exactly what you pre-registered. If you change the mechanism mid-run — which is allowed and
often correct — **append the change and the reason to `PREDICATE.md` rather than editing what is
already there.** A silently revised prediction is worthless.

Three standards, non-negotiable, because everything on this project is now held to them:

- **ABORTING CONTROLS.** Every detector must be proven alive against a known-positive in the *same
  invocation*, and the run must **abort** if a control fails to fire. A dead detector must crash,
  never report clean.
- **PUBLISH FILES-ENUMERATED == FILES-EXAMINED** as an equality, with both integers. A control
  proves the detector is alive; it does not prove the detector was handed a file. Plant a canary
  *inside* the population, not beside it.
- **CLASSIFY EVERY HIT INDIVIDUALLY AND NAME THE EXCLUDED CLASSES.** `ENUMERATED n = FLAGGED a +
  EXCLUDED b`, and say what b is made of. An exclusion nobody can audit is not a result.

One warning drawn from this project's own failures, which costs you nothing to heed: **an anchor
evaluated against a line is not the same anchor evaluated against a field.** If your pipeline
carries multi-column rows, anchor against the cut field, not the row.

### PHASE 3 — ONLY NOW, COMPARE

Write `FINDINGS.md` first and finish it. **Then** you may read the other agent's results and
methodology. Add a final section comparing the two:

- Did you look for the same property, or a different one?
- Name something your mechanism could see that theirs could not, and something theirs could see
  that yours could not.
- **If you both found zero:** say plainly whether you think that is a clean corpus or two
  instruments sharing a blind spot, and give the reason. You are permitted — encouraged — to
  answer "I cannot tell from inside, and here is what would settle it."

Do not revise `FINDINGS.md` after reading theirs. Add to it.

## KEY LOCATIONS

Corpus, all three, recursive — note that recursive counts are much larger than top-level counts:

    /scion-volumes/scratchpad/projects/farmtable/briefs/
    /scion-volumes/scratchpad/projects/farmtable/reports/
    /scion-volumes/scratchpad/projects/farmtable/em-tooling/

Your outputs go here, and nowhere else:

    /scion-volumes/scratchpad/projects/farmtable/predicate2/PREDICATE.md
    /scion-volumes/scratchpad/projects/farmtable/predicate2/FINDINGS.md

Create that one directory. It should not already exist — **if it does, stop and tell the
coordinator rather than writing into it.**

## DELIVERABLES

1. `PREDICATE.md` — written and complete **before** any search result exists.
2. `FINDINGS.md` — enumerated population, the equality, every hit classified, excluded classes
   named, and the Phase 3 comparison as its final section.
3. One message to the coordinator when Phase 1 is done, and one when everything is done.

A zero is a completely acceptable answer. **A zero from a named population with proven controls is
a result; a zero from a search you cannot describe is not.** Do not manufacture findings, and do not
soften a zero into a maybe.

## DIRECT CONTACT

Coordinator: `scion message --non-interactive coordinator "..."`

Ask the coordinator, not another agent, and not the user. Do not contact the user under any
circumstances.

## TERMINATION

You MUST produce `PREDICATE.md` before searching, then `FINDINGS.md` with its comparison section,
message the coordinator, and then mark the task complete.
