# dev-103-testlist — TIER 1, ACTIVE HARM. #103: A MERGE THAT DELETES A TEST SUITE AT EXIT 0.

## 0. WHY YOU EXIST, AND THE ONE SENTENCE THAT MATTERS
`#195` and the XSS branch (`url-scheme-validation-r5`) carry **MUTUALLY EXCLUSIVE `npm test` lists**.
Resolving that conflict in the ordinary way — take one side, or take "both" as git sees them — **DELETES
A WHOLE TEST SUITE AND REPORTS SUCCESS.** `npm test` exits 0 with fewer suites than it had before, and
nothing anywhere prints a smaller number.

**THIS IS THE ONLY ITEM IN THE BACKLOG THAT DESTROYS THINGS.** Everything else is a defect that sits
still. This one removes the instrument that would find the others.

## 1. THE COMPOSITION — READ THIS BEFORE YOU SCOPE ANYTHING
#103 was graded alone, at file time, as "a bad merge behaviour." It is not. Compose it:
- **#22 — THERE IS NO CI ANYWHERE IN THIS REPOSITORY.** I measured it at 02:49Z: no
  `.github/workflows`, no `.gitlab-ci.yml`, no `.circleci`, no `Jenkinsfile`. `.github/` holds two
  markdown templates and nothing else. **AND TASK #22 IS MARKED `completed`.**
- **#100 — `go build`, `go vet` and `go test` ALL fail on a fresh clone**, because `assets.go:5` has
  `//go:embed all:web/dist` and `web/dist` is untracked. Every Go gate this project has ever reported
  green was contingent on a directory not in the repository.
- **#84 [HIGH] — no path in this repo runs the markdown guard.** Not CI, not `make test`, not the
  release path, not any doc.
- **#89 — the XSS chokepoint scanner is itself a guard nothing runs.**

Together, and this is the finding, not a summary:
> **A TEST SUITE CAN BE DELETED, THE DELETION REPORTS SUCCESS, AND THERE IS NO SECOND OBSERVER ANYWHERE
> IN THIS PROJECT THAT WOULD EVER NOTICE.** The guards that exist are unrun; the runner that would run
> them does not exist; the task saying so is marked done.

**A BACKLOG OF UNOWNED ITEMS IS NOT A LIST OF INDEPENDENT RISKS. IT IS A SET THAT COMPOSES, AND NOBODY
GRADES THE COMPOSITION, BECAUSE GRADING HAPPENS AT FILE TIME AND FILE TIME IS EXACTLY WHEN THE OTHER
ITEMS ARE NOT IN VIEW.**

## 2. YOUR DELIVERABLES — QUOTED IN FULL, NOT BY NUMBER
*(A deliverable referred to by ordinal is not a specification. Each of these is stated completely here.
If you find yourself inferring what one means, STOP AND MESSAGE ME — inferring a deliverable is how a
leg ships a proposal with a reputation.)*

**D1. MEASURE THE TWO LISTS. SOURCE ONLY, NO BUILD, NO `npm`, NO `go`.**
Read the `test` script (and any `pretest`/`posttest`) in `web/package.json` on **both** sides. Use
`git show <ref>:web/package.json`. Write down, verbatim, both command strings and the exact set of
suites each one causes to execute. **Report the SHA you read each from — the branch name is not an
identifier, the SHA is.** If a side reaches suites indirectly (a glob, a config file, a runner's own
discovery), say so; a glob's membership is not readable from the script alone and you must mark that
part **UNKNOWN**, not enumerate it.

**D2. NAME THE DELETION CONCRETELY.** For each of the three resolutions — take-ours, take-theirs,
naive-union — state **which named suites stop running**. Not a count. **NAMES.** A count is a floor and
floors are absorbed; membership resists. If a resolution deletes nothing, say so and show why.

**D3. WRITE THE RECONCILED `test` SCRIPT** that runs the union of both sides' suites. This is the
actual fix and it is source-only.

**D4. THE GUARD, AND IT MUST BE ABLE TO FAIL.** A check that fails the build when the number of
executed suites drops below a pinned figure. Then — **this is not optional and it is the deliverable,
not the guard** — **MAKE IT GO RED ON PURPOSE.** Delete a suite from the list, run the guard, and paste
the actual failing output with its nonzero exit status. **A GUARD THAT HAS ONLY EVER PRINTED 0 HAS BEEN
OBSERVED AGREEING, NOT FIRING.** If you cannot make it go red, you have not got a guard, and saying so
is a complete and acceptable answer to this deliverable.
Pin **MEMBERSHIP, NOT A COUNT**, if the runner will let you: a named-set assertion resists compensating
substitution, a threshold does not. If only a count is available, say which you shipped and why.

