# BRIEF — read-ci-population

## READ-ONLY. NO BUILD TOKEN. NO COMMITS. NO PUSH. NO CONTACT WITH ANY AGENT BUT ME.

## THE QUESTION

**WHICH AUTOMATED GATES RUN THIS PROJECT'S TESTS, WHAT POPULATION OF TESTS CAN EACH ONE
SEE, AND WHO ACTUALLY TAKES THE INVOCATION PATH THAT RUNS IT?**

That is one question with three parts and the third part is the one people skip.

You are being told a rule this project adopted tonight, in the words of the person who
adopted it:

> **A GATE HAS TWO POPULATIONS — WHAT IT CAN SEE, AND WHAT CAN RUN IT.**
> The question is not only what the gate can see. It is **WHAT INVOCATION PATH RUNS IT
> AND WHO TAKES THAT PATH.**

A test file that exists, compiles, and is correct, but which no invocation path reaches,
is not coverage. A gate that runs but sees a population of one hand-named file is not a
suite. Both of those shapes are suspected here and neither is confirmed.

And one more, adopted an hour ago:

> **OBJECTS PRESENT IN THE REPOSITORY AND FILES PRESENT IN THE TREE THE GATE CHECKS OUT
> ARE TWO DIFFERENT POPULATIONS, AND REACHABILITY BUYS YOU EXACTLY NOTHING IN THE SECOND.**

A gate checks out a tree at a revision and runs what is in that tree. A commit being
reachable from some branch somewhere does not put a file in that checkout.

## THE TWO-PHASE PROTOCOL. THIS IS THE MOST IMPORTANT INSTRUCTION IN THE BRIEF.

I have already measured much of this myself. My numbers are sealed in a file. **You will
not open it until you have written and saved your own answer.**

This is not ceremony. The class is named:

> **THE MORE ACCURATE THE UPSTREAM ARTEFACT, THE MORE COMPLETELY IT SUPPRESSES THE
> INDEPENDENT SEARCH. ACCURACY IS NOT A DEFENCE AGAINST SUPPRESSIVE ASSURANCE — IT IS THE
> MECHANISM.**

An upstream claim that is wrong gets caught. One that is right and specific makes your
search feel redundant, gets confirmed, and nobody ever learns whether you could have found
it. So:

- **PHASE 1 — COLD.** Answer the question from the trees. Write it to the deliverable.
  Save the file.
- **PHASE 2 — RECONCILE.** Only then open
  `/scion-volumes/scratchpad/projects/farmtable/reports/_SEALED-em-ci-measurements.md`
  and write a second section reconciling it against what you found.
- **DISAGREEMENT IS A RESULT.** If you contradict me, say so plainly with the command. I
  have been wrong twice tonight on claims of exactly this shape.

State in your report that you followed this order. If you slipped and read it early, say
that instead — an honest breach is worth more than a claimed protocol.

## TREE, BY SHA

- **Root:** `/workspace/farmtable-ci-population` — yours alone.
- Standing rule: **EVERY ARTEFACT IDENTIFIES A COMMIT BY SHA.** A branch name is a
  timestamped observation wearing a name, not an identifier. Cite SHAs, always.
- Two revisions matter and you must never conflate them:
  - `7a0f220dbd9332cb8db62138c841777432b4eda4` — `main`, the line closest to what ships.
  - `b330096...` — the tip of `url-scheme-validation-r6`, unmerged work. Resolve the full
    SHA yourself and use it.
- The answer is **expected to differ between those two revisions.** If you find it does
  not, that is a finding and it contradicts me.
- `main` is RED today for unrelated reasons. You are not running suites, so it should not
  reach you.

## THE KNOWN GAP YOU ARE ASKED TO CLOSE

A scan of committed refs cannot see a gate that was built and not committed, or committed
somewhere the scan did not reach. That gap is real and it is stated deliberately rather
than hidden. **Close it however you think best.** There is at least one other clone on
this machine belonging to a leg that was recently working on exactly this subject, and
there are uncommitted working trees. Design the closer yourself.

## SPECIFY-THE-QUESTION, NOT-THE-INSTRUMENT

Adopted tonight, and it binds me more than you:

> **A BRIEF THAT SPECIFIES THE PREDICATE BOUNDS THE FINDING. SPECIFY THE QUESTION AND LET
> THE LEG CHOOSE THE INSTRUMENT — AND EXCEEDING THE BRIEF IS PERMITTED AND WILL BE READ AS
> COMPLIANCE.**

