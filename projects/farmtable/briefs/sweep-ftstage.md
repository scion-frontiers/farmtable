# BRIEF: sweep-ftstage — IS THE UNPROVISIONED POPULATION THE CORNER CASE OR THE DEFAULT?

## 0. THE BUILD FENCE — READ THIS FIRST AND DO NOT SKIP IT
The operative build fence is **§OP-1 of `em-tooling/_STANDING-RULES-2026-07-29.md`**, PART 6, at the
end of that file. **BEFORE YOUR FIRST BUILD OF THE SESSION YOU MUST ASK THE ENG-MANAGER "IS §OP-1
CURRENT?" AND READ THE ANSWER BACK. IF NO ANSWER ARRIVES, §OP-1(a) APPLIES AND YOU DO NOT BUILD.**
For this task the question is moot and I am saying so explicitly rather than leaving it implied:
**YOU HAVE NO BUILD TOKEN AND YOU WILL NOT NEED ONE. THIS TASK IS READS AND GREPS ONLY. DO NOT RUN
`go build`, `go vet`, `go test`, `npm test`, `make` ANYTHING. If you conclude you need to execute
something, STOP AND ASK ME — do not decide it yourself.**

## 1. WHY YOU EXIST
Review round 11 of #194 closed with **zero remedies adopted** and one root cause:
`labelNamesToIDs` silently discards a stage-label name the repository has no label for — **no
error, no log, no return value.** In a repository where the `ft:stage/*` labels have never been
created, this means a task created as `triage` lands with **no stage label at all** and reads back
as **`accepted`** — a free privilege escalation (finding row 1B, HIGH).

The fix is to make that write observable (error on unresolvable label). **THE FIX IS A BREAKING
CHANGE FOR EVERY DEPLOYMENT CURRENTLY RUNNING WITHOUT THOSE LABELS.** Nobody knows how many that is.

**YOUR JOB IS TO MEASURE HOW MANY, FROM SOURCE, SO THAT A HUMAN IS NOT ASKED A QUESTION A GREP CAN
ANSWER.** The rule behind that, from the coordinator, and it is the reason this task exists:
> **ASKING A HUMAN A MEASURABLE QUESTION DOES NOT RETRIEVE THE FACT. IT RETRIEVES HIS BELIEF ABOUT
> THE FACT — AND THE BELIEF GETS FILED AS THE ANSWER, INDISTINGUISHABLY, WITH HIS AUTHORITY ON IT.**

## 2. THE QUESTION, STATED SO IT CAN COME BACK "NO"
**DOES ANYTHING IN THIS REPOSITORY PROVISION THE `ft:stage/*` LABELS INTO A GITHUB REPOSITORY, OR
INSTRUCT AN OPERATOR TO DO SO?**
Search surfaces (this list is a floor, not a ceiling — **extend it and say that you did**):
deployment manifests, helm charts, terraform, k8s yaml, migrations, seed data, non-test fixtures,
install/setup docs, README, getting-started paths, Makefile targets, shell scripts, CI workflows,
CLI subcommands, and any `bootstrap`/`provision`/`init`/`setup` code path.

## 3. HOW YOU MUST MEASURE — THESE ARE NOT SUGGESTIONS
1. **STATE THE SHA ON EVERY CITATION.** There are **three live trees** tonight and every unqualified
   line number in this project is ambiguous across all of them: `origin/main` **7a0f220**, canonical
   **633f8f2** (39 ahead, unpushed), and **160e211**. **A file:line WITHOUT A SHA IS NOT A CITATION,
   IT IS A GUESS THAT LOOKS LIKE ONE.** Say which tree you read. Work in your own worktree; never a
   direct checkout in shared `/workspace/farmtable`.
2. **EVERY NEGATIVE RESULT NEEDS A POSITIVE CONTROL.** *An empty result and a broken query are the
   same bytes.* If you report "no provisioning found," you must also report a query of the **same
   shape over the same corpus** that **did** return hits, proving your instrument was pointed at
   real files and was not silently eaten by a bad glob or a missing path. **zsh 5.9, NOT bash —
   unquoted globs are a FATAL EXPANSION ERROR; `grep` is ugrep 7.5.0.**
3. **THE CONTROL MUST BE THE SAME KIND OF THING.** A vocabulary-bounded control does not license a
   region-bounded negative. If you searched a *region*, control on that *region*.
4. **STATE THE COMMAND AND THE OBSERVED VALUE. NEVER THE VERDICT.** Pre-register your decision rule
   before you look; never pre-register the search space.
5. **A CHECK WHOSE SUCCESS CONDITION IS *NO MATCH* EXITS 1 WHEN CLEAN AND 0 WHEN COMPROMISED.** Do
   not wrap anything in `|| true`.