**D5. STATE, IN ONE LINE EACH, WHAT YOU DID NOT DO.** The Go half (#100) is NOT yours. CI (#22) is NOT
yours — the coordinator owns it. Do not build either. Name them as out of scope so the next reader does
not read your silence as coverage.

**D6. A PROJECT LOG ENTRY** at `.design/project-log/`. Not optional. State what you **MEASURED**, what
you **DERIVED**, and which is which — those are different marks and most of tonight's errors were a
derivation wearing a measurement's clothes.

**D7. COMMIT.** Clear messages, one logical change each.

## 3. NON-NEGOTIABLES
- **DO NOT PUSH.** Ever. Commit locally. Pushing is mine, exclusively.
- **YOU HAVE NO BUILD TOKEN AND YOU MAY NOT REQUEST ONE TONIGHT.** Exactly one exists project-wide and
  another leg holds it. **NO `npm test`, NO `npm run build`, NO `go build`, NO `go test`, NO `make`.**
  This whole task is achievable by reading source and git blobs, and D4's red-run is a run of *your
  guard script*, not of the suite. If you believe a deliverable requires a build, **STOP AND MESSAGE
  ME** — do not proceed.
- **DO NOT TOUCH `/workspace/farmtable`** (canonical) or `/workspace/farmtable-em-verify195` (standing
  coordinator ruling). Work in your own worktree; no two legs may ever share a scratch path.
- **Phase 1 is merged, deployed and LIVE IN PRODUCTION.** Do not touch it, do not redeploy it.

## 4. APPARATUS — EVERY ONE OF THESE COST A LEG REAL WORK TONIGHT
**REQUIRED READING: `/scion-volumes/scratchpad/projects/farmtable/briefs/_BRIEF-RULES.md` (1166 lines) and
`/scion-volumes/scratchpad/projects/farmtable/em-tooling/_STANDING-RULES-2026-07-29.md` (514 lines, GROWING TONIGHT).** Read them,
at their current line count, before you start. They are the artefact of record. Rules are not
distributed by message and I am not replaying them at you — a replay is an enumeration and it drifts
from the file the moment the file changes. What follows is the short list, not the set.
- **THIS IS zsh, NOT bash.** An unquoted glob that matches nothing is a **FATAL EXPANSION ERROR THAT
  KILLS THE WHOLE COMMAND LINE.** Quote every glob: `--include='*.go'`. `;` does not protect you.
- **`${PIPESTATUS[0]}` IS EMPTY IN zsh.** The array is `$pipestatus` and it is **1-INDEXED**. It is
  also **CLOBBERED BY THE COMMAND THAT READS IT** — snapshot in one line: `ps=("${pipestatus[@]}")`.
  **CORRECTED 02:5xZ BY THE COORDINATOR — THE ORIGINAL TEXT HERE FAILED OPEN. See Broadcast 20.**
  The original read: use `rc=${pipestatus[1]:-${PIPESTATUS[0]}}; echo "EXIT=${rc:-MISSING}"` because an
  absent reading "fails closed rather than passing as zero." **THAT JUSTIFICATION IS FALSE.** The
  clobber does not make the value ABSENT, it REPLACES IT WITH THE SUCCEEDING COMMAND'S ZERO — so
  `${rc:-MISSING}` is a sentinel for a condition that CANNOT OCCUR after a pipeline. The MISSING branch
  is unreachable precisely in the failure it appears to guard, and the output reads `EXIT=0`.
  **THE RULE IS THE SENTENCE, NOT THE FORM: CAPTURE IMMEDIATELY AFTER THE PIPELINE. NOTHING BETWEEN THE
  PIPELINE AND THE CAPTURE — NO echo, NO DIAGNOSTIC, NOTHING THAT RUNS. PRINT FREELY AFTERWARDS.**
      ( exit 42 ) | cat
      rc=${pipestatus[1]:-${PIPESTATUS[0]}}     <- nothing above this line but the pipeline
      echo "EXIT=${rc:-MISSING}"                <- print from here on, as much as you like
  Pure assignment does not clobber, so capture-by-assignment is still right. For more than one element
  snapshot on the pipeline's own line: `ps=("${pipestatus[@]}")`.
  **IF YOU EVER SEE THIS FORM QUOTED WITHOUT THE "nothing between" SENTENCE, THAT COPY IS BROKEN** —
  including the copy that was on this line until now, which is how it reached you.
- **`cmd | tail` REPORTS `$?` FROM `tail`.** I did this to myself at 02:49Z in the command measuring
  #22 for this brief: four `ls` failures, and my own guard printed `EXIT=0`. Reading `$?` after a
  pipeline is the defect; the spelling is not.
- **NEVER `2>/dev/null` ON AN EXPLORATORY COMMAND.** A leg tonight muted a diagnostic and read its own
  silence as data — `git show <sha>:<path>` exited **128** because the file did not exist at that SHA,
  printed nothing, and the nothing was reported as a finding. **AN UNREAD DIAGNOSTIC IS RECOVERABLE BY
  READ-BACK; A SILENCED ONE IS NOT, BECAUSE YOU DESTROYED IT AT CAPTURE.**
- **ABSOLUTE PATHS ALWAYS.** The harness resets cwd to `/workspace` between calls.
- **BACKTICKS IN `scion message` EXECUTE.** Write the body to a file with a quoted heredoc (`<<'EOF'`)
  and send `"$(cat file)"`.
- **A TRUNCATED READ THAT LANDS MID-LIST DOES NOT LOOK TRUNCATED — IT LOOKS LIKE A SHORTER LIST.** A leg
  tonight filed a corrected population count read off its own `head -10`. If you pipe a list to a
  limiter, the limit is part of the result.
- **SAY MEMBERSHIP, NEVER EXACT.** A floor fails by margin absorption; an exact count fails by
  compensating substitution; membership resists both.
- **MARK EVERY CLAIM MEASURED / DERIVED / UNCHECKED**, in the sentence. A claim relayed without its
  evidence mark carries nothing.

## 5. TERMINATION
Report to me by `scion message farmtable-em-task-state-model-v2`. Do not contact ptone. Do not contact other legs.
**You MUST produce D1–D7, write `reports/dev-103-testlist.md`, commit, and then mark the task
complete.** If you are blocked, say so and stop — do not proceed on an inference.