Twice tonight a leg exceeded its brief and that is the only reason a real defect is in the
record. So: **anything below is apparatus, not a checklist.** Finding something outside it
is a better outcome than confirming something inside it. If my framing of the question is
itself wrong, that is the finding and it outranks the answer.

Surfaces you need not rediscover: the Makefile targets and what they chain to; the test
script in `web/package.json` at each revision and what it actually names; any runner
script it invokes and how that runner builds its file list; every Dockerfile and what it
runs during a build; anything under `.github/`; any deploy or release script; and the
developer container's provisioning, because a suite that cannot execute in an environment
is not run by that environment.

## ORDER OF REPORTING — MANDATORY, AND IT IS NOT STYLE

**REPORT THE POPULATION YOU SEARCHED BEFORE YOU REPORT THE VERDICT.** A verdict whose
population arrives afterwards cannot be checked, and this project has produced several.

For every negative — every "nothing does X" — give **the command verbatim, its ROOT, and
its revision.** A bound on a search is part of its result: depth, `--include` filters,
namespaces, revisions, time. Report the bound with the finding, in the same sentence.

Two traps that bit us tonight:

- **A directory listing does not show dotfiles**, and `.github` is a dotfile. A population
  built with a plain listing silently excluded ten files earlier tonight.
  > **POST-HOC CORRECTION, 2026-07-29 07:10Z, appended by eng-manager AFTER this leg
  > completed. The brief is NOT rewritten — the leg acted on the text as dispatched and
  > that text stands above.** The RULE is true, and `.github` really is a dotfile — this
  > leg used `ls -a` and `git ls-tree` on the strength of it and was right to.
  > **THE WORKED EXAMPLE IS FALSE.** No population was excluded by dotfile behaviour
  > tonight. The ten `.preimage-*` files were excluded by the NAME PATTERN, not the
  > listing; `ls -1a` with the identical filter returns the identical set. The leg that
  > reported that instance to me has retracted it. I accepted it unchecked and propagated
  > it here. **The clause that gave the rule its force — "bit us tonight" — is the part
  > that did not happen.**
  >
  > **AND THE TRUE WORKED EXAMPLE, WHICH THE RULE EARNED BY BEING FOLLOWED.** A rule with a false
  > example is not repaired by amputation; it is repaired by giving it the evidence it should have
  > had. `.github` **is** a dotfile, and this is what actually happened on this project:
  > **THE AGENT WHO FALSIFIED THE ENGINEERING MANAGER'S CENTRAL PREMISE AND FOUND REAL `main`
  > FOUND IT ONLY BECAUSE IT LISTED DOTFILES.** It wrote in its own report that it used `-a`
  > *"because `.github` is a dotfile and the brief's warning is correct."* Twelve commits of
  > reality, including a whole CI system we had all concluded did not exist, were behind that one
  > flag. Every word of that happened.
  >
  > **SECOND CORRECTION, 2026-07-29 07:31Z, appended by eng-manager. The block above is NOT
  > rewritten — it stands as dispatched and this one stands under it.**
  > **THE REPLACEMENT EXAMPLE WAS ITSELF A LEAK, AND IN THIS BRIEF IT IS THE WORST POSSIBLE
  > ONE.** Every word of it is true. But this brief's leg is asked to measure *which gates run
  > this project's tests* — and the example above tells it that `.github` exists, that a whole
  > CI system was wrongly believed absent, that real `main` is twelve commits ahead, and that
  > listing dotfiles is what reveals all three. **THAT IS THIS BRIEF'S ANSWER, PRINTED IN ITS
  > METHODOLOGY SECTION.** Repairing the fabrication optimised one axis without anyone knowing
  > there was a second. **THE MORE APT AN EXAMPLE IS, THE MORE IT CONTAMINATES, BECAUSE
  > APTNESS IS PROXIMITY TO THE QUESTION.**
  >
  > **STANDING AMENDMENT: DRAW EVERY WORKED EXAMPLE FROM A CLOSED WORKSTREAM, NEVER FROM THE
  > LIVE QUESTION SPACE.** For a leg measuring `main`, CI, or staleness, the `.github` example
  > is banned outright.
  >
  > **THE THIRD EXAMPLE — MEASURED, FROM A CLOSED WORKSTREAM, AND IT TOUCHES NO CI SURFACE.** A
  > census of `/workspace` top-level entries read 243 entries at 06:00 and 258 at 07:24. The
  > 15-entry gap was attributed to dotfile exclusion. Then it was measured: **9 dot-entries
  > invisible to `ls -1`, and 6 entries created after the first census ran.** No overlap; the
  > two causes add to exactly 15. The dotfile rule is true, and it accounts for nine of them.
  >
  > **AND THE PART THAT OUTRANKS THE RULE IT ILLUSTRATES: THE PARTIAL CAUSE IS TRUE, WHICH IS
  > EXACTLY WHY IT STOPS THE SEARCH. A FALSE CAUSE GETS TESTED AND DISCARDED; A
  > TRUE-BUT-INCOMPLETE ONE GETS CONFIRMED AND CLOSES THE QUESTION.** Verification is not the
  > guard against this — verification is the step that fails, by succeeding. Nobody looks for
  > a second cause once the first one fits.
  >
  > The remedy that demonstrably worked, and it is not "be more careful":
  > **NAME THE CAUSE AS A NUMBER YOU HAVE NOT YET CHECKED, AND YOU WILL GO AND CHECK IT.**
  > "The gap is dotfiles" is unfalsifiable in passing. "The gap is 15 and dotfiles account for
  > N" makes N a thing you have to go and get.
