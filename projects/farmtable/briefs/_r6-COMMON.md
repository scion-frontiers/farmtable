# COMMON BRIEF — round six independent review (url-scheme-validation / remote_data)

This file is shared by three legs. Your role-specific brief sits beside it. Read both.
**You are one of three. You do not know what the other two find and you will not be told
until all three reports are in.**

---

## 1. THE ARTEFACT, BY SHA

- **Commit under review: `c108acbcfa2357862576092469828709bb6c4090`**
- Branch name at that commit: `url-scheme-validation-r6`. **The name is not the identifier.**
  A branch tip is a timestamped observation wearing a name. Cite SHAs in every sentence that
  asserts anything about code.
- Base of the round: `d305391`. The round's own commits are the range
  `d305391..c108acb`.
- This branch **has never been pushed to any remote.** It exists in this host's object
  stores only.

**A RANGE IS NOT AN AUTHORSHIP SET.** A branch accumulates other people's commits. If you are
going to say *who* did something, run `git log --format='%h %ad %an %s' --date=short -- <path>`
on the path first. We misattributed an artefact tonight by inferring an author from a revision
range, and the correction cost two absent agents their credit.

---

## 2. YOUR TREE, AND EXACTLY HOW IT WAS PROVISIONED

Your root is named in your role brief. **No two legs share a scratch path.** Do not read,
write, build or run in another leg's tree, in `/workspace/farmtable` (canonical, someone else's
working tree), or in `/workspace/farmtable-xss-r6-fix` (the developer's tree).

**PROVENANCE OF YOUR TREE, STATED BECAUSE A BOUND THAT DOES NOT TRAVEL DOES NOT EXIST:**

- Your tree is a clone of canonical, detached at `c108acb`.
- `web/node_modules` was installed by the engineering manager with `npm ci` from the lockfile
  at `c108acb`. **79 top-level entries.**
- `web/dist` **was NOT built in your tree.** It was built once by the engineering manager in
  `/workspace/farmtable-review-xss-r6` at `c108acb` (`npm run build`, exit 0) and **copied**
  into the other two trees. If your finding depends on `web/dist` being the product of your own
  tree's build, **rebuild it and say that you did.**
- Why this matters: the repo root carries `//go:embed all:web/dist`. **A fresh clone with no
  `web/dist` fails `go build ./...`, `go vet ./...` and `go test ./...` for reasons that have
  nothing to do with this diff.** Every Go gate this project has reported has been contingent
  on an untracked directory. If you see a build failure that smells like this, check `web/dist`
  before filing anything.
- **A CAUTION MEASURED TONIGHT, AND THEN CORRECTED — I am giving you both halves because the
  correction is the useful part.** I first observed that canonical's `web/node_modules` has
  **110** top-level entries while the clean install in your tree has **79**, that the build
  FAILS against the 110 and SUCCEEDS against the 79, and I wrote that down as
  *the larger population is not a superset*. True, and scoped wrong. The actual mechanism:
  **the two sets are installs of two different manifests.** Canonical sits at a different
  commit whose `web/package.json` is not the one at `c108acb`; each `node_modules` is correct
  for its own manifest and neither is a version of the other.
  **A DEPENDENCY TREE BELONGS TO A MANIFEST, AND SHARING ONE ACROSS COMMITS IS A CATEGORY
  ERROR, NOT A SIZE COMPARISON.** Do not reason about environments by counting, and do not
  borrow a `node_modules` from another tree.

---

## 3. THE BUILD FENCE — READ THIS BEFORE YOU RUN ANYTHING

**EXACTLY ONE BUILD TOKEN EXISTS ON THIS PROJECT AND THE ENGINEERING MANAGER HOLDS IT.**

**TOKEN REQUIRED** (you may not run these without asking and receiving it):
`go build ./...`, `go vet ./...`, `go test ./...`, `npm test`, `npm run build`,
`make build`, `make test`.

**NO TOKEN REQUIRED**, but you must log it first (see below):
a single targeted `go test ./internal/<pkg>/ -run '^TestName' -count=1`.

**Ask for the token when you need it.** Say what you intend to run and why. It will usually be
granted; the fence exists to serialise, not to refuse. **No instruction is final until you
request it** — if the token changes what you would do, say so and I will re-plan.

### Logging

Before any run, append one line to
`/scion-volumes/scratchpad/projects/farmtable/reports/_run-queue-log.md`:

`| timestamp | your-agent-name | token held? | exact command | ROOT=... SHA=... DIST=present/absent | result | note |`

**The ROOT and DIST columns are mandatory on PASSING lines too.** A 493-line version of this log
recorded a path on two of its lines, which is why every green in it is now suspect.

### Pre-registration goes somewhere ELSE, and this is a correction to prior rounds

A previous round mandated that predictions be pre-registered into this same shared log. **That
broke three-leg independence** — pre-registering into a file the other legs can read means
reading their predictions. **Fixed:**

- **Predictions, hypotheses and expected arms go in YOUR OWN file:**
  `/scion-volumes/scratchpad/projects/farmtable/reports/_prereg-<your-agent-name>.md`.
  Nobody else opens it until all three reports are in.
- **The shared run-queue log gets the mechanical record ONLY** — command, root, dist, result.
  **No predictions in the shared file.**

---

## 4. HOW TO PRE-REGISTER, AND WHY THE ARM IS A SEPARATE PREDICTION

Standing form on this project as of tonight:

> **PRE-REGISTER THE OUTCOME AND THE MECHANISM AS TWO SEPARATE PREDICTIONS, BEFORE EXECUTION.
> A RED FROM THE WRONG ARM IS A DIFFERENT RESULT FROM A RED.**

And its companion, which came out of a two-hour error in this very round:

> **A RESULTS TABLE IS A CLAIM THAT ITS CELLS ARE COMMENSURABLE, AND NOTHING IN IT STATES THAT
> CLAIM WHERE IT CAN BE CHECKED.**

So: **every cell of every matrix you produce carries its ARM, not just its colour** — in the
cell, not in a legend, not in a footnote. `RED / UNDECLARED` and `RED / MULTIPLICITY` and
`RED / DISAPPEARANCE` are three different results and a bare `RED` silently claims they are one.
This round already shipped one matrix that put a deletion result in a table about additions;
the label was right and the layout ate it.

Related and also standing:

- **A SURVIVED ROW MUST CARRY EXECUTION EVIDENCE.** If you did not actually run it, the row is
  **UNRESOLVED**, not **SURVIVED**.
- **A CONTROLLED NEGATIVE IS BOUNDED TO AN EVENT YOU CAUSED, NOT GENERALISED TO A TREE YOU
  SEARCHED.**
- **A GREEN FROM A GATE IS A RECEIPT, AND A GATE IS ONLY AS GOOD AS THE POPULATION IT CAN SEE.**
  State the population.

- **ANY POPULATION COUNT OF TEN OR FEWER IS REPORTED AS THE LIST, NOT AS THE NUMBER.** Filenames,
  identifiers, SHAs, test names — whatever the members are. A count of five costs nothing to
  expand, and a number cannot be recognised by a reader who is holding a different question than
  the one you were answering. We nearly spent a human decision tonight because a decisive pair of
  documents was reported as "two design docs" inside a count.
- **NEVER TERMINATE A COMMAND WITH AN ECHO OF ITS OWN STATUS.** `(cmd; echo $?)` returns the
  echo's status. **VERIFY A BUILD BY THE EXISTENCE AND MTIME OF ITS OUTPUT ARTEFACT, NEVER BY A
  REPORTED EXIT CODE.** The general property: **ANYTHING APPENDED TO A COMMAND TO OBSERVE IT
  BECOMES THE THING OBSERVED** — echo, `tail`, `tee`, a subshell, a wrapper. The harness's
  "completed, exit code 0" notification is a **known liar** on this axis.

---

## 5. ORDER OF WORK — COLD FIRST, THEN RECONCILE. THIS IS MANDATORY.

**PHASE ONE: an open, unscoped pass. No checklist. No prior findings.** Read the diff and the
surrounding code and form your own view of what is wrong with it. Write Phase One's output to
disk **before** you read Phase Two.

**PHASE TWO: only then** read section 7 below (what the round claims) and reconcile.

The reason is measured, not stylistic:

> **THE MORE ACCURATE THE UPSTREAM ARTEFACT, THE MORE COMPLETELY IT SUPPRESSES THE INDEPENDENT
> SEARCH. ACCURACY IS NOT A DEFENCE AGAINST SUPPRESSIVE ASSURANCE — IT IS THE MECHANISM.**

**Disagreement with section 7 is a RESULT, not a mistake.** Your report must attribute every
finding to Phase One or Phase Two, so that the value of the cold pass is falsifiable.

---

## 6. WHAT THE BRIEF IS AND IS NOT

**This brief specifies QUESTIONS. It does not specify PREDICATES.** Where I name an apparatus
(a root, a SHA, a log), that is binding. Where I name a thing to look at, that is a starting
surface and **not** a boundary.

> **EXCEEDING THIS BRIEF IS PERMITTED AND WILL BE READ AS COMPLIANCE.** Finding something I did
> not ask about is a better outcome than confirming something I did. A brief that specifies the
> predicate bounds the finding.

My targeting has steered rounds **away** from defects before, and legs that checked only what I
asked have APPROVED code that was broken.

### THE EXEMPTION RIDER — added 2026-07-29, and it was earned the hard way

If I give you a list of "environmental facts you would otherwise measure as findings," treat that
list as the **least** trustworthy paragraph in the brief.

> **AN ENVIRONMENTAL FACT THAT CONTRADICTS SOMETHING THE DIFF ASSERTS IS A FINDING, NOT AN
> EXEMPTION.**

In round six I listed the existence of a CI workflow on the merge target as an environmental fact
to be ignored. The diff under review contained a document asserting that no CI existed anywhere in
the repository. **I held both halves and joined them into an instruction not to look.** The
targeting did not merely miss the defect — it pre-classified the decisive evidence as noise. Two
legs found it anyway, by ignoring me.

**An exemption list is a targeting instrument that reads as a courtesy.** If an exempted fact and
the diff disagree, the disagreement is yours to file and I was wrong to have listed it. **Every leg tonight has found errors in my briefs, and
the ones that found the most were the most useful.** Your report has a mandatory section for
them.

---

## 7. WHAT THE ROUND CLAIMS — IN A SEPARATE FILE, ON PURPOSE

**The Phase Two content is NOT in this file.** It is at:

    /scion-volumes/scratchpad/projects/farmtable/briefs/_r6-PHASE-TWO.md

**Do not open it until your Phase One output is written to disk.** Then open it, and reconcile.

It is a separate file because in round six it was a fenced section of THIS file, and the
dispatch message said "read these two files, in full, before you do anything else." Both
instructions were mandatory and they were not jointly satisfiable. All three legs read the
embargoed content before writing anything, and the round's stated measurement was destroyed —
not by disobedience, but by obedience. A heading is not an access control against an instruction
to read the document. A file boundary is.

---

## 8. HARD RULES

- **READ-ONLY on production code.** Do not modify, do not commit, do not push. Your
  independence is the deliverable. Planted mutations for measurement are permitted **in your own
  tree only**, must be reverted, and the green must be re-confirmed after the revert and
  reported.
- **Do not contact any other agent.** Not the developer, not the other two review legs, not the
  coordinator. Report to **`eng-manager`** only.
- **Do not self-review.** You did not write this code; if you discover that you did, stop and
  tell me.
- **Do not read the other legs' reports or pre-registration files**, even if you can.

## 9. SHELL FACTS — THESE HAVE COST US HOURS

- The shell is **zsh 5.9, not bash.** An **unquoted glob that matches nothing is a FATAL ERROR**
  that aborts the whole command **and every check batched behind it.** Write `--include='*.go'`,
  never `--include=*.go`.
- `${PIPESTATUS[0]}` is **empty**. The array is `$pipestatus` and it is **1-indexed**.
- `grep` is **ugrep 7.5.0**, and it is on PATH only as `grep`.
- A check whose success condition is *no match* **exits 1 when it is clean.** Never wrap it in
  `|| true` — that destroys the signal.
- **Do not end a wrapped command list with `echo`.** `(cmd; echo $?)` returns the echo's status,
  not the command's. This manufactured a false green tonight: the harness reported exit 0 on a
  build that had failed with exit 2.
- **Backticks in a `scion message` body EXECUTE.** Write your message to a file with a quoted
  heredoc (`<<'EOF'`) and send it with `"$(cat file)"`. **Put no backticks in messages to me.**
- Redact credentials from any command echo: `sed -E 's#//[^@]*@#//REDACTED@#g'`.

## 10. TERMINATION

**You MUST write your report file, write your project-log file, message me your verdict and your
two or three highest items, and then mark the task complete.** Do not stall after finishing the
analysis. Do not ask me whether to write the file — write it.

Project-log entries go to `/scion-volumes/scratchpad/projects/farmtable/reports/`, **never into
the code repository** — your clone is disposable and a commit there would be single-homed on one
container's disk.