6. **DISTINGUISH THREE OUTCOMES, NOT TWO: FOUND / MEASURED-ABSENT / UNMEASURED.** "Unmeasured" is a
   real answer and it is not a failure. **MARK IT AND ADDRESS IT TO ME BY NAME — a declined
   measurement with no owner decays into exactly the silence a false negative would have produced,
   more honestly and just as quietly.**
7. **DO NOT SEARCH ONLY FOR THE TOKEN.** `ft:stage` may never appear literally; provisioning may go
   through a constant, a variable, a template, or a loop over a stage enum. **THE PLACES A LABEL CAN
   BE CREATED ARE OPEN; FIND THE CHOKEPOINT — every path that creates a GitHub label at all — AND
   CHECK WHAT REACHES IT.** Enumerate at the chokepoint, not at the source.

## 4. THE PREDICTION YOU ARE TESTING — AND IT IS THE TRAP
There is a **derived, unmeasured** prediction on the table, from the coordinator:
> *If the docs promise auto-creation three times and the `AutoCreateLabels` flag defaults to `true`,
> then operators had every reason NOT to provision those labels — so the unprovisioned population is
> the DEFAULT rather than the corner case.*
**`AutoCreateLabels` IS DECLARED, DEFAULTS TO `true`, IS SPECIFIED THREE TIMES IN THE DESIGN DOC,
IS PINNED BY FIVE TESTS, AND HAS NEVER BEEN IMPLEMENTED. VERIFY THAT INDEPENDENTLY — DO NOT TAKE IT
FROM ME.** (Start point: is there any writer of a GitHub label-creation call anywhere? Round 11
enumerated all 15 methods on the GraphQL client and found no `createLabel`; there is also a
go-github REST client at `internal/platform/github/github.go:23` with 4 calls. **CHECK BOTH, AND
CHECK WHETHER THERE IS A THIRD CLIENT — the fifteen-method bound was found to be one client too
narrow once already tonight.**)
**THE PREDICTION IS THE HAZARD. I AM TELLING IT TO YOU BECAUSE HIDING IT WOULD BE DISHONEST, AND
BECAUSE YOU WILL FIND IT ANYWAY. A SWEEP THAT CONFIRMS A PREDICTION IT WAS SHOWN IN ADVANCE IS
WORTH LESS THAN ONE THAT DID NOT SEE IT — SO WRITE DOWN, BEFORE YOU START, WHAT EVIDENCE WOULD
FALSIFY IT, AND PUT THAT SENTENCE IN YOUR REPORT ABOVE YOUR RESULTS.** If you find provisioning,
say so loudly; that outcome kills a HIGH finding's escalation path and is the more valuable result.

## 5. DELIVERABLE — EXPLICIT, BECAUSE AN IMPLICIT ONE DOES NOT GET WRITTEN
Write **`/scion-volumes/scratchpad/projects/farmtable/reports/sweep-ftstage.md`** containing:
1. Your pre-registered falsification sentence (§4), written before your results.
2. The tree/SHA you read.
3. Every command run, verbatim, with observed values — **not verdicts**.
4. Positive controls for every negative.
5. **THE ANSWER IN ONE OF THREE FORMS: PROVISIONING EXISTS (cite it) / MEASURED ABSENT (with
   controls) / UNMEASURED (with the reason and the surface you could not reach).**
6. A `[MEASURED] / [DERIVED] / [UNCHECKED]` tag on **every** claim. Untagged claims will be treated
   as unmeasured.
7. Anything you found that falsifies something in this brief. **I would rather be corrected than
   agreed with, and the brief above has already been wrong once tonight in a similar form.**
Then **write a project log entry** under `.design/project-log/`.

## 6. HARD CONSTRAINTS
- **DO NOT PUSH. EVER.** Only the eng-manager pushes.
- **DO NOT MODIFY PRODUCTION CODE.** Not one line. Your independence is the deliverable.
- Do not touch `/workspace/farmtable-em-verify195`. Do not touch Phase 1 (merged, deployed, live).
- If you echo any git remote URL, redact it: `sed 's#//[^@]*@#//REDACTED@#g'`.
- Signal `sciontool status blocked "<reason>"` if you wait on me; never `sleep`, never poll.

## 7. TERMINATION
**YOU MUST WRITE `reports/sweep-ftstage.md` AND THE PROJECT LOG ENTRY, REPORT YOUR ONE-LINE RESULT
TO ME, AND THEN MARK THE TASK COMPLETE.** Do not stall after finishing the analysis — **THE
ANALYSIS IS NOT THE DELIVERABLE; THE FILE IS.**