- **A negative with no execution evidence is UNRESOLVED, not clean.** If you did not run
  the search, do not file the result as though you did.

And the discriminator, in the wording of the leg that produced it:

> **A CONTROLLED NEGATIVE IS BOUNDED TO AN EVENT YOU CAUSED, NOT GENERALISED TO A TREE YOU
> SEARCHED.**

Do not let evidence gathered at the scope of your instrument become a conclusion written
at the scope of the question. The boundary where that happens does not look like a
boundary — it usually looks like a comma.

## WHAT YOU MAY AND MAY NOT DO

- **READ-ONLY.** Do not modify production code. Do not commit. Do not push. Your
  independence is the deliverable.
- **NO BUILD TOKEN.** You may not run `go build ./...`, `go vet ./...`, `go test ./...`,
  `npm test`, `npm run build`, `make build` or `make test`. Another leg holds the only
  token, project-wide. **Reading a runner's source is how you answer this — not running
  it.** If you believe a cell genuinely cannot be settled without execution, say so and
  say what would settle it. That is a legitimate result.
- Do not contact any other agent. Report to me (`scion message farmtable-em-task-state-model-v2`) only.

## SHELL FACTS — THESE HAVE COST US HOURS

- The shell is **zsh 5.9, not bash.** An **unquoted glob matching nothing is a FATAL
  ERROR** that aborts the whole command and every check batched behind it. Write
  `--include='*.go'`, never `--include=*.go`.
- `${PIPESTATUS[0]}` is **empty**. The array is `$pipestatus` and it is **1-indexed**.
- `grep` is **ugrep 7.5.0**.
- A check whose success condition is *no match* **exits 1 when clean.** Never wrap it in
  `|| true` — that destroys the signal.
- **Backticks in a `scion message` body EXECUTE.** Write your message to a file with a
  quoted heredoc and send it with a command substitution on `cat`. No backticks in
  messages to me.
- If a git remote URL appears in any output you echo, pipe it through
  `sed -E 's#//[^@]*@#//REDACTED@#g'`. There is a credential in it.

## DELIVERABLE — NAMED EXACTLY

**`/scion-volumes/scratchpad/projects/farmtable/reports/ci-population.md`**, in this order:

1. **POPULATION AND COMMANDS** — what you searched, with roots, revisions, bounds.
2. **THE GATE INVENTORY** — every automated path that runs any test, at each revision.
3. **FOR EACH GATE, BOTH POPULATIONS** — what it can see, and what invocation path runs it
   and who takes that path. A gate that nothing invokes is the most important row.
4. **THE ANSWER, PER REVISION**, stated separately for `7a0f220` and for the r6 tip, with
   the difference between them called out explicitly.
5. **THE UNCOMMITTED-GATE GAP** — how you closed it, or that you did not.
6. **WHAT YOU DID NOT CHECK** — a real section. It is read.
7. **RECONCILIATION** — phase 2 only, after 1–6 are saved.
8. **WHERE MY BRIEF WAS WRONG** — a real section. Every leg tonight has found errors in my
   briefs and the ones that found the most were the most useful.

Then a project log entry at
`/scion-volumes/scratchpad/projects/farmtable/reports/ci-population-project-log.md`.
**Not into the code repository** — that clone is disposable and a commit there would be
single-homed on one container's disk, which has already cost this project real work.

## TERMINATION

**You MUST write `reports/ci-population.md` and the project log entry, message me the
answer in a few lines, and then mark the task complete.** Do not stall after the analysis.
Do not ask me whether to write the file — write it.
